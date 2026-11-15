// The survey chart: draws the crater from NASA's height grid as a printed map sheet (paper, ink, graticule,
// compass, scale bar) with three layers and "uncharted" paper over land nobody has scanned yet. Pure drawing:
// the game state (towers, trail, flags...) is drawn on top by mapstate.js.
import { gusevGrid, terrainMetadata } from './world.js';

export const PAPER = '#e9dcc1', INK = '#4b3022';
export const LAYERS = [['relief', 'Relief'], ['bands', 'Height'], ['surface', 'Surface']];
const DUST = [120, 93, 67];                       // Gusev's average colour in NASA's global Mars colour map
const BANDS = ['#6a3a2b', '#85492f', '#a3623b', '#c0834f', '#d9a96f', '#ead0a0', '#f5e7c8'];
const MARS_M_PER_DEG = 59159, LAT0 = 14.5692, LON0 = 175.4729;   // Spirit's landing site (Columbia Memorial Station)
const DEF = { cx: .52, cy: .4, span: 980 };
const FONT = 'Georgia, "Times New Roman", serif', MONO = 'ui-monospace, Menlo, Consolas, monospace';

// ---------------- height grid -> layer rasters (built once each) ----------------
let H = null, N = 2;
function heights() {
  if (H) return H;
  const g = gusevGrid(); N = g?.n || 2; H = new Float32Array(N * N);
  if (g) for (let i = 0; i < H.length; i++) H[i] = g.data[i] / 65535; else H.fill(.4);
  return H;
}
const mix = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const grain = (x, y) => { const t = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return t - Math.floor(t); };
const layers = {};
function layer(name) {
  if (layers[name]) return layers[name];
  const h = heights(), n = N, c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d'), img = ctx.createImageData(n, n), K = 40, L = [-.5, -.6, .62], ll = Math.hypot(...L);
  const at = (x, y) => h[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
  const lo = [104, 56, 36], hi = [236, 188, 146], bc = BANDS.map(hex), rock = [88, 80, 78], ink = hex(INK);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const z = at(x, y), nx = -(at(x + 1, y) - at(x - 1, y)) * K, ny = -(at(x, y + 1) - at(x, y - 1)) * K, nl = Math.hypot(nx, ny, 1);
    const sh = Math.max(0, (nx * L[0] + ny * L[1] + L[2]) / (nl * ll)), o = (y * n + x) * 4;
    let r, g, b;
    if (name === 'bands') {
      const col = bc[Math.min(6, Math.floor(z * 7))], k = .84 + .3 * sh;
      r = col[0] * k; g = col[1] * k; b = col[2] * k;
      const line = Math.floor(z * 11) !== Math.floor(at(x + 1, y) * 11) || Math.floor(z * 11) !== Math.floor(at(x, y + 1) * 11);   // a relative elevation bands
      if (line) { r = mix(r, ink[0], .55); g = mix(g, ink[1], .55); b = mix(b, ink[2], .55); }
    } else if (name === 'surface') {
      const slope = Math.sqrt(nl * nl - 1), rk = sstep(.2, 1.1, slope) * .8, low = sstep(.35, 0, z) * .25, k = .55 + .75 * sh, gr = (grain(x, y) - .5) * 9;
      r = (mix(DUST[0] * 1.25 + low * 30, rock[0], rk)) * k + gr; g = (mix(DUST[1] * 1.25 + low * 18, rock[1], rk)) * k + gr; b = (mix(DUST[2] * 1.25, rock[2], rk)) * k + gr;
    } else {
      const t = Math.min(1, z * 1.15), k = .35 + .85 * sh;
      r = (lo[0] + (hi[0] - lo[0]) * t) * k; g = (lo[1] + (hi[1] - lo[1]) * t) * k; b = (lo[2] + (hi[2] - lo[2]) * t) * k;
    }
    img.data[o] = Math.min(255, r); img.data[o + 1] = Math.min(255, g); img.data[o + 2] = Math.min(255, b); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (layers[name] = c);
}

// ---------------- the "uncharted" paper (or dark fog, for the minimap) with holes where land is charted ----------------
let paperTex = null;
function paperTexture(n) {
  if (paperTex?.width === n) return paperTex;
  const c = document.createElement('canvas'); c.width = c.height = n; const f = c.getContext('2d');
  f.fillStyle = PAPER; f.fillRect(0, 0, n, n);
  f.strokeStyle = 'rgba(75,48,34,.09)'; f.lineWidth = 1;
  for (let i = -n; i < n; i += 9) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i + n, n); f.stroke(); }          // hatching
  f.strokeStyle = 'rgba(75,48,34,.10)'; for (let i = 0; i < n; i += 64) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i, n); f.moveTo(0, i); f.lineTo(n, i); f.stroke(); }
  f.save(); f.fillStyle = 'rgba(75,48,34,.16)'; f.font = `italic 13px ${FONT}`; f.textAlign = 'center';
  for (let y = 70; y < n + 120; y += 150) for (let x = 40; x < n + 200; x += 210) { f.save(); f.translate(x, y); f.rotate(-.5); f.fillText('uncharted', 0, 0); f.restore(); }
  f.restore();
  return (paperTex = c);
}
const fogCache = {};
// Zelda-style unexplored map: black, split by glowing lines into one region per lookout tower.
let REGIONS = [];
// wobble for region borders so they wander like rivers and ridges (the same formula is in mist.js for the 3D ground)
export const warp = (x, z) => [Math.sin(z * .021 + 1.3) * 22 + Math.sin(z * .07 + x * .03) * 8 + Math.sin(x * .19 + z * .13) * 2.5, Math.sin(x * .019 - .7) * 22 + Math.sin(x * .065 - z * .04) * 8 + Math.sin(z * .17 - x * .11) * 2.5];
export const setRegions = spots => { REGIONS = spots.map(s => ({ x: s.x, z: s.z, name: s.name })); };
function drawRegions(f, g, n, dark) {
  if (REGIONS.length < 2) return;
  const img = f.getImageData(0, 0, n, n), D = img.data, mpp = g.span / n, w = (dark ? 1.4 : 1.1) * mpp * (n / 512 > 1 ? 1 : 1);
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const x0 = (px / n - g.cx) * g.span, z0 = (py / n - g.cy) * g.span, [wx, wz] = warp(x0, z0), x = x0 + wx, z = z0 + wz; let a = 1e9, b = 1e9;
    for (const r of REGIONS) { const d = Math.hypot(x - r.x, z - r.z); if (d < a) { b = a; a = d; } else if (d < b) b = d; }
    const rr = Math.hypot(x, z), e = Math.min((b - a) / 2, Math.abs(rr - 235)), k = Math.max(0, 1 - e / (w * .75)), o = (py * n + px) * 4;
    if (k > 0) { const t = Math.min(1, k * k * 1.3) * .85; D[o] = D[o] + (95 - D[o]) * t; D[o + 1] = D[o + 1] + (227 - D[o + 1]) * t; D[o + 2] = D[o + 2] + (255 - D[o + 2]) * t; D[o + 3] = 255; }
  }
  f.putImageData(img, 0, 0);
  f.fillStyle = 'rgba(120,225,250,.75)'; f.font = `italic ${Math.round(n / 40)}px ${FONT}`; f.textAlign = 'center';
  for (const r of REGIONS) f.fillText(r.name, (g.cx + r.x / g.span) * n, (g.cy + r.z / g.span) * n + n / 80);
}
function fog(circles, dark) {
  heights();
  const key = N + ':' + REGIONS.length + ':' + circles.map(c => `${Math.round(c.x)},${Math.round(c.z)},${Math.round(c.r)}`).join(';'), slot = dark ? 'd' : 'p';
  if (fogCache[slot]?.key === key) return fogCache[slot].c;
  const g = gusevGrid() || DEF, n = N, c = document.createElement('canvas'); c.width = c.height = n; const f = c.getContext('2d');
  f.fillStyle = dark ? 'rgba(6,10,14,.92)' : 'rgba(7,12,17,.9)'; f.fillRect(0, 0, n, n);
  f.strokeStyle = 'rgba(95,227,255,.13)'; f.lineWidth = 1;
  for (let i = 0; i < n; i += dark ? 24 : 20) { f.beginPath(); f.moveTo(i, 0); f.lineTo(i, n); f.moveTo(0, i); f.lineTo(n, i); f.stroke(); }
  drawRegions(f, g, n, dark);
  f.globalCompositeOperation = 'destination-out';
  for (const { x, z, r } of circles) {
    const px = (g.cx + x / g.span) * n, py = (g.cy + z / g.span) * n, R = r / g.span * n, gr = f.createRadialGradient(px, py, R * .66, px, py, R);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = gr; f.beginPath(); f.arc(px, py, R, 0, 7); f.fill();
  }
  fogCache[slot] = { key, c };
  return c;
}
// share of the grid that is charted, from a tiny copy of the fog (used for the "31% charted" line)
export function chartedShare(circles) {
  const f = fog(circles, false), c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); x.drawImage(f, 0, 0, 40, 40);
  const d = x.getImageData(0, 0, 40, 40).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 128) k++;
  return k / 1600;
}

