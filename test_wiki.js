const https = require('https');

function searchWikiImage(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(query)}`;
  https.get(url, { headers: { 'User-Agent': 'Antigravity (test)' } }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const pages = JSON.parse(data).query.pages;
        const page = Object.values(pages)[0];
        if (page && page.original && page.original.source) {
          console.log(query, '->', page.original.source);
        } else {
          console.log(query, '-> NO IMAGE');
        }
      } catch (e) { console.error(e); }
    });
  });
}

searchWikiImage('Basmati Rice');
searchWikiImage('Sunflower Oil');
searchWikiImage('Potato Chips');
searchWikiImage('Cadbury Dairy Milk');
