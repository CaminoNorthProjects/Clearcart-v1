/**
 * ConsentModal — Bill C-27 first-login consent collection.
 *
 * Shown once to users whose profiles.consent_given_at IS NULL.
 * On acceptance, writes the current timestamp to profiles.consent_given_at.
 *
 * Canadian Bill C-27 (Consumer Privacy Protection Act) requires:
 * - Clear explanation of what data is collected and why
 * - Explicit, informed consent before collection begins
 * - Record of when consent was given
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ConsentModalProps {
  onAccepted: () => void
}

export function ConsentModal({ onAccepted }: ConsentModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    if (!user) return
    setLoading(true)
    try {
      await supabase
        .from('profiles')
        .update({ consent_given_at: new Date().toISOString() })
        .eq('id', user.id)
      onAccepted()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-midnight-navy/60 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <h2 className="font-display text-2xl font-semibold text-midnight-navy">
          Before you begin
        </h2>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">
          Bill C-27 Privacy Disclosure
        </p>

        <div className="mt-4 space-y-3 text-sm text-midnight-navy/70">
          <p>
            <strong className="text-midnight-navy">What we collect:</strong> Receipt images,
            grocery price data, your Vancouver postal code, and your shopping session preferences.
          </p>
          <p>
            <strong className="text-midnight-navy">Why:</strong> To compare grocery prices, award
            ClearCredits, and surface community-flagged pricing to help Vancouver shoppers save money.
          </p>
          <p>
            <strong className="text-midnight-navy">How long:</strong> Data is retained while your
            account is active. You may download or delete your data at any time from your Profile.
          </p>
          <p>
            <strong className="text-midnight-navy">Who sees it:</strong> Only you and Camino North
            Projects (the Privacy Officer). We never sell your data.
          </p>
          <p>
            <strong className="text-midnight-navy">Your rights:</strong> Under Bill C-27, you have
            the right to access, correct, and delete your personal information at any time.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAccept}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-sunset-red px-4 py-3.5 font-display font-semibold text-white hover:bg-sunset-red/90 disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'I Understand — Continue'}
        </button>

        <a
          href="/privacy"
          className="mt-3 block text-center text-xs text-midnight-navy/40 underline underline-offset-2"
        >
          Read our full Privacy Policy
        </a>
      </div>
    </div>
  )
}
