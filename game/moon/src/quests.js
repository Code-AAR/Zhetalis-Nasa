// Quest layer for the surface mission: turns the mission state into the current objective (with a real map
// target), a quest log (active / completed / optional) and live warnings. Pure - no DOM, no Three.js - so it
// reads the same state the simulation writes and can be tested in Node. It never changes the state.
import { SITES } from './config.js';
import { TASKS, RATES } from './sim.js';

const ELEVATOR = { x: 0, z: 6.8 };   // foot of the crew elevator (lander radius + 2.6)
const near = (from, list) => list.reduce((best, p) => (!best || Math.hypot(p.x - from.x, p.z - from.z) < Math.hypot(best.x - from.x, best.z - from.z) ? p : best), null);

// Detailed teaching text shown when an objective first appears (then the card collapses to its title).
const DETAIL = {
  stepDown: 'You are inside the lander. Ride the crew elevator down to the surface, then walk a few steps away. In 1/6 of Earth\'s gravity every step is a slow, bouncy hop.',
  mast: 'Near the south pole the Sun creeps around the horizon instead of climbing high, so solar panels stand upright on tall masts and turn to follow it. More masts = more power when the Sun is up.',
  drive: 'The ice is in a permanently shadowed training crater: its floor never gets direct sunlight, so it stays extremely cold. (Its age is not surveyed in this training area.) It is far, so take the rover: it is faster, carries 3 ice loads and refills your suit.',
  ice: 'Drill the frozen soil on the crater floor. Your suit heater works hard in the dark, so watch your suit power. Park the rover close and the ice goes straight into its cargo bay.',
  deliver: 'Bring the ice to the processor beside the lander. It melts the ice into water - which uses power, so keep an eye on the battery.',
  oxygen: 'Switch on the oxygen maker. It splits water into oxygen to breathe. It costs a lot of power and water: switch it off if the battery runs low.',
  samples: 'Scan rocks at the yellow markers and bag them (3 fit in your bag), then stow them at the lander by riding the elevator up. Each rock type tells scientists something different.',
  instruments: 'Set up science that keeps working after you leave: a seismometer to feel moonquakes and a laser reflector that Earth can bounce lasers off to measure the distance.',
};

// The objective right now, with the step to do and where it is. ctx: { place, player:{x,z}, rover:{x,z} }
export function currentObjective(s, ctx = {}) {
  const task = TASKS.find(t => !s.tasks[t.id]);
  if (!task) return { id: 'free', key: 'free', title: 'Free exploration', step: 'All training tasks done. Explore, or finish optional quests in the log.', detail: 'Every main task is complete. Try the optional quests in the quest log, or walk out to the crater rim and look back at your base.', fact: 'moon-south-pole-light', target: null, index: TASKS.length, total: TASKS.length };
  const me = ctx.place === 'rover' ? ctx.rover : ctx.player || { x: 0, z: 0 };
  const inHab = ctx.place === 'hab' || ctx.place === 'lift';
  let step = task.hint, target = null, sub = 'go';
  const go = (p, label) => { target = { x: p.x, z: p.z, label }; };
  switch (task.id) {
    case 'stepDown':
      if (inHab) { step = 'Walk to the cabin hatch and press E / Use to ride the elevator down.'; sub = 'cabin'; }
      else { step = 'Walk away from the lander.'; go({ x: 0, z: 18 }, 'Clear of the lander'); sub = 'walk'; }
      break;
    case 'mast': {
      const free = SITES.masts.map((p, i) => ({ ...p, i })).filter(p => !s.masts[p.i]);
      const m = near(me, free); if (m) go(m, 'Solar mast site'); step = 'Walk to the mast marker and hold Use for 2 seconds.';
      break;
    }
    case 'drive':
      if (ctx.place !== 'rover') { go(ctx.rover || SITES.rover, 'Rover'); step = 'Walk to the rover and press R (or Rover) to climb in.'; sub = 'board'; }
      else { go(SITES.iceCrater, 'Shadowed crater'); step = 'Drive down into the dark crater. Use your lights.'; sub = 'drive'; }
      break;
    case 'ice':
      go(SITES.drill, 'Ice drill site'); step = ctx.place === 'rover' ? 'Park near the drill marker, get out (R) and hold Use to drill.' : 'Hold Use at the drill marker. Keep the rover within 25 m.';
      sub = ctx.place === 'rover' ? 'park' : 'drill';
      break;
    case 'deliver':
      if (s.handIce || s.roverIce) { go(SITES.processor, 'Ice processor'); step = s.roverIce ? 'Drive the ice back and stop near the processor, then press Use there.' : 'Carry the ice to the processor and press Use.'; sub = 'carry'; }
      else if (s.processorIce > 0) { go(SITES.processor, 'Ice melter'); step = 'The melter is turning ice into water. Wait, and watch the battery.'; sub = 'melt'; }
      else { go(SITES.drill, 'Ice drill site'); step = 'You need ice first: drill some in the crater.'; sub = 'fetch'; }
      break;
    case 'oxygen':
      go(SITES.processor, 'Oxygen maker');
      step = s.electrolysis ? `Oxygen maker running: ${Math.min(10, s.oxygenMade).toFixed(1)} of 10 units made.` : s.water < 1 ? 'No water to split - melt more ice first.' : 'Press Use at the processor (or in the cabin) to switch the oxygen maker on.';
      sub = s.electrolysis ? 'running' : 'switch';
      break;
    case 'samples': {
      const banked = Object.keys(s.samples).length, needed = 3 - banked;
      if (s.carried.length >= Math.max(1, needed) || s.carried.length >= 3) { go(ELEVATOR, 'Lander - stow samples'); step = 'Ride the elevator up to stow your samples.'; sub = 'stow'; }
      else {
        const left = SITES.samples.filter(x => !s.samples[x.id] && !s.carried.includes(x.id));
        const r = near(me, left); if (r) go(r, r.name); step = `Scan and bag rocks (${banked + s.carried.length}/3). Hold Use at a yellow marker.`; sub = 'collect';
      }
      break;
    }
    case 'instruments': {
      const left = ['seismometer', 'reflector'].filter(k => !s.instruments[k]).map(k => ({ ...SITES[k], k }));
      const r = near(me, left); if (r) go(r, r.k === 'seismometer' ? 'Seismometer site' : 'Laser reflector site');
      step = 'Hold Use at the white marker to set up the instrument.';
      break;
    }
  }
  return { id: task.id, key: task.id + ':' + sub, title: task.title, step, detail: DETAIL[task.id] || task.hint, fact: task.fact, target, index: TASKS.indexOf(task), total: TASKS.length };
}

