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
  
  let CAT_VARIANTS;
  try {
    CAT_VARIANTS = eval('(' + objStr + ')');
  } catch(e) {
    console.error('Failed to parse CAT_VARIANTS', e);
    return;
  }

  // Update cat_02
  if (CAT_VARIANTS['cat_02'] && CAT_VARIANTS['cat_02'].img) {
    CAT_VARIANTS['cat_02'].img = [
      '/images/lays.png',
      '/images/cadbury.png',
      '/images/kurkure.png',
      '/images/kitkat.png'
    ];
  }

  // Update cat_03
  if (CAT_VARIANTS['cat_03'] && CAT_VARIANTS['cat_03'].img) {
    CAT_VARIANTS['cat_03'].img = [
      '/images/tropicana.png',
      '/images/cocacola.png',
      '/images/bisleri.png',
      '/images/paperboat.png'
    ];
  }

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  newCatVariantsStr = newCatVariantsStr.replace(/"brands":/g, 'brands:');
  newCatVariantsStr = newCatVariantsStr.replace(/"tiers":/g, 'tiers:');
  newCatVariantsStr = newCatVariantsStr.replace(/"sizes":/g, 'sizes:');
  newCatVariantsStr = newCatVariantsStr.replace(/"base":/g, 'base:');
  newCatVariantsStr = newCatVariantsStr.replace(/"img":/g, 'img:');
  newCatVariantsStr = newCatVariantsStr.replace(/"useAIDA":/g, 'useAIDA:');

  const newHtml = html.replace(matchStr, 'const CAT_VARIANTS = ' + newCatVariantsStr + ';\n\n');
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Updated ui/index.html with exact AI generated product images for cat_02 and cat_03.');
}

updateImages();
