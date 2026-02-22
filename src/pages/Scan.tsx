import { useEffect, useRef, useState } from 'react'
import Tesseract from 'tesseract.js'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  parseReceiptLines,
  savePricesToSupabase,
  type ParsedLineItem,
} from '../lib/normalize'
import {
  fetchCompetitorPrices,
  type PriceComparison,
} from '../lib/compare'
import { ComparisonCard } from '../components/ComparisonCard'

export function Scan() {
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<
    'idle' | 'camera' | 'preview' | 'uploading' | 'scanning_market' | 'done' | 'error'
  >('idle')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<PriceComparison[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setError(null)
    setStatus('camera')

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.')
      setStatus('error')
      return
    }

    if (location.protocol !== 'https:' && !location.hostname.includes('localhost')) {
      setError('Camera requires HTTPS. Please use a secure connection.')
      setStatus('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
      )

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not access camera.'
      setError(
        msg.includes('Permission') || msg.includes('denied')
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : msg
      )
      setStatus('error')
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    stopCamera()

    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log('1. Image Captured')
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })
          setCapturedBlob(blob)
          setStatus('preview')
        }
      },
      'image/jpeg',
      0.9
    )
  }

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCapturedBlob(null)
    setOcrText(null)
    setComparisons([])
    setStatus('idle')
  }

  const uploadAndOcr = async () => {
    if (!capturedBlob || !user) return

    setError(null)
    setStatus('uploading')

    try {
      const timestamp = Date.now()
      const filename = `${user.id}_${timestamp}.jpg`

      console.log('2. Uploading to Supabase...')
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filename, capturedBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('receipts').getPublicUrl(filename)

      console.log('3. Starting OCR Worker...')
      const {
        data: { text },
      } = await Tesseract.recognize(capturedBlob, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress: ${(m.progress * 100).toFixed(0)}%`)
          } else {
            console.log(
              'OCR:',
              m.status,
              m.progress != null ? `(${(m.progress * 100).toFixed(0)}%)` : ''
            )
          }
        },
      })

      console.log('4. OCR Complete. Raw text:', text)
      setOcrText(text || null)

      const { data: scanData, error: insertError } = await supabase
        .from('receipt_scans')
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          raw_text: text || '',
        })
        .select('id')
        .single()

      if (insertError) {
        console.warn('receipt_scans insert warning:', insertError)
      }

      const receiptScanId = scanData?.id
      let parsedItems: ParsedLineItem[] = []

      if (receiptScanId && text) {
        parsedItems = parseReceiptLines(text)
        const { error: pricesError } = await savePricesToSupabase(
          parsedItems,
          receiptScanId
        )
        if (pricesError) {
          console.warn('prices insert warning:', pricesError)
        }

        setStatus('scanning_market')
        const comps = await fetchCompetitorPrices(parsedItems)
        setComparisons(comps)
      }

      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload or OCR failed.')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="text-xl font-bold text-gray-900">Scan Receipt</h2>
      <p className="mt-1 text-sm text-gray-600">
        Take a photo of your receipt to extract prices.
      </p>

      {status === 'idle' && (
        <button
          type="button"
          onClick={startCamera}
          className="mt-8 w-full max-w-sm rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Take Photo
        </button>
      )}

      {status === 'camera' && (
        <div className="mt-6 w-full max-w-sm">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/3] w-full rounded-lg border border-gray-200 bg-black object-cover"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera()
                setStatus('idle')
              }}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'preview' && previewUrl && (
        <div className="mt-6 w-full max-w-sm">
          <img
            src={previewUrl}
            alt="Receipt preview"
            className="aspect-[4/3] w-full rounded-lg border border-gray-200 object-cover"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={uploadAndOcr}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700"
            >
              Upload & Scan
            </button>
            <button
              type="button"
              onClick={retake}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {status === 'uploading' && (
        <div className="mt-8 text-center">
          <p className="text-gray-600">Uploading and extracting text...</p>
        </div>
      )}

      {status === 'scanning_market' && (
        <div className="mt-8 text-center">
          <p className="text-gray-600">Scanning Market...</p>
          <p className="mt-1 text-sm text-gray-500">
            Comparing prices with Superstore
          </p>
        </div>
      )}

      {status === 'done' && (
        <div className="mt-6 w-full max-w-sm">
          <p className="text-center font-medium text-emerald-600">
            Receipt scanned successfully.
          </p>

          <ComparisonCard comparisons={comparisons} />

          {ocrText && (
            <div className="mt-4 max-h-24 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-left">
              <p className="text-xs font-medium text-gray-500">Raw OCR (preview)</p>
              <p className="mt-1 text-xs text-gray-700">
                {ocrText.length > 200 ? `${ocrText.slice(0, 200)}...` : ocrText}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={retake}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Scan Another
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-6 w-full max-w-sm">
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
