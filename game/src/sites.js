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
  constructor(world, { toast, modal, onVisit, onDevil }) {
    Object.assign(this, { world, toast, modal, onVisit, onDevil });
    this.list = SITES; this.visited = new Set(); this.meshes = new Map();
    this.group = new THREE.Group(); this.group.name = 'Gusev stops'; world.scene.add(this.group);
    for (const s of SITES) this.place(s);
    const prev = world.extraTargets;
    world.extraTargets = p => [...(prev?.(p) || []), ...SITES.map(s => ({ type: 'site', id: s.id, label: s.verb, range: s.kind === 'silica' ? 5 : 4.5, d: Math.hypot(p.x - s.x, p.z - s.z) }))];
    this.devils = new DustDevils(world, this);
    this.lodClock = 0;
    const upd = world.update.bind(world); world.update = (dt, a) => { upd(dt, a); this.devils.tick(dt); this.lod(dt); };
    world.sites = this;
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

// Dust devils: slow, swirling columns of dust that wander over the plain. Look only; they cannot hurt you.
class DustDevils {
  constructor(world, sites) {
    this.world = world; this.sites = sites; this.t = 0; this.told = false;
    // dust devils wander around these spots; two of them work the dust devil plain to the north, with its dark tracks
    this.anchors = [[-120, 150, 0.2], [0, -195, 2.1], [250, 40, 4.0], [-35, -220, 5.3]];
    world.scene.add(buildDustDevilTracks(heightAt, 0, -195));
    this.N = 110; this.devils = this.anchors.map(() => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#c9a27c', size: 1.5, transparent: true, opacity: .3, depthWrite: false, fog: true }));
      p.frustumCulled = false; world.scene.add(p); return p;
    });
  }
  centre(i, t) { const [ax, az, ph] = this.anchors[i]; return [ax + Math.sin(t * .02 + ph) * 80, az + Math.cos(t * .017 + ph * 1.3) * 70]; }
  tick(dt) {
    this.t += dt; const pl = this.world.player?.position;
    this.devils.forEach((pts, i) => {
      const [cx, cz] = this.centre(i, this.t), base = heightAt(cx, cz), a = pts.geometry.attributes.position.array, H = 26 + i * 4;
      for (let k = 0; k < this.N; k++) {
        const f = k / this.N, r = .35 + f * f * 3.4, ang = this.t * (2.2 - f * 1.2) + k * 2.399;
        a[k * 3] = cx + Math.cos(ang) * r; a[k * 3 + 1] = base + .2 + f * H; a[k * 3 + 2] = cz + Math.sin(ang) * r;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      if (pl && !this.told && Math.hypot(pl.x - cx, pl.z - cz) < 45) { this.told = true; this.sites.onDevil?.(); }
    });
  }
}
