// Pruimenlikeur proeverij: zero-dependency Node server (node:http + node:sqlite)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- config: admin password + cookie secret ----------
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(6).toString('hex');
  console.warn(`[!] ADMIN_PASSWORD is not set. Temporary password for this run: ${ADMIN_PASSWORD}`);
}
const SECRET_FILE = path.join(DATA_DIR, '.secret');
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
}

// ---------- database ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'pruimenlikeur.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS flavours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '',
    photo TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    flavour_id INTEGER NOT NULL REFERENCES flavours(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
    comment TEXT NOT NULL DEFAULT '',
    UNIQUE (submission_id, flavour_id)
  );
`);

const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};

// ---------- helpers ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2',
};
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

const send = (res, status, body, headers = {}) => {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
};

const readBody = (req, limit = 8 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (!chunks.length) return resolve({});
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Invalid JSON')); }
  });
  req.on('error', reject);
});

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((p) => p[0]));
const SESSION_MS = 1000 * 60 * 60 * 12;
const makeSession = () => { const exp = String(Date.now() + SESSION_MS); return `${exp}.${sign(exp)}`; };
const isAdmin = (req) => {
  const c = cookies(req).admin; if (!c) return false;
  const [exp, sig] = c.split('.');
  return !!sig && safeEq(sig, sign(exp)) && Number(exp) > Date.now();
};
const requireAdmin = (req) => { if (!isAdmin(req)) throw new HttpError(401, 'Not authorised'); };

// naive in-memory rate limiter
const hits = new Map();
const limited = (key, max, windowMs) => {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
};
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();
const ipOf = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

const saveDataUrl = (dataUrl) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'Unsupported image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) throw new HttpError(413, 'Image too large');
  const file = `${crypto.randomBytes(8).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
  return file;
};
const removePhoto = (file) => { if (file) fs.rm(path.join(UPLOAD_DIR, path.basename(file)), { force: true }, () => {}); };

const flavourOut = (f) => ({
  id: f.id, name: f.name, base: f.base, description: f.description, ingredients: f.ingredients,
  photo: f.photo ? `/uploads/${f.photo}` : null, sort_order: f.sort_order, active: !!f.active,
});

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler });

route('GET', '/api/flavours', () =>
  db.prepare('SELECT * FROM flavours WHERE active = 1 ORDER BY sort_order, id').all().map(flavourOut));

