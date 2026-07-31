const fs = require('fs');
const puppeteer = require('puppeteer');

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

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

  let totalReplaced = 0;

  for (const catId in CAT_VARIANTS) {
    const cat = CAT_VARIANTS[catId];
    if (cat.useAIDA || catId === 'cat_04') continue;
    
    if (cat.img && cat.brands) {
      for (let i = 0; i < cat.brands.length; i++) {
        const url = cat.img[i];
        if (!url || url.startsWith('U')) {
          const brand = cat.brands[i];
          console.log(`Searching via Puppeteer for: ${brand}`);
          
          try {
            await page.goto(`https://images.search.yahoo.com/search/images?p=${encodeURIComponent(brand + ' product')}`, { waitUntil: 'domcontentloaded' });
            
            // Wait for the first image thumbnail
            await page.waitForSelector('img.process', { timeout: 5000 }).catch(() => {});
            
            // Extract the src of the first image that has tse\d.mm.bing.net
            const imgUrl = await page.evaluate(() => {
              const imgs = document.querySelectorAll('img');
              for (const img of imgs) {
                if (img.src && img.src.includes('tse') && img.src.includes('bing.net')) {
                  return img.src;
                }
                const dataSrc = img.getAttribute('data-src');
                if (dataSrc && dataSrc.includes('tse') && dataSrc.includes('bing.net')) {
                  return dataSrc;
                }
              }
              return null;
            });

            if (imgUrl) {
              console.log(`  Found: ${imgUrl}`);
              cat.img[i] = imgUrl.replace(/&amp;/g, '&');
              totalReplaced++;
            } else {
              console.log(`  No images found for ${brand}`);
              cat.img[i] = '';
            }
          } catch(e) {
            console.error(`  Error searching ${brand}: ${e.message}`);
            cat.img[i] = '';
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
