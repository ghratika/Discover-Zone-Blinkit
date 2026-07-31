const fs = require('fs');
const { chromium } = require('playwright');

async function syncNewItems() {
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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  });

  let totalUpdated = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA || catId === 'cat_04') continue; 
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const brand = cat.brands[i];
        const currentImg = cat.img[i];
        
        // Find newly added placeholder items
        if (currentImg && currentImg.includes('unsplash.com')) {
          console.log(`Syncing new item from Amazon: ${brand}`);
          
          try {
            await page.goto('https://www.amazon.in/s?k=' + encodeURIComponent(brand), { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
            
            const exactData = await page.evaluate(() => {
              const imgs = document.querySelectorAll('.s-image');
              for (let img of imgs) {
                if (img && !img.alt.includes('Sponsored Ad')) {
                  return { name: img.alt, url: img.src };
                }
              }
              return null;
            });

            if (exactData && exactData.name && exactData.url) {
              let cleanName = exactData.name.split(',')[0].split('-')[0].trim();
              if (cleanName.length > 40) cleanName = cleanName.substring(0, 40) + '...';
              
              cat.brands[i] = cleanName;
              cat.img[i] = exactData.url.replace('UY218', 'UY400');
              totalUpdated++;
              console.log(`  Updated: ${brand} -> ${cleanName} (${exactData.url})`);
            }
          } catch(e) {
            console.error(`  Error syncing ${brand}: ${e.message}`);
          }
        }
      }
    }
  }

  await browser.close();
  console.log(`\nTotal new items synced: ${totalUpdated}`);

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  newCatVariantsStr = newCatVariantsStr.replace(/"brands":/g, 'brands:');
  newCatVariantsStr = newCatVariantsStr.replace(/"tiers":/g, 'tiers:');
  newCatVariantsStr = newCatVariantsStr.replace(/"sizes":/g, 'sizes:');
  newCatVariantsStr = newCatVariantsStr.replace(/"base":/g, 'base:');
  newCatVariantsStr = newCatVariantsStr.replace(/"img":/g, 'img:');
  newCatVariantsStr = newCatVariantsStr.replace(/"useAIDA":/g, 'useAIDA:');

  const newHtml = html.replace(matchStr, 'const CAT_VARIANTS = ' + newCatVariantsStr + ';\n\n');
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Updated ui/index.html with exact Amazon product names and images for new items.');
}

syncNewItems();
