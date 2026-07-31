const fs = require('fs');
const html = fs.readFileSync('test_html.html', 'utf8');
const match = html.match(/src="(https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=tbn:[^"]+)"/);
if (match) console.log(match[1]);
else console.log('NOT FOUND');
