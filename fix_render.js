const fs = require('fs');

async function fixTiersAndRender() {
  const htmlPath = 'ui/index.html';
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 1. Fix renderVariantGrid to filter correctly
  const oldRenderStr = `  document.getElementById('variant-grid').innerHTML = [0,1,2,3].map(j=>{
    const price   = Math.round(BASE * (1 + j * 0.8));
    const mrp     = Math.round(price * 1.22);
    const stars   = (3.8+j*0.2+lineIdx*0.05).toFixed(1);
    const reviews = (2000+j*3000+lineIdx*500).toLocaleString();
    // AIDA CDN photos for pet supplies; img[j] for everything else
    const imgUrl  = varDef.useAIDA
      ? (VARIANT_IMAGES[j] || '')
      : (varDef.img && varDef.img[j] ? varDef.img[j] : '');
    const imgHTML = imgUrl
      ? \`<img class="w-full h-full object-contain p-2" src="\${imgUrl}"
             onerror="this.style.display='none'" alt="\${BRANDS[j]}"/>\`
      : \`<div class="absolute inset-0 flex items-center justify-center">
           <span class="material-symbols-outlined text-[70px] opacity-30" style="color:\${cv.c};font-variation-settings:'FILL' 1;">\${line.ic||cv.ic}</span>
         </div>\`;`;

  const newRenderStr = `
  let matchedIndexes = [];
  for (let k = 0; k < BRANDS.length; k++) {
    // We map the product to this lineIdx if its tier exactly matches the line.n,
    // OR if we fallback to distributing them if tiers are a mess.
    // Actually, we've cleaned up tiers to match line.n exactly in the script below.
    if (TIERS[k] === line.n) {
      matchedIndexes.push(k);
    }
  }
  // Fallback if no exact match (so UI doesn't break): show some items based on lineIdx slice
  if (matchedIndexes.length === 0) {
     const start = (lineIdx * 2) % BRANDS.length;
     matchedIndexes = [start, (start+1)%BRANDS.length, (start+2)%BRANDS.length];
  }

  document.getElementById('variant-grid').innerHTML = matchedIndexes.map((j, displayIdx)=>{
    const price   = Math.round(BASE * (1 + displayIdx * 0.8));
    const mrp     = Math.round(price * 1.22);
    const stars   = (3.8+displayIdx*0.2+lineIdx*0.05).toFixed(1);
    const reviews = (2000+displayIdx*3000+lineIdx*500).toLocaleString();
    
    // Safety check for useAIDA
    const imgUrl  = varDef.useAIDA
      ? (VARIANT_IMAGES[j % VARIANT_IMAGES.length] || '')
      : (varDef.img && varDef.img[j] ? varDef.img[j] : '');

    const imgHTML = imgUrl
      ? \`<img class="w-full h-full object-contain p-2" src="\${imgUrl}"
             onerror="this.style.display='none'" alt="\${BRANDS[j]}"/>\`
      : \`<div class="absolute inset-0 flex items-center justify-center">
           <span class="material-symbols-outlined text-[70px] opacity-30" style="color:\${cv.c};font-variation-settings:'FILL' 1;">\${line.ic||cv.ic}</span>
         </div>\`;`;
         
  html = html.replace(oldRenderStr, newRenderStr);


  // 2. Map existing tiers to PRODUCT_LINES.n
  const startIdx = html.indexOf('const CAT_VARIANTS = {');
  const endIdx = html.indexOf('// Automatically populate LINE_IMAGES');
  const matchStr = html.substring(startIdx, endIdx);
  const objStr = matchStr.replace('const CAT_VARIANTS = ', '').trim().replace(/;$/, '');
  let CAT_VARIANTS = eval('(' + objStr + ')');

  const PRODUCT_LINES = {
    cat_01:[{n:'Staple Grains'},{n:'Cooking Oils'},{n:'Pulses & Lentils'}],
    cat_02:[{n:'Chips & Crisps'},{n:'Chocolates'},{n:'Healthy Snacks'}],
    cat_03:[{n:'Packaged Juices'},{n:'Soft Drinks'},{n:'Water & Hydration'}],
    cat_04:[{n:'Fresh Milk'},{n:'Curd & Yogurt'},{n:'Paneer & Cheese'}],
    cat_05:[{n:'Floor Cleaners'},{n:'Dish Wash'},{n:'Detergents'}],
    cat_06:[{n:'Face Care'},{n:'Hair Care'},{n:'Body Wash'}],
    cat_07:[{n:'Diapers'},{n:'Baby Food'},{n:'Wipes & Care'}],
    cat_08:[{n:'Dog Food'},{n:'Cat Litter'},{n:'Pet Grooming'}],
    cat_09:[{n:'Vitamins'},{n:'First Aid'},{n:'Protein & Fitness'}],
    cat_10:[{n:'Frozen Vegetables'},{n:'Frozen Snacks'},{n:'Ice Cream'}],
    cat_11:[{n:'Leafy Greens'},{n:'Root Vegetables'},{n:'Exotic Vegetables'}],
    cat_12:[{n:'Citrus Fruits'},{n:'Tropical Fruits'},{n:'Berries'}],
    cat_13:[{n:'Floor & Surface'},{n:'Toilet Cleaners'},{n:'Air Fresheners'}],
    cat_14:[{n:'Notebooks'},{n:'Pens & Markers'},{n:'Office Supplies'}],
    cat_15:[{n:'Phone Accessories'},{n:'Cables & Adapters'},{n:'Batteries'}],
    cat_16:[{n:'Instant Noodles'},{n:'Ready Meals'},{n:'Soups & Broths'}],
    cat_17:[{n:'Breads & Loaves'},{n:'Cookies & Buns'},{n:'Cakes & Pastries'}],
    cat_18:[{n:'Organic Grains'},{n:'Cold-Press Oils'},{n:'Superfoods'}],
  };

  const manualMapping = {
    "Premium Basmati": "Staple Grains",
    "Refined Oil": "Cooking Oils",
    "Washed Moong": "Pulses & Lentils",
    "Parboiled Rice": "Staple Grains",
    "Potato Chips": "Chips & Crisps",
    "Milk Chocolate": "Chocolates",
    "Corn Puff": "Chips & Crisps",
    "Wafer Bar": "Chocolates",
    "Fruit Juice": "Packaged Juices",
    "Soft Drink": "Soft Drinks",
    "Mineral Water": "Water & Hydration",
    "Traditional Drink": "Packaged Juices",
    "Full Fat": "Fresh Milk",
    "Toned Milk": "Fresh Milk",
    "Skimmed": "Fresh Milk",
    "Farm Fresh": "Fresh Milk",
    "Floor Cleaner": "Floor Cleaners",
    "Dishwash Liquid": "Dish Wash",
    "Laundry Liquid": "Detergents",
    "Bleach Cleaner": "Floor Cleaners",
    "Face Wash": "Face Care",
    "Hair Care": "Hair Care",
    "Body Wash": "Body Wash",
    "Sensitive Wash": "Body Wash",
    "Taped Diapers": "Diapers",
    "Pant Style Diapers": "Diapers",
    "Premium Pants": "Diapers",
    "Economy Pants": "Diapers",
    "Adult Dog Food": "Dog Food",
    "Medium Breed Food": "Dog Food",
    "Economy Dog Food": "Dog Food",
    "Premium Dog Food": "Dog Food",
    "Vitamin C": "Vitamins",
    "Multivitamin": "Vitamins",
    "Effervescent Tab": "Vitamins",
    "Whey Protein": "Protein & Fitness",
    "Potato Patty": "Frozen Snacks",
    "Fried Snack": "Frozen Snacks",
    "Ice Cream Cone": "Ice Cream",
    "Kulfi Stick": "Ice Cream",
    "Leafy Greens": "Leafy Greens",
    "Root Vegetable": "Root Vegetables",
    "Exotic Produce": "Exotic Vegetables",
    "Premium Select": "Exotic Vegetables",
    "Citrus Fresh": "Citrus Fruits",
    "Premium Mango": "Tropical Fruits",
    "Organic Berries": "Berries",
    "Imported Grapes": "Tropical Fruits",
    "Glass & Surface": "Floor & Surface",
    "Toilet Cleaner": "Toilet Cleaners",
    "Air Freshener": "Air Fresheners",
    "Disinfectant": "Floor & Surface",
    "Ruled 80 Pg": "Notebooks",
    "Graph 100 Pg": "Notebooks",
    "Spiral A4": "Notebooks",
    "Blank Sketch": "Notebooks",
    "Type-C Cable": "Cables & Adapters",
    "Braided Cable": "Cables & Adapters",
    "Power Bank": "Phone Accessories",
    "LED Bulb": "Phone Accessories",
    "Instant Noodles": "Instant Noodles",
    "Wheat Noodles": "Instant Noodles",
    "Instant Soup": "Soups & Broths",
    "Ready Meal": "Ready Meals",
    "Whole Wheat": "Breads & Loaves",
    "Multigrain": "Breads & Loaves",
    "Brown Bread": "Breads & Loaves",
    "White Loaf": "Breads & Loaves",
    "Organic Basmati": "Organic Grains",
    "Cold-Press Oil": "Cold-Press Oils",
    "Superseeds Mix": "Superfoods",
    "Ayurvedic Capsules": "Vitamins" // mapping to Vitamins
  };

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.tiers) {
      for (let i = 0; i < cat.tiers.length; i++) {
        let t = cat.tiers[i];
        if (manualMapping[t]) {
          cat.tiers[i] = manualMapping[t];
        }
      }
    }
  }

  let newStr = JSON.stringify(CAT_VARIANTS, null, 2);
  newStr = newStr.replace(/"brands":/g, 'brands:').replace(/"tiers":/g, 'tiers:').replace(/"sizes":/g, 'sizes:').replace(/"base":/g, 'base:').replace(/"img":/g, 'img:').replace(/"useAIDA":/g, 'useAIDA:');
  
  html = html.replace(matchStr, 'const CAT_VARIANTS = ' + newStr + ';\n\n');
  fs.writeFileSync(htmlPath, html);
  console.log("Fixed render logic and tier names");
}
fixTiersAndRender();
