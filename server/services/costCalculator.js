'use strict';

const { createClient } = require('@supabase/supabase-js');

/**
 * Health flag values that trigger The Jennifer Rule.
 * Stored in the prices.health_flags text[] column.
 */
const JENNIFER_RULE_FLAGS = ['artificial_colors', 'high_preservatives'];

/**
 * Lazily initialise the Supabase client so the module can be required
 * without env vars present (e.g. during unit testing with mocks).
 */
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.'
    );
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// The Luis Rule
// ---------------------------------------------------------------------------

/**
 * Determine whether a price row should be excluded by The Luis Rule.
 *
 * Applies when the user's storage_capacity is 'condo/small': bulk-discount
 * perishable items are impractical for small-storage households because they
 * cannot be consumed before spoiling.
 *
 * @param {object} row  A price row from Supabase.
 * @param {object} prefs  The userPreferences object.
 * @returns {boolean}  true if the row must be excluded.
 */
function isExcludedByLuisRule(row, prefs) {
  if (prefs.storage_capacity !== 'condo/small') return false;
  return row.is_bulk_discount === true && row.is_perishable === true;
}

// ---------------------------------------------------------------------------
// The Jennifer Rule
// ---------------------------------------------------------------------------

/**
 * Extract which Jennifer Rule flags are present on a row.
 *
 * @param {string[]} healthFlags  The health_flags array from a price row.
 * @returns {string[]}  Subset of JENNIFER_RULE_FLAGS that are present.
 */
function getJenniferFlags(healthFlags) {
  if (!Array.isArray(healthFlags) || healthFlags.length === 0) return [];
  return JENNIFER_RULE_FLAGS.filter((flag) => healthFlags.includes(flag));
}

/**
 * Find a green-certified or farm-direct alternative for a flagged item
 * within the same store's item list.
 *
 * Matching strategy: split the flagged item's name into words of ≥4 chars
 * and look for any of those words (case-insensitive) in the alternative's
 * item_name. Returns the first match found, or null.
 *
 * @param {string} flaggedName  item_name of the product with health concerns.
 * @param {object[]} storeItems  All items belonging to the same store.
 * @returns {string|null}  item_name of the suggested alternative, or null.
 */
function findGreenAlternative(flaggedName, storeItems) {
  const keywords = flaggedName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  for (const item of storeItems) {
    if (!(item.is_green_certified || item.is_farm_direct)) continue;
    if (item.item_name === flaggedName) continue;

    const lowerName = item.item_name.toLowerCase();
    if (keywords.some((kw) => lowerName.includes(kw))) {
      return item.item_name;
    }
  }

  return null;
}

/**
 * Annotate a store's item list with health warnings for items that carry
 * concerning health flags. Flagged items are NOT removed from the total;
 * they receive a health_warning object so the UI can surface it.
 *
 * Runs only when userPreferences.strict_health === true.
 *
 * @param {object[]} items  Flat item list for one store.
 * @param {object}   prefs  The userPreferences object.
 * @returns {object[]}  Same items, each with an added health_warning field.
 */
