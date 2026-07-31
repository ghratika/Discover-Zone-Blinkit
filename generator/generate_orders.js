/**
 * generate_orders.js
 * Step 2 of the Data Generation Pipeline.
 *
 * Reads data/users.json and data/_archetype_assignments.json.
 * Generates 8–24 orders per user, biased by archetype.
 * Writes data/orders.json and back-fills order_history in data/users.json.
 *
 * Edge-case awareness:
 *   EC-8.1  — Every order_id written to orders.json is added to the user's order_history
 *             in the same synchronous block. No stale references possible.
 *   EC-4.2  — is_first_time_in_category is tracked per-user via a Set. Only the first
 *             order per category gets the flag; all subsequent ones get false.
 *   EC-4.4  — Each user is capped at (TOTAL_CATEGORIES - 4) distinct categories, so every
 *             user always has at least 4 untried categories for Discover to surface.
 *   EC-1.2  — At least 30 users intentionally receive 0–1 orders to exercise cold-start.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR         = path.join(__dirname, '..', 'data');
const USERS_FILE       = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE      = path.join(DATA_DIR, 'orders.json');
const CATEGORIES_FILE  = path.join(DATA_DIR, 'categories.json');
const ARCHETYPE_FILE   = path.join(DATA_DIR, '_archetype_assignments.json');

const DATASET_END      = new Date('2025-06-30');
const MIN_ORDERS       = 8;
const MAX_ORDERS       = 24;
const COLD_START_USERS = 30;   // users forced to have 0–1 orders (EC-1.2)

// Archetype → biased category ids (must match generate_users.js definitions)
const ARCHETYPE_BIAS = {
  solo_professional:  ['cat_02', 'cat_03', 'cat_06', 'cat_09', 'cat_10', 'cat_16'],
  family_household:   ['cat_01', 'cat_04', 'cat_07', 'cat_05', 'cat_11', 'cat_13'],
  student:            ['cat_02', 'cat_03', 'cat_14', 'cat_15', 'cat_10', 'cat_16'],
  health_conscious:   ['cat_12', 'cat_11', 'cat_09', 'cat_04', 'cat_03', 'cat_18']
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomDateBetween(start, end) {
  const ms = randFloat(start.getTime(), end.getTime());
  return new Date(ms).toISOString();
}

function orderId(n) {
  return `o_${String(n).padStart(5, '0')}`;
}

function productId() {
  return `p_${String(randInt(1, 9999)).padStart(4, '0')}`;
}

/**
 * Build a weighted category pool for a given archetype.
 * Biased categories appear 3× more often than non-biased ones.
 */
function buildCategoryPool(allCategoryIds, biasedCategoryIds) {
  const biasedSet = new Set(biasedCategoryIds);
  const pool = [];
  for (const catId of allCategoryIds) {
    const weight = biasedSet.has(catId) ? 3 : 1;
    for (let i = 0; i < weight; i++) pool.push(catId);
  }
  return pool;
}

/** Pick a random element from an array */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a category from the pool, respecting the max-distinct-categories cap.
 * If the user has already reached the cap, only pick from already-tried categories.
 */
function pickCategory(pool, triedSet, maxDistinct) {
  if (triedSet.size >= maxDistinct) {
    // Only re-order from already-tried categories
    const tried = Array.from(triedSet);
    return pick(tried);
  }
  return pick(pool);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Load dependencies
  const users             = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const categories        = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
  const archetypeAssignments = JSON.parse(fs.readFileSync(ARCHETYPE_FILE, 'utf8'));

  const allCategoryIds    = categories.map(c => c.category_id);
  const TOTAL_CATEGORIES  = allCategoryIds.length;
  const MAX_DISTINCT_CATS = TOTAL_CATEGORIES - 4;  // EC-4.4: always leave ≥4 untried

  const allOrders = [];
  let orderCounter = 1;

  // Determine which users will be cold-start (0–1 orders) — EC-1.2
  // Pick the first COLD_START_USERS users deterministically for reproducibility
  const coldStartUserIds = new Set(
    users.slice(0, COLD_START_USERS).map(u => u.user_id)
  );

  for (const user of users) {
    const signupDate = new Date(user.signup_date);
    const archetype  = archetypeAssignments[user.user_id] || 'solo_professional';
    const biased     = ARCHETYPE_BIAS[archetype] || ARCHETYPE_BIAS['solo_professional'];
    const pool       = buildCategoryPool(allCategoryIds, biased);

    // Decide how many orders this user gets
    let numOrders;
    if (coldStartUserIds.has(user.user_id)) {
      numOrders = randInt(0, 1);  // cold-start users: 0 or 1 order
    } else {
      numOrders = randInt(MIN_ORDERS, MAX_ORDERS);
    }

    const triedCategories = new Set();  // EC-4.2: track first-time per user
    const userOrderIds    = [];

    for (let i = 0; i < numOrders; i++) {
      const categoryId = pickCategory(pool, triedCategories, MAX_DISTINCT_CATS);
      const isFirstTime = !triedCategories.has(categoryId);

      if (isFirstTime) triedCategories.add(categoryId);  // EC-4.2: mark as seen

      const timestamp = randomDateBetween(
        new Date(signupDate.getTime() + i * 24 * 60 * 60 * 1000), // stagger by at least 1 day
        DATASET_END
      );

      const oid = orderId(orderCounter++);

      allOrders.push({
        order_id:                  oid,
        user_id:                   user.user_id,
        category_id:               categoryId,
        product_id:                productId(),
        timestamp:                 timestamp,
        is_first_time_in_category: isFirstTime
      });

      userOrderIds.push(oid);  // collect for back-fill
    }

    // EC-8.1: Back-fill order_history only with IDs that exist in allOrders
    user.order_history = userOrderIds;
  }

  // Sort orders by timestamp for cleanliness
  allOrders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Write orders.json
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(allOrders, null, 2), 'utf8');
  console.log(`✅  Written ${allOrders.length} orders → ${ORDERS_FILE}`);

  // Write updated users.json (with back-filled order_history) — EC-8.1
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  console.log(`✅  Updated order_history for ${users.length} users → ${USERS_FILE}`);

  // Summary stats
  const coldStartCount = users.filter(u => u.order_history.length < 2).length;
  console.log(`📊  Cold-start users (< 2 orders): ${coldStartCount}`);
  console.log(`📊  Total distinct category_ids in orders: ${new Set(allOrders.map(o => o.category_id)).size}`);
  console.log(`📊  First-time category orders: ${allOrders.filter(o => o.is_first_time_in_category).length}`);
}

main();
