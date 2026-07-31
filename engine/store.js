/**
 * engine/store.js
 * In-Memory Data Store — loaded once at startup, shared across all engine modules.
 *
 * Edge-case awareness:
 *   EC-3.5  — graduation_state.json may not exist on first run.
 *             Handled here: file is read safely with existsSync; falls back to {}.
 *   EC-2.3  — adjacencyIndex[catId] may be undefined for orphan categories.
 *             Consumers must use `adjacencyIndex[id] ?? []` — documented in exports.
 *   EC-11.1 — graduation_state.json may be corrupted.
 *             JSON.parse is wrapped in try/catch; falls back to {} on parse error.
 *
 * IMPORTANT: store.js must NEVER be imported by any file inside ui/.
 * The API layer (api/) is the only boundary that the frontend touches.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Resolved design decisions (D1–D3) ───────────────────────────────────────
const MIN_SAMPLE_THRESHOLD = 10;   // D1: adjacency pairs below this sample_size are discarded
const MAX_SUGGESTIONS      = 3;    // D2: max suggestions shown per Discover load
const DISMISSAL_THRESHOLD  = 10;    // D3: views without a tap before a category is dismissed

// ─── File paths ───────────────────────────────────────────────────────────────
const DATA_DIR              = path.join(__dirname, '..', 'data');
const GRADUATION_STATE_FILE = process.env.VERCEL ? path.join('/tmp', 'graduation_state.json') : path.join(DATA_DIR, 'graduation_state.json');
// ─── Core data (loaded synchronously at module load) ─────────────────────────
const users             = require('../data/users.json');
const categories        = require('../data/categories.json');
const orders            = require('../data/orders.json');
const categoryAdjacency = require('../data/category_adjacency.json');
const feedback          = require('../data/feedback.json');

// ─── O(1) lookup maps ─────────────────────────────────────────────────────────
/** user_id → User object */
const userMap     = Object.fromEntries(users.map(u => [u.user_id, u]));

/**
 * category_id → Category object (contains trust_score — backend only).
 * EC-6.1: categoryMap must NEVER be spread into a response payload.
 * Always destructure only the safe fields: { category_id, category_name, sample_review_snippet }.
 */
const categoryMap = Object.fromEntries(categories.map(c => [c.category_id, c]));

/**
 * order_id → Order object.
 * EC-8.1: orderMap is the authoritative source; order_history IDs not present here
 * must be skipped with a guard (orderMap[id] ?? null).
 */
const orderMap    = Object.fromEntries(orders.map(o => [o.order_id, o]));

/**
 * order_id → Feedback object.
 */
const feedbackMap = Object.fromEntries(feedback.map(f => [f.order_id, f]));

/**
 * source_category_id → Array<AdjacencyRow>
 * EC-2.3: If a category has no outgoing adjacency rows, the key will be absent.
 * Consumers MUST use `adjacencyIndex[id] ?? []` — never `adjacencyIndex[id].forEach(...)` directly.
 */
const adjacencyIndex = {};
for (const row of categoryAdjacency) {
  if (!adjacencyIndex[row.source_category_id]) {
    adjacencyIndex[row.source_category_id] = [];
  }
  adjacencyIndex[row.source_category_id].push(row);
}

// ─── Graduation state (mutable, persisted to JSON) ────────────────────────────

/**
 * Load graduation state from disk.
 * EC-3.5: File may not exist on first run → initialise to {}.
 * EC-11.1: File may be corrupted → catch JSON.parse errors, reset to {}.
 */
function loadGraduationState() {
  if (!fs.existsSync(GRADUATION_STATE_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(GRADUATION_STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`⚠️  graduation_state.json is corrupted or unreadable. Resetting to {}.`);
    console.warn(`    Reason: ${err.message}`);
    return {};
  }
}

/**
 * Persist graduation state to disk synchronously.
 * Using writeFileSync keeps the write atomic for v1 (single-threaded Node).
 */
function saveGraduationState(state) {
  fs.writeFileSync(GRADUATION_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// Load once at module initialisation
let graduationState = loadGraduationState();

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Raw arrays (read-only; do not mutate these in place)
  users,
  categories,
  orders,
  categoryAdjacency,
  feedback,

  // Lookup maps
  userMap,
  categoryMap,   // WARNING: contains trust_score — never spread into API responses (EC-6.1)
  orderMap,
  feedbackMap,
  adjacencyIndex, // WARNING: key may be absent for orphan categories — use ?? [] (EC-2.3)

  // Resolved constants
  MIN_SAMPLE_THRESHOLD,
  MAX_SUGGESTIONS,
  DISMISSAL_THRESHOLD,

  // Graduation state helpers
  DATA_DIR,
  GRADUATION_STATE_FILE,
  loadGraduationState,
  saveGraduationState,
  get graduationState()  { return graduationState; },
  set graduationState(s) { graduationState = s; }
};
