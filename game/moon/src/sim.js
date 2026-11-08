// The outpost's resources and tasks. Pure logic (no DOM, no Three.js) so it can be tested in Node.
// Three core resources, like the Mars game: POWER, OXYGEN and WATER, plus a SCIENCE score.
// Every choice costs something: making oxygen eats power and water, melting ice eats power, the suit heater
// in the dark crater eats suit power, charging the rover drains the base battery.
// All rates are GAME RULES tuned for play (per real second), not real engineering numbers.
import { SITES } from './config.js';

export const RATES = Object.freeze({
  mastSolar: 0.17,      // battery % per second per lit solar mast
  habLoad: 0.11,        // life support, heaters, radio
  electroPower: 0.3, electroWater: 0.11, electroOxygen: 0.17,
  meltPower: 0.14, meltWater: 0.6, waterPerIce: 16,
  breathe: 0.045, drink: 0.014, darkScrubbers: 0.16,
  suitO2: 0.3, suitO2Run: 0.38, suitPower: 0.07, heater: 0.55, suitRefill: 9, refillCost: 0.02,
  roverDrain: 0.3, roverCharge: 1.6, roverChargeCost: 0.35,
  sepWarning: 40, sepLength: 45, sepDose: 2.2,
});

export const TASKS = [
  { id: 'stepDown', title: 'Step onto the Moon', hint: 'Ride the lander elevator down and walk away from the lander.', fact: 'moon-gravity' },
  { id: 'mast', title: 'Raise a second solar mast', hint: 'Walk to a glowing mast marker on the ridge and hold Use.', fact: 'moon-south-pole-light' },
  { id: 'drive', title: 'Drive the rover to the dark crater', hint: 'Get in the rover (R) and follow the blue marker into the shadowed crater.', fact: 'moon-temperature' },
  { id: 'ice', title: 'Drill 2 loads of ice', hint: 'Hold Use at the drill marker on the crater floor. Your suit heater works hard in the cold.', fact: 'moon-ice' },
  { id: 'deliver', title: 'Melt ice into water', hint: 'Bring ice to the processor next to the lander and press Use.', fact: 'moon-ice' },
  { id: 'oxygen', title: 'Make oxygen from water', hint: 'Switch on the oxygen maker at the processor. It needs lots of power.', fact: 'moon-ice' },
  { id: 'samples', title: 'Collect 3 rock samples', hint: 'Scan rocks at the yellow markers, then stow them at the lander.', fact: 'moon-dust' },
  { id: 'instruments', title: 'Set up 2 science instruments', hint: 'Place the seismometer and the laser reflector at the white markers.', fact: 'moon-vacuum' },
];

export function newState(seed = 1) {
  return {
    v: 1, seed, t: 0, status: 'playing', lostReason: '',
    battery: 72, oxygen: 78, water: 46, science: 0,
    suitO2: 100, suitPower: 100, suitDust: 0, dose: 0,
    roverBattery: 100, roverIce: 0, handIce: 0, processorIce: 0, meltProgress: 0, oxygenMade: 0, waterMade: 0,
    masts: [true, false, false], electrolysis: false,
    carried: [], samples: {}, instruments: { seismometer: false, reflector: false },
    tasks: Object.fromEntries(TASKS.map(t => [t.id, false])),
    alert: null, nextAlert: 150, rescues: 0, warned: {},
    stats: { metres: 0, jumps: 0, iceLoads: 0, drives: 0 },
  };
}

const clamp = v => Math.max(0, Math.min(100, v));
const done = (s, id, ev) => { if (!s.tasks[id]) { s.tasks[id] = true; ev.push({ type: 'task', id }); } };
export const tasksDone = s => TASKS.filter(t => s.tasks[t.id]).length;
export const nextTask = s => TASKS.find(t => !s.tasks[t.id]) || null;

