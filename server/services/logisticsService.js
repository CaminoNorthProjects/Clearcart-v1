'use strict';

const { Client, TravelMode } = require('@googlemaps/google-maps-services-js');

const mapsClient = new Client({});

/**
 * Estimate a parking/transit cost from travel duration.
 *
 * Tiers (CAD):
 *   < 10 min  → $0.00  (walkable, no transit cost)
 *   10–29 min → $3.25  (single transit fare, e.g. Vancouver TransLink)
 *   30–59 min → $4.75  (two-zone fare or short drive + meter parking)
 *   ≥ 60 min  → $7.50  (long trip; multi-zone fare or drive + parking)
 *
 * @param {number} minutes
 * @returns {number}
 */
function estimateTransitCost(minutes) {
  if (minutes < 10) return 0.0;
  if (minutes < 30) return 3.25;
  if (minutes < 60) return 4.75;
  return 7.5;
}

/**
 * Augment an array of store results with transit time and an estimated
 * parking/transit cost, then update each store's adjusted total.
 *
 * Uses the Google Maps Distance Matrix API in transit mode. If a store's
 * address cannot be resolved, its transit fields are set to null and the
 * adjusted_total equals the original running_total.
 *
 * @param {Array<{
 *   store_name: string,
 *   address: string,
 *   running_total: number,
 *   items?: Array<{ item_name: string, price: number }>
 * }>} stores
 *   Array of store objects as returned by `calculateRunningTotals`, each
 *   augmented with an `address` field for geocoding.
 *
 * @param {string} userOrigin
 *   The user's current location as a formatted address ("123 Main St, Vancouver, BC")
 *   or a lat/lng string ("49.2827,-123.1207").
 *
 * @returns {Promise<Array<{
 *   store_name: string,
 *   address: string,
 *   running_total: number,
 *   items?: Array<any>,
 *   transit_time_minutes: number | null,
 *   transit_cost: number | null,
 *   adjusted_total: number
 * }>>}
 */
async function addLogisticsCosts(stores, userOrigin) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set.');
  }

  const destinations = stores.map((s) => s.address);

  // Single Distance Matrix call for all stores at once
  const response = await mapsClient.distancematrix({
    params: {
      origins: [userOrigin],
      destinations,
      mode: TravelMode.transit,
      key: process.env.GOOGLE_MAPS_API_KEY,
    },
  });

  const elements = response.data.rows[0]?.elements ?? [];

  return stores.map((store, index) => {
    const element = elements[index];
    const ok = element?.status === 'OK';

    const transitTimeSeconds = ok ? element.duration.value : null;
    const transitTimeMinutes = transitTimeSeconds !== null
      ? Math.round(transitTimeSeconds / 60)
      : null;

    const transitCost = transitTimeMinutes !== null
      ? estimateTransitCost(transitTimeMinutes)
      : null;

    const adjustedTotal = round2(
      (store.running_total ?? 0) + (transitCost ?? 0)
    );

    return {
      ...store,
      transit_time_minutes: transitTimeMinutes,
      transit_cost: transitCost,
      adjusted_total: adjustedTotal,
    };
  });
}

/** Round to 2 decimal places. */
function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { addLogisticsCosts, estimateTransitCost };
