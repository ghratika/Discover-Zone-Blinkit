const fs = require('fs');

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
  
  const catVariantsStr = objStr.replace(/U\+'/g, '\'U');
  let CAT_VARIANTS;
  try {
    CAT_VARIANTS = eval('(' + catVariantsStr + ')');
  } catch(e) {
    console.error('Failed to parse CAT_VARIANTS', e);
    return;
  }

  let totalReplaced = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA || catId === 'cat_04') continue; // cat_04 already uses local images
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const url = cat.img[i];
        if (!url || url.startsWith('U')) {
          const brand = cat.brands[i];
          // Use placehold.co for a clean, reliable placeholder that shows the product name
          const placeholderUrl = `https://placehold.co/400x400/FFF/000?text=${encodeURIComponent(brand)}`;
          cat.img[i] = placeholderUrl;
          totalReplaced++;
        }
      }
    }
  }

  console.log(`Total replaced: ${totalReplaced}`);

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  // Format to match original roughly
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
