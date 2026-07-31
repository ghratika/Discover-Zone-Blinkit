# Implementation Plan — Discover Zone (v1 Simulation)

> **Resolved Design Decisions (locked in):**
> - **D1** — Minimum adjacency sample threshold: **10**
> - **D2** — Suggestions shown per user: **3**
> - **D3** — Dismissal threshold: **3 views with no tap**
> - **D4** — Co-occurrence scoring: **Jaccard similarity** (normalises for category popularity)
> - **D5** — Data format: **Flat JSON files** (loaded into memory at startup)
> - **D6** — Frontend: **Vanilla JS + HTML + CSS** (no framework)

---

## Overview

The build is split into **4 sequential phases**. Each phase produces a working, testable deliverable before the next phase begins. No phase depends on incomplete work from a later phase.

```
Phase 1: Data Foundation        →  seed JSON data files + generation scripts
Phase 2: Engine Layer           →  recommendation logic (no UI yet)
Phase 3: API Bridge             →  thin in-memory API wrappers
Phase 4: Frontend               →  Vanilla JS UI, all screen states
```

---

## Phase 1 — Data Foundation

**Goal:** Produce all five seed JSON files that every other phase depends on.  
**Deliverables:** `data/users.json`, `data/categories.json`, `data/orders.json`, `data/category_adjacency.json`, `data/feedback.json`

---

### 1.1 — Define the Category Catalogue (`categories.json`)

**File to create:** `data/categories.json`

Hand-author the category list (this is the one piece that is intentionally authored, not generated — categories represent real Blinkit verticals).

**Schema per record:**
```json
{
  "category_id": "cat_01",
  "category_name": "Personal Care",
  "trust_score": 4.3,
  "sample_review_snippet": "Arrived sealed and exactly as described.",
  "is_universal_default": true
}
```

**Requirements:**
- Create **15–20 categories** covering realistic Blinkit verticals:
  - Groceries, Snacks & Munchies, Beverages, Dairy & Eggs, Household Basics, Personal Care, Baby Care, Pet Supplies, Health & Wellness, Frozen Food, Fresh Vegetables, Fresh Fruits, Cleaning Supplies, Stationery, Electronics Accessories
- Assign a `trust_score` between 3.0–5.0 (float, 1 decimal).
- Write a distinct `sample_review_snippet` per category (max 12 words, buyer-voice).
- Mark **4–5 categories** as `is_universal_default: true` — these must be truly universal (Personal Care, Household Basics, Snacks, Beverages, Dairy & Eggs).
- `trust_score` must never appear in any frontend payload — it stays server-side.

---

### 1.2 — Generate Users (`generator/generate_users.js`)

**File to create:** `generator/generate_users.js`  
**Output:** `data/users.json`

**Specification:**
- Generate **300 users** (`u_001` … `u_300`).
- Assign each user one of **4 archetypes** (used only during generation, never stored):

| Archetype | Weight | Biased categories |
|---|---|---|
| Solo Professional | 30% | Snacks, Beverages, Personal Care, Health & Wellness, Frozen Food |
| Family Household | 35% | Groceries, Dairy & Eggs, Baby Care, Household Basics, Fresh Vegetables, Cleaning Supplies |
| Student | 20% | Snacks, Beverages, Stationery, Electronics Accessories, Instant/Frozen Food |
| Health-Conscious | 15% | Fresh Fruits, Fresh Vegetables, Health & Wellness, Dairy & Eggs, Beverages |

- Each user record stores only:
  ```json
  {
    "user_id": "u_001",
    "signup_date": "2024-01-15",
    "order_history": [],
    "search_history": [],
    "cart_abandons": []
  }
  ```
- `order_history` is populated in Step 1.3. Leave it as `[]` at this stage.
- `signup_date`: randomise across a 12-month window (Jan 2024 – Dec 2024).

---

### 1.3 — Generate Orders (`generator/generate_orders.js`)

**File to create:** `generator/generate_orders.js`  
**Output:** `data/orders.json` (+ back-fills `order_history` arrays in `users.json`)

