// Dependency-free Node server (Node 18+). Run: node server.js  (or node --env-file=.env server.js to send results to a Google Sheet)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EXAM_TITLE, EXAM_MINUTES, OBJECTS, SHAPE_IMG, SHAPE_OPTIONS, SHAPE_ANSWER } = require('./questions');

const PORT = process.env.PORT || 3000;
const SCRIPT_URL = process.env.SCRIPT_URL; // Apps Script web-app URL; unset = results stay in data/store.json only
const SCRIPT_SECRET = process.env.SCRIPT_SECRET || '';
const SHEET_LINK = process.env.SHEET_LINK; // the Google Sheet that receives the results (any sheet the script owner can edit)
const DB = path.join(__dirname, 'data', 'store.json');
if (SCRIPT_URL && !SHEET_LINK) throw new Error('SCRIPT_URL is set but SHEET_LINK is not. Put the Google Sheet link in SHEET_LINK.');

// The local file is the source of truth. Every call is synchronous, so each action is atomic in this single-threaded process.
const readDb = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : { logins: {}, results: [] });
const writeDb = (db) => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(db, null, 2)); };

function store(action, body) {
  const db = readDb();
  const l = db.logins[body.id];
  let res;
  if (action === 'login') {
    if (l) res = { ok: false, error: 'used' };
    else { db.logins[body.id] = { token: body.token, at: Date.now(), startedAt: null, submitted: false }; res = { ok: true }; }
  } else if (!l || l.token !== body.token) res = { ok: false, error: 'auth' };
  else if (action === 'status') res = { ok: true, ...l };
  else if (action === 'start') { l.startedAt = l.startedAt || Date.now(); res = { ok: true }; }
  else if (l.submitted) res = { ok: false, error: 'submitted' };
  else { l.submitted = true; db.results.push({ row: body.row, sentTo: null }); res = { ok: true }; }
  writeDb(db);
  return res;
}

// Sends every result not yet in SHEET_LINK, in one batch. Changing SHEET_LINK therefore copies all results into the new sheet.
// The last column (Ref) lets the script skip rows it already has, so a retry after a lost reply never duplicates a row.
let syncing = false;
async function sync() {
  if (!SCRIPT_URL || syncing) return;
  const todo = readDb().results.filter((r) => r.sentTo !== SHEET_LINK).map((r) => r.row);
  if (!todo.length) return;
  syncing = true;
  try {
    const r = await (await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ secret: SCRIPT_SECRET, sheet: SHEET_LINK, header: HEADER, rows: todo, answers: ANSWERS }),
    })).json();
    if (!r.ok) throw new Error(r.error);
    const sent = new Set(todo.map((row) => row[row.length - 1]));
    const db = readDb(); // re-read: students may have submitted while the request was out
    for (const x of db.results) if (sent.has(x.row[x.row.length - 1])) x.sentTo = SHEET_LINK;
    writeDb(db);
    console.log(`Google Sheet: ${todo.length} result(s) sent (${r.added} new)`);
  } catch (e) {
    console.error(`Google Sheet: send failed, retrying in 10 s. ${e.message}`);
  } finally {
    syncing = false;
  }
}

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((ok, no) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { no(e); } });
});

// Token = "<id>.<login time ms>.<random>", sent in the x-token header. The store only accepts the exact token it issued.
const who = (req) => { const t = req.headers['x-token'] || ''; return { id: t.split('.')[0], token: t }; };
const time = (ms) => new Date(ms).toLocaleString('sv-SE'); // "2026-10-29 11:15:03", local time; Sheets reads it as a date-time

// Sheet columns go bucket 1-3, cycle 1-3, wrench 1-3, whatever order the questions are asked in.
const COLS = [...OBJECTS].sort((a, b) => a.img.localeCompare(b.img));
const label = (q) => { const [, o, n] = q.img.match(/(\w+)-(\d+)/); return `${o[0].toUpperCase()}${o.slice(1)} ${n}`; };

// The "Correct answers" tab, rewritten on every send so it always matches questions.js.
const ANSWERS = [['Question', 'Object', 'Correct answer', 'Tap area (picture width = 1)'],
  ...COLS.map((q) => [label(q), q.object, q.targets ? `Tap the ${q.object}` : `No ${q.object} (it is not in the picture)`,
    (q.targets || []).map((t) => `x ${t.x}, y ${t.y}, radius ${t.r}`).join('  or  ')]),
  ['Shape question', 'hidden shapes', SHAPE_ANSWER.join(', '), '+1 per correct shape, -1 per wrong shape, minimum 0']];

