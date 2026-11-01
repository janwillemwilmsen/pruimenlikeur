export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

// Small outlined heart (inherits colour via stroke).
export const heartSvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART}"/></svg>`;

// Plum arch tab with the white outlined heart - the label's emblem.
export const tabSvg = (cls = '') => `
<svg class="${cls}" width="26" height="32" viewBox="0 0 120 150" aria-hidden="true">
  <path d="M0 0h120v90a60 60 0 0 1-120 0z" fill="#5b1f3a"/>
  <path transform="translate(36 28) scale(2.1)" d="${HEART}" fill="none" stroke="#fff4ec" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

// Emblem + "Gemaakt met liefde" arced underneath, as on the label.
let badgeN = 0;
export const badgeSvg = (cls = '') => {
  const id = `arc${badgeN++}`;
  return `
<svg class="${cls}" width="210" height="130" viewBox="0 0 300 185" role="img" aria-label="Gemaakt met liefde">
  <path d="M90 0h120v90a60 60 0 0 1-120 0z" fill="#5b1f3a"/>
  <path transform="translate(126 27) scale(2.1)" d="${HEART}" fill="none" stroke="#fff4ec" stroke-width="1.2" stroke-linejoin="round"/>
  <path id="${id}" d="M68 90A82 82 0 0 0 232 90" fill="none"/>
  <text font-family="Outfit, sans-serif" font-size="21" fill="#857d80" letter-spacing=".6"><textPath href="#${id}" startOffset="50%" text-anchor="middle">Gemaakt met liefde</textPath></text>
</svg>`;
};

// Line-art plum (terracotta sketch, like the label illustration).
export const plumSvg = (cls = '') => `
<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="#d98e72" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M60 32c-26-14-46 6-46 34 0 27 19 44 46 44s46-17 46-44c0-28-20-48-46-34z"/>
  <path d="M60 32c-3 18-3 52 0 78" stroke-opacity=".7"/>
  <path d="M30 60c0-9 4-16 10-20M34 84c4 6 10 10 18 12" stroke-width="1.4" stroke-opacity=".6"/>
  <path d="M60 32c0-10 3-17 9-22"/>
  <path d="M68 14c10-10 26-8 30 0-10 8-24 8-30 0z"/>
  <path d="M74 14c6-3 12-3 18-1" stroke-width="1.2"/>
</svg>`;

export const bottleSvg = () => `
<svg viewBox="0 0 100 140" aria-hidden="true" fill="none" stroke="#d98e72" stroke-width="2.2" stroke-linejoin="round">
  <rect x="40" y="4" width="20" height="14" rx="3" fill="#5b1f3a" stroke="none"/>
  <path d="M42 18h16v22c0 10 20 18 20 40v48a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V80c0-22 20-30 20-40z"/>
  <rect x="30" y="86" width="40" height="30" rx="4" fill="#fff4ec" stroke="#c4828a"/>
  <path transform="translate(41 91) scale(.75)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#5b1f3a" stroke="none"/>
</svg>`;

export async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok) { const e = new Error(data?.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
  return data;
}

// Downscale a chosen image file to a JPEG data URL (keeps uploads small).
export function resizeImage(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}
