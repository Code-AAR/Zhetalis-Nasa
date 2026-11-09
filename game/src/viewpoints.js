// Viewpoints: a stone cairn and a pennant on high ground where a big real feature is easiest to see.
// Walk or drive up to one and the tip explains what you are looking at (once per game, saved in outpost.viewpoints).
import * as THREE from 'three';
import { heightAt } from './world.js';

import { VIEWPOINTS } from './site-data.js';
export { VIEWPOINTS };

function sign(text) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,20,24,.88)'; g.beginPath(); g.roundRect(6, 10, 628, 108, 22); g.fill();
  g.fillStyle = '#7fb6e0'; g.beginPath(); g.roundRect(6, 10, 12, 108, [22, 0, 0, 22]); g.fill();
  g.fillStyle = '#f1efe8'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(text, 326, 58);
  g.font = '24px system-ui, sans-serif'; g.fillStyle = '#b8d6ee'; g.fillText('Viewpoint', 326, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); sp.scale.set(6.4, 1.28, 1); return sp;
}

// a cairn of flat stones, a pole with a blue pennant, and a low arrow stone pointing at the view
function cairn(v) {
  const g = new THREE.Group(), y0 = heightAt(v.x, v.z);
  const rock = new THREE.MeshStandardMaterial({ color: '#6f5a4a', roughness: .95, flatShading: true });
  const geo = new THREE.DodecahedronGeometry(1, 0);
  [[.9, .45, 0], [.75, .4, .95], [.6, .35, 1.65], [.45, .3, 2.2], [.3, .25, 2.6]].forEach(([r, h, y], i) => {
    const m = new THREE.Mesh(geo, rock); m.scale.set(r, h, r * .9); m.position.set(Math.sin(i * 2.1) * .06, y + h * .6, Math.cos(i * 1.7) * .06); m.rotation.y = i * 1.3; m.castShadow = true; g.add(m);
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#cfc8b8', roughness: .6 }));
  pole.position.set(.5, 1.6, 0); g.add(pole);
  const pen = new THREE.BufferGeometry(); pen.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -.55, 0, .95, -.28, 0], 3)); pen.computeVertexNormals();
  const flag = new THREE.Mesh(pen, new THREE.MeshStandardMaterial({ color: '#3d7fc0', roughness: .8, side: THREE.DoubleSide })); flag.position.set(.52, 3.15, 0); g.add(flag);
  const ang = Math.atan2(v.look[0] - v.x, v.look[1] - v.z);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.2, 4), rock); arrow.rotation.set(Math.PI / 2, 0, 0); arrow.scale.set(1, 1, .35);
  const pointer = new THREE.Group(); pointer.add(arrow); arrow.position.set(0, .12, 1.6); pointer.rotation.y = ang; g.add(pointer);
  const s = sign(v.name); s.position.set(0, 4.4, 0); g.add(s);
  g.position.set(v.x, y0 - .1, v.z); g.userData.flag = flag; g.name = v.name;
  return g;
}

export class Viewpoints {
  constructor(world, { seen = [], onReach } = {}) {
    this.world = world; this.onReach = onReach; this.seen = new Set(seen); this.t = 0;
    this.group = new THREE.Group(); this.group.name = 'Viewpoints'; world.scene.add(this.group);
    for (const v of VIEWPOINTS) this.group.add(cairn(v));
    world.colliders?.push(...VIEWPOINTS.map(v => ({ x: v.x, z: v.z, r: 1.1 })));
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(dt); };
  }
  tick(dt) {
    for (const g of this.group.children) g.userData.flag.rotation.y = Math.sin(this.world.time * 1.7 + g.position.x) * .25;
    if ((this.t -= dt) > 0) return; this.t = .4;
    const p = this.world.driving ? this.world.sev.pos : this.world.player?.position; if (!p) return;
    for (const v of VIEWPOINTS) if (!this.seen.has(v.id) && Math.hypot(p.x - v.x, p.z - v.z) < 9) { this.seen.add(v.id); this.onReach?.(v, [...this.seen]); }
  }
}
