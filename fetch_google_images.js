const fs = require('fs');
const google = require('googlethis');

async function updateImages() {
  const htmlPath = 'ui/index.html';
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Find CAT_VARIANTS between "const CAT_VARIANTS = {" and the start of the next block "// Automatically populate LINE_IMAGES"
  const startIdx = html.indexOf('const CAT_VARIANTS = {');
  const endIdx = html.indexOf('// Automatically populate LINE_IMAGES');
  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find CAT_VARIANTS block');
    return;
  }

  // The string includes "const CAT_VARIANTS = " and ends at "};\n\n"
  const matchStr = html.substring(startIdx, endIdx);
  const objStr = matchStr.replace('const CAT_VARIANTS = ', '').trim().replace(/;$/, '');
  
  // Parse CAT_VARIANTS
  const catVariantsStr = objStr.replace(/U\+'/g, '\'U');
  let CAT_VARIANTS;
  try {
    CAT_VARIANTS = eval('(' + catVariantsStr + ')');
  } catch(e) {
    console.error('Failed to parse CAT_VARIANTS', e);
    return;
  }

  const options = {
    page: 0,
    safe: true,
    additional_params: {
      hl: 'en'
    }
  };

  let totalReplaced = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA) continue;
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const url = cat.img[i];
        if (!url || url.startsWith('U')) {
          const brand = cat.brands[i];
          console.log(`Searching Google Images for: ${brand}`);
          try {
            const images = await google.image(brand + ' product', options);
            if (images.length > 0) {
              const newUrl = images[0].url;
              console.log(`  Found: ${newUrl}`);
              cat.img[i] = newUrl;
              totalReplaced++;
            } else {
              console.log(`  No images found for ${brand}`);
              cat.img[i] = '';
            }
          } catch(e) {
            console.error(`  Error searching ${brand}: ${e.message}`);
            cat.img[i] = '';
          }
          // Delay to prevent rate limiting
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  console.log(`Total replaced: ${totalReplaced}`);

  // Re-serialize CAT_VARIANTS
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
