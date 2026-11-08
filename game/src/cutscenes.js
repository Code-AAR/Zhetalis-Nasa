// Two cutscenes in the style of open-world games:
//   playStorm()   a wall of dust rolls across Gusev crater and swallows the outpost.
//   playLanding() a Starship comes down through the sky, flips, burns and lands near the outpost.
// Both play inside the real game scene (the real outpost, ground, sky and light): the cutscene just takes over the camera
// and adds a few props (dust wall, Starship). Click, Space or Esc skips. Each resolves when it ends.
// With { manual: true } they return a handle ({ setTime, total, dispose }) so a test can step through the frames.
import * as THREE from 'three';
import { heightAt, rockGeometry } from './world.js';

const clamp01 = x => Math.max(0, Math.min(1, x)), smooth = x => (x = clamp01(x)) * x * (3 - 2 * x), lerp = (a, b, t) => a + (b - a) * t;
const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- shared pieces ----------
let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = seeded(9); x.scale(2,2);
  for (let i = 0; i < 16; i++) {
    const px = 64 + (r() - .5) * 56, py = 64 + (r() - .5) * 56, rad = 22 + r() * 30, g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.6, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  puffTex = new THREE.CanvasTexture(c); return puffTex;
}
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
// ================= the storm =================
const STORM_T = 12.6, wallZ = t => -430 + 560 * Math.pow(t / STORM_T, 1.3);
function createStorm(world) {
  const scene = world.scene, cam = world.camera, fog0 = scene.fog && { c: scene.fog.color.clone(), n: scene.fog.near, f: scene.fog.far }, r = seeded(31), gy = heightAt(0, 0);
  const tex = puffTexture(), puffs = [];
  for (let i = 0; i < 320; i++) {
    const front = i < 100, dz = front ? -r() * 26 : -Math.pow(r(), 1.5) * 190, hgt = front ? r() * r() * 85 : Math.pow(r(), 1.3) * 110;
    const mat = new THREE.SpriteMaterial({ map: tex, color: '#a8643a', transparent: true, depthWrite: false, fog: false, opacity: .6 });
    const sp = new THREE.Sprite(mat); sp.userData = { x: (r() - .5) * 900, dz, hgt, s: front ? 50 + r() * 50 : 55 + r() * 80 + hgt * .4, rot: r() * 6, spin: (r() - .5) * .3, ph: r() * 6, deep: -dz / 190, front };
    scene.add(sp); puffs.push(sp);
  }
  // wind-blown grit around the camera
  const N = 2200, pp = new Float32Array(N * 3), seed = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) seed[i] = r();
  const grit = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pp, 3)), new THREE.PointsMaterial({ map: glowTexture(), color: '#e0a070', size: .09, alphaTest: .02, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false }));
  grit.frustumCulled = false; scene.add(grit);
  let tint = 0;
  const frame = t => {
    const wz = wallZ(t), shot = t < 4.2 ? 0 : t < 7.7 ? 1 : 2;
    // camera
    if (shot === 0) { const k = t / 4.2; cam.position.set(lerp(46, 30, k), gy + 2.1, lerp(66, 56, k)); cam.lookAt(lerp(8, 2, k), gy + lerp(14, 11, k), -80); cam.fov = 42; }
    else if (shot === 1) { const k = (t - 4.2) / 3.5; cam.position.set(lerp(210, 160, k), 72 - k * 14, wz + 110); cam.lookAt(10, 20, wz - 30); cam.fov = 52; }
    else { const k = (t - 7.7) / (STORM_T - 7.7), sh = smooth((t - 9.6) / 2) * .22; cam.position.set(9 + Math.sin(t * 31) * sh, gy + 2.3 + Math.sin(t * 27) * sh, 47); cam.lookAt(0, gy + lerp(8, 12, k), -30); cam.fov = 58; }
    cam.updateProjectionMatrix();
    // the wall
    const dist = cam.position.z - wz, near = smooth(1 - clamp01(dist / 180)), inside = smooth(clamp01(-dist / 40));
    for (const s of puffs) {
      const d = s.userData, z = wz + d.dz, x = d.x, y = heightAt(clamp(x, -300, 300), clamp(z, -300, 300)) + d.hgt * (.75 + .25 * Math.sin(t * .8 + d.ph));
      s.position.set(x, y + d.s * .25, z); const sc = d.s * (1 + .06 * Math.sin(t * 1.3 + d.ph)); s.scale.set(sc, sc * .8, 1); s.material.rotation = d.rot + t * d.spin;
      const lit = clamp01(.95 - d.deep * .55 + d.hgt / 260); s.material.color.setRGB(.2 * lit + .03, .085 * lit + .012, .04 * lit + .006);
      s.material.opacity = (d.front ? .72 : .55) * (z > 400 ? 0 : 1);
    }
    // sky and light turn brown as the front gets near
    const sto = clamp01(smooth((t - 2) / 8) * .6 + near * .5 + inside);
    scene.fog.color.copy(fog0.c).lerp(new THREE.Color('#9a6a48'), sto * .8); scene.fog.near = lerp(fog0.n, 4, near * .6 + inside * .4); scene.fog.far = lerp(fog0.f, 70, Math.max(near * .55, inside));
    tint = sto * .4;
    // grit streams across the camera
    const att = clamp01((t - 3) / 8) * (.25 + near * .75); grit.material.opacity = att * .8;
    for (let i = 0; i < N; i++) { const a = seed[i * 3], b = seed[i * 3 + 1], c = seed[i * 3 + 2]; pp[i * 3] = cam.position.x + (a - .5) * 260; pp[i * 3 + 1] = gy + b * 34 + Math.sin(t * 2 + c * 9) * .4; pp[i * 3 + 2] = cam.position.z + ((((c * 360 + t * 70) % 360) + 360) % 360) - 260; }
    grit.geometry.attributes.position.needsUpdate = true; if (shot === 1) grit.material.opacity *= .3;
    return tint;
  };
  return { frame, dispose: () => { puffs.forEach(s => { scene.remove(s); s.material.dispose(); }); scene.remove(grit); grit.geometry.dispose(); scene.fog.color.copy(fog0.c); scene.fog.near = fog0.n; scene.fog.far = fog0.f; } };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ================= the starship =================
