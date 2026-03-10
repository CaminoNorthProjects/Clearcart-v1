import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { Credits } from './Credits'

type PrimaryFocus = 'cost' | 'time' | 'health'
type StorageCapacity = 'standard' | 'condo/small'

interface ProfileData {
  full_name: string
  postal_code: string
  primary_focus: PrimaryFocus
  storage_capacity: StorageCapacity
  strict_health: boolean
  is_premium: boolean
  clear_credits: number
}

const FOCUS_OPTIONS: { id: PrimaryFocus; label: string; description: string }[] = [
  { id: 'cost',   label: 'Cost',   description: 'Find the lowest total basket price' },
  { id: 'time',   label: 'Time',   description: 'Show nearest stores first' },
  { id: 'health', label: 'Health', description: 'Prioritize farmers, butchers & fishers' },
]

export function Profile({ isVisible }: { isVisible: boolean }) {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'settings' | 'credits'>('settings')

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, postal_code, primary_focus, storage_capacity, strict_health, is_premium, clear_credits')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setProfile(data as ProfileData)
    } catch (err) {
      console.warn('Profile fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isVisible && user) fetchProfile()
  }, [isVisible, user, fetchProfile])

  const updateField = async <K extends keyof ProfileData>(
    field: K,
    value: ProfileData[K]
  ) => {
    if (!user || !profile) return
    setProfile((prev) => prev ? { ...prev, [field]: value } : prev)
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', user.id)
      if (error) throw error
      showToast('Preferences saved')
    } catch (err) {
      showToast('Failed to save. Please try again.')
      console.warn('Profile update error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-semibold text-midnight-navy">Profile</h2>
        {saving && (
          <span className="text-xs text-midnight-navy/40">Saving...</span>
        )}
      </div>

      {/* Section toggle */}
      <div className="mt-4 flex rounded-xl border border-midnight-navy/10 bg-white p-1">
        <button
          onClick={() => setActiveSection('settings')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeSection === 'settings'
              ? 'bg-midnight-navy text-white'
              : 'text-midnight-navy/60 hover:text-midnight-navy'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveSection('credits')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeSection === 'credits'
              ? 'bg-midnight-navy text-white'
              : 'text-midnight-navy/60 hover:text-midnight-navy'
          }`}
        >
          ClearCredits
        </button>
      </div>

      {activeSection === 'credits' ? (
        <Credits isVisible={isVisible && activeSection === 'credits'} />
      ) : loading ? (
        <p className="mt-8 text-center text-midnight-navy/50">Loading...</p>
      ) : profile ? (
        <div className="mt-6 space-y-6">

          {/* Account info */}
          <section className="rounded-xl border border-midnight-navy/10 bg-white p-5">
            <h3 className="font-display text-lg font-semibold text-midnight-navy">Account</h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">Name</p>
                <p className="mt-0.5 text-sm text-midnight-navy">{profile.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">Email</p>
                <p className="mt-0.5 text-sm text-midnight-navy">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">Postal Code</p>
                <p className="mt-0.5 text-sm text-midnight-navy">{profile.postal_code || '—'}</p>
              </div>
            </div>
          </section>

          {/* Triple Constraint focus */}
          <section className="rounded-xl border border-midnight-navy/10 bg-white p-5">
            <h3 className="font-display text-lg font-semibold text-midnight-navy">
              Shopping Focus
            </h3>
            <p className="mt-1 text-xs text-midnight-navy/50">
              Your default Triple Constraint mode. Changes how stores and prices are ranked.
            </p>
            <div className="mt-3 flex rounded-xl border border-midnight-navy/10 p-1">
              {FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateField('primary_focus', opt.id)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    profile.primary_focus === opt.id
                      ? 'bg-sunset-red text-white'
                      : 'text-midnight-navy/60 hover:text-midnight-navy'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-midnight-navy/50">
              {FOCUS_OPTIONS.find((o) => o.id === profile.primary_focus)?.description}
            </p>
          </section>

          {/* Storage capacity (Luis Rule) */}
          <section className="rounded-xl border border-midnight-navy/10 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-display text-lg font-semibold text-midnight-navy">
                  Storage Capacity
                </h3>
                <p className="mt-1 text-xs text-midnight-navy/50">
                  Condo/Small mode (The Luis Rule): excludes bulk-discount perishables that
                  won't be consumed before spoiling.
                </p>
              </div>
            </div>
            <div className="mt-3 flex rounded-xl border border-midnight-navy/10 p-1">
              {(['standard', 'condo/small'] as StorageCapacity[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateField('storage_capacity', opt)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                    profile.storage_capacity === opt
                      ? 'bg-deep-navy text-white'
                      : 'text-midnight-navy/60 hover:text-midnight-navy'
                  }`}
                >
                  {opt === 'condo/small' ? 'Condo / Small' : 'Standard'}
                </button>
              ))}
            </div>
          </section>

          {/* Strict health mode (Jennifer Rule) */}
          <section className="rounded-xl border border-midnight-navy/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <h3 className="font-display text-lg font-semibold text-midnight-navy">
                  Strict Health Mode
                </h3>
                <p className="mt-1 text-xs text-midnight-navy/50">
                  The Jennifer Rule: flags products containing artificial colours or high
                  preservatives and suggests green-certified or farm-direct alternatives.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={profile.strict_health}
                onClick={() => updateField('strict_health', !profile.strict_health)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  profile.strict_health ? 'bg-sunset-red' : 'bg-midnight-navy/20'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                    profile.strict_health ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Subscription tier */}
          <section className="rounded-xl border border-midnight-navy/10 bg-white p-5">
            <h3 className="font-display text-lg font-semibold text-midnight-navy">
              Subscription
            </h3>
            <div className="mt-3 space-y-3">
              {/* Freemium */}
              <div className={`rounded-xl border p-4 ${!profile.is_premium ? 'border-midnight-navy bg-cream' : 'border-midnight-navy/10'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-display text-base font-semibold text-midnight-navy">Freemium</p>
                  {!profile.is_premium && (
                    <span className="rounded-full bg-midnight-navy px-2 py-0.5 text-xs font-semibold text-cream">
                      Current
                    </span>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-midnight-navy/60">
                  <li>• Up to 5 saved recipes</li>
                  <li>• Receipt scanning &amp; price comparison</li>
                  <li>• ClearCredits gamification</li>
                </ul>
              </div>
              {/* Premium */}
              <div className={`rounded-xl border p-4 ${profile.is_premium ? 'border-sunset-red bg-sunset-red/5' : 'border-midnight-navy/10'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-base font-semibold text-midnight-navy">Premium</p>
                    <p className="text-xs text-midnight-navy/50">$10.99 / month</p>
                  </div>
                  {profile.is_premium ? (
                    <span className="rounded-full bg-sunset-red px-2 py-0.5 text-xs font-semibold text-white">
                      Active
                    </span>
                  ) : (
                    <UpgradeButton />
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-midnight-navy/60">
                  <li>• Unlimited recipe saves</li>
                  <li>• No advertisements</li>
                  <li>• Spending analytics dashboard</li>
                  <li>• Priority store data updates</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Sign out */}
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full rounded-xl border border-midnight-navy/20 bg-white px-4 py-3 text-sm font-medium text-midnight-navy/60 hover:bg-midnight-navy/5"
          >
            Sign Out
          </button>

          {/* Bill C-27 data rights */}
          <DataRightsSection />

          <p className="pb-4 text-center text-xs text-midnight-navy/30">
            <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>
            {' · '}
            Camino North Projects — Privacy Officer
          </p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bill C-27 Data Rights Section
// ---------------------------------------------------------------------------

function DataRightsSection() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDownload = async () => {
    if (!user) return
    setDownloading(true)
    try {
      const { data, error } = await supabase.rpc('export_user_data')
      if (error) throw error
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clearcart-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Your data has been downloaded.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    const confirmed = window.confirm(
      'This will permanently delete ALL your data including scan history, recipes, and credits. This cannot be undone. Continue?'
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      // Delete all user data rows via RPC
      const { error: rpcError } = await supabase.rpc('delete_user_data')
      if (rpcError) throw rpcError

      // Delete auth user via server (requires service role key)
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined
      if (apiUrl) {
        await fetch(`${apiUrl}/api/delete-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        })
      }

      showToast('Your account has been deleted.')
      await signOut()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deletion failed.')
      setDeleting(false)
    }
  }

  return (
    <section className="rounded-xl border border-midnight-navy/10 bg-white p-5">
      <h3 className="font-display text-lg font-semibold text-midnight-navy">
        Your Data Rights
      </h3>
      <p className="mt-1 text-xs text-midnight-navy/50">
        Under Bill C-27, you have the right to access and delete your personal information.
      </p>
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-xl border border-midnight-navy/20 bg-white px-4 py-2.5 text-sm font-medium text-midnight-navy hover:bg-midnight-navy/5 disabled:opacity-60"
        >
          {downloading ? 'Preparing download...' : 'Download My Data (JSON)'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full rounded-xl border border-sunset-red/30 bg-white px-4 py-2.5 text-sm font-medium text-sunset-red hover:bg-sunset-red/5 disabled:opacity-60"
        >
          {deleting ? 'Deleting...' : 'Delete My Account & Data'}
        </button>
      </div>
    </section>
  )
}

function UpgradeButton() {
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const handleUpgrade = async () => {
    if (!user) return
    setLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined
      if (!apiUrl) {
        alert('Stripe is not configured yet. Please check back soon.')
        return
      }
      const res = await fetch(`${apiUrl}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_user_id: user.id, email: user.email }),
      })
      if (!res.ok) throw new Error('Could not start checkout.')
      const { url } = await res.json() as { url: string }
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Checkout failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      disabled={loading}
      className="rounded-lg bg-sunset-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-sunset-red/90 disabled:opacity-60"
    >
      {loading ? 'Opening...' : 'Upgrade'}
    </button>
  )
}
