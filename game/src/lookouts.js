// Lookout towers. Four survey towers stand on high ground around the outpost. Using one scans the land around it:
// the chart then shows the real Gusev terrain beyond the area you can walk on, and reveals the survey finds
// hidden nearby. Land nobody has scanned stays blank paper.
import * as THREE from 'three';
import { LANDMARKS } from './landmarks.js';
import { heightAt, groundHeight } from './world.js';
import { MAT, tube, solarPanel, makeCellMat, dishAssembly } from './models.js';
import { revealCircles, REVEAL } from './mapstate.js';
import { revealModal } from './reveal.js';
import { playScanCinematic } from './scancine.js';

export const REVEAL_R = REVEAL.tower;
const NAMES = ['North ridge', 'East rim', 'South ridge', 'West rim'];

// Pick the highest, gentlest ground in each direction, 130-250 m from the outpost (the walkable area ends at about 269 m).
export function findLookouts(avoid = []) {
  return [-90, 22, 90, 180].map((centre, i) => {
    let best = null;
    for (let r = 130; r <= 252; r += 6) for (let a = centre - 35; a <= centre + 35; a += 7) {
      const x = Math.cos(a * Math.PI / 180) * r, z = Math.sin(a * Math.PI / 180) * r, y = heightAt(x, z);
      const slope = Math.max(Math.abs(heightAt(x + 3, z) - y), Math.abs(heightAt(x - 3, z) - y), Math.abs(heightAt(x, z + 3) - y), Math.abs(heightAt(x, z - 3) - y)) / 3;
      if (slope > .6 || avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < 45)) continue;
      if (!best || y > best.y) best = { x, z, y };
    }
    best ||= { x: Math.cos(centre * Math.PI / 180) * 180, z: Math.sin(centre * Math.PI / 180) * 180, y: 0 };
    const onHill = LANDMARKS.find(m => m.kind === 'hill' && Math.hypot(best.x - m.x, best.z - m.z) < m.r * .7);
    return { ...best, name: onHill ? onHill.name : NAMES[i] };
  });
}

