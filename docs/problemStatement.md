# Problem Statement — Discover Zone

## Context

Quick-commerce platforms like **Blinkit** have largely succeeded at making repeat purchasing frictionless. Users can reorder the same groceries, snacks, and household essentials in seconds. However, this convenience has created an unintended side effect: **basket freezing** — users repeat the same narrow set of categories order after order, never organically discovering what else the platform offers.

---

## The Problem

### Who is affected?
**Habit-Driven Essentials Shoppers** — approximately **63% of surveyed Blinkit users** who place near-identical repeat orders (groceries, snacks, household items) for themselves or their household.

### What is the core frustration?
These users are **not uninterested in new categories** — they simply:

1. **Don't trust unfamiliar products** enough to risk a bad experience (quality doubt is the #1 blocker identified in survey data).
2. **Have no intentional discovery path** — the current home screen surfaces banners and promotions, but nothing ever points a specific user toward a specific new category that is *actually relevant to them*.

As a result:
- Discovery today is **accidental** (a user happens to see a banner) or **forced** (an emergency need).
- It is never **deliberate or personalized**.

### Why does this matter?
- Users remain locked in a narrow basket, which limits their lifetime value to the platform.
- Relevant adjacent categories (e.g., Pet Supplies for a regular grocery buyer) go untried — not because the user wouldn't buy them, but because no mechanism surfaces them at the right moment with sufficient trust signals.

---

## The Insight

Users need **two things simultaneously** to trial a new category:

| Need | Current Gap |
|---|---|
| A relevant, adjacent suggestion | Nothing on the home screen makes a category-specific, personalized recommendation |
| A trust signal that reduces quality doubt | Banners carry no visible proof of buyer confidence |

Without both, the habit loop continues unchanged.

---

## Proposed Solution

A dedicated **"Discover" tab** in Blinkit's bottom navigation bar — a permanent, always-accessible destination (not a banner, not a modal) — that shows each user **2–3 categories they have never bought from before**, selected based on adjacency to their existing purchase history, and paired with a visible trust signal (e.g., a short buyer review snippet) to reduce the doubt that blocks first purchase.

### Key design decisions embedded in the solution:
- **Personalization from first order**: cold-start users see universal defaults; personalization kicks in after the first 1–2 real orders — no artificial waiting period.
- **Trust score is backend-only**: the ranking signal (0–5 aggregate trust score per category) influences *which* category is surfaced, but is never shown directly in the UI.
- **Routing to the most trusted product**: tapping a suggested category shows the highest-trust product first, not a random listing.
- **Adaptive over time**: if a user tries a category and returns to it, it exits the discovery pool; if they ignore it, the system adjusts future suggestions.

---

## Scope Boundary (v1)

This is a **simulation and prototype**, not a production integration. Specifically:

| In Scope | Out of Scope |
|---|---|
| Simulated user + order dataset (generated, not real) | Real Blinkit backend or production data |
| Adjacency logic derived from the generated dataset | Live ML model training or continuous learning |
| Trust chip UI using mock review snippets | Real payment or checkout flow |
| Post-delivery feedback simulation (mock responses) | Real push notifications or post-delivery surveys |
| Repeat-purchase tracking within the simulation | Explore/exploit A-B testing on real traffic |
| | Multi-language or accessibility localization |

---

## Data Model Summary

The following entities are needed to simulate the feature end-to-end:

- **User** — order history, search history (optional), cart abandons (optional)
- **Category** — trust score (backend only), sample review snippet (UI trust chip)
- **Category Adjacency** — co-occurrence score + sample size, *derived from the generated dataset* (not hardcoded)
- **Order** — includes a flag for whether it was the user's first order in that category
- **Feedback** — simulated post-delivery response and whether the user reordered within 30 days

> **Important:** Category pairings must *emerge* from the simulated order history — they should not be predefined. Generate realistic fake users and orders first, then compute adjacency from that data.

---

## Success Definition (for this prototype)

The prototype successfully demonstrates the Discover Zone concept if:

1. A simulated user with an established order history is shown 2–3 previously-untried, adjacency-relevant categories.
2. Each suggestion carries a visible trust signal (review snippet or badge).
3. Cold-start behavior shows universal defaults and transitions to personalized suggestions after the first 1–2 orders.
4. The system can show that a category "graduates" out of Discover (either as adopted or dismissed) based on simulated feedback.