**Specification:**
- For each user, generate **8–24 orders** spanning their `signup_date` to 2025-06-30.
- Use the user's archetype to weight which categories appear in their orders (archetype is read from a temporary in-memory variable during generation — not stored in `users.json`).
- Each order:
  ```json
  {
    "order_id": "o_00001",
    "user_id": "u_001",
    "category_id": "cat_03",
    "product_id": "p_017",
    "timestamp": "2024-03-10T14:22:00Z",
    "is_first_time_in_category": true
  }
  ```
- `is_first_time_in_category`: track a per-user set of seen categories; set to `true` only on the first order in that category.
- `product_id`: generate as `p_XXXX` (random 4-digit numeric). No separate products table needed for v1.
- After all orders are generated, back-fill each user's `order_history` array with the list of their `order_id` values, then rewrite `users.json`.
- Ensure **at least 30 users have fewer than 2 orders** (to exercise the cold-start path).

---

### 1.4 — Derive Category Adjacency (`generator/derive_adjacency.js`)

**File to create:** `generator/derive_adjacency.js`  
**Output:** `data/category_adjacency.json`

**Specification — Jaccard Similarity:**

For every unordered pair of categories `(A, B)`:
```
users_with_A     = set of users who bought from category A
users_with_B     = set of users who bought from category B
users_with_both  = users_with_A ∩ users_with_B

jaccard(A, B) = |users_with_both| / |users_with_A ∪ users_with_B|
sample_size   = |users_with_both|
```

**Filtering rules:**
- Discard any pair where `sample_size < 10`.
- Discard self-pairs (`A == B`).
- Store both directions: `(A→B)` and `(B→A)` as separate rows (makes lookup by `source_category_id` trivial).

**Output record schema:**
```json
{
  "source_category_id": "cat_01",
  "target_category_id": "cat_07",
  "co_occurrence_score": 0.62,
  "sample_size": 84
}
```
- `co_occurrence_score` = Jaccard value, rounded to 4 decimal places.

---

### 1.5 — Generate Feedback (`generator/generate_feedback.js`)

**File to create:** `generator/generate_feedback.js`  
**Output:** `data/feedback.json`

**Specification:**
- For every order where `is_first_time_in_category == true`, generate one feedback record.
- `post_delivery_response` distribution, weighted by the category's `trust_score`:
  - trust_score ≥ 4.0 → 70% "good", 10% "bad", 20% "no_response"
  - trust_score 3.0–3.9 → 50% "good", 25% "bad", 25% "no_response"
- `retried_within_30_days`: check whether the user has any subsequent order in the same category within 30 simulated days of the first-time order. Set `true`/`false` accordingly.

**Output record schema:**
```json
{
  "order_id": "o_00042",
  "post_delivery_response": "good",
  "retried_within_30_days": true
}
```

---

### Phase 1 Completion Checklist

- [ ] `data/categories.json` — 15–20 categories, authored, 4–5 universal defaults flagged
- [ ] `generator/generate_users.js` — runs and writes `data/users.json` (300 users)
- [ ] `generator/generate_orders.js` — runs and writes `data/orders.json`, back-fills `order_history`
- [ ] `generator/derive_adjacency.js` — runs and writes `data/category_adjacency.json` (Jaccard, sample_size ≥ 10)
- [ ] `generator/generate_feedback.js` — runs and writes `data/feedback.json`
- [ ] **Sanity check:** `category_adjacency.json` has no pairs with `sample_size < 10` and no self-pairs
- [ ] **Sanity check:** At least 30 users have `order_history.length < 2`

**Run order:**
```bash
node generator/generate_users.js
node generator/generate_orders.js
node generator/derive_adjacency.js
node generator/generate_feedback.js
```

---

## Phase 2 — Engine Layer

**Goal:** Implement the three core recommendation logic modules as pure JS functions that read from the JSON files in memory. No UI, no network.  
**Deliverables:** `engine/adjacencyResolver.js`, `engine/coldStartHandler.js`, `engine/graduationTracker.js`, `engine/store.js`

---

### 2.1 — In-Memory Data Store (`engine/store.js`)

**File to create:** `engine/store.js`

A single module that loads all JSON files once at startup and exports them as in-memory objects.

