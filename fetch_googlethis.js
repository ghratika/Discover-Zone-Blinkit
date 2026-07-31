const fs = require('fs');
const google = require('googlethis');

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
    if (cat.useAIDA || catId === 'cat_04') continue; // skip categories we don't want to touch
    
    if (cat.img && cat.brands) {
      console.log(`\n=== Processing Category ${catId} ===`);
      for (let i = 0; i < cat.brands.length; i++) {
        const brand = cat.brands[i];
        
        // Skip if it already has a good Blinkit or local AI image
        const currentImg = cat.img[i];
        if (currentImg && (currentImg.includes('cdn.grofers.com') || currentImg.startsWith('/images/'))) {
          console.log(`Skipping ${brand}, already has good image: ${currentImg.substring(0, 30)}...`);
          continue;
        }

        console.log(`Searching Google for: ${brand}`);
        
        try {
          const images = await google.image(brand + ' grocery product packaging white background', { safe: false });
          if (images && images.length > 0) {
            // Find the first valid http image that isn't a tiny thumbnail or placeholder
            let foundImg = null;
            for (const imgObj of images) {
              if (imgObj.url && imgObj.url.startsWith('http') && !imgObj.url.includes('placeholder')) {
                foundImg = imgObj.url;
                break;
              }
            }
            
            if (foundImg) {
              console.log(`  Found: ${foundImg}`);
              cat.img[i] = foundImg;
              totalReplaced++;
            } else {
              console.log(`  No suitable image found for ${brand} in results.`);
            }
          } else {
             console.log(`  No images returned for ${brand}`);
          }
        } catch(e) {
          console.error(`  Error searching ${brand}: ${e.message}`);
        }
        
        // Wait a bit to avoid hitting Google limits too hard
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.log(`\nTotal replaced: ${totalReplaced}`);

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  newCatVariantsStr = newCatVariantsStr.replace(/"brands":/g, 'brands:');
  newCatVariantsStr = newCatVariantsStr.replace(/"tiers":/g, 'tiers:');
  newCatVariantsStr = newCatVariantsStr.replace(/"sizes":/g, 'sizes:');
  newCatVariantsStr = newCatVariantsStr.replace(/"base":/g, 'base:');
  newCatVariantsStr = newCatVariantsStr.replace(/"img":/g, 'img:');
  newCatVariantsStr = newCatVariantsStr.replace(/"useAIDA":/g, 'useAIDA:');

  const newHtml = html.replace(matchStr, 'const CAT_VARIANTS = ' + newCatVariantsStr + ';\n\n');
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Updated ui/index.html with exact Google images.');
}

updateImages();
