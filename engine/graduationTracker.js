/**
 * engine/graduationTracker.js
 * Tracks per-user adoption and dismissal state for Discover suggestions.
 *
 * State is held in memory and persisted synchronously to data/graduation_state.json
 * after every mutating operation.
 *
 * State shape (per user):
 * {
 *   "u_001": {
 *     "adopted":     ["cat_03", "cat_07"],   // ordered from via Discover
 *     "dismissed":   ["cat_12"],             // seen >= DISMISSAL_THRESHOLD times, never tapped
 *     "view_counts": { "cat_05": 2 }         // times each category has been shown in Discover
 *   }
 * }
 *
 * Edge-case awareness:
 *   EC-3.1  — markAdopted works even if category was never in view_counts.
 *   EC-3.2  — Adoption removes from view_counts, ensuring dismissal cannot also fire.
 *   EC-3.3  — markAdopted removes from dismissed before adding to adopted (no dual membership).
 *   EC-3.4  — recordSuggestionView only increments for categories in the actual rendered list.
 *   EC-3.5  — Missing graduation_state.json handled in store.js (initialises to {}).
 *   EC-11.1 — Corrupted graduation_state.json handled in store.js (resets to {}).
 *   EC-11.3 — Stale user keys from old datasets are harmless (they simply have no effect).
 */

'use strict';

const store = require('./store');

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Get (or lazily initialise) the state object for a specific user.
 */
function getUserState(userId) {
  if (!store.graduationState[userId]) {
    store.graduationState[userId] = {
      adopted:     [],
      dismissed:   [],
      view_counts: {}
    };
  }
  return store.graduationState[userId];
}

/**
 * Persist the current in-memory graduation state to disk.
 */
function persist() {
  store.saveGraduationState(store.graduationState);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Increment view_count for each category in the rendered suggestion list.
 * EC-3.4: Only increments for IDs actually present in categoryIds (the rendered list).
 *
 * @param {string}   userId
 * @param {string[]} categoryIds - IDs of categories that were actually rendered.
 */
function recordSuggestionView(userId, categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return;

  const state = getUserState(userId);

  for (const catId of categoryIds) {
    state.view_counts[catId] = (state.view_counts[catId] ?? 0) + 1;
  }

  persist();
}

/**
 * Mark a category as adopted (user ordered from it).
 * EC-3.1: Works even if category was never shown in Discover (e.g., ordered via Home).
 * EC-3.2: Removes from view_counts so dismissal cannot fire for an adopted category.
 * EC-3.3: Removes from dismissed (if present) before adding to adopted — no dual membership.
 *
 * @param {string} userId
 * @param {string} categoryId
 */
function markAdopted(userId, categoryId) {
  const state = getUserState(userId);

  // EC-3.3: remove from dismissed first
  state.dismissed = state.dismissed.filter(id => id !== categoryId);

  // Add to adopted (idempotent — avoid duplicates)
  if (!state.adopted.includes(categoryId)) {
    state.adopted.push(categoryId);
  }

  // EC-3.2: remove from view_counts so checkDismissal cannot also fire
  delete state.view_counts[categoryId];

  persist();
}

/**
 * Check all tracked categories for this user and move any that have reached
 * DISMISSAL_THRESHOLD views (without being adopted) into the dismissed set.
 * Called by the API layer immediately after recordSuggestionView.
 *
 * @param {string} userId
 */
function checkDismissal(userId) {
  const { DISMISSAL_THRESHOLD } = store;
  const state = getUserState(userId);
  let changed = false;

  for (const [catId, count] of Object.entries(state.view_counts)) {
    if (count >= DISMISSAL_THRESHOLD) {
      // Move to dismissed
      if (!state.dismissed.includes(catId)) {
        state.dismissed.push(catId);
      }
      // Remove from view_counts
      delete state.view_counts[catId];
      changed = true;
    }
  }

  if (changed) persist();
}

/**
 * Returns the set of category IDs that should be excluded from Discover suggestions
 * for this user — the union of adopted and dismissed categories.
 * Called by adjacencyResolver before computing candidates.
 *
 * @param {string} userId
 * @returns {Set<string>}
 */
function getExcludedCategories(userId) {
  const state = getUserState(userId);
  return new Set([...state.adopted, ...state.dismissed]);
}

/**
 * Load (or re-load) the graduation state for a specific user from disk.
 * Useful when switching demo users mid-session (EC-8.3).
 * Reloads the full state file and returns the state for the requested user.
 *
 * @param {string} userId
 * @returns {{ adopted: string[], dismissed: string[], view_counts: object }}
 */
function loadStateForUser(userId) {
  // Reload from disk to ensure we have the latest state
  store.graduationState = store.loadGraduationState();
  return getUserState(userId);
}

/**
 * Returns a read-only snapshot of a user's graduation state (for UI/debugging).
 *
 * @param {string} userId
 * @returns {{ adopted: string[], dismissed: string[], view_counts: object }}
 */
function getStateSnapshot(userId) {
  return getUserState(userId);
}

module.exports = {
  recordSuggestionView,
  markAdopted,
  checkDismissal,
  getExcludedCategories,
  loadStateForUser,
  getStateSnapshot
};