route('POST', '/api/submissions', async (req, res) => {
  if (limited(`sub:${ipOf(req)}`, 15, 10 * 60e3)) throw new HttpError(429, 'Te veel inzendingen, probeer het later nog eens.');
  const b = await readBody(req, 256 * 1024);
  const email = clean(b.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Dat e-mailadres ziet er niet goed uit.');
  if (!Array.isArray(b.ratings) || !b.ratings.length || b.ratings.length > 100) throw new HttpError(400, 'Geen beoordelingen ontvangen.');
  const valid = new Set(db.prepare('SELECT id FROM flavours WHERE active = 1').all().map((r) => r.id));
  const seen = new Set();
  const ratings = b.ratings.map((r) => {
    const fid = Number(r.flavour_id), score = Number(r.score);
    if (!valid.has(fid) || seen.has(fid)) throw new HttpError(400, 'Onbekende likeur.');
    if (!Number.isInteger(score) || score < 1 || score > 10) throw new HttpError(400, 'Cijfer moet tussen 1 en 10 liggen.');
    seen.add(fid);
    return { fid, score, comment: clean(r.comment, 1000) };
  });
  const id = tx(() => {
    const sid = db.prepare('INSERT INTO submissions (name, email) VALUES (?, ?)').run(clean(b.name, 100), email).lastInsertRowid;
    const ins = db.prepare('INSERT INTO ratings (submission_id, flavour_id, score, comment) VALUES (?, ?, ?, ?)');
    for (const r of ratings) ins.run(sid, r.fid, r.score, r.comment);
    return Number(sid);
  });
  return { ok: true, id };
});

route('POST', '/api/admin/login', async (req, res) => {
  if (limited(`login:${ipOf(req)}`, 8, 10 * 60e3)) throw new HttpError(429, 'Too many attempts');
  const b = await readBody(req, 4096);
  if (!safeEq(b.password ?? '', ADMIN_PASSWORD)) throw new HttpError(401, 'Wrong password');
  const secure = (req.headers['x-forwarded-proto'] || '') === 'https' ? '; Secure' : '';
  send(res, 200, { ok: true }, { 'Set-Cookie': `admin=${makeSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}` });
  return undefined;
});
route('POST', '/api/admin/logout', (req, res) => {
  send(res, 200, { ok: true }, { 'Set-Cookie': 'admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
});
route('GET', '/api/admin/me', (req) => ({ admin: isAdmin(req) }));

route('GET', '/api/admin/flavours', (req) => {
  requireAdmin(req);
  return db.prepare('SELECT * FROM flavours ORDER BY sort_order, id').all().map(flavourOut);
});

const flavourFields = (b) => {
  const name = clean(b.name, 80);
  if (!name) throw new HttpError(400, 'Name is required');
  return { name, base: clean(b.base, 60), description: clean(b.description, 600), ingredients: clean(b.ingredients, 1200), active: b.active === false || b.active === 0 ? 0 : 1 };
};

route('POST', '/api/admin/flavours', async (req) => {
  requireAdmin(req);
  const b = await readBody(req);
  const f = flavourFields(b);
  const photo = b.photo ? saveDataUrl(b.photo) : null;
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM flavours').get().n;
  const id = db.prepare('INSERT INTO flavours (name, base, description, ingredients, photo, sort_order, active) VALUES (?,?,?,?,?,?,?)')
    .run(f.name, f.base, f.description, f.ingredients, photo, next, f.active).lastInsertRowid;
  return flavourOut(db.prepare('SELECT * FROM flavours WHERE id = ?').get(id));
});

route('PUT', '/api/admin/flavours/:id', async (req, res, p) => {
  requireAdmin(req);
  const cur = db.prepare('SELECT * FROM flavours WHERE id = ?').get(p.id);
  if (!cur) throw new HttpError(404, 'Not found');
  const b = await readBody(req);
  const f = flavourFields(b);
  let photo = cur.photo;
  if (b.photo) { photo = saveDataUrl(b.photo); removePhoto(cur.photo); }
  else if (b.removePhoto) { photo = null; removePhoto(cur.photo); }
  db.prepare('UPDATE flavours SET name=?, base=?, description=?, ingredients=?, photo=?, active=? WHERE id=?')
    .run(f.name, f.base, f.description, f.ingredients, photo, f.active, cur.id);
  return flavourOut(db.prepare('SELECT * FROM flavours WHERE id = ?').get(cur.id));
});

route('POST', '/api/admin/flavours/reorder', async (req) => {
  requireAdmin(req);
  const b = await readBody(req, 64 * 1024);
  if (!Array.isArray(b.ids)) throw new HttpError(400, 'ids required');
  tx(() => { const u = db.prepare('UPDATE flavours SET sort_order = ? WHERE id = ?'); b.ids.forEach((id, i) => u.run(i + 1, Number(id))); });
  return { ok: true };
});

route('DELETE', '/api/admin/flavours/:id', (req, res, p) => {
  requireAdmin(req);
  const cur = db.prepare('SELECT * FROM flavours WHERE id = ?').get(p.id);
  if (!cur) throw new HttpError(404, 'Not found');
  db.prepare('DELETE FROM flavours WHERE id = ?').run(cur.id);
  removePhoto(cur.photo);
  return { ok: true };
});

route('GET', '/api/admin/results', (req) => {
  requireAdmin(req);
  const flavours = db.prepare('SELECT * FROM flavours ORDER BY sort_order, id').all();
  const rows = db.prepare(`SELECT r.flavour_id, r.score, r.comment, s.name, s.created_at
    FROM ratings r JOIN submissions s ON s.id = r.submission_id ORDER BY r.id DESC`).all();
  const by = new Map(flavours.map((f) => [f.id, { ...flavourOut(f), count: 0, sum: 0, dist: Array(10).fill(0), comments: [] }]));
  for (const r of rows) {
    const o = by.get(r.flavour_id); if (!o) continue;
    o.count++; o.sum += r.score; o.dist[r.score - 1]++;
    if (r.comment) o.comments.push({ score: r.score, comment: r.comment, name: r.name, at: r.created_at });
  }
  const list = [...by.values()].map((o) => ({ ...o, avg: o.count ? o.sum / o.count : null }));
  const totals = db.prepare(`SELECT
    (SELECT COUNT(*) FROM submissions) AS submissions,
    (SELECT COUNT(*) FROM ratings) AS ratings,
    (SELECT COUNT(*) FROM submissions WHERE email <> '') AS emails,
    (SELECT AVG(score) FROM ratings) AS avg`).get();
  const bases = db.prepare(`SELECT f.base AS base, COUNT(*) AS n, AVG(r.score) AS avg FROM ratings r
    JOIN flavours f ON f.id = r.flavour_id WHERE f.base <> '' GROUP BY f.base ORDER BY avg DESC`).all();
  return { flavours: list, totals, bases };
});

route('GET', '/api/admin/submissions', (req) => {
  requireAdmin(req);
  const subs = db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
  const rt = db.prepare(`SELECT r.submission_id, r.score, r.comment, f.name AS flavour FROM ratings r
    JOIN flavours f ON f.id = r.flavour_id ORDER BY r.id`).all();
  const grouped = new Map();
  for (const r of rt) { if (!grouped.has(r.submission_id)) grouped.set(r.submission_id, []); grouped.get(r.submission_id).push(r); }
  return subs.map((s) => ({ ...s, ratings: grouped.get(s.id) || [] }));
});

route('DELETE', '/api/admin/submissions/:id', (req, res, p) => {
  requireAdmin(req);
  db.prepare('DELETE FROM submissions WHERE id = ?').run(p.id);
  return { ok: true };
});

route('GET', '/api/admin/export.csv', (req, res) => {
  requireAdmin(req);
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const rows = db.prepare(`SELECT s.id, s.created_at, s.name, s.email, f.name AS flavour, f.base, r.score, r.comment
    FROM ratings r JOIN submissions s ON s.id = r.submission_id JOIN flavours f ON f.id = r.flavour_id ORDER BY s.id, r.id`).all();
  const head = ['submission', 'date', 'name', 'email', 'flavour', 'base', 'score', 'comment'];
  const csv = [head.join(','), ...rows.map((r) => [r.id, r.created_at, r.name, r.email, r.flavour, r.base, r.score, r.comment].map(cell).join(','))].join('\r\n');
  send(res, 200, Buffer.from('﻿' + csv), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pruimenlikeur-resultaten.csv"' });
});

// ---------- static ----------
const serveFile = (res, file, cache) => {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache });
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname);
        if (!m) continue;
        const out = await r.handler(req, res, m.groups || {});
        if (!res.headersSent && out !== undefined) send(res, 200, out, { 'Cache-Control': 'no-store' });
        return;
      }
      throw new HttpError(404, 'Not found');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (pathname.startsWith('/uploads/')) {
      const f = path.join(UPLOAD_DIR, path.basename(pathname));
      return serveFile(res, f, 'public, max-age=31536000, immutable');
    }
    if (pathname === '/admin' || pathname === '/admin/') return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'), 'no-cache');
    const rel = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(PUBLIC_DIR, rel);
    if (file.startsWith(PUBLIC_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file, 'no-cache');
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'no-cache'); // SPA fallback
  } catch (e) {
    if (res.headersSent) return res.end();
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Pruimenlikeur proeverij draait op http://localhost:${PORT} (data: ${DATA_DIR})`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
