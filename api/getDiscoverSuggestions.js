/**
 * api/getDiscoverSuggestions.js
 * Phase 3 — API Bridge, entry point 1.
 *
 * The ONLY function the frontend calls to populate the Discover tab.
 * This is the trust_score exclusion boundary — nothing in this module's
 * return value ever contains trust_score (EC-6.1).
 *
 * Returns:
 *   {
 *     mode: "cold_start" | "personalised" | "exhausted",
 *     suggestions: Array<{ category_id, category_name, sample_review_snippet }>
 *   }
 *
 * Edge-case awareness:
 *   EC-1.2  — Boundary is strictly < 2 for cold_start; >= 2 triggers personalised.
 *   EC-1.3  — Mode is re-evaluated on every call; never cached between tab loads.
 *   EC-2.1  — Empty resolver result → mode = "exhausted".
 *   EC-6.1  — trust_score contract: both engine handlers already strip it; this
 *             layer adds a final defensive check before returning.
 *   EC-12.4 — Suggestions are capped at MAX_SUGGESTIONS even if engine returns more.
 *   EC-9.2  — recordSuggestionView + checkDismissal are called synchronously so that
 *             the state is up-to-date for the next Discover tab load.
 */

'use strict';

const store          = require('../engine/store');
const coldStart      = require('../engine/coldStartHandler');
const resolver       = require('../engine/adjacencyResolver');
const tracker        = require('../engine/graduationTracker');

/**
 * Get Discover suggestions for a user.
 *
 * @param {string} userId
 * @returns {{ mode: string, suggestions: Array }}
 */
function getDiscoverSuggestions(userId) {
  const { userMap, MAX_SUGGESTIONS } = store;

  // ── Step 1: Validate user ─────────────────────────────────────────────────
  const user = userMap[userId];
  if (!user) {
    console.warn(`getDiscoverSuggestions: unknown userId "${userId}"`);
    return { mode: 'error', suggestions: [], error: `User "${userId}" not found.` };
  }

  // ── Step 2: Get excluded categories (adopted + dismissed) ─────────────────
  const excluded   = tracker.getExcludedCategories(userId);
  const orderCount = user.order_history.length;

  // ── Step 3: Route to correct handler (EC-1.2 — strictly < 2) ─────────────
  let suggestions;
  let mode;

  if (orderCount < 2) {
    suggestions = coldStart.getColdStartSuggestions();
    mode        = 'cold_start';
  } else {
    suggestions = resolver.getPersonalisedSuggestions(userId, excluded);
    mode        = suggestions.length > 0 ? 'personalised' : 'exhausted';
  }

  // ── Step 4: Enforce MAX_SUGGESTIONS cap (EC-12.4) ─────────────────────────
  suggestions = suggestions.slice(0, MAX_SUGGESTIONS);

  // ── Step 5: Final defensive trust_score strip (EC-6.1) ────────────────────
  // Engine handlers already strip it, but this is an extra safety net at the
  // API boundary — the last line of defence before data reaches the frontend.
  suggestions = suggestions.map(({ category_id, category_name, sample_review_snippet }) => ({
    category_id,
    category_name,
    sample_review_snippet: sample_review_snippet ?? 'Highly rated by buyers'
  }));

  // ── Step 6: Record view + check dismissal (EC-9.2 — synchronous) ──────────
  // Only record views when there are actual suggestions to show.
  if (suggestions.length > 0) {
    tracker.recordSuggestionView(userId, suggestions.map(s => s.category_id));
    tracker.checkDismissal(userId);
  }

  // ── Step 7: Return ─────────────────────────────────────────────────────────
  return { mode, suggestions };
}

module.exports = { getDiscoverSuggestions };
