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

      if (profileError) {
        setError(profileError.message)
        return
      }

      setBalance(profile?.clear_credits ?? 0)

      const { data: scans, error: scansError } = await supabase
        .from('receipt_scans')
        .select('id, store_name, store_type, credits_awarded, created_at')
        .eq('user_id', user.id)
        .not('credits_awarded', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (scansError) {
        setError(scansError.message)
        return
      }

      setHistory((scans ?? []) as ReceiptScanRow[])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isVisible && user) {
      fetchCredits()
    }
  }, [isVisible, user, fetchCredits])

  if (!user) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="text-xl font-bold text-gray-900">ClearCredits</h2>
      <p className="mt-1 text-sm text-gray-600">
        Your balance and scan history.
      </p>

      {loading ? (
        <p className="mt-8 text-gray-500">Loading...</p>
      ) : error ? (
        <p className="mt-8 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-8 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Balance
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {balance ?? 0} credits
            </p>
          </div>

          <div className="mt-6 w-full max-w-sm">
            <h3 className="text-sm font-medium text-gray-700">Recent scans</h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No scans with credits yet. Scan a receipt to earn!
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                {history.map((scan) => (
                  <li
                    key={scan.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {scan.store_name ?? 'Unknown store'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(scan.created_at)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-emerald-600">
                      +{scan.credits_awarded}
                    </span>
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
