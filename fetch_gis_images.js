const fs = require('fs');
const gis = require('g-i-s');

function searchImage(query) {
  return new Promise((resolve, reject) => {
    gis(query, (error, results) => {
      if (error) {
        resolve(null);
      } else {
        if (results && results.length > 0) {
          resolve(results[0].url);
        } else {
          resolve(null);
        }
      }
    });
  });
}

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
    if (cat.useAIDA || catId === 'cat_04') continue; 
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const url = cat.img[i];
        // If it's a placeholder image or empty, we will replace it!
        if (!url || url.includes('placehold.co')) {
          const brand = cat.brands[i];
          console.log(`Searching Google Images (gis) for: ${brand}`);
          
          try {
            const newUrl = await searchImage(brand + ' product packaging');
            if (newUrl) {
              console.log(`  Found: ${newUrl}`);
              cat.img[i] = newUrl;
              totalReplaced++;
            } else {
              console.log(`  No images found for ${brand}`);
            }
          } catch(e) {
            console.error(`  Error searching ${brand}: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 500));
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
