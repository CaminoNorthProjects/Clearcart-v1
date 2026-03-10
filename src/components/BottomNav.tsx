export type TabId = 'home' | 'scan' | 'stores' | 'recipes' | 'profile'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'home',    label: 'Home',    icon: '⌂' },
  { id: 'scan',    label: 'Scan',    icon: '⊙' },
  { id: 'stores',  label: 'Stores',  icon: '◎' },
  { id: 'recipes', label: 'Recipes', icon: '✦' },
  { id: 'profile', label: 'Profile', icon: '◉' },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-midnight-navy/10 bg-white pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-2px_16px_rgba(22,47,71,0.08)]"
      role="tablist"
    >
      {tabs.map(({ id, label, icon }) => {
        const isActive = activeTab === id
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(id)}
            className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 transition-colors ${
              isActive ? 'text-sunset-red' : 'text-midnight-navy/40 hover:text-midnight-navy/70'
            }`}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>
              {label}
            </span>
            {isActive && (
              <span className="mt-0.5 h-0.5 w-6 rounded-full bg-sunset-red" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
