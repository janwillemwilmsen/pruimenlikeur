import { esc, plumSvg, bottleSvg, api } from './common.js';

// ---------- i18n ----------
const T = {
  nl: {
    brand: 'Pruimenlikeur Proeverij',
    eyebrow: 'Huisgemaakt · Lang in het donker gerijpt',
    title: 'Welke <em>pruim</em> wint jouw hart?',
    lead: 'Een dozijn zelfgemaakte pruimenlikeuren, elk met een eigen karakter. Proef, geef een cijfer en help ons de allerbeste te vinden.',
    howMany: 'Hoeveel likeurtjes heb je geproefd?',
    howManyHint: 'Kies een aantal, daarna wijs je ze aan.',
    all: 'Alle {n}',
    go: 'Verder',
    back: 'Terug',
    pickTitle: 'Welke {n} heb je geproefd?',
    pickTitle1: 'Welke heb je geproefd?',
    pickHint: 'Tik op de likeuren om ze te kiezen.',
    chosen: '{a} van {b} gekozen',
    rateTitle: 'Tijd voor je oordeel',
    rateHint: 'Geef elk likeurtje een cijfer van 1 tot 10 en vertel gerust wat je proefde.',
    comment: 'Opmerking (optioneel)',
    commentPh: 'Fruitig? Te zoet? Naar meer smaken dan een bak…',
    about: 'Even over jou',
    aboutHint: 'Helemaal optioneel. Laat je mailadres achter als je de uitslag wilt horen.',
    name: 'Je naam (optioneel)',
    email: 'E-mailadres (optioneel)',
    submit: 'Verstuur mijn oordeel',
    sending: 'Versturen…',
    needScores: 'Geef nog een cijfer aan alle likeuren.',
    noFlavours: 'De likeuren worden nog klaargezet. Kom zo straks terug!',
    thanks: 'Hartelijk bedankt!',
    again: 'Nog een rondje proeven',
    anotherJoke: 'Nog een grap',
    footer: 'Gemaakt met liefde, pruimen en geduld.',
    scores: ['', 'Bah!', 'Hmm, nee', 'Matig', 'Kan beter', 'Prima', 'Lekker', 'Heel lekker', 'Top!', 'Geweldig!', 'Hemels 😍'],
    jokes: [
      'Je oordeel is zojuist in pruimenlikeur gemarineerd. Het wordt alleen maar beter met de tijd.',
      'Je smaakpapillen zijn officieel erkend als "deskundig" (of in elk geval enthousiast).',
      'Dank je! Een pruim zou blozen, als hij nog kon.',
      'Jouw cijfers worden met grote ernst geanalyseerd door een zeer serieuze commissie van één persoon.',
      'Je bent nu officieel pruimenproever eerste klasse. Het diploma is zoek.',
      'Proost! Rij nu niet naar huis, ga lekker op de bank liggen.',
      'We hebben je feedback opgeslagen tussen de pitten, op een veilige plek.',
      'Dit was geen test. Dit was een pruimenonderzoek met wetenschappelijke pretenties.',
      'Je hebt een pruim gered van de middelmatigheid. Of juist niet. De data zal het zeggen.',
    ],
  },
  en: {
    brand: 'Plum Liqueur Tasting',
    eyebrow: 'Homemade · Aged in the dark',
    title: 'Which <em>plum</em> wins your heart?',
    lead: 'A dozen homemade plum liqueurs, each with its own character. Taste, score and help us find the very best.',
    howMany: 'How many liqueurs did you taste?',
    howManyHint: 'Pick a number, then point out which ones.',
    all: 'All {n}',
    go: 'Continue',
    back: 'Back',
    pickTitle: 'Which {n} did you taste?',
    pickTitle1: 'Which one did you taste?',
    pickHint: 'Tap the liqueurs to select them.',
    chosen: '{a} of {b} selected',
    rateTitle: 'Time for your verdict',
    rateHint: 'Give each liqueur a score from 1 to 10 and feel free to say what you tasted.',
    comment: 'Comment (optional)',
    commentPh: 'Fruity? Too sweet? Tastes like more…',
    about: 'A little about you',
    aboutHint: 'Entirely optional. Leave your email if you want to hear the results.',
    name: 'Your name (optional)',
    email: 'Email address (optional)',
    submit: 'Send my verdict',
    sending: 'Sending…',
    needScores: 'Please score every liqueur first.',
    noFlavours: 'The liqueurs are still being set out. Check back soon!',
    thanks: 'Thank you so much!',
    again: 'Taste another round',
    anotherJoke: 'Another joke',
    footer: 'Made with love, plums and patience.',
    scores: ['', 'Yuck!', 'Hmm, no', 'Meh', 'Could be better', 'Decent', 'Tasty', 'Very tasty', 'Great!', 'Fantastic!', 'Heavenly 😍'],
    jokes: [
      'Your verdict has just been marinated in plum liqueur. It only gets better with time.',
      'Your taste buds are officially certified "expert" (or at least enthusiastic).',
      'Thank you! A plum would blush, if it still could.',
      'Your scores will be analysed with great gravity by a very serious committee of one.',
      'You are now an official first-class plum taster. The diploma is lost.',
      'Cheers! Do not drive home. Lie down on the couch instead.',
      'We stored your feedback between the pits, somewhere safe.',
      'This was not a test. This was plum research with scientific pretensions.',
      'You saved a plum from mediocrity. Or maybe not. The data will tell.',
    ],
  },
};
let lang = localStorage.getItem('lang') === 'en' ? 'en' : 'nl';
const t = (k, v = {}) => String(T[lang][k]).replace(/\{(\w+)\}/g, (_, n) => v[n]);