```js
// engine/store.js
const users              = require('../data/users.json');
const categories         = require('../data/categories.json');
const orders             = require('../data/orders.json');
const categoryAdjacency  = require('../data/category_adjacency.json');
const feedback           = require('../data/feedback.json');

// Build lookup maps for O(1) access
const userMap      = Object.fromEntries(users.map(u => [u.user_id, u]));
const categoryMap  = Object.fromEntries(categories.map(c => [c.category_id, c]));
const orderMap     = Object.fromEntries(orders.map(o => [o.order_id, o]));

// adjacencyIndex[source_category_id] → array of adjacency rows
const adjacencyIndex = {};
for (const row of categoryAdjacency) {
  if (!adjacencyIndex[row.source_category_id]) adjacencyIndex[row.source_category_id] = [];
  adjacencyIndex[row.source_category_id].push(row);
}

module.exports = { users, categories, orders, categoryAdjacency, feedback,
                   userMap, categoryMap, orderMap, adjacencyIndex };
```

**Constants to define in `engine/store.js`:**
```js
const MIN_SAMPLE_THRESHOLD = 10;   // D1
const MAX_SUGGESTIONS      = 3;    // D2
const DISMISSAL_THRESHOLD  = 3;    // D3
```

---

### 2.2 — Cold-Start Handler (`engine/coldStartHandler.js`)

**File to create:** `engine/coldStartHandler.js`

**Trigger condition:** `user.order_history.length < 2`

**Logic:**
```
1. Filter categories where is_universal_default == true.
2. Sort by trust_score DESC.
3. Slice top MAX_SUGGESTIONS (3).
4. Return safe payload — strip trust_score before returning:
   { category_id, category_name, sample_review_snippet }
```

**Exported function signature:**
```js
function getColdStartSuggestions() → Array<SafeCategoryObject>
```

---

### 2.3 — Adjacency Resolver (`engine/adjacencyResolver.js`)

**File to create:** `engine/adjacencyResolver.js`

**Trigger condition:** `user.order_history.length >= 2`

**Logic (Jaccard-based ranking with trust tiebreaker):**
```
1. Resolve user's full orders from orderMap using order_history IDs.
2. Build triedCategoryIds = Set of unique category_ids from those orders.
3. Also build dismissedCategoryIds from graduationTracker state (see 2.4).

4. candidateScores = {}  (category_id → accumulated Jaccard score)

5. For each triedCategoryId C_i:
     rows = adjacencyIndex[C_i] ?? []
     For each row in rows:
       if row.target_category_id IN triedCategoryIds → skip
       if row.target_category_id IN dismissedCategoryIds → skip
       if row.sample_size < MIN_SAMPLE_THRESHOLD → skip
       candidateScores[row.target_category_id] += row.co_occurrence_score

6. Convert candidateScores to array:
   candidates = [{ category_id, jaccard_sum }]

7. Join each candidate with categoryMap to get trust_score.

8. Sort candidates:
   PRIMARY:   jaccard_sum DESC
   SECONDARY: trust_score DESC  (tiebreaker)

9. Take top MAX_SUGGESTIONS (3).

10. Return safe payload (strip trust_score):
    { category_id, category_name, sample_review_snippet }
```

**Exported function signature:**
```js
function getPersonalisedSuggestions(userId, dismissedCategoryIds) → Array<SafeCategoryObject>
```

---

### 2.4 — Graduation Tracker (`engine/graduationTracker.js`)

**File to create:** `engine/graduationTracker.js`

Tracks adoption and dismissal state **per user, per session** (in-memory; persisted to a `data/graduation_state.json` file between sessions).

**State shape (per user):**
```json
{
  "u_001": {
    "adopted": ["cat_03", "cat_07"],
    "dismissed": ["cat_12"],
    "view_counts": { "cat_05": 2, "cat_09": 1 }
  }
}
```

**Operations:**

| Function | Trigger | Effect |
|---|---|---|
| `recordSuggestionView(userId, categoryIds)` | Every time Discover tab renders | Increment `view_counts` for each shown category |
| `markAdopted(userId, categoryId)` | User places an order in a suggested category | Add to `adopted`, remove from `view_counts` |
| `checkDismissal(userId)` | After `recordSuggestionView` | Move any category with `view_counts >= DISMISSAL_THRESHOLD (3)` to `dismissed` |
| `getExcludedCategories(userId)` | Called by Adjacency Resolver | Returns `Set(adopted ∪ dismissed)` for that user |

