import { WORLD_EXTENT } from './chunk-plan.js';
// What the player has charted on the crater map: which ground is revealed (and by which instrument), the trail
// they walked and drove, their flags, hidden survey finds, Ingenuity scout flights and the real Gusev landmarks.
// The game's own state lives here; drawing the sheet itself is chart.js.
import * as THREE from 'three';
import { heightAt } from './world.js';
import { PAPER, INK } from './chart.js';
import { revealModal } from './reveal.js';

export const REVEAL = { base: 120, survey: 80, tower: 330, rover: 58, scout: 80 };   // metres each instrument uncovers
const R = s => { const t = Math.sin(s * 127.1 + 311.7) * 43758.5453; return t - Math.floor(t); };   // repeatable "random"
const WIKI = 'https://en.wikipedia.org/wiki/Timeline_of_Spirit';

// Features of the model, each tied to what NASA's Spirit rover really found in Gusev Crater.
export const LANDMARKS = [
  { id: 'lm-plain', name: 'Landing plain', x: 40, z: -60, r: 60, fact: { kid: 'Spirit landed on a flat, rock-strewn plain inside Gusev Crater on 4 January 2004. The team named the spot Columbia Memorial Station, after the seven astronauts lost on Space Shuttle Columbia.', source: 'Timeline of Spirit', url: WIKI } },
  { id: 'lm-old', name: 'Old crater', x: -146, z: -14, r: 45, fact: { kid: 'Gusev is a crater about 160 km wide that may once have held a lake. That is why NASA sent Spirit here: to look for signs of past water.', source: 'Timeline of Spirit', url: WIKI } },
  { id: 'lm-nw', name: 'Bonneville crater', x: 144, z: 21, r: 50, fact: { kid: 'Spirit\'s first big target was a crater about 200 m across, nicknamed Bonneville. It took 66 sols to reach, but there was nothing worth driving into, so Spirit rolled along the rim instead.', source: 'Timeline of Spirit', url: WIKI } },
  { id: 'lm-east', name: 'Missoula crater', x: 268, z: -30, r: 50, fact: { kid: 'Missoula crater, which Spirit reached on sol 105, is about 90 m across and 18 m deep. A crater is a natural window: it shows what lies under the dust.', source: 'Timeline of Spirit', url: WIKI } },
  { id: 'lm-boulders', name: 'Boulder field', x: -22, z: 182, r: 40, fact: { kid: 'At the landing site, gravel and cobbles cover only about 5% of the ground and big boulders are few. So a field of boulders like this one is a rare and exciting find.', source: 'Geology of the Columbia Memorial Station (AGU, 2004)', url: 'https://ui.adsabs.harvard.edu/abs/2004AGUSM.U43A..03G/abstract' } },
  { id: 'lm-husband', name: 'Husband Hill', x: 180, z: 168, r: 70, fact: { kid: 'Husband Hill is the tallest of the Columbia Hills. Spirit climbed it in 2005 and saw layered rock and wide views across Gusev. In the game it is smaller and closer than in real life.', source: 'Timeline of Spirit', url: WIKI } },
  { id: 'lm-mccool', name: 'McCool Hill', x: 120, z: 248, r: 56, fact: { kid: 'McCool Hill is one of the Columbia Hills. It is named after William McCool, a pilot lost on Space Shuttle Columbia. In the game it is smaller and closer than in real life.', source: 'NASA', url: WIKI } },
  { id: 'lm-rim', name: 'West rim', x: -337, z: -98, r: 60, fact: { kid: 'Hills like this are why Spirit set off for the Columbia Hills, about 3 km from where it landed. The drive to the top of Husband Hill took 591 days.', source: 'NBC News / NASA', url: 'https://www.nbcnews.com/id/wbna9161814' } },
  { id: 'lm-lahontan', name: 'Lahontan crater', x: 380, z: 150, r: 40, fact: { kid: 'Lahontan crater is about 55 m across and 9 m deep. Spirit drove along its rim for two sols after leaving Missoula.', source: 'Timeline of Spirit', url: WIKI } },
  { id: 'lm-tennessee', name: 'Tennessee Valley', x: 225, z: 122, r: 50, fact: { kid: 'Tennessee Valley lies on the north side of Husband Hill. Spirit looked down into its drifts and outcrops from the summit in 2005. It never drove in.', source: 'NASA Photojournal', url: 'https://science.nasa.gov/photojournal/postcard-above-tennessee-valley/' } },
  { id: 'lm-mesa', name: 'Home Plate', x: 282, z: 208, r: 60, fact: { kid: 'Spirit\'s most famous rock layers were on Home Plate, a plateau about 80 m wide. Silica-rich rock nearby points to hot water or steam once flowing here.', source: 'NASA JPL', url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/' } },
];
export const chartedLandmarks = circles => LANDMARKS.filter(l => circles.some(c => Math.hypot(c.x - l.x, c.z - l.z) < c.r + l.r * .5));

const FIND_KINDS = [
  { k: 'ice', name: 'Ice pocket', colour: '#8fe3ff', ink: '#2a7f9e' },
  { k: 'mineral', name: 'Mineral vein', colour: '#ffcf5a', ink: '#b8740e' },
  { k: 'rock', name: 'Odd rock', colour: '#c9a6ff', ink: '#7a4fb0' },
];
const FLAG_COLOURS = ['#e8742c', '#2f9fc2', '#4ca15d', '#d1498a', '#d9b43a', '#8466c9', '#b53a1e', '#4b3022'];
const DIRS = [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]];
const MAX_FLAGS = 8, WALK_R = WORLD_EXTENT * 0.42;

// every circle of charted ground, from every instrument
export function revealCircles(world, extra = []) {
  const s = world.settlement, loc = s?.layout?.locations || {}, out = [], ms = world.mapState;
  if (loc.base) out.push({ x: loc.base[0], z: loc.base[1], r: REVEAL.base });
  for (const k of s?.surveys || []) if (loc[k]) out.push({ x: loc[k][0], z: loc[k][1], r: REVEAL.survey });
  for (const i of world.lookouts?.got || []) { const sp = world.lookouts.spots[i]; if (sp) out.push({ x: sp.x, z: sp.z, r: REVEAL.tower }); }
  for (const [x, z] of ms?.driven || []) out.push({ x, z, r: REVEAL.rover });
  for (const [x, z] of ms?.scout.pts || []) out.push({ x, z, r: REVEAL.scout });
  return out.concat(extra);
}

export class MapState {
  constructor(world, { toast, modal, onFind, onLandmark }) {
    Object.assign(this, { world, toast, modal, onFind, onLandmark });
    this.layer = 'relief'; this.trail = []; this.flags = []; this.driven = []; this.scout = { left: 3, pts: [] };
    this.found = new Set(); this.seenLm = new Set(); this.flight = null; this.spin = 0; this.syncTimer = 0; this.toldRover = false;
    this.weather = () => ({});
    this.group = new THREE.Group(); world.scene.add(this.group);
    this.flagMeshes = new Map(); this.findMeshes = new Map();
    this.finds = this.makeFinds();
    for (const f of this.finds) this.addFindMesh(f);
    this.refreshFinds();
    // targets the player can use with E
    const prev = world.extraTargets;
    world.extraTargets = p => {
      const out = [...(prev?.(p) || [])];
      for (const f of this.finds) if (this.findVisible(f)) out.push({ type: 'find', id: f.id, range: 3.6, d: Math.hypot(p.x - f.x, p.z - f.z) });
      const h = world.heli;
      if (h?.seen && !this.flight) out.push({ type: 'scout', range: 4, d: Math.hypot(p.x - h.x, p.z - h.z) });
      return out;
    };
    // time passes: trail, rover charting, spinning markers, the scout flight
    const update = world.update.bind(world);
    world.update = (dt, active) => { update(dt, active); this.tick(dt); };
    world.mapState = this;
  }

  // ---------- hidden finds: two per tower, on ground you can walk to ----------
  makeFinds() {
    const spots = this.world.lookouts?.spots || [], loc = Object.values(this.world.settlement?.layout?.locations || {}), out = [];
    spots.forEach((sp, i) => {
      for (let k = 0; k < 2; k++) {
        let pick = null;
        for (let t = 0; t < 60 && !pick; t++) {
          const a = R(i * 31 + k * 7 + t * .37) * Math.PI * 2, d = 55 + R(i * 17 + k * 5 + t * .91) * 150, x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d, y = heightAt(x, z);
          const slope = Math.max(Math.abs(heightAt(x + 2, z) - y), Math.abs(heightAt(x, z + 2) - y)) / 2;
          if (Math.hypot(x, z) > 255 || slope > .5) continue;
          if (loc.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 40) || out.some(f => Math.hypot(f.x - x, f.z - z) < 40)) continue;
          pick = { x, z };
        }
        pick ||= { x: sp.x + 30 + k * 12, z: sp.z + 30 };
        out.push({ id: `f${i}${k}`, tower: i, ...pick, ...FIND_KINDS[(i + k) % 3] });
      }
    });
    return out;
  }
  findVisible(f) { return this.world.lookouts?.got.has(f.tower) && !this.found.has(f.id); }
  addFindMesh(f) {
    const g = new THREE.Group(), core = new THREE.Mesh(new THREE.OctahedronGeometry(.45), new THREE.MeshBasicMaterial({ color: f.colour }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 7, 6, 1, true), new THREE.MeshBasicMaterial({ color: f.colour, transparent: true, opacity: .28, depthWrite: false }));
    core.position.y = 1.1; beam.position.y = 3.5; g.add(core, beam); g.position.set(f.x, heightAt(f.x, f.z), f.z); g.userData.core = core;
    this.group.add(g); this.findMeshes.set(f.id, g);
  }
  refreshFinds() { for (const f of this.finds) { const m = this.findMeshes.get(f.id); if (m) m.visible = this.findVisible(f); } }
  collect(id) {
    const f = this.finds.find(x => x.id === id); if (!f || this.found.has(id)) return;
    this.found.add(id); this.refreshFinds(); this.onFind?.(f);
  }

  // ---------- flags ----------
  addFlag(name) {
    if (this.flags.length >= MAX_FLAGS) { this.toast(`You can place ${MAX_FLAGS} flags. Take one down from the map first.`); return null; }
    const w = this.world, p = w.driving ? w.sev.pos : w.player.position, used = new Set(this.flags.map(f => f.c));
    const c = FLAG_COLOURS.find(x => !used.has(x)) || FLAG_COLOURS[0], n = name || `Flag ${this.flags.length + 1}`;
    const f = { x: +p.x.toFixed(1), z: +p.z.toFixed(1), n, c }; this.flags.push(f); this.addFlagMesh(f); return f;
  }
  addFlagMesh(f) {
    const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 2.4, 6), new THREE.MeshLambertMaterial({ color: '#e8e2d6' }));
    pole.position.y = 1.2;
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.1, -.28); sh.lineTo(0, -.56); sh.closePath();
    const cloth = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ color: f.c, side: THREE.DoubleSide })); cloth.position.set(.03, 2.35, 0);
    g.add(pole, cloth); g.position.set(f.x, heightAt(f.x, f.z), f.z); this.group.add(g); this.flagMeshes.set(f, g);
  }
  removeFlag(f) { const i = this.flags.indexOf(f); if (i < 0) return; this.flags.splice(i, 1); const m = this.flagMeshes.get(f); if (m) { this.group.remove(m); this.flagMeshes.delete(f); } }

  // ---------- Ingenuity scout flights ----------
  openScout() {
    if (this.flight) return;
    const left = this.scout.left;
    if (!left) return this.modal({ title: 'Ingenuity', html: '<p>Ingenuity has used all three scout flights. Its battery and rotors have done their job, just like the real helicopter, which flew 72 times and far beyond its plan of five.</p>', choices: [{ label: 'OK', primary: true }] });
    this.modal({
      title: 'Ingenuity scout flight',
      html: `<p>Send Ingenuity out and back to chart a strip of ground, about 170 m each way. <b>${left} of 3 flights left.</b> Pick a heading.</p>`,
      choices: [...DIRS.map(([name], i) => ({ label: `Fly ${name}`, onPick: () => this.fly(i) })), { label: 'Not now' }],
    });
  }
  fly(i) {
    const [name, dx, dz] = DIRS[i], h = this.world.heli, m = h.model; if (!m) return;
    let D = 0; while (D < 170 && Math.abs(h.x + dx * (D + 5)) < 300 && Math.abs(h.z + dz * (D + 5)) < 300) D += 5;
    this.scout.left--; this.flight = { t: 0, dur: 11, dx, dz, D, rest: m.position.clone(), restRot: m.rotation.y, name, before: revealCircles(this.world), n0: this.scout.pts.length };
    this.toast(`Ingenuity is lifting off and scouting ${name}...`);
  }
  tickFlight(dt) {
    const f = this.flight, m = this.world.heli.model; f.t += dt;
    const u = Math.min(1, f.t / f.dur), s = Math.sin(Math.PI * u) ** 1.2, x = f.rest.x + f.dx * f.D * s, z = f.rest.z + f.dz * f.D * s;
    m.position.set(x, f.rest.y + (heightAt(x, z) - heightAt(f.rest.x, f.rest.z)) + 13 * Math.sin(Math.PI * u) ** .8, z);
    m.rotation.set(.06 * Math.sin(f.t * 2.1), f.restRot, .1 * Math.sin(f.t * 3));
    if (!this.scout.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 22)) this.scout.pts.push([+x.toFixed(1), +z.toFixed(1)]);
    if (u >= 1) {
      m.position.copy(f.rest); m.rotation.set(0, f.restRot, 0); this.flight = null;
      this.scoutDone(f);
    }
  }
  scoutDone(f) {
    const add = this.scout.pts.slice(f.n0).map(([x, z]) => ({ x, z, r: REVEAL.scout })), fresh = this.sync(true), left = this.scout.left;
    revealModal({
      modal: this.modal, title: `Ingenuity scout flight: ${f.name}`, base: f.before, add, layer: this.layer, overlay: (c, P) => this.draw(c, P), notes: [0, 4, 7, 11],
      intro: 'Ingenuity is back on its pad. Developing the pictures...',
      done: pct => `Ingenuity charted a strip of ground to the ${f.name}. The sheet is <b>${Math.round(pct * 100)}%</b> charted. ${left ? `${left} flight${left === 1 ? '' : 's'} left.` : 'That was its last flight.'}` + fresh.map(l => `<p class="fact"><b>${l.name}.</b> ${l.fact.kid}</p>`).join(''),
    });
  }

  // ---------- each frame ----------
  tick(dt) {
    const w = this.world, drv = w.driving, p = drv ? w.sev.pos : w.player.position, last = this.trail.at(-1);
    this.spin += dt;
    for (const m of this.findMeshes.values()) if (m.visible) { m.userData.core.rotation.y = this.spin * 1.4; m.userData.core.position.y = 1.1 + Math.sin(this.spin * 2) * .12; }
    if (!last || Math.hypot(p.x - last[0], p.z - last[1]) > 5) {
      this.trail.push([+p.x.toFixed(1), +p.z.toFixed(1), drv ? 1 : 0]);
      if (this.trail.length > 900) this.trail = [...this.trail.slice(0, 600).filter((_, i) => i % 2 === 0), ...this.trail.slice(600)];
    }
    if (drv) {
      const ld = this.driven.at(-1);
      if (this.driven.length < 240 && (!ld || Math.hypot(p.x - ld[0], p.z - ld[1]) > 35)) {
        this.driven.push([+p.x.toFixed(1), +p.z.toFixed(1)]);
        if (!this.toldRover && Math.hypot(p.x, p.z - 12) > 150) { this.toldRover = true; this.toast('The rover cameras are charting the ground you drive over.'); }
      }
    }
    if (this.flight) this.tickFlight(dt);
    if ((this.syncTimer += dt) > 1.2) { this.syncTimer = 0; this.sync(); }
  }

  // log any landmark that has just been charted
  sync(quiet = false) {
    const fresh = chartedLandmarks(revealCircles(this.world)).filter(l => !this.seenLm.has(l.id));
    fresh.forEach(l => { this.seenLm.add(l.id); this.onLandmark?.(l, quiet); });
    return fresh;
  }

  // ---------- saving ----------
  save() {
    return { layer: this.layer, trail: this.trail, flags: this.flags.map(f => [f.x, f.z, f.n, f.c]), driven: this.driven, scout: this.scout, found: [...this.found], lm: [...this.seenLm], reg: [...(this.world.mist?.done || [])], sites: this.world.sites?.save() };
  }
  load(d) {
    if (!d) return;
    this.layer = d.layer || 'relief'; this.trail = d.trail || []; this.driven = d.driven || []; this.scout = { left: d.scout?.left ?? 3, pts: d.scout?.pts || [] };
    this.found = new Set(d.found || []); this.seenLm = new Set(d.lm || []); if (this.world.mist) this.world.mist.done = new Set(d.reg || []);
    for (const f of [...this.flags]) this.removeFlag(f);
    for (const [x, z, n, c] of d.flags || []) { const f = { x, z, n, c }; this.flags.push(f); this.addFlagMesh(f); }
    this.world.sites?.load(d.sites);
    this.refreshFinds();
  }

  // ---------- drawing the game's own marks on top of a chart ----------
  // o: { trail, labels, dust }; P: projector from chart.js
  draw(ctx, P, o = {}) {
    const { toPx, mpp, rect } = P, w = this.world, lo = w.lookouts, st = w.settlement, loc = st?.layout?.locations || {}, names = st?.layout?.names || {}, mini = !!o.mini;
    const placed = [];
    const text = (s, x, y, { size = 9.5, bold = false, col = INK, dx = 8, dy = -6 } = {}) => {
      ctx.font = `${bold ? 'bold ' : 'italic '}${size}px Georgia, serif`; const tw = ctx.measureText(s).width;
      for (const [ox, oy] of [[dx, dy], [dx, dy + 17], [-dx - tw, dy], [-dx - tw, dy + 17], [-tw / 2, dy - 9], [-tw / 2, dy + 22]]) {
        const bx = x + ox, by = y + oy;
        if (bx < rect.x + 2 || bx + tw > rect.x + rect.w - 2 || by < rect.y + 8 || by > rect.y + rect.h - 4) continue;
        if (placed.some(r => bx < r[0] + r[2] && bx + tw > r[0] && by - size < r[1] && by > r[1] - r[3])) continue;
        placed.push([bx, by, tw, size]); ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.2; ctx.strokeStyle = PAPER; ctx.strokeText(s, bx, by); ctx.fillStyle = col; ctx.fillText(s, bx, by); return;
      }
    };
    // the ground you can walk on ends here (the game keeps you inside a circle about 269 m across from the outpost)
    if (!mini) { const [ox, oy] = toPx(0, 0); ctx.save(); ctx.strokeStyle = 'rgba(75,48,34,.55)'; ctx.lineWidth = 1.1; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(ox, oy, WALK_R * mpp, 0, 7); ctx.stroke(); ctx.restore(); }
    // weather
    const wx = this.weather();
    if (wx.dust && !mini) {
      ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      if (wx.dust === 'now') {
        ctx.fillStyle = 'rgba(196,140,76,.32)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = 'rgba(120,76,36,.13)'; ctx.lineWidth = 3.5;
        for (let i = 0; i < 9; i++) { ctx.beginPath(); const y0 = rect.y + 18 + i * rect.h / 8.5; ctx.moveTo(rect.x - 10, y0); ctx.bezierCurveTo(rect.x + rect.w * .3, y0 - 26, rect.x + rect.w * .6, y0 + 30, rect.x + rect.w + 10, y0 - 8); ctx.stroke(); }
      } else {
        const g = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w * .42, 0); g.addColorStop(0, 'rgba(196,140,76,.5)'); g.addColorStop(1, 'rgba(196,140,76,0)'); ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w * .42, rect.h);
        ctx.strokeStyle = 'rgba(120,76,36,.2)'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { ctx.beginPath(); const y0 = rect.y + 30 + i * rect.h / 6; ctx.moveTo(rect.x, y0); ctx.bezierCurveTo(rect.x + 40, y0 - 14, rect.x + 70, y0 + 14, rect.x + rect.w * .3, y0 - 4); ctx.stroke(); }
      }
      ctx.restore();
      ctx.font = 'bold 9.5px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3.4; ctx.strokeStyle = PAPER; ctx.fillStyle = '#7b3d12';
      const msg = wx.dust === 'now' ? 'DUST STORM: sunlight is blocked' : `DUST FRONT: reaches the outpost in ${wx.sols} sol${wx.sols === 1 ? '' : 's'}`;
      ctx.strokeText(msg, rect.x + rect.w / 2, rect.y + 14); ctx.fillText(msg, rect.x + rect.w / 2, rect.y + 14);
    }
    // trail: dotted where you walked, solid where you drove; Ingenuity's flight paths dashed
    if (o.trail !== false) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const run = pts => { ctx.beginPath(); let prev = null; for (const q of pts) { const [x, y] = toPx(q[0], q[1]); if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 30) ctx.moveTo(x, y); else if (prev) ctx.lineTo(x, y); else ctx.moveTo(x, y); prev = q; } ctx.stroke(); };
      ctx.strokeStyle = 'rgba(95,35,18,.95)'; ctx.lineWidth = mini ? 1.4 : 2.1; ctx.setLineDash([2.2, 4]); run(this.trail.filter(t => !t[2]));
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(150,50,25,.9)'; ctx.lineWidth = mini ? 1.4 : 2.2; run(this.trail.filter(t => t[2]));
      ctx.restore();
    }
    // landmarks (charted only)
    const circles = revealCircles(w), lmOn = new Set(chartedLandmarks(circles).map(l => l.id));
    if (!mini && o.labels !== false) for (const l of LANDMARKS) if (lmOn.has(l.id)) {
      const [x, y] = toPx(l.x, l.z); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(x, y, Math.max(10, l.r * mpp * .6), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      text(l.name.toUpperCase(), x, y, { size: 8, bold: true, col: '#6a3a22', dx: -4, dy: 3 });
    }
    // real Gusev stops (shown on charted ground, or once visited)
    for (const s of w.sites?.list || []) {
      const seen = w.sites.visited.has(s.id); if (!seen && !circles.some(c => Math.hypot(c.x - s.x, c.z - s.z) < c.r)) continue;
      const [x, y] = toPx(s.x, s.z), r = mini ? 2.6 : 4;
      ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath();
      ctx.fillStyle = seen ? '#3f9b62' : '#f5e6c4'; ctx.fill(); ctx.strokeStyle = seen ? INK : '#7b3d12'; ctx.lineWidth = 1.3; ctx.stroke();
      if (!mini) text(s.name, x, y, { size: 8, col: seen ? '#2f6b45' : '#7b3d12', dx: 7, dy: 3 });
    }
    // survey sites
    for (const [k, [sx, sz]] of Object.entries(loc)) {
      const [x, y] = toPx(sx, sz), on = st.surveys.has(k);
      ctx.fillStyle = k === 'base' ? '#f5efe0' : on ? '#3f7a4a' : '#d39a46'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, mini ? 3 : k === 'base' ? 5.2 : 4.2, 0, 7); ctx.fill(); ctx.stroke();
      if (!mini) text(names[k] || k, x, y, { bold: k === 'base' });
    }
    // towers
    (lo?.spots || []).forEach((s, i) => {
      const [x, y] = toPx(s.x, s.z), on = lo.got.has(i), k = mini ? .7 : 1;
      ctx.beginPath(); ctx.moveTo(x, y - 8 * k); ctx.lineTo(x + 6.5 * k, y + 5 * k); ctx.lineTo(x - 6.5 * k, y + 5 * k); ctx.closePath();
      ctx.fillStyle = on ? '#3f9b62' : '#fff0d0'; ctx.fill(); ctx.strokeStyle = on ? INK : '#c2661a'; ctx.lineWidth = 1.6; ctx.stroke();
      if (!mini) text(s.name, x, y, { size: 8.5, dy: 12 });
    });
    // survey finds (visible once their tower has been scanned)
    for (const f of this.finds) if (lo?.got.has(f.tower)) {
      const [x, y] = toPx(f.x, f.z), got = this.found.has(f.id), r = mini ? 3.4 : 5;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
      ctx.globalAlpha = got ? .45 : 1; ctx.fillStyle = got ? '#bcb5a3' : f.colour; ctx.fill(); ctx.strokeStyle = got ? '#7a7466' : f.ink; ctx.lineWidth = 1.3; ctx.stroke(); ctx.globalAlpha = 1;
      if (!mini && !got) text(f.name, x, y, { size: 8.5, col: f.ink, dx: 7, dy: 3 });
    }
    // flags
    for (const f of this.flags) {
      const [x, y] = toPx(f.x, f.z); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 13); ctx.stroke();
      ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 9, y - 10); ctx.lineTo(x, y - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!mini) text(f.n, x, y, { size: 9, dx: 7, dy: -8 });
    }
    // you
    const p = w.driving ? w.sev.pos : w.player.position, [px, py] = toPx(p.x, p.z);
    ctx.fillStyle = '#2a7fb0'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(px, py, mini ? 4 : 5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(42,127,176,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py, mini ? 8 : 10, 0, 7); ctx.stroke();
    if (!mini) text('You', px, py, { bold: true, col: '#1b5c82', dx: 9, dy: 14 });
    // Ingenuity while it is flying
    if (this.flight) { const m = w.heli.model.position, [hx, hy] = toPx(m.x, m.z); ctx.fillStyle = '#1b5c82'; ctx.fillRect(hx - 3, hy - 3, 6, 6); text('Ingenuity', hx, hy, { size: 8.5, col: '#1b5c82' }); }
  }
}
