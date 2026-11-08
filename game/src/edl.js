// Entry, descent and landing, the way NASA does it for Mars (Curiosity and Perseverance):
//   cruise stage separates -> hypersonic entry behind a heat shield (about 1,300 C) -> supersonic parachute (21.5 m)
//   -> heat shield drops away -> backshell and parachute cut loose -> rocket descent stage -> sky crane lowers the lander
//   -> touchdown, cables cut, the stage flies away.
// This file builds that sequence as a function of time. cutscenes.js plays it inside the real game.
import * as THREE from 'three';
import { heightAt } from './world.js';

export const EDL_T = 20, LAND = { x: 70, z: -60 };
export const clamp01 = x => Math.max(0, Math.min(1, x)), smooth = x => (x = clamp01(x)) * x * (3 - 2 * x), lerp = (a, b, t) => a + (b - a) * t;
export const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

let puffTex = null, glowTex = null;
export function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), r = seeded(9);
  for (let i = 0; i < 16; i++) {
    const px = 64 + (r() - .5) * 56, py = 64 + (r() - .5) * 56, rad = 22 + r() * 30, g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.6, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  return (puffTex = new THREE.CanvasTexture(c));
}
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (glowTex = new THREE.CanvasTexture(c));
}

// ---------- models (metres) ----------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, metalness: .2, ...o });

// The entry vehicle. Local -Y is the direction of flight: heat shield at the bottom, backshell above, payload inside.
function makeVehicle() {
  const g = new THREE.Group(), shieldG = new THREE.Group(), backG = new THREE.Group();
  const shieldMat = M('#2b221c', { roughness: .95, metalness: 0, side: THREE.DoubleSide, emissive: '#ff5a1a', emissiveIntensity: 0 });
  const sp = [[0, 0], [.35, .015], [.8, .07], [1.3, .2], [1.8, .42], [2.25, .8]].map(([x, y]) => new THREE.Vector2(x, y));
  shieldG.add(new THREE.Mesh(new THREE.LatheGeometry(sp, 56), shieldMat));
  const bp = [[2.25, .8], [2.22, 1.2], [2.0, 2.2], [1.6, 3.4], [1.12, 4.4], [.5, 4.62], [0.001, 4.66]].map(([x, y]) => new THREE.Vector2(x, y));
  backG.add(new THREE.Mesh(new THREE.LatheGeometry(bp, 56), M('#dcd6cc', { side: THREE.DoubleSide, roughness: .55, metalness: .3 })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.25, .045, 8, 64).rotateX(Math.PI / 2), M('#6e6a66')); rim.position.y = .82; backG.add(rim);
  for (let i = 0; i < 8; i++) {   // small thrusters on the backshell
    const a = i * Math.PI / 4 + .39, b = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .26), M('#2d2d30')); b.position.set(Math.cos(a) * 1.72, 2.35, Math.sin(a) * 1.72); b.lookAt(0, 2.35, 0); backG.add(b);
  }
  for (let i = 0; i < 6; i++) { const a = i * 1.047, b = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.0, .08), M('#9a9690')); b.position.set(Math.cos(a) * 1.28, 3.9, Math.sin(a) * 1.28); b.rotation.y = -a; b.rotation.z = .0; backG.add(b); }
  g.add(shieldG, backG); g.userData = { shieldG, shieldMat, backG };
  return g;
}
// The crew lander. Origin is the bottom of its feet. About 3.2 m tall.
function makeLander() {
  const g = new THREE.Group(), white = M('#e9e4da', { roughness: .5, metalness: .25 }), orange = M('#e8602a', { roughness: .6 }), dark = M('#2b2d33', { roughness: .5, metalness: .5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.55, 1.2, 28), white); body.position.y = 1.5; g.add(body);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(.85, 1.5, 1.0, 28), white); cone.position.y = 2.6; g.add(cone);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.55, .85, .2, 28), dark); cap.position.y = 3.2; g.add(cap);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.3, .3, 28), dark); under.position.y = .75; g.add(under);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.52, .05, 8, 40).rotateX(Math.PI / 2), orange); band.position.y = 1.25; g.add(band);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4, w = new THREE.Mesh(new THREE.BoxGeometry(.42, .3, .1), M('#14161b', { emissive: '#ffd89a', emissiveIntensity: .35, roughness: .2 })); w.position.set(Math.cos(a) * 1.18, 2.35, Math.sin(a) * 1.18); w.lookAt(0, 2.35, 0); w.rotateY(Math.PI); g.add(w); }
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.0, .1), M('#8fe3b0', { emissive: '#35c58a', emissiveIntensity: .5 })); hatch.position.set(1.54, 1.55, 0); hatch.rotation.y = Math.PI / 2; g.add(hatch);
  const legs = []; for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, pv = new THREE.Group(); pv.position.set(Math.cos(a) * 1.25, 1.1, Math.sin(a) * 1.25); pv.rotation.order = 'YXZ'; pv.rotation.y = -a + Math.PI / 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.3, .22), dark); leg.position.y = -.62; const foot = new THREE.Mesh(new THREE.CylinderGeometry(.34, .4, .1, 14), dark); foot.position.y = -1.27; pv.add(leg, foot); g.add(pv); legs.push(pv);
  }
  g.userData.setLegs = k => legs.forEach(p => { p.rotation.x = smooth(k) * .75; p.position.y = 1.1; });   // folded up -> splayed out
  g.userData.setLegs(1); return g;
}

