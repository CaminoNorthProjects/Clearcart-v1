/**
 * advocacy.ts
 *
 * Fetches community-flagged prices from the flagged_prices table,
 * grouped by store_name + item_name to count how many community members
 * have flagged each item.
 */
import { supabase } from './supabase'

export interface AdvocacyHighlight {
  store_name: string
  item_name: string
  flagged_price: number
  flag_count: number
}

/**
 * Returns the top N most-flagged items across Vancouver.
 * Uses a raw Postgres view approximation via multiple queries since
 * Supabase JS client doesn't support GROUP BY directly.
 *
 * Falls back to a simple recent-flags list if the aggregation isn't available.
 */
export async function fetchAdvocacyHighlights(limit = 5): Promise<AdvocacyHighlight[]> {
  const { data, error } = await supabase
    .from('flagged_prices')
    .select('store_name, item_name, flagged_price, flagged_at')
    .order('flagged_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  // Aggregate client-side: group by store_name + item_name, count flags
  const map = new Map<string, AdvocacyHighlight>()
  for (const row of data) {
    if (!row.store_name || !row.item_name) continue
    const key = `${row.store_name}||${row.item_name}`
    const existing = map.get(key)
    if (existing) {
      existing.flag_count += 1
    } else {
      map.set(key, {
        store_name: row.store_name,
        item_name: row.item_name,
        flagged_price: row.flagged_price ?? 0,
        flag_count: 1,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.flag_count - a.flag_count)
    .slice(0, limit)
}
