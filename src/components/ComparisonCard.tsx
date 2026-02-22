import type { PriceComparison } from '../lib/compare'

interface ComparisonCardProps {
  comparisons: PriceComparison[]
}

export function ComparisonCard({ comparisons }: ComparisonCardProps) {
  if (comparisons.length === 0) return null

  return (
    <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
      <div className="sticky top-0 border-b border-gray-200 bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
        Comparison List
      </div>
      <ul className="divide-y divide-gray-200">
        {comparisons.map((c, i) => {
          const isSavings = c.competitor_price != null && c.savings > 0
          const isQuestionable =
            c.competitor_price != null && c.competitor_price > c.receipt_price
          const rowBg = isSavings
            ? 'bg-emerald-50'
            : isQuestionable
              ? 'bg-amber-50'
              : ''

          return (
            <li key={i} className={`px-3 py-2 ${rowBg}`}>
              <p className="text-sm font-medium text-gray-900">{c.item_name}</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  You paid: ${c.receipt_price.toFixed(2)}
                </span>
                {c.competitor_price != null ? (
                  <span
                    className={
                      isSavings
                        ? 'font-medium text-emerald-600'
                        : isQuestionable
                          ? 'font-medium text-amber-600'
                          : 'text-gray-500'
                    }
                  >
                    {isSavings
                      ? `Save $${c.savings.toFixed(2)} at ${c.store_name}`
                      : isQuestionable
                        ? `Questionable: ${c.store_name} has it for $${c.competitor_price.toFixed(2)}`
                        : `${c.store_name}: $${c.competitor_price.toFixed(2)}`}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
