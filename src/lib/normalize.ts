import { supabase } from './supabase'

/** Vancouver Local Gems — 25 credits. Map search term to display name. */
const LOCAL_GEMS: [string, string][] = [
  ['aria', 'Aria'],
  ["kin's", "Kin's Market"],
  ['kins market', "Kin's Market"],
  ["donald's", "Donald's Market"],
  ['donalds market', "Donald's Market"],
  ['persia foods', 'Persia Foods'],
  ['famous foods', 'Famous Foods'],
  ['sunrise market', 'Sunrise Market'],
  ["stong's", "Stong's"],
  ['stongs', "Stong's"],
]

export interface StoreExtraction {
  store_name: string | null
  store_type: 'Local Gem' | 'Standard'
}

/**
 * Extract store name and type from OCR text.
 * Checks first ~10 lines for known chains vs Local Gems.
 */
export function extractStoreFromOcr(rawText: string): StoreExtraction {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)

  const fullText = lines.join(' ')

  for (const [search, displayName] of LOCAL_GEMS) {
    if (fullText.includes(search)) {
      return {
        store_name: displayName,
        store_type: 'Local Gem',
      }
    }
  }

  // Default: Standard (major chain or unknown)
  const chainPatterns = [
    /\b(loblaws|superstore|real canadian|save[- ]?on|safeway|walmart|costco|whole foods|t&t|tnt)\b/i,
  ]
  for (const re of chainPatterns) {
    const m = fullText.match(re)
    if (m) {
      return { store_name: m[1], store_type: 'Standard' }
    }
  }

  return { store_name: null, store_type: 'Standard' }
}

export interface ParsedLineItem {
  item_name: string
  price: number
  quantity: number
}

/**
 * Fix common OCR errors: S→$, O→0, l→1
 */
export function normalizeOcrErrors(text: string): string {
  return text
    .replace(/\bS(\d+\.?\d*)\b/g, '$$1') // S4.99 → $4.99
    .replace(/\b(\d+)O\b/g, '$10') // 4O → 40
    .replace(/\bl(\d+)\b/g, '1$1') // l49 → 149 (ambiguous, use sparingly)
}

/** Strip Vancouver tax markers (G=GST, P=PST, H=HST) from text before price/item extraction */
function stripTaxMarkers(text: string): string {
  return text.replace(/\s*[GPH]\b/gi, '')
}

/**
 * Parse raw OCR text into line items with item_name, price, quantity.
 * Handles common receipt formats: "MILK 2% 4.99", "1.49 BREAD", "$12.50 TOTAL"
 */
export function parseReceiptLines(rawText: string): ParsedLineItem[] {
  const normalized = normalizeOcrErrors(rawText)
  const items: ParsedLineItem[] = []
  const seen = new Set<string>()

  // Price pattern: optional $, digits, optional .xx
  const pricePattern = /(\$?\d+\.?\d{0,2})/g

  // Skip common non-item lines
  const skipPatterns = [
    /^total$/i,
    /^subtotal$/i,
    /^tax$/i,
    /^hst$/i,
    /^gst$/i,
    /^change$/i,
    /^cash$/i,
    /^card$/i,
    /^debit$/i,
    /^credit$/i,
    /^\d{2}\/\d{2}\/\d{2,4}$/, // date
    /^\d{2}:\d{2}$/, // time
    /^#\d+$/, // receipt number
  ]

  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    const cleaned = stripTaxMarkers(line)

    // Weighted items: "2.5kg @ 1.99/kg" - extract unit price for comparison
    const weightedMatch = cleaned.match(
      /(\d+\.?\d*)\s*kg\s*@\s*(\d+\.?\d{0,2})\s*\/?\s*kg/i
    )
    if (weightedMatch) {
      const qty = parseFloat(weightedMatch[1])
      const unitPrice = parseFloat(weightedMatch[2])
      if (!isNaN(qty) && !isNaN(unitPrice) && unitPrice > 0 && unitPrice < 1000) {
        const itemName = cleaned
          .replace(weightedMatch[0], '')
          .replace(/\s+/g, ' ')
          .trim() || `Item ${items.length + 1}`
        const key = `${itemName}|${unitPrice}|${qty}`
        if (!seen.has(key)) {
          seen.add(key)
          items.push({ item_name: itemName, price: unitPrice, quantity: qty })
        }
      }
      continue
    }

    const prices = cleaned.match(/(\$?\d+\.?\d{0,2})/g)
    if (!prices || prices.length === 0) continue

    const lastPriceStr = prices[prices.length - 1].replace('$', '')
    const price = parseFloat(lastPriceStr)
    if (isNaN(price) || price <= 0 || price > 9999) continue

    // Skip date-like patterns (DD.MM or MM.DD when both <= 31)
    const [intPart, decPart] = lastPriceStr.split('.')
    const a = parseInt(intPart || '0', 10)
    const b = parseInt(decPart || '0', 10)
    if (a <= 31 && b <= 31 && decPart && decPart.length <= 2) continue

    const lastPriceIndex = cleaned.lastIndexOf(prices[prices.length - 1])
    let itemName = cleaned
      .slice(0, lastPriceIndex)
      .replace(/\$?\d+\.?\d{0,2}/g, '')
      .replace(/\s*[GPH]\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (skipPatterns.some((p) => p.test(itemName))) continue
    if (itemName.length < 2) itemName = `Item ${items.length + 1}`

    const key = `${itemName}|${price}`
    if (seen.has(key)) continue
    seen.add(key)

    let quantity = 1
    const qtyMatch = cleaned.match(/^(\d+)\s*[xX@]\s*/)
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10) || 1
    }

    items.push({ item_name: itemName, price, quantity })
  }

  return items
}

/**
 * Save parsed items to Supabase prices table, linked to receipt_scan_id
 */
export async function savePricesToSupabase(
  items: ParsedLineItem[],
  receiptScanId: string,
  storeName?: string
): Promise<{ error: Error | null }> {
  if (items.length === 0) return { error: null }

  const rows = items.map((item) => ({
    item_name: item.item_name,
    price: item.price * item.quantity,
    unit: item.quantity > 1 ? `${item.quantity} units` : null,
    store_name: storeName ?? null,
    is_delivery_app_price: false,
    receipt_scan_id: receiptScanId,
  }))

  const { error } = await supabase.from('prices').insert(rows)

  return { error: error ? new Error(error.message) : null }
}
