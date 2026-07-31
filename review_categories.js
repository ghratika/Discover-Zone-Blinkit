const fs = require('fs');
const path = require('path');

function checkCategories() {
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

  console.log("# Category Review Report\n");

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA || catId === 'cat_04') continue; 
    
    console.log(`## ${catId}`);
    
    if (cat.brands && cat.tiers && cat.img) {
      for (let i = 0; i < cat.brands.length; i++) {
        const brand = cat.brands[i];
        const tier = cat.tiers[i];
        const img = cat.img[i];
        
        let imgStatus = "OK";
        if (!img) {
          imgStatus = "MISSING";
        } else if (img.startsWith('/images/')) {
          const localPath = path.join(__dirname, 'ui', img.substring(1));
          if (!fs.existsSync(localPath)) {
            imgStatus = `MISSING FILE: ${localPath}`;
          }
        } else if (!img.startsWith('http')) {
          imgStatus = `INVALID URL: ${img}`;
        }

        console.log(`- **Brand**: ${brand} | **Tier/Sub-Category**: ${tier} | **Image**: ${imgStatus}`);
      }
    } else {
       console.log(`- Missing brands, tiers, or img arrays`);
    }
    console.log("");
  }
}

checkCategories();
