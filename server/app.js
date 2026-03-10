'use strict';

require('dotenv').config();

const express = require('express');
const { parseGroceriesFromInput } = require('./services/parserService');
const { calculateRunningTotals } = require('./services/costCalculator');
const { addLogisticsCosts } = require('./services/logisticsService');

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ClearCart server running on port ${PORT}`);
});

module.exports = app;