function grade(a) {
  const cells = [];
  let objScore = 0;
  for (const q of COLS) {
    const x = (a.objects || {})[q.id];
    let ok = false;
    if (x && x.none === true) ok = !q.targets;
    else if (x && Number.isFinite(x.x) && Number.isFinite(x.y)) ok = (q.targets || []).some((t) => Math.hypot(x.x - t.x, x.y - t.y) <= t.r);
    if (ok) objScore++;
    cells.push(!x ? 'Not answered' : ok ? 'Correct' : 'Not correct');
  }
  const picks = [...new Set(Array.isArray(a.shapes) ? a.shapes : [])].filter((s) => SHAPE_OPTIONS.includes(s));
  const right = picks.filter((s) => SHAPE_ANSWER.includes(s)).length, wrong = picks.length - right;
  const shapeScore = Math.max(0, right - wrong); // wrong picks cost a point
  return { cells, picks, right, wrong, objScore, shapeScore, total: objScore + shapeScore, max: OBJECTS.length + SHAPE_ANSWER.length };
}

const HEADER = ['Student ID', 'Logged in at', 'Started at', 'Submitted at', ...COLS.map(label),
  'Shapes correct', 'Shapes not correct', 'Shapes picked', 'Picture score', 'Shape score', 'Total', 'Out of', 'Time taken (s)', 'Late', 'Ref'];

async function api(req, res, url) {
  if (url === '/api/login' && req.method === 'POST') {
    const id = String((await readBody(req)).id || '').trim();
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(id)) return json(res, 400, { error: 'Enter your student ID (letters and numbers only).' });
    const token = `${id}.${Date.now()}.${crypto.randomBytes(16).toString('hex')}`;
    const r = store('login', { id, token });
    if (!r.ok) return json(res, 403, { error: 'This ID has already logged in.' });
    return json(res, 200, { token });
  }
  const { id, token } = who(req);
  if (!id) return json(res, 401, { error: 'Not logged in.' });
  const s = store('status', { id, token });
  if (!s.ok) return json(res, 401, { error: 'Session not valid.' });

  if (url === '/api/start' && req.method === 'POST') { store('start', { id, token }); return json(res, 200, { ok: true }); }
  if (url === '/api/questions') {
    if (s.submitted) return json(res, 200, { submitted: true });
    if (!s.startedAt) return json(res, 200, { notStarted: true, minutes: EXAM_MINUTES });
    return json(res, 200, {
      title: EXAM_TITLE,
      remaining: Math.max(0, Math.round((s.startedAt + EXAM_MINUTES * 60000 - Date.now()) / 1000)),
      objects: OBJECTS.map(({ id, object, img }) => ({ id, object, img })),
      shapes: { img: SHAPE_IMG, options: SHAPE_OPTIONS },
    });
  }
  if (url === '/api/submit' && req.method === 'POST') {
    if (!s.startedAt) return json(res, 400, { error: 'The test has not started.' });
    const g = grade(await readBody(req));
    const now = Date.now(), taken = Math.round((now - s.startedAt) / 1000); // late answers are still saved, but flagged
    const row = [id, time(s.at), time(s.startedAt), time(now), ...g.cells, g.right, g.wrong, g.picks.join(', '),
      g.objScore, g.shapeScore, g.total, g.max, taken, taken > EXAM_MINUTES * 60 + 60 ? 'LATE' : '', 'r-' + token.split('.')[2].slice(0, 12)];
    const r = store('submit', { id, token, row });
    if (r.ok) sync();
    return json(res, r.ok ? 200 : 409, r.ok ? { ok: true } : { error: 'Already submitted.' });
  }
  json(res, 404, { error: 'Not found' });
}

const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url.startsWith('/api/')) return await api(req, res, url);
    const file = path.join(__dirname, 'public', url === '/' ? 'index.html' : url);
    if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'Server error' });
  }
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}  (results: data/store.json${SCRIPT_URL ? ` + Google Sheet ${SHEET_LINK}` : ''})`);
  setInterval(sync, 10000);
  sync();
});
