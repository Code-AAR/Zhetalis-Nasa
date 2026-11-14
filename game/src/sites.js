// Real stops from Spirit's trip across Gusev Crater, laid out as places to visit: walk (or drive) to each one,
// press E, and read what NASA found there. Also moving dust devils on the plain. Facts live in site-data.js and the
// models in stop-models.js (open stop-viewer.html to look at them one by one).
import * as THREE from 'three';
import { heightAt } from './world.js';
import { SITES } from './site-data.js';
import { buildStop, buildDustDevilTracks } from './stop-models.js';

const M = { pole: new THREE.MeshStandardMaterial({ color: '#cfc8b8', roughness: .6 }), flagOff: new THREE.MeshStandardMaterial({ color: '#d8742a', roughness: .8, side: THREE.DoubleSide }), flagOn: new THREE.MeshStandardMaterial({ color: '#3f9b62', roughness: .8, side: THREE.DoubleSide }) };
const DETAIL_RANGE = 230;            // past this, only the flag, the label and Home Plate's rim are drawn

// A small sign over each stop: the name, and whether you have been there yet.
function labelSprite(text, done) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 128;
  const g = c.getContext('2d'), r = 22;
  g.fillStyle = done ? 'rgba(24,52,36,.9)' : 'rgba(18,20,24,.88)';
  g.beginPath(); g.roundRect(6, 10, 628, 108, r); g.fill();
  g.fillStyle = done ? '#5fc58a' : '#e59a4c'; g.beginPath(); g.roundRect(6, 10, 12, 108, [r, 0, 0, r]); g.fill();
  g.fillStyle = '#f1efe8'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(text.length > 30 ? text.slice(0, 29) + '...' : text, 326, 58);
  g.font = '24px system-ui, sans-serif'; g.fillStyle = done ? '#9fdcb0' : '#f0c27a'; g.fillText(done ? 'Visited' : 'Press E to look', 326, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  sp.scale.set(6.4, 1.28, 1); return sp;
}

export class Sites {
  constructor(world, { toast, modal, onVisit, onDevil, onDevilClean, onApproach }) {
    Object.assign(this, { world, toast, modal, onVisit, onDevil, onDevilClean, onApproach });
    this.list = SITES; this.visited = new Set(); this.approached = new Set(); this.meshes = new Map();
    this.group = new THREE.Group(); this.group.name = 'Gusev stops'; world.scene.add(this.group);
    for (const s of SITES) this.place(s);
    const prev = world.extraTargets;
    world.extraTargets = p => [...(prev?.(p) || []), ...SITES.map(s => ({ type: 'site', id: s.id, label: s.verb, range: s.kind === 'silica' ? 5 : 4.5, d: Math.hypot(p.x - s.x, p.z - s.z) }))];
    this.devils = new DustDevils(world, this);
    this.lodClock = 0; this.nearClock = 0;
    const upd = world.update.bind(world); world.update = (dt, a) => { upd(dt, a); this.devils.tick(dt); this.lod(dt); this.near(dt); };
    world.sites = this;
  }
  // Like Viewpoints/ZoneWatch: fires once per stop just from walking or driving close, well before you are
  // near enough to press E. A wider radius than the E-prompt range, so the card arrives first.
  near(dt) {
    if ((this.nearClock -= dt) > 0) return; this.nearClock = .3;
    const p = this.world.driving ? this.world.sev?.pos : this.world.player?.position; if (!p) return;
    for (const s of SITES) {
      if (this.approached.has(s.id)) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 16) { this.approached.add(s.id); this.onApproach?.(s); }
    }
  }
  place(s) {
    const root = new THREE.Group(); root.name = s.name;
    const detail = buildStop(s, heightAt); root.add(detail);
    // a tall pole with a pennant, so the stop can be seen from far away; it turns green once you have been there
    const y = heightAt(s.x, s.z), pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 6, 6), M.pole); pole.position.set(s.x - 1.6, y + 3, s.z - 1.2); root.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .8), M.flagOff); flag.position.set(s.x - .85, y + 5.5, s.z - 1.2); root.add(flag);
    const label = labelSprite(s.name, false); label.position.set(s.x, y + 7.2, s.z); root.add(label);
    this.group.add(root); this.meshes.set(s.id, { flag, label, root, detail });
  }
  // Far away, drop the small pieces (rocks, scraps, tracks, the rover) to save draw calls. Home Plate's rim stays.
  lod(dt) {
    if ((this.lodClock -= dt) > 0) return; this.lodClock = .4;
    const cam = this.world.camera?.position; if (!cam) return;
    for (const [id, m] of this.meshes) {
      const s = SITES.find(x => x.id === id), far = Math.hypot(cam.x - s.x, cam.z - s.z) > (s.kind === 'plateau' ? DETAIL_RANGE * .7 : DETAIL_RANGE);
      for (const o of m.detail.children) o.visible = !far || o.name === 'cliff';
    }
  }
  paint(id) {
    const m = this.meshes.get(id), s = SITES.find(x => x.id === id); if (!m || !s) return;
    const done = this.visited.has(id); m.flag.material = done ? M.flagOn : M.flagOff;
    const old = m.label; m.label = labelSprite(s.name, done); m.label.position.copy(old.position); m.root.remove(old); old.material.map.dispose(); old.material.dispose(); m.root.add(m.label);
  }
  use(id) {
    const s = SITES.find(x => x.id === id); if (!s) return;
    const first = !this.visited.has(id); this.visited.add(id); if (first) this.paint(id);
    const n = this.visited.size, total = SITES.length;
    this.modal({ title: s.name, html: `<p>${s.kid}</p><div class="fact"><div class="source">Source: <a href="${s.url}" target="_blank" rel="noopener">${s.source}</a></div></div><p class="pos">${first ? `+${s.points} science. ` : ''}Stops visited: ${n} of ${total}. In the game this stop is much closer than in real life.</p>`, pause: false });
    if (first) this.onVisit?.(s, n, total);
  }
  save() { return [...this.visited]; }
  load(d) { this.visited = new Set((d || []).map(id => id === 'tyrone' ? 'gertrude' : id).filter(id => SITES.some(s => s.id === id))); for (const s of SITES) this.paint(s.id); }
}

