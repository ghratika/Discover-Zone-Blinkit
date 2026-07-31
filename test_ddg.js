const https = require('https');

function searchDuckDuckGo(query) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query + ' images');
  const options = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  };
  https.get(url, options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      // DuckDuckGo sometimes includes external image URLs in its HTML.
      const match = data.match(/src="\/\/external-content\.duckduckgo\.com\/iu\/\?u=([^"&]+)/);
      if (match) {
        console.log(query, '->', decodeURIComponent(match[1]));
      } else {
        console.log(query, '-> NOT FOUND');
      }
    });
  });
}

searchDuckDuckGo('Daawat Basmati Rice');
searchDuckDuckGo('Camlin Graph Notebook');
