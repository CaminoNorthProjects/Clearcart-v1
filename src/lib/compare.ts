import type { ParsedLineItem } from './normalize'
import { fetchCompetitorPricesFromMarket } from './marketApi'

export interface PriceComparison {
  item_name: string
  receipt_price: number
  competitor_price: number | null
  savings: number
  store_name: string
}

/** Estimated delivery app markup (15-20%). Used for "Advocacy Gap" display. */
export const DELIVERY_MARKUP_PERCENT = 0.18

/** Threshold for "Questionable Sale" advocacy alert: receipt >20% over market. */
export const ADVOCACY_THRESHOLD_PERCENT = 0.2

export type CompetitorFetcher = (
  items: ParsedLineItem[]
) => Promise<PriceComparison[]>

function mockFetcher(items: ParsedLineItem[]): Promise<PriceComparison[]> {
  return Promise.resolve(
    items.map((item) => {
      const receiptPrice = item.price * item.quantity
      const hasCompetitor = Math.random() < 0.7
      const discount = hasCompetitor ? 0.05 + Math.random() * 0.1 : 0
      const competitorPrice = hasCompetitor
        ? Math.round(receiptPrice * (1 - discount) * 100) / 100
        : null
      const savings =
        competitorPrice != null && competitorPrice < receiptPrice
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
  )
}

const useRealPrices =
  import.meta.env.VITE_USE_REAL_PRICES === 'true' ||
  import.meta.env.VITE_USE_REAL_PRICES === '1'

const useMockPrices =
  import.meta.env.VITE_USE_MOCK_PRICES === 'true' ||
  import.meta.env.VITE_USE_MOCK_PRICES === '1'

async function fetchCompetitorPricesImpl(
  items: ParsedLineItem[]
): Promise<PriceComparison[]> {
  if (useMockPrices) {
    return mockFetcher(items)
  }
  if (useRealPrices) {
    const { openFoodFactsFetcher } = await import('./fetchers/openFoodFacts')
    return openFoodFactsFetcher(items)
  }
  return Promise.resolve(fetchCompetitorPricesFromMarket(items))
}

export const fetchCompetitorPrices: CompetitorFetcher = fetchCompetitorPricesImpl

/**
 * Calculate estimated delivery markup for advocacy gap display
 */
export function estimateDeliveryPrice(receiptPrice: number): number {
  return Math.round(receiptPrice * (1 + DELIVERY_MARKUP_PERCENT) * 100) / 100
}
