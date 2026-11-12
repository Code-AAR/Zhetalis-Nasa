// Orion lunar flyby: fly around the far side of the Moon as Artemis I (uncrewed) or Artemis II (crewed).
// The Moon and Earth are drawn to true scale (1 unit = 10 km); Orion is drawn in a second pass so you can see
// it although it is tiny next to the Moon. The path is a real-physics hyperbola around the Moon (Kepler's
// law sets the speed) but it is simplified: not NASA's actual trajectory.
import * as THREE from 'three';
import { buildOrion, MISSIONS } from './orion.js';
import { effectiveQuality } from '../../src/device-profile.js';
import { mountLunarExhibit } from './lunar-assets.js';

const MOON_R = 173.74, EARTH_R = 637.1, EARTH_D = 38440, MU = 4902.8;   // units of 10 km; MU in km^3/s^2
const SUN = new THREE.Vector3(0.2, 0.12, -0.97).normalize();   // approach sees a lit Moon; the far side is half-lit at closest approach

// Free a removed object's own geometries and materials. Textures shared between builds (Orion's solar-cell
// canvas) are left alone: material.dispose() does not free textures.
function disposeTree(root) {
  root.userData.disposed = true;
  root.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); });
}

export class Flyby {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#000000');
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200000);
    this.near = new THREE.Scene(); this.ncam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    const sun = new THREE.DirectionalLight('#ffffff', 3.4); sun.position.copy(SUN); this.scene.add(sun, new THREE.AmbientLight('#203040', 0.08));
    const nsun = new THREE.DirectionalLight('#ffffff', 3.2); nsun.position.copy(SUN).multiplyScalar(50); this.near.add(nsun, new THREE.HemisphereLight('#2a3550', '#6b6b66', 0.35));
    const tl = new THREE.TextureLoader();
    const moonTex = tl.load('assets/moon-map.jpg'); moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.anisotropy = 8;
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 128, 96), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0, bumpMap: moonTex, bumpScale: 0.6 }));
    this.scene.add(this.moon);
    // Do not request the 81.5 MB globe while this eagerly constructed scene is only a menu.
    this.moonModelReady = null;
    this.exhibit = mountLunarExhibit();
    const earthTex = tl.load('assets/earth-map.jpg'); earthTex.colorSpace = THREE.SRGBColorSpace;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.7, metalness: 0 }));
    this.earth.position.set(EARTH_D, 0, 0); this.scene.add(this.earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.025, 64, 48), new THREE.MeshBasicMaterial({ color: '#6fa8ff', transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }));
    this.earth.add(atmo);
    // stars + sun
    const n = 4000, p = new Float32Array(n * 3); let s = 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - u * u); p.set([Math.cos(a) * q * 150000, u * 150000, Math.sin(a) * q * 150000], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.8 })); this.scene.add(this.stars);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.12, '#fffdf5'); grd.addColorStop(0.25, 'rgba(255,248,230,.25)'); grd.addColorStop(1, 'rgba(255,248,230,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, toneMapped: false })); this.sun.scale.setScalar(9000); this.scene.add(this.sun);
    this.yaw = 0; this.pitch = 0; this.warp = 1; this.photos = {}; this.done = false;
  }

  // Called only by start(): deduplicate in-flight/successful loads, retry on the next mission after failure.
  ensureMoonModel() {
    if (this.moonModelReady) return this.moonModelReady;
    let choice; try { choice = new URLSearchParams(location.search).get('graphics') || localStorage.getItem('mars-graphics'); } catch {}
    const lite = effectiveQuality(choice) === 'low';
    this.moonModelReady = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) =>
      new GLTFLoader().loadAsync(new URL(`../assets/nasa/moon-lro${lite ? '-lite' : ''}.glb`, import.meta.url).href)
    ).then(gltf => {
      const model = gltf.scene, box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
      model.position.sub(centre); const wrapper = new THREE.Group(); wrapper.add(model);
      wrapper.scale.setScalar(MOON_R * 2 / Math.max(size.x, size.y, size.z));
      wrapper.rotation.copy(this.moon.rotation); wrapper.name = lite ? 'NASA LRO Moon — phone Lite' : 'NASA LRO full-resolution Moon';
      model.traverse(o => { if(o.isMesh) { o.material.side = THREE.FrontSide; o.material.map && (o.material.map.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy())); } });
      this.scene.remove(this.moon); this.moon.geometry.dispose(); this.moon.material.dispose(); this.moon.material.map?.dispose();
      this.moon = wrapper; this.scene.add(wrapper); return true;
    }).catch(error => { console.warn('NASA Moon model unavailable; retaining sphere', error); this.moonModelReady = null; return false; });
    return this.moonModelReady;
  }

  start(missionId, prior = {}) {
    this.exhibit.close();
    this.ensureMoonModel();
    this.id = missionId; this.m = MISSIONS[missionId];
    if (this.orion) { this.near.remove(this.orion); disposeTree(this.orion); }
    this.orion = buildOrion(missionId); this.near.add(this.orion);
    const altKm = this.m.periapsisKm ?? 6500;   // Artemis II: illustrative pass height
    this.rp = MOON_R + altKm / 10; this.e = 1.4;
    this.tMax = Math.acos(-1 / this.e) * 0.9;
    this.theta = -this.tMax; this.done = false; this.photos = { ...prior };
    // angular momentum chosen so the pass lasts ~80 s of play at 1x
    const p = this.rp * (1 + this.e); let sum = 0; for (let i = 0; i < 400; i++) { const t = -this.tMax + i / 400 * 2 * this.tMax, rr = p / (1 + this.e * Math.cos(t)); sum += rr * rr * (2 * this.tMax / 400); }
    this.h = sum / 80;
    // path line
    if (this.path) { this.scene.remove(this.path); this.path.geometry.dispose(); this.path.material.dispose(); }
    const pts = []; for (let i = 0; i <= 200; i++) pts.push(this.posAt(-this.tMax + i / 200 * 2 * this.tMax));
    this.path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.35 }));
    this.scene.add(this.path);
    this.yaw = this.m.view === 'window' ? 0.4 : 0; this.pitch = this.m.view === 'window' ? 0.05 : -0.08;
    this.update(0);   // pose camera + Orion before anything reads view()
    if (this.m.view === 'window') {   // crew window: start looking at the Moon, the destination; drag to look around after
      const f = this.frame, d = this.pos.clone().negate().normalize();
      this.yaw = Math.atan2(d.dot(f.right), d.dot(f.base)); this.pitch = Math.asin(Math.max(-1, Math.min(1, d.dot(f.realUp))));
      this.update(0);
    }
  }

  posAt(t) {
    const r = this.rp * (1 + this.e) / (1 + this.e * Math.cos(t));
    const tilt = 0.18, side = r * Math.sin(t);   // orbit plane tilted about the Earth-Moon line (keeps the radius exact)
    return new THREE.Vector3(-r * Math.cos(t), side * Math.sin(tilt), side * Math.cos(tilt));
  }
  radius() { return this.posAt(this.theta).length(); }
  speedKmS() { const r = this.radius() * 10, a = (this.rp * 10) / (1 - this.e); return Math.sqrt(MU * (2 / r - 1 / a)); }

  look(dx, dy) { this.yaw -= dx * 0.004; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.3, 1.3); }

  update(dt, keys = {}) {
    if (!this.m) return;
    const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0), tilt = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    this.yaw += turn * dt * 0.9; this.pitch = THREE.MathUtils.clamp(this.pitch + tilt * dt * 0.7, -1.3, 1.3);
    if (!this.done) {
      const r = this.radius(); this.theta += this.h / (r * r) * dt * this.warp;
      if (this.theta >= this.tMax) { this.theta = this.tMax; this.done = true; }
    }
    const pos = this.posAt(this.theta), next = this.posAt(Math.min(this.theta + 0.001, this.tMax + 0.001));
    const fwd = next.clone().sub(pos).normalize();
    // Orion points along its path, heat shield back
    this.orion.position.set(0, 0, 0);
    this.orion.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
    this.orion.userData.body.rotation.z += dt * 0.02;
    // camera direction from yaw/pitch around the travel direction frame
    const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(fwd, up).normalize(), topV = new THREE.Vector3().crossVectors(side, fwd);
    let eye, base;
    if (this.m.view === 'window') { eye = fwd.clone().multiplyScalar(-1.2).addScaledVector(topV, 0.4); base = fwd; }   // inside the crew module
    else {
      // Artemis I-style wing camera: just beyond the tip of one array wing and above its plane, looking back at Orion
      this.orion.updateMatrixWorld(true); const wing = this.orion.userData.body.userData.wings[0];
      eye = new THREE.Vector3(15.5, 5.5, 2.5); wing.localToWorld(eye);
      base = eye.clone().negate().normalize();
    }
    const right = new THREE.Vector3().crossVectors(base, topV); if (right.lengthSq() < 1e-6) right.copy(side); right.normalize();
    const realUp = new THREE.Vector3().crossVectors(right, base).normalize();
    const dir = base.clone().multiplyScalar(Math.cos(this.yaw) * Math.cos(this.pitch)).addScaledVector(right, Math.sin(this.yaw) * Math.cos(this.pitch)).addScaledVector(realUp, Math.sin(this.pitch)).normalize();
    this.frame = { base, right, realUp };
    this.ncam.position.copy(eye); this.ncam.up.copy(realUp); this.ncam.lookAt(eye.clone().add(dir));
    this.camera.position.copy(pos).addScaledVector(eye, 1 / 10000);
    this.camera.quaternion.copy(this.ncam.quaternion);
    this.orion.visible = this.m.view !== 'window';
    this.stars.position.copy(this.camera.position);
    this.sun.position.copy(this.camera.position).addScaledVector(SUN, 120000);
    this.earth.rotation.y += dt * 0.01 * this.warp;
    this.dir = dir; this.pos = pos;
  }

  // Slow cinematic of the Moon with Earth beyond, for the title screen.
  backdrop(t) {
    if (this.exhibit.isOpen) return; // The exhibit renders only on interaction; no second continuous scene.
    const a = -2.5 + t * 0.012, r = 720;
    this.camera.position.set(Math.cos(a) * r, 90 + Math.sin(t * 0.05) * 20, Math.sin(a) * r);
    this.camera.up.set(0, 1, 0); this.camera.lookAt(0, 0, 0);
    this.camera.rotateY(0.38); this.camera.rotateX(0.04);
    this.stars.position.copy(this.camera.position);
    this.sun.position.copy(this.camera.position).addScaledVector(SUN, 120000);
    this.earth.rotation.y = t * 0.01; this.moon.rotation.y = t * 0.004;
    const r2 = this.renderer, size = r2.getSize(new THREE.Vector2());
    this.camera.aspect = size.x / size.y; this.camera.updateProjectionMatrix(); r2.render(this.scene, this.camera);
  }

  render() {
    const r = this.renderer, size = r.getSize(new THREE.Vector2());
    for (const c of [this.camera, this.ncam]) { c.aspect = size.x / size.y; c.updateProjectionMatrix(); }
    r.autoClear = false; r.clear(); r.render(this.scene, this.camera); r.clearDepth(); r.render(this.near, this.ncam); r.autoClear = true;
  }

  // What is in the frame right now (angles in degrees).
  view() {
    const pos = this.pos, dir = this.dir, toE = this.earth.position.clone().sub(pos), toM = pos.clone().negate();
    const dE = toE.length(), dM = toM.length();
    const moonAng = Math.asin(MOON_R / dM) * 180 / Math.PI;
    const sepEM = toE.angleTo(toM) * 180 / Math.PI;
    const earthHidden = sepEM < moonAng && dE > dM;
    return {
      earthOff: dir.angleTo(toE) * 180 / Math.PI, moonOff: dir.angleTo(toM) * 180 / Math.PI, moonAng, sepEM, earthHidden,
      gap: sepEM - moonAng, farSide: pos.x < -MOON_R * 0.5, altKm: (dM - MOON_R) * 10, earthKm: dE * 10,
    };
  }

  // Try to take a photo for the mission's targets. Returns { id, name } of the target hit, or null + reason.
  photo() {
    const v = this.view(), half = this.camera.fov / 2;
    const checks = {
      selfie: v.moonOff < half * 0.9,
      farside: v.farSide && v.moonOff < half * 0.5,
      home: !v.earthHidden && v.earthOff < 6,
      earthset: !v.earthHidden && v.earthOff < 9 && v.gap >= 0 && v.gap < 4,
    };
    const hit = this.m.targets.find(t => !this.photos[t.id] && checks[t.id]);
    if (hit) { this.photos[hit.id] = true; return { hit, v }; }
    let reason = 'Nothing special in the frame yet.';
    if (!this.photos.earthset && this.id === 'artemis2') reason = v.earthHidden ? 'Earth is hidden behind the Moon right now.' : v.gap > 4 ? 'Earthset happens when Earth is right at the Moon\'s edge.' : reason;
    return { hit: null, v, reason };
  }

  snapshot(w = 360) {
    this.render();
    const src = this.renderer.domElement, c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * src.height / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82);
  }
}
