import type { ParsedLineItem } from './normalize'

export interface PriceComparison {
  item_name: string
  receipt_price: number
  competitor_price: number | null
  savings: number
  store_name: string
}

/** Estimated delivery app markup (15-20%). Used for "Advocacy Gap" display. */
export const DELIVERY_MARKUP_PERCENT = 0.18

/**
 * Mock fetcher: returns competitor prices for demo/MVP.
 * Replace with Statistics Canada, Open Food Facts, or Apify when ready.
 * Simulates "competitor is 5-15% cheaper" for some items.
 */
export async function fetchCompetitorPrices(
  items: ParsedLineItem[]
): Promise<PriceComparison[]> {
  return items.map((item) => {
    const receiptPrice = item.price * item.quantity
    // Simulate: ~70% of items have a "competitor" price, often 5-12% lower
    const hasCompetitor = Math.random() < 0.7
    const discount = hasCompetitor ? 0.05 + Math.random() * 0.1 : 0
    const competitorPrice = hasCompetitor
      ? Math.round(receiptPrice * (1 - discount) * 100) / 100
      : null
    const savings = competitorPrice != null && competitorPrice < receiptPrice
      ? Math.round((receiptPrice - competitorPrice) * 100) / 100
      : 0

    return {
      item_name: item.item_name,
      receipt_price: receiptPrice,
      competitor_price: competitorPrice,
      savings,
      store_name: 'Superstore (est.)',
    }
  })
}

/**
 * Calculate estimated delivery markup for advocacy gap display
 */
export function estimateDeliveryPrice(receiptPrice: number): number {
  return Math.round(receiptPrice * (1 + DELIVERY_MARKUP_PERCENT) * 100) / 100
}