// ---------- state ----------
const store = {
  get: () => { try { return JSON.parse(sessionStorage.getItem('st') || '{}'); } catch { return {}; } },
  set: (p) => sessionStorage.setItem('st', JSON.stringify({ ...store.get(), ...p })),
  clear: () => sessionStorage.removeItem('st'),
};
let flavours = [];
const $app = document.getElementById('app');

const photo = (f) => f.photo ? `<img src="${esc(f.photo)}" alt="${esc(f.name)}" loading="lazy">` : bottleSvg();
const steps = (n) => `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;

function nav(to, replace) { history[replace ? 'replaceState' : 'pushState']({}, '', to); render(); window.scrollTo(0, 0); }

// ---------- views ----------
function viewHome() {
  const total = flavours.length;
  if (!total) {
    return `<section class="hero view"><div class="logo">${plumSvg('hero')}</div><h1>${t('title')}</h1><p class="lead">${t('noFlavours')}</p></section>`;
  }
  const sel = store.get().count || 0;
  const nums = Array.from({ length: total }, (_, i) => i + 1);
  return `
  <section class="hero view">
    <div class="logo">${plumSvg('hero')}</div>
    <div class="eyebrow">${t('eyebrow')}</div>
    <h1>${t('title')}</h1>
    <p class="lead">${t('lead')}</p>
  </section>
  <section class="panel view narrow" style="text-align:center">
    <h2>${t('howMany')}</h2>
    <p class="hint">${t('howManyHint')}</p>
    <div class="count-grid" role="group" aria-label="${t('howMany')}">
      ${nums.map((n) => `<button class="count-chip ${n === total ? 'all' : ''}" data-count="${n}" aria-pressed="${sel === n}">${n === total && total > 1 ? t('all', { n }) : n}</button>`).join('')}
    </div>
    <button class="btn" id="go" ${sel ? '' : 'disabled'}>${t('go')} →</button>
  </section>`;
}

function viewPick() {
  const st = store.get();
  const count = st.count;
  if (!count) return null;
  const picked = new Set(st.picked || []);
  const all = count >= flavours.length;
  return `
  <section class="view">
    ${steps(1)}
    <h2>${count === 1 ? t('pickTitle1') : t('pickTitle', { n: count })}</h2>
    <p class="hint">${t('pickHint')}</p>
    <div class="grid" style="margin-top:18px">
      ${flavours.map((f) => {
        const on = picked.has(f.id);
        const dim = !on && picked.size >= count;
        return `<button class="fcard ${dim ? 'dim' : ''}" data-id="${f.id}" aria-pressed="${on}">
          <div class="ph">${photo(f)}</div><span class="tick">✓</span>
          <div class="body"><h3>${esc(f.name)}</h3>${f.base ? `<span class="badge">${esc(f.base)}</span>` : ''}
          ${f.ingredients ? `<p class="ing">${esc(f.ingredients)}</p>` : ''}</div></button>`;
      }).join('')}
    </div>
    <div class="sticky">
      <button class="btn ghost" id="back">← ${t('back')}</button>
      <b>${t('chosen', { a: picked.size, b: count })}</b>
      <button class="btn" id="go" ${picked.size === count ? '' : 'disabled'}>${t('go')} →</button>
    </div>
  </section>`;
}

function viewRate() {
  const st = store.get();
  const ids = st.picked || [];
  const list = ids.map((id) => flavours.find((f) => f.id === id)).filter(Boolean);
  if (!list.length) return null;
  const r = st.ratings || {};
  return `
  <section class="view narrow" style="width:min(760px,100% - 32px)">
    ${steps(2)}
    <h2>${t('rateTitle')}</h2>
    <p class="hint">${t('rateHint')}</p>
    <div style="margin-top:18px">
    ${list.map((f) => {
      const cur = r[f.id]?.score || 0;
      return `<article class="rate" data-f="${f.id}">
        <div class="ph">${photo(f)}</div>
        <div>
          <h3>${esc(f.name)} ${f.base ? `<span class="badge">${esc(f.base)}</span>` : ''}</h3>
          <div class="scale" role="group" aria-label="${esc(f.name)} 1-10">
            ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button data-s="${n}" class="${n === cur ? 'cur' : n < cur ? 'fill' : ''}" aria-pressed="${n === cur}">${n}</button>`).join('')}
          </div>
          <div class="verdict" aria-live="polite">${esc(T[lang].scores[cur] || '')}</div>
          <label class="f"><span>${t('comment')}</span><textarea data-c maxlength="1000" placeholder="${esc(t('commentPh'))}">${esc(r[f.id]?.comment || '')}</textarea></label>
        </div>
      </article>`;
    }).join('')}
    </div>
    <div class="panel" style="margin-top:22px">
      <h3>${t('about')}</h3>
      <p class="hint">${t('aboutHint')}</p>
      <div class="two">
        <label class="f"><span>${t('name')}</span><input type="text" id="name" maxlength="100" autocomplete="name" value="${esc(st.name || '')}"></label>
        <label class="f"><span>${t('email')}</span><input type="email" id="email" maxlength="200" autocomplete="email" value="${esc(st.email || '')}"></label>
      </div>
      <div id="err"></div>
    </div>
    <div class="sticky">
      <button class="btn ghost" id="back">← ${t('back')}</button>
      <button class="btn" id="send">${t('submit')} 🍷</button>
    </div>
  </section>`;
}

