/**
 * generate_feedback.js
 * Step 4 of the Data Generation Pipeline.
 *
 * Reads data/orders.json and data/categories.json.
 * For every order where is_first_time_in_category === true, generates one feedback record.
 * Writes data/feedback.json (always overwrites — EC-10.2).
 *
 * Edge-case awareness:
 *   EC-4.5  — Only processes orders with is_first_time_in_category === true.
 *   EC-10.1 — retried_within_30_days uses only actual order data; no extrapolation.
 *   EC-10.2 — Always overwrites feedback.json; running twice produces no duplicates.
 *   EC-10.3 — "no_response" is neutral (0.5), not negative, matching getCategoryDetail's scoring.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR        = path.join(__dirname, '..', 'data');
const ORDERS_FILE     = path.join(DATA_DIR, 'orders.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const OUTPUT_FILE     = path.join(DATA_DIR, 'feedback.json');

const RETRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days in ms

// ─── Response distribution by trust_score tier ───────────────────────────────

/**
 * Returns a weighted random post_delivery_response.
 * High-trust categories skew positive (EC-10.3 — no_response is neutral).
 */
function sampleResponse(trustScore) {
  const r = Math.random();

  if (trustScore >= 4.0) {
    // 70% good, 10% bad, 20% no_response
    if (r < 0.70) return 'good';
    if (r < 0.80) return 'bad';
    return 'no_response';
  } else {
    // trust_score 3.0–3.9: 50% good, 25% bad, 25% no_response
    if (r < 0.50) return 'good';
    if (r < 0.75) return 'bad';
    return 'no_response';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const orders     = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));

  // Build category lookup for trust_score (backend-only — EC-6.1 note:
  // trust_score is used here only to weight the simulated response distribution;
  // it is never written into feedback.json)
  const categoryMap = Object.fromEntries(categories.map(c => [c.category_id, c]));

  // EC-4.5: only first-time orders get feedback
  const firstTimeOrders = orders.filter(o => o.is_first_time_in_category === true);

  // Build a lookup: (user_id, category_id) → sorted list of all order timestamps
  // Used to check retried_within_30_days (EC-10.1)
  const userCatOrders = {};
  for (const order of orders) {
    const key = `${order.user_id}::${order.category_id}`;
    if (!userCatOrders[key]) userCatOrders[key] = [];
    userCatOrders[key].push(new Date(order.timestamp).getTime());
  }
  // Sort all timestamps ascending
  for (const key of Object.keys(userCatOrders)) {
    userCatOrders[key].sort((a, b) => a - b);
  }

  const feedbackRecords = [];

  for (const order of firstTimeOrders) {
    const category    = categoryMap[order.category_id];
    const trustScore  = category ? category.trust_score : 3.5;

    // EC-6.1: trust_score used only here in the generator — never written to feedback.json
    const response = sampleResponse(trustScore);

    // EC-10.1: retried_within_30_days — check only actual data, no extrapolation
    const firstTimestamp = new Date(order.timestamp).getTime();
    const key            = `${order.user_id}::${order.category_id}`;
    const allTimestamps  = userCatOrders[key] || [];

    // Find any subsequent order in the same category within 30 days
    const retried = allTimestamps.some(
      ts => ts > firstTimestamp && (ts - firstTimestamp) <= RETRY_WINDOW_MS
    );

    feedbackRecords.push({
      order_id:                order.order_id,
      post_delivery_response:  response,
      retried_within_30_days:  retried
    });
  }

  // EC-10.2: Always overwrite — running this script twice produces no duplicate records
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(feedbackRecords, null, 2), 'utf8');
  console.log(`✅  Written ${feedbackRecords.length} feedback records → ${OUTPUT_FILE}`);

  // Summary stats
  const good       = feedbackRecords.filter(r => r.post_delivery_response === 'good').length;
  const bad        = feedbackRecords.filter(r => r.post_delivery_response === 'bad').length;
  const noResponse = feedbackRecords.filter(r => r.post_delivery_response === 'no_response').length;
  const retried    = feedbackRecords.filter(r => r.retried_within_30_days).length;

  console.log(`📊  Responses — good: ${good}, bad: ${bad}, no_response: ${noResponse}`);
  console.log(`📊  Retried within 30 days: ${retried} / ${feedbackRecords.length}`);
}

main();