// Dust devils: swirling columns of dust that wander over the plain, built from what Spirit saw in Gusev Crater.
// Real ones range from a few metres to hundreds of metres across and drift at about 1-5 m/s (Greeley et al. 2006,
// Spirit). They form when sunlight heats the ground, so only from late morning to late afternoon and never in a
// dust storm. Mars air is about 1.3% as dense as Earth's (NASA Mars Fact Sheet), so even their fast winds push on an
// astronaut with only a few newtons: here they cannot move you. Walking into one fills your visor with dust for a
// moment (world.devilVeil), you lean slightly into the gust, and one crossing your solar panels blows dust off them,
// as dust devils did for Spirit and Opportunity.
const DEVIL_SIZES = [1.0, 2.2, .7, 1.5, 1.2];   // relative width: small, large, tiny, medium...
class DustDevils {
  constructor(world, sites) {
    this.world = world; this.sites = sites; this.t = 0; this.told = false; this.checkT = 0;
    // dust devils wander around these spots; two of them work the dust devil plain to the north, with its dark tracks.
    // The last one roams the flat ground east of the base, so now and then one crosses the solar panels.
    this.anchors = [[-120, 150, 0.2], [0, -195, 2.1], [250, 40, 4.0], [-35, -220, 5.3], [95, -20, 1.1]];
    world.devilTracks = buildDustDevilTracks(heightAt, 0, -205, { n: 24, spread: 120 });   // fade under storm dust (world.js)
    world.scene.add(world.devilTracks);
    // soft round puffs (plain points draw as squares), so the column reads as a twisting haze of dust
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(.5, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const puff = new THREE.CanvasTexture(c);
    this.N = 220; this.cleaned = this.anchors.map(() => -1e9);
    this.devils = this.anchors.map((_, i) => {
      const size = DEVIL_SIZES[i % DEVIL_SIZES.length], n = Math.round(this.N * Math.min(1.6, .6 + size * .45));
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#c9a27c', map: puff, size: 2.4 + size * 1.1, transparent: true, opacity: .26, depthWrite: false, fog: true }));
      p.frustumCulled = false; world.scene.add(p);
      // base radius (metres) and height: the column is narrow near the ground and fans out above
      return Object.assign(p, { size, n, rb: .5 + 1.4 * size, H: 22 + 30 * size, opacity: .22 + .09 * size });
    });
  }
  centre(i, t) { const [ax, az, ph] = this.anchors[i]; const k = 1 / Math.sqrt(this.devils?.[i]?.size || 1); return [ax + Math.sin(t * .02 * k + ph) * 80, az + Math.cos(t * .017 * k + ph * 1.3) * 70]; }
  tick(dt) {
    this.t += dt; const w = this.world, pl = w.player?.position;
    // Dust devils form when the sun heats the ground: from late morning to late afternoon, and never inside a dust storm
    const ph = w.phase ?? .5, sunUp = Math.min(1, Math.max(0, Math.min((ph - .36) / .05, (.72 - ph) / .05))) * (w.dustOn ? 0 : 1);
    let veil = 0, lean = 0; const check = (this.checkT -= dt) <= 0; if (check) this.checkT = .5;
    this.devils.forEach((pts, i) => {
      pts.visible = sunUp > 0; pts.material.opacity = pts.opacity * sunUp; if (!pts.visible) return;
      const [cx, cz] = this.centre(i, this.t), base = heightAt(cx, cz), a = pts.geometry.attributes.position.array, { n, rb, H, size } = pts;
      for (let k = 0; k < n; k++) {
        const f = k / n, r = rb * (.45 + .55 * Math.sqrt(f)) + f * f * 3.4 * size + Math.sin(this.t * 1.3 + f * 6 + i) * .3 * f * size, ang = this.t * (2.2 - f * 1.2) / Math.sqrt(size) + k * 2.399;
        a[k * 3] = cx + Math.cos(ang) * r; a[k * 3 + 1] = base + .2 + f * H; a[k * 3 + 2] = cz + Math.sin(ang) * r;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      if (pl) {
        const d = Math.hypot(pl.x - cx, pl.z - cz);
        if (!this.told && d < 30) { this.told = true; this.sites.onDevil?.(size); }
        const reach = rb + 2.5;
        if (d < reach && !w.driving) {   // inside the column: dust everywhere, a slight lean into the swirl, no push
          const k = (1 - d / reach) * sunUp; veil = Math.max(veil, k * Math.min(.8, .35 + .18 * size)); lean = k * .05 * Math.min(2, size);
        }
      }
      // crossing the solar panels: the swirl lifts dust off them (once per pass, at most every couple of minutes)
      if (check && this.t - this.cleaned[i] > 120 && w.solar?.panels?.length) {
        const v = this._v ??= new THREE.Vector3();
        if (w.solar.panels.some(p => p.visible && p.getWorldPosition(v) && Math.hypot(v.x - cx, v.z - cz) < rb + 2)) {
          this.cleaned[i] = this.t; this.sites.onDevilClean?.(Math.min(.25, .06 + .06 * size));
        }
      }
    });
    w.devilVeil = veil; w.windLean = lean;
  }
}
