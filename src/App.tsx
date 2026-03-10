import { useCallback, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { Auth } from './pages/Auth'
import { Scan } from './pages/Scan'
import { Credits } from './pages/Credits'
import { Profile } from './pages/Profile'
import { Stores } from './pages/Stores'
import { Recipes } from './pages/Recipes'
import { BottomNav, type TabId } from './components/BottomNav'
import { supabase } from './lib/supabase'

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
  return (
    <div className="mt-8 w-full max-w-sm">
      <h3 className="font-display text-lg font-semibold text-midnight-navy">
        Price Advocacy Highlights
      </h3>
      <p className="mt-2 rounded-xl border border-midnight-navy/10 bg-white p-4 text-sm text-midnight-navy/50">
        Community-wide questionable sales from Vancouver will appear here.
        Coming soon.
      </p>
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
          <Profile isVisible={activeTab === 'profile'} />
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
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App

// Re-export Credits so it remains accessible from Profile
export { Credits }
