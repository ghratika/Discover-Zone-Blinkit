const https = require('https');
const fs = require('fs');

function searchGoogleImage(query) {
  const url = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  };
  https.get(url, options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      fs.writeFileSync('test_html.html', data);
      console.log('Saved to test_html.html');
    });
  });
}

searchGoogleImage('Daawat Basmati Rice');
