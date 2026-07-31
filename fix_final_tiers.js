const fs = require('fs');

async function finalTiersFix() {
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

  // Fix cat_07 (Diapers) -> Move from age sizes to product types
  if (CAT_VARIANTS['cat_07'] && CAT_VARIANTS['cat_07'].tiers) {
    CAT_VARIANTS['cat_07'].tiers = [
      'Taped Diapers',
      'Pant Style Diapers',
      'Premium Pants',
      'Economy Pants'
    ];
  }

  // Fix cat_08 (Pet Care) -> "Pedigree Adult" was incorrectly tagged as "Puppy"
  if (CAT_VARIANTS['cat_08'] && CAT_VARIANTS['cat_08'].tiers) {
    CAT_VARIANTS['cat_08'].tiers = [
      'Adult Dog Food',
      'Medium Breed Food',
      'Economy Dog Food',
      'Premium Dog Food'
    ];
  }
  
  // Fix cat_15 (Electronics) -> Refine cable descriptions
  if (CAT_VARIANTS['cat_15'] && CAT_VARIANTS['cat_15'].tiers) {
    CAT_VARIANTS['cat_15'].tiers = [
      'Type-C Cable',
      'Braided Cable',
      'Power Bank',
      'LED Bulb'
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
  console.log('Fixed cat_07, cat_08, and cat_15 tiers.');
}

finalTiersFix();
