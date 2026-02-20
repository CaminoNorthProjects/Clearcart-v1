import { useState } from 'react'
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

function ScanView() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-gray-600">Scan products to compare prices.</p>
    </div>
  )
}

function CreditsView() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-gray-600">Credits and acknowledgments.</p>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView />
      case 'scan':
        return <ScanView />
      case 'credits':
        return <CreditsView />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-24 pt-6">{renderContent()}</main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