**Persistence:** Read from / write to `data/graduation_state.json` on every mutating call (simple `fs.writeFileSync` for v1).

---

### Phase 2 Completion Checklist

- [ ] `engine/store.js` — loads all JSON, builds lookup maps, exports constants
- [ ] `engine/coldStartHandler.js` — returns 3 universal defaults, no trust_score in payload
- [ ] `engine/adjacencyResolver.js` — Jaccard ranking + trust tiebreaker, excludes tried + dismissed categories
- [ ] `engine/graduationTracker.js` — view counting, adoption marking, dismissal at threshold 3, state persisted to JSON
- [ ] **Unit test (manual):** Call `getPersonalisedSuggestions("u_001")` in Node REPL — confirm returned objects have no `trust_score` field
- [ ] **Unit test (manual):** Call `getColdStartSuggestions()` — confirm only `is_universal_default: true` categories returned
- [ ] **Invariant check:** No suggestion returned by either handler is in the user's `order_history` categories

---

## Phase 3 — API Bridge

**Goal:** Thin wrapper functions that the frontend will call. These translate frontend requests into engine calls and enforce the `trust_score` exclusion contract at the boundary.  
**Deliverables:** `api/getDiscoverSuggestions.js`, `api/getCategoryDetail.js`, `api/placeOrder.js`

---

### 3.1 — `getDiscoverSuggestions` (`api/getDiscoverSuggestions.js`)

**Function signature:**
```js
function getDiscoverSuggestions(userId) → {
  mode: "cold_start" | "personalised" | "exhausted",
  suggestions: Array<{ category_id, category_name, sample_review_snippet }>
}
```

**Logic:**
```
1. Load user from userMap.
2. Get excluded = graduationTracker.getExcludedCategories(userId).
3. orderCount = user.order_history.length.

4. if orderCount < 2:
     suggestions = coldStartHandler.getColdStartSuggestions()
     mode = "cold_start"
   else:
     suggestions = adjacencyResolver.getPersonalisedSuggestions(userId, excluded)
     mode = suggestions.length > 0 ? "personalised" : "exhausted"

5. graduationTracker.recordSuggestionView(userId, suggestions.map(s => s.category_id))
6. graduationTracker.checkDismissal(userId)

7. Return { mode, suggestions }
   ← NEVER include trust_score in suggestions array
```

---

### 3.2 — `getCategoryDetail` (`api/getCategoryDetail.js`)  *(Updated)*

**Function signature:**
```js
function getCategoryDetail(categoryId) → {
  category_id,
  category_name,
  sample_review_snippet,
  products: [   // 2-3 items, ranked DESC by combined_score
    {
      product_id,
      display_name,
      price_display,
      trust_signal,
      rating,          // 0-1 (feedback quality avg)
      sales_velocity,  // 0-1 (retried_within_30_days rate)
      combined_score   // 0-2 (rating + sales_velocity)
    }
  ]
}
```

**Ranking logic:**
```
rating         = avg({ good:1, no_response:0.5, bad:0 }) across all orders for that product
sales_velocity = fraction of first-time orders for that product where retried_within_30_days = true
combined_score = rating + sales_velocity   ← PRIMARY sort key (DESC)
tiebreaker     = product_id alphabetical   ← ensures deterministic order on ties (EC-7.2)
```

**Logic:**
```
1. Find all orders for this category_id.
2. For each unique product_id:
     a. Compute rating         (quality avg over all orders for this product)
     b. Compute sales_velocity (retry rate for first-time orders only)
     c. Compute combined_score = rating + sales_velocity
3. Sort DESC by combined_score; product_id as deterministic tiebreaker.
4. Slice top MAX_PRODUCTS (3).
5. Return safe payload per product — trust_score excluded (EC-6.1).
   trust_signal is the category's sample_review_snippet.
```

**UI contract:** Each product in `products[]` gets its own ADD button.
Tapping ADD calls `placeOrder(currentUserId, categoryId)` — the category_id
is what gets adopted (not the product_id); placeOrder is unchanged.

---

### 3.3 — `placeOrder` (`api/placeOrder.js`)

