/**
 * generate_users.js
 * Step 1 of the Data Generation Pipeline.
 *
 * Generates 300 synthetic users and writes data/users.json.
 * Archetypes are assigned in memory only — they are NOT stored in users.json.
 * order_history is written as [] here; generate_orders.js back-fills it.
 *
 * Edge-case awareness:
 *   EC-8.1 — order_history starts empty and is only populated by generate_orders.js,
 *             which writes only valid, verified order_ids.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_USERS   = 300;
const DATA_DIR      = path.join(__dirname, '..', 'data');
const OUTPUT_FILE   = path.join(DATA_DIR, 'users.json');

// ─── Archetype definitions (used during generation only, never stored) ────────

const ARCHETYPES = [
  {
    name: 'solo_professional',
    weight: 0.30,
    // Biased toward: Snacks, Beverages, Personal Care, Health & Wellness, Frozen Food, Instant & Ready Meals
    biasedCategories: ['cat_02', 'cat_03', 'cat_06', 'cat_09', 'cat_10', 'cat_16']
  },
  {
    name: 'family_household',
    weight: 0.35,
    // Biased toward: Groceries, Dairy & Eggs, Baby Care, Household Basics, Fresh Vegetables, Cleaning Supplies
    biasedCategories: ['cat_01', 'cat_04', 'cat_07', 'cat_05', 'cat_11', 'cat_13']
  },
  {
    name: 'student',
    weight: 0.20,
    // Biased toward: Snacks, Beverages, Stationery, Electronics Accessories, Frozen Food, Instant & Ready Meals
    biasedCategories: ['cat_02', 'cat_03', 'cat_14', 'cat_15', 'cat_10', 'cat_16']
  },
  {
    name: 'health_conscious',
    weight: 0.15,
    // Biased toward: Fresh Fruits, Fresh Vegetables, Health & Wellness, Dairy & Eggs, Beverages, Organic & Natural
    biasedCategories: ['cat_12', 'cat_11', 'cat_09', 'cat_04', 'cat_03', 'cat_18']
  }
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Seed-free random float in [min, max) */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/** Random integer in [min, max] inclusive */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a weighted archetype */
function pickArchetype() {
  const r = Math.random();
  let cumulative = 0;
  for (const archetype of ARCHETYPES) {
    cumulative += archetype.weight;
    if (r < cumulative) return archetype;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

/** Generate a random date string (ISO 8601) between two Date objects */
function randomDateBetween(start, end) {
  const ms = randFloat(start.getTime(), end.getTime());
  return new Date(ms).toISOString().split('T')[0];
}

/** Zero-padded user ID */
function userId(n) {
  return `u_${String(n).padStart(3, '0')}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const signupStart = new Date('2024-01-01');
  const signupEnd   = new Date('2024-12-31');

  const users = [];

  // Store archetypes separately so generate_orders.js can read them back.
  // We export this as a sidecar file used only by the generator pipeline.
  const archetypeAssignments = {};

  for (let i = 1; i <= TOTAL_USERS; i++) {
    const archetype  = pickArchetype();
    const uid        = userId(i);

    users.push({
      user_id:       uid,
      signup_date:   randomDateBetween(signupStart, signupEnd),
      order_history: [],      // back-filled by generate_orders.js
      search_history: [],     // optional signal — empty for v1
      cart_abandons:  []      // optional signal — empty for v1
    });

    // Store archetype assignment in the sidecar (not in users.json)
    archetypeAssignments[uid] = archetype.name;
  }

  // Write users.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(users, null, 2), 'utf8');
  console.log(`✅  Written ${users.length} users → ${OUTPUT_FILE}`);

  // Write archetype sidecar (used only by generate_orders.js, not part of the app data)
  const sidecarFile = path.join(DATA_DIR, '_archetype_assignments.json');
  fs.writeFileSync(sidecarFile, JSON.stringify(archetypeAssignments, null, 2), 'utf8');
  console.log(`📋  Written archetype sidecar → ${sidecarFile}`);
}

main();
