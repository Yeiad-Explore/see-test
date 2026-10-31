// Every /api/<action> call lands here: a Vercel function, and also what server.js runs locally.
// State lives in Supabase (see supabase/schema.sql); each step is one atomic database function.
const crypto = require('crypto');
const { EXAM_TITLE, OBJECTS, SHAPES, SHAPE_OPTIONS, ILLUSIONS, NOTHING_ELSE } = require('../questions');

const { SUPABASE_URL, SUPABASE_KEY, DB_SECRET, SCRIPT_URL, SCRIPT_SECRET = '', SHEET_LINK, EXAM_TZ = 'Asia/Dhaka' } = process.env;

const rpc = async (fn, args) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ p_key: DB_SECRET, ...args }),
  });
  if (!r.ok) throw new Error(`${fn} failed: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null; // functions that return nothing (st_mark_sent) send an empty body
};

// Sends unsent results to the Google Sheet, one batch at a time. The database hands out each batch to a single caller
// (and a caller that finds one in flight gets nothing), so 100 students submitting together make one call, not 100.
// A batch that fails is handed out again after its 60 s lease runs out, by the next submit, /api/sync, or the daily cron.
async function sync() {
  if (!SCRIPT_URL) return;
  for (let i = 0; i < 5; i++) {
    const rows = await rpc('st_claim', { p_link: SHEET_LINK, p_limit: 200 });
    if (!rows.length) return;
    try {
      const r = await (await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ secret: SCRIPT_SECRET, sheet: SHEET_LINK, header: HEADER, rows, answers: ANSWERS }),
        signal: AbortSignal.timeout(20000),
      })).json();
      if (!r.ok) throw new Error(r.error);
      await rpc('st_mark_sent', { p_refs: rows.map((x) => x[x.length - 1]), p_link: SHEET_LINK });
      console.log(`Google Sheet: ${rows.length} result(s) sent (${r.added} new)`);
    } catch (e) {
      console.error(`Google Sheet: send failed, will retry. ${e.message}`);
      return;
    }
  }
}

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const readBody = async (req) => {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; // Vercel parses it already
  let s = '';
  for await (const c of req) { s += c; if (s.length > 1e5) throw new Error('body too large'); }
  return JSON.parse(s || '{}');
};

// Token = "<id>.<login time ms>.<random>", sent in the x-token header. The database only accepts the exact token it was given at login.
const who = (req) => { const t = req.headers['x-token'] || ''; return { id: t.split('.')[0], token: t }; };
const time = (ms) => new Date(Number(ms)).toLocaleString('sv-SE', { timeZone: EXAM_TZ }); // "2026-10-29 11:15:03"; Sheets reads it as a date-time

// Sheet columns go bucket 1-3, cycle 1-3, wrench 1-3, whatever order the questions are asked in.
const COLS = [...OBJECTS].sort((a, b) => a.img.localeCompare(b.img));
const label = (q) => { const [, o, n] = q.img.match(/(\w+)-(\d+)/); return `${o[0].toUpperCase()}${o.slice(1)} ${n}`; };

// The "Correct answers" tab, rewritten on every send so it always matches questions.js.
const ANSWERS = [['Question', 'Object', 'Correct answer', 'Tap area (picture width = 1)'],
  ...COLS.map((q) => [label(q), q.object, q.targets ? `Tap the ${q.object}` : `No ${q.object} (it is not in the picture)`,
    (q.targets || []).map((t) => `x ${t.x}, y ${t.y}, radius ${t.r}`).join('  or  ')]),
  ...SHAPES.map((q, i) => [`Shape ${i + 1}`, 'hidden shape', `Red shape ${q.answer} (${SHAPE_OPTIONS.find((o) => o.id === q.answer).name})`, 'Tap the red shape hidden in the drawing']),
  ...ILLUSIONS.map((q, i) => [`Illusion ${i + 1}`, 'illusion', 'Not scored (no right answer)', `Choices: ${q.choices.join(' / ')} / ${NOTHING_ELSE}`])];

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
  const sh = a.shapes && typeof a.shapes === 'object' && !Array.isArray(a.shapes) ? a.shapes : {};
  const shapeCells = SHAPES.map((q) => (!SHAPE_OPTIONS.some((o) => o.id === sh[q.id]) ? 'Not answered' : sh[q.id] === q.answer ? 'Correct' : 'Not correct'));
  const right = shapeCells.filter((c) => c === 'Correct').length, wrong = shapeCells.filter((c) => c === 'Not correct').length;
  // Illusions are not scored: three cells each (first answer, "what else" answer, hint opened).
  const il = a.illusions && typeof a.illusions === 'object' && !Array.isArray(a.illusions) ? a.illusions : {};
  const illusionCells = ILLUSIONS.flatMap((q) => {
    const x = il[q.id] || {};
    return [q.choices.includes(x.first) ? x.first : 'Not answered', [...q.choices, NOTHING_ELSE].includes(x.also) ? x.also : 'Not answered', x.hint === true ? 'Yes' : 'No'];
  });
  return { cells, shapeCells, illusionCells, right, wrong, objScore, total: objScore + right, max: OBJECTS.length + SHAPES.length };
}

// The illusion columns sit just before Ref so that sheets created before they existed keep their layout (Code.gs inserts them).
const HEADER = ['Student ID', 'Student Name', 'Logged in at', 'Started at', 'Submitted at', ...COLS.map(label), ...SHAPES.map((_, i) => `Shape ${i + 1}`),
  'Shapes correct', 'Shapes not correct', 'Picture score', 'Shape score', 'Total', 'Out of', 'Time taken (s)',
  ...ILLUSIONS.flatMap((_, i) => [`Illusion ${i + 1} first`, `Illusion ${i + 1} also`, `Illusion ${i + 1} hint used`]), 'Ref'];

module.exports = async (req, res) => {
  const action = req.query.action;
  try {
    if (action === 'sync') { await sync(); return json(res, 200, { ok: true }); } // safe to open: it only pushes pending results to the configured sheet

    if (action === 'login' && req.method === 'POST') {
      const body = await readBody(req);
      const id = String(body.id || '').trim();
      const name = String(body.name || '').replace(/\s+/g, ' ').trim();
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(id)) return json(res, 400, { error: 'Enter your student ID (letters and numbers only).' });
      if (name.length < 2 || name.length > 80) return json(res, 400, { error: 'Enter your full name.' });
      const token = `${id}.${Date.now()}.${crypto.randomBytes(16).toString('hex')}`;
      if (!(await rpc('st_login', { p_id: id, p_name: name, p_token: token }))) return json(res, 403, { error: 'This ID has already logged in.' });
      return json(res, 200, { token });
    }

    const { id, token } = who(req);
    if (!id) return json(res, 401, { error: 'Not logged in.' });
    const s = await rpc('st_status', { p_id: id, p_token: token });
    if (!s.ok) return json(res, 401, { error: 'Session not valid.' });

    if (action === 'start' && req.method === 'POST') { await rpc('st_start', { p_id: id, p_token: token }); return json(res, 200, { ok: true }); }
    if (action === 'questions') {
      if (s.submitted) return json(res, 200, { submitted: true });
      if (!s.startedAt) return json(res, 200, { notStarted: true });
      return json(res, 200, {
        title: EXAM_TITLE,
        name: s.name || '',
        objects: OBJECTS.map(({ id, object, img }) => ({ id, object, img })),
        shapes: SHAPES.map(({ id, img }) => ({ id, img })),
        options: SHAPE_OPTIONS.map(({ id, img }) => ({ id, img })),
        illusions: ILLUSIONS,
        nothingElse: NOTHING_ELSE,
      });
    }
    if (action === 'submit' && req.method === 'POST') {
      if (!s.startedAt) return json(res, 400, { error: 'The test has not started.' });
      const g = grade(await readBody(req));
      const taken = Math.round((s.now - s.startedAt) / 1000); // no time limit; Late stays blank so the sheet columns keep their layout
      const row = [id, s.name || '', time(s.at), time(s.startedAt), time(s.now), ...g.cells, ...g.shapeCells, g.right, g.wrong,
        g.objScore, g.right, g.total, g.max, taken, ...g.illusionCells, 'r-' + token.split('.')[2].slice(0, 12)];
      const r = await rpc('st_submit', { p_id: id, p_token: token, p_ref: row[row.length - 1], p_row: row });
      if (r !== 'ok') return json(res, r === 'submitted' ? 409 : 401, { error: 'Already submitted.' });
      try { await sync(); } catch (e) { console.error('sync failed', e.message); } // the answers are already safe in the database
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'Server error' });
  }
};