Simulates a user placing an order (for the "Add to Cart → Order" simulation in the UI).

**Function signature:**
```js
function placeOrder(userId, categoryId) → { success: true, order_id }
```

**Logic:**
```
1. Generate new order_id.
2. Determine is_first_time_in_category (check user's existing order_history).
3. Append new order to orders array + rewrite orders.json.
4. Append order_id to user.order_history + rewrite users.json.
5. If is_first_time_in_category: generate feedback record + append to feedback.json.
6. Call graduationTracker.markAdopted(userId, categoryId).
7. Return { success: true, order_id }.
```

---

### Phase 3 Completion Checklist

- [ ] `api/getDiscoverSuggestions.js` — returns `{ mode, suggestions }`, no `trust_score` ever in payload
- [ ] `api/getCategoryDetail.js` — returns top product derived from feedback quality, not random
- [ ] `api/placeOrder.js` — appends to JSON files, triggers graduation tracker
- [ ] **Contract check:** `Object.keys(suggestions[0])` must NOT contain `trust_score`
- [ ] **Integration test (manual):** Simulate 2 orders for a cold-start user → call `getDiscoverSuggestions` again → confirm mode switches to `"personalised"`

---

## Phase 4 — Frontend

**Goal:** Build the full Vanilla JS UI with all four screen states.  
**Deliverables:** `ui/index.html`, `ui/styles.css`, `ui/app.js`, `ui/discoverTab.js`, `ui/categoryDetail.js`

---

### 4.1 — Shell & Navigation (`ui/index.html` + `ui/app.js`)

**`index.html` structure:**
```html
<body>
  <div id="screen-container">
    <!-- active screen renders here -->
  </div>
  <nav id="bottom-nav">
    <button id="nav-home">🏠 Home</button>
    <button id="nav-discover">🔍 Discover</button>
    <button id="nav-cart">🛒 Cart</button>
    <button id="nav-profile">👤 Profile</button>
  </nav>
</body>
```

**`app.js` responsibilities:**
- Maintains `currentUserId` (for v1: a user selector or hardcoded demo user, switchable via a dropdown for demo purposes).
- Routes between screens: `renderHomeScreen()`, `renderDiscoverScreen()`, `renderCartScreen()`.
- Highlights the active nav tab.
- Exposes `window.app` as the central state object.

---

### 4.2 — Discover Tab (`ui/discoverTab.js`)

**Four screen states to implement:**

#### State 1: Loading
```html
<div class="discover-screen">
  <h2>Discover</h2>
  <div class="card skeleton"></div>
  <div class="card skeleton"></div>
  <div class="card skeleton"></div>
</div>
```
Show for ≥ 300ms (simulate async) before rendering real cards.

#### State 2: Cold-Start
```html
<div class="discover-screen cold-start">
  <h2>Discover</h2>
  <p class="subtitle">Popular categories to get you started</p>
  <!-- 3 × DiscoverCard -->
</div>
```

#### State 3: Personalised
```html
<div class="discover-screen personalised">
  <h2>Discover</h2>
  <p class="subtitle">Categories picked just for you</p>
  <!-- 3 × DiscoverCard -->
</div>
```

#### State 4: Exhausted (All Adopted/Dismissed)
```html
<div class="discover-screen exhausted">
  <h2>Discover</h2>
  <div class="empty-state">
    <span class="empty-icon">🎉</span>
    <p>You've explored everything we had for now — check back soon.</p>
  </div>
</div>
```

**DiscoverCard component (rendered per suggestion):**
```html
<div class="discover-card" data-category-id="cat_07">
  <div class="card-icon"><!-- category emoji or icon --></div>
  <div class="card-content">
    <h3 class="card-title">Pet Supplies</h3>
    <p class="trust-chip">"Great quality, arrived the same day."</p>
  </div>
  <button class="card-cta">Explore Pet Supplies →</button>
</div>
```

- `trust-chip` renders `sample_review_snippet` — **no trust score displayed**.
- Tapping "Explore" navigates to Category Detail screen.

---

### 4.3 — Category Detail Screen (`ui/categoryDetail.js`)  *(Updated)*