// Advance the outpost by dt seconds. env: { lit 0..1, place 'outside'|'hab'|'rover', shadow 0..1,
// driving 0..1, running bool, nearBase bool, sepTimes [game seconds] }. Returns events for the UI.
export function tick(s, dt, env = {}) {
  const ev = []; if (s.status !== 'playing' || !(dt > 0)) return ev;
  dt = Math.min(dt, 0.5);
  const R = RATES, lit = env.lit ?? 1, place = env.place || 'outside';
  s.t += dt;
  // power
  const solar = s.masts.filter(Boolean).length * R.mastSolar * lit;
  let load = R.habLoad;
  const powered = s.battery > 0.01;
  if (s.electrolysis && powered && s.water > 0.2) {
    load += R.electroPower; s.water -= R.electroWater * dt; s.oxygen += R.electroOxygen * dt; s.oxygenMade += R.electroOxygen * dt;
    if (s.oxygenMade >= 10) done(s, 'oxygen', ev);
  } else if (s.electrolysis && s.water <= 0.2) { s.electrolysis = false; ev.push({ type: 'warn', text: 'Oxygen maker stopped: no water left.' }); }
  if (s.processorIce > 0 && powered) {
    load += R.meltPower; const w = R.meltWater * dt; s.water += w; s.waterMade += w; s.meltProgress += w;
    if (s.meltProgress >= R.waterPerIce) { s.meltProgress -= R.waterPerIce; s.processorIce--; done(s, 'deliver', ev); ev.push({ type: 'info', text: 'One ice load melted into water.' }); }
  }
  if (env.nearBase && s.roverBattery < 100 && place !== 'rover' && powered) { s.roverBattery += R.roverCharge * dt; load += R.roverChargeCost; }
  s.roverBattery += Math.max(0,lit) * (1-(env.shadow||0)) * dt/3; // onboard solar: accelerated training rate
  s.battery += (solar - load) * dt;
  // crew
  s.oxygen -= (R.breathe + (powered ? 0 : R.darkScrubbers)) * dt;
  s.water -= R.drink * dt;
  // suit
  if (place === 'outside') {
    s.suitO2 -= (env.running ? R.suitO2Run : R.suitO2) * dt;
    s.suitPower -= (R.suitPower + R.heater * (env.shadow || 0)) * dt;
  } else {
    const need = Math.min(100 - s.suitO2, R.suitRefill * dt);
    if (need > 0 && s.oxygen > 1) { s.suitO2 += need; s.oxygen -= need * R.refillCost; }
    s.suitPower += R.suitRefill * dt;
    s.suitDust = Math.max(0, s.suitDust - (place === 'hab' ? 6 : 1) * dt);
  }
  if (place === 'rover') s.roverBattery -= R.roverDrain * (env.driving || 0) * dt;
  // solar particle alerts (timing comes from real DONKI event dates, squeezed into the game)
  if (!s.alert && s.t >= s.nextAlert) {
    s.alert = { start: s.t, until: s.t + R.sepWarning + R.sepLength };
    s.nextAlert = s.t + (env.alertGap || 330);
    ev.push({ type: 'alert', text: `Solar particle alert! Get inside the lander or rover within ${R.sepWarning} seconds.`, fact: 'moon-radiation' });
  }
  if (s.alert) {
    const storm = s.t >= s.alert.start + R.sepWarning;
    if (storm && place !== 'hab') s.dose += R.sepDose * (place === 'rover' ? 0.35 : 1) * dt;
    if (s.t >= s.alert.until) { s.alert = null; ev.push({ type: 'info', text: s.dose > 0 ? 'Storm over. Your dosimeter logged some radiation.' : 'Storm over - sheltering kept your dose low.' }); }
  }
  for (const k of ['battery', 'oxygen', 'water', 'suitO2', 'suitPower', 'roverBattery']) s[k] = clamp(s[k]);
  // warnings, once each until they recover
  const warn = (key, bad, text) => { if (bad && !s.warned[key]) { s.warned[key] = true; ev.push({ type: 'warn', text }); } else if (!bad) s.warned[key] = false; };
  warn('battery', s.battery < 15, 'Base battery low - raise more solar masts or switch the oxygen maker off.');
  warn('suitO2', place === 'outside' && s.suitO2 < 25, 'Suit oxygen low - head back to the lander or rover.');
  warn('suitPower', place === 'outside' && s.suitPower < 20, 'Suit power low - the cold is draining your heater.');
  warn('rover', s.roverBattery < 15, 'Rover battery low - park it next to the lander to charge.');
  warn('oxygen', s.oxygen < 20, 'Base oxygen is low! Make oxygen from water.');
  // emergencies: kids are rescued, never killed
  if (place === 'outside' && (s.suitO2 <= 0 || s.suitPower <= 0 || s.dose >= 60)) {
    ev.push({ type: 'rescue', text: s.dose >= 60 ? 'Too much radiation - Mission Control called you back to the lander.' : 'Your suit ran out - your crewmate helped you back to the lander.' });
  }
  if (s.oxygen <= 0) { s.status = 'lost'; s.lostReason = 'The base ran out of oxygen.'; ev.push({ type: 'end' }); }
  if (tasksDone(s) === TASKS.length && s.status === 'playing') { s.status = 'won'; ev.push({ type: 'end' }); }
  return ev;
}