// Optional quests: derived from the state, so they need no extra save data.
export function optionalQuests(s) {
  return [
    { id: 'all-masts', title: 'Raise all three solar masts', done: s.masts.every(Boolean), progress: `${s.masts.filter(Boolean).length}/3`, why: 'More masts keep the base powered through short dark spells.' },
    { id: 'all-samples', title: 'Collect all four rock types', done: Object.keys(s.samples).length >= 4, progress: `${Object.keys(s.samples).length}/4`, why: 'Each rock type tells a different part of the Moon\'s story.' },
    { id: 'oxygen-25', title: 'Make 25 units of oxygen', done: s.oxygenMade >= 25, progress: `${Math.min(25, Math.floor(s.oxygenMade))}/25`, why: 'A real outpost would need to make a lot of its own air.' },
    { id: 'science-80', title: 'Reach 80 science', done: s.science >= 80, progress: `${Math.min(80, Math.round(s.science))}/80`, why: 'Science is why we go.' },
    { id: 'no-rescue', title: 'Finish without a rescue', done: TASKS.every(t => s.tasks[t.id]) && s.rescues === 0, progress: s.rescues ? `${s.rescues} rescue${s.rescues > 1 ? 's' : ''}` : 'so far so good', why: 'Plan your oxygen and power so nobody needs help.', failed: s.rescues > 0 },
  ];
}

export function questLog(s, ctx) {
  const now = currentObjective(s, ctx);
  return {
    active: now,
    upcoming: TASKS.filter(t => !s.tasks[t.id] && t.id !== now.id),
    completed: TASKS.filter(t => s.tasks[t.id]),
    optional: optionalQuests(s),
  };
}

// Live warnings, most urgent first. level: 'critical' | 'warn' | 'info'.
export function warnings(s, ctx = {}) {
  const out = [], outside = ctx.place === 'outside';
  if (s.alert) {
    const left = Math.ceil(s.alert.start + RATES.sepWarning - s.t);
    const src = s.alert.source ? ` (${s.alert.source})` : '';   // keeps 'Practice drill' or the real DONKI event label
    out.push({ id: 'sep', level: 'critical', source: s.alert.source || '', text: (left > 0 ? `Solar particle alert: shelter in the lander within ${left} s.` : ctx.place === 'hab' ? 'Solar storm: you are sheltered in the cabin.' : 'Solar storm! Get inside the lander.') + src });
  }
  if (outside && s.suitO2 < 25) out.push({ id: 'suitO2', level: s.suitO2 < 12 ? 'critical' : 'warn', text: `Suit oxygen ${Math.round(s.suitO2)}% - head to the lander or rover.` });
  if (outside && s.suitPower < 20) out.push({ id: 'suitPower', level: s.suitPower < 10 ? 'critical' : 'warn', text: `Suit power ${Math.round(s.suitPower)}% - the cold is draining your heater.` });
  if (s.oxygen < 20) out.push({ id: 'oxygen', level: s.oxygen < 10 ? 'critical' : 'warn', text: `Base oxygen ${Math.round(s.oxygen)}% - make oxygen from water.` });
  if (s.battery < 15) out.push({ id: 'battery', level: s.battery < 5 ? 'critical' : 'warn', text: `Base battery ${Math.round(s.battery)}% - raise masts or switch the oxygen maker off.` });
  if (s.roverBattery < 15) out.push({ id: 'rover', level: 'warn', text: `Rover battery ${Math.round(s.roverBattery)}% - park it by the lander to charge.` });
  if (s.water < 10) out.push({ id: 'water', level: 'warn', text: `Water ${Math.round(s.water)}% - melt more ice.` });
  if (ctx.sunLit !== undefined && ctx.sunLit < 0.5) out.push({ id: 'dark', level: 'info', text: 'The Sun is behind far ridges: no solar power until it comes back.' });
  const rank = { critical: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// Where to draw the objective on a round minimap. Returns pixel position, whether it is clamped to the
// edge, the bearing (radians, screen space) and the distance in metres.
export function mapMarker(target, focus, { size = 160, span = 240, edge = 11 } = {}) {
  if (!target) return null;
  const k = size / span, dx = (target.x - focus.x) * k, dz = (target.z - focus.z) * k, r = Math.hypot(dx, dz), max = size / 2 - edge;
  const angle = Math.atan2(dz, dx), clamped = r > max, s = clamped ? max / r : 1;
  return { x: size / 2 + dx * s, y: size / 2 + dz * s, clamped, angle, metres: Math.hypot(target.x - focus.x, target.z - focus.z) };
}
