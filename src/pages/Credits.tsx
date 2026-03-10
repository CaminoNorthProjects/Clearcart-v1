import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface ReceiptScanRow {
  id: string
  store_name: string | null
  store_type: string | null
  credits_awarded: number | null
  created_at: string
}

export function Credits({ isVisible }: { isVisible: boolean }) {
  const { user } = useAuth()
  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<ReceiptScanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('clear_credits')
        .eq('id', user.id)
        .single()

      if (profileError) { setError(profileError.message); return }
      setBalance(profile?.clear_credits ?? 0)

      const { data: scans, error: scansError } = await supabase
        .from('receipt_scans')
        .select('id, store_name, store_type, credits_awarded, created_at')
        .eq('user_id', user.id)
        .not('credits_awarded', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (scansError) { setError(scansError.message); return }
      setHistory((scans ?? []) as ReceiptScanRow[])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isVisible && user) fetchCredits()
  }, [isVisible, user, fetchCredits])

  if (!user) return null

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="font-display text-3xl font-semibold text-midnight-navy">ClearCredits</h2>
      <p className="mt-1 text-sm text-midnight-navy/60">Your balance and scan history.</p>

      {loading ? (
        <p className="mt-8 text-midnight-navy/50">Loading...</p>
      ) : error ? (
        <p className="mt-8 rounded-xl bg-sunset-red/10 p-3 text-sm text-sunset-red" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-8 w-full max-w-sm rounded-xl border border-midnight-navy/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">
              Balance
            </p>
            <p className="mt-1 font-display text-4xl font-semibold text-emerald-600">
              {balance ?? 0}
            </p>
            <p className="text-sm text-midnight-navy/50">credits earned</p>
          </div>

          <div className="mt-6 w-full max-w-sm">
            <h3 className="font-display text-lg font-semibold text-midnight-navy">Recent Scans</h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-midnight-navy/50">
                No scans with credits yet. Scan a receipt to earn!
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-midnight-navy/10 rounded-xl border border-midnight-navy/10 bg-white">
                {history.map((scan) => (
                  <li key={scan.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-midnight-navy">
                        {scan.store_name ?? 'Unknown store'}
                      </p>
                      <p className="text-xs text-midnight-navy/50">{formatDate(scan.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {scan.store_type === 'Local Gem' && (
                        <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-xs font-semibold text-burgundy">
                          Local Gem
                        </span>
                      )}
                      <span className="text-sm font-semibold text-emerald-600">
                        +{scan.credits_awarded}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
