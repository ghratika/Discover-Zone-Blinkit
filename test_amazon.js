const { chromium } = require('playwright');

async function testAmazon() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  });

  try {
    console.log("Searching Amazon for: Belkin USB-C Cable 1m");
    await page.goto('https://www.amazon.in/s?k=' + encodeURIComponent('Belkin USB-C Cable 1m'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const imgUrl = await page.evaluate(() => {
      const img = document.querySelector('.s-image');
      return img ? img.src : null;
    });
    
    console.log(`Result: ${imgUrl}`);
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

testAmazon();
