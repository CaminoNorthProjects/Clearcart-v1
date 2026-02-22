import type { ParsedLineItem } from './normalize'

interface PriceComparisonResult {
  item_name: string
  receipt_price: number
  competitor_price: number | null
  savings: number
  store_name: string
}

/** Simulated Loblaws/Superstore prices for Vancouver market (demo data) */
const SIMULATED_MARKET: Record<string, { price: number; store: string }> = {
  milk: { price: 4.49, store: 'Superstore' },
  'milk 2%': { price: 4.49, store: 'Superstore' },
  'milk 2l': { price: 4.49, store: 'Superstore' },
  'milk 1%': { price: 4.49, store: 'Superstore' },
  'milk whole': { price: 4.99, store: 'Superstore' },
  eggs: { price: 3.99, store: 'Superstore' },
  'eggs dozen': { price: 3.99, store: 'Superstore' },
  'eggs large': { price: 3.99, store: 'Superstore' },
  bread: { price: 2.49, store: 'Superstore' },
  'bread white': { price: 2.49, store: 'Superstore' },
  'bread whole wheat': { price: 2.99, store: 'Superstore' },
  butter: { price: 5.99, store: 'Superstore' },
  cheese: { price: 6.49, store: 'Superstore' },
  yogurt: { price: 3.49, store: 'Superstore' },
  banana: { price: 0.79, store: 'Superstore' },
  bananas: { price: 0.79, store: 'Superstore' },
  apple: { price: 1.29, store: 'Superstore' },
  apples: { price: 1.29, store: 'Superstore' },
  chicken: { price: 8.99, store: 'Superstore' },
  beef: { price: 12.99, store: 'Superstore' },
  rice: { price: 4.99, store: 'Superstore' },
  pasta: { price: 1.99, store: 'Superstore' },
  cereal: { price: 4.49, store: 'Superstore' },
  coffee: { price: 9.99, store: 'Superstore' },
  juice: { price: 3.99, store: 'Superstore' },
  water: { price: 2.49, store: 'Superstore' },
  soda: { price: 2.99, store: 'Superstore' },
  chips: { price: 3.49, store: 'Superstore' },
  cookies: { price: 2.99, store: 'Superstore' },
  soup: { price: 2.49, store: 'Superstore' },
  tomato: { price: 2.99, store: 'Superstore' },
  tomatoes: { price: 2.99, store: 'Superstore' },
  potato: { price: 1.49, store: 'Superstore' },
  potatoes: { price: 1.49, store: 'Superstore' },
  onion: { price: 1.29, store: 'Superstore' },
  onions: { price: 1.29, store: 'Superstore' },
  lettuce: { price: 2.49, store: 'Superstore' },
  carrot: { price: 1.99, store: 'Superstore' },
  carrots: { price: 1.99, store: 'Superstore' },
}

/** Common brand names to strip for fuzzy matching (e.g. "Lucerne Milk 2L" → "milk 2l") */
const BRAND_PATTERNS = [
  /\b(lucerne|natrel|dairyland|saputo|black diamond|no name|pc\s*brand|president's choice|great value|kirkland|organic)\b/gi,
  /\b\d+\s*(ml|l|oz|g|kg)\b/gi, // keep size for matching
]

/**
 * Normalize item name for fuzzy matching.
 * "Lucerne Milk 2L" → "milk 2l", "PC White Bread" → "white bread"
 */
export function fuzzyMatchKey(itemName: string): string {
  let key = itemName
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()

  for (const pattern of BRAND_PATTERNS) {
    key = key.replace(pattern, ' ').replace(/\s+/g, ' ').trim()
  }

  // Extract core product terms: take first 2-3 meaningful words
  const words = key.split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return key

  // Try exact key first
  const exactKey = key.replace(/\s+/g, ' ')
  if (SIMULATED_MARKET[exactKey]) return exactKey

  // Try single-word match (e.g. "milk" from "lucerne milk 2l")
  for (const word of words) {
    if (SIMULATED_MARKET[word]) return word
  }

  // Try two-word combinations
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`
    if (SIMULATED_MARKET[pair]) return pair
  }

  // Try full normalized key
  return exactKey
}

/**
 * Get competitor price for a single item using fuzzy matching.
 * Returns null if no match found.
 */
export function getCompetitorPrice(
  itemName: string,
  receiptPrice: number
): { price: number; store_name: string } | null {
  const key = fuzzyMatchKey(itemName)
  const entry = SIMULATED_MARKET[key]
  if (!entry) return null

  return {
    price: entry.price,
    store_name: entry.store,
  }
}

/**
 * Fetch competitor prices for all receipt items using simulated Loblaws/Superstore data.
 * Uses fuzzy matching so "Lucerne Milk 2L" matches "Milk" in the market dataset.
 */
export function fetchCompetitorPricesFromMarket(
  items: ParsedLineItem[]
): PriceComparisonResult[] {
  return items.map((item) => {
    const receiptPrice = item.price * item.quantity
    const competitor = getCompetitorPrice(item.item_name, receiptPrice)

    const competitorPrice = competitor?.price ?? null
    const storeName = competitor?.store_name ?? 'Superstore'
    const savings =
      competitorPrice != null && competitorPrice < receiptPrice
        ? Math.round((receiptPrice - competitorPrice) * 100) / 100
        : 0

    return {
      item_name: item.item_name,
      receipt_price: receiptPrice,
      competitor_price: competitorPrice,
      savings,
      store_name: storeName,
    }
  })
}
