import { supabase } from './supabase'

export const CREDITS_STANDARD = 10
export const CREDITS_LOCAL_GEM = 25

/**
 * Calculate credit award from store_type.
 */
export function calculateCredits(storeType: string | null | undefined): number {
  if (storeType?.toLowerCase().includes('local gem')) {
    return CREDITS_LOCAL_GEM
  }
  return CREDITS_STANDARD
}

/**
 * Award credits for a scan via Supabase RPC.
 * Returns credits awarded (0 if already awarded or error).
 */
export async function awardCredits(
  receiptScanId: string
): Promise<{ credits: number; error: Error | null }> {
  const { data, error } = await supabase.rpc('award_scan_credits', {
    p_receipt_scan_id: receiptScanId,
  })

  if (error) {
    return { credits: 0, error: new Error(error.message) }
  }

  return { credits: typeof data === 'number' ? data : 0, error: null }
}
