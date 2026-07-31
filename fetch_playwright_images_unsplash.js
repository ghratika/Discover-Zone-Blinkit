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
  
  const catVariantsStr = objStr.replace(/U\+'/g, '\'U');
  let CAT_VARIANTS;
  try {
    CAT_VARIANTS = eval('(' + catVariantsStr + ')');
  } catch(e) {
    console.error('Failed to parse CAT_VARIANTS', e);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  let totalReplaced = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA || catId === 'cat_04') continue;
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const url = cat.img[i];
        if (!url || url.includes('images.unsplash.com')) {
          const brand = cat.brands[i];
          console.log(`Searching Playwright Yahoo for: ${brand}`);
          
          try {
            await page.goto(`https://images.search.yahoo.com/search/images?p=${encodeURIComponent(brand + ' product packaging')}`, { waitUntil: 'domcontentloaded' });
            
            await page.waitForTimeout(1000); 
            
            const imgUrl = await page.evaluate(() => {
              const imgs = document.querySelectorAll('img');
              for (const img of imgs) {
                let src = img.src || '';
                let dataSrc = img.getAttribute('data-src') || '';
                if ((src.includes('tse') && src.includes('bing.net')) || (src.includes('yimg.com') && src.includes('http'))) {
                  return src;
                }
                if ((dataSrc.includes('tse') && dataSrc.includes('bing.net')) || (dataSrc.includes('yimg.com') && dataSrc.includes('http'))) {
                  return dataSrc;
                }
              }
              return null;
            });

            if (imgUrl) {
              const cleanUrl = imgUrl.replace(/&amp;/g, '&');
              console.log(`  Found: ${cleanUrl}`);
              cat.img[i] = cleanUrl;
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
