/**
 * ProfileContext
 *
 * Makes the user's Triple Constraint preferences (primary_focus,
 * storage_capacity, strict_health, is_premium) available globally so the
 * Stores map, Scan results, and Recipes can all read them without
 * each page re-fetching the profile.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface UserPreferences {
  primary_focus: 'cost' | 'time' | 'health'
  storage_capacity: 'standard' | 'condo/small'
  strict_health: boolean
  is_premium: boolean
  postal_code: string
}

interface ProfileContextType {
  prefs: UserPreferences | null
  loading: boolean
  refresh: () => void
}

const DEFAULT_PREFS: UserPreferences = {
  primary_focus: 'cost',
  storage_capacity: 'standard',
  strict_health: false,
  is_premium: false,
  postal_code: '',
}

const ProfileContext = createContext<ProfileContextType>({
  prefs: DEFAULT_PREFS,
  loading: false,
  refresh: () => {},
})

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) { setPrefs(null); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('primary_focus, storage_capacity, strict_health, is_premium, postal_code')
        .eq('id', user.id)
        .single()
      if (data) {
        setPrefs({
          primary_focus: (data.primary_focus as UserPreferences['primary_focus']) ?? 'cost',
          storage_capacity: (data.storage_capacity as UserPreferences['storage_capacity']) ?? 'standard',
          strict_health: data.strict_health ?? false,
          is_premium: data.is_premium ?? false,
          postal_code: data.postal_code ?? '',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return (
    <ProfileContext.Provider value={{ prefs, loading, refresh }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfilePrefs() {
  return useContext(ProfileContext)
}
