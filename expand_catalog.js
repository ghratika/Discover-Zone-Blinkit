const fs = require('fs');

async function expandCatalog() {
  const htmlPath = 'ui/index.html';
  let html = fs.readFileSync(htmlPath, 'utf8');

  const startIdx = html.indexOf('const CAT_VARIANTS = {');
  const endIdx = html.indexOf('// Automatically populate LINE_IMAGES');
  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find CAT_VARIANTS block');
    return;
  }

  const matchStr = html.substring(startIdx, endIdx);
  const objStr = matchStr.replace('const CAT_VARIANTS = ', '').trim().replace(/;$/, '');
  
  let CAT_VARIANTS;
  try {
    CAT_VARIANTS = eval('(' + objStr + ')');
  } catch(e) {
    console.error('Failed to parse CAT_VARIANTS', e);
    return;
  }

  // Helper to add a product to a category
  function add(catId, brand, tier, size, basePrice) {
    if (!CAT_VARIANTS[catId]) return;
    if (!CAT_VARIANTS[catId].brands.includes(brand)) {
      CAT_VARIANTS[catId].brands.push(brand);
      CAT_VARIANTS[catId].tiers.push(tier);
      CAT_VARIANTS[catId].sizes.push(size);
      CAT_VARIANTS[catId].base = CAT_VARIANTS[catId].base || basePrice; // keep old base or set
      // Temporary placeholder image, will be scraped via Amazon soon
      CAT_VARIANTS[catId].img.push('https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop');
    }
  }

  // cat_01: Staple Grains, Cooking Oils, Pulses & Lentils
  add('cat_01', 'Aashirvaad Shudh Chakki Atta', 'Staple Grains', '5 kg', 250);
  add('cat_01', 'Saffola Gold Cooking Oil', 'Cooking Oils', '1 L', 180);
  add('cat_01', 'Tata Sampann Toor Dal', 'Pulses & Lentils', '1 kg', 160);

  // cat_02: Chips & Crisps, Chocolates, Healthy Snacks
  add('cat_02', 'Too Yumm! Multigrain Chips', 'Healthy Snacks', '90 g', 40);
  add('cat_02', 'RiteBite Max Protein Bar', 'Healthy Snacks', '50 g', 60);

  // cat_03: Packaged Juices, Soft Drinks, Water & Hydration
  add('cat_03', 'Kinley Packaged Drinking Water', 'Water & Hydration', '1 L', 20);
  add('cat_03', 'Gatorade Sports Drink', 'Water & Hydration', '500 ml', 50);

  // cat_04: Fresh Milk, Curd & Yogurt, Paneer & Cheese
  add('cat_04', 'Amul Masti Dahi', 'Curd & Yogurt', '400 g', 45);
  add('cat_04', 'Mother Dairy Paneer', 'Paneer & Cheese', '200 g', 85);
  add('cat_04', 'Britannia Cheese Slices', 'Paneer & Cheese', '100 g', 70);

  // cat_05: Floor Cleaners, Dish Wash, Detergents
  add('cat_05', 'Tide Plus Washing Powder', 'Detergents', '1 kg', 110);
  add('cat_05', 'Ariel Matic Liquid Detergent', 'Detergents', '1 L', 220);

  // cat_06: Face Care, Hair Care, Body Wash
  add('cat_06', 'Garnier Men Face Wash', 'Face Care', '100 g', 150);
  add('cat_06', 'Head & Shoulders Shampoo', 'Hair Care', '180 ml', 160);

  // cat_07: Diapers, Baby Food, Wipes & Care
  add('cat_07', 'Nestle Cerelac Baby Food', 'Baby Food', '300 g', 280);
  add('cat_07', 'Slurrp Farm Baby Cereal', 'Baby Food', '200 g', 299);
  add('cat_07', 'Johnson\'s Baby Wipes', 'Wipes & Care', '72 wipes', 150);
  add('cat_07', 'Himalaya Baby Lotion', 'Wipes & Care', '200 ml', 170);

  // cat_08: Dog Food, Cat Litter, Pet Grooming
  add('cat_08', 'Whiskas Adult Cat Food', 'Cat Litter', '1.2 kg', 350); // Mapped to cat food for now
  add('cat_08', 'Intersand Odourlock Cat Litter', 'Cat Litter', '12 kg', 1200);
  add('cat_08', 'Wahl Pet Shampoo', 'Pet Grooming', '700 ml', 450);

  // cat_09: Vitamins, First Aid, Protein & Fitness
  add('cat_09', 'Savlon Antiseptic Liquid', 'First Aid', '500 ml', 120);
  add('cat_09', 'Hansaplast Bandages', 'First Aid', '100 strips', 90);
  add('cat_09', 'Optimum Nutrition Gold Standard Whey', 'Protein & Fitness', '2 lbs', 3200);

  // cat_10: Frozen Vegetables, Frozen Snacks, Ice Cream
  add('cat_10', 'Safal Frozen Green Peas', 'Frozen Vegetables', '500 g', 65);
  add('cat_10', 'Amul Vanilla Ice Cream', 'Ice Cream', '1 L', 150);
  add('cat_10', 'Baskin Robbins Butterscotch', 'Ice Cream', '500 ml', 310);

  // cat_11: Leafy Greens, Root Vegetables, Exotic Vegetables
  add('cat_11', 'Fresh Broccoli', 'Exotic Vegetables', '1 pc', 80);
  add('cat_11', 'Red Bell Pepper', 'Exotic Vegetables', '250 g', 120);

  // cat_12: Citrus Fruits, Tropical Fruits, Berries
  add('cat_12', 'Imported Green Apples', 'Tropical Fruits', '4 pcs', 220);
  add('cat_12', 'Fresh Blueberries', 'Berries', '125 g', 350);

  // cat_13: Floor & Surface, Toilet Cleaners, Air Fresheners
  add('cat_13', 'Ambi Pur Room Freshener', 'Air Fresheners', '275 g', 190);
  add('cat_13', 'Godrej aer pocket', 'Air Fresheners', '10 g', 55);

  // cat_14: Notebooks, Pens & Markers, Office Supplies
  add('cat_14', 'Cello Butterflow Classic Pen', 'Pens & Markers', '5 pcs', 50);
  add('cat_14', 'Luxor Whiteboard Marker', 'Pens & Markers', '4 pcs', 120);
  add('cat_14', 'Post-it Sticky Notes', 'Office Supplies', '100 sheets', 80);
  add('cat_14', 'Kangaroo Desk Stapler', 'Office Supplies', '1 pc', 150);

  // cat_15: Phone Accessories, Cables & Adapters, Batteries
  add('cat_15', 'Duracell Ultra AA Batteries', 'Batteries', '4 pcs', 160);
  add('cat_15', 'Eveready AAA Batteries', 'Batteries', '10 pcs', 150);
  add('cat_15', 'Spigen iPhone 15 Case', 'Phone Accessories', '1 pc', 1200);

  // cat_16: Instant Noodles, Ready Meals, Soups & Broths
  add('cat_16', 'Ching\'s Secret Hot & Sour Soup', 'Soups & Broths', '55 g', 55);
  add('cat_16', 'Tata Q Spicy Chicken Biryani', 'Ready Meals', '330 g', 125);

  // cat_17: Breads & Loaves, Cookies & Buns, Cakes & Pastries
  add('cat_17', 'Britannia Good Day Cookies', 'Cookies & Buns', '600 g', 120);
  add('cat_17', 'Winkies Swiss Roll', 'Cakes & Pastries', '150 g', 60);

  // cat_18: Organic Grains, Cold-Press Oils, Superfoods
  add('cat_18', 'Natureland Organic Moong Dal', 'Organic Grains', '1 kg', 210);
  add('cat_18', 'Organic India Quinoa', 'Superfoods', '500 g', 350);

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  // Re-minify keys to match previous structure
  newCatVariantsStr = newCatVariantsStr.replace(/"brands":/g, 'brands:');
  newCatVariantsStr = newCatVariantsStr.replace(/"tiers":/g, 'tiers:');
  newCatVariantsStr = newCatVariantsStr.replace(/"sizes":/g, 'sizes:');
  newCatVariantsStr = newCatVariantsStr.replace(/"base":/g, 'base:');
  newCatVariantsStr = newCatVariantsStr.replace(/"img":/g, 'img:');
  newCatVariantsStr = newCatVariantsStr.replace(/"useAIDA":/g, 'useAIDA:');

  const newHtml = html.replace(matchStr, 'const CAT_VARIANTS = ' + newCatVariantsStr + ';\n\n');
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Expanded catalog for all categories.');
}

expandCatalog();
