const fs = require('fs');
const { chromium } = require('playwright');

async function fixCat08() {
  const htmlPath = 'ui/index.html';
  let html = fs.readFileSync(htmlPath, 'utf8');

  const startIdx = html.indexOf('const CAT_VARIANTS = {');
  const endIdx = html.indexOf('// Automatically populate LINE_IMAGES');
  const matchStr = html.substring(startIdx, endIdx);
  const objStr = matchStr.replace('const CAT_VARIANTS = ', '').trim().replace(/;$/, '');
  
  let CAT_VARIANTS = eval('(' + objStr + ')');
  
  // Fill missing images with placeholder
  const cat = CAT_VARIANTS['cat_08'];
  while(cat.img.length < cat.brands.length) {
    cat.img.push('https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Re-scrape cat_08 items that are placeholders
  for (let i = 0; i < cat.brands.length; i++) {
    if (cat.img[i].includes('unsplash.com')) {
      const brand = cat.brands[i];
      console.log(`Syncing ${brand}...`);
      await page.goto('https://www.amazon.in/s?k=' + encodeURIComponent(brand), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const data = await page.evaluate(() => {
        const img = document.querySelector('.s-image');
        return img && !img.alt.includes('Sponsored') ? { name: img.alt, url: img.src } : null;
      });
      if (data) {
        cat.img[i] = data.url.replace('UY218', 'UY400');
        cat.brands[i] = data.name.split(',')[0].split('-')[0].trim().substring(0, 40);
        console.log(`  Updated: ${cat.brands[i]}`);
      }
    }
  }
  await browser.close();

  let newStr = JSON.stringify(CAT_VARIANTS, null, 2);
  newStr = newStr.replace(/"brands":/g, 'brands:').replace(/"tiers":/g, 'tiers:').replace(/"sizes":/g, 'sizes:').replace(/"base":/g, 'base:').replace(/"img":/g, 'img:').replace(/"useAIDA":/g, 'useAIDA:');
  fs.writeFileSync(htmlPath, html.replace(matchStr, 'const CAT_VARIANTS = ' + newStr + ';\n\n'));
  console.log('Fixed cat_08!');
}
fixCat08();