// ---------------- painting ----------------
const grid = () => gusevGrid() || DEF;
// the part of the height grid shown in `rect`: view = {u0,v0,u1,v1} as fractions of the grid
function paint(ctx, rect, view, circles, name, dark) {
  const base = layer(name), f = fog(circles, dark), n = N;
  let sx = view.u0 * n, sy = view.v0 * n, sw = (view.u1 - view.u0) * n, sh = (view.v1 - view.v0) * n, { x, y, w, h } = rect;
  const kx = w / sw, ky = h / sh;                                       // keep the picture in step when the view runs off the grid
  if (sx < 0) { x -= sx * kx; w += sx * kx; sw += sx; sx = 0; }
  if (sy < 0) { y -= sy * ky; h += sy * ky; sh += sy; sy = 0; }
  if (sx + sw > n) { w -= (sx + sw - n) * kx; sw = n - sx; }
  if (sy + sh > n) { h -= (sy + sh - n) * ky; sh = n - sy; }
  if (sw <= 0 || sh <= 0) return;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, sx, sy, sw, sh, x, y, w, h); ctx.drawImage(f, sx, sy, sw, sh, x, y, w, h);
}
function projector(rect, view) {
  const g = grid(), mpp = rect.w / ((view.u1 - view.u0) * g.span);       // pixels per metre
  return { mpp, toPx: (x, z) => [rect.x + ((g.cx + x / g.span) - view.u0) / (view.u1 - view.u0) * rect.w, rect.y + ((g.cy + z / g.span) - view.v0) / (view.v1 - view.v0) * rect.h], rect };
}
const FULL = { u0: 0, v0: 0, u1: 1, v1: 1 };
export const chartHeight = S => S + 40;
export function makeCanvas(w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px';
  c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}

