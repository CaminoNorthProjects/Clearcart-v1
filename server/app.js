'use strict';

require('dotenv').config();

const express = require('express');
const { parseGroceriesFromInput } = require('./services/parserService');
const { calculateRunningTotals } = require('./services/costCalculator');
const { addLogisticsCosts } = require('./services/logisticsService');
const { importRecipeFromUrl } = require('./services/recipeImporter');
const Stripe = require('stripe');

const app = express();
app.use(express.json({ limit: '10mb' }));

/**
 * POST /api/parse
 *
 * Extracts grocery ingredients from a receipt image URL or base64 payload
 * using the Gemini API.
 *
 * Body (URL):   { "input": "https://example.com/receipt.jpg" }
 * Body (image): { "input": { "mimeType": "image/jpeg", "data": "<base64>" } }
 *
 * Response: { "items": [{ "name": string, "quantity": number, "unit": string }] }
 */
app.post('/api/parse', async (req, res) => {
  const { input } = req.body;

  if (!input) {
    return res.status(400).json({ error: '`input` is required (URL string or { mimeType, data } object).' });
  }

  try {
    const items = await parseGroceriesFromInput(input);
    res.json({ items });
  } catch (err) {
    console.error('[/api/parse]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/costs
 *
 * Queries the Supabase `prices` table for each item name and returns a
 * running total grouped by store.
 *
 * Body:
 *   {
 *     "itemNames": ["Whole Milk", "Sourdough Bread", ...],
 *     "userPreferences": {           // optional
 *       "storage_capacity": "condo/small",  // activates The Luis Rule
 *       "strict_health": true               // activates The Jennifer Rule
 *     }
 *   }
 *
 * Response: {
 *   "stores": [
 *     {
 *       "store_name": string,
 *       "running_total": number,
 *       "items": [{ "item_name": string, "price": number, "health_warning": object|null, ... }],
 *       "luis_rule_excluded": [{ "item_name": string, "price": number }]
 *     }
 *   ]
 * }
 */
app.post('/api/costs', async (req, res) => {
  const { itemNames, userPreferences } = req.body;

  if (!Array.isArray(itemNames) || itemNames.length === 0) {
    return res.status(400).json({ error: '`itemNames` must be a non-empty array of strings.' });
  }

  try {
    const stores = await calculateRunningTotals(itemNames, userPreferences ?? {});
    res.json({ stores });
  } catch (err) {
    console.error('[/api/costs]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/logistics
 *
 * Augments each store's running total with an estimated transit time and
 * parking/transit cost calculated via the Google Maps Distance Matrix API.
 *
 * Body: {
 *   "stores": [{ "store_name": string, "address": string, "running_total": number, ... }],
 *   "userOrigin": "123 Main St, Vancouver, BC"   // address or "lat,lng"
 * }
 *
 * Response: {
 *   "stores": [
 *     { ...original fields, "transit_time_minutes": number, "transit_cost": number, "adjusted_total": number }
 *   ]
 * }
 */
app.post('/api/logistics', async (req, res) => {
  const { stores, userOrigin } = req.body;

  if (!Array.isArray(stores) || stores.length === 0) {
    return res.status(400).json({ error: '`stores` must be a non-empty array.' });
  }
  if (!userOrigin || typeof userOrigin !== 'string') {
    return res.status(400).json({ error: '`userOrigin` must be a non-empty address string or "lat,lng".' });
  }

  try {
    const augmented = await addLogisticsCosts(stores, userOrigin);
    res.json({ stores: augmented });
  } catch (err) {
    console.error('[/api/logistics]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/import-recipe
 *
 * Fetches a recipe webpage URL and uses Gemini to extract title,
 * ingredients (with categories), prep/cook time, and health score.
 *
 * Body:   { "url": "https://www.example.com/lemon-chicken-recipe" }
 * Response: {
 *   "title": string,
 *   "health_score": number|null,
 *   "prep_time_minutes": number|null,
 *   "cook_time_minutes": number|null,
 *   "image_url": string|null,
 *   "ingredients": [{ "name", "quantity", "unit", "category" }]
 * }
 */
app.post('/api/import-recipe', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '`url` must be a non-empty string.' });
  }

  try {
    new URL(url); // validate URL structure
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  try {
    const recipe = await importRecipeFromUrl(url);
    res.json(recipe);
  } catch (err) {
    console.error('[/api/import-recipe]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/create-checkout
 *
 * Creates a Stripe Checkout Session for the $10.99/month Premium subscription.
 * The supabase_user_id is stored in Stripe metadata so the stripe-webhook Edge
 * Function can look up the correct profile and set is_premium = true.
 *
 * Body:   { "supabase_user_id": "uuid", "email": "user@example.com" }
 * Response: { "url": "https://checkout.stripe.com/..." }
 */
app.post('/api/create-checkout', async (req, res) => {
  const { supabase_user_id, email } = req.body;

  if (!supabase_user_id || typeof supabase_user_id !== 'string') {
    return res.status(400).json({ error: '`supabase_user_id` is required.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured on this server.' });
  }
  if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
    return res.status(503).json({ error: 'STRIPE_PREMIUM_PRICE_ID is not configured.' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email ?? undefined,
      line_items: [
        {
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        supabase_user_id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id,
        },
      },
      success_url: `${process.env.APP_URL ?? 'https://clearcart.repl.co'}?premium=success`,
      cancel_url: `${process.env.APP_URL ?? 'https://clearcart.repl.co'}?premium=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[/api/create-checkout]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/delete-account
 *
 * Deletes the Supabase auth user after the client-side RPC has already
 * removed their data rows. Requires the service role key.
 *
 * Body: { "user_id": "uuid" }
 */
app.post('/api/delete-account', async (req, res) => {
  const { user_id } = req.body;

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: '`user_id` is required.' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Server Supabase credentials are not configured.' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await adminClient.auth.admin.deleteUser(user_id);
    if (error) throw new Error(error.message);

    console.log(`[/api/delete-account] Deleted auth user ${user_id}`);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[/api/delete-account]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ClearCart server running on port ${PORT}`);
});

module.exports = app;
