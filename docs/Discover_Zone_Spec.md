# Discover Zone — Product Brief

### One-Liner
A dedicated "Discover" tab in Blinkit's bottom navigation bar, beside Home, that shows each shopper 2-3 categories they've never tried — matched to what they already buy, and backed by a visible trust signal so the first try feels safe.

### Value Proposition
Discover Zone breaks the habit loop that keeps quick-commerce baskets frozen in place. Instead of leaving category exploration to random banners, it deliberately surfaces adjacent, relevant categories a user hasn't bought from yet, paired with proof (ratings, trust badges) that reduces the one thing survey data shows actually blocks trial: doubt about quality.

---

### Target User
Habit-Driven Essentials Shoppers — the 63% of surveyed users who order groceries, snacks, and household essentials on a near-identical repeat basket, for themselves or their household.

**Core frustration:** They aren't uninterested in new categories — they just don't trust unfamiliar products enough to risk it, and even if they wanted to explore, nothing on the home screen ever points them toward something specific. Discovery today is accidental (a banner) or forced (an emergency), never intentional.

---

### Core Experience
The Blinkit bottom navigation bar has a dedicated **"Discover"** tab, positioned beside **"Home"** — a fixed, permanent destination the user can always find in the same place, separate from the reorder-driven home feed. Tapping it shows 2-3 categories the user hasn't bought from before, chosen based on what they already order (e.g., a groceries-and-snacks buyer sees Pet Supplies and Personal Care). Each suggested category is quietly ranked using a trust score in the backend, but this score is never shown directly in the UI — it only influences which category gets surfaced and in what order. Tapping into a category routes the user to the most trusted product in it first, not a random listing. Over time, as the user tries and either returns to or ignores a category, the system adjusts what it shows them next.

**Cold-start behavior (new users / no order history):**
For a user with no order history yet, do not guess their household type or needs from location or any other assumption. Instead, show only broad, universal categories that are reasonably relevant to almost anyone (e.g., Personal Care, Household Basics). Once the user places their first 1-2 real orders, immediately start using those actual purchased categories to generate personalized adjacency-based suggestions, replacing the generic defaults. Personalization should kick in as early as the first order, not after a fixed waiting period.

---

### Data Structure Needed (for Antigravity to generate its own sample dataset)

**User**
- `user_id`
- `signup_date`
- `order_history` — list of past orders, each with `category`, `product_id`, `timestamp`
- `search_history` — list of search terms with `timestamp` (optional, for interest signals)
- `cart_abandons` — items added to cart but not purchased (optional, for interest signals)

**Category**
- `category_id`
- `category_name`
- `trust_score` — an aggregate rating (0-5) representing buyer confidence in that category. Used only in backend ranking logic to help decide which categories to surface and in what order — never displayed directly in the UI.
- `sample_review_snippet` — a short line representing what buyers commonly say (used as the trust-signal chip)

**Category Adjacency**
- `source_category_id`
- `target_category_id`
- `co_occurrence_score` — a number representing how often these two categories are bought together across users
- `sample_size` — how many users this pairing is based on (used to avoid weak/noisy pairings)

Note: do not hardcode specific category pairings. Generate a realistic set of fake users and their order histories first, then derive the adjacency pairings and co-occurrence scores directly from that generated data — the pairings should emerge from the simulated dataset itself, not be predefined.

**Order**
- `order_id`
- `user_id`
- `category_id`
- `product_id`
- `timestamp`
- `is_first_time_in_category` — true/false, whether this was the user's first order in that category

**Feedback (post-delivery, simulated)**
- `order_id`
- `post_delivery_response` — good / bad / no response
- `retried_within_30_days` — true/false, whether the user ordered from that category again

This structure is enough for Antigravity to generate its own realistic fake users, orders, categories, and pairings, and to simulate the adjacency logic, trust chips, and repeat-purchase tracking end-to-end.

---

### Out of Scope for v1
- Real Blinkit backend or production data integration
- Real machine learning or live model training (adjacency pairings should be derived once from the generated sample dataset, not learned continuously from live traffic)
- Real payment or checkout flow
- Real push notifications or timed reorder nudges (simulate as UI states only)
- Real post-delivery survey collection (simulate with mock responses)
- Explore/exploit testing against real traffic
- Multi-language or accessibility localization
