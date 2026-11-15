import {audioVolume} from './audio-preferences.js';
// The "you got a patch" moment: sound and animation. No imports, so the preview page can use it too.
//
// Inspired by how Breath of the Wild treats pickups: it has a short fanfare for ordinary items, a longer one
// for spirit orbs and a longest one for key items, so the length of the moment tells you how big the find is.
// We do the same with three tiers (common, rare, key), but the picture is our own: a real mission patch drops
// in, spins like a coin, lands, gets sewn round its border, then flies to the Patches button.
import { SHAPES, PATCHES, patchSVG, medalSVG } from './patch-art.js';

// ---------------------------------------------------------------- timing (seconds) shared by sound and picture
export const TIMES = {
  common: { drop: [.1, 1.0], land: 1.0, sew: [1.0, 1.5], reveal: 1.5, fly: 3.3, end: 3.95, ticks: 6, sparks: 14 },
  rare: { drop: [.1, 1.35], land: 1.35, sew: [1.35, 2.15], reveal: 2.25, fly: 4.9, end: 5.6, ticks: 10, sparks: 24 },
  key: { drop: [.1, 1.95], land: 1.95, sew: [1.95, 3.1], reveal: 3.3, fly: 8.4, end: 9.15, ticks: 16, sparks: 40 },
};

// ---------------------------------------------------------------- sound (all made from oscillators and noise)
const NOISE = new WeakMap(), IR = new WeakMap();
function noiseBuf(ctx) {
  let b = NOISE.get(ctx);
  if (!b) { b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; NOISE.set(ctx, b); }
  return b;
}
// A big soft room made from fading noise: it is what makes plucked notes bloom and hang in the air.
function reverbIR(ctx) {
  let b = IR.get(ctx);
  if (!b) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 3.4); b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp += ((Math.random() * 2 - 1) - lp) * (.6 - .5 * t); d[i] = lp * Math.pow(1 - t, 2.7) * Math.min(1, i / (sr * .025)); } }
    IR.set(ctx, b);
  }
  return b;
}
function tone(ctx, out, t, hz, dur, { type = 'triangle', gain = .15, a = .012 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hz;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
}
// A plucked harp string: bright for a moment, then it mellows as it rings out.
function pluck(ctx, out, t, hz, dur = 1.8, gain = .2) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.setValueAtTime(Math.min(hz * 9, 9000), t); f.frequency.exponentialRampToValueAtTime(hz * 2.2, t + dur * .6);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0006, t + dur);
  f.connect(g).connect(out);
  [[1, 'triangle', 1], [2, 'sine', .35], [3, 'sine', .12], [4, 'sine', .05]].forEach(([m, type, a]) => {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz * m; og.gain.value = a; o.connect(og).connect(f); o.start(t); o.stop(t + dur + .05);
  });
}
// A glassy bell (frequency modulation: one oscillator wobbling another gives that clear, ringing edge)
function glass(ctx, out, t, hz, dur = 2, gain = .1) {
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = hz; m.frequency.value = hz * 3.5;
  mg.gain.setValueAtTime(hz * 1.5, t); mg.gain.exponentialRampToValueAtTime(hz * .04, t + dur * .5); m.connect(mg).connect(c.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .006); g.gain.exponentialRampToValueAtTime(.0006, t + dur);
  c.connect(g).connect(out); c.start(t); m.start(t); c.stop(t + dur + .05); m.stop(t + dur + .05);
}
function whoosh(ctx, out, t, dur, gain, f0, f1) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf(ctx); f.type = 'bandpass'; f.Q.value = .7;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * .5); g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random(), dur + .05);
}
function tick(ctx, out, t, gain = .09) {            // one stitch going through cloth
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf(ctx); f.type = 'bandpass'; f.frequency.value = 3000 + Math.random() * 1500; f.Q.value = 2.2;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + .035);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random(), .06);
}
function thump(ctx, out, t, gain, f0 = 170, f1 = 45, dur = .4) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
}
function pad(ctx, out, t, freqs, rise, hold, gain) {    // warm chord that swells in, like the light behind the patch
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(1400, t + rise);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + rise); g.gain.linearRampToValueAtTime(gain * .7, t + rise + hold); g.gain.linearRampToValueAtTime(0, t + rise + hold + 1.2);
  f.connect(g).connect(out);
  freqs.forEach((hz, i) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz; o.detune.value = (i % 2 ? 6 : -6); o.connect(f); o.start(t); o.stop(t + rise + hold + 1.3); });
}
const rnd = (a, b) => a + Math.random() * (b - a);
// Our own tune. It sits in D major with a lifted fourth in the answer phrase (that open, wondering colour),
// climbs in four plucked steps and then settles onto a held bell note. Each tier plays more of it.
const D = { D3: 146.83, A3: 220, D4: 293.66, E4: 329.63, F4s: 369.99, A4: 440, B4: 493.88, C5s: 554.37, D5: 587.33, E5: 659.25, F5s: 739.99, G5: 783.99, A5: 880, B5: 987.77, C6s: 1108.7, D6: 1174.7, E6: 1318.5, F6s: 1480, A6: 1760, D7: 2349.3 };

