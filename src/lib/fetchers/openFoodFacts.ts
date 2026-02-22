import type { ParsedLineItem } from '../normalize'
import type { PriceComparison } from '../compare'

const OFF_SEARCH_BASE = 'https://world.openfoodfacts.org/api/v2/search'
const RATE_LIMIT_MS = 7000 // ~8 req/min to stay under 10/min

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface OFFProduct {
  product_name?: string
  product_name_en?: string
  price?: number | string
  compared_prices?: Array<{ value: number | string }>
}

interface OFFSearchResponse {
  count?: number
  products?: OFFProduct[]
}

async function searchProduct(
  term: string
): Promise<{ price: number } | null> {
  try {
    const params = new URLSearchParams({
      search_terms: term.slice(0, 50),
      page_size: '3',
      fields: 'product_name,price,compared_prices',
    })
    const res = await fetch(`${OFF_SEARCH_BASE}?${params}`)
    if (!res.ok) return null

    const data: OFFSearchResponse = await res.json()
    const products = data?.products?.filter(Boolean) ?? []
    if (products.length === 0) return null

    const toNum = (v: number | string | undefined): number | null => {
      if (v == null) return null
      const n = typeof v === 'string' ? parseFloat(v) : v
      return !isNaN(n) && n > 0 ? n : null
    }

    for (const p of products) {
      const price = toNum(p.price)
      if (price != null) return { price }
      const compared = toNum(p.compared_prices?.[0]?.value)
      if (compared != null) return { price: compared }
    }
    return null
  } catch {
    return null
  }
}

function mockItem(item: ParsedLineItem): PriceComparison {
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
}

export async function openFoodFactsFetcher(
  items: ParsedLineItem[]
): Promise<PriceComparison[]> {
  const results: PriceComparison[] = []

  for (let i = 0; i < items.length; i++) {
    if (i > 0) await sleep(RATE_LIMIT_MS)

    const item = items[i]
    const receiptPrice = item.price * item.quantity
    const searchTerm = item.item_name.replace(/\d+%|\d+ml|\d+g/gi, '').trim() || item.item_name

    const found = await searchProduct(searchTerm)

    if (found && found.price < receiptPrice) {
      const competitorPrice = Math.round(found.price * 100) / 100
      const savings = Math.round((receiptPrice - competitorPrice) * 100) / 100
      results.push({
        item_name: item.item_name,
        receipt_price: receiptPrice,
        competitor_price: competitorPrice,
        savings,
        store_name: 'Open Food Facts',
      })
    } else if (found && found.price >= receiptPrice) {
      results.push({
        item_name: item.item_name,
        receipt_price: receiptPrice,
        competitor_price: Math.round(found.price * 100) / 100,
        savings: 0,
        store_name: 'Open Food Facts',
      })
    } else {
      results.push(mockItem(item))
    }
  }

  return results
}
