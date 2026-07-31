const { chromium } = require('playwright');

async function testScrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  });

  try {
    console.log("Searching Amazon for: Lays Classic Salted");
    await page.goto('https://www.amazon.in/s?k=' + encodeURIComponent('Lays Classic Salted'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const products = await page.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('.s-image');
      for (let i = 0; i < items.length && i < 4; i++) {
        results.push({ name: items[i].alt, img: items[i].src });
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
