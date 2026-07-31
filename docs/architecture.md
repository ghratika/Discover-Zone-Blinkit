# Architecture — Discover Zone (v1 Simulation)

> **Scope reminder:** This is a self-contained simulation prototype. There is no real Blinkit backend, no live ML, and no production data. All users, orders, and feedback are synthetically generated. The architecture is designed to demonstrate the full end-to-end logic faithfully within those constraints.

---

## 1. High-Level System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (UI Layer)                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Home Tab│  │ Discover Tab │  │  Category Detail  │  │
│  └──────────┘  └──────┬───────┘  └──────────────────┘  │
└─────────────────────── │ ───────────────────────────────┘
                         │  API calls (in-memory / JSON)
┌─────────────────────── │ ───────────────────────────────┐
│                  ENGINE LAYER (Core Logic)               │
│  ┌───────────────────┐   ┌────────────────────────────┐ │
│  │  Recommendation   │   │   Cold-Start Handler       │ │
│  │  Engine           │   │   (< 2 orders → defaults)  │ │
│  └────────┬──────────┘   └────────────┬───────────────┘ │
│           │                           │                  │
│  ┌────────▼───────────────────────────▼───────────────┐ │
│  │              Adjacency Resolver                     │ │
│  │  (looks up category_adjacency table, filters       │ │
│  │   already-tried categories, ranks by trust_score)  │ │
│  └────────────────────────┬────────────────────────────┘ │
└─────────────────────────── │ ──────────────────────────┘
                             │
┌─────────────────────────── │ ──────────────────────────┐
│                  DATA LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   users.json │  │categories.json│ │  orders.json │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────────────┐  ┌───────────────────────┐   │
│  │  category_adjacency  │  │     feedback.json     │   │
│  │       .json          │  │                       │   │
│  └──────────────────────┘  └───────────────────────┘   │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│              DATA GENERATION PIPELINE (one-time)        │
│  Step 1: Generate users                                 │
│  Step 2: Generate orders (realistic purchase patterns)  │
│  Step 3: Derive category_adjacency from co-occurrence   │
│  Step 4: Generate simulated post-delivery feedback      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Layer Breakdown

### 2.1 Data Generation Pipeline

This pipeline runs **once** to produce the seed data. It is not a live system.

#### Step 1 — Generate Users
- Create N synthetic users (recommended: 200–500 for meaningful co-occurrence).
- Each user is assigned a `signup_date` and a randomly weighted household archetype (e.g., solo professional, family, student) that biases which categories they purchase from.
- Archetypes are used *only* during generation to produce realistic order distributions — they are never stored or used in recommendation logic.

#### Step 2 — Generate Orders
- For each user, simulate 3–18 months of order history using their archetype weights.
- Each order record contains: `order_id`, `user_id`, `category_id`, `product_id`, `timestamp`, `is_first_time_in_category`.
- `is_first_time_in_category` is computed during generation by tracking which categories a user has already ordered from.

#### Step 3 — Derive Category Adjacency
- After all orders are generated, compute co-occurrence:
  - For every pair of categories `(A, B)`, count the number of users who have bought from both.
  - Normalize to a `co_occurrence_score` (0–1 or a raw count).
  - Record `sample_size` (number of users the pairing is based on).
  - Discard pairings below a minimum sample threshold (e.g., `sample_size < 10`) to avoid noisy weak signals.
- **Pairings are never hardcoded** — they emerge entirely from the simulated order history.

#### Step 4 — Generate Feedback
- For each `is_first_time_in_category = true` order, simulate a post-delivery response:
  - `post_delivery_response`: "good" | "bad" | "no_response" (weighted randomly, skewed positive for high-trust categories).
  - `retried_within_30_days`: derived from whether the user placed another order in that category within 30 simulated days.

---

### 2.2 Data Layer (Static JSON Store)

All data lives in flat JSON files. For the prototype, these are loaded into memory at app startup.

#### `users.json`
```jsonc
[
  {
    "user_id": "u_001",
    "signup_date": "2024-01-15",
    "order_history": ["o_001", "o_002", ...],     // order IDs
    "search_history": [                            // optional
      { "term": "oat milk", "timestamp": "..." }
    ],
    "cart_abandons": [                             // optional
      { "product_id": "p_042", "timestamp": "..." }
    ]
  }
]
```

#### `categories.json`
```jsonc
[
  {
    "category_id": "cat_01",
    "category_name": "Personal Care",
    "trust_score": 4.3,                            // backend only — never shown in UI
    "sample_review_snippet": "Arrived fresh, exactly as described.",
    "is_universal_default": true                   // shown during cold-start
  }
]
```