// Put the whole sound for one tier on the timeline, starting at t0. `root` shifts the key a little per patch.
export function scheduleAward(ctx, out, tier, t0 = 0, root = 1) {
  const T = TIMES[tier] || TIMES.common, at = s => t0 + s, r = root, R = at(T.reveal);
  whoosh(ctx, out, at(T.drop[0]), T.drop[1] - T.drop[0], .2, 250, 2400);                  // patch falling in
  thump(ctx, out, at(T.land), tier === 'key' ? .5 : tier === 'rare' ? .36 : .26, tier === 'key' ? 110 : 160, tier === 'key' ? 36 : 48, tier === 'key' ? 1.2 : .45);
  for (let i = 0; i < T.ticks; i++) tick(ctx, out, at(T.sew[0] + (i + Math.random() * .4) * (T.sew[1] - T.sew[0]) / T.ticks));   // sewing
  const P = (n, d, dur, g) => pluck(ctx, out, R + d, D[n] * r, dur, g), G = (n, d, dur, g) => glass(ctx, out, R + d, D[n] * r, dur, g);
  const shimmer = (n, from, step, notes) => { for (let i = 0; i < n; i++) glass(ctx, out, R + from + i * step + rnd(0, .08), D[notes[i % notes.length]] * r, .9, .035); };
  if (tier === 'common') {
    pad(ctx, out, R - .05, [D.D3 * r, D.A3 * r, D.F4s * r], .5, 1.2, .03);
    [['D5', 0], ['F5s', .14], ['A5', .28], ['C6s', .42]].forEach(([n, d], i) => { P(n, d, 1.4, .2); if (i === 3) G(n, d, 1.2, .06); });   // up the steps
    G('E6', .66, 2.6, .12); P('D4', .66, 2.2, .22); P('A4', .7, 2, .12);                    // settle on the held bell
    shimmer(4, 1.1, .2, ['A6', 'D7', 'F6s', 'A6']);
  } else if (tier === 'rare') {
    pad(ctx, out, at(.3), [D.D3 * r, D.A3 * r, D.E4 * r, D.F4s * r], T.land - .3, 1.2, .035);   // light swelling behind the patch
    ['D4', 'A4', 'D5', 'F5s', 'A5', 'C6s', 'E6'].forEach((n, i) => P(n, i * .09, 1.5, .17));  // a rising run, like a harp glissando
    G('E6', .62, 2.8, .1); G('A6', .7, 2.2, .045);
    [['B5', 1.2], ['A5', 1.38], ['F5s', 1.56], ['A5', 1.74]].forEach(([n, d]) => P(n, d, 1.2, .15));   // answer
    P('D6', 2.0, 2.6, .2); G('D6', 2.0, 3, .08); P('D4', 2.0, 2.4, .2); P('A4', 2.03, 2.4, .12); P('F5s', 2.06, 2.4, .11);
    shimmer(7, 2.1, .2, ['A6', 'D7', 'F6s', 'E6']);
  } else {
    pad(ctx, out, at(.3), [D.D3 * r, D.A3 * r, D.E4 * r, D.F4s * r, D.D4 * r, D.A4 * r], T.land - .3, T.reveal - T.land + 2.4, .045);
    thump(ctx, out, at(.45), .26, 90, 40, 1);                                                // distant drum as it starts to fall
    ['D5', 'E5', 'F5s', 'A5', 'B5', 'D6', 'E6', 'F6s'].forEach((n, i) => G(n, i * .1, .9, .07));   // the name appearing, letter by letter
    [['D5', 1.2], ['F5s', 1.36], ['A5', 1.52], ['C6s', 1.68]].forEach(([n, d]) => P(n, d, 1.5, .2));  // first phrase
    G('E6', 1.9, 2.4, .1);
    [['A5', 2.9], ['F5s', 3.08], ['B5', 3.26], ['A5', 3.44]].forEach(([n, d]) => P(n, d, 1.3, .17));   // answer
    ['D4', 'A4', 'D5', 'F5s', 'A5', 'C6s'].forEach((n, i) => P(n, 4.0 + i * .035, 3.2, .17));   // big strummed chord
    P('D3', 4.0, 3.4, .3); G('D6', 4.0, 3.4, .1); G('A6', 4.08, 3, .06); G('D7', 4.16, 2.4, .035);
    thump(ctx, out, R + 4.0, .3, 80, 34, 1.4);
    shimmer(14, 1.5, .26, ['A6', 'D7', 'F6s', 'E6', 'C6s']);
  }
  whoosh(ctx, out, at(T.fly), .55, .14, 2200, 300);                                          // flying off to the button
  glass(ctx, out, at(T.fly + .55), D.D7 * r, .8, .05);
}