// The full chart sheet. Returns the projector so the caller can draw towers, trail and so on on top.
export function drawChart(ctx, S, o = {}) {
  const pad = 28, m = S - pad * 2, rect = { x: pad, y: pad, w: m, h: m }, g = grid();
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, S, chartHeight(S));
  for (let i = 0; i < 150; i++) { ctx.fillStyle = `rgba(75,48,34,${.03 + grain(i, 3) * .05})`; ctx.fillRect(grain(i, 7) * S, grain(i, 11) * chartHeight(S), 1.4, 1.4); }
  paint(ctx, rect, FULL, o.circles || [], o.layer || 'relief', false);
  const P = projector(rect, FULL), { toPx, mpp } = P;
  o.overlay?.(ctx, P, 'under');
  // neatline, graduated border and coordinates
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(rect.x, rect.y, m, m); ctx.lineWidth = .6; ctx.strokeRect(rect.x - 5, rect.y - 5, m + 10, m + 10);
  ctx.fillStyle = INK; ctx.font = `7.5px ${MONO}`; ctx.textAlign = 'center'; ctx.lineWidth = .8;
  const lon=x=>(terrainMetadata.west+(x/terrainMetadata.worldSpan+.5)*(terrainMetadata.east-terrainMetadata.west)).toFixed(4),lat=z=>Math.abs(terrainMetadata.north+(z/terrainMetadata.worldSpan+.5)*(terrainMetadata.south-terrainMetadata.north)).toFixed(4);
  for (let w = -500; w <= 500; w += 50) {
    const [px] = toPx(w, 0), [, py] = toPx(0, w), long = w % 200 === 0;
    if (px > rect.x + 4 && px < rect.x + m - 4) for (const yy of [rect.y - 5, rect.y + m + 5]) { ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px, yy + (yy < rect.y ? 5 : -5) * (long ? 1 : .5)); ctx.stroke(); }
    if (py > rect.y + 4 && py < rect.y + m - 4) for (const xx of [rect.x - 5, rect.x + m + 5]) { ctx.beginPath(); ctx.moveTo(xx, py); ctx.lineTo(xx + (xx < rect.x ? 5 : -5) * (long ? 1 : .5), py); ctx.stroke(); }
    if (long && px > rect.x + 24 && px < rect.x + m - 24) ctx.fillText(lon(w) + '°E', px, rect.y - 9);
    if (long && py > rect.y + 24 && py < rect.y + m - 24) { ctx.save(); ctx.translate(rect.x - 10, py); ctx.rotate(-Math.PI / 2); ctx.fillText(lat(w) + '°S', 0, 0); ctx.restore(); }
  }
  // compass rose
  const cx = rect.x + m - 27, cy = rect.y + 31;
  ctx.fillStyle = 'rgba(233,220,193,.82)'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = .8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy); ctx.stroke();
  ctx.fillStyle = '#a5321a'; ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx - 4, cy); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx, cy + 15); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx - 4, cy); ctx.fill();
  ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - 22);
  // scale bar (100 m)
  const bx = rect.x + 12, by = rect.y + m - 16, seg = 25 * mpp;
  ctx.fillStyle = 'rgba(233,220,193,.82)'; ctx.fillRect(bx - 6, by - 11, 4 * seg + 36, 26);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#fff6e0' : INK; ctx.fillRect(bx + i * seg, by, seg, 4); }
  ctx.strokeStyle = INK; ctx.lineWidth = .8; ctx.strokeRect(bx, by, 4 * seg, 4); ctx.fillStyle = INK; ctx.font = `7.5px ${MONO}`; ctx.textAlign = 'left';
  ctx.fillText('0', bx - 2, by - 3); ctx.fillText('100 game m', bx + 4 * seg - 8, by - 3); ctx.fillText('50', bx + 2 * seg - 5, by - 3);
  o.overlay?.(ctx, P, 'over');
  // title block
  const ty = rect.y + m + 22;
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.font = `bold 12px ${FONT}`; ctx.fillText(o.title || 'GUSEV CRATER, MARS', rect.x, ty);
  ctx.font = `italic 9px ${FONT}`; ctx.fillText(o.subtitle || 'MOLA measured relief · scaled training map', rect.x, ty + 14);
  ctx.font = `8px ${MONO}`; ctx.fillText(`${(o.layerName || 'Relief')} · ${o.layer === 'bands' ? 'relative elevation bands' : o.layer === 'surface' ? 'illustrative surface colours' : 'sun from the north-west'}`, rect.x, ty + 27);
  ctx.textAlign = 'right'; ctx.font = `bold 10px ${FONT}`; if (o.charted != null) ctx.fillText(`${Math.round(o.charted * 100)}% charted`, rect.x + m, ty);
  ctx.font = `8px ${MONO}`; if (o.stamp) ctx.fillText(o.stamp, rect.x + m, ty + 14);
  return P;
}

