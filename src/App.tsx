import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { Auth } from './pages/Auth'
import { Scan } from './pages/Scan'
import { Credits } from './pages/Credits'
import { BottomNav } from './components/BottomNav'

type TabId = 'home' | 'scan' | 'credits'

function HomeView() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-bold text-gray-900">ClearCart</h1>
      <p className="mt-2 text-gray-600">
        Grocery price advocacy at your fingertips.
      </p>
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
          <HomeView />
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
