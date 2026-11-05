// Opening scene: Earth launch pad, countdown, lift-off.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';

// Seconds after lift-off for each part of the flight (slowed down; the real times are in the captions)
const T = { maxQ: 7, boosters: 14, karman: 22, tower: 31, core: 37, orbit: 44, end: 52 };
const rocketY = lift => (lift < 6 ? 2.2 * lift * lift : 79 + (lift - 6) * 26.4 + (lift - 6) ** 2 * 0.5);
// Height above the ground in km, following the real Artemis I climb in squeezed time
// (about 47 km when the boosters drop, 100 km at the Kármán line, about 160 km when the core stage stops).
const ALT = [[0, 0], [T.maxQ, 13], [T.boosters, 47], [T.karman, 100], [T.tower, 120], [T.core, 160], [T.end, 185]];
export function altitudeKm(lift) {
  for (let i = 1; i < ALT.length; i++) if (lift <= ALT[i][0]) { const [t0, a0] = ALT[i - 1], [t1, a1] = ALT[i]; return a0 + (a1 - a0) * (lift - t0) / (t1 - t0); }
  return ALT[ALT.length - 1][1];
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,210,140,0.7)'); grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
// a glowing sheet with rings, bright near the rocket and fading out far away
function karmanTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0, 'rgba(120,220,255,0.22)'); grad.addColorStop(0.3, 'rgba(90,190,255,0.08)'); grad.addColorStop(1, 'rgba(60,140,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(160,235,255,0.35)'; g.lineWidth = 1.2;
  for (let r = 20; r < 256; r += 22) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textSprite(text) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g = c.getContext('2d');
  g.font = '800 54px Poppins, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,30,60,.9)'; g.shadowBlur = 12; g.fillStyle = '#bff0ff'; g.fillText(text, 512, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
}

export class Launch {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7fb2e5');
    this.scene.fog = new THREE.Fog('#a9cdef', 80, 520);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 60000);
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
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
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
    // a soft glow around the engines, so the flames light up the smoke and the pad
    this.glow = new THREE.PointLight('#ffb35c', 0, 160, 1.2); this.glow.position.set(0, -6, 0); r.add(this.glow);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc27a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.halo.scale.set(40, 40, 1); this.halo.position.set(0, -10, 0); r.add(this.halo);

    // high up: stars, the curved edge of the Earth, and the Kármán line (100 km - where space begins)
    const starGeo = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(20000); v.y = Math.abs(v.y); sp.push(v.x, v.y, v.z); }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
    this.earthR = 30000;
    this.earth = new THREE.Group();
    this.earth.add(new THREE.Mesh(new THREE.SphereGeometry(this.earthR, 96, 64), new THREE.MeshStandardMaterial({ color: '#2f6fb3', roughness: 0.9, emissive: '#0b2a55', emissiveIntensity: 0.6, fog: false })));
    this.earth.add(new THREE.Mesh(new THREE.SphereGeometry(this.earthR * 1.012, 96, 64), new THREE.MeshBasicMaterial({ color: '#7fc4ff', transparent: true, opacity: 0.35, side: THREE.BackSide, fog: false, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.earth.visible = false; this.scene.add(this.earth);
    this.karman = new THREE.Group(); this.karman.visible = false; this.scene.add(this.karman);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ map: karmanTexture(), transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    band.rotation.x = -Math.PI / 2; this.karman.add(band);
    this.karmanLabel = textSprite('KÁRMÁN LINE · 100 km');
    this.karmanLabel.scale.set(64, 8, 1); this.karman.add(this.karmanLabel);

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

  // The flight, slowed down so there is time to read: about 50 seconds from lift-off to orbit
  // (the real climb to orbit takes about 8 minutes). Each stage gets several seconds.
  update(dt) {
    this.t += dt;
    const left = this.countFrom - this.t;          // seconds until lift-off
    const lift = Math.max(0, -left);
    if (left <= 1.5 && !this.lit) { this.lit = true; this.flames.forEach(f => (f.visible = true)); }
    const km = altitudeKm(lift), thin = Math.min(1, km / 90);   // how high, and how little air is left
    for (const f of [...this.flames, this.upperFlame]) {
      const spread = 1 + thin * 1.8;              // in thin air the exhaust balloons out wide
      f.scale.set(spread * (1 + Math.random() * 0.12), (1 + thin * 0.6) * (1 + Math.random() * 0.25), spread * (1 + Math.random() * 0.12));
    }
    this.glow.intensity = this.lit ? (this.coreOff ? 2 : 6) * (0.85 + Math.random() * 0.3) : 0;
    this.halo.material.opacity = this.lit ? (this.coreOff ? 0.35 : 0.85) : 0;
    // climb: gentle at first, then steadily faster (game units, so the camera can follow)
    this.rocket.position.y = this.baseY + rocketY(lift);
    const tip = Math.max(0, lift - 5);
    this.rocket.rotation.z = -Math.min(0.55, tip * 0.03);   // slowly tips over towards the sea, like a real ascent
    this.rocket.position.x = tip * tip * 0.45;
    // the real staging events, in the real order (Artemis I)
    if (lift > T.boosters && !this.boostersOff) {
      this.boostersOff = true;
      this.boosters.forEach(b => this.drop(b, new THREE.Vector3(b.userData.side * 6, -8, 0)));
    }
    if (lift > T.tower && !this.lasOff) { this.lasOff = true; this.drop(this.las, new THREE.Vector3(5, 14, 0)); }
    if (lift > T.core && !this.coreOff) { this.coreOff = true; this.drop(this.core, new THREE.Vector3(0, -22, 0)); this.upperFlame.visible = true; }
    for (const d of this.dropped) { d.vel.y -= 6 * dt; d.obj.position.addScaledVector(d.vel, dt); d.obj.rotation.z += dt * 0.3 * Math.sign(d.vel.x || 1); }
    // the sky goes black as the air thins, stars come out, and the Earth's curved edge appears below
    this.scene.background.copy(this.sky).lerp(this.space, Math.min(1, km / 70));
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.far = 520 + km * 3;   // the launch pad far below fades into the dark
    this.stars.material.opacity = THREE.MathUtils.smoothstep(km, 35, 90);
    const p = this.rocket.position;
    this.earth.visible = km > 25;
    this.earth.position.set(p.x - 600, p.y - this.earthR - 900 - km * 30, -4000);
    // the Kármán line waits at the height the rocket has at 100 km, and glows as you pass it
    this.karman.visible = km > 60 && km < 160;
    this.karman.position.set(p.x, this.baseY + rocketY(T.karman), 0);
    this.karmanLabel.position.set(-30, 4, 40);
    const kGlow = 1 - Math.min(1, Math.abs(km - 100) / 45);
    this.karman.children[0].material.opacity = 0.15 + 0.55 * kGlow;
    this.karmanLabel.material.opacity = kGlow;
    // smoke at the pad
    if (left < 1.5 && lift < 14) {
      for (const s of this.smoke) {
        if (s.life <= 0 && Math.random() < 0.3) {
          s.life = 3.2; s.mesh.visible = true;
          s.mesh.position.set((Math.random() - 0.5) * 4, this.padTop + 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
          s.vel.set((Math.random() - 0.5) * 16, Math.random() * 2.5, (Math.random() - 0.5) * 16);
        }
      }
    }
    for (const s of this.smoke) if (s.life > 0) { s.life -= dt; s.mesh.position.addScaledVector(s.vel, dt); s.vel.multiplyScalar(1 - dt * 0.3); s.mesh.scale.setScalar(1 + (3.2 - s.life) * 2.6); if (s.life <= 0) s.mesh.visible = false; }
    // camera: close by the pad, then it drifts back so you can see the stages fall and the Earth below
    const shake = left < 1.5 && lift < 5 ? (Math.random() - 0.5) * 0.35 * (1 - lift / 5) : 0;
    const back = THREE.MathUtils.smoothstep(lift, 10, 30);
    this.camera.position.set(62 + shake + p.x + back * 40, 16 + p.y * 0.92 + back * (p.y * 0.08 + 10), 92 + shake + back * 110);
    this.camera.lookAt(p.x, 34 + p.y - back * 30, 0);
    if (lift > T.end) this.done = true;
    // what the commentator explains at each moment (real Artemis I times)
    const [title, caption] = left > 6 ? [null, `This is SLS, NASA's Space Launch System - 98 m tall, on its 116 m Mobile Launcher${this.nasa ? " (NASA's own 3D models)" : ''}`]
      : left > 3 ? [null, 'At the top, under the white cover: the Orion capsule, where the crew sits']
      : left > 0 ? [null, 'The 4 main engines start first - they burn liquid hydrogen and liquid oxygen']
      : lift < T.maxQ ? ['LIFT-OFF!', 'The 2 solid-fuel boosters light: they give over 75% of the 8.8 million pounds of thrust']
      : lift < T.boosters ? ['MAX-Q', 'About 1 minute in: the air pushes hardest - the rocket must survive its biggest loads and shaking']
      : lift < T.karman - 3 ? ['BOOSTERS OFF', '2 min 12 s: the solid boosters burn until they are empty, then drop away into the ocean']
      : lift < T.tower ? ['KÁRMÁN LINE - 100 km', "About 3 minutes in, you pass 100 km up: most scientists say SPACE starts here. 99.99997% of Earth's air is now below you - that's why the sky is black!"]
      : lift < T.core ? ['TOWER OFF', 'About 3 minutes: the escape tower (it could pull the capsule to safety) is no longer needed']
      : lift < T.orbit ? ['CORE STAGE OFF', 'About 8 minutes: the orange core stage has used up its fuel and falls away']
      : ['ORBIT!', 'Orion now flies around Earth at about 28,000 km/h - next stop, the Moon'];
    return { left: Math.ceil(left), lifted: lift > 0, title, caption, km, karman: lift >= T.karman - 3 && lift < T.tower };
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
