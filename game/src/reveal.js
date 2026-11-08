// The "charting" moment: a chart sheet in a pop-up, a glowing ring sweeping out and the paper peeling back,
// with the badge harp playing a rising run of notes. Used by tower scans and Ingenuity's scout flights.
import { drawChart, makeCanvas, chartHeight, chartedShare, LAYERS } from './chart.js';
import { playNote } from './patch-fx.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Orbiter drawn on the chart: a bus, two solar wings and a dish, like Mars Reconnaissance Orbiter.
function drawSat(c, x, y, a, k = 1) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(k, k);
  c.fillStyle = '#1d3557'; c.strokeStyle = '#0b1b33'; c.lineWidth = .8;
  for (const sx of [-1, 1]) { c.fillRect(sx > 0 ? 7 : -27, -4, 20, 8); c.strokeRect(sx > 0 ? 7 : -27, -4, 20, 8); for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo((sx > 0 ? 7 : -27) + k * 5, -4); c.lineTo((sx > 0 ? 7 : -27) + k * 5, 4); c.stroke(); } }
  c.fillStyle = '#e9e5db'; c.fillRect(-7, -6, 14, 12); c.strokeRect(-7, -6, 14, 12);
  c.fillStyle = '#d9622b'; c.fillRect(-7, -1.5, 14, 3);
  c.fillStyle = '#f4f1ea'; c.beginPath(); c.ellipse(0, 9, 7, 3, 0, 0, 7); c.fill(); c.stroke();
  c.restore();
}
const ease = t => 1 - Math.pow(1 - t, 3);

