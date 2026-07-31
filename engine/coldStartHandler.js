/**
 * engine/coldStartHandler.js
 * Handles Discover suggestions for users with fewer than 2 orders.
 *
 * Returns a safe payload — trust_score is used only for internal ranking
 * and is NEVER included in the returned objects (EC-6.1).
 *
 * Edge-case awareness:
 *   EC-1.4  — Fewer than MAX_SUGGESTIONS universal defaults may exist.
 *             slice(0, MAX_SUGGESTIONS) handles this gracefully; the UI
 *             must handle 1–3 cards.
 *   EC-6.1  — trust_score is stripped via explicit destructuring before return.
 */

'use strict';

const store = require('./store');

/**
 * Returns up to MAX_SUGGESTIONS universal-default categories, ranked by
 * trust_score descending (backend-only — trust_score is never in the return value).
 *
 * @returns {Array<{ category_id: string, category_name: string, sample_review_snippet: string }>}
 */
function getColdStartSuggestions() {
  const { categories, MAX_SUGGESTIONS } = store;

  // Step 1: filter to universal defaults only
  const defaults = categories.filter(c => c.is_universal_default === true);

  // Step 2: rank by trust_score DESC (backend-only ranking — EC-6.1)
  defaults.sort((a, b) => b.trust_score - a.trust_score);

  // Step 3: slice to MAX_SUGGESTIONS
  const top = defaults.slice(0, MAX_SUGGESTIONS);

  // Step 4: return SAFE payload — explicit destructuring strips trust_score (EC-6.1)
  return top.map(({ category_id, category_name, sample_review_snippet }) => ({
    category_id,
    category_name,
    sample_review_snippet: sample_review_snippet ?? 'Highly rated by buyers'  // EC-6.3 fallback
  }));
}

module.exports = { getColdStartSuggestions };
