const fs = require('fs');

async function fixTiers() {
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

  // Fix cat_05 (Household Cleaners)
  if (CAT_VARIANTS['cat_05'] && CAT_VARIANTS['cat_05'].tiers) {
    CAT_VARIANTS['cat_05'].tiers = [
      'Floor Cleaner',
      'Dishwash Liquid',
      'Laundry Liquid',
      'Bleach Cleaner'
    ];
  }

  // Fix cat_06 (Personal Care)
  if (CAT_VARIANTS['cat_06'] && CAT_VARIANTS['cat_06'].tiers) {
    CAT_VARIANTS['cat_06'].tiers = [
      'Face Wash',
      'Hair Care',
      'Body Wash',
      'Sensitive Wash'
    ];
  }

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
  console.log('Fixed tiers for cat_05 and cat_06 to better differentiate product types.');
}

fixTiers();
