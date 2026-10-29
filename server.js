// Local runner: node --env-file=.env server.js. On Vercel, public/ is served as static files and api/[action].js as a function.
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/[action]');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/')) { req.query = { action: url.slice(5) }; return handler(req, res); }
  const file = path.join(PUBLIC, url === '/' ? 'index.html' : url);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (database: ${process.env.SUPABASE_URL}, sheet: ${process.env.SHEET_LINK || 'none'})`));
