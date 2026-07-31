const { chromium } = require('playwright');

async function testBlinkit() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  });

  try {
    console.log("Navigating to Blinkit...");
    await page.goto('https://blinkit.com/s/?q=mccain+aloo+tikki', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Attempt to extract image
    const imgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src && src.includes('http'));
    });
    
    console.log(`Found ${imgs.length} images`);
    console.log("Sample:", imgs.slice(0, 5));

  } catch(e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
}

testBlinkit();
