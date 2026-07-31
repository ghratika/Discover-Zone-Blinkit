# Edge Cases — Discover Zone (v1 Simulation)

> This document catalogs every known corner case across all four phases of the system: Data Generation, Engine Layer, API Bridge, and Frontend. For each case, the expected correct behavior is defined, and the failure mode if the case is not handled is described.

---

## Table of Contents

1. [Cold-Start & Order Count Boundary](#1-cold-start--order-count-boundary)
2. [Adjacency Resolver — Candidate Gaps](#2-adjacency-resolver--candidate-gaps)
3. [Graduation Tracker — Adoption & Dismissal](#3-graduation-tracker--adoption--dismissal)
4. [Data Generation Integrity](#4-data-generation-integrity)
5. [Jaccard Scoring Edge Cases](#5-jaccard-scoring-edge-cases)
6. [Trust Score Leakage](#6-trust-score-leakage)
7. [Category Detail — No Valid Product](#7-category-detail--no-valid-product)
8. [User State Consistency](#8-user-state-consistency)
9. [UI Screen State Transitions](#9-ui-screen-state-transitions)
10. [Feedback & Retry Logic](#10-feedback--retry-logic)
11. [Session & Persistence](#11-session--persistence)
12. [Boundary Values & Numeric Edge Cases](#12-boundary-values--numeric-edge-cases)

---

## 1. Cold-Start & Order Count Boundary

### EC-1.1 — User with exactly 0 orders
| Field | Detail |
|---|---|
| **Condition** | `user.order_history.length === 0` |
| **Expected** | Cold-Start Handler fires; returns 3 `is_universal_default: true` categories |
| **Failure mode** | Adjacency Resolver runs on an empty tried-set → returns random/all categories |
| **Where to guard** | `api/getDiscoverSuggestions.js` — check `< 2`, not `=== 0` |

### EC-1.2 — User with exactly 1 order
| Field | Detail |
|---|---|
| **Condition** | `user.order_history.length === 1` |
| **Expected** | Still cold-start; 1 order is not enough for adjacency personalization |
| **Failure mode** | Adjacency Resolver runs with a single source category → may return weak/noisy results if threshold is not respected |
| **Where to guard** | `api/getDiscoverSuggestions.js` — the boundary is strictly `< 2`, personalization starts at `>= 2` |

### EC-1.3 — Cold-start to personalised transition mid-session
| Field | Detail |
|---|---|
| **Condition** | User places their 2nd order during the session; Discover tab is still open |
| **Expected** | Next time Discover tab is tapped, it switches to Personalised mode |
| **Failure mode** | Mode is cached from the first load and not re-evaluated → user remains in cold-start indefinitely |
| **Where to guard** | `discoverTab.js` must call `getDiscoverSuggestions()` fresh on every tab activation, not cache the mode |

### EC-1.4 — Fewer than 3 universal default categories exist
| Field | Detail |
|---|---|
| **Condition** | `categories.json` has fewer than 3 entries with `is_universal_default: true` |
| **Expected** | Return however many exist (1 or 2); do not pad with non-default categories |
| **Failure mode** | Fallback silently pulls in non-default categories, violating the cold-start semantic |
| **Where to guard** | `coldStartHandler.js` — slice to `MAX_SUGGESTIONS` but don't error if result is shorter; UI must handle 1–3 cards gracefully |

---

## 2. Adjacency Resolver — Candidate Gaps

### EC-2.1 — User has tried all categories in the catalogue
| Field | Detail |
|---|---|
| **Condition** | `triedCategoryIds.size === total categories in categories.json` |
| **Expected** | Adjacency Resolver returns empty array; API returns `mode: "exhausted"` |
| **Failure mode** | Resolver crashes on empty candidate set or returns already-tried categories |
| **Where to guard** | `adjacencyResolver.js` — return `[]` when `candidateScores` is empty after filtering |

### EC-2.2 — All adjacent candidates are below the sample_size threshold
| Field | Detail |
|---|---|
| **Condition** | Every adjacency row for a user's tried categories has `sample_size < 10` |
| **Expected** | No candidates pass the filter → resolver returns `[]` → API returns `mode: "exhausted"` |
| **Failure mode** | Threshold is loosened silently or noisy pairings are surfaced |
| **Where to guard** | Threshold must not be dynamically lowered; always use `MIN_SAMPLE_THRESHOLD = 10` |

### EC-2.3 — User's tried category has no adjacency rows at all
| Field | Detail |
|---|---|
| **Condition** | A category the user has bought from is not a `source_category_id` in `category_adjacency.json` |
| **Expected** | That category contributes 0 candidates — not an error; other tried categories still contribute |
| **Failure mode** | `adjacencyIndex[C_i]` is `undefined` → uncaught TypeError crashes the resolver |
| **Where to guard** | `adjacencyResolver.js` — use `adjacencyIndex[C_i] ?? []` (nullish coalescing) |

### EC-2.4 — Fewer than 3 candidates pass all filters
| Field | Detail |
|---|---|
| **Condition** | After filtering tried, dismissed, and low-sample pairs, only 1 or 2 candidates remain |
| **Expected** | Return 1 or 2 suggestions; do not pad with random or tried categories |
| **Failure mode** | Code forces exactly 3 results → picks from tried or dismissed categories to fill the gap |
| **Where to guard** | `adjacencyResolver.js` — `slice(0, MAX_SUGGESTIONS)` naturally handles this; UI must render 1–3 cards |

### EC-2.5 — Multiple tried categories all point to the same candidate
| Field | Detail |
|---|---|
| **Condition** | 4 of the user's tried categories are each adjacent to "Pet Supplies" |
| **Expected** | Pet Supplies gets a high accumulated Jaccard score (summed across all source pathways); this is intentional and correct |
| **Failure mode** | Scores are averaged instead of summed → a multi-pathway category loses its ranking advantage |
| **Where to guard** | `adjacencyResolver.js` step 4 — explicitly accumulate (sum), not average |

### EC-2.6 — Jaccard score of exactly 0.0
| Field | Detail |
|---|---|
| **Condition** | A category pair has co_occurrence_score = 0 after Jaccard computation (edge of threshold) |
| **Expected** | If `sample_size >= 10`, it still passes the filter — but will rank last. Likely only happens in a tiny dataset |
| **Failure mode** | A 0.0 score causes a division by zero or NaN during sorting |
| **Where to guard** | Jaccard formula: if `union === 0` (impossible when sample_size > 0), skip the row |

---

## 3. Graduation Tracker — Adoption & Dismissal

### EC-3.1 — User adopts a category that was never in their Discover suggestions
| Field | Detail |
|---|---|
| **Condition** | `placeOrder` is called for a category_id not currently in the graduation tracker's suggestion history (e.g., user navigated directly from Home) |
| **Expected** | The order is recorded; `markAdopted` is still called — the category is now in `tried` and excluded from Discover |
| **Failure mode** | `markAdopted` skips categories not in `view_counts` → category re-appears in future Discover suggestions |
| **Where to guard** | `graduationTracker.markAdopted` — add to `adopted` set unconditionally; don't require it to have been in `view_counts` |

### EC-3.2 — Dismissal count reset after adoption
| Field | Detail |
|---|---|
| **Condition** | A category has `view_counts = 2` and then the user orders from it (adopted) |
| **Expected** | Category moves to `adopted`; `view_counts` entry is removed; dismissal threshold is irrelevant |
| **Failure mode** | Both `adopted` and `dismissed` sets contain the same category → resolver behavior is unpredictable |
| **Where to guard** | `markAdopted` must remove the category from `view_counts` AND ensure it is not in `dismissed` |

### EC-3.3 — Same category dismissed and then somehow ordered
| Field | Detail |
|---|---|
| **Condition** | Category is in `dismissed` state; user orders from it via Home tab (not Discover) |
| **Expected** | Move category from `dismissed` to `adopted`; it remains excluded from Discover (still correct) |
| **Failure mode** | `dismissed` and `adopted` both contain the same ID → the union set in `getExcludedCategories` is fine, but JSON state is inconsistent |
| **Where to guard** | `markAdopted` must remove the category from `dismissed` before adding it to `adopted` |

### EC-3.4 — View count incremented for a suggestion that was never shown
| Field | Detail |
|---|---|
| **Condition** | `recordSuggestionView` is called with a category_id not in the current suggestion payload |
| **Expected** | Do not increment view_count for categories not in the actual rendered list |
| **Failure mode** | View counts inflate for categories the user never actually saw |
| **Where to guard** | `discoverTab.js` must pass only the IDs of categories that were actually rendered to `recordSuggestionView` |

### EC-3.5 — `graduation_state.json` does not exist on first run
| Field | Detail |
|---|---|
| **Condition** | App starts for the first time; `data/graduation_state.json` has not been created yet |
| **Expected** | `graduationTracker` initializes an empty state object `{}` and creates the file on first write |
| **Failure mode** | `require('../data/graduation_state.json')` throws `MODULE_NOT_FOUND` → app crashes on startup |
| **Where to guard** | Use `fs.existsSync` check before loading; fall back to `{}` if file doesn't exist |

---

## 4. Data Generation Integrity

### EC-4.1 — User generated with 0 orders (all cold-start users)
| Field | Detail |
|---|---|
| **Condition** | The generator creates a user but assigns them 0 orders in the random range |
| **Expected** | User is valid; they will see cold-start on Discover tab |
| **Failure mode** | `order_history: []` causes the Adjacency Resolver to crash (rather than delegating to Cold-Start) |
| **Note** | At least 30 such users must exist per the plan — this is intentional |

### EC-4.2 — `is_first_time_in_category` flag computed incorrectly
| Field | Detail |
|---|---|
| **Condition** | Two orders for the same user + category are generated; both get `is_first_time_in_category: true` |
| **Expected** | Only the earliest order (by timestamp) gets `true`; all subsequent orders get `false` |
| **Failure mode** | Duplicate flags → `feedback.json` gets duplicate records for the same category trial → inflated feedback quality scores |
| **Where to guard** | `generate_orders.js` — maintain a `Set<category_id>` per user during generation; flag only the first encounter |

### EC-4.3 — Category with no users who bought it (orphan category)
| Field | Detail |
|---|---|
| **Condition** | A category exists in `categories.json` but appears in 0 orders (possible if archetype weights are uneven) |
| **Expected** | Orphan category has no adjacency rows and no feedback records — safe; it simply never surfaces in suggestions |
| **Failure mode** | Adjacency derivation includes this category → Jaccard denominator = 0 → division by zero |
| **Where to guard** | `derive_adjacency.js` — skip any category where `users_with_A.size === 0` or `union === 0` |

### EC-4.4 — All users have tried all categories
| Field | Detail |
|---|---|
| **Condition** | Small dataset with too many orders per user relative to the number of categories |
| **Expected** | Every user lands in `mode: "exhausted"` immediately; the Discover tab always shows the empty state |
| **Failure mode** | The simulation is useless for demonstrating the feature |
| **Where to guard** | `generate_orders.js` — cap the number of distinct categories per user to `total_categories - 4` at most, ensuring at least a few untried categories remain |

### EC-4.5 — Feedback generated for a non-first-time order
| Field | Detail |
|---|---|
| **Condition** | `generate_feedback.js` accidentally generates a feedback record for an order where `is_first_time_in_category: false` |
| **Expected** | Only orders with `is_first_time_in_category: true` get a feedback record |
| **Failure mode** | Category trust quality computation is skewed by repeat orders |
| **Where to guard** | `generate_feedback.js` — filter `orders.filter(o => o.is_first_time_in_category === true)` before iterating |

---

## 5. Jaccard Scoring Edge Cases

### EC-5.1 — Two categories bought by only 1 shared user
| Field | Detail |
|---|---|
| **Condition** | `|users_with_both| = 1`, `|union| = 3` → Jaccard = 0.33, `sample_size = 1` |
| **Expected** | Discarded — `sample_size < MIN_SAMPLE_THRESHOLD (10)` |
| **Failure mode** | Pair survives filtering → a single user's behavior drives a recommendation for all |

### EC-5.2 — Two extremely popular categories (both bought by almost all users)
| Field | Detail |
|---|---|
| **Condition** | "Groceries" and "Snacks" bought by 280/300 users each; `intersection = 270`, `union = 290` |
| **Expected** | Jaccard = 270/290 ≈ 0.93 (high — correct, they are genuinely co-purchased) |
| **Failure mode** | Without Jaccard normalization (raw count only), these dominate all rankings regardless of true affinity |
| **Note** | This is precisely why Jaccard was chosen over raw count — no additional guard needed, the formula handles it |

### EC-5.3 — Adjacency row stored with `source_category_id === target_category_id`
| Field | Detail |
|---|---|
| **Condition** | A self-pair (A→A) is accidentally written to `category_adjacency.json` |
| **Expected** | Never appears in suggestions (already-tried filter would catch it), but should be excluded at source |
| **Failure mode** | Self-pair survives → category appears as "new" even though user already bought from it |
| **Where to guard** | `derive_adjacency.js` — `if (catA === catB) continue` during pair generation |

---

## 6. Trust Score Leakage

### EC-6.1 — `trust_score` accidentally included in API response
| Field | Detail |
|---|---|
| **Condition** | A spread operator (`...categoryMap[id]`) is used instead of explicit field selection |
| **Expected** | Only `{ category_id, category_name, sample_review_snippet }` in the payload |
| **Failure mode** | `trust_score` is exposed to the frontend; UI could inadvertently display it |
| **Where to guard** | Both `coldStartHandler.js` and `adjacencyResolver.js` must use explicit destructuring — never spread the full category object |

### EC-6.2 — Frontend developer accesses raw category store directly
| Field | Detail |
|---|---|
| **Condition** | `ui/discoverTab.js` imports `engine/store.js` directly and reads `categoryMap[id].trust_score` |
| **Expected** | Frontend only calls `api/getDiscoverSuggestions.js` — it never touches `engine/store.js` |
| **Failure mode** | Trust score displayed in the UI, violating the core design constraint |
| **Where to guard** | `engine/store.js` should not be imported by any file in `ui/` — enforce by convention and code review |

### EC-6.3 — `sample_review_snippet` is null or missing for a category
| Field | Detail |
|---|---|
| **Condition** | A category in `categories.json` has `"sample_review_snippet": null` or the field is absent |
| **Expected** | Trust chip renders a fallback string (e.g., "Highly rated by buyers") rather than crashing or showing "null" |
| **Failure mode** | UI renders an empty or broken trust chip — undermines the entire trust-signal purpose of the feature |
| **Where to guard** | `discoverTab.js` — `snippet ?? "Highly rated by buyers"` when rendering the chip |

---

## 7. Category Detail — No Valid Product

### EC-7.1 — Category has no orders at all in `orders.json`
| Field | Detail |
|---|---|
| **Condition** | `getCategoryDetail("cat_orphan")` — no orders exist for this category_id |
| **Expected** | Return a synthetic fallback product: `{ product_id: null, name: "Top pick in [Category]", price: null }` and a note that no data is available |
| **Failure mode** | `products.sort()[0]` on an empty array → `undefined` → frontend crash |
| **Where to guard** | `getCategoryDetail.js` — check `if (products.length === 0)` and return a safe fallback |

### EC-7.2 — All products in a category have equal feedback quality scores (all ties)
| Field | Detail |
|---|---|
| **Condition** | 5 products all scored 0.75 after feedback quality averaging |
| **Expected** | Pick the first product in the sorted order (stable sort); behavior is deterministic |
| **Failure mode** | Random sort order on ties → different product shown on every page load |
| **Where to guard** | Sort must be stable and use a secondary sort key (e.g., `product_id` alphabetically) as a tiebreaker |

### EC-7.3 — `getCategoryDetail` called with an invalid category_id
| Field | Detail |
|---|---|
| **Condition** | `getCategoryDetail("cat_NONEXISTENT")` |
| **Expected** | Return `null` or `{ error: "Category not found" }` |
| **Failure mode** | `categoryMap["cat_NONEXISTENT"]` is `undefined` → crash on property access |
| **Where to guard** | `getCategoryDetail.js` — early return with error object if `categoryMap[id]` is falsy |

---

## 8. User State Consistency

### EC-8.1 — `order_history` in `users.json` contains an order_id not present in `orders.json`
| Field | Detail |
|---|---|
| **Condition** | Stale reference — `order_history: ["o_99999"]` but `"o_99999"` doesn't exist in `orders.json` |
| **Expected** | Missing orders are silently skipped during tried-category derivation; a warning is logged |
| **Failure mode** | `orderMap["o_99999"]` is `undefined` → crash on `orderMap[id].category_id` |
| **Where to guard** | `adjacencyResolver.js` — `orders.filter(id => orderMap[id])` before iterating |

### EC-8.2 — `placeOrder` writes new order but app crashes before updating `users.json`
| Field | Detail |
|---|---|
| **Condition** | `orders.json` has the new order but `users.json` still has the old `order_history` |
| **Expected** | On next app restart, `orders.json` and `users.json` are inconsistent |
| **Failure mode** | Resolver misses the new order when computing tried categories → re-surfaces an already-tried category |
| **Where to guard** | For v1: write `orders.json` and `users.json` in the same synchronous block; do not yield between the two writes |

### EC-8.3 — Demo user selector switches to a user mid-session
| Field | Detail |
|---|---|
| **Condition** | User A's graduation state is loaded; user is switched to User B in the demo selector |
| **Expected** | All in-memory state (view_counts, adopted, dismissed) is flushed and reloaded for User B |
| **Failure mode** | User A's graduation state bleeds into User B's session → wrong dismissals, wrong exclusions |
| **Where to guard** | `app.js` — on user change, call `graduationTracker.loadStateForUser(newUserId)` which clears and reloads state |

---

## 9. UI Screen State Transitions

### EC-9.1 — Rapid tab switching during suggestion load
| Field | Detail |
|---|---|
| **Condition** | User taps Discover → immediately taps Home → taps Discover again before the first load resolves |
| **Expected** | Only the second load result is rendered; the first is cancelled or ignored |
| **Failure mode** | Both loads resolve; stale first result overwrites the fresh second result |
| **Where to guard** | `discoverTab.js` — use a load-generation counter; ignore responses from outdated loads |

### EC-9.2 — All 3 adopted in a single session
| Field | Detail |
|---|---|
| **Condition** | User taps "Explore" → places order on all 3 suggestions in sequence within the same session |
| **Expected** | After the third adoption, Discover tab shows the Exhausted state |
| **Failure mode** | Graduation tracker is not re-evaluated between orders → stale suggestions remain |
| **Where to guard** | `placeOrder` must call `markAdopted` synchronously; Discover tab must re-fetch on every return from Category Detail |

### EC-9.3 — "Back to Discover" pressed after session state has changed
| Field | Detail |
|---|---|
| **Condition** | User places order in Category Detail; presses Back; Discover tab has not yet re-fetched |
| **Expected** | The adopted category is absent from the freshly re-fetched suggestions |
| **Failure mode** | Discover renders the cached (pre-adoption) suggestion set → adopted category still visible |
| **Where to guard** | `categoryDetail.js` must trigger a fresh `getDiscoverSuggestions` call on navigation back, not return cached state |

### EC-9.4 — Skeleton shown indefinitely (simulated async never resolves)
| Field | Detail |
|---|---|
| **Condition** | The simulated 300ms delay in `discoverTab.js` is not cleared (e.g., `setTimeout` callback throws) |
| **Expected** | Skeleton is replaced by cards within 300–500ms |
| **Failure mode** | User sees an infinite loading skeleton |
| **Where to guard** | Wrap the suggestion fetch in a `try/catch`; on error, render a fallback error state (not an infinite skeleton) |

---

## 10. Feedback & Retry Logic

### EC-10.1 — `retried_within_30_days` computed incorrectly at dataset boundary
| Field | Detail |
|---|---|
| **Condition** | User's first-time order in a category is on `2025-06-15`; dataset ends on `2025-06-30` — only 15 days of data remain |
| **Expected** | `retried_within_30_days` is `false` if no retry appears in the 15 remaining days — this is correct; do not extrapolate |
| **Failure mode** | `retried_within_30_days` is incorrectly set to `true` for users near the dataset boundary |
| **Where to guard** | `generate_feedback.js` — check only within actual order data; no extrapolation |

### EC-10.2 — Same `order_id` appears in `feedback.json` twice
| Field | Detail |
|---|---|
| **Condition** | `generate_feedback.js` is run twice without clearing the output file |
| **Expected** | Duplicate feedback records for the same `order_id` |
| **Failure mode** | Feedback quality averaging uses duplicate records → inflated scores |
| **Where to guard** | `generate_feedback.js` must always overwrite (not append) `feedback.json` on each run |

### EC-10.3 — `post_delivery_response: "no_response"` treated as negative
| Field | Detail |
|---|---|
| **Condition** | All `no_response` records are given a quality score of 0 (same as "bad") in `getCategoryDetail` |
| **Expected** | `no_response` = 0.5 (neutral), not 0 (negative) — per the architecture spec |
| **Failure mode** | Categories with high "no_response" rates rank lower than they should → poorer product routing |
| **Where to guard** | `getCategoryDetail.js` — `score map: { good: 1, bad: 0, no_response: 0.5 }` |

---

## 11. Session & Persistence

### EC-11.1 — `graduation_state.json` becomes corrupted
| Field | Detail |
|---|---|
| **Condition** | App crashes mid-write → `graduation_state.json` contains partial/invalid JSON |
| **Expected** | On next startup, the app detects invalid JSON, logs a warning, and resets graduation state to `{}` |
| **Failure mode** | `JSON.parse` throws → app crashes on startup |
| **Where to guard** | Wrap `JSON.parse(fs.readFileSync(...))` in a `try/catch`; fall back to `{}` on parse error |

### EC-11.2 — Generator scripts run out of order
| Field | Detail |
|---|---|
| **Condition** | `derive_adjacency.js` is run before `generate_orders.js` completes |
| **Expected** | Adjacency is derived from an incomplete or empty orders set → all pairs have `sample_size = 0` → all filtered out |
| **Failure mode** | `category_adjacency.json` is written but empty → all users see cold-start forever |
| **Where to guard** | Document the required run order clearly (it is in the implementation plan); optionally add a guard: `derive_adjacency.js` should check `orders.json` record count and warn if below a minimum (e.g., 500 orders) |

### EC-11.3 — `graduation_state.json` has a stale user key for a deleted/replaced dataset
| Field | Detail |
|---|---|
| **Condition** | Generator is re-run with new user IDs; old `graduation_state.json` has keys for previous `u_001`…`u_300` |
| **Expected** | Old graduation state is irrelevant but harmless — stale user keys simply have no effect |
| **Failure mode** | New users happen to share IDs with old graduation state → carry over wrong adopted/dismissed sets |
| **Where to guard** | When regenerating the dataset, always delete `data/graduation_state.json` and let it be recreated |

---

## 12. Boundary Values & Numeric Edge Cases

### EC-12.1 — `MIN_SAMPLE_THRESHOLD` exactly met vs. just below
| Field | Detail |
|---|---|
| **Condition** | Row A: `sample_size = 10` (boundary), Row B: `sample_size = 9` (just below) |
| **Expected** | Row A passes (`>= 10`); Row B is discarded (`< 10`) |
| **Failure mode** | Off-by-one: `> 10` instead of `>= 10` → Row A is also discarded |
| **Where to guard** | `adjacencyResolver.js` — use `row.sample_size >= MIN_SAMPLE_THRESHOLD` (inclusive) |

### EC-12.2 — Jaccard score rounds to exactly 0.0000
| Field | Detail |
|---|---|
| **Condition** | `intersection = 0` (no shared users) despite both categories having many buyers |
| **Expected** | Jaccard = 0.0, `sample_size = 0` → discarded by sample threshold |
| **Failure mode** | A 0.0 pairing survives → a category with no real affinity is recommended |
| **Note** | `sample_size = 0` ensures this is always discarded by the threshold filter |

### EC-12.3 — `trust_score` outside valid range
| Field | Detail |
|---|---|
| **Condition** | A category in `categories.json` has `trust_score: 5.9` or `trust_score: -1` |
| **Expected** | The sort still works (relative ordering is preserved); behavior is technically correct |
| **Failure mode** | Code that clamps or validates trust_score may reject the record or crash |
| **Where to guard** | No clamping is necessary in v1; document that valid range is 0–5 and author accordingly |

### EC-12.4 — `MAX_SUGGESTIONS = 3` but resolver returns more
| Field | Detail |
|---|---|
| **Condition** | A bug causes `adjacencyResolver` to return 4 or more candidates |
| **Expected** | API layer enforces the cap: `suggestions.slice(0, MAX_SUGGESTIONS)` |
| **Failure mode** | UI renders 4 cards → layout breaks; more importantly, the spec violation (2–3 suggestions) is undetected |
| **Where to guard** | `api/getDiscoverSuggestions.js` — always slice to `MAX_SUGGESTIONS` regardless of what the resolver returns |

---

## Edge Case Priority Summary

| Priority | ID | Description |
|---|---|---|
| 🔴 Critical | EC-6.1 | trust_score leaks into API response via spread operator |
| 🔴 Critical | EC-3.5 | graduation_state.json missing on first run → startup crash |
| 🔴 Critical | EC-2.3 | Missing adjacency index key → uncaught TypeError in resolver |
| 🔴 Critical | EC-8.1 | Stale order_id reference in order_history → crash |
| 🟠 High | EC-1.3 | Cold-start mode cached across tab switches → stuck in cold-start |
| 🟠 High | EC-9.3 | Discover shows adopted category after returning from Category Detail |
| 🟠 High | EC-4.2 | Duplicate is_first_time_in_category flags → inflated feedback |
| 🟠 High | EC-7.1 | No orders for a category → getCategoryDetail crash |
| 🟡 Medium | EC-6.3 | Null review snippet → broken trust chip UI |
| 🟡 Medium | EC-3.3 | Category in both adopted and dismissed sets |
| 🟡 Medium | EC-11.1 | Corrupted graduation_state.json → startup crash |
| 🟡 Medium | EC-9.4 | Infinite loading skeleton on fetch error |
| 🟢 Low | EC-12.1 | Off-by-one on MIN_SAMPLE_THRESHOLD |
| 🟢 Low | EC-10.2 | Duplicate feedback records from double-run of generator |
| 🟢 Low | EC-11.3 | Stale graduation state after dataset regeneration |
