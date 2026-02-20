type TabId = 'home' | 'scan' | 'credits'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'scan', label: 'Scan' },
  { id: 'credits', label: 'Credits' },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] pt-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      role="tablist"
    >
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => onTabChange(id)}
          className={`flex flex-1 flex-col items-center gap-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === id
              ? 'text-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>{label}</span>
          {activeTab === id && (
            <span className="h-1 w-8 rounded-full bg-emerald-600" />
          )}
        </button>
      ))}
    </nav>
  )
}
