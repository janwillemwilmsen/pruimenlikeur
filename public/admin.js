import { esc, plumSvg, bottleSvg, api, resizeImage } from './common.js';

const $app = document.getElementById('app');
const $top = document.getElementById('topright');
document.getElementById('brand').innerHTML = `${plumSvg('adm')}<span>Admin</span>`;
let tab = sessionStorage.getItem('tab') || 'flavours';

const fmt = (n, d = 1) => (n == null ? '–' : Number(n).toFixed(d).replace('.', ','));
const when = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
const thumb = (f) => f.photo ? `<img src="${esc(f.photo)}" alt="">` : bottleSvg();

// ---------- login ----------
function login(msg = '') {
  $top.innerHTML = '';
  $app.innerHTML = `
  <form class="panel narrow view" id="lf" style="margin-top:8vh">
    <h2>Admin</h2>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
    <label class="f"><span>Password</span><input type="password" id="pw" autocomplete="current-password" autofocus required></label>
    <button class="btn" style="width:100%">Log in</button>
  </form>`;
  document.getElementById('lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/admin/login', { method: 'POST', body: { password: document.getElementById('pw').value } }); shell(); }
    catch (err) { login(err.message); }
  });
}

// ---------- shell ----------
function shell() {
  $top.innerHTML = `<a class="btn ghost sm" href="/" target="_blank">View site ↗</a> <button class="btn ghost sm" id="logout">Log out</button>`;
  document.getElementById('logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); login(); });
  $app.innerHTML = `
    <div class="tabs" role="tablist">
      ${[['flavours', 'Liqueurs'], ['results', 'Results'], ['subs', 'Submissions']].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
    </div>
    <div id="pane"></div>`;
  $app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab; sessionStorage.setItem('tab', tab);
    $app.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    pane();
  }));
  pane();
}
async function pane() {
  const el = document.getElementById('pane');
  el.innerHTML = '<p class="hint">Loading…</p>';
  try {
    if (tab === 'flavours') await paneFlavours(el);
    else if (tab === 'results') await paneResults(el);
    else await paneSubs(el);
  } catch (e) { if (e.status === 401) login('Session expired'); else el.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

// ---------- flavours ----------
async function paneFlavours(el) {
  const list = await api('/api/admin/flavours');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <p class="hint" style="margin:0">${list.length} liqueurs · hidden ones don't show up for guests</p>
      <button class="btn" id="add">+ Add liqueur</button>
    </div>
    ${list.map((f, i) => `
      <div class="row ${f.active ? '' : 'off'}">
        <div class="thumb">${thumb(f)}</div>
        <div class="grow"><b>${esc(f.name)}</b> ${f.base ? `<span class="badge">${esc(f.base)}</span>` : ''} ${f.active ? '' : '<span class="hint">(hidden)</span>'}
          <div class="hint" style="font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.ingredients)}</div></div>
        <div class="actions">
          <button class="btn ghost sm" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="btn ghost sm" data-mv="${i}:1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="btn ghost sm" data-edit="${f.id}">Edit</button>
        </div>
      </div>`).join('') || '<p class="hint">No liqueurs yet. Add the first one!</p>'}`;
  el.querySelector('#add').addEventListener('click', () => editor(null));
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editor(list.find((f) => f.id === Number(b.dataset.edit)))));
  el.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', async () => {
    const [i, d] = b.dataset.mv.split(':').map(Number);
    const ids = list.map((f) => f.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    await api('/api/admin/flavours/reorder', { method: 'POST', body: { ids } }); pane();
  }));
}

function editor(f) {
  const isNew = !f; f = f || { name: '', base: '', description: '', ingredients: '', photo: null, active: true };
  let newPhoto = null, removePhoto = false;
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `
  <form class="box">
    <h2>${isNew ? 'New liqueur' : 'Edit liqueur'}</h2>
    <div id="merr"></div>
    <div class="drop">
      <div class="thumb" id="pv">${thumb(f)}</div>
      <div>
        <input type="file" id="file" accept="image/*" hidden>
        <button type="button" class="btn ghost sm" id="pick">Choose photo</button>
        <button type="button" class="btn ghost sm" id="rm" ${f.photo ? '' : 'hidden'}>Remove</button>
        <div class="hint" style="font-size:.85rem;margin-top:6px">Resized automatically.</div>
      </div>
    </div>
    <div class="two">
      <label class="f"><span>Name *</span><input type="text" id="n" maxlength="80" required value="${esc(f.name)}"></label>
      <label class="f"><span>Base spirit</span><input type="text" id="b" maxlength="60" list="bases" placeholder="Whisky, vodka…" value="${esc(f.base)}">
        <datalist id="bases"><option>Wodka<option>Whisky<option>Jenever<option>Rum<option>Brandy<option>Cognac<option>Gin<option>Korenwijn</datalist></label>
    </div>
    <label class="f"><span>Ingredients</span><textarea id="i" maxlength="1200" placeholder="Plums, coffee beans, dark chocolate, sugar…">${esc(f.ingredients)}</textarea></label>
    <label class="f"><span>Description / notes (internal, optional)</span><textarea id="d" maxlength="600">${esc(f.description)}</textarea></label>
    <label class="f" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="a" ${f.active ? 'checked' : ''} style="width:auto"> <span style="margin:0">Visible for guests</span></label>
    <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
      <div>${isNew ? '' : '<button type="button" class="btn danger sm" id="del">Delete</button>'}</div>
      <div style="display:flex;gap:8px"><button type="button" class="btn ghost" id="cancel">Cancel</button><button class="btn">Save</button></div>
    </div>
  </form>`;
  document.body.appendChild(m);
  const $ = (s) => m.querySelector(s);
  const close = () => m.remove();
  $('#cancel').addEventListener('click', close);
  m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
  $('#pick').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { newPhoto = await resizeImage(file); removePhoto = false; $('#pv').innerHTML = `<img src="${newPhoto}" alt="">`; $('#rm').hidden = false; }
    catch (err) { $('#merr').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  });
  $('#rm').addEventListener('click', () => { newPhoto = null; removePhoto = true; $('#pv').innerHTML = bottleSvg(); $('#rm').hidden = true; });
  $('#del')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${f.name}" and all its ratings? This cannot be undone. (Tip: untick "Visible" to just hide it.)`)) return;
    await api(`/api/admin/flavours/${f.id}`, { method: 'DELETE' }); close(); pane();
  });
  m.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: $('#n').value, base: $('#b').value, ingredients: $('#i').value, description: $('#d').value, active: $('#a').checked };
    if (newPhoto) body.photo = newPhoto; if (removePhoto) body.removePhoto = true;
    try { await api(isNew ? '/api/admin/flavours' : `/api/admin/flavours/${f.id}`, { method: isNew ? 'POST' : 'PUT', body }); close(); pane(); }
    catch (err) { $('#merr').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  });
  $('#n').focus();
}