const jokeIdx = { i: -1 };
function pickJoke() {
  const js = T[lang].jokes; let i;
  do { i = Math.floor(Math.random() * js.length); } while (i === jokeIdx.i && js.length > 1);
  jokeIdx.i = i; return js[i];
}
function viewThanks() {
  return `
  <section class="thanks view">
    <div class="big">🍇</div>
    <h1>${t('thanks')}</h1>
    <p class="joke" id="joke">${esc(pickJoke())}</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <button class="btn ghost" id="joke-btn">🎲 ${t('anotherJoke')}</button>
      <button class="btn" id="again">${t('again')}</button>
    </div>
  </section>`;
}

// ---------- animations ----------
const rainEl = document.getElementById('rain');
function startRain() {
  const items = ['🍇', '🟣', '🍷', '🫐', '🥃', '✨'];
  rainEl.innerHTML = Array.from({ length: 22 }, () => {
    const s = 18 + Math.random() * 28;
    return `<span style="left:${Math.random() * 100}%;font-size:${s}px;animation-duration:${6 + Math.random() * 7}s;animation-delay:${-Math.random() * 10}s">${items[Math.floor(Math.random() * items.length)]}</span>`;
  }).join('');
}
const stopRain = () => { rainEl.innerHTML = ''; };

let confettiRaf = 0;
function confetti(durationMs = 4500) {
  const cv = document.getElementById('confetti');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
  fit();
  const colors = ['#f0c06a', '#b4529a', '#8e3a74', '#fbefe1', '#c98f2a', '#d27ab8'];
  const parts = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35,
    vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, g: .32 + Math.random() * .15,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
    c: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < .3,
  }));
  const end = performance.now() + durationMs;
  cancelAnimationFrame(confettiRaf);
  const tick = (now) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.scale(devicePixelRatio, devicePixelRatio);
    for (const p of parts) {
      p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, Math.min(1, (end - now) / 900));
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.restore();
    if (now < end) confettiRaf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  };
  confettiRaf = requestAnimationFrame(tick);
}

