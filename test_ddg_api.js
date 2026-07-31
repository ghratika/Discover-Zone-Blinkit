const { image_search } = require('duckduckgo-images-api');

async function search() {
  try {
    const res = await image_search({ query: "Tropicana Orange 1L", moderate: true });
    console.log(res.slice(0, 3));
  } catch(e) {
    console.log("Error:", e);
  }
}
search();
