const { chromium } = require('playwright');

async function testScrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  });

  try {
    console.log("Searching Amazon for: Basmati Rice");
    await page.goto('https://www.amazon.in/s?k=Basmati+Rice&i=grocery', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const products = await page.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"]');
      for (let i = 0; i < items.length && i < 4; i++) {
        const titleEl = items[i].querySelector('h2 a span');
        const imgEl = items[i].querySelector('.s-image');
        if (titleEl && imgEl) {
          let title = titleEl.innerText;
          // Clean up Amazon titles which are very long
          title = title.split(',')[0].substring(0, 35).trim();
          results.push({ name: title, img: imgEl.src.replace('UY218', 'UY400') });
        }
      }
      return results;
    });
    
    console.log("Results:");
    console.log(products);
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

testScrape();
