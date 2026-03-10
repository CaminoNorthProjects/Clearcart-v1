import { useCallback, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { Auth } from './pages/Auth'
import { Scan } from './pages/Scan'
import { Profile } from './pages/Profile'
import { Stores } from './pages/Stores'
import { Recipes } from './pages/Recipes'
import { BottomNav, type TabId } from './components/BottomNav'
import { supabase } from './lib/supabase'
import { fetchAdvocacyHighlights, type AdvocacyHighlight } from './lib/advocacy'

function HomeView({ isVisible }: { isVisible: boolean }) {
  const { user } = useAuth()
  const [fullName, setFullName] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, clear_credits')
        .eq('id', user.id)
        .single()
      if (!error) {
        setFullName(data?.full_name ?? null)
        setBalance(data?.clear_credits ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isVisible && user) {
      fetchProfile()
    }
  }, [isVisible, user, fetchProfile])

  if (!user) return null

  const displayName = fullName?.trim() || 'there'

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h1 className="font-display text-3xl font-semibold text-midnight-navy">
        Welcome Back, {displayName}
      </h1>
      <p className="mt-2 text-sm text-midnight-navy/60">
        Grocery price advocacy at your fingertips.
      </p>

      {loading ? (
        <p className="mt-8 text-midnight-navy/50">Loading...</p>
      ) : (
        <>
          <div className="mt-8 w-full max-w-sm rounded-xl border border-midnight-navy/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">
              ClearCredits Balance
            </p>
            <p className="mt-1 font-display text-4xl font-semibold text-emerald-600">
              {balance ?? 0}
            </p>
            <p className="text-sm text-midnight-navy/50">credits earned</p>
          </div>

          <AdvocacyFeed />
        </>
      )}
    </div>
  )
}

function AdvocacyFeed() {
  const [highlights, setHighlights] = useState<AdvocacyHighlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdvocacyHighlights(5)
      .then(setHighlights)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mt-8 w-full max-w-sm">
      <h3 className="font-display text-lg font-semibold text-midnight-navy">
        Price Advocacy Highlights
      </h3>
      <p className="mt-1 text-xs text-midnight-navy/40">
        Most-flagged questionable prices in Vancouver — shared by the community.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-midnight-navy/50">Loading...</p>
      ) : highlights.length === 0 ? (
        <div className="mt-2 rounded-xl border border-midnight-navy/10 bg-white p-4">
          <p className="text-sm text-midnight-navy/50">
            No flagged prices yet. Scan a receipt and tap "Share to Community" on any
            questionable price to be the first.
          </p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-midnight-navy/10 rounded-xl border border-midnight-navy/10 bg-white">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm font-semibold text-midnight-navy truncate">{h.item_name}</p>
                <p className="text-xs text-midnight-navy/50 truncate">{h.store_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-amber-600">
                  ${h.flagged_price.toFixed(2)}
                </p>
                <p className="text-xs text-midnight-navy/40">
                  {h.flag_count} {h.flag_count === 1 ? 'flag' : 'flags'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AppContent() {
  const { session, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('home')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-display text-xl text-midnight-navy/50">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="min-h-screen bg-cream">
      <main className="pb-28 pt-6">
        <div className={activeTab === 'home' ? '' : 'hidden'}>
          <HomeView isVisible={activeTab === 'home'} />
        </div>
        <div className={activeTab === 'scan' ? '' : 'hidden'}>
          <Scan />
        </div>
        <div className={activeTab === 'stores' ? '' : 'hidden'}>
          <Stores isVisible={activeTab === 'stores'} />
        </div>
        <div className={activeTab === 'recipes' ? '' : 'hidden'}>
          <Recipes isVisible={activeTab === 'recipes'} />
        </div>
        <div className={activeTab === 'profile' ? '' : 'hidden'}>
          <Profile isVisible={activeTab === 'profile'} key="profile" />
        </div>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProfileProvider>
          <AppContent />
        </ProfileProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