export function rescue(s) {
  s.rescues++; s.science = Math.max(0, s.science - 8); s.suitO2 = 100; s.suitPower = 100; s.dose = Math.min(s.dose, 40);
  s.carried = []; s.handIce = 0;
}

// ---- player actions (each returns a short message, or '' if nothing happened) ----
export function deployMast(s, i) {
  if (s.masts[i]) return '';
  s.masts[i] = true; s.science += 2;
  if (s.masts.filter(Boolean).length >= 2) s.tasks.mast = true;
  return 'Solar mast raised. It turns to follow the low Sun.';
}
export function drillIce(s, roverNear) {
  if (roverNear && s.roverIce < 3) { s.roverIce++; } else if (s.handIce < 1) { s.handIce = 1; } else return 'No room - bring the rover closer (it carries 3 loads).';
  s.stats.iceLoads++; if (s.stats.iceLoads >= 2) s.tasks.ice = true;
  s.suitDust = Math.min(100, s.suitDust + 10);
  return roverNear ? `Ice loaded into the rover (${s.roverIce}/3).` : 'You carry one ice load.';
}
export function deliverIce(s, roverNear) {
  const n = s.handIce + (roverNear ? s.roverIce : 0); if (!n) return '';
  s.processorIce += n; s.handIce = 0; if (roverNear) s.roverIce = 0;
  return `${n} ice load${n > 1 ? 's' : ''} in the melter. Melting uses power.`;
}
export function toggleElectrolysis(s) {
  if (!s.electrolysis && s.water < 1) return 'No water to split. Melt some ice first.';
  s.electrolysis = !s.electrolysis;
  return s.electrolysis ? 'Oxygen maker ON: splitting water into oxygen (uses lots of power).' : 'Oxygen maker OFF.';
}
export function collectSample(s, id) {
  if (s.samples[id] || s.carried.includes(id)) return '';
  if (s.carried.length >= 3) return 'Sample bag full - stow samples at the lander.';
  s.carried.push(id); return 'Sample scanned and bagged.';
}
export function stowSamples(s) {
  if (!s.carried.length) return '';
  let pts = 0; for (const id of s.carried) { s.samples[id] = true; pts += SITES.samples.find(x => x.id === id)?.science || 8; }
  const n = s.carried.length; s.carried = []; s.science += pts;
  if (Object.keys(s.samples).length >= 3) s.tasks.samples = true;
  return `${n} sample${n > 1 ? 's' : ''} stowed for Earth (+${pts} science).`;
}
export function deployInstrument(s, id) {
  if (s.instruments[id] === undefined || s.instruments[id]) return '';
  s.instruments[id] = true; s.science += 15;
  if (Object.values(s.instruments).every(Boolean)) s.tasks.instruments = true;
  return id === 'seismometer' ? 'Seismometer set up: it will feel moonquakes and meteorite impacts.' : 'Laser reflector set: Earth can bounce lasers off it to measure the distance.';
}
export function score(s) {
  return Math.round(s.science + tasksDone(s) * 10 + s.oxygenMade * 0.5 - s.rescues * 5 - s.dose * 0.2);
}

// Is this a save we can trust? (anything else falls back to a new game)
export function validState(s) {
  if (!s || typeof s !== 'object' || s.v !== 1) return false;
  for (const k of ['t', 'battery', 'oxygen', 'water', 'science', 'suitO2', 'suitPower', 'roverBattery']) if (!Number.isFinite(s[k])) return false;
  return Array.isArray(s.masts) && s.masts.length === 3 && s.tasks && typeof s.tasks === 'object' && Array.isArray(s.carried);
}
