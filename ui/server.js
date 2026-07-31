/**
 * ui/server.js
 * Minimal HTTP server that serves index.html and exposes the API layer
 * over simple GET/POST endpoints so the browser-side JS can call them.
 *
 * Run: node ui/server.js
 * Open: http://localhost:3000
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const { getDiscoverSuggestions } = require('../api/getDiscoverSuggestions');
const { getCategoryDetail }      = require('../api/getCategoryDetail');
const { placeOrder }             = require('../api/placeOrder');
const store                      = require('../engine/store');

const PORT     = 3000;
const UI_DIR   = path.join(__dirname);

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
};

function sendFile(res, filePath, binary = false) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'text/plain';
  try {
    const content = fs.readFileSync(filePath, binary ? null : 'utf8');
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}


const handler = (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API routes ─────────────────────────────────────────────────────────────

  // GET /api/users — list demo users (id + order count) for the user selector
  if (pathname === '/api/users') {
    const demoIds = ['u_001', 'u_035', 'u_048', 'u_141', 'u_161'];
    const list = store.users
      .filter(u => demoIds.includes(u.user_id))
      .map(u => ({
        user_id:     u.user_id,
        order_count: u.order_history.length
      }));
    return sendJSON(res, list);
  }

  // GET /api/discover?userId=u_001
  if (pathname === '/api/discover') {
    const userId = parsed.query.userId;
    if (!userId) return sendJSON(res, { error: 'userId required' }, 400);
    return sendJSON(res, getDiscoverSuggestions(userId));
  }

  // GET /api/category?categoryId=cat_01
  if (pathname === '/api/category') {
    const categoryId = parsed.query.categoryId;
    if (!categoryId) return sendJSON(res, { error: 'categoryId required' }, 400);
    const detail = getCategoryDetail(categoryId);
    if (!detail) return sendJSON(res, { error: 'Category not found' }, 404);
    return sendJSON(res, detail);
  }

  // POST /api/order  body: { userId, categoryId }
  if (pathname === '/api/order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { userId, categoryId } = JSON.parse(body);
        return sendJSON(res, placeOrder(userId, categoryId));
      } catch (e) {
        return sendJSON(res, { error: 'Invalid JSON body' }, 400);
      }
    });
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────────
  if (pathname === '/' || pathname === '/index.html') {
    return sendFile(res, path.join(UI_DIR, 'index.html'), false);
  }

  // Serve anything under /images/ as binary
  if (pathname.startsWith('/images/')) {
    const imgPath = path.join(UI_DIR, pathname);
    return sendFile(res, imgPath, true);
  }

  res.writeHead(404);
  res.end('Not found');
};

const server = http.createServer(handler);

if (process.env.VERCEL) {
  module.exports = handler;
} else {
  server.listen(process.env.PORT || PORT, () => {
  console.log(`\n✅  Discover Zone UI running at http://localhost:${PORT}\n`);
});

}