**`trust_score` constraint:** This field is read only by the Adjacency Resolver when ranking categories to surface. It is never passed to the frontend directly.

#### `orders.json`
```jsonc
[
  {
    "order_id": "o_001",
    "user_id": "u_001",
    "category_id": "cat_03",
    "product_id": "p_017",
    "timestamp": "2024-03-10T14:22:00Z",
    "is_first_time_in_category": true
  }
]
```

#### `category_adjacency.json`
```jsonc
[
  {
    "source_category_id": "cat_01",
    "target_category_id": "cat_07",
    "co_occurrence_score": 0.73,
    "sample_size": 84
  }
]
```

#### `feedback.json`
```jsonc
[
  {
    "order_id": "o_001",
    "post_delivery_response": "good",
    "retried_within_30_days": true
  }
]
```

---

### 2.3 Engine Layer (Core Logic)

#### Adjacency Resolver

The central algorithm that powers the Discover tab.

**Input:** `user_id`  
**Output:** Ordered list of 2–3 category objects (with `sample_review_snippet`, but **without** `trust_score`)

**Algorithm:**
```
1. Load user's order history → derive SET of already-tried category IDs.

2. If order_history is empty or has < 2 orders:
     → delegate to Cold-Start Handler (see below).

3. For each tried category C_i:
     → look up all adjacency rows where source_category_id = C_i
     → filter: target_category_id NOT IN already-tried set
     → filter: sample_size >= MIN_SAMPLE_THRESHOLD (e.g., 10)
     → accumulate candidate categories with their co_occurrence_score

4. For candidates with multiple source pathways, sum their co_occurrence_scores
   (a category adjacent to 3 of the user's categories scores higher than one adjacent to only 1).

5. Join candidates with categories.json to get their trust_score.

6. Rank candidates by:
     PRIMARY:  co_occurrence_score (descending)
     SECONDARY: trust_score (descending, as tiebreaker)

7. Take the top 2–3 candidates.

8. Return category objects with: category_id, category_name, sample_review_snippet.
   DO NOT include trust_score in the returned payload.
```

#### Cold-Start Handler

Triggered when a user has fewer than 2 orders.

```
1. Filter categories where is_universal_default = true.
2. Rank by trust_score (descending) — backend only.
3. Return top 2–3. No personalization applied.
4. As soon as the user's order count reaches 2, the next Discover tab load
   switches to the full Adjacency Resolver automatically.
```

#### Graduation Tracker

Determines when a suggested category should exit the discovery pool.

```
For each category C in user's Discover suggestions:
  - If user places an order in C → mark as ADOPTED → remove from future suggestions.
  - If user has seen C suggested 3+ times and never tapped it → mark as DISMISSED
    → remove from future suggestions, do not re-surface it.
  - Feedback (retried_within_30_days) is used to update category trust_score
    in the dataset for future runs — not during the live session.
```

---

### 2.4 Frontend (UI Layer)

#### Navigation
- Bottom navigation bar with 4 tabs: **Home**, **Discover**, **Cart**, **Profile**.
- The **Discover** tab is a fixed permanent destination — it does not appear only conditionally.

#### Discover Tab — Screen States

| State | Condition | What is shown |
|---|---|---|
| Cold-Start | `order_count < 2` | 2–3 universal default categories with trust chip |
| Personalized | `order_count >= 2` | 2–3 adjacency-derived categories with trust chip |
| All Adopted | User has tried all suggestions | "You've explored everything we had for now — check back soon" empty state |
| Loading | API call in flight | Skeleton card placeholders |

#### Discover Card (per suggested category)
Each card displays:
- Category name
- Category icon / illustration
- **Trust chip**: `sample_review_snippet` text (e.g., *"Arrived fresh, exactly as described."*)
- CTA: "Explore [Category Name] →"

**Explicitly omitted from the card:** `trust_score` (it is a backend-only ranking signal).

#### Category Detail Screen
When a user taps a Discover card:
- Load the single highest-trust-score product in that category.
- Show product name, image, price, and the same trust chip.
- Show a "Back to Discover" breadcrumb.

---

## 3. Data Flow — End to End

