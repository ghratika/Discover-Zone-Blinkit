const fs = require('fs');
const { chromium } = require('playwright');

async function fixCat09() {
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

  const cat = CAT_VARIANTS['cat_09'];
  
  // Revert names if they got ruined by "Sponsored Ad" script (it didn't run on cat_09 because cat_09 images were local!)
  // cat_09 images were /images/mccain.png. We will replace them with Amazon URLs.
  for (let i = 0; i < cat.brands.length; i++) {
    const brand = cat.brands[i];
    console.log(`Searching Amazon for: ${brand}`);
    
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

      if (exactData && exactData.url) {
        let cleanName = exactData.name.split(',')[0].split('-')[0].trim();
        if (cleanName.length > 40) cleanName = cleanName.substring(0, 40) + '...';
        
        console.log(`  Found: ${exactData.url}`);
        cat.img[i] = exactData.url.replace('UY218', 'UY400');
        cat.brands[i] = cleanName; // Sync the exact name directly!
      }
    } catch(e) {
      console.error(`  Error searching ${brand}: ${e.message}`);
    }
  }

  // Also clean up any "Sponsored Ad" names in other categories
  for (const catId in CAT_VARIANTS) {
    const c = CAT_VARIANTS[catId];
    if (c.brands) {
      for (let i = 0; i < c.brands.length; i++) {
        if (c.brands[i] && c.brands[i].includes('Sponsored Ad')) {
          // Restore generic name based on category
          if (catId === 'cat_16' && i === 1) c.brands[i] = 'Yippee Classic Noodles';
          if (catId === 'cat_16' && i === 2) c.brands[i] = 'Knorr Classic Tomato Soup';
          if (catId === 'cat_16' && i === 3) c.brands[i] = 'MTR Dum Biryani';
          if (catId === 'cat_17' && i === 1) c.brands[i] = 'English Oven Multigrain';
          if (catId === 'cat_17' && i === 2) c.brands[i] = 'Modern Brown Bread';
          if (catId === 'cat_17' && i === 3) c.brands[i] = 'Harvest Gold White Loaf';
          if (catId === 'cat_18' && i === 1) c.brands[i] = 'Organic Tattva Cold-Press Coconut Oil';
          if (catId === 'cat_18' && i === 2) c.brands[i] = 'True Elements Superseeds Mix';
          if (catId === 'cat_18' && i === 3) c.brands[i] = 'Kapiva Ashwagandha Gold';
          console.log(`Reverted Sponsored Ad for ${catId} index ${i} to ${c.brands[i]}`);
        }
      }
    }
  }

  await browser.close();

  let newCatVariantsStr = JSON.stringify(CAT_VARIANTS, null, 2);
  
  newCatVariantsStr = newCatVariantsStr.replace(/"brands":/g, 'brands:');
  newCatVariantsStr = newCatVariantsStr.replace(/"tiers":/g, 'tiers:');
  newCatVariantsStr = newCatVariantsStr.replace(/"sizes":/g, 'sizes:');
  newCatVariantsStr = newCatVariantsStr.replace(/"base":/g, 'base:');
  newCatVariantsStr = newCatVariantsStr.replace(/"img":/g, 'img:');
  newCatVariantsStr = newCatVariantsStr.replace(/"useAIDA":/g, 'useAIDA:');

  const newHtml = html.replace(matchStr, 'const CAT_VARIANTS = ' + newCatVariantsStr + ';\n\n');
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Updated ui/index.html with exact Amazon product names for cat_09 and cleaned up Sponsored Ads.');
}

fixCat09();