export class Lookouts {
  constructor(world, { onFirst, modal }) {
    this.world = world; this.onFirst = onFirst; this.modal = modal; this.got = new Set();
    const loc = world.settlement?.layout?.locations || {};
    this.spots = findLookouts(Object.values(loc));
    this.group = new THREE.Group(); this.beacons = [];
    this.dishes = []; const cellMat = makeCellMat(); this.cellMat = cellMat; world.colliders ||= [];
    this.spots.forEach(sp => {
      // A survey mast in the style of a deep-space station: a braced lattice on concrete footings, a ladder and railed
      // platform, a steerable dish on a yoke, a solar panel on its own frame and an equipment cabinet.
      const t = new THREE.Group(), H = 10, w0 = 1.5, w1 = .62, cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      const gh = cs.map(([dx, dz]) => groundHeight(sp.x + dx * w0, sp.z + dz * w0)), base = Math.max(...gh);
      const wAt = y => w0 + (w1 - w0) * y / H, corners = y => cs.map(([dx, dz]) => [dx * wAt(y), y, dz * wAt(y)]);
      const levels = [0, 2.5, 5, 7.5, H];
      cs.forEach(([dx, dz], c) => {                       // concrete footing reaches down to the ground at each corner
        const down = base - gh[c] + .5, f = new THREE.Mesh(new THREE.BoxGeometry(.8, down + .35, .8), MAT.concrete); f.position.set(dx * w0, -down / 2 + .17, dz * w0); t.add(f);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .5), MAT.steel); plate.position.set(dx * w0, .38, dz * w0); t.add(plate);
        t.add(tube(corners(.4)[c], corners(H)[c], .085, c % 2 ? MAT.white : MAT.orange, 7));
      });
      for (let l = 0; l < levels.length; l++) {
        const ring = corners(levels[l]);
        for (let c = 0; c < 4; c++) t.add(tube(ring[c], ring[(c + 1) % 4], .04, MAT.white, 5));
        if (l) { const lo = corners(levels[l - 1]); for (let c = 0; c < 4; c++) { const n = (c + 1) % 4; t.add(tube(lo[c], ring[n], .028, MAT.dark, 4), tube(lo[n], ring[c], .028, MAT.dark, 4)); } }
      }
      // ladder up the south face with a safety hoop near the top
      const lz = wAt(0) * 1 + .12; for (const x of [-.22, .22]) t.add(tube([x, .4, lz], [x, H - .2, wAt(H) + .12], .02, MAT.steel, 4));
      for (let y = .8; y < H - .3; y += .42) t.add(tube([-.22, y, wAt(y) + .125], [.22, y, wAt(y) + .125], .015, MAT.steel, 4));
      // platform deck, railing and kick plate
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, .12, 12), MAT.dark); deck.position.y = H + .05; t.add(deck);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; t.add(tube([Math.cos(a) * 1.2, H + .1, Math.sin(a) * 1.2], [Math.cos(a) * 1.2, H + 1, Math.sin(a) * 1.2], .022, MAT.white, 4)); }
      for (const hh of [.55, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, .02, 5, 36), MAT.white); r.rotation.x = Math.PI / 2; r.position.y = H + .1 + hh; t.add(r); }
      // the dish, on a short pedestal in the middle of the deck
      const d = dishAssembly(1.8); d.group.position.y = H + .11; t.add(d.group);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, .8), MAT.white); cab.position.set(-2.5, .62, .2); t.add(cab);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.12, .16, .82), MAT.orange); stripe.position.set(-2.5, .95, .2); t.add(stripe);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .03), MAT.steel); door.position.set(-2.5, .55, .62); t.add(door);
      const vent = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .03), MAT.dark); vent.position.set(-2.5, 1.05, .62); t.add(vent);
      t.add(tube([-1.95, .2, .2], [-w0 - .05, .2, .2], .03, MAT.rubber, 5));       // cable from the cabinet to the mast foot
      const pv = solarPanel(cellMat, { w: 1.9, d: 1.2, tilt: .5, low: .45 }); pv.position.set(2.9, 0, .2); t.add(pv);
      t.add(tube([2.9, .1, -.3], [w0 + .2, .15, -.3], .03, MAT.rubber, 5));
      // status light on its own mast
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' })); beacon.position.set(1.05, H + 1.35, 0);
      t.add(tube([1.05, H + .1, 0], [1.05, H + 1.2, 0], .02, MAT.steel, 4)); t.add(beacon);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(.8, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .2, depthWrite: false })); halo.position.copy(beacon.position); t.add(halo); beacon.userData.halo = halo;
      t.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
      this.beacons.push(beacon); this.dishes.push({ az: d.az, el: d.el, ph: Math.random() * 6 });
      t.position.set(sp.x, base, sp.z); this.group.add(t);
      world.colliders.push({ x: sp.x, z: sp.z, r: 1.9 }, { x: sp.x - 2.5, z: sp.z + .2, r: .8 });
    });
    world.scene.add(this.group);
    const prev = world.extraTargets;
    world.extraTargets = p => [...(prev?.(p) || []), ...this.spots.map((sp, i) => ({ type: 'lookout', i, range: 4.2, d: Math.hypot(p.x - sp.x, p.z - sp.z) }))];
    world.lookouts = this;
    // The dishes slowly sweep the sky; scanned towers turn faster.
    const upd = world.update; let clock = 0;
    world.update = (dt, ...rest) => { clock += dt; this.dishes.forEach((d, i) => { const on = this.got.has(i); d.az.rotation.y += dt * (on ? .55 : .12); d.el.rotation.x = .32 + Math.sin(clock * .5 + d.ph) * (on ? .2 : .08); }); return upd.call(world, dt, ...rest); };
  }
  refresh() { this.beacons.forEach((b, i) => { const c = this.got.has(i) ? '#7dffb2' : '#ffb347'; b.material.color.set(c); b.userData.halo?.material.color.set(c); }); this.world.mapState?.refreshFinds(); }

  // Use a tower: scan the land and watch the chart fill in.
  use(i) {
    const sp = this.spots[i], first = !this.got.has(i), ms = this.world.mapState;
    const mine = c => c.x === sp.x && c.z === sp.z && c.r === REVEAL.tower;
    const before = first ? revealCircles(this.world) : revealCircles(this.world).filter(c => !mine(c));
    if (first) { this.got.add(i); this.refresh(); this.onFirst?.(sp, i, this.got.size); }
    const fresh = first ? (ms?.sync(true) || []) : [], done = this.got.size, mine2 = ms ? ms.finds.filter(f => f.tower === i).length : 0;
    const open = () => revealModal({
      S: 460, extra: [{ label: 'Open the full map', onPick: () => document.getElementById('map-btn')?.click() }],
      modal: this.modal, title: `Lookout tower: ${sp.name}`, base: before, add: [{ x: sp.x, z: sp.z, r: REVEAL.tower }], layer: ms?.layer,
      overlay: (c, P) => ms?.draw(c, P),
      done: pct => (first
        ? `New ground charted: <b>${Math.round(pct * 100)}%</b> of the sheet now. <b>${done} of ${this.spots.length}</b> towers scanned. +4 science.${mine2 ? ` The scan picked out <b>${mine2} survey finds</b> nearby (the diamonds): walk to one and press E.` : ''}`
        : 'This tower has already been scanned.') + fresh.map(l => `<p class="fact"><b>${l.name}.</b> ${l.fact.kid}</p>`).join(''),
    });
    if (!first) return open();
    // First scan: a cutscene from space, then the chart opens and the new ground is revealed. The game stays paused behind it.
    const hold = this.modal({ title: '', html: '', choices: [{ label: '' }] }), box = document.getElementById('modal'); box?.classList.add('cine-hide');
    playScanCinematic({ x: sp.x, z: sp.z, name: sp.name }).catch(() => {}).finally(() => { hold(); box?.classList.remove('cine-hide'); open(); });
  }
}
