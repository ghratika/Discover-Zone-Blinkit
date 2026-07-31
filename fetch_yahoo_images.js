const fs = require('fs');
const https = require('https');

async function searchYahooImage(query) {
  const url = 'https://images.search.yahoo.com/search/images?p=' + encodeURIComponent(query);
  const options = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  };
  
  return new Promise((resolve, reject) => {
    https.get(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Look for any Bing thumbnail
        const match = data.match(/https:\/\/tse\d\.mm\.bing\.net\/th\?id=OIP\.[a-zA-Z0-9_-]+/);
        if (match) resolve(match[0]);
        else resolve(null);
      });
      res.on('error', err => reject(err));
    }).on('error', err => reject(err));
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
  
  const catVariantsStr = objStr.replace(/U\+'/g, '\'U');
  let CAT_VARIANTS;
  try {
    CAT_VARIANTS = eval('(' + catVariantsStr + ')');
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
        if (!url || url.startsWith('U')) {
          const brand = cat.brands[i];
          console.log(`Searching Yahoo Images for: ${brand}`);
          try {
            const newUrl = await searchYahooImage(brand + ' product');
            if (newUrl) {
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