function applyJenniferRule(items, prefs) {
  if (prefs.strict_health !== true) {
    return items.map((item) => ({ ...item, health_warning: null }));
  }

  return items.map((item) => {
    const triggeredFlags = getJenniferFlags(item.health_flags ?? []);

    if (triggeredFlags.length === 0) {
      return { ...item, health_warning: null };
    }

    const suggested_alternative = findGreenAlternative(item.item_name, items);

    return {
      ...item,
      health_warning: {
        flags: triggeredFlags,
        suggested_alternative,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Query the Supabase `prices` table for a list of item names and compute
 * a running total (sum of prices) grouped by store, after applying the
 * two business rules below.
 *
 * THE LUIS RULE
 * When userPreferences.storage_capacity === 'condo/small', any price row
 * that is both a bulk discount AND perishable is excluded from the running
 * total. Excluded items are surfaced in luis_rule_excluded so the caller
 * can inform the user.
 *
 * THE JENNIFER RULE
 * When userPreferences.strict_health === true, items whose health_flags
 * array contains 'artificial_colors' or 'high_preservatives' receive a
 * health_warning annotation with a suggested green-certified or farm-direct
 * alternative from the same store (if one exists).
 *
 * @param {string[]} itemNames
 *   List of grocery item names to price-check.
 *
 * @param {{
 *   storage_capacity?: string,
 *   strict_health?: boolean
 * }} [userPreferences={}]
 *   Optional user settings that activate the business rules.
 *
 * @returns {Promise<Array<{
 *   store_name: string,
 *   running_total: number,
 *   items: Array<{
 *     item_name: string,
 *     price: number,
 *     is_perishable: boolean,
 *     is_bulk_discount: boolean,
 *     is_green_certified: boolean,
 *     is_farm_direct: boolean,
 *     health_flags: string[],
 *     health_warning: { flags: string[], suggested_alternative: string|null } | null
 *   }>,
 *   luis_rule_excluded: Array<{ item_name: string, price: number }>
 * }>>}
 */
async function calculateRunningTotals(itemNames, userPreferences = {}) {
  if (!Array.isArray(itemNames) || itemNames.length === 0) {
    throw new Error('`itemNames` must be a non-empty array of strings.');
  }

  const supabase = getSupabaseClient();

  // Build an OR filter: item_name ILIKE '%milk%' OR item_name ILIKE '%bread%' ...
  const ilikeFilters = itemNames
    .map((name) => `item_name.ilike.%${name.trim()}%`)
    .join(',');

  const { data, error } = await supabase
    .from('prices')
    .select(
      'item_name, price, store_name, is_perishable, is_bulk_discount, health_flags, is_green_certified, is_farm_direct'
    )
    .or(ilikeFilters);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // --- The Luis Rule: partition rows before grouping ---
  const includedRows = [];
  const excludedByLuis = [];

  for (const row of data) {
    if (isExcludedByLuisRule(row, userPreferences)) {
      excludedByLuis.push(row);
    } else {
      includedRows.push(row);
    }
  }

  // Group included rows by store and accumulate totals
  const storeMap = new Map();

  for (const row of includedRows) {
    const storeName = row.store_name ?? 'Unknown Store';

    if (!storeMap.has(storeName)) {
      storeMap.set(storeName, {
        store_name: storeName,
        items: [],
        running_total: 0,
        luis_rule_excluded: [],
      });
    }

    const store = storeMap.get(storeName);
    store.items.push({
      item_name: row.item_name,
      price: row.price,
      is_perishable: row.is_perishable ?? false,
      is_bulk_discount: row.is_bulk_discount ?? false,
      health_flags: row.health_flags ?? [],
      is_green_certified: row.is_green_certified ?? false,
      is_farm_direct: row.is_farm_direct ?? false,
    });
    store.running_total = round2(store.running_total + (row.price ?? 0));
  }

  // Attach excluded items to the correct store bucket
  for (const row of excludedByLuis) {
    const storeName = row.store_name ?? 'Unknown Store';

    if (!storeMap.has(storeName)) {
      storeMap.set(storeName, {
        store_name: storeName,
        items: [],
        running_total: 0,
        luis_rule_excluded: [],
      });
    }

    storeMap.get(storeName).luis_rule_excluded.push({
      item_name: row.item_name,
      price: row.price,
    });
  }

  // --- The Jennifer Rule: annotate items with health warnings ---
  const stores = Array.from(storeMap.values()).map((store) => ({
    ...store,
    items: applyJenniferRule(store.items, userPreferences),
  }));

  // Sort by running_total ascending so the cheapest option appears first
  return stores.sort((a, b) => a.running_total - b.running_total);
}

/** Round to 2 decimal places to avoid floating-point drift. */
function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  calculateRunningTotals,
  // Exported for unit testing
  isExcludedByLuisRule,
  applyJenniferRule,
  findGreenAlternative,
};
