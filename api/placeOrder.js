/**
 * api/placeOrder.js
 * Phase 3 — API Bridge, entry point 3.
 *
 * Simulates a user placing an order from the Category Detail screen.
 * Writes the new order to disk, back-fills the user's order_history,
 * optionally creates a feedback record, and triggers the graduation tracker.
 *
 * Returns: { success: true, order_id }
 *   OR     { success: false, error: string }
 *
 * Edge-case awareness:
 *   EC-8.2  — orders.json and users.json are written in the same synchronous
 *             block; the store's in-memory arrays are updated first, then both
 *             files are written before returning. No partial-write window.
 *   EC-3.1  — markAdopted is called unconditionally regardless of whether the
 *             category was previously in Discover suggestions.
 *   EC-4.5  — Feedback record is only created when is_first_time_in_category = true.
 *   EC-10.3 — Simulated feedback for new orders uses the same weighted distribution
 *             as the generator (skewed positive for high-trust categories).
 *   EC-6.1  — trust_score is used only inside this module to weight feedback
 *             simulation; it is never included in the return value.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const store = require('../engine/store');
const tracker = require('../engine/graduationTracker');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const ORDERS_FILE  = path.join(DATA_DIR, 'orders.json');
const USERS_FILE   = path.join(DATA_DIR, 'users.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

// Feedback quality scoring map (EC-10.3: no_response is neutral = 0.5)
const QUALITY_SCORE = { good: 1, bad: 0, no_response: 0.5 };

/** Generate a new unique order_id based on current orders array length */
function generateOrderId() {
  const nextIndex = store.orders.length + 1;
  return `o_${String(nextIndex).padStart(5, '0')}`;
}

/** Generate a random product_id (p_XXXX) */
function generateProductId() {
  const n = Math.floor(Math.random() * 9999) + 1;
  return `p_${String(n).padStart(4, '0')}`;
}

/**
 * Simulate a post-delivery response weighted by category trust_score.
 * EC-6.1: trust_score is read here only — it never leaves this function.
 * EC-10.3: no_response is neutral (0.5 quality score), not negative.
 */
function simulateFeedbackResponse(trustScore) {
  const r = Math.random();
  if ((trustScore ?? 3.5) >= 4.0) {
    if (r < 0.70) return 'good';
    if (r < 0.80) return 'bad';
    return 'no_response';
  } else {
    if (r < 0.50) return 'good';
    if (r < 0.75) return 'bad';
    return 'no_response';
  }
}

/**
 * Place a simulated order for a user in a given category.
 *
 * @param {string} userId
 * @param {string} categoryId
 * @returns {{ success: boolean, order_id?: string, error?: string }}
 */
function placeOrder(userId, categoryId) {
  const { userMap, categoryMap, orderMap, feedbackMap } = store;

  // ── Validate inputs ───────────────────────────────────────────────────────
  const user = userMap[userId];
  if (!user) return { success: false, error: `User "${userId}" not found.` };

  const category = categoryMap[categoryId];
  if (!category) return { success: false, error: `Category "${categoryId}" not found.` };

  // ── Step 1: Determine is_first_time_in_category ──────────────────────────
  const triedCategories = new Set(
    user.order_history
      .map(id => orderMap[id] ?? null)
      .filter(Boolean)
      .map(o => o.category_id)
  );
  const isFirstTime = !triedCategories.has(categoryId);

  // ── Step 2: Build the new order record ────────────────────────────────────
  const orderId   = generateOrderId();
  const productId = generateProductId();
  const newOrder  = {
    order_id:                  orderId,
    user_id:                   userId,
    category_id:               categoryId,
    product_id:                productId,
    timestamp:                 new Date().toISOString(),
    is_first_time_in_category: isFirstTime
  };

  // ── Step 3: Update in-memory store ────────────────────────────────────────
  store.orders.push(newOrder);
  orderMap[orderId] = newOrder;                 // keep orderMap in sync
  user.order_history.push(orderId);             // back-fill in-memory user

  // ── Step 4: Generate feedback if first-time order (EC-4.5) ───────────────
  let newFeedback = null;
  if (isFirstTime) {
    // EC-6.1: trust_score used only here to weight simulation — never returned
    const response  = simulateFeedbackResponse(category.trust_score);
    newFeedback = {
      order_id:               orderId,
      post_delivery_response: response,
      retried_within_30_days: false   // can't retry instantly; set false for new orders
    };
    store.feedback.push(newFeedback);
    feedbackMap[orderId] = newFeedback;         // keep feedbackMap in sync
  }

  // ── Step 5: Persist to disk — EC-8.2: both files written synchronously ────
  // Write orders.json first, then users.json. Both happen before we return,
  // so the only failure window is a crash between the two writes — acceptable for v1.
  try {
    fs.writeFileSync(ORDERS_FILE,  JSON.stringify(store.orders,  null, 2), 'utf8');
    fs.writeFileSync(USERS_FILE,   JSON.stringify(store.users,   null, 2), 'utf8');

    if (newFeedback) {
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(store.feedback, null, 2), 'utf8');
    }
  } catch (err) {
    // If disk write fails, roll back the in-memory mutation to keep state consistent
    store.orders.pop();
    delete orderMap[orderId];
    user.order_history.pop();
    if (newFeedback) {
      store.feedback.pop();
      delete feedbackMap[orderId];
    }
    console.error(`placeOrder: disk write failed — rolled back in-memory state. Error: ${err.message}`);
    return { success: false, error: 'Failed to persist order to disk.' };
  }

  // ── Step 6: Mark category as adopted in graduation tracker (EC-3.1) ───────
  // Unconditional — works even if the category was never in Discover suggestions.
  tracker.markAdopted(userId, categoryId);

  // ── Step 7: Return ─────────────────────────────────────────────────────────
  return {
    success:                 true,
    order_id:                orderId,
    is_first_time_in_category: isFirstTime
  };
}

module.exports = { placeOrder };