const activeBuses=new Set();
for(const event of ['audio-levels','mission-mute'])addEventListener(event,()=>{for(const bus of activeBuses)bus.gain.setTargetAtTime(.9*audioVolume('effects'),bus.context.currentTime,.04);});
let live = null, gate = () => true;
export const setSoundGate = fn => { gate = fn; };      // the game passes "not muted"
function chain(ctx, dest) {
  const bus = ctx.createGain(), comp = ctx.createDynamicsCompressor(), conv = ctx.createConvolver(), wet = ctx.createGain();
  bus.gain.value = .9*audioVolume('effects'); if(ctx===live){activeBuses.add(bus);setTimeout(()=>{activeBuses.delete(bus);bus.disconnect();comp.disconnect();conv.disconnect();wet.disconnect();},20000);} conv.buffer = reverbIR(ctx); wet.gain.value = .55;
  bus.connect(comp); bus.connect(conv); conv.connect(wet); wet.connect(comp); comp.connect(dest);
  return bus;
}
let duckHook = () => {};
export const setDuckHook = fn => { duckHook = fn; };    // the game dips its wind and music while an award plays
function liveCtx() {
  if (!live) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; live = new A(); }
  if (live.state === 'suspended') live.resume();
  return live;
}
export function playAward(tier, root = 1) {
  if (!gate()) return;
  const ctx = liveCtx(); if (!ctx) return;
  scheduleAward(ctx, chain(ctx, ctx.destination), tier, ctx.currentTime + .03, root);
  duckHook(true); setTimeout(() => duckHook(false), (TIMES[tier] || TIMES.common).fly * 1000 + 600);
}
// every patch has its own note (a major pentatonic scale over a few octaves), so the patch book can be played
export const noteFor = i => 130.81 * Math.pow(2, [0, 2, 4, 7, 9][i % 5] / 12 + Math.floor(i / 5));
export function playNote(i) {
  if (!gate()) return;
  const ctx = liveCtx(); if (!ctx) return;
  const out = chain(ctx, ctx.destination), t = ctx.currentTime + .01;
  pluck(ctx, out, t, noteFor(i) * 2, 1.6, .22); glass(ctx, out, t, noteFor(i) * 2, 1.2, .04);
}
export const patchRoot = id => Math.pow(2, [0, 2, 4, 7, 9][Math.max(0, PATCHES.findIndex(p => p.id === id)) % 5] / 12 - .2);

// Render a tier to a WAV file (used by the preview page's "download sound" and for checking the sound without speakers).
export async function renderAwardWav(tier, root = 1) {
  const T = TIMES[tier], sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(sr * (T.end + 1.2)), sr);
  scheduleAward(ctx, chain(ctx, ctx.destination), tier, 0, root);
  const buf = await ctx.startRendering(), n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const out = new DataView(new ArrayBuffer(44 + n * 4)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
  return new Blob([out], { type: 'audio/wav' });
}

