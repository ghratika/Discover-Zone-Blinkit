const fs = require('fs');

const catImages = {
  'cat_01': 'https://images.unsplash.com/photo-1586201464-b8f7e1673b37?w=400&h=400&fit=crop', // Rice/Grains
  'cat_02': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=400&fit=crop', // Snacks/Chips
  'cat_03': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=400&fit=crop', // Drinks/Cola
  'cat_04': '', // Dairy uses local images
  'cat_05': 'https://images.unsplash.com/photo-1584820927498-cafe4c153835?w=400&h=400&fit=crop', // Cleaners/Detergent
  'cat_06': 'https://images.unsplash.com/photo-1608248593856-11f6d3389279?w=400&h=400&fit=crop', // Soap/Skincare
  'cat_07': 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400&h=400&fit=crop', // Baby Products
  'cat_08': 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&h=400&fit=crop', // Supplements/Pills
  'cat_09': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop', // Ice Cream / Frozen
  'cat_10': 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400&h=400&fit=crop', // Veggies/Fruits
  'cat_11': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&h=400&fit=crop', // Home Cleaning
  'cat_12': 'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?w=400&h=400&fit=crop', // Stationery
  'cat_13': 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&fit=crop', // Electronics/Cables
  'cat_14': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&h=400&fit=crop', // Noodles/Soup
  'cat_15': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop', // Bread
  'cat_16': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop'  // Organic Foods
};

async function updateImages() {
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

  let totalReplaced = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA) continue; 
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const url = cat.img[i];
        if (!url || url.includes('placehold.co')) {
          if (catImages[catId]) {
            cat.img[i] = catImages[catId];
            totalReplaced++;
          }
        }
      }
    }
  }

  console.log(`Total replaced: ${totalReplaced}`);

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  newCatVariantsStr = newCatVariantsStr.replace(/"brands":/g, 'brands:');
  newCatVariantsStr = newCatVariantsStr.replace(/"tiers":/g, 'tiers:');
  newCatVariantsStr = newCatVariantsStr.replace(/"sizes":/g, 'sizes:');
  newCatVariantsStr = newCatVariantsStr.replace(/"base":/g, 'base:');
  newCatVariantsStr = newCatVariantsStr.replace(/"img":/g, 'img:');
  newCatVariantsStr = newCatVariantsStr.replace(/"useAIDA":/g, 'useAIDA:');

  const newHtml = html.replace(matchStr, 'const CAT_VARIANTS = ' + newCatVariantsStr + ';\n\n');
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Updated ui/index.html');
}

updateImages();