const SHIP_H = 50, SHIP_R = 4.5, LAND = { x: 70, z: -60 };
function makeShip() {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.position.y = -SHIP_H / 2; g.add(inner);
  const prof = []; for (let y = 0; y <= 36; y += 6) prof.push(new THREE.Vector2(SHIP_R, y));
  for (let i = 1; i <= 28; i++) { const k = i / 28, y = 36 + k * 14; prof.push(new THREE.Vector2(SHIP_R * Math.sqrt(Math.max(0, 1 - Math.pow(k, 1.9))), y)); }
  const steel = new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: .55, roughness: .4 }), tile = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: .85, metalness: .1 });
  inner.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), steel));
  const half = prof.map(p => new THREE.Vector2(p.x + .06, p.y)); inner.add(new THREE.Mesh(new THREE.LatheGeometry(half, 48, -Math.PI * .3, Math.PI * .6), tile));
  for (const y of [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(SHIP_R + .03, .05, 10, 96).rotateX(Math.PI / 2), steel); ring.position.y = y; inner.add(ring); }
  const flapGeo = (wd, ln) => new THREE.BoxGeometry(wd, ln, .35);
  const flaps = [];
  for (const [y, wd, ln, hinge] of [[42, 3.6, 7.5, 1], [9.5, 5.2, 11, -1]]) for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * (SHIP_R + .1), y, -.2); const f = new THREE.Mesh(flapGeo(wd, ln), tile); f.position.set(s * wd / 2, hinge * -ln * .15, 0); pv.add(f); inner.add(pv); flaps.push({ pv, s, hinge });
  }
  const motor = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: .8, roughness: .5 });
  const flames = new THREE.Group(), outer = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), core = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const engines = [[0, 0], ...[0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * 1.047) * 2.4, Math.sin(i * 1.047) * 2.4])];
  for (const [ex, ez] of engines) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(.55, .95, 1.4, 32, 1, true), motor); n.position.set(ex, .1, ez); inner.add(n);
    const o = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1, 14, 1, true).translate(0, -.5, 0), outer), c = new THREE.Mesh(new THREE.ConeGeometry(.55, 1, 12, 1, true).translate(0, -.5, 0), core); o.position.set(ex, 0, ez); c.position.set(ex, 0, ez); flames.add(o, c);
  }
  inner.add(flames);
  const legs = []; for (let i = 0; i < 6; i++) { const a = i * 1.047 + .52, pv = new THREE.Group(); pv.position.set(Math.cos(a) * (SHIP_R - .4), 4, Math.sin(a) * (SHIP_R - .4)); pv.rotation.order = 'YXZ'; pv.rotation.y = -a + Math.PI / 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.5, 9.5, .6), steel); leg.position.y = -4.4; const foot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, .25, 32), steel); foot.position.y = -9.5; pv.add(leg, foot); inner.add(pv); legs.push(pv); }
  const light = new THREE.PointLight('#ff9040', 0, 160, 1.2); light.position.set(0, -4, 0); g.add(light);
  const setFlame = (k, t) => { const fl = 1 + .1 * Math.sin(t * 60) + .06 * Math.sin(t * 97); flames.visible = k > .01; flames.children.forEach((m, i) => { const core_ = i & 1; m.scale.set(k * (core_ ? 1.1 : 1.7), (core_ ? 20 : 42) * k * fl, k * (core_ ? 1.1 : 1.7)); }); light.intensity = k * 900 * fl; };
  const setLegs = k => legs.forEach(p => { p.rotation.x = smooth(k) * .62; });
  const setFlaps = (a, k) => flaps.forEach(f => { f.pv.rotation.z = f.s * -(f.hinge > 0 ? .2 : .1) * a + f.s * k * .25; f.pv.rotation.x = 0; });
  return { group: g, setFlame, setLegs, setFlaps };
}
const LAND_T = 16;
function createLanding(world) {
  const scene = world.scene, cam = world.camera, r = seeded(63);
  const ship = makeShip(); scene.add(ship.group); const gp = heightAt(LAND.x, LAND.z), restY = gp + SHIP_H / 2 + 5.4;
  const pad = new THREE.Mesh(new THREE.CircleGeometry(15, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5b4538', roughness: 1 })); pad.position.set(LAND.x, gp + .12, LAND.z); scene.add(pad);
  const glow = tint => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); scene.add(s); return s; };
  const plasma = glow('#ff7a2a'), halo = glow('#ffc890'), trail = Array.from({ length: 16 }, () => glow('#ff6a20'));
  const dust = [], tex = puffTexture();
  for (let i = 0; i < 170; i++) { const mat = new THREE.SpriteMaterial({ map: tex, color: '#c9966c', transparent: true, depthWrite: false, fog: false, opacity: 0 }); const s = new THREE.Sprite(mat); s.userData = { a: r() * 6.283, v: 12 + r() * 30, tb: 10 + r() * 3.4, rot: r() * 6, sz: 10 + r() * 14, lift: 2 + r() * 9 }; scene.add(s); dust.push(s); }
  // ship path (centre position) and attitude
  const pos = t => {
    if (t < 8.4) { const k = t / 8.4, e = k; return new THREE.Vector3(lerp(-260, 58, e), lerp(330, gp + 130, Math.pow(e, 1.15)), lerp(-190, LAND.z + 6, e)); }
    const k = smooth((t - 8.4) / 3.85), kk = 1 - Math.pow(1 - clamp01((t - 8.4) / 3.85), 1.8);
    return new THREE.Vector3(lerp(58, LAND.x, k), lerp(gp + 130, restY, kk), lerp(LAND.z + 6, LAND.z, k));
  };
  const flip = t => smooth((t - 5.0) / 2.3), thrust = t => t < 6.7 ? 0 : t < 7.4 ? smooth((t - 6.7) / .7) : t < 12.25 ? 1 : 1 - smooth((t - 12.25) / .9);
  const frame = t => {
    const p = pos(t), f = flip(t), a = lerp(1.46, 0, f);
    ship.group.position.copy(p); ship.group.rotation.set(a, lerp(1.2, Math.PI, f), 0, 'YXZ');
    const th = thrust(t); ship.setFlame(th, t); ship.setLegs(clamp01((t - 8.6) / 1)); ship.setFlaps(1 - f, 0);
    const touch = t > 12.2 ? smooth((t - 12.2) / .5) : 0; ship.group.position.y -= Math.sin(touch * Math.PI) * .35 * (t < 13 ? 1 : 0);
    // reentry glow under the belly
    const ent = (1 - smooth((t - 3.6) / 2.2)) * (t < 6 ? 1 : 0), belly = new THREE.Vector3(0, -6, 0).applyEuler(ship.group.rotation);
    plasma.position.copy(p).add(belly); plasma.scale.setScalar(70 * ent + .01); plasma.material.opacity = ent * .9; halo.position.copy(p).add(belly); halo.scale.setScalar(140 * ent + .01); halo.material.opacity = ent * .35;
    trail.forEach((s, i) => { const q = pos(Math.max(0, t - (i + 1) * .13)).add(new THREE.Vector3(0, -4, 0)); s.position.copy(q); s.scale.setScalar((38 - i * 1.7) * ent + .01); s.material.opacity = ent * (.55 - i * .03); });
    // ground dust from the landing burn
    const h = p.y - SHIP_H / 2 - gp;
    for (const s of dust) { const d = s.userData, age = t - d.tb; if (age < 0 || t < 10) { s.material.opacity = 0; continue; }
      const rad = 5 + d.v * 2.6 * (1 - Math.exp(-age / 2.6)), gate = t < 12.4 ? 1 : .8, grow = d.sz + age * 6;
      s.position.set(LAND.x + Math.cos(d.a) * rad, gp + 1.5 + d.lift * (1 - Math.exp(-age / 2.2)), LAND.z + Math.sin(d.a) * rad); s.scale.set(grow, grow * .7, 1); s.material.rotation = d.rot + age * .1;
      s.material.opacity = .62 * gate * smooth(age * 1.5) * Math.max(0, 1 - age / 7.5); const lit = .85 + .1 * Math.sin(d.a); s.material.color.setRGB(.5 * lit, .3 * lit, .18 * lit); }
    // cameras
    cam.fov = 48;
    if (t < 4.3) { const k = t / 4.3; cam.position.set(34, heightAt(34, 52) + 1.8, 52); const q = pos(Math.max(0, t - .25)); cam.lookAt(q); cam.fov = 38 - k * 6; }
    else if (t < 8.4) { cam.position.set(p.x + 62, p.y + 8, p.z + 122 - (t - 4.3) * 4); cam.lookAt(p.x, p.y - 2, p.z); cam.fov = 44; }
    else if (t < 12.4) { const k = (t - 8.4) / 4; cam.position.set(LAND.x + 46 - k * 6, heightAt(LAND.x + 46, LAND.z + 40) + 3.2, LAND.z + 42 - k * 4); cam.lookAt(LAND.x, Math.max(gp + 12, p.y - 6), LAND.z); const sh = th * (1 - touch) * .16; cam.position.x += Math.sin(t * 33) * sh; cam.position.y += Math.sin(t * 41) * sh; cam.fov = 56; }
    else { const k = smooth((t - 12.4) / 3.6); cam.position.set(lerp(-30, -105, k), gp + lerp(15, 34, k), lerp(25, 105, k)); cam.lookAt(LAND.x, gp + lerp(24, 20, k), LAND.z); cam.fov = 46; }
    cam.updateProjectionMatrix();
    return 0;
  };
  return { frame, dispose: () => { dust.forEach(s => { scene.remove(s); s.material.dispose(); }); scene.remove(ship.group, pad, plasma, halo, ...trail); } };
}

