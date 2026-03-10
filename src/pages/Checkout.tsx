/**
 * Checkout page
 *
 * This is ClearCart's order summary screen — not a marketplace checkout.
 * It confirms which store the user has chosen, shows how much they're saving,
 * and lets them redeem ClearCredits and select a payment method UI.
 */
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import type { StoreResult } from '../lib/tripleConstraint'

interface CheckoutProps {
  store: StoreResult
  allStores: StoreResult[]
  onClose: () => void
}

const CREDITS_TO_DOLLARS = 0.01   // 10 credits = $0.10
const MAX_CREDITS_PERCENT = 0.20  // credits can cover up to 20% of basket

export function Checkout({ store, allStores, onClose }: CheckoutProps) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup')
  const [creditsToApply, setCreditsToApply] = useState(0)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoaded, setBalanceLoaded] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  // Load credit balance on first render
  useState(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('clear_credits')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setBalance(data?.clear_credits ?? 0)
        setBalanceLoaded(true)
      })
  })

  const mostExpensive = allStores.reduce(
    (max, s) => (s.running_total > max.running_total ? s : max),
    allStores[0]
  )
  const savingsVsMostExpensive = Math.max(
    0,
    (mostExpensive?.running_total ?? store.running_total) - store.running_total
  )

  const deliveryFee = mode === 'delivery' ? 4.99 : 0
  const maxCreditsUsable = Math.min(
    balance ?? 0,
    Math.floor((store.running_total * MAX_CREDITS_PERCENT) / CREDITS_TO_DOLLARS)
  )
  const creditDiscount = creditsToApply * CREDITS_TO_DOLLARS
  const finalTotal = Math.max(0, store.running_total + deliveryFee - creditDiscount)

  const handleConfirm = async () => {
    if (!user) return

    if (creditsToApply > 0) {
      const { error } = await supabase
        .from('profiles')
        .update({ clear_credits: (balance ?? 0) - creditsToApply })
        .eq('id', user.id)
      if (error) {
        showToast('Credit redemption failed. Please try again.')
        return
      }
    }

    setConfirmed(true)
  }

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/50">
        <div className="mx-4 w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="text-5xl">✓</div>
          <h3 className="mt-4 font-display text-2xl font-semibold text-midnight-navy">You're set!</h3>
          <p className="mt-2 text-sm text-midnight-navy/60">
            Heading to {store.store_name}? Your list is ready.
          </p>
          {store.transit_time_minutes != null && (
            <p className="mt-1 text-sm font-medium text-midnight-navy">
              ~{store.transit_time_minutes} min transit
            </p>
          )}
          <p className="mt-4 font-display text-xl font-semibold text-emerald-600">
            Total: ${finalTotal.toFixed(2)}
          </p>
          {creditsToApply > 0 && (
            <p className="mt-1 text-xs text-midnight-navy/50">
              {creditsToApply} ClearCredits redeemed (−${creditDiscount.toFixed(2)})
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-sunset-red px-4 py-3 font-display font-semibold text-white hover:bg-sunset-red/90"
          >
            I'm on my way
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-midnight-navy/40" onClick={onClose}>
      <div
        className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white px-6 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-midnight-navy/20" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-midnight-navy">Order Summary</h3>
          <button onClick={onClose} className="text-midnight-navy/40 hover:text-midnight-navy">✕</button>
        </div>

        {/* Savings banner */}
        {savingsVsMostExpensive > 0 && (
          <div className="mt-4 rounded-xl bg-sunset-red px-4 py-3">
            <p className="font-display text-lg font-semibold text-white">
              Congrats, you're saving ${savingsVsMostExpensive.toFixed(2)} on this order!
            </p>
            <p className="text-sm text-white/80">
              vs. most expensive option at {mostExpensive.store_name}
            </p>
          </div>
        )}

        {/* Store summary */}
        <div className="mt-4 rounded-xl border border-midnight-navy/10 bg-cream p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40">Store</p>
          <p className="mt-1 font-display text-xl font-semibold text-midnight-navy">{store.store_name}</p>
          <p className="mt-1 text-sm font-semibold text-midnight-navy">
            Basket: ${store.running_total.toFixed(2)}
          </p>
          {store.transit_time_minutes != null && (
            <p className="mt-0.5 text-xs text-midnight-navy/50">
              {store.transit_time_minutes} min transit
            </p>
          )}
        </div>

        {/* Pick-up vs Delivery */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40 mb-2">
            Fulfilment
          </p>
          <div className="flex rounded-xl border border-midnight-navy/10 bg-white p-1">
            <button
              onClick={() => setMode('pickup')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                mode === 'pickup' ? 'bg-midnight-navy text-white' : 'text-midnight-navy/60 hover:text-midnight-navy'
              }`}
            >
              Pick-up
            </button>
            <button
              onClick={() => setMode('delivery')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                mode === 'delivery' ? 'bg-midnight-navy text-white' : 'text-midnight-navy/60 hover:text-midnight-navy'
              }`}
            >
              Delivery (+$4.99)
            </button>
          </div>
        </div>

        {/* ClearCredits redemption */}
        {balanceLoaded && (balance ?? 0) > 0 && (
          <div className="mt-4 rounded-xl border border-midnight-navy/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-midnight-navy">ClearCredits</p>
              <p className="text-xs text-midnight-navy/50">{balance} available</p>
            </div>
            <input
              type="range"
              min={0}
              max={maxCreditsUsable}
              step={10}
              value={creditsToApply}
              onChange={(e) => setCreditsToApply(Number(e.target.value))}
              className="mt-3 w-full accent-sunset-red"
            />
            <div className="mt-1 flex justify-between text-xs text-midnight-navy/50">
              <span>0 credits</span>
              <span className="font-semibold text-midnight-navy">
                {creditsToApply} credits = −${creditDiscount.toFixed(2)}
              </span>
              <span>{maxCreditsUsable} max</span>
            </div>
          </div>
        )}

        {/* Payment method */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-midnight-navy/40 mb-2">
            Payment
          </p>
          <div className="space-y-2">
            {[
              { id: 'apple', label: 'Apple Pay', icon: '' },
              { id: 'google', label: 'Google Pay', icon: 'G' },
              { id: 'card', label: 'Credit / Debit Card', icon: '▭' },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-midnight-navy/10 bg-white px-4 py-3 text-sm font-medium text-midnight-navy hover:bg-cream transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-midnight-navy/5 text-base">
                  {method.icon}
                </span>
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* Order total */}
        <div className="mt-4 rounded-xl border border-midnight-navy/10 bg-cream p-4">
          <div className="flex items-center justify-between text-sm text-midnight-navy">
            <span>Basket subtotal</span>
            <span>${store.running_total.toFixed(2)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm text-midnight-navy">
              <span>Delivery fee</span>
              <span>+${deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {creditDiscount > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm text-emerald-600">
              <span>ClearCredits discount</span>
              <span>−${creditDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-midnight-navy/10 pt-2">
            <span className="font-display text-lg font-semibold text-midnight-navy">Total</span>
            <span className="font-display text-lg font-semibold text-midnight-navy">
              ${finalTotal.toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="mt-4 w-full rounded-xl bg-sunset-red px-4 py-4 font-display text-lg font-semibold text-white hover:bg-sunset-red/90"
        >
          Confirm Order
        </button>

        <p className="mt-3 text-center text-xs text-midnight-navy/30">
          Powered by Stripe · Secure payment processing
        </p>
      </div>
    </div>
  )
}
