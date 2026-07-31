/**
 * api/getCategoryDetail.js
 * Phase 3 — API Bridge, entry point 2.  (Updated: multi-product ranking)
 *
 * Returns the category header + 2-3 top products ranked by a combined
 * score of sales_velocity + rating (both derived from feedback.json).
 *
 *   rating          = avg feedback quality  (good=1, no_response=0.5, bad=0)
 *   sales_velocity  = fraction of first-time orders retried within 30 days
 *   combined_score  = rating + sales_velocity  (range 0–2, higher = better)
 *
 * The "Add" button on each product card triggers the same placeOrder flow
 * as before — the category_id is what gets adopted, not the product_id.
 *
 * Returns:
 *   {
 *     category_id,
 *     category_name,
 *     sample_review_snippet,
 *     products: [            ← 2-3 items, ranked desc by combined_score
 *       {
 *         product_id,
 *         display_name,
 *         price_display,
 *         trust_signal,
 *         rating,           ← 0-1, for UI badge/stars
 *         sales_velocity,   ← 0-1, "X% of buyers reordered"
 *         combined_score    ← 0-2, used for ranking (included for transparency)
 *       }
 *     ]
 *   }
 *   OR null if category not found.
 *
 * Edge-case awareness:
 *   EC-6.1  — trust_score never in response. rating is feedback-derived.
 *   EC-7.1  — Category with no orders → returns synthetic fallback product list.
 *   EC-7.2  — Tied combined scores → secondary sort by product_id (deterministic).
 *   EC-7.3  — Unknown category_id → returns null with a warning.
 *   EC-10.3 — no_response scored as 0.5 (neutral), not 0 (negative).
 */

'use strict';

const store = require('../engine/store');

// Feedback quality scoring (EC-10.3: no_response is neutral = 0.5)
const QUALITY_SCORE = { good: 1, bad: 0, no_response: 0.5 };

// Number of products to surface per category detail screen
const MAX_PRODUCTS = 3;

/**
 * Derive a stable pseudo-price from the product_id string.
 * Ensures the same product always shows the same price across renders.
 */
function derivePrice(productId) {
  const n = parseInt((productId ?? '').replace('p_', ''), 10) || 100;
  return `₹${49 + (n % 951)}`;  // range ₹49 – ₹999
}

/**
 * Get the category header plus 2-3 top-ranked products for the detail screen.
 *
 * @param {string} categoryId
 * @returns {object|null}
 */
function getCategoryDetail(categoryId) {
  const { categoryMap, orders, feedbackMap } = store;

  // ── Step 1: Validate category (EC-7.3) ────────────────────────────────────
  const category = categoryMap[categoryId];
  if (!category) {
    console.warn(`getCategoryDetail: unknown categoryId "${categoryId}"`);
    return null;
  }

  // ── Step 2: Find all orders for this category ──────────────────────────────
  const ordersInCategory = orders.filter(o => o.category_id === categoryId);

  // EC-7.1: No orders → return synthetic fallback product list
  if (ordersInCategory.length === 0) {
    console.warn(`getCategoryDetail: no orders for "${categoryId}" — using fallback`);
    return buildResponse(category, [buildFallbackProduct(category)]);
  }

  // ── Step 3: Aggregate per product_id ──────────────────────────────────────
  // productStats: product_id → { qualityTotal, qualityCount, retryTotal, retryCount }
  const productStats = {};

  for (const order of ordersInCategory) {
    const pid      = order.product_id;
    const fb       = feedbackMap[order.order_id];

    // Rating: average quality score (EC-10.3: no_response = 0.5)
    const qualityScore = fb
      ? (QUALITY_SCORE[fb.post_delivery_response] ?? 0.5)
      : 0.5;

    // Sales velocity: based on retried_within_30_days (only meaningful for first-time orders)
    const isRetried   = (fb && order.is_first_time_in_category) ? (fb.retried_within_30_days ? 1 : 0) : null;

    if (!productStats[pid]) {
      productStats[pid] = { qualityTotal: 0, qualityCount: 0, retryTotal: 0, retryCount: 0 };
    }
    productStats[pid].qualityTotal += qualityScore;
    productStats[pid].qualityCount += 1;
    if (isRetried !== null) {
      productStats[pid].retryTotal += isRetried;
      productStats[pid].retryCount += 1;
    }
  }

  // ── Step 4: Compute per-product scores ────────────────────────────────────
  const scoredProducts = Object.entries(productStats).map(([pid, stats]) => {
    const rating         = stats.qualityCount > 0 ? stats.qualityTotal / stats.qualityCount : 0.5;
    const sales_velocity = stats.retryCount   > 0 ? stats.retryTotal  / stats.retryCount   : 0;
    const combined_score = rating + sales_velocity;  // range 0–2

    return { product_id: pid, rating, sales_velocity, combined_score };
  });

  // ── Step 5: Sort DESC combined_score; product_id as tiebreaker (EC-7.2) ───
  scoredProducts.sort((a, b) => {
    if (b.combined_score !== a.combined_score) return b.combined_score - a.combined_score;
    return a.product_id.localeCompare(b.product_id);  // EC-7.2: deterministic
  });

  // ── Step 6: Take top MAX_PRODUCTS (2-3) ───────────────────────────────────
  const topProducts = scoredProducts.slice(0, MAX_PRODUCTS).map(p => ({
    product_id:     p.product_id,
    display_name:   `${category.category_name} — ${rankLabel(p.combined_score)}`,
    price_display:  derivePrice(p.product_id),
    trust_signal:   category.sample_review_snippet ?? 'Highly rated by buyers',
    rating:         Math.round(p.rating * 100) / 100,           // 0-1, 2dp
    sales_velocity: Math.round(p.sales_velocity * 100) / 100,   // 0-1, 2dp
    combined_score: Math.round(p.combined_score * 100) / 100    // 0-2, 2dp
    // EC-6.1: trust_score intentionally absent
  }));

  return buildResponse(category, topProducts);
}

/** Human-readable label based on combined score tier */
function rankLabel(score) {
  if (score >= 1.6) return 'Top Pick';
  if (score >= 1.0) return 'Popular Choice';
  return 'Good Value';
}

/** Build the final safe response envelope */
function buildResponse(category, products) {
  return {
    category_id:           category.category_id,
    category_name:         category.category_name,
    sample_review_snippet: category.sample_review_snippet ?? 'Highly rated by buyers',
    products               // 1-3 items; each has product_id, display_name, price_display, trust_signal, rating, sales_velocity, combined_score
    // EC-6.1: no trust_score anywhere in this object
  };
}

/** Synthetic fallback when a category has no order history (EC-7.1) */
function buildFallbackProduct(category) {
  return {
    product_id:     null,
    display_name:   `Top pick in ${category.category_name}`,
    price_display:  null,
    trust_signal:   category.sample_review_snippet ?? 'Highly rated by buyers',
    rating:         null,
    sales_velocity: null,
    combined_score: null
  };
}

module.exports = { getCategoryDetail };
