import { supabase } from './supabase'

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
    const prices = line.match(/(\$?\d+\.?\d{0,2})/g)
    if (!prices || prices.length === 0) continue

    // Use last price as item price (receipts often have qty x price at end)
    const lastPriceStr = prices[prices.length - 1].replace('$', '')
    const price = parseFloat(lastPriceStr)
    if (isNaN(price) || price <= 0 || price > 99999) continue

    // Extract item name: everything before the last price, cleaned
    const lastPriceIndex = line.lastIndexOf(prices[prices.length - 1])
    let itemName = line
      .slice(0, lastPriceIndex)
      .replace(/\$?\d+\.?\d{0,2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Skip if name looks like a total/subtotal
    if (skipPatterns.some((p) => p.test(itemName))) continue
    if (itemName.length < 2) itemName = `Item ${items.length + 1}`

    // Dedupe by name+price
    const key = `${itemName}|${price}`
    if (seen.has(key)) continue
    seen.add(key)

    // Quantity: first number if pattern "2 x 4.99" or "2 @ 4.99"
    let quantity = 1
    const qtyMatch = line.match(/^(\d+)\s*[xX@]\s*/)
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