// Soft rocket plume texture: bright at the nozzle, fading to nothing at the tip (no hard edges).
let _plume; function plumeTexture() { if (_plume) return _plume; const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(.12, 'rgba(255,236,190,.95)'); g.addColorStop(.4, 'rgba(255,170,90,.5)'); g.addColorStop(.75, 'rgba(230,100,50,.16)'); g.addColorStop(1, 'rgba(200,70,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 8, 128); _plume = new THREE.CanvasTexture(c); _plume.colorSpace = THREE.SRGBColorSpace; return _plume; }
// The rocket-powered descent stage with eight throttleable engines.
function makeStage() {
  const g = new THREE.Group(), grey = M('#9aa0a6', { metalness: .6, roughness: .45 }), dk = M('#3a3b40', { metalness: .6, roughness: .5 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .3, 8), grey); g.add(plate);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, .5, 8), dk); top.position.y = .35; g.add(top);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .39, t = new THREE.Mesh(new THREE.SphereGeometry(.4, 14, 10), M('#c8b46a', { metalness: .7, roughness: .35 })); t.position.set(Math.cos(a) * .75, .4, Math.sin(a) * .75); g.add(t); }
  const flames = [], outer = new THREE.MeshBasicMaterial({ map: plumeTexture(), color: '#ffc27a', transparent: true, opacity: .55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), core = new THREE.MeshBasicMaterial({ map: plumeTexture(), color: '#ffffff', transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + .39, pv = new THREE.Group(); pv.position.set(Math.cos(a) * 1.05, -.1, Math.sin(a) * 1.05); pv.rotation.order = 'YXZ'; pv.rotation.y = -a + Math.PI / 2; pv.rotation.x = -.35;   // canted outward
    const n = new THREE.Mesh(new THREE.CylinderGeometry(.1, .27, .6, 12, 1, true), dk); n.position.y = -.25; pv.add(n);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(.16, .5, 1, 16, 1, true).translate(0, -.5, 0), outer), c = new THREE.Mesh(new THREE.CylinderGeometry(.07, .2, 1, 12, 1, true).translate(0, -.5, 0), core); o.position.y = c.position.y = -.55; pv.add(o, c); g.add(pv); flames.push(o, c);
  }
  const light = new THREE.PointLight('#ffb070', 0, 70, 2); light.position.y = -1.2; g.add(light);
  g.userData.fire = (k, t) => { const f = 1 + .08 * Math.sin(t * 70) + .05 * Math.sin(t * 113); flames.forEach((m, i) => { m.visible = k > .02; m.scale.set(1, (i & 1 ? 1.8 : 5.4) * k * f, 1); }); light.intensity = k * 380 * f; };
  g.userData.fire(0, 0); return g;
}
// The 21.5 m supersonic parachute: a dome with orange and white wedges and a bundle of suspension lines.
function makeChute(r) {
  const R = 10.75, H = 6.2, g = new THREE.Group(), pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * H)); }
  const c = document.createElement('canvas'); c.width = 512; c.height = 8; const x = c.getContext('2d'); x.fillStyle = '#f4efe6'; x.fillRect(0, 0, 512, 8);
  for (let i = 0; i < 48; i++) { x.fillStyle = r() > .45 ? '#e4572a' : '#f4efe6'; x.fillRect(i * (512 / 48), 0, 512 / 48, 8); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  const canopy = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .9, metalness: 0, emissive: '#3a2a22', emissiveIntensity: .35 }));
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d8cdb8', fog: false })); lines.frustumCulled = false;
  const N = 48, pos = new Float32Array(N * 6); lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(canopy, lines);
  // k: how far it has inflated (0..1), len: the line length. Canopy rim sits at y = len above the vehicle's top.
  g.userData.set = (k, len, t) => {
    const rs = lerp(.16, 1, k) * (1 + .02 * Math.sin(t * 6)), hs = lerp(.32, 1, k) * (1 + .03 * Math.sin(t * 4 + 1));
    canopy.scale.set(rs, hs, rs); canopy.position.y = len;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pos.set([Math.cos(a) * R * rs, len, Math.sin(a) * R * rs, 0, 0, 0], i * 6); }
    lines.geometry.attributes.position.needsUpdate = true;
  };
  return g;
}
function makeCruise() {
  const g = new THREE.Group(), gr = M('#8e949b', { metalness: .6, roughness: .45 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, .45, 40), gr); g.add(ring);
  const sol = new THREE.Mesh(new THREE.RingGeometry(1.95, 3.2, 48, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1b2a55', emissive: '#142a6a', emissiveIntensity: .5, roughness: .3, metalness: .5, side: THREE.DoubleSide })); sol.position.y = .25; g.add(sol);
  for (let i = 0; i < 3; i++) { const a = i * 2.09, t = new THREE.Mesh(new THREE.SphereGeometry(.5, 14, 10), M('#c8b46a', { metalness: .7 })); t.position.set(Math.cos(a) * 1.2, .7, Math.sin(a) * 1.2); g.add(t); }
  const d = new THREE.Mesh(new THREE.SphereGeometry(.6, 16, 8, 0, Math.PI * 2, 0, 1.2), M('#d0d0d0')); d.position.set(0, .5, 0); g.add(d);
  return g;
}
function marsTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'), r = seeded(21);
  x.fillStyle = '#b4693f'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 380; i++) { const px = r() * 1024, py = 40 + r() * 430, rad = 8 + r() * 70, g = x.createRadialGradient(px, py, 0, px, py, rad), dark = r() > .45; g.addColorStop(0, dark ? 'rgba(88,48,36,.5)' : 'rgba(232,170,118,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  const gp = x.createLinearGradient(0, 0, 0, 512); gp.addColorStop(0, 'rgba(245,240,235,.95)'); gp.addColorStop(.07, 'rgba(245,240,235,0)'); gp.addColorStop(.93, 'rgba(245,240,235,0)'); gp.addColorStop(1, 'rgba(245,240,235,.95)'); x.fillStyle = gp; x.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
function skyDome() {
  const u = { uTop: { value: new THREE.Color('#8c6a74') }, uHor: { value: new THREE.Color('#e6b08e') } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(60000, 24, 12), new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vD; uniform vec3 uTop, uHor; void main(){ float h = normalize(vD).y; vec3 c = mix(uHor, uTop, pow(clamp(h, 0., 1.), .5)); c = mix(c, uHor * .85, smoothstep(0., -.3, h)); gl_FragColor = vec4(pow(c, vec3(1. / 2.2)), 1.); }' }));
  m.userData.u = u; return m;
}

// ---------- the sequence ----------
const TH = 1.27;   // entry attitude: the heat shield points along the flight path
const PH = { sep: 12.85, cut: 17.7, shield: 10.4, hover: 12, touch: 17.2 };
export function createEDL(world) {
  const scene = world.scene, cam = world.camera, r = seeded(63), gp = heightAt(LAND.x, LAND.z), S = new THREE.Vector3(0, 40000, 0);
  const saved = { far: cam.far, bg: scene.background, skyV: world.sky.visible, terV: world.terrain.visible };
  cam.far = 150000; cam.updateProjectionMatrix();
  const old = world.lander?.group; if (old) old.visible = false;   // a replay: hide the parked lander while the new one comes down
  const own = [];   const add = (...o) => { o.forEach(x => { scene.add(x); own.push(x); }); return o[0]; };
  // space set: stars, Mars, atmosphere, own sky for the parachute shot
  const R = 3389, starsG = new THREE.BufferGeometry(), sp = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) { const a = r() * 6.283, b = Math.acos(2 * r() - 1); sp.set([Math.sin(b) * Math.cos(a) * 30000, Math.cos(b) * 30000, Math.sin(b) * Math.sin(a) * 30000], i * 3); }
  starsG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = add(new THREE.Points(starsG, new THREE.PointsMaterial({ color: '#ffffff', size: 40, sizeAttenuation: true, fog: false, transparent: true, opacity: .9 })));
  const mars = add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: marsTexture(), roughness: 1, metalness: 0, fog: false, emissive: '#2a1208', emissiveIntensity: .25 })));
  const atmo = add(new THREE.Mesh(new THREE.SphereGeometry(R + 70, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
    vertexShader: 'varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position, 1.); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
    fragmentShader: 'varying vec3 vN, vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.2); gl_FragColor = vec4(vec3(1., .55, .32) * f * 1.5, f); }' })));
  const dome = add(skyDome());
  // the vehicle and what it carries
  const veh = add(makeVehicle()), cruise = add(makeCruise()), payload = new THREE.Group(), stage = makeStage(), lander = makeLander(), chute = makeChute(r);
  payload.add(stage, lander); stage.position.y = 3.7; veh.add(payload); veh.add(chute);
  const bridle = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#cfcfcf', fog: false })); bridle.frustumCulled = false; bridle.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3)); payload.add(bridle);
  const shieldHolder = new THREE.Group(); // lets the heat shield fall away on its own
  const glow = tint => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); return s; };
  // plasma around the heat shield (children of the vehicle, so they follow its attitude)
  const plasma = new THREE.Group(); veh.add(plasma);
  const front = glow('#ffd9a8'), mid = glow('#ff8a3a'), wake = Array.from({ length: 30 }, () => glow('#ff6a20')); plasma.add(front, mid, ...wake);
  const EN = 280, ep = new Float32Array(EN * 3), eseed = new Float32Array(EN * 3); for (let i = 0; i < EN * 3; i++) eseed[i] = r();
  const embers = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ep, 3)), new THREE.PointsMaterial({ map: glowTexture(), color: '#ffb060', size: .38, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); embers.frustumCulled = false; plasma.add(embers);
  const LN = 110, lp = new Float32Array(LN * 6), lseed = new Float32Array(LN * 4); for (let i = 0; i < LN * 4; i++) lseed[i] = r();
  const streaks = add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: '#ffc8a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false }))); streaks.frustumCulled = false;
  const heatLight = new THREE.PointLight('#ff7a30', 0, 60, 1.6); veh.add(heatLight);
  const flash = glow('#fff0d0'); add(flash);
  const sepStage = add(new THREE.Group());   // holds the heat shield once it falls away
  // landing-site props: pad, dust
  const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 40).translate(0, -1, 0), new THREE.MeshStandardMaterial({ color: '#5b4538', roughness: 1 }))); pad.position.set(LAND.x, gp + .1, LAND.z);
  const dust = [], tex = puffTexture();
  for (let i = 0; i < 150; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#c9966c', transparent: true, depthWrite: false, fog: false, opacity: 0 })); s.userData = { a: r() * 6.283, v: 8 + r() * 18, tb: 14.6 + r() * 3.4, rot: r() * 6, sz: 4 + r() * 6, lift: 1 + r() * 4 }; add(s); dust.push(s); }

  // where the descent stage is (world coords) from t = 12.4 on
  const stagePos = t => {
    const u = clamp01((t - 12.4) / 3.0), e = 1 - Math.pow(1 - u, 2.2), A = t < PH.cut ? lerp(165, PH.hover, e) : PH.hover + 4.5 * Math.pow(t - PH.cut, 2);
    const k = 1 - smooth((t - 12.4) / 3.0), dx = t < PH.cut ? 0 : 3.2 * Math.pow(t - PH.cut, 2), sway = t > 15 && t < PH.cut ? Math.sin(t * 2.2) * .12 : 0;
    return new THREE.Vector3(LAND.x - 34 * k + dx + sway, gp + A, LAND.z + 24 * k + sway);
  };
  const tmpV = new THREE.Vector3(), tmpC = new THREE.Vector3();
  const place = (o, p) => o.position.copy(p);
  const frame = t => {
    const shot = t < 3.8 ? 0 : t < 8 ? 1 : t < 12.4 ? 2 : 3, space = shot < 2, chuteShot = shot === 2, real = shot === 3;
    // what is visible in each shot
    world.sky.visible = real; world.terrain.visible = real; scene.background = space ? new THREE.Color('#000000') : null;
    stars.visible = shot < 2; mars.visible = space; atmo.visible = space; dome.visible = chuteShot; pad.visible = real;
    dome.position.copy(cam.position); stars.position.copy(cam.position);
    const flight = new THREE.Vector3(Math.sin(TH), -Math.cos(TH), 0);
    // ---------- the vehicle ----------
    const reo = smooth((t - 2.2) / 1.6), I = t > 3.8 && t < 8.0 ? Math.pow(Math.sin(Math.PI * clamp01((t - 3.9) / 4.0)), .9) : 0;   // heating
    if (shot < 2) { veh.position.copy(S); veh.rotation.set(0, t * .35, reo * TH); }
    else if (chuteShot) { veh.position.copy(S); veh.rotation.set(Math.sin(t * 1.3) * .03, 0, Math.sin(t * .9) * .05); }
    else { const p0 = stagePos(Math.min(t, PH.sep)), dt = Math.max(0, t - PH.sep);   // backshell and chute drift away after they cut loose
      veh.position.set(p0.x + 7 * dt, p0.y - 3.7 - 9 * dt - 2.6 * dt * dt, p0.z - 3 * dt); veh.rotation.set(0, 0, -.22 * dt); }
    // payload: inside the vehicle until the backshell separates, then it is the free flying stage + lander
    const free = real && t >= PH.sep;
    if (free) { if (payload.parent !== scene) scene.add(payload); const sp_ = stagePos(t); payload.position.set(sp_.x, sp_.y - 3.7, sp_.z); payload.rotation.set(Math.sin(t * 1.6) * .015, 0, t > PH.cut ? -.45 * smooth((t - PH.cut) / 1.2) : Math.sin(t * 1.1) * .01); }
    else { if (payload.parent !== veh) veh.add(payload); payload.position.set(0, 0, 0); payload.rotation.set(0, 0, 0); }
    // lander: legs, cable length
    const hoverA = PH.hover, Lmax = hoverA - 3.35, L = t < 15.3 ? .05 : lerp(.05, Lmax, smooth((t - 15.3) / (PH.touch - 15.3)));
    lander.userData.setLegs(clamp01((t - 13.0) / 1.0));
    lander.position.set(0, .35 - L, 0);
    const released = t >= PH.cut;
    if (released) { if (lander.parent !== scene) scene.add(lander); lander.position.set(LAND.x, gp, LAND.z); lander.rotation.set(0, 0, 0); }
    else if (lander.parent !== payload) { payload.add(lander); lander.rotation.set(0, 0, 0); }
    // heat shield falls away at 10.4 s
    const shieldG = veh.userData.shieldG, shieldMat = veh.userData.shieldMat;
    if (t >= PH.shield) {
      const dt = t - PH.shield; if (shieldG.parent !== sepStage) sepStage.add(shieldG);
      shieldG.position.set(S.x + dt * 2.2, S.y - (dt * dt * 11 + dt * 3), S.z); shieldG.rotation.set(dt * 1.7, dt * .6, dt * 2.3); shieldG.visible = chuteShot;
    } else { if (shieldG.parent !== veh) veh.add(shieldG); shieldG.position.set(0, 0, 0); shieldG.rotation.set(0, 0, 0); shieldG.visible = true; }
    shieldMat.emissiveIntensity = I * 2.2;
    // ---------- cruise stage ----------
    cruise.visible = t < 4.6 && t >= 0;
    const cs = smooth((t - .9) / 2.6);
    cruise.position.set(S.x + cs * 4.5, S.y + 5.3 + cs * 7, S.z + cs * 2); cruise.rotation.set(cs * .5 + t * .1, t * .35, cs * .3);
    if (t < .9) cruise.position.set(S.x, S.y + 5.3 + (t / .9) * .1, S.z);
    // ---------- Mars, below the vehicle ----------
    const alt = lerp(430, 150, smooth(t / 8)); mars.position.set(S.x, S.y - R - alt, S.z); mars.rotation.y = t * .01; atmo.position.copy(mars.position);
    // ---------- plasma and sparks ----------
    plasma.visible = I > .01; heatLight.intensity = I * 600;
    if (plasma.visible) {
      front.position.set(0, -1.1, 0); front.scale.setScalar(7 * I + .01); front.material.opacity = I * .95;
      mid.position.set(0, -.2, 0); mid.scale.setScalar(16 * I + .01); mid.material.opacity = I * .5;
      wake.forEach((s, j) => { s.position.set(Math.sin(t * 17 + j * 2.1) * .35, 1.5 + j * 1.15, Math.cos(t * 13 + j * 1.7) * .35); s.scale.setScalar((4.5 + j * .35) * I + .01); s.material.opacity = I * Math.max(0, .55 - j * .017); s.material.color.set(j < 8 ? '#ffc890' : '#ff6a20'); });
      embers.material.opacity = I * .9;
      for (let i = 0; i < EN; i++) { const a = eseed[i * 3], b = eseed[i * 3 + 1], c = eseed[i * 3 + 2], y = 1 + ((c * 34 + t * 42) % 34), sp_ = .6 + y * .1; ep[i * 3] = Math.cos(a * 6.283) * sp_ * b; ep[i * 3 + 1] = y; ep[i * 3 + 2] = Math.sin(a * 6.283) * sp_ * b; }
      embers.geometry.attributes.position.needsUpdate = true;
    }
    // streaks of air rushing past, relative to the flight direction
    streaks.visible = shot === 1; streaks.material.opacity = I * .5;
    if (streaks.visible) for (let i = 0; i < LN; i++) { const a = lseed[i * 4] * 6.283, rd = 5 + lseed[i * 4 + 1] * 30, off = ((lseed[i * 4 + 2] * 120 + t * 160) % 120) - 60;
      const base = tmpV.set(S.x + Math.cos(a) * rd * .4, S.y + (lseed[i * 4 + 3] - .5) * 24, S.z + Math.sin(a) * rd), dx = -flight.x, dy = -flight.y;
      lp.set([base.x + dx * off, base.y + dy * off, base.z, base.x + dx * (off + 7), base.y + dy * (off + 7), base.z], i * 6); }
    if (streaks.visible) streaks.geometry.attributes.position.needsUpdate = true;
    // ---------- parachute ----------
    chute.visible = t >= 8.0 && (chuteShot || (real && t < PH.sep + 6)); veh.visible = space || chuteShot || (real && t < PH.sep + 6);
    if (chute.visible) { chute.position.set(0, 4.6, 0); chute.userData.set(smooth((t - 8.05) / .9), 27, t); }
    // bridles from the stage to the lander top (the sky crane cables)
    const bp = bridle.geometry.attributes.position.array, topY = .35 - L + 3.2;
    bridle.visible = t < PH.cut && L > .2 && free;
    if (bridle.visible) for (let i = 0; i < 3; i++) { const a = i * 2.094 + .5; bp.set([Math.cos(a) * .85, 3.7 - .15, Math.sin(a) * .85, Math.cos(a) * .45, topY, Math.sin(a) * .45], i * 6); bridle.geometry.attributes.position.needsUpdate = true; }
    // ---------- descent engines ----------
    const burn = real ? (t < 12.4 ? 0 : t < PH.sep - .1 ? smooth((t - 12.45) / .35) : t < PH.cut ? 1 : 1) : 0;
    stage.userData.fire(free ? burn * (t < PH.cut ? .85 + .15 * smooth((t - 15) / 1) : 1) : 0, t);
    // ---------- dust from the engines ----------
    const sA = stagePos(t).y - gp, gate = free ? smooth((60 - sA) / 40) : 0;
    for (const s of dust) { const d = s.userData, age = t - d.tb; if (age < 0 || !real) { s.material.opacity = 0; continue; }
      const rad = 4 + d.v * 1.5 * (1 - Math.exp(-age / 2.6)), grow = d.sz * .6 + age * 1.3;
      s.position.set(LAND.x + Math.cos(d.a) * rad, gp + 1.2 + d.lift * (1 - Math.exp(-age / 2.2)), LAND.z + Math.sin(d.a) * rad); s.scale.set(grow, grow * .65, 1); s.material.rotation = d.rot + age * .1;
      const lift = t > PH.cut ? 1 - smooth((t - PH.cut - .6) / 1.6) * .7 : 1;
      s.material.opacity = .11 * Math.max(gate, .0) * smooth(age * 1.5) * Math.max(0, 1 - age / 7) * lift; const lit = .85 + .1 * Math.sin(d.a); s.material.color.setRGB(.5 * lit, .3 * lit, .18 * lit); }
    // flash when the shield is thrown off
    const fl = Math.max(0, 1 - Math.abs(t - PH.shield - .08) / .18); flash.visible = fl > .01; flash.position.copy(veh.position).add(tmpC.set(0, 0, 0)); flash.scale.setScalar(14 * fl + .01); flash.material.opacity = fl * .9;
    // ---------- cameras ----------
    cam.fov = 46;
    if (shot === 0) { const a = .8 + t * .13; cam.position.set(S.x + Math.sin(a) * 15, S.y + 2.2, S.z + Math.cos(a) * 15); cam.lookAt(S.x, S.y - 1.2 + cs * 3, S.z); cam.fov = 44; }
    else if (shot === 1) { const k = (t - 3.8) / 4.2; cam.position.set(S.x - 2.5 + Math.sin(t * .5) * 1.2, S.y + 1.8 + k * .8, S.z + 13.5 - k * 1.5); cam.lookAt(S.x + 2.2, S.y - .9, S.z); cam.fov = 48 + I * 3;
      cam.position.x += Math.sin(t * 47) * .03 * I; cam.position.y += Math.sin(t * 53) * .03 * I; }
    else if (shot === 2) { const k = (t - 8) / 4.4, a = .6 + k * .5; cam.position.set(S.x + Math.sin(a) * 44, S.y - 5 + k * 3, S.z + Math.cos(a) * 44); cam.lookAt(S.x, S.y + 15 + k * 2, S.z); cam.fov = 50; }
    else if (t < 15.4) { const sp_ = stagePos(t); cam.position.set(LAND.x - 64, gp + 2.2, LAND.z + 50); tmpC.copy(sp_); tmpC.y = Math.max(tmpC.y - 2, gp + 6); cam.lookAt(tmpC); cam.fov = 44; }
    else if (t < 17.9) { const k = (t - 15.4) / 2.5; cam.position.set(LAND.x + 21 - k * 3, heightAt(LAND.x + 21, LAND.z + 24) + 3.4, LAND.z + 25 - k * 2); cam.lookAt(LAND.x, gp + 6.5, LAND.z); cam.fov = 50; }
    else { const k = smooth((t - 18.8) / 1.2), sp_ = stagePos(t); cam.position.set(LAND.x + 20, heightAt(LAND.x + 20, LAND.z + 26) + 3.4, LAND.z + 28); tmpC.copy(sp_).lerp(tmpV.set(LAND.x, gp + 4, LAND.z), k); cam.lookAt(tmpC); cam.fov = 48; }
    return 0;
  };
  return { frame, dispose: () => {
    cam.far = saved.far; cam.updateProjectionMatrix(); scene.background = saved.bg; world.sky.visible = saved.skyV; world.terrain.visible = saved.terV;
    frame(EDL_T); if (old) scene.remove(old);
    lander.userData.setLegs(1);
    own.forEach(o => { if (o !== pad) scene.remove(o); }); payload.parent?.remove(payload);
    world.lander = { group: lander }; world.lander.group.parent !== scene && scene.add(lander); lander.position.set(LAND.x, gp, LAND.z);
    if (!world._landerCol) { world._landerCol = true; world.colliders?.push({ x: LAND.x, z: LAND.z, r: 3 }); }
  } };
}

// A parked lander on the landing pad (loaded saves, and kept after the cutscene).
export function placeLander(world) {
  if (world.lander) return;
  const gp = heightAt(LAND.x, LAND.z), lander = makeLander(); lander.position.set(LAND.x, gp, LAND.z);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 40).translate(0, -1, 0), new THREE.MeshStandardMaterial({ color: '#5b4538', roughness: 1 })); pad.position.set(LAND.x, gp + .1, LAND.z);
  world.scene.add(lander, pad); world.lander = { group: lander };
  if (!world._landerCol) { world._landerCol = true; world.colliders?.push({ x: LAND.x, z: LAND.z, r: 3 }); }
}
