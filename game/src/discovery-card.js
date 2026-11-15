// The "you've reached somewhere" moment for Spirit's stops, mineral zones and viewpoints: a short title card
// and a synthesised radio-contact chime. Same idea as patch-fx.js's patch awards (own audio context, a sound
// gate and a duck hook so the game can wire in mute and ambient ducking) but for places instead of patches,
// and much lighter: no imports, it never pauses the game, and more than one call just queues.
//
// showDiscovery({ eyebrow, title, sub, accent }) shows one card. If another is already showing, this one
// waits its turn (so a viewpoint sitting inside a mineral zone never overlaps two cards at once).
// Each card stays about 3.5 seconds, has a close button, and with "reduce motion" on it only fades (no glow pulse,
// no scale pop, no sparks).

const CSS = `
.dc { position: fixed; left: 50%; top: 15%; transform: translate(-50%, -50%) scale(1.3); z-index: 25;
  pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;
  width: min(90vw, 520px); opacity: 0; transition: opacity .5s ease .2s, transform .55s cubic-bezier(.34,1.8,.64,1) .2s; }
.dc.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.dc:not(.show) { transition: opacity .5s ease, transform .5s ease; }
.dc-eyebrow { font: 13px/1 system-ui, sans-serif; letter-spacing: .2em; color: #9fb3c4; margin: 0; }
.dc-rule { height: 1px; width: 0; background: var(--dc, #7fd4e8); box-shadow: 0 0 8px var(--dc, #7fd4e8);
  transition: width .55s cubic-bezier(.16,.84,.24,1); }
.dc.show .dc-rule { width: 130px; }
.dc-title { font: 900 clamp(22px, 4.6vmin, 38px)/1.1 'Orbitron', system-ui, sans-serif; letter-spacing: .04em;
  margin: 0; color: #fbfdff; }
.dc.show .dc-title { animation: dc-glow 1.8s ease-in-out .45s infinite; }
@keyframes dc-glow {
  0%, 100% { text-shadow: 0 0 6px #fff, 0 0 18px var(--dc, #7fd4e8), 0 0 36px var(--dc, #7fd4e8), 0 0 60px var(--dc, #7fd4e8); transform: scale(1); }
  50% { text-shadow: 0 0 10px #fff, 0 0 34px var(--dc, #7fd4e8), 0 0 64px var(--dc, #7fd4e8), 0 0 100px var(--dc, #7fd4e8); transform: scale(1.04); }
}
.dc-sub { font: 15px/1.3 system-ui, sans-serif; letter-spacing: .02em; color: #9fb3c4; margin: 0; max-width: 86%; }
.dc-close { pointer-events: auto; position: absolute; top: -8px; right: -4px; width: 44px; height: 44px; padding: 0; border-radius: 50%;
  border: 1px solid rgba(159,179,196,.45); background: rgba(8,14,20,.72); color: #dfeaf2; font: 20px/1 system-ui, sans-serif; cursor: pointer; }
.dc-close:focus-visible { outline: 2px solid var(--dc, #7fd4e8); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .dc, .dc:not(.show) { transform: translate(-50%, -50%); transition: opacity .2s linear; }
  .dc.show { transform: translate(-50%, -50%); }
  .dc.show .dc-title { animation: none; text-shadow: 0 0 8px var(--dc, #7fd4e8); }
  .dc-rule { transition: none; }
  .dc-spark { display: none; }
}
.dc-spark { position: fixed; left: 50%; top: 15%; width: 3px; height: 3px; border-radius: 50%;
  background: var(--dc, #7fd4e8); opacity: 0; pointer-events: none; z-index: 25; transform: translate(-50%, -50%); }
.dc-spark.go { animation: dc-spark .8s ease-out .3s forwards; }
@keyframes dc-spark {
  0% { opacity: .9; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))); }
}
`;
let cssDone = false;
function injectCSS() { if (cssDone || typeof document === 'undefined') return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

// ---- sound: same liveCtx/gate/duck pattern as patch-fx.js, but its own context so this module stays self-contained.
let live = null, gate = () => true, duckHook = () => {};
export const setDiscoverySoundGate = fn => { gate = fn; };     // the game passes "not muted"
export const setDiscoveryDuckHook = fn => { duckHook = fn; };  // the game dips its wind and music while a card is up
function liveCtx() {
  if (!live) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; live = new A(); }
  if (live.state === 'suspended') live.resume();
  return live;
}
// A short "radio contact" motif: static burst, then a rising lock-on sweep, then a soft confirm ping.
function playChime() {
  if (!gate()) return;
  const ctx = liveCtx(); if (!ctx) return;
  const t = ctx.currentTime + .02;

  const noiseLen = .1, buf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const nGain = ctx.createGain(); nGain.gain.setValueAtTime(.045, t);
  noise.connect(nGain).connect(ctx.destination); noise.start(t); noise.stop(t + noiseLen);

  const sweep = ctx.createOscillator(); sweep.type = 'sine';
  sweep.frequency.setValueAtTime(520, t + .05); sweep.frequency.exponentialRampToValueAtTime(1300, t + .22);
  const sGain = ctx.createGain();
  sGain.gain.setValueAtTime(0, t + .05); sGain.gain.linearRampToValueAtTime(.08, t + .1); sGain.gain.exponentialRampToValueAtTime(.001, t + .24);
  sweep.connect(sGain).connect(ctx.destination); sweep.start(t + .05); sweep.stop(t + .28);

  const ping = ctx.createOscillator(); ping.type = 'sine'; ping.frequency.setValueAtTime(880, t + .32);
  const pGain = ctx.createGain();
  pGain.gain.setValueAtTime(0, t + .32); pGain.gain.linearRampToValueAtTime(.07, t + .34); pGain.gain.exponentialRampToValueAtTime(.001, t + .5);
  ping.connect(pGain).connect(ctx.destination); ping.start(t + .32); ping.stop(t + .52);
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function burstSparks(accent) {
  if (typeof document === 'undefined' || reducedMotion()) return;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * .3, dist = 70 + Math.random() * 50;
    const sp = document.createElement('div'); sp.className = 'dc-spark'; sp.style.background = accent;
    sp.style.setProperty('--tx', (Math.cos(ang) * dist) + 'px'); sp.style.setProperty('--ty', (Math.sin(ang) * dist * .5) + 'px');
    document.body.appendChild(sp);
    requestAnimationFrame(() => sp.classList.add('go'));
    setTimeout(() => sp.remove(), 1200);
  }
}

