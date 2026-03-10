/**
 * stripe-webhook — Supabase Edge Function
 *
 * Listens for Stripe webhook events and updates the profiles table.
 *
 * Required environment variables (set in Supabase Dashboard > Edge Functions > Secrets):
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET   — Webhook signing secret from Stripe Dashboard (whsec_...)
 *   SUPABASE_URL            — Auto-injected by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase runtime
 *
 * Handles:
 *   checkout.session.completed         → set is_premium = true
 *   customer.subscription.deleted      → set is_premium = false
 *   customer.subscription.paused       → set is_premium = false
 */

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Mandatory webhook signature verification — prevents forged events
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[stripe-webhook] Signature error:', message)
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id

        if (!userId) {
          console.warn('[stripe-webhook] checkout.session.completed: missing supabase_user_id in metadata')
          break
        }

        const { error } = await supabase
          .from('profiles')
          .update({ is_premium: true })
          .eq('id', userId)

        if (error) {
          throw new Error(`Supabase update failed: ${error.message}`)
        }

        console.log(`[stripe-webhook] Set is_premium=true for user ${userId}`)
        break
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.warn(`[stripe-webhook] ${event.type}: missing supabase_user_id in metadata`)
          break
        }

        const { error } = await supabase
          .from('profiles')
          .update({ is_premium: false })
          .eq('id', userId)

        if (error) {
          throw new Error(`Supabase update failed: ${error.message}`)
        }

        console.log(`[stripe-webhook] Set is_premium=false for user ${userId}`)
        break
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    console.error('[stripe-webhook] Handler error:', message)
    return new Response(message, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
