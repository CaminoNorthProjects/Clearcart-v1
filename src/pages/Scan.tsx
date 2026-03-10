import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import {
  extractStoreFromOcr,
  parseReceiptLines,
  savePricesToSupabase,
  type ParsedLineItem,
} from '../lib/normalize'
import { awardCredits } from '../lib/credits'
import {
  fetchCompetitorPrices,
  type PriceComparison,
} from '../lib/compare'
import { ComparisonCard } from '../components/ComparisonCard'
import { useTripleConstraint, type StoreResult } from '../lib/tripleConstraint'

const API_URL = import.meta.env.VITE_API_URL as string | undefined
const USE_GEMINI = !!API_URL

type ScanStatus =
  | 'idle'
  | 'camera'
  | 'preview'
  | 'uploading'
  | 'scanning_market'
  | 'done'
  | 'error'

/** Call Gemini Vision via the Express server to extract items from the receipt. */
async function parseWithGemini(imageUrl: string): Promise<ParsedLineItem[]> {
  const res = await fetch(`${API_URL}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: imageUrl }),
  })
  if (!res.ok) throw new Error('Gemini parser failed.')
  const json = await res.json() as { items: { name: string; quantity: number; unit: string }[] }
  return json.items.map((it) => ({
    item_name: it.name,
    price: 0,
    quantity: it.quantity ?? 1,
  }))
}

export function Scan() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadingRef = useRef(false)

  const [status, setStatus] = useState<ScanStatus>('idle')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<PriceComparison[]>([])
  const [error, setError] = useState<string | null>(null)
  const { stores: tcStores, run: runTripleConstraint } = useTripleConstraint()

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
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .catch(() =>
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        )

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not access camera.'
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
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const MAX_DIM = 1200
    let w = video.videoWidth
    let h = video.videoHeight
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM }
      else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM }
    }
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, w, h)
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
      0.85
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
    if (uploadingRef.current) return
    uploadingRef.current = true

    setError(null)
    setStatus('uploading')

    try {
      const timestamp = Date.now()
      const filename = `${user.id}_${timestamp}.jpg`

      console.log('2. Uploading to Supabase...')
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filename, capturedBlob, { contentType: 'image/jpeg', upsert: false })

      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filename)

      let parsedItems: ParsedLineItem[] = []
      let rawText = ''

      if (USE_GEMINI) {
        console.log('3. Parsing with Gemini Vision...')
        parsedItems = await parseWithGemini(publicUrl)
        rawText = parsedItems.map((i) => i.item_name).join('\n')
        setOcrText(rawText || null)
      } else {
        console.log('3. Starting Tesseract OCR...')
        const Tesseract = await import('tesseract.js')
        const { data: { text } } = await Tesseract.default.recognize(capturedBlob, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR progress: ${(m.progress * 100).toFixed(0)}%`)
            }
          },
        })
        console.log('4. OCR Complete.')
        rawText = text || ''
        setOcrText(rawText || null)
        parsedItems = parseReceiptLines(rawText)
      }

      const { store_name, store_type } = extractStoreFromOcr(rawText)

      const { data: scanData, error: insertError } = await supabase
        .from('receipt_scans')
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          raw_text: rawText,
          store_name: store_name ?? undefined,
          store_type,
        })
        .select('id')
        .single()

      if (insertError) console.warn('receipt_scans insert warning:', insertError)

      const receiptScanId = scanData?.id

      if (receiptScanId && parsedItems.length > 0) {
        const { error: pricesError } = await savePricesToSupabase(
          parsedItems,
          receiptScanId,
          store_name ?? undefined
        )
        if (pricesError) console.warn('prices insert warning:', pricesError)

        setStatus('scanning_market')
        const comps = await fetchCompetitorPrices(parsedItems)
        setComparisons(comps)

        const { credits } = await awardCredits(receiptScanId)
        if (credits > 0) showToast(`Success! +${credits} ClearCredits added`)

        // Run Triple Constraint engine in parallel (non-blocking)
        const itemNames = parsedItems.map((i) => i.item_name).filter(Boolean)
        if (itemNames.length > 0) {
          runTripleConstraint(itemNames).catch((err) =>
            console.warn('Triple Constraint error:', err)
          )
        }
      }

      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload or scan failed.')
      setStatus('error')
    } finally {
      uploadingRef.current = false
    }
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="font-display text-3xl font-semibold text-midnight-navy">Scan Receipt</h2>
      <p className="mt-1 text-sm text-midnight-navy/60">
        Take a photo of your receipt to extract prices.
      </p>

      {status === 'idle' && (
        <button
          type="button"
          onClick={startCamera}
          className="mt-8 w-full max-w-sm rounded-xl bg-sunset-red px-4 py-4 font-display text-lg font-semibold tracking-wide text-white transition-colors hover:bg-sunset-red/90 focus:outline-none focus:ring-2 focus:ring-sunset-red focus:ring-offset-2"
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
            className="aspect-[4/3] w-full rounded-xl border border-midnight-navy/10 bg-black object-cover"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="flex-1 rounded-xl bg-sunset-red px-4 py-3 font-display font-semibold text-white hover:bg-sunset-red/90"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => { stopCamera(); setStatus('idle') }}
              className="rounded-xl border border-midnight-navy/20 bg-white px-4 py-3 font-medium text-midnight-navy hover:bg-midnight-navy/5"
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
            className="aspect-[4/3] w-full rounded-xl border border-midnight-navy/10 object-cover"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={uploadAndOcr}
              className="flex-1 rounded-xl bg-sunset-red px-4 py-3 font-display font-semibold text-white hover:bg-sunset-red/90"
            >
              Upload &amp; Scan
            </button>
            <button
              type="button"
              onClick={retake}
              className="rounded-xl border border-midnight-navy/20 bg-white px-4 py-3 font-medium text-midnight-navy hover:bg-midnight-navy/5"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {status === 'uploading' && (
        <div className="mt-8 text-center">
          <p className="text-midnight-navy/70">Uploading and extracting text...</p>
        </div>
      )}

      {status === 'scanning_market' && (
        <div className="mt-8 text-center">
          <p className="text-midnight-navy/70">Scanning Market...</p>
          <p className="mt-1 text-sm text-midnight-navy/50">Comparing prices</p>
        </div>
      )}

      {status === 'done' && (
        <div className="mt-6 w-full max-w-sm">
          <p className="text-center font-medium text-emerald-600">
            Receipt scanned successfully.
          </p>

          <ComparisonCard comparisons={comparisons} />

          {tcStores.length > 0 && <TripleConstraintPanel stores={tcStores} />}

          {ocrText && (
            <div className="mt-4 max-h-24 overflow-y-auto rounded-xl border border-midnight-navy/10 bg-white p-3 text-left">
              <p className="text-xs font-semibold text-midnight-navy/40">Raw OCR (preview)</p>
              <p className="mt-1 text-xs text-midnight-navy/70">
                {ocrText.length > 200 ? `${ocrText.slice(0, 200)}...` : ocrText}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={retake}
            className="mt-4 w-full rounded-xl bg-sunset-red px-4 py-3 font-display font-semibold text-white hover:bg-sunset-red/90"
          >
            Scan Another
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-6 w-full max-w-sm">
          <p className="rounded-xl bg-sunset-red/10 p-3 text-sm text-sunset-red" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-4 w-full rounded-xl border border-midnight-navy/20 bg-white px-4 py-3 font-medium text-midnight-navy hover:bg-midnight-navy/5"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Triple Constraint Results Panel
// ---------------------------------------------------------------------------

function TripleConstraintPanel({ stores }: { stores: StoreResult[] }) {
  const cheapest = stores[0]
  const mostExpensive = stores[stores.length - 1]
  const savings =
    stores.length > 1
      ? (mostExpensive.running_total - cheapest.running_total).toFixed(2)
      : null

  return (
    <div className="mt-4 rounded-xl border border-midnight-navy/10 bg-white overflow-hidden">
      <div className="border-b border-midnight-navy/10 bg-cream px-3 py-2 text-xs font-semibold uppercase tracking-wide text-midnight-navy/50">
        Store Comparison (Triple Constraint)
      </div>

      {savings && (
        <div className="mx-3 mt-3 rounded-lg bg-sunset-red px-3 py-2 text-sm font-semibold text-white">
          Buying at {cheapest.store_name} saves you ${savings} vs. most expensive option
        </div>
      )}

      <ul className="divide-y divide-midnight-navy/10 mt-2">
        {stores.slice(0, 5).map((store, i) => (
          <li key={store.store_name} className="px-3 py-2.5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-midnight-navy">
                  {i === 0 && <span className="mr-1 text-emerald-600">★</span>}
                  {store.store_name}
                </p>
                {store.transit_time_minutes != null && (
                  <p className="text-xs text-midnight-navy/50">
                    {store.transit_time_minutes} min transit
                    {store.transit_cost != null && store.transit_cost > 0
                      ? ` · +$${store.transit_cost.toFixed(2)}`
                      : ''}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-midnight-navy">
                  ${store.running_total.toFixed(2)}
                </p>
                {store.adjusted_total !== store.running_total && (
                  <p className="text-xs text-midnight-navy/50">
                    ${store.adjusted_total.toFixed(2)} incl. transit
                  </p>
                )}
              </div>
            </div>

            {/* Luis Rule warning */}
            {store.luis_rule_excluded.length > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                {store.luis_rule_excluded.length} bulk item(s) excluded (Luis Rule)
              </p>
            )}

            {/* Jennifer Rule warnings */}
            {store.items
              .filter((it) => it.health_warning)
              .slice(0, 2)
              .map((it) => (
                <p key={it.item_name} className="mt-1 text-xs text-red-500">
                  {it.item_name}: {it.health_warning!.flags.join(', ')}
                  {it.health_warning!.suggested_alternative &&
                    ` — try ${it.health_warning!.suggested_alternative}`}
                </p>
              ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