// ---------------------------------------------------------------- picture
const CSS = `
.sew { stroke-dasharray: 1 1; stroke-dashoffset: 1; opacity: 0; }
.pa { position: fixed; inset: 0; z-index: 60; pointer-events: none; overflow: hidden; font-family: system-ui, sans-serif; color: #fff; --cy: 44%; }
.pa-dim { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at 50% var(--cy), rgba(8,10,18,.55), rgba(2,3,6,.9)); }
.pa[data-tier=key] .pa-dim { background: radial-gradient(ellipse at 50% var(--cy), rgba(10,12,22,.7), rgba(0,0,0,.95)); }
.pa-rays { position: absolute; left: 50%; top: var(--cy); width: 190vmax; height: 190vmax; margin: -95vmax 0 0 -95vmax; opacity: 0; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255,232,170,.34) 0 5deg, rgba(255,232,170,0) 5deg 20deg);
  -webkit-mask-image: radial-gradient(circle, #000 0, rgba(0,0,0,.6) 9%, transparent 22%); mask-image: radial-gradient(circle, #000 0, rgba(0,0,0,.6) 9%, transparent 22%); }
.pa-halo { position: absolute; left: 50%; top: var(--cy); width: 0; height: 0; border-radius: 50%; opacity: 0; transform: translate(-50%, -50%);
  background: radial-gradient(circle, color-mix(in srgb, var(--pc) 70%, #fff) 0, transparent 70%); }
.pa-stage { position: absolute; left: 50%; top: var(--cy); width: 0; height: 0; perspective: 1100px; }
.pa-fly, .pa-patch { position: absolute; left: 0; top: 0; }
.pa-patch { transform-origin: 50% 50%; opacity: 0; filter: drop-shadow(0 18px 22px rgba(0,0,0,.55)); }
.pa-patch svg { display: block; overflow: visible; }
.pa-text { position: absolute; left: 0; right: 0; text-align: center; padding: 0 16px; }
.pa-text small { display: block; font-size: clamp(.68rem, 1.6vmin, .82rem); letter-spacing: .22em; text-transform: uppercase; color: #ffd27a; opacity: 0; }
.pa-text h2 { margin: .35em 0 .25em; font-size: clamp(1.5rem, 5.4vmin, 2.8rem); letter-spacing: .02em; font-weight: 800; text-shadow: 0 2px 18px rgba(0,0,0,.7); }
.pa-text h2 span { display: inline-block; opacity: 0; }
.pa-text p { margin: 0 auto; max-width: none; font-size: clamp(.8rem, 2vmin, 1.05rem); color: rgba(255,255,255,.78); opacity: 0; }
.pa-spark { position: absolute; left: 0; top: 0; width: 14px; height: 14px; margin: -7px 0 0 -7px; opacity: 0; background: #ffe39a;
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); }
.pa-pulse { box-shadow: 0 0 0 0 rgba(255,210,122,.7); animation: pa-pulse .7s ease-out; }
@keyframes pa-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,210,122,.75); transform: scale(1); } 40% { transform: scale(1.18); } 100% { box-shadow: 0 0 0 22px rgba(255,210,122,0); transform: scale(1); } }
`;
let cssDone = false;
function injectCSS() { if (cssDone || typeof document === 'undefined') return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ms = s => s * 1000;

// Show the award. Resolves when it has flown away. opts: { target: selector of the button it flies to, silent, root }
export function showAward(p, opts = {}) {
  injectCSS();
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tier = reduce ? 'common' : (p.tier || 'common'), T = TIMES[tier];
  const size = Math.round(Math.max(150, Math.min(innerWidth * .62, innerHeight * .46, 340)));
  const sh = SHAPES[p.shape] || SHAPES.circle, num = p.medal ? '' : ` · No. ${String(PATCHES.findIndex(x => x.id === p.id) + 1).padStart(2, '0')}`;
  const root = document.createElement('div');
  root.className = 'pa'; root.dataset.tier = tier; root.style.setProperty('--pc', p.colour);
  const letters = tier === 'key' ? [...p.name].map(c => `<span>${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('') : esc(p.name);
  root.innerHTML = `<div class="pa-dim"></div><div class="pa-rays"></div><div class="pa-halo"></div>
    <div class="pa-stage"><div class="pa-fly"><div class="pa-patch" style="margin:${p.medal ? -size * .48 : -size / 2}px 0 0 ${p.medal ? -size * .4 : -size / 2}px">${p.medal ? medalSVG(size * .8) : patchSVG(p, false, size, { glint: true })}</div></div>
    <div class="pa-text" style="top:${size / 2 + 22}px;left:-50vw;right:auto;width:100vw"><small>${p.medal ? 'Final award' : esc(sh.name) + ' patch earned'}${num}</small><h2>${letters}</h2><p>${esc(p.hint)}</p></div></div>`;
  const dismiss = document.createElement('button'); dismiss.textContent = 'Close'; dismiss.setAttribute('aria-label', 'Close award'); dismiss.style.cssText = 'position:absolute;right:16px;top:max(16px,env(safe-area-inset-top));min-height:44px;pointer-events:auto;z-index:10'; root.appendChild(dismiss);
  document.body.appendChild(root);
  const $ = s => root.querySelector(s), A = (el, kf, o) => el.animate(kf, { fill: 'both', ...o });
  const dim = $('.pa-dim'), rays = $('.pa-rays'), halo = $('.pa-halo'), patch = $('.pa-patch'), fly = $('.pa-fly'), text = $('.pa-text');
  const small = $('small'), h2 = $('h2'), hint = $('p'), sew = root.querySelector('.sew'), glint = root.querySelector('.glint');
  const stage = $('.pa-stage');
  if (!opts.silent) playAward(tier, opts.root ?? patchRoot(p.id));

  A(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: ms(.35) });
  if (reduce) {
    A(patch, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ms(.4), delay: ms(.2) });
    [small, h2, hint].forEach(e => A(e, [{ opacity: 0 }, { opacity: 1 }], { duration: ms(.4), delay: ms(T.reveal - .5) }));
  } else {
    // drop in and spin like a coin, overshoot, settle
    const spins = tier === 'key' ? 1080 : 720;
    A(patch, [
      { opacity: 0, transform: 'translateY(-72vh) rotateY(0deg) rotateZ(-16deg) scale(.45)', offset: 0 },
      { opacity: 1, offset: .22 },
      { transform: `translateY(0) rotateY(${spins - 160}deg) rotateZ(5deg) scale(1.16)`, offset: .72 },
      { transform: `translateY(0) rotateY(${spins - 20}deg) rotateZ(-2deg) scale(.97)`, offset: .88 },
      { opacity: 1, transform: `translateY(0) rotateY(${spins}deg) rotateZ(0deg) scale(1)`, offset: 1 },
    ], { duration: ms(T.drop[1] - T.drop[0]), delay: ms(T.drop[0]), easing: 'cubic-bezier(.2,.75,.3,1)' });
    // border gets sewn
    if (sew) A(sew, [{ opacity: 1, strokeDashoffset: 1 }, { opacity: 1, strokeDashoffset: 0, offset: .8 }, { opacity: 0, strokeDashoffset: 0 }], { duration: ms(T.sew[1] - T.sew[0] + .5), delay: ms(T.sew[0]) });
    // shine sweeps across when the name appears
    const shine = d => glint && A(glint, [{ opacity: .6, transform: 'translateX(0)' }, { opacity: .6, transform: 'translateX(75px)', offset: .95 }, { opacity: 0, transform: 'translateX(75px)' }], { duration: ms(.7), delay: ms(d) });
    shine(T.reveal - .1); if (tier !== 'common') shine(T.fly - .8);
    // light behind it
    if (tier !== 'common') {
      A(rays, [{ opacity: 0, transform: 'rotate(0deg) scale(.5)' }, { opacity: 1, transform: 'rotate(40deg) scale(1)', offset: .15 }, { opacity: 1, transform: 'rotate(160deg) scale(1)' }], { duration: ms(T.fly - .3), delay: ms(.3), easing: 'linear' });
    }
    A(halo, [{ opacity: 0, width: '0px', height: '0px' }, { opacity: .85, width: `${size * 1.9}px`, height: `${size * 1.9}px`, offset: .25 }, { opacity: .28, width: `${size * 1.5}px`, height: `${size * 1.5}px` }], { duration: ms(tier === 'common' ? 1 : 1.6), delay: ms(T.land - .05), easing: 'ease-out' });
    if (tier === 'key') A(stage, [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }], { duration: ms(T.fly), delay: ms(.2), easing: 'linear' });   // slow push-in
    // words
    A(small, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: ms(.5), delay: ms(T.reveal - .1) });
    if (tier === 'key') h2.querySelectorAll('span').forEach((s, i) => A(s, [{ opacity: 0, transform: 'translateY(16px) scale(.8)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: ms(.45), delay: ms(T.reveal + i * .06), easing: 'cubic-bezier(.2,.9,.3,1)' }));
    else A(h2, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: ms(.55), delay: ms(T.reveal), easing: 'cubic-bezier(.2,.9,.3,1)' });
    A(hint, [{ opacity: 0 }, { opacity: 1 }], { duration: ms(.6), delay: ms(T.reveal + (tier === 'key' ? p.name.length * .06 : .3)) });
    // sparks: a burst on landing and another when the name appears
    const spark = (when, n, far) => {
      for (let i = 0; i < n; i++) {
        const s = document.createElement('i'); s.className = 'pa-spark'; stage.appendChild(s);
        const ang = Math.random() * Math.PI * 2, d = (size * (.55 + Math.random() * far)), sc = .4 + Math.random() * .9;
        A(s, [{ opacity: 1, transform: 'translate(0,0) scale(0) rotate(0deg)' }, { opacity: 1, transform: `translate(${Math.cos(ang) * d * .6}px,${Math.sin(ang) * d * .6 - 12}px) scale(${sc}) rotate(90deg)`, offset: .35 }, { opacity: 0, transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d + 40}px) scale(0) rotate(240deg)` }], { duration: ms(.9 + Math.random() * .7), delay: ms(when + Math.random() * .1), easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
    };
    spark(T.land, Math.round(T.sparks * .6), .9); spark(T.reveal, Math.round(T.sparks * .5), 1.1);
  }
  // fly to the button, fade everything else
  const fadeAt = reduce ? T.reveal + .7 : T.fly, fadeDur = .5;
  const F = { fill: 'forwards' };
  const tgt = document.querySelector(opts.target || '#patch-btn'), tr = tgt?.getBoundingClientRect();
  const hasT = tr && tr.width > 0, tx = hasT ? tr.left + tr.width / 2 : innerWidth - 50, ty = hasT ? tr.top + tr.height / 2 : 40;
  const dx = tx - innerWidth / 2, dy = ty - innerHeight * .44, k = Math.max(.1, (hasT ? tr.height : 36) / size);
  if (reduce) A(root, [{ opacity: 1 }, { opacity: 0 }], { duration: ms(fadeDur), delay: ms(fadeAt), ...F });
  else {
    A(fly, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px,${dy}px) scale(${k})` }], { duration: ms(.6), delay: ms(fadeAt), easing: 'cubic-bezier(.55,0,.9,.4)', ...F });
    A(patch, [{ opacity: 1 }, { opacity: 0 }], { duration: ms(.12), delay: ms(fadeAt + .5), ...F });
    [dim, rays, halo].forEach(e => A(e, [{ opacity: 1 }, { opacity: 0 }], { duration: ms(.5), delay: ms(fadeAt), ...F }));
    A(text, [{ opacity: 1 }, { opacity: 0 }], { duration: ms(.3), delay: ms(fadeAt - .05), ...F });
  }
  return new Promise(res => {
    if (hasT && !reduce) setTimeout(() => { tgt.classList.remove('pa-pulse'); void tgt.offsetWidth; tgt.classList.add('pa-pulse'); setTimeout(() => tgt.classList.remove('pa-pulse'), 800); }, ms(fadeAt + .5));
    const finish = () => { clearTimeout(timer); root.getAnimations({ subtree: true }).forEach(a => a.cancel()); root.remove(); res(); };
    const timer = setTimeout(finish, ms(reduce ? fadeAt + fadeDur + .1 : T.end));
    dismiss.onclick = finish;
  });
}