```
User opens Discover Tab
        │
        ▼
Frontend calls getDiscoverSuggestions(user_id)
        │
        ▼
Engine: fetch user order history
        │
        ├─ order_count < 2 ──► Cold-Start Handler
        │                         └─► return top universal defaults (by trust_score)
        │
        └─ order_count >= 2 ──► Adjacency Resolver
                                   ├─ derive tried categories
                                   ├─ query category_adjacency
                                   ├─ filter already-tried + low-sample pairings
                                   ├─ score by co_occurrence + trust_score
                                   └─► return top 2–3 candidates (no trust_score field)
        │
        ▼
Frontend renders Discover Cards
        │
        ▼
User taps a card
        │
        ▼
Frontend calls getCategoryDetail(category_id)
        │
        ▼
Engine: fetch products in category, sort by trust_score DESC, return [0]
        │
        ▼
Frontend renders Category Detail Screen
        │
        ▼
User places order (simulated)
        │
        ▼
Engine: set is_first_time_in_category, generate feedback record,
        trigger Graduation Tracker (mark category ADOPTED)
        │
        ▼
Next Discover Tab load: adopted category is excluded from suggestions
```

---

## 4. Entity Relationship Diagram

```
User ──────────────────< Order >──────────────── Category
 │                         │                        │
 │                         │                        ├── trust_score (backend only)
 │                         │                        ├── sample_review_snippet
 │                         │                        └── is_universal_default
 │                         │
 │                         └──────────────────── Feedback
 │                                                  ├── post_delivery_response
 │                                                  └── retried_within_30_days
 │
 └── order_history (list of order_ids)
 └── search_history (optional)
 └── cart_abandons (optional)

Category Adjacency (separate join table)
  source_category_id  ──►  Category
  target_category_id  ──►  Category
  co_occurrence_score
  sample_size
```

---

## 5. Key Invariants (constraints the implementation must always respect)

| # | Invariant | Rationale |
|---|---|---|
| 1 | `trust_score` is never included in any API response payload sent to the frontend | It is a backend ranking signal only — exposing it would violate the design spec |
| 2 | A category the user has already ordered from is never shown in Discover | Discover is strictly for untried categories |
| 3 | Category adjacency rows are computed from order data, never hardcoded | Pairings must reflect the actual simulated behaviour |
| 4 | Cold-start switches to personalized mode after the 1st or 2nd real order — no fixed delay | Personalization must kick in as early as possible |
| 5 | A dismissed category (seen 3+ times, never tapped) is suppressed permanently for that user | Avoids showing irrelevant suggestions repeatedly |
| 6 | Adjacency pairings with `sample_size < MIN_THRESHOLD` are discarded | Prevents noisy/weak signals from polluting recommendations |
| 7 | Category detail always routes to the single highest-trust product in the category | Not a random listing — trust determines the first product shown |

---

## 6. File & Module Structure (Suggested)

```
discover-zone/
├── data/
│   ├── users.json
│   ├── categories.json
│   ├── orders.json
│   ├── category_adjacency.json
│   └── feedback.json
│
├── generator/
│   ├── generate_users.js          # Step 1
│   ├── generate_orders.js         # Step 2
│   ├── derive_adjacency.js        # Step 3
│   └── generate_feedback.js       # Step 4
│
├── engine/
│   ├── adjacencyResolver.js       # Core recommendation algorithm
│   ├── coldStartHandler.js        # Universal default fallback
│   └── graduationTracker.js       # Adoption / dismissal logic
│
├── api/
│   ├── getDiscoverSuggestions.js  # Wraps engine for frontend calls
│   └── getCategoryDetail.js       # Returns top-trust product in category
│
├── ui/
│   ├── index.html
│   ├── app.js                     # Navigation + state management
│   ├── discoverTab.js             # Discover tab rendering
│   ├── categoryDetail.js          # Category detail screen
│   └── styles.css
│
└── docs/
    ├── Discover_Zone_Spec.md
    ├── problemStatement.md
    └── architecture.md            ← this file
```

---

## 7. Open Design Decisions (to resolve before building)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Minimum sample threshold for adjacency | 5, 10, 15 | **10** — balances coverage vs. noise for a ~300-user dataset |
| D2 | Number of suggestions shown | 2 or 3 | **3** — gives enough variety without overwhelming |
| D3 | Dismissal threshold | After 2, 3, or 5 views with no tap | **3** — quick enough to feel adaptive |
| D4 | Co-occurrence scoring method | Raw count vs. Jaccard similarity | **Jaccard** preferred (normalizes for category popularity) — but raw count is acceptable for v1 |
| D5 | Data format | Flat JSON files vs. in-memory SQLite | **Flat JSON** for v1 simplicity; SQLite if query complexity grows |
| D6 | Frontend framework | Vanilla JS/HTML vs. React | **Vanilla JS** unless UI complexity demands component lifecycle management |
