// Opening scene: Earth launch pad, countdown, lift-off.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';

export class Launch {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7fb2e5');
    this.scene.fog = new THREE.Fog('#a9cdef', 80, 520);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
    this.scene.add(new THREE.HemisphereLight('#dcefff', '#4b6b3a', 1.2));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.8); sun.position.set(60, 120, 40); this.scene.add(sun);

    const L = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
    // Launch Complex 39B at Kennedy Space Center, laid out like NASA's Artemis II launch photos:
    // a raised concrete mound, three lightning towers, the sound-suppression water tower, the sea behind.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ color: '#5f8a4a' }));
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    this.padTop = 6;
    this.scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(46, 70, this.padTop, 8), L('#cdb89a')), 0, this.padTop / 2, 0));   // sandy mound
    this.scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 52), L('#a3a29d')), 0, this.padTop + 0.2, 0));                // concrete hardstand
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 800), new THREE.MeshLambertMaterial({ color: '#3d78b8' }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, -760); this.scene.add(sea);
    const padWhite = L('#e9e9e6');
    for (const [x, z] of [[-82, -70], [88, -66], [4, -125]]) {        // lightning protection towers (taller than the rocket)
      const t = new THREE.Group(); t.position.set(x, this.padTop, z);
      for (let i = 0; i < 4; i++) t.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.35, 120, 0.35), padWhite), i % 2 ? 1.4 : -1.4, 60, i < 2 ? 1.4 : -1.4));
      for (let y = 6; y < 120; y += 7) t.add(at(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.25, 3.1), padWhite), 0, y, 0));
      t.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 22, 6), padWhite), 0, 131, 0));   // the mast on top
      this.scene.add(t);
    }
    const water = new THREE.Group(); water.position.set(38, this.padTop, -26);   // water tower: floods the pad at lift-off to soften the sound
    for (let i = 0; i < 4; i++) water.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 30, 6), padWhite), i % 2 ? 3 : -3, 15, i < 2 ? 3 : -3));
    water.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 10), padWhite), 0, 15, 0));
    water.add(at(new THREE.Mesh(new THREE.SphereGeometry(5, 16, 10), padWhite), 0, 33, 0));
    this.scene.add(water);

    // Simple mobile launcher tower - replaced by NASA's own 3D model as soon as it loads
    const steel = L('#5b6068');
    const tower = this.tower = new THREE.Group(); tower.position.set(-11, this.padTop, 0);
    for (let i = 0; i < 4; i++) tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 76, 0.7), steel), i % 2 ? 2.6 : -2.6, 38, i < 2 ? 2.6 : -2.6));
    for (let y = 5; y < 76; y += 6) tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.45, 5.8), steel), 0, y, 0));
    tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 1.4), steel), 6.5, 63, 0));   // crew access arm to Orion
    this.scene.add(tower);

    // SLS Block 1: orange core stage + two white solid rocket boosters + upper stage + Orion + abort tower
    // Built in parts that really drop away during the climb, in the same order as on Artemis I.
    const orange = L('#d4711f'), white = L('#f2f1ee'), dark = L('#26272b'), silver = L('#b9bcc2');
    this.baseY = this.padTop;
    const r = this.rocket = new THREE.Group(); r.position.y = this.baseY;
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 });
    const flame = (radius, len, x, y = -8) => { const f = at(new THREE.Mesh(new THREE.ConeGeometry(radius, len, 14, 1, true), flameMat), x, y, 0); f.rotation.x = Math.PI; return f; };
    this.flames = [];
    const core = this.core = new THREE.Group(); r.add(core);
    core.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 52, 24), orange), 0, 27, 0));     // core stage (foam is orange)
    core.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 24), dark), 0, 1.5, 0));
    for (let i = 0; i < 4; i++) core.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.6, 10), dark), (i % 2 ? 1 : -1) * 1.3, 0.2, (i < 2 ? 1 : -1) * 1.3)); // 4 RS-25 engines
    const coreFlame = flame(2.8, 14, 0); core.add(coreFlame); this.flames.push(coreFlame);
    this.boosters = [];
    for (const side of [-1, 1]) {                                                                         // solid rocket boosters
      const b = new THREE.Group(); r.add(b);
      b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 47, 16), white), side * 5, 24.5, 0));
      b.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 16), white), side * 5, 50, 0));
      for (const y of [12, 24, 36]) b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.6, 16), dark), side * 5, y, 0));
      b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.7, 2.4, 16), dark), side * 5, 0, 0));
      const f = flame(1.6, 18, side * 5); b.add(f); this.flames.push(f);
      b.userData = { side, vel: new THREE.Vector3(), spin: 0 };
      this.boosters.push(b);
    }
    const upper = this.upper = new THREE.Group(); r.add(upper);
    upper.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 4, 24), white), 0, 55, 0));     // adapter + upper stage
    upper.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6, 24), white), 0, 60, 0));
    upper.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 24), silver), 0, 65, 0));    // Orion service module
    upper.add(at(new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 24), white), 0, 69.5, 0));            // Orion capsule (in its cover)
    this.upperFlame = flame(1.4, 8, 0, 49); this.upperFlame.visible = false; upper.add(this.upperFlame);
    const las = this.las = new THREE.Group(); upper.add(las);                                           // launch abort system tower
    las.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 10), white), 0, 75.5, 0));
    las.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.35, 2, 10), dark), 0, 80, 0));
    this.flames.forEach(f => (f.visible = false));
    this.dropped = [];    // parts falling back to Earth: { obj, vel }
    this.scene.add(r);
    this.sky = new THREE.Color('#7fb2e5'); this.space = new THREE.Color('#05060c');

    // smoke puffs
    this.smoke = [];
    const puffMat = new THREE.MeshLambertMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.8 });
    for (let i = 0; i < 60; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), puffMat); s.visible = false; this.scene.add(s);
      this.smoke.push({ mesh: s, life: 0, vel: new THREE.Vector3() });
    }
    this.t = 0; this.countFrom = 10; this.done = false;
    this.useNasaModels();
  }

  // Swap the simple shapes for NASA's official 3D models of SLS and the Mobile Launcher.
  async useNasaModels() {
    const [sls, ml] = await Promise.all([loadModel('sls.glb'), loadModel('mobile-launcher.glb')]);
    if (this.lit) return;                    // arrived too late - don't swap parts mid-flight
    const K = 82 / 98;                       // game units per metre (SLS Block 1 is 98 m tall)
    if (ml) {
      const m = ml.scene.clone(), box = new THREE.Box3().setFromObject(m);
      const s = 116 * K / box.max.y;         // Mobile Launcher 1 is 380 ft (116 m) tall - NASA
      m.scale.setScalar(s); m.rotation.y = Math.PI / 2;   // long exhaust hole lines up with the boosters, tower behind
      m.position.set(0, this.padTop, 0);
      // NASA's file marks the steel as fully metallic, which looks black without reflections - make it painted grey steel
      m.traverse(o => { if (o.isMesh) for (const mt of [].concat(o.material)) { mt.metalness = 0; mt.roughness = 0.85; mt.color?.multiplyScalar(1.6); } });
      this.scene.add(m); this.tower.visible = false;
      this.baseY = this.padTop + 0.294 * s;  // the rocket stands on the launcher's deck (measured from the model)
      this.rocket.position.y = this.baseY;
    }
    if (sls) {
      const groups = { core: this.core, boosterL: this.boosters[0], boosterR: this.boosters[1], upper: this.upper, las: this.las, orion: this.upper };
      for (const g of new Set(Object.values(groups)))
        g.children.forEach(ch => { if (ch.isMesh && !this.flames.includes(ch) && ch !== this.upperFlame) ch.visible = false; });
      for (const [name, g] of Object.entries(groups)) {
        const part = sls.scene.getObjectByName(name); if (!part) continue;
        part.removeFromParent(); part.position.set(0, 0, 0); part.scale.setScalar(K);
        g.add(part);
      }
      // move the flames to where NASA's engines and nozzles really are (measured from the parts)
      this.rocket.updateMatrixWorld(true);
      this.boosters.forEach(b => {
        const nozzle = new THREE.Box3().setFromObject(b.children.find(ch => ch.name?.startsWith('booster')) || b);
        const x = this.rocket.worldToLocal(nozzle.getCenter(new THREE.Vector3())).x;
        b.children.forEach(ch => { if (this.flames.includes(ch)) ch.position.x = x; });
      });
      const up = new THREE.Box3().setFromObject(this.upper.children.find(ch => ch.name === 'upper') || this.upper);
      this.upperFlame.position.y = this.rocket.worldToLocal(up.min.clone()).y - 4;
      this.nasa = true;
    }
  }

  // Detach a part so it keeps its place in the world, then let it fall away.
  drop(obj, vel) {
    obj.updateMatrixWorld(); const m = obj.matrixWorld.clone();
    obj.parent.remove(obj); this.scene.add(obj);
    m.decompose(obj.position, obj.quaternion, obj.scale);
    this.dropped.push({ obj, vel });
  }

  update(dt) {
    this.t += dt;
    const left = this.countFrom - this.t;          // seconds until lift-off
    const lift = Math.max(0, -left);
    if (left <= 1.5 && !this.lit) { this.lit = true; this.flames.forEach(f => (f.visible = true)); }
    for (const f of [...this.flames, this.upperFlame]) f.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.3, 1 + Math.random() * 0.15);
    // speeds up at first, then climbs steadily so the camera can keep up (the real flight is ~8 minutes, shown in ~17 s)
    this.rocket.position.y = this.baseY + (lift < 4 ? 4 * lift * lift : 64 + (lift - 4) * 32);
    const tip = Math.max(0, lift - 3);
    this.rocket.rotation.z = -Math.min(0.5, tip * 0.05);   // tips over towards the sea, like a real ascent
    this.rocket.position.x = tip * tip * 1.2;
    // the real staging events (Artemis I times), squeezed into a few seconds each
    if (lift > 6 && !this.boostersOff) {
      this.boostersOff = true;
      this.boosters.forEach(b => this.drop(b, new THREE.Vector3(b.userData.side * 9, -12, 0)));
    }
    if (lift > 8.5 && !this.lasOff) { this.lasOff = true; this.drop(this.las, new THREE.Vector3(6, 20, 0)); }
    if (lift > 11 && !this.coreOff) { this.coreOff = true; this.drop(this.core, new THREE.Vector3(0, -30, 0)); this.upperFlame.visible = true; }
    for (const d of this.dropped) { d.vel.y -= 9 * dt; d.obj.position.addScaledVector(d.vel, dt); d.obj.rotation.z += dt * 0.4 * Math.sign(d.vel.x || 1); }
    this.scene.background.copy(this.sky).lerp(this.space, Math.min(1, lift / 13));   // the sky goes black as the air thins
    this.scene.fog.color.copy(this.scene.background);
    if (left < 1.5) {
      for (const s of this.smoke) {
        if (s.life <= 0 && Math.random() < 0.25) {
          s.life = 2.5; s.mesh.visible = true;
          s.mesh.position.set((Math.random() - 0.5) * 4, Math.max(this.padTop + 1, this.rocket.position.y - 8), (Math.random() - 0.5) * 4);
          s.vel.set((Math.random() - 0.5) * 14, Math.random() * 2, (Math.random() - 0.5) * 14);
        }
        if (s.life > 0) { s.life -= dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.scale.setScalar(1 + (2.5 - s.life) * 2.2); if (s.life <= 0) s.mesh.visible = false; }
      }
    }
    const shake = left < 1.5 && lift < 4 ? (Math.random() - 0.5) * 0.4 : 0;
    const p = this.rocket.position, follow = p.y;
    this.camera.position.set(62 + shake + p.x, 16 + follow * 0.92, 92 + shake);
    this.camera.lookAt(p.x, 34 + follow, 0);
    if (lift > 17) this.done = true;
    // what the commentator explains at each moment (real Artemis I times in brackets)
    const [title, caption] = left > 6 ? [null, `This is SLS, NASA's Space Launch System - 98 m tall, on its 116 m Mobile Launcher${this.nasa ? " (NASA's own 3D models)" : ''}`]
      : left > 3 ? [null, 'At the top, under the white cover: the Orion capsule, where the crew sits']
      : left > 0 ? [null, 'The 4 main engines start first - they burn liquid hydrogen and liquid oxygen']
      : lift < 3 ? ['LIFT-OFF!', 'The 2 solid-fuel boosters light: they give over 75% of the 8.8 million pounds of thrust']
      : lift < 6 ? ['MAX-Q', 'About 1 minute in: the air pushes hardest - the rocket must survive its biggest loads and shaking']
      : lift < 8.5 ? ['BOOSTERS OFF', '2 min 12 s: solid boosters burn until they are empty, then drop away into the ocean']
      : lift < 11 ? ['TOWER OFF', 'About 3 minutes: the escape tower (it could pull the capsule to safety) is no longer needed']
      : lift < 14 ? ['CORE STAGE OFF', 'About 8 minutes: the orange core stage has used up its fuel and falls away']
      : ['ORBIT!', 'Orion now flies around Earth at about 28,000 km/h - next stop, the Moon'];
    return { left: Math.ceil(left), lifted: lift > 0, title, caption };
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