// ================= the overlay, captions and timing =================
function runScene(create, { world, total, caps, title, manual }) {
  const root = document.createElement('div');
  root.className='scene-cinematic';
  root.style.cssText = 'position:fixed;inset:0;z-index:3000;overflow:hidden;cursor:pointer;font-family:Poppins,system-ui,sans-serif;color:#fff4e6';
  root.innerHTML = `<div class="cs-tint" style="position:absolute;inset:0;pointer-events:none;background:#7a4a2a;opacity:0"></div>
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 62%,rgba(0,0,0,.38) 100%)"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:9vh;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:9vh;background:#000"></div>
    <div class="cs-cap" style="position:absolute;left:5vw;bottom:12vh;font:500 14px/1.6 ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 14px #000;opacity:0"></div>
    <button type="button" class="cs-skip" style="position:absolute;right:4vw;top:11vh;min-width:64px;min-height:44px">Skip</button>
    <div class="cs-title" style="position:absolute;inset:0;display:grid;place-content:center;text-align:center;opacity:0;pointer-events:none;text-shadow:0 0 24px #000"></div>
    <div class="cs-black" style="position:absolute;inset:0;background:#000;opacity:0;pointer-events:none"></div>`;
  document.body.appendChild(root);
  const cap = root.querySelector('.cs-cap'), ttl = root.querySelector('.cs-title'), blk = root.querySelector('.cs-black'), tintEl = root.querySelector('.cs-tint');
  const cam = world.camera, fov0 = cam.fov, hud = document.getElementById('hud'), hudShow = hud?.style.visibility, pv = world.player.visible;
  let scene; try { scene = create(world); } catch (e) { console.warn('cutscene failed', e); root.remove(); return manual ? null : Promise.resolve(); }
  if (hud) hud.style.visibility = 'hidden'; world.player.visible = false; const mg = world.mapState?.group, mg0 = mg?.visible; if (mg) mg.visible = false;
  const beams = [...world.pickups.map(p => p.group.children[1]), ...(world.lookouts?.beacons || []), ...(world.lookouts?.beacons || []).map(b => b.userData.halo)].filter(Boolean), beams0 = beams.map(b => b.visible); beams.forEach(b => (b.visible = false));
  const keep = world.player.position.clone(), cameraPos=cam.position.clone(), cameraRotation=cam.quaternion.clone(); let cur = 0, ended = false;
  world.cinematic=true; for(const key of Object.keys(world.keys))world.keys[key]=false;
  const upd = world.update.bind(world);
  world.update = (dt, active) => {
    upd(dt, false); if (ended) return;
    world.player.position.copy(keep); world.player.visible = false;
    tintEl.style.opacity = scene.frame(cur); cam.updateProjectionMatrix();
  };
  const setTime = t => {
    cur = t;
    const c = caps.find(c => t >= c.t0 && t < c.t1); cap.textContent = c ? c.text : ''; cap.style.opacity = c ? Math.min(1, (t - c.t0) / .4, (c.t1 - t) / .4) : 0;
    const tt = clamp01((t - title.t) / .8); ttl.innerHTML = title.html; ttl.style.opacity = tt;
    blk.style.opacity = Math.max(1 - clamp01(t / .5), clamp01((t - (total - .6)) / .6));
  };
  const dispose = () => { if(ended)return; ended = true; world.cinematic=false; world.player.position.copy(keep); cam.position.copy(cameraPos);cam.quaternion.copy(cameraRotation); for(const key of Object.keys(world.keys))world.keys[key]=false; world.update = upd; scene.dispose(); cam.fov = fov0; cam.updateProjectionMatrix(); if (hud) hud.style.visibility = hudShow || ''; world.player.visible = pv; if (mg) mg.visible = mg0; beams.forEach((b, i) => (b.visible = beams0[i])); root.remove(); };
  setTime(0);
  if (manual) return { setTime, total, dispose, root };
  return new Promise(res => {
    let done = false, raf, t0 = null;
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true); dispose(); res(); };
    const key = e => { if (['Space', 'Escape', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); finish(); } };
    addEventListener('keydown', key, true); root.addEventListener('click', finish);
    const loop = now => { t0 ??= now; const t = (now - t0) / 1000; if (t >= total) return finish(); setTime(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  });
}
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function playStorm(world, o = {}) {
  if (!o.manual && reduced()) return Promise.resolve();
  const sub = o.sub || 'A wall of dust is crossing the crater';
  return runScene(createStorm, { world,
    total: STORM_T + 1.4, manual: o.manual,
    caps: [{ t0: .5, t1: 4, text: 'Storm warning. ' + sub }, { t0: 4.4, t1: 7.5, text: 'Fine dust reduces visibility across the outpost' }, { t0: 8, t1: 11, text: 'Sunlight fades. Solar panels will start to clog' }],
    title: { t: 11.4, html: '<div style="font:600 13px ui-monospace,Consolas,monospace;letter-spacing:.4em;opacity:.8">SOL ALERT</div><div style="font:700 clamp(34px,6vw,72px);letter-spacing:.12em;margin-top:6px">DUST STORM</div>' },
  });
}
export function playLanding(world, o = {}) {
  if (!o.manual && reduced()) return Promise.resolve();
  return runScene(createLanding, { world,
    total: LAND_T, manual: o.manual,
    caps: [{ t0: .6, t1: 4, text: 'Starship entering the Martian atmosphere' }, { t0: 4.6, t1: 8, text: 'Flip manoeuvre. Engines relight' }, { t0: 8.8, t1: 12, text: 'Landing burn' }],
    title: { t: 13.2, html: '<div style="font:600 13px ui-monospace,Consolas,monospace;letter-spacing:.4em;opacity:.8">GUSEV CRATER</div><div style="font:700 clamp(30px,5.4vw,64px);letter-spacing:.1em;margin-top:6px">WELCOME TO MARS</div>' },
  });
}
export const CUT = { storm: STORM_T + 1.4, landing: LAND_T };