// ---- the card: a tiny queue so two discoveries at the same moment never fight for the screen
export const DISCOVERY_MS = 3500;   // was 6 s: long enough to read a title and one line, short enough not to sit over the view
const queue = []; let showing = false;
export function showDiscovery(opts) { queue.push(opts); next(); }
function next() {
  if (showing || !queue.length || typeof document === 'undefined') return;
  showing = true;
  const { eyebrow, title, sub, accent = '#7fd4e8' } = queue.shift();
  injectCSS();
  const root = document.createElement('div'); root.className = 'dc'; root.style.setProperty('--dc', accent);
  root.setAttribute('role', 'status');
  root.innerHTML = '<button type="button" class="dc-close" aria-label="Dismiss message">×</button><p class="dc-eyebrow"></p><div class="dc-rule"></div><h2 class="dc-title"></h2><div class="dc-rule"></div><p class="dc-sub"></p>';
  root.querySelector('.dc-eyebrow').textContent = eyebrow || '';
  root.querySelector('.dc-title').textContent = title || '';
  root.querySelector('.dc-sub').textContent = sub || '';
  document.body.appendChild(root);
  duckHook(true);
  playChime();
  requestAnimationFrame(() => root.classList.add('show'));
  setTimeout(() => burstSparks(accent), 300);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; clearTimeout(timer);
    root.classList.remove('show'); duckHook(false);
    setTimeout(() => { root.remove(); showing = false; next(); }, reducedMotion() ? 220 : 650);
  };
  root.querySelector('.dc-close').onclick = close;
  const timer = setTimeout(close, DISCOVERY_MS);
}
