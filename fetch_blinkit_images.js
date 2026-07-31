const fs = require('fs');
const { chromium } = require('playwright');

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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  });

  let totalReplaced = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA || catId === 'cat_04') continue;
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        // ALWAYS replace with Blinkit images to ensure 100% authenticity
        const brand = cat.brands[i];
        console.log(`Searching Blinkit for: ${brand}`);
        
        try {
          await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(brand)}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1500); 
          
          const imgUrl = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            // Look for actual product images on Blinkit (usually on cdn.grofers.com and contain 'product' or similar)
            for (const img of imgs) {
              if (img.src && img.src.includes('cdn.grofers.com') && (img.src.includes('product') || img.src.includes('app-assets'))) {
                // Ensure we pick a reasonably sized image, some are 15-mins ETA icons.
                if (!img.src.includes('eta-icons')) {
                  // If it has scale-down, change w=90 to w=400 for higher res!
                  return img.src.replace('w=90', 'w=400').replace('w=270', 'w=400');
                }
              }
            }
            return null;
          });

          if (imgUrl) {
            console.log(`  Found: ${imgUrl}`);
            cat.img[i] = imgUrl;
            totalReplaced++;
          } else {
            console.log(`  No images found for ${brand}`);
          }
        } catch(e) {
          console.error(`  Error searching ${brand}: ${e.message}`);
        }
      }
    }
  }

  await browser.close();
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