// base: circles already charted. add: the new circles (each grows from nothing). overlay(ctx, projector): the game's marks.
export function revealModal({ modal, title, base, add, overlay, layer = 'relief', intro = 'Map data received. Charting the new ground...', done, S = 420, notes = [0, 2, 4, 7, 9], ring = true, sat = false, extra = [] }) {
  const close = modal({ title, html: `<div id="rv-wrap" style="display:flex;justify-content:center"></div><p id="rv-text" style="min-height:3em">${intro}</p>`, choices: [...extra, { label: 'Continue', primary: true }] });
  const wrap = document.getElementById('rv-wrap'), text = document.getElementById('rv-text'); if (!wrap) return close;
  const cv = makeCanvas(S, chartHeight(S)); cv.style.maxWidth = '100%'; cv.style.height = 'auto'; wrap.appendChild(cv);
  const ctx = cv.getContext('2d'), name = (LAYERS.find(l => l[0] === layer) || LAYERS[0])[1];
  const draw = (circles, r) => drawChart(ctx, S, { layer, layerName: name, circles, overlay: (c, P) => { overlay?.(c, P); if (r) { const [x, y] = P.toPx(r.x, r.z); c.save(); c.strokeStyle = 'rgba(40,140,190,.95)'; c.lineWidth = 2.4; c.shadowColor = '#4fc3f7'; c.shadowBlur = 12; c.beginPath(); c.arc(x, y, r.r * P.mpp, 0, 7); c.stroke(); c.restore();
      c.save(); c.beginPath(); c.arc(x, y, r.r * P.mpp, 0, 7); c.clip(); c.strokeStyle = 'rgba(79,195,247,.28)'; c.lineWidth = 1; const gs = 16; for (let gx = x - r.r * P.mpp; gx < x + r.r * P.mpp; gx += gs) { c.beginPath(); c.moveTo(gx, y - r.r * P.mpp); c.lineTo(gx, y + r.r * P.mpp); c.stroke(); } for (let gy = y - r.r * P.mpp; gy < y + r.r * P.mpp; gy += gs) { c.beginPath(); c.moveTo(x - r.r * P.mpp, gy); c.lineTo(x + r.r * P.mpp, gy); c.stroke(); } c.restore(); } } });
  const W = S, Hh = chartHeight(S);
  const finish = () => { const all = [...base, ...add]; draw(all); text.innerHTML = done?.(chartedShare(all)) ?? ''; };
  if (reduceMotion()) { finish(); return close; }
  if (sat && add.length) return satSweep();
  const T0 = performance.now(), D = 2600, m = add.length;
  notes.forEach((n, k) => setTimeout(() => cv.isConnected && playNote(n), 300 + [0, 220, 440, 660, 1100][k]));
  const frame = now => {
    if (!cv.isConnected) return;
    const t = Math.max(0, Math.min(1, (now - T0) / D)); let last = 0;
    const grown = add.map((c, i) => { const li = Math.max(0, Math.min(3, t * (m + 2) - i)) / 3; if (li > 0) last = i; return { ...c, r: c.r * ease(li) }; });
    draw([...base, ...grown], ring && m ? { x: add[last].x, z: add[last].z, r: grown[last].r } : null);
    if (t < 1) requestAnimationFrame(frame); else finish();
  };
  requestAnimationFrame(frame);
  return close;

  // Satellite pass: an orbiter flies across the chart; mist lifts in its wake and the land appears under its scan line.
  function satSweep() {
    const all = [...base, ...add], P = drawChart(ctx, S, { layer, layerName: name, circles: base });
    const ext = add.map(c => { const [px, py] = P.toPx(c.x, c.z), r = c.r * P.mpp; return { px, py, r }; });
    const xmin = Math.min(...ext.map(e => e.px - e.r)), xmax = Math.max(...ext.map(e => e.px + e.r));
    const T0 = performance.now(), D = 7000;
    text.textContent = 'Orbiter overhead. Scanning the new ground...';
    [0, 2, 4, 7, 9].forEach((n, k) => setTimeout(() => cv.isConnected && playNote(n), 900 + k * 1300));
    const mist = (c, t, sx, behind) => {
      ext.forEach((e, ei) => { for (let k = 0; k < 26; k++) {
        const ang = k * 2.4 + ei, rad = e.r * (.15 + .8 * ((k * 37 % 16) / 16)) , bx = e.px + Math.cos(ang) * rad + Math.sin(t * 1.2 + k) * 7, by0 = e.py + Math.sin(ang) * rad + Math.cos(t * .9 + k * 1.7) * 5, br = 24 + (k % 5) * 7;
        const d = bx - sx; if (behind ? d > 0 || d < -110 : d <= 0) continue;
        const a = behind ? .6 * (1 + d / 110) : .6, by = behind ? by0 + d * .5 : by0;
        const g = c.createRadialGradient(bx, by, 0, bx, by, br); g.addColorStop(0, `rgba(250,244,232,${a})`); g.addColorStop(.55, `rgba(185,170,150,${a * .5})`); g.addColorStop(1, 'rgba(185,170,150,0)');
        c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill(); } });
    };
    const trail = [], sparks = [];
    const frame = now => {
      if (!cv.isConnected) return;
      const t = Math.max(0, Math.min(1, (now - T0) / D)), tt = (now - T0) / 1000, sx = xmin - 40 + (xmax - xmin + 80) * (t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) * .6 + (xmax - xmin + 80) * t * .4;
      ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W, Hh); ctx.clip();
      drawChart(ctx, S, { layer, layerName: name, circles: base, overlay: (c, p) => { overlay?.(c, p); mist(c, tt, sx, false); } }); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, Hh); ctx.clip();
      drawChart(ctx, S, { layer, layerName: name, circles: all, overlay: (c, p) => { overlay?.(c, p); mist(c, tt, sx, true); } }); ctx.restore();
      // scan band: a wide swath of light on the ground, narrowing up to the orbiter, with moving scan lines
      let y0 = 1e9, y1 = -1e9; ext.forEach(e => { const dx = sx - e.px; if (Math.abs(dx) < e.r) { const h = Math.sqrt(e.r * e.r - dx * dx); y0 = Math.min(y0, e.py - h); y1 = Math.max(y1, e.py + h); } });
      const sy = 30 + Math.sin(tt * 2.2) * 3, k = 2.3;
      trail.push([sx, sy]); if (trail.length > 140) trail.shift();
      ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(40,140,190,.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); trail.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
      if (y1 > y0) {
        const bw = 34, bm = ctx.createLinearGradient(0, sy, 0, y1); bm.addColorStop(0, 'rgba(160,240,255,.7)'); bm.addColorStop(.35, 'rgba(100,210,255,.32)'); bm.addColorStop(1, 'rgba(100,210,255,.1)');
        ctx.fillStyle = bm; ctx.beginPath(); ctx.moveTo(sx - 4, sy + 14); ctx.lineTo(sx + 4, sy + 14); ctx.lineTo(sx + bw, y1); ctx.lineTo(sx - bw, y1); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.moveTo(sx - 4, sy + 14); ctx.lineTo(sx + 4, sy + 14); ctx.lineTo(sx + bw, y1); ctx.lineTo(sx - bw, y1); ctx.closePath(); ctx.clip();
        ctx.strokeStyle = 'rgba(230,255,255,.55)'; ctx.lineWidth = 1; for (let yy = y0 - 40 + (tt * 90) % 14; yy < y1; yy += 14) { ctx.beginPath(); ctx.moveTo(sx - bw, yy); ctx.lineTo(sx + bw, yy); ctx.stroke(); } ctx.restore();
        ctx.save(); ctx.strokeStyle = 'rgba(190,245,255,1)'; ctx.lineWidth = 2.6; ctx.shadowColor = '#4fc3f7'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(sx, Math.max(y0, sy + 14)); ctx.lineTo(sx, y1); ctx.stroke(); ctx.restore();
        for (let n = 0; n < 3; n++) sparks.push({ x: sx + (Math.random() - .5) * 8, y: y0 + Math.random() * (y1 - y0), vx: -20 - Math.random() * 40, vy: -10 - Math.random() * 25, l: 1 });
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i]; q.x += q.vx / 60; q.y += q.vy / 60; q.l -= .025; if (q.l <= 0) { sparks.splice(i, 1); continue; } ctx.fillStyle = `rgba(210,250,255,${q.l})`; ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 * q.l + .4, 0, 7); ctx.fill(); }
      ctx.save(); ctx.shadowColor = 'rgba(80,200,255,.9)'; ctx.shadowBlur = 16; drawSat(ctx, sx, sy, Math.sin(tt * 2.2) * .05, k); ctx.restore();
      if (t < 1) requestAnimationFrame(frame); else finish();
    };
    requestAnimationFrame(frame);
    return close;
  }
}