// The little HUD map: a circle of dark-fogged relief around the player (north up).
export function drawMini(ctx, S, o) {
  const g = grid(), r = S / 2, half = o.span / 2 / g.span, view = { u0: g.cx + o.cx / g.span - half, v0: g.cy + o.cz / g.span - half, u1: g.cx + o.cx / g.span + half, v1: g.cy + o.cz / g.span + half };
  const rect = { x: 0, y: 0, w: S, h: S }; ctx.clearRect(0, 0, S, S);
  ctx.save(); ctx.beginPath(); ctx.arc(r, r, r - 2, 0, 7); ctx.clip(); ctx.fillStyle = '#0b0f13'; ctx.fillRect(0, 0, S, S);
  ctx.filter = 'brightness(1.3) contrast(1.08)';          // the small map needs to be easy to read (ignored where unsupported)
  paint(ctx, rect, view, o.circles || [], o.layer || 'relief', true);
  ctx.filter = 'none';
  const P = projector(rect, view); o.overlay?.(ctx, P);
  if (o.dust) { ctx.fillStyle = 'rgba(210,150,80,.28)'; ctx.fillRect(0, 0, S, S); }
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = '#e9dcc1'; ctx.beginPath(); ctx.arc(r, r, r - 2, 0, 7); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(75,48,34,.9)'; ctx.beginPath(); ctx.arc(r, r, r - 4.2, 0, 7); ctx.stroke();
  ctx.fillStyle = '#e9dcc1'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('N', r, 11);
  return P;
}
