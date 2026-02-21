import { useState, useRef, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type ScanState = 'idle' | 'camera' | 'preview' | 'uploading' | 'scanning' | 'done'

export function Scan() {
  const { user } = useAuth()
  const [state, setState] = useState<ScanState>('idle')
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [])

  const startCamera = async () => {
    setError(null)
    setState('camera')
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
        .catch(() =>
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        )

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError(
          'Camera permission was denied. Please allow camera access in your browser settings.'
        )
      } else if (
        location.protocol !== 'https:' &&
        location.hostname !== 'localhost'
      ) {
        setError('Camera requires a secure (HTTPS) connection.')
      } else {
        setError(`Could not access camera: ${msg}`)
      }
      setState('idle')
    }
  }

  const captureFrame = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          if (imageUrl) URL.revokeObjectURL(imageUrl)
          setImageBlob(blob)
          setImageUrl(URL.createObjectURL(blob))
          setState('preview')
          stopCamera()
        }
      },
      'image/jpeg',
      0.85
    )
  }

  const retake = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageBlob(null)
    setImageUrl(null)
    setOcrText(null)
    setState('idle')
    setError(null)
    setProgress(0)
  }

  const uploadAndScan = async () => {
    if (!imageBlob || !user) return
    setError(null)

    try {
      setState('uploading')
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, imageBlob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      setState('scanning')
      const worker = await createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      const { data: ocrResult } = await worker.recognize(imageBlob)
      await worker.terminate()

      const rawText = ocrResult.text
      console.log('[ClearCart OCR] Raw text:', rawText)
      setOcrText(rawText)

      const { error: insertError } = await supabase
        .from('receipt_scans')
        .insert({
          user_id: user.id,
          image_url: urlData.publicUrl,
          raw_text: rawText,
        })

      if (insertError) {
        console.warn('receipt_scans insert warning:', insertError)
      }

      setState('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      setState('preview')
    }
  }

  return (
    <div className="flex flex-col items-center px-6 py-6">
      <h2 className="text-xl font-bold text-gray-900">Scan Receipt</h2>
      <p className="mt-1 text-sm text-gray-600">
        Take a photo of your grocery receipt to scan prices.
      </p>

      {error && (
        <p
          className="mt-4 w-full rounded-lg bg-red-50 p-3 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {state === 'idle' && (
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <button
            onClick={startCamera}
            className="w-full max-w-sm rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Open Camera
          </button>
        </div>
      )}

      {state === 'camera' && (
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <video
            ref={videoRef}
            className="w-full max-w-sm rounded-lg bg-black"
            autoPlay
            playsInline
            muted
          />
          <button
            onClick={captureFrame}
            className="w-full max-w-sm rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Capture
          </button>
        </div>
      )}

      {state === 'preview' && imageUrl && (
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <img
            src={imageUrl}
            alt="Captured receipt"
            className="w-full max-w-sm rounded-lg border border-gray-200"
          />
          <div className="flex w-full max-w-sm gap-3">
            <button
              onClick={retake}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Retake
            </button>
            <button
              onClick={uploadAndScan}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Upload & Scan
            </button>
          </div>
        </div>
      )}

      {(state === 'uploading' || state === 'scanning') && (
        <div className="mt-6 flex w-full flex-col items-center gap-3">
          <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{
                width:
                  state === 'uploading' ? '30%' : `${30 + progress * 0.7}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {state === 'uploading'
              ? 'Uploading receipt...'
              : `Scanning text... ${progress}%`}
          </p>
        </div>
      )}

      {state === 'done' && (
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <div className="w-full max-w-sm rounded-lg bg-emerald-50 p-3">
            <p className="text-sm font-medium text-emerald-700">
              Scan complete!
            </p>
          </div>
          {ocrText && (
            <div className="w-full max-w-sm">
              <p className="text-xs font-medium uppercase text-gray-500">
                Extracted Text
              </p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
                {ocrText}
              </pre>
            </div>
          )}
          <button
            onClick={retake}
            className="w-full max-w-sm rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Scan Another
          </button>
        </div>
      )}
    </div>
  )
}
