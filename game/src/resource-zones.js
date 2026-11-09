// Where each mineral can be found. Each zone sits where NASA's Spirit rover found that kind of material in Gusev
// Crater (the map squeezes the real distances, see the credits). A small starter cache near the base gets a new
// outpost going; the rest are worth a trip. Amounts, yields and the soft-soil slowdown are game balance.
//   hematite (with goethite): water-soaked rocks at West Spur, the foot of the Columbia Hills (Clovis rock, 2004)
//   sulfate salt (save key 'gypsum'): bright salty soil at Paso Robles, Arad and Tyrone (2005-2006). Soft: rovers slip
//   silica: next to Home Plate, where Spirit dug up soil about 90 percent silica (Gertrude Weise, 2007)
//   carbonate: the Comanche outcrop on Husband Hill's south-east side (2005, confirmed 2010). Rare
//   meteorite iron: smooth plains, where iron meteorites stand out (Spirit found two in 2006)
import { SITES } from './site-data.js';

export const ZONES = [
  { id: 'westspur', name: 'West Spur', ore: 'hematite', x: 106, z: 150, r: 24, n: 8, tip: 'Hill rocks with hematite and goethite: water once soaked them.' },
  { id: 'pasorobles', name: 'Paso Robles', ore: 'gypsum', x: 142, z: 128, r: 13, n: 3, soft: true, tip: 'Bright salty soil. Rich in water, but soft: rovers slip here.' },
  { id: 'arad', name: 'Arad', ore: 'gypsum', x: 192, z: 238, r: 12, n: 3, soft: true, tip: 'More bright salty soil, on the basin floor south of Husband Hill.' },
  { id: 'tyrone', name: 'Tyrone', ore: 'gypsum', x: 304, z: 266, r: 12, n: 3, soft: true, tip: 'Salty soil near Home Plate. Soft ground.' },
  { id: 'silica', name: 'Silica Valley', ore: 'silica', x: 312, z: 246, r: 20, n: 5, tip: 'Pale silica, the stuff glass is made from.' },
  { id: 'comanche', name: 'Comanche', ore: 'carbonate', x: 232, z: 205, r: 8, n: 2, tip: 'Rare carbonate rock. Worth a lot of science.' },
  { id: 'meteorites', name: 'Allan Hills meteorites', ore: 'iron', x: -235, z: 40, r: 38, n: 5, tip: 'Iron meteorites stand out on this smooth plain.' },
];
// The first rocks near camp, at the same spots as before (so early quests stay short).
export const STARTER = [
  ['hematite', 45, 5], ['hematite', 50, -3], ['hematite', 56, 2],
  ['gypsum', -49, -8], ['gypsum', -60, -11], ['gypsum', -47, -13],
  ['iron', 47, 22], ['iron', 54, 21],
];
export const ID_BASE = 1000;     // new ids, so mined rocks in old saves do not hide the new ones

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 0 on firm ground, up to 1 in the middle of a patch of soft salty soil
export function softSoil(x, z) {
  let s = 0;
  for (const zn of ZONES) if (zn.soft) { const d = Math.hypot(x - zn.x, z - zn.z); if (d < zn.r * 1.2) s = Math.max(s, 1 - smooth(zn.r * .5, zn.r * 1.2, d)); }
  return s;
}
export const zoneAt = (x, z) => ZONES.find(zn => Math.hypot(x - zn.x, z - zn.z) < zn.r);
// Bright soil under the dust, shown by rover tracks (ground-marks.js): the salt and silica zones, plus one patch on no map.
// When Spirit got stuck at Troy in 2009, its spinning wheels dug up layers of sulfate soil.
export const HIDDEN = [{ id: 'troy-salt', name: 'Troy', ore: 'gypsum', x: 215, z: 262, r: 9, hidden: true }];
export const brightZone = (x, z) => { const z0 = zoneAt(x, z); return z0 && (z0.ore === 'gypsum' || z0.ore === 'silica') ? z0 : HIDDEN.find(h => Math.hypot(x - h.x, z - h.z) < h.r) || null; };

// Every mineral rock: { id, ore, x, z, zone }. ground(x, z) gives the height; blocked(x, z) is true for spots taken by
// buildings. Same result for every player.
export function placeDeposits(ground, blocked = () => false) {
  let seed = 4242; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = STARTER.map(([ore, x, z], i) => ({ id: ID_BASE + i, ore, x, z, zone: 'starter' }));
  const nearStop = (x, z) => SITES.some(s => Math.hypot(x - s.x, z - s.z) < 9);
  for (const zn of ZONES) {
    for (let k = 0; k < zn.n; k++) {
      let x = zn.x, z = zn.z, ok = false;
      for (let t = 0; t < 80 && !ok; t++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * zn.r;
        x = zn.x + Math.cos(a) * d; z = zn.z + Math.sin(a) * d;
        const slope = Math.hypot(ground(x + 1, z) - ground(x - 1, z), ground(x, z + 1) - ground(x, z - 1)) / 2;
        ok = slope < .45 && !nearStop(x, z) && !blocked(x, z) && !out.some(o => Math.hypot(o.x - x, o.z - z) < 3.2);
      }
      if (ok) out.push({ id: ID_BASE + out.length, ore: zn.ore, x, z, zone: zn.id });
    }
  }
  return out;
}

// Says where you are when you walk or drive into a zone, and warns once when the rover hits soft salty soil.
export class ZoneWatch {
  constructor(world, toast) {
    this.world = world; this.toast = toast; this.told = new Set(); this.t = 0; this.toldSoft = false;
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(dt); };
  }
  tick(dt) {
    if ((this.t -= dt) > 0) return; this.t = .5;
    const p = this.world.player?.position; if (!p) return;
    const zn = zoneAt(p.x, p.z);
    if (zn && !this.told.has(zn.id)) { this.told.add(zn.id); this.toast(`${zn.name}: ${zn.tip}`, 5000); }
    if (!this.toldSoft && this.world.driving && this.world.sev?.softSoil > .4) { this.toldSoft = true; this.toast('Soft salty soil: the rover slows right down. Rover wheels slip in soil like this.', 5000); }
  }
}
