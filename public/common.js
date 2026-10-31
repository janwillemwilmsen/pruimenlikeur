export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const plumSvg = (cls = '') => `
<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="pg${cls}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#d27ab8"/><stop offset=".55" stop-color="#8e3a74"/><stop offset="1" stop-color="#3f1236"/></radialGradient>
    <linearGradient id="lg${cls}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9be08a"/><stop offset="1" stop-color="#3f8f4f"/></linearGradient>
  </defs>
  <path d="M60 30c-26-14-48 6-48 36 0 28 20 46 48 46s48-18 48-46c0-30-22-50-48-36z" fill="url(#pg${cls})"/>
  <path d="M60 30c-3 18-3 54 0 82" stroke="#2c0a26" stroke-opacity=".35" stroke-width="2" fill="none"/>
  <ellipse cx="40" cy="52" rx="10" ry="16" fill="#fff" opacity=".22" transform="rotate(28 40 52)"/>
  <path d="M60 30c0-10 3-17 9-22" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M68 14c10-10 26-8 30 0-10 8-24 8-30 0z" fill="url(#lg${cls})"/>
</svg>`;

export const bottleSvg = () => `
<svg viewBox="0 0 100 140" aria-hidden="true">
  <rect x="40" y="4" width="20" height="14" rx="3" fill="#c98f2a"/>
  <path d="M42 18h16v22c0 10 20 18 20 40v48a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V80c0-22 20-30 20-40z" fill="#4a1d4f" stroke="#f0c06a" stroke-opacity=".5" stroke-width="2"/>
  <rect x="30" y="86" width="40" height="30" rx="4" fill="#f0c06a" opacity=".85"/>
  <circle cx="50" cy="101" r="8" fill="#8e3a74"/>
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