// ---------- results ----------
async function paneResults(el) {
  const { flavours, totals, bases } = await api('/api/admin/results');
  const rated = flavours.filter((f) => f.count).sort((a, b) => b.avg - a.avg || b.count - a.count);
  const unrated = flavours.filter((f) => !f.count);
  el.innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${totals.submissions}</b><span>tasters</span></div>
      <div class="tile"><b>${totals.ratings}</b><span>ratings</span></div>
      <div class="tile"><b>${fmt(totals.avg)}</b><span>average score</span></div>
      <div class="tile"><b>${totals.emails}</b><span>email addresses</span></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap">
      <h2 style="margin:0">Ranking</h2><a class="btn ghost sm" href="/api/admin/export.csv">⬇ Export CSV</a>
    </div>
    ${rated.map((f, i) => {
      const max = Math.max(...f.dist, 1);
      return `<div class="rank ${i === 0 ? 'first' : ''}">
        <div class="n">${i + 1}</div>
        <div>
          <div class="meta"><span><b>${esc(f.name)}</b> ${f.base ? `<span class="badge">${esc(f.base)}</span>` : ''}</span>
            <span><span class="score">${fmt(f.avg)}</span> <span class="hint">· ${f.count} rating${f.count === 1 ? '' : 's'}</span></span></div>
          <div class="bar" role="img" aria-label="Average ${fmt(f.avg)} out of 10"><i style="width:0" data-w="${f.avg * 10}%"></i></div>
          <div class="hist" title="Score distribution">${f.dist.map((c, k) => `<i style="height:${Math.max(2, c / max * 100)}%" title="${k + 1}: ${c}×"></i>`).join('')}</div>
          <div class="hist-lbl">${f.dist.map((_, k) => `<span>${k + 1}</span>`).join('')}</div>
          ${f.comments.length ? `<details><summary>${f.comments.length} comment${f.comments.length === 1 ? '' : 's'}</summary>
            ${f.comments.map((c) => `<div class="cm">${esc(c.comment)}<small>${c.score}/10${c.name ? ' · ' + esc(c.name) : ''}</small></div>`).join('')}</details>` : ''}
        </div></div>`;
    }).join('') || '<p class="hint">No ratings yet.</p>'}
    ${unrated.length ? `<p class="hint">Not rated yet: ${unrated.map((f) => esc(f.name)).join(', ')}</p>` : ''}
    ${bases.length ? `<h2 style="margin-top:34px">By base spirit</h2>
      ${bases.map((b) => `<div class="rank"><div class="n"></div><div>
        <div class="meta"><b>${esc(b.base)}</b><span><span class="score">${fmt(b.avg)}</span> <span class="hint">· ${b.n} ratings</span></span></div>
        <div class="bar"><i style="width:0" data-w="${b.avg * 10}%"></i></div></div></div>`).join('')}` : ''}`;
  requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('[data-w]').forEach((i) => { i.style.width = i.dataset.w; })));
}

// ---------- submissions ----------
async function paneSubs(el) {
  const subs = await api('/api/admin/submissions');
  const emails = subs.filter((s) => s.email).map((s) => s.email);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap">
      <p class="hint" style="margin:0">${subs.length} submission${subs.length === 1 ? '' : 's'} · ${emails.length} with email</p>
      <div style="display:flex;gap:8px">
        ${emails.length ? '<button class="btn ghost sm" id="copy">Copy emails</button>' : ''}
        <a class="btn ghost sm" href="/api/admin/export.csv">⬇ Export CSV</a>
      </div>
    </div>
    ${subs.map((s) => `<div class="sub"><header>
        <span><b>${esc(s.name) || '<i class="hint">anonymous</i>'}</b> ${s.email ? `· <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}</span>
        <span class="hint">${when(s.created_at)} <button class="btn danger sm" data-del="${s.id}">Delete</button></span></header>
        <div style="margin-top:6px">${s.ratings.map((r) => `<span class="pill">${esc(r.flavour)} · ${r.score}</span>`).join('')}</div>
        ${s.ratings.filter((r) => r.comment).map((r) => `<div class="cm"><small>${esc(r.flavour)}</small>${esc(r.comment)}</div>`).join('')}
      </div>`).join('') || '<p class="hint">Nothing submitted yet.</p>'}`;
  el.querySelector('#copy')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(emails.join(', ')); e.target.textContent = 'Copied ✓'; } catch { prompt('Copy:', emails.join(', ')); }
  });
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this submission?')) return;
    await api(`/api/admin/submissions/${b.dataset.del}`, { method: 'DELETE' }); pane();
  }));
}

(async () => {
  try { (await api('/api/admin/me')).admin ? shell() : login(); } catch { login(); }
})();
