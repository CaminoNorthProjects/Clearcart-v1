import { useState } from 'react'
import {
  type PriceComparison,
  ADVOCACY_THRESHOLD_PERCENT,
} from '../lib/compare'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface ComparisonCardProps {
  comparisons: PriceComparison[]
  receiptScanId?: string
}

export function ComparisonCard({ comparisons, receiptScanId }: ComparisonCardProps) {
  const [sharedItems, setSharedItems] = useState<Set<number>>(new Set())
  const { showToast } = useToast()
  const { user } = useAuth()

  if (comparisons.length === 0) return null

  const handleShare = async (index: number, c: PriceComparison) => {
    setSharedItems((prev) => new Set(prev).add(index))

    if (user) {
      const { error } = await supabase.from('flagged_prices').insert({
        price_id: receiptScanId ?? null,
        user_id: user.id,
        store_name: c.store_name ?? null,
        item_name: c.item_name,
        flagged_price: c.receipt_price,
      })
      if (error) console.warn('Flag insert warning:', error)
    }

    showToast('Price flagged for the Vancouver community')
  }

  return (
    <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-midnight-navy/10 bg-white">
      <div className="sticky top-0 border-b border-midnight-navy/10 bg-cream px-3 py-2 text-xs font-semibold uppercase tracking-wide text-midnight-navy/50">
        Comparison List
      </div>
      <ul className="divide-y divide-midnight-navy/10">
        {comparisons.map((c, i) => {
          const isSavings = c.competitor_price != null && c.savings > 0
          const overMarketPercent =
            c.competitor_price != null && c.competitor_price > 0
              ? (c.receipt_price - c.competitor_price) / c.competitor_price
              : 0
          const isQuestionable =
            c.competitor_price != null &&
            overMarketPercent >= ADVOCACY_THRESHOLD_PERCENT
          const rowBg = isSavings
            ? 'bg-emerald-50'
            : isQuestionable
              ? 'bg-amber-50'
              : ''

          return (
            <li key={i} className={`px-3 py-2.5 ${rowBg}`}>
              <p className="text-sm font-medium text-midnight-navy">{c.item_name}</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-midnight-navy/60">
                  You paid: ${c.receipt_price.toFixed(2)}
                </span>
                {c.competitor_price != null ? (
                  <span
                    className={
                      isSavings
                        ? 'font-semibold text-emerald-600'
                        : isQuestionable
                          ? 'font-semibold text-amber-600'
                          : 'text-midnight-navy/50'
                    }
                  >
                    {isSavings
                      ? `Save $${c.savings.toFixed(2)} at ${c.store_name}`
                      : isQuestionable
                        ? `Questionable: ${c.store_name} has it for $${c.competitor_price.toFixed(2)}`
                        : `${c.store_name}: $${c.competitor_price.toFixed(2)}`}
                  </span>
                ) : (
                  <span className="text-midnight-navy/30">—</span>
                )}
              </div>
              {isQuestionable && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => handleShare(i, c)}
                    disabled={sharedItems.has(i)}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {sharedItems.has(i) ? 'Flagged ✓' : 'Share to Community'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
