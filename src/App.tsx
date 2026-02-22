import { useCallback, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { Auth } from './pages/Auth'
import { Scan } from './pages/Scan'
import { Credits } from './pages/Credits'
import { BottomNav } from './components/BottomNav'
import { supabase } from './lib/supabase'

type TabId = 'home' | 'scan' | 'credits'

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
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome Back, {displayName}
      </h1>
      <p className="mt-2 text-gray-600">
        Grocery price advocacy at your fingertips.
      </p>

      {loading ? (
        <p className="mt-8 text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="mt-8 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Current Balance
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">
              {balance ?? 0} ClearCredits
            </p>
          </div>

          <div className="mt-8 w-full max-w-sm">
            <h3 className="text-sm font-medium text-gray-700">
              Price Advocacy Highlights
            </h3>
            <p className="mt-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
              Community-wide questionable sales from Vancouver will appear here.
              Coming soon.
            </p>
          </div>
        </>
      )}
    </div>
  )
}



function AppContent() {
  const { session, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('home')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-24 pt-6">
        <div className={activeTab === 'home' ? '' : 'hidden'}>
          <HomeView isVisible={activeTab === 'home'} />
        </div>
        <div className={activeTab === 'scan' ? '' : 'hidden'}>
          <Scan />
        </div>
        <div className={activeTab === 'credits' ? '' : 'hidden'}>
          <Credits isVisible={activeTab === 'credits'} />
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
