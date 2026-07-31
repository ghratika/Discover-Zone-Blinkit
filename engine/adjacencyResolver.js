/**
 * engine/adjacencyResolver.js
 * Core personalised recommendation algorithm.
 * Triggered when user.order_history.length >= 2.
 *
 * Scoring: Jaccard co_occurrence_score accumulated across all of the user's tried
 * categories, with trust_score as a secondary tiebreaker (backend-only).
 *
 * Edge-case awareness:
 *   EC-2.1  — Returns [] when no candidates survive all filters → API returns "exhausted".
 *   EC-2.2  — All pairs below sample threshold → same: returns [].
 *   EC-2.3  — adjacencyIndex[C_i] may be undefined → guarded with ?? [].
 *   EC-2.4  — Fewer than MAX_SUGGESTIONS candidates → slice handles this naturally.
 *   EC-2.5  — Multi-pathway categories accumulate (sum) Jaccard scores, not average.
 *   EC-2.6  — Jaccard = 0.0 with sample_size >= threshold still passes — ranks last.
 *   EC-6.1  — trust_score stripped via explicit destructuring before return.
 *   EC-8.1  — order_history IDs not found in orderMap are skipped safely.
 *   EC-12.1 — MIN_SAMPLE_THRESHOLD is inclusive (>=), not strict (>).
 *   EC-12.4 — Result sliced to MAX_SUGGESTIONS before return.
 */

'use strict';

const store = require('./store');

/**
 * Returns up to MAX_SUGGESTIONS personalised category suggestions for a user.
 *
 * @param {string}   userId              - The user's ID.
 * @param {Set<string>} excludedCategoryIds - Categories already adopted or dismissed
 *                                           (from graduationTracker.getExcludedCategories).
 * @returns {Array<{ category_id: string, category_name: string, sample_review_snippet: string }>}
 */
function getPersonalisedSuggestions(userId, excludedCategoryIds = new Set()) {
  const {
    userMap,
    orderMap,
    categoryMap,
    adjacencyIndex,
    MIN_SAMPLE_THRESHOLD,
    MAX_SUGGESTIONS
  } = store;

  const user = userMap[userId];
  if (!user) {
    console.warn(`adjacencyResolver: unknown userId "${userId}"`);
    return [];
  }

  // ── Step 1: Resolve tried category IDs from order_history ─────────────────
  // EC-8.1: skip any order_id that doesn't exist in orderMap (stale reference guard)
  const triedCategoryIds = new Set();
  for (const orderId of user.order_history) {
    const order = orderMap[orderId] ?? null;  // EC-8.1
    if (order) triedCategoryIds.add(order.category_id);
  }

  // ── Step 2: Accumulate Jaccard scores for candidate categories ─────────────
  // candidateScores: category_id → accumulated co_occurrence_score (sum, not average — EC-2.5)
  const candidateScores = {};

  for (const triedCatId of triedCategoryIds) {
    // EC-2.3: adjacencyIndex key may be absent for orphan categories → use ?? []
    const rows = adjacencyIndex[triedCatId] ?? [];

    for (const row of rows) {
      const targetId = row.target_category_id;

      // Filter: already tried
      if (triedCategoryIds.has(targetId)) continue;

      // Filter: adopted or dismissed (from graduation tracker)
      if (excludedCategoryIds.has(targetId)) continue;

      // Filter: EC-12.1 — inclusive >= threshold (D1 = 10)
      if (row.sample_size < MIN_SAMPLE_THRESHOLD) continue;

      // Accumulate (sum) — EC-2.5
      candidateScores[targetId] = (candidateScores[targetId] ?? 0) + row.co_occurrence_score;
    }
  }

  // ── Step 3: Convert to array and join with categoryMap for trust_score ─────
  const candidates = Object.entries(candidateScores).map(([catId, jaccardSum]) => {
    const cat = categoryMap[catId];
    return {
      category_id:   catId,
      jaccard_sum:   jaccardSum,
      trust_score:   cat ? cat.trust_score : 0,   // backend-only — stripped before return
      category_name: cat ? cat.category_name : catId,
      sample_review_snippet: cat
        ? (cat.sample_review_snippet ?? 'Highly rated by buyers')   // EC-6.3 fallback
        : 'Highly rated by buyers'
    };
  });

  // ── Step 4: Sort — PRIMARY: jaccard_sum DESC, SECONDARY: trust_score DESC ──
  candidates.sort((a, b) => {
    if (b.jaccard_sum !== a.jaccard_sum) return b.jaccard_sum - a.jaccard_sum;
    return b.trust_score - a.trust_score;
  });

  // ── Step 5: Slice to MAX_SUGGESTIONS (EC-12.4) ────────────────────────────
  const top = candidates.slice(0, MAX_SUGGESTIONS);

  // ── Step 6: Return SAFE payload — strip trust_score (EC-6.1) ──────────────
  return top.map(({ category_id, category_name, sample_review_snippet }) => ({
    category_id,
    category_name,
    sample_review_snippet
  }));
}

module.exports = { getPersonalisedSuggestions };