Shows **2-3 products** per category, each ranked by `combined_score = rating + sales_velocity`.
Every product card has its own **ADD** button wired to `placeOrder`.

```html
<div class="category-detail-screen">
  <button id="back-to-discover">← Back to Discover</button>
  <h2 class="category-name">Pet Supplies</h2>
  <p class="category-trust-chip">"Great quality, arrived the same day."</p>

  <!-- Rendered once per product in getCategoryDetail().products -->
  <div class="product-card" data-product-id="p_0423">
    <div class="product-card-header">
      <span class="product-rank-badge">Top Pick</span>
    </div>
    <h3 class="product-name">Pet Supplies — Top Pick</h3>
    <p class="product-price">₹499</p>
    <div class="product-meta">
      <span class="meta-rating">⭐ 92% rated good</span>
      <span class="meta-velocity">🔁 68% reordered</span>
    </div>
    <button class="add-btn" data-category-id="cat_08">ADD</button>
  </div>

  <!-- …repeat for 2nd and 3rd product cards -->
</div>
```

**ADD button flow (same `placeOrder` call as before):**
1. User taps ADD on any product card.
2. Call `placeOrder(currentUserId, categoryId)` — `categoryId` comes from `data-category-id`;
   the specific `product_id` is for display only and does not change the order logic.
3. Disable all ADD buttons in the screen immediately (prevent double-tap).
4. Show a "✅ Order placed!" toast for 1.5s.
5. Navigate back to Discover tab.
6. Discover re-fetches — the adopted category is now gone from suggestions.

**Rendering notes:**
- Convert `rating` (0-1) → display as `"${Math.round(rating*100)}% rated good"`.
- Convert `sales_velocity` (0-1) → display as `"${Math.round(sales_velocity*100)}% reordered"`.
- `combined_score` → display label via tier: ≥1.6 "Top Pick", ≥1.0 "Popular Choice", else "Good Value".
- Do NOT display the raw `combined_score` number or `trust_score`.

---

### 4.4 — Styling (`ui/styles.css`)

**Design system tokens:**
```css
:root {
  --color-primary:      #F7C948;   /* Blinkit yellow */
  --color-bg:           #FAFAFA;
  --color-surface:      #FFFFFF;
  --color-text-primary: #1A1A1A;
  --color-text-muted:   #6B7280;
  --color-trust-chip:   #F0FDF4;   /* light green for trust signals */
  --color-trust-border: #86EFAC;
  --radius-card:        16px;
  --shadow-card:        0 2px 12px rgba(0,0,0,0.08);
  --transition-base:    0.2s ease;
}
```

**Key UI rules:**
- Bottom nav: fixed, white background, 4 equal-width tabs, active tab highlighted in `--color-primary`.
- Discover cards: white surface, `--shadow-card`, `--radius-card`, hover lifts with `translateY(-2px)`.
- Trust chip: `background: --color-trust-chip`, `border: 1px solid --color-trust-border`, italic text, small font.
- Skeleton cards: animated grey shimmer using `@keyframes shimmer`.
- No trust_score displayed anywhere in the stylesheet or HTML.

---

### Phase 4 Completion Checklist

- [ ] `ui/index.html` — shell with bottom nav, screen container, imports all JS and CSS
- [ ] `ui/app.js` — navigation routing, user selector, `window.app` state
- [ ] `ui/discoverTab.js` — all 4 screen states (Loading, Cold-Start, Personalised, Exhausted)
- [ ] `ui/categoryDetail.js` — top-product card, simulated order flow, back navigation
- [ ] `ui/styles.css` — design tokens, card styles, trust chip, skeleton animation, nav highlight
- [ ] **Visual check:** Open `index.html` in browser, confirm no `trust_score` text visible anywhere
- [ ] **Flow check:** Switch demo user to cold-start user → Discover shows generic defaults
- [ ] **Flow check:** Tap "Explore" → Category Detail shows one product → "Add to Cart" → back to Discover → adopted category gone
- [ ] **Flow check:** Manually bump view_counts to ≥ 3 for a category → confirm it disappears from next load

---

## Cross-Phase Invariants (enforced at every phase boundary)