// ---------- render + events ----------
function render() {
  const p = location.pathname.replace(/\/+$/, '') || '/';
  document.getElementById('brand').innerHTML = `${plumSvg('brand')}<span>${t('brand')}</span>`;
  document.getElementById('footer').textContent = t('footer');
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  stopRain();
  let html = null;
  if (p === '/') html = viewHome();
  else if (p === '/kies') html = viewPick();
  else if (p === '/proef') html = viewRate();
  else if (p === '/bedankt') html = viewThanks();
  if (html === null) return nav('/', true);
  $app.innerHTML = html;
  bind(p);
  if (p === '/bedankt') { startRain(); confetti(); }
}

function bind(p) {
  const $ = (s) => $app.querySelector(s);
  if (p === '/') {
    $app.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.count);
      const old = store.get().picked || [];
      store.set({ count: n, picked: old.slice(0, n) });
      $app.querySelectorAll('[data-count]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#go').disabled = false;
    }));
    $('#go')?.addEventListener('click', () => {
      const { count } = store.get();
      if (count >= flavours.length) store.set({ picked: flavours.map((f) => f.id) });
      nav(count >= flavours.length ? '/proef' : '/kies');
    });
  }
  if (p === '/kies') {
    $app.querySelectorAll('.fcard').forEach((c) => c.addEventListener('click', () => {
      const st = store.get(); const id = Number(c.dataset.id); const set = new Set(st.picked || []);
      if (set.has(id)) set.delete(id); else if (set.size < st.count) set.add(id);
      store.set({ picked: [...set] });
      const y = scrollY; render(); scrollTo(0, y);
    }));
    $('#back').addEventListener('click', () => nav('/'));
    $('#go').addEventListener('click', () => nav('/proef'));
  }
  if (p === '/proef') {
    $app.querySelectorAll('.rate').forEach((card) => {
      const fid = Number(card.dataset.f);
      const save = (patch) => { const r = store.get().ratings || {}; r[fid] = { ...r[fid], ...patch }; store.set({ ratings: r }); };
      card.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
        const s = Number(b.dataset.s); save({ score: s });
        card.querySelectorAll('[data-s]').forEach((x) => {
          const n = Number(x.dataset.s);
          x.className = n === s ? 'cur' : n < s ? 'fill' : ''; x.setAttribute('aria-pressed', String(n === s));
        });
        card.querySelector('.verdict').textContent = T[lang].scores[s];
        card.classList.remove('missing');
      }));
      card.querySelector('[data-c]').addEventListener('input', (e) => save({ comment: e.target.value }));
    });
    $('#name').addEventListener('input', (e) => store.set({ name: e.target.value }));
    $('#email').addEventListener('input', (e) => store.set({ email: e.target.value }));
    $('#back').addEventListener('click', () => nav(store.get().count >= flavours.length ? '/' : '/kies'));
    $('#send').addEventListener('click', submit);
  }
  if (p === '/bedankt') {
    $('#again').addEventListener('click', () => { store.clear(); nav('/'); });
    $('#joke-btn').addEventListener('click', () => {
      const j = $('#joke'); j.style.animation = 'none'; void j.offsetWidth; j.style.animation = ''; j.textContent = pickJoke(); confetti(2500);
    });
  }
}

async function submit() {
  const st = store.get();
  const err = $app.querySelector('#err'); err.innerHTML = '';
  const ids = st.picked || [];
  const r = st.ratings || {};
  const missing = ids.filter((id) => !r[id]?.score);
  if (missing.length) {
    err.innerHTML = `<div class="err">${t('needScores')}</div>`;
    const el = $app.querySelector(`[data-f="${missing[0]}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const btn = $app.querySelector('#send'); btn.disabled = true; btn.textContent = t('sending');
  try {
    await api('/api/submissions', { method: 'POST', body: {
      name: st.name || '', email: (st.email || '').trim(),
      ratings: ids.map((id) => ({ flavour_id: id, score: r[id].score, comment: r[id].comment || '' })),
    } });
    store.clear();
    nav('/bedankt');
  } catch (e) {
    err.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    btn.disabled = false; btn.textContent = `${t('submit')} 🍷`;
  }
}

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; localStorage.setItem('lang', lang); render();
}));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a) { e.preventDefault(); nav(a.getAttribute('href')); }
});
addEventListener('popstate', render);
addEventListener('resize', () => { const cv = document.getElementById('confetti'); cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; });

(async () => {
  try { flavours = await api('/api/flavours'); } catch { flavours = []; }
  // drop stale picks (flavour removed meanwhile)
  const ids = new Set(flavours.map((f) => f.id)); const st = store.get();
  if (st.picked) store.set({ picked: st.picked.filter((id) => ids.has(id)) });
  render();
})();
