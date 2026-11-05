// The soundscape, built around a REAL recording of Mars: wind heard by the SuperCam microphone on
// NASA's Perseverance rover on its 4th sol (22 Feb 2021) - assets/sound/mars-wind-perseverance.mp3.
// Everything else is made live with the Web Audio API (no files): breathing and the fan inside your
// suit, soft footsteps, the hum of the outpost's life support, and the launch rumble.
//
// Mars facts behind the mix (NASA/JPL, Perseverance microphones): sound on Mars is much quieter than on
// Earth, fades out within about 8 m, and high pitches are lost first - so the wind is kept soft and muffled.

let ctx, master, wind, windFilter, windGain, suitGain, breathGain, breathFilter, humGain, rumbleGain, rumbleFilter, noise;
let muted = false, started = false, breathT = 0, gustT = 0, gust = 1, state = { scene: 'title' };
try { muted = localStorage.getItem('ja-muted') === '1'; } catch { /* storage blocked */ }

const ramp = (param, value, time = 0.4) => param.setTargetAtTime(value, ctx.currentTime, time);

function makeNoise(seconds, brown = false) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
function loop(buffer, dest) {
  const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.connect(dest); s.start(); return s;
}
// Make a recording loop without a click: blend its last 2 s into its first 2 s.
function seamless(buf, fade = 2) {
  const f = Math.min(Math.floor(fade * buf.sampleRate), Math.floor(buf.length / 3)), len = buf.length - f;
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    dst.set(src.subarray(0, len));
    for (let i = 0; i < f; i++) { const t = i / f; dst[i] = src[i] * t + src[len + i] * (1 - t); }
  }
  return out;
}

// Browsers only allow sound after a click, so the Launch button calls this.
export async function startSound() {
  if (started) { ctx?.resume(); return; }
  started = true;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  noise = { white: makeNoise(2), brown: makeNoise(4, true) };

  // Mars wind (real NASA recording), through a filter that muffles it more when you are indoors
  windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 2400;
  windGain = ctx.createGain(); windGain.gain.value = 0;
  windFilter.connect(windGain).connect(master);
  fetch('assets/sound/mars-wind-perseverance.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
    .then(buf => { wind = loop(seamless(buf), windFilter); })
    .catch(() => { wind = loop(noise.brown, windFilter); });      // no file? soft brown noise instead

  // inside your suit: the fan, and your breathing (faster when your air is low)
  suitGain = ctx.createGain(); suitGain.gain.value = 0;
  const fan = ctx.createBiquadFilter(); fan.type = 'lowpass'; fan.frequency.value = 220;
  loop(noise.brown, fan); fan.connect(suitGain).connect(master);
  breathFilter = ctx.createBiquadFilter(); breathFilter.type = 'bandpass'; breathFilter.frequency.value = 700; breathFilter.Q.value = 0.7;
  breathGain = ctx.createGain(); breathGain.gain.value = 0;
  loop(noise.white, breathFilter); breathFilter.connect(breathGain).connect(master);

  // the outpost: a low life-support hum and air circulation
  humGain = ctx.createGain(); humGain.gain.value = 0; humGain.connect(master);
  for (const [f, v] of [[55, 0.5], [110, 0.18], [165, 0.06]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = v; o.connect(g).connect(humGain); o.start();
  }
  const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 400;
  const airG = ctx.createGain(); airG.gain.value = 0.6; loop(noise.brown, air); air.connect(airG).connect(humGain);

  // the launch: a deep rumble that grows with the thrust
  rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 120;
  rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
  loop(noise.brown, rumbleFilter); rumbleFilter.connect(rumbleGain).connect(master);
  apply();
}

// What's happening in the game; called every frame (cheap - it only moves volumes).
export function setSound(s) { state = { ...state, ...s }; }

function apply() {
  if (!ctx) return;
  const s = state, mars = s.scene === 'mars', outside = mars && !s.inside;
  // wind: soft outside (Mars is quiet!), stronger in a dust storm, a faint muffled roar through the walls indoors
  ramp(windGain.gain, mars ? (outside ? 0.55 * gust * (s.dust ? 1.8 : 1) : 0.12) : s.scene === 'arrival' ? 0.18 : 0, 0.6);
  ramp(windFilter.frequency, outside ? (s.dust ? 3200 : 2200) : 320, 0.5);
  ramp(suitGain.gain, outside ? 0.05 : 0, 0.3);
  ramp(humGain.gain, mars && s.inside ? 0.05 : 0, 0.8);
  ramp(rumbleGain.gain, s.scene === 'launch' ? Math.min(1, s.thrust || 0) * 0.9 : 0, 0.25);
  ramp(rumbleFilter.frequency, 80 + Math.min(1, s.thrust || 0) * 220, 0.3);
}

// Runs every frame from the game loop: breathing rhythm, wind gusts, then volumes.
let tickT = 0, applyT = 0;
export function tickSound(dt) {
  if (!ctx || ctx.state !== 'running') return;
  tickT += dt; applyT += dt;
  if (tickT < 0.05) return;                 // 20 updates a second is plenty for volumes
  dt = tickT; tickT = 0;
  const s = state, outside = s.scene === 'mars' && !s.inside;
  gustT -= dt; if (gustT <= 0) { gustT = 2 + Math.random() * 5; gust = 0.6 + Math.random() * 0.8; }
  // breathing: in for ~40% of the cycle, out for the rest; every 4 s normally, every 2.2 s when your suit air is low
  const period = (s.suit ?? 1) < 0.3 ? 2.2 : 4;
  breathT = (breathT + dt / period) % 1;
  const inhale = breathT < 0.4, k = inhale ? breathT / 0.4 : (breathT - 0.4) / 0.6;
  const env = Math.sin(k * Math.PI) * (inhale ? 0.035 : 0.025) * (s.running ? 1.4 : 1);
  breathGain.gain.setTargetAtTime(outside ? env : 0, ctx.currentTime, 0.05);
  breathFilter.frequency.setTargetAtTime(inhale ? 900 : 600, ctx.currentTime, 0.2);
  if (applyT > 0.25) { applyT = 0; apply(); }
}

// A soft, muffled footstep - you mostly hear it through your own suit, not through the thin air.
export function footstep(hard = 0, indoor = false) {
  if (!ctx || muted) return;
  const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise.brown; f.type = 'lowpass'; f.frequency.value = indoor ? 500 : 260 + hard * 120;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18 + hard * 0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 3, 0.3);
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ja-muted', muted ? '1' : '0'); } catch { /* storage blocked */ }
  if (master) ramp(master.gain, muted ? 0 : 0.9, 0.1);
  return muted;
}
export const isMuted = () => muted;
export const soundDebug = () => ({ context: ctx?.state ?? 'not started', windRecording: !!wind && wind.buffer?.duration > 30, windSeconds: wind?.buffer?.duration, muted });