| Invariant | Enforced at |
|---|---|
| `trust_score` excluded from all API response payloads | Phase 3 boundary (API layer) |
| Tried categories never appear in suggestions | Phase 2 (Adjacency Resolver step 5) |
| Adjacency rows derived from order data, never authored | Phase 1 (derive_adjacency.js) |
| Cold-start → Personalised transition at order 2 (no delay) | Phase 3 (`getDiscoverSuggestions` mode logic) |
| Dismissal at exactly 3 views | Phase 2 (Graduation Tracker constant) |
| Category detail shows highest-feedback-quality product, not random | Phase 3 (`getCategoryDetail` sorting logic) |

---

## Dependency Graph

```
Phase 1 (Data)
    └──► Phase 2 (Engine)
              └──► Phase 3 (API Bridge)
                        └──► Phase 4 (Frontend)
```

Each phase gate: the listed completion checklist items must all pass before the next phase starts.

---

## File Creation Order (complete list)

```
Phase 1:
  data/categories.json              ← authored manually
  generator/generate_users.js       → data/users.json
  generator/generate_orders.js      → data/orders.json (+ updates users.json)
  generator/derive_adjacency.js     → data/category_adjacency.json
  generator/generate_feedback.js    → data/feedback.json

Phase 2:
  engine/store.js
  engine/coldStartHandler.js
  engine/adjacencyResolver.js
  engine/graduationTracker.js       → data/graduation_state.json (runtime)

Phase 3:
  api/getDiscoverSuggestions.js
  api/getCategoryDetail.js
  api/placeOrder.js

Phase 4:
  ui/index.html
  ui/styles.css
  ui/app.js
  ui/discoverTab.js
  ui/categoryDetail.js
```

## Update for Antigravity — Post-Order Support & Guarantee Flow

---

**Trigger:** After user taps "Add to Cart" / "Place Order" and completes payment on the Category Detail or Cart screen.

**Step 1 — Simulated delivery wait**
Show a brief "Order placed! Delivering..." state for **3 seconds** (simulated async wait), then transition to "Delivered ✅".

**Step 2 — Post-delivery check-in**
On the same order card, show a prompt: **"How was the product?"** with two options — e.g., 👍 Good / 👎 Had an issue.

**Step 3a — If "Good" selected**
Close the card / mark order as satisfied. No further flow.

**Step 3b — If "Had an issue" selected**
Show a **"Report an issue"** button on the card.

**Step 4 — Tapping "Report an issue" → Human support chat (not a chatbot)**
Open a simple chat screen with 2-3 pre-scripted text exchanges simulating a human agent, e.g.:
- Agent: "Sorry to hear that! Can you tell us what went wrong?"
- User: (pre-filled or tappable quick-reply options, e.g., "Item was damaged" / "Wrong item" / "Quality issue")
- Agent: "Let me check what we can do for you..."

**Step 5 — Resolution outcome (simulate as unresolved, to demonstrate the guarantee)**
After the short exchange, show: **"We couldn't fix this right away — here's what we can do:"** with two options:
- **Replacement**
- **Refund**

**Step 6a — If "Replacement" selected**
Show confirmation: **"Your replacement will arrive in 15-30 minutes."**

**Step 6b — If "Refund" selected**
Show confirmation: **"Refund initiated — amount will reflect shortly."**

**Step 7 — Return to Discover**
After confirmation, navigate back to the Discover tab (same pattern as the existing post-purchase flow), so the loop closes consistently with the rest of the app's navigation.

---

**Scope note for Antigravity:** This is a fully simulated, front-end-only flow — hardcode the chat exchange and outcome (always resolve to "unresolved → replacement/refund options"), no real eligibility rules, timers, or backend logic needed. Keep it visually consistent with the existing skeleton-loading and toast patterns already built for the Discover/Category Detail screens.


## Phase 5 — Deployment

**Goal:** Prepare and deploy the application for production access.
**Deliverables:** Production-ready server configuration, environment setup, and deployment scripts.

### 5.1 — Server Preparation
- Update ui/server.js to use process.env.PORT.
- Verify all relative paths for robust production execution.

### 5.2 — Process Management
- Configure PM2 or a similar process manager to keep the application running continuously.

### 5.3 — CI/CD Pipeline
- Define a basic deployment script to automate fetching the latest code and restarting the server.
