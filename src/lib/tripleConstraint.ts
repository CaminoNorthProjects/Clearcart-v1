/**
 * tripleConstraint.ts
 *
 * Client-side wrapper around the three Express server routes:
 *   POST /api/parse     — Gemini Vision receipt parser
 *   POST /api/costs     — price lookup + Luis Rule + Jennifer Rule
 *   POST /api/logistics — Google Maps Distance Matrix transit cost
 *
 * Also exports the `useTripleConstraint` hook, which reads the user's
 * stored preferences from ProfileContext and returns ranked store results.
 */
import { useCallback, useState } from 'react'
import { useProfilePrefs } from '../contexts/ProfileContext'

const API_URL = import.meta.env.VITE_API_URL as string | undefined

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthWarning {
  flags: string[]
  suggested_alternative: string | null
}

export interface StoreItem {
  item_name: string
  price: number
  is_perishable: boolean
  is_bulk_discount: boolean
  health_flags: string[]
  is_green_certified: boolean
  is_farm_direct: boolean
  health_warning: HealthWarning | null
}

export interface StoreResult {
  store_name: string
  running_total: number
  adjusted_total: number
  transit_time_minutes: number | null
  transit_cost: number | null
  items: StoreItem[]
  luis_rule_excluded: { item_name: string; price: number }[]
  address?: string
}

export interface UserPrefsForServer {
  storage_capacity?: string
  strict_health?: boolean
}

// ---------------------------------------------------------------------------
// fetchCosts — calls /api/costs
// ---------------------------------------------------------------------------

export async function fetchCosts(
  itemNames: string[],
  prefs: UserPrefsForServer = {}
): Promise<StoreResult[]> {
  if (!API_URL) return []
  const res = await fetch(`${API_URL}/api/costs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemNames, userPreferences: prefs }),
  })
  if (!res.ok) throw new Error('Cost calculation failed.')
  const json = await res.json() as { stores: StoreResult[] }
  return json.stores
}

// ---------------------------------------------------------------------------
// fetchAdjustedTotals — calls /api/logistics
// ---------------------------------------------------------------------------

export async function fetchAdjustedTotals(
  stores: StoreResult[],
  userOrigin: string
): Promise<StoreResult[]> {
  if (!API_URL || stores.length === 0 || !userOrigin) return stores
  const res = await fetch(`${API_URL}/api/logistics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stores, userOrigin }),
  })
  if (!res.ok) throw new Error('Logistics calculation failed.')
  const json = await res.json() as { stores: StoreResult[] }
  return json.stores
}

// ---------------------------------------------------------------------------
// useTripleConstraint hook
// ---------------------------------------------------------------------------

type HookStatus = 'idle' | 'loading' | 'done' | 'error'

export function useTripleConstraint() {
  const { prefs } = useProfilePrefs()
  const [stores, setStores] = useState<StoreResult[]>([])
  const [status, setStatus] = useState<HookStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (itemNames: string[]) => {
      if (!API_URL || itemNames.length === 0) return
      setStatus('loading')
      setError(null)

      try {
        const serverPrefs: UserPrefsForServer = {
          storage_capacity: prefs?.storage_capacity,
          strict_health: prefs?.strict_health,
        }

        let results = await fetchCosts(itemNames, serverPrefs)

        if (prefs?.primary_focus === 'time' && prefs.postal_code) {
          results = await fetchAdjustedTotals(results, prefs.postal_code + ', Vancouver, BC')
        }

        // Apply Triple Constraint sort client-side
        if (prefs?.primary_focus === 'time') {
          results = results.slice().sort((a, b) =>
            (a.transit_time_minutes ?? 9999) - (b.transit_time_minutes ?? 9999)
          )
        } else if (prefs?.primary_focus === 'health') {
          // Health mode: stores with farm_direct items bubble up
          results = results.slice().sort((a, b) => {
            const aScore = a.items.filter((i) => i.is_farm_direct || i.is_green_certified).length
            const bScore = b.items.filter((i) => i.is_farm_direct || i.is_green_certified).length
            return bScore - aScore
          })
        }
        // Cost mode: already sorted ascending by running_total from server

        setStores(results)
        setStatus('done')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Triple Constraint failed.')
        setStatus('error')
      }
    },
    [prefs]
  )

  return { stores, status, error, run }
}
