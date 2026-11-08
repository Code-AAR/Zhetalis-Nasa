// Moon sound: there is NO outside sound in a vacuum - no wind, no engine roar through the air. Everything you
// hear is inside your suit or vehicle: fans, your breathing, radio beeps, and footsteps / wheels felt through
// your body. Levels come from the shared audio preferences (master / ambience / effects / voice, ja-muted).
import { audioVolume } from '../../src/audio-preferences.js';

let ctx, out, amb, fx, voice, fan, breath, rumble, rumbleGain;
const level = () => {
  if (!ctx) return;
  const t = ctx.currentTime, hidden = document.hidden ? 0 : 1;
  amb.gain.setTargetAtTime(audioVolume('ambience') * 0.9 * hidden, t, 0.3);
  fx.gain.setTargetAtTime(audioVolume('effects') * hidden, t, 0.1);
  voice.gain.setTargetAtTime(audioVolume('voice') * hidden, t, 0.1);
};

function noiseBuffer(seconds = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }   // brown-ish noise
  return b;
}

export function startAudio() {
  if (ctx) { ctx.resume(); level(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); out = ctx.createGain(); out.connect(ctx.destination);
  amb = ctx.createGain(); fx = ctx.createGain(); voice = ctx.createGain(); amb.connect(out); fx.connect(out); voice.connect(out);   // radio has its own bus
  const nb = noiseBuffer(3);
  // suit fan: filtered noise + a low hum
  fan = ctx.createBufferSource(); fan.buffer = nb; fan.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  const fg = ctx.createGain(); fg.gain.value = 0.18; fan.connect(lp).connect(fg).connect(amb); fan.start();
  const hum = ctx.createOscillator(); hum.frequency.value = 118; const hg = ctx.createGain(); hg.gain.value = 0.015; hum.connect(hg).connect(amb); hum.start();
  // breathing: noise through a band-pass, gain shaped by a slow cycle
  breath = ctx.createBufferSource(); breath.buffer = nb; breath.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
  const bg = ctx.createGain(); bg.gain.value = 0; breath.connect(bp).connect(bg).connect(amb); breath.start();
  breath.userData = { gain: bg, phase: 0 };
  // rover: motor whine and wheel rumble felt through the seat
  rumble = ctx.createBufferSource(); rumble.buffer = nb; rumble.loop = true;
  const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 160;
  rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0; rumble.connect(rl).connect(rumbleGain).connect(fx); rumble.start();
  const whine = ctx.createOscillator(); whine.type = 'triangle'; whine.frequency.value = 300; const wg = ctx.createGain(); wg.gain.value = 0; whine.connect(wg).connect(fx); whine.start();
  rumble.userData = { whine, wg };
  addEventListener('audio-levels', level); addEventListener('mission-mute', level); document.addEventListener('visibilitychange', level);
  level();
}

// Called every frame. effort 0..1 (walking fast, jumping), driving 0..1, inSuit bool.
export function tickAudio(dt, { effort = 0, driving = 0, inSuit = true } = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const b = breath.userData; b.phase += dt * (0.25 + effort * 0.35) * Math.PI * 2;
  const v = inSuit ? Math.max(0, Math.sin(b.phase)) ** 2 * (0.05 + effort * 0.1) : 0;
  b.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
  rumbleGain.gain.setTargetAtTime(driving * 0.5, ctx.currentTime, 0.2);
  rumble.userData.wg.gain.setTargetAtTime(driving * 0.02, ctx.currentTime, 0.2);
  rumble.userData.whine.frequency.setTargetAtTime(240 + driving * 420, ctx.currentTime, 0.3);
}

// A thump felt through your boots (no air to carry the sound).
export function thump(strength = 0.4) {
  if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(90 + Math.random() * 20, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.25 * strength, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(fx); o.start(t); o.stop(t + 0.2);
}

// Radio beeps: Quindar-style tones like Apollo radio (played by the radio, inside the helmet).
export function beep(kind = 'ok') {
  if (!ctx) return; const t = ctx.currentTime;
  const tones = kind === 'warn' ? [[880, 0], [660, 0.18], [880, 0.36]] : kind === 'done' ? [[660, 0], [880, 0.12], [1320, 0.24]] : [[2525, 0]];
  for (const [f, d] of tones) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.12, t + d + 0.01); g.gain.linearRampToValueAtTime(0, t + d + 0.14);
    o.connect(g).connect(voice); o.start(t + d); o.stop(t + d + 0.16);
  }
}
export const audioDebug = () => ({ state: ctx?.state || 'idle', wind: false });
