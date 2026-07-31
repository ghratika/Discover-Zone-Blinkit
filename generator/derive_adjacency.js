/**
 * derive_adjacency.js
 * Step 3 of the Data Generation Pipeline.
 *
 * Reads data/orders.json and data/categories.json.
 * Computes Jaccard similarity for every category pair derived from co-purchasing behaviour.
 * Writes data/category_adjacency.json.
 *
 * Edge-case awareness:
 *   EC-2.3  — Categories with zero buyers are skipped; no division-by-zero possible.
 *   EC-5.3  — Self-pairs (A === B) are explicitly excluded.
 *   EC-5.1  — Pairs with sample_size < MIN_SAMPLE_THRESHOLD (10) are discarded.
 *   EC-5.2  — Jaccard naturally normalises for popular categories (no extra guard needed).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR           = path.join(__dirname, '..', 'data');
const ORDERS_FILE        = path.join(DATA_DIR, 'orders.json');
const CATEGORIES_FILE    = path.join(DATA_DIR, 'categories.json');
const OUTPUT_FILE        = path.join(DATA_DIR, 'category_adjacency.json');

const MIN_SAMPLE_THRESHOLD = 10;  // D1 — locked in

// ─── Jaccard Similarity ───────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two sets.
 * jaccard(A, B) = |A ∩ B| / |A ∪ B|
 * Returns { score, sampleSize } where sampleSize = |A ∩ B|.
 *
 * EC-2.3: If both sets are empty (union = 0), return { score: 0, sampleSize: 0 }.
 * This cannot happen in practice since we skip categories with 0 buyers, but guarded anyway.
 */
function jaccard(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union        = new Set([...setA, ...setB]);

  // EC-2.3 / EC-4.3: guard against empty union (orphan categories)
  if (union.size === 0) return { score: 0, sampleSize: 0 };

  return {
    score:      Math.round((intersection.size / union.size) * 10000) / 10000,
    sampleSize: intersection.size
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const orders     = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));

  const allCategoryIds = categories.map(c => c.category_id);

  // Build: categoryId → Set<userId> (buyers of that category)
  const buyersByCat = {};
  for (const catId of allCategoryIds) {
    buyersByCat[catId] = new Set();
  }

  for (const order of orders) {
    const { user_id, category_id } = order;
    // EC-2.3: guard — only process orders for known categories
    if (buyersByCat[category_id]) {
      buyersByCat[category_id].add(user_id);
    }
  }

  // Report orphan categories (EC-4.3)
  const orphans = allCategoryIds.filter(id => buyersByCat[id].size === 0);
  if (orphans.length > 0) {
    console.warn(`⚠️   Orphan categories (0 buyers, skipped in adjacency): ${orphans.join(', ')}`);
  }

  // Compute Jaccard for every ordered pair (A, B) where A !== B
  const adjacencyRows = [];

  for (let i = 0; i < allCategoryIds.length; i++) {
    for (let j = 0; j < allCategoryIds.length; j++) {
      if (i === j) continue;  // EC-5.3: skip self-pairs

      const catA = allCategoryIds[i];
      const catB = allCategoryIds[j];

      const buyersA = buyersByCat[catA];
      const buyersB = buyersByCat[catB];

      // EC-4.3: skip orphan categories (no buyers)
      if (buyersA.size === 0 || buyersB.size === 0) continue;

      const { score, sampleSize } = jaccard(buyersA, buyersB);

      // EC-5.1: discard pairs below the minimum sample threshold
      if (sampleSize < MIN_SAMPLE_THRESHOLD) continue;

      adjacencyRows.push({
        source_category_id: catA,
        target_category_id: catB,
        co_occurrence_score: score,
        sample_size:         sampleSize
      });
    }
  }

  // Sort for readability: by source then by score desc
  adjacencyRows.sort((a, b) => {
    if (a.source_category_id !== b.source_category_id) {
      return a.source_category_id.localeCompare(b.source_category_id);
    }
    return b.co_occurrence_score - a.co_occurrence_score;
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(adjacencyRows, null, 2), 'utf8');
  console.log(`✅  Written ${adjacencyRows.length} adjacency rows → ${OUTPUT_FILE}`);

  // Sanity stats
  const uniquePairs = adjacencyRows.length / 2;
  console.log(`📊  Unique category pairs retained (both directions): ${adjacencyRows.length} (${uniquePairs} bidirectional pairs)`);
  console.log(`📊  Min sample_size in output: ${Math.min(...adjacencyRows.map(r => r.sample_size))}`);
  console.log(`📊  Max co_occurrence_score: ${Math.max(...adjacencyRows.map(r => r.co_occurrence_score))}`);
  console.log(`📊  Min co_occurrence_score: ${Math.min(...adjacencyRows.map(r => r.co_occurrence_score))}`);
}

main();
