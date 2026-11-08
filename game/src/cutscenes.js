// Two cutscenes that play inside the game:
//   playStorm()   a wall of dust rolls across Gusev crater and swallows the outpost.
//   playLanding() the NASA way down: heat shield, parachute, descent stage and sky crane (edl.js).
// Both play inside the real game scene (the real outpost, ground, sky and light): the cutscene just takes over the camera
// and adds a few props (dust wall, Starship). Click, Space or Esc skips. Each resolves when it ends.
// With { manual: true } they return a handle ({ setTime, total, dispose }) so a test can step through the frames.
import { holdAwards } from './patches.js';
import * as THREE from 'three';
import { heightAt } from './world.js';

const clamp01 = x => Math.max(0, Math.min(1, x)), smooth = x => (x = clamp01(x)) * x * (3 - 2 * x), lerp = (a, b, t) => a + (b - a) * t;
const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- shared pieces ----------
import { createEDL, EDL_T, placeLander, glowTexture, puffTexture } from './edl.js';
export { placeLander };
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
  const grit = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pp, 3)), new THREE.PointsMaterial({ map: glowTexture(), color: '#e0a070', size: .55, alphaTest: .02, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false }));
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
    const outk = smooth((t - (STORM_T + 1.4 - 1.8)) / 1.8), dist = cam.position.z - wz, near = smooth(1 - clamp01(dist / 180)), inside = smooth(clamp01(-dist / 40));
    for (const s of puffs) {
      const d = s.userData, z = wz + d.dz, x = d.x, y = heightAt(clamp(x, -300, 300), clamp(z, -300, 300)) + d.hgt * (.75 + .25 * Math.sin(t * .8 + d.ph));
      s.position.set(x, y + d.s * .25, z); const sc = d.s * (1 + .06 * Math.sin(t * 1.3 + d.ph)); s.scale.set(sc, sc * .8, 1); s.material.rotation = d.rot + t * d.spin;
      const lit = clamp01(.95 - d.deep * .55 + d.hgt / 260); s.material.color.setRGB(.2 * lit + .03, .085 * lit + .012, .04 * lit + .006);
      s.material.opacity = (d.front ? .72 : .55) * (z > 400 ? 0 : 1) * (1 - outk);
    }
    // sky and light turn brown as the front gets near
    const sto = clamp01(smooth((t - 2) / 8) * .6 + near * .5 + inside);
    scene.fog.color.copy(fog0.c).lerp(new THREE.Color('#9a6a48'), sto * .8); scene.fog.near = lerp(fog0.n, 4, near * .6 + inside * .4); scene.fog.far = lerp(fog0.f, 70, Math.max(near * .55, inside));
    tint = sto * .4 * (1 - outk); scene.fog.near = lerp(scene.fog.near, fog0.n, outk); scene.fog.far = lerp(scene.fog.far, fog0.f, outk); scene.fog.color.lerp(fog0.c, outk);
    // grit streams across the camera
    const att = clamp01((t - 3) / 8) * (.25 + near * .75); grit.material.opacity = att * .8 * (1 - outk);
    for (let i = 0; i < N; i++) { const a = seed[i * 3], b = seed[i * 3 + 1], c = seed[i * 3 + 2]; pp[i * 3] = cam.position.x + (a - .5) * 260; pp[i * 3 + 1] = gy + b * 34 + Math.sin(t * 2 + c * 9) * .4; pp[i * 3 + 2] = cam.position.z + ((((c * 360 + t * 70) % 360) + 360) % 360) - 260; }
    grit.geometry.attributes.position.needsUpdate = true; if (shot === 1) grit.material.opacity *= .3;
    return tint;
  };
  return { frame, dispose: () => { puffs.forEach(s => { scene.remove(s); s.material.dispose(); }); scene.remove(grit); grit.geometry.dispose(); scene.fog.color.copy(fog0.c); scene.fog.near = fog0.n; scene.fog.far = fog0.f; } };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const createLanding = createEDL;

// ================= the overlay, captions and timing =================
function runScene(create, { world, total, caps, title, manual, fadeIn }) {
  const root = document.createElement('div');
  root.className='scene-cinematic';
  root.style.cssText = 'position:fixed;inset:0;z-index:3000;overflow:hidden;cursor:pointer;font-family:Poppins,system-ui,sans-serif;color:#fff4e6';
  root.innerHTML = `<div class="cs-tint" style="position:absolute;inset:0;pointer-events:none;background:#7a4a2a;opacity:0"></div>
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 62%,rgba(0,0,0,.38) 100%)"></div>
    <div class="cs-bar" style="position:absolute;left:0;right:0;top:0;height:0;background:#000"></div><div class="cs-bar" style="position:absolute;left:0;right:0;bottom:0;height:0;background:#000"></div>
    <div class="cs-cap" style="position:absolute;left:5vw;bottom:12vh;font:500 14px/1.6 ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 14px #000;opacity:0"></div>
    <button type="button" class="cs-skip" style="position:absolute;right:4vw;top:11vh;min-width:64px;min-height:44px;padding:0 16px;font:12px ui-monospace,Consolas,monospace;letter-spacing:.12em;color:#fff4e6;background:rgba(0,0,0,.4);border:1px solid rgba(255,244,230,.45);border-radius:8px;cursor:pointer;opacity:.55">Skip</button>
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 48%,rgba(0,0,0,0) 52%,rgba(0,0,0,.42) 100%)"></div>
    <div class="cs-title" style="position:absolute;left:0;right:0;top:9vh;display:grid;justify-content:center;text-align:center;opacity:0;pointer-events:none;text-shadow:0 0 24px #000"></div>
    <div class="cs-black" style="position:absolute;inset:0;background:#000;opacity:0;pointer-events:none"></div>`;
  document.body.appendChild(root);
  const cap = root.querySelector('.cs-cap'), ttl = root.querySelector('.cs-title'), blk = root.querySelector('.cs-black'), tintEl = root.querySelector('.cs-tint');
  const cam = world.camera, fov0 = cam.fov, hud = document.getElementById('hud'), hudShow = hud?.style.visibility, pv = world.player.visible;
  let scene; try { scene = create(world); } catch (e) { console.warn('cutscene failed', e); root.remove(); return manual ? null : Promise.resolve(); }
  holdAwards(true); const toastEl = document.getElementById('toast'), toastVis = toastEl?.style.visibility; if (toastEl) toastEl.style.visibility = 'hidden';
  if (hud) hud.style.visibility = 'hidden'; world.player.visible = false; const mg = world.mapState?.group, mg0 = mg?.visible; if (mg) mg.visible = false;
  const beams = [...world.pickups.map(p => p.group.children[1]), ...(world.lookouts?.beacons || []), ...(world.lookouts?.beacons || []).map(b => b.userData.halo)].filter(Boolean), beams0 = beams.map(b => b.visible); beams.forEach(b => (b.visible = false));
  const keep = world.player.position.clone(), cameraPos = cam.position.clone(), cameraRotation = cam.quaternion.clone(); let cur = 0, ended = false;
  world.cinematic = true; for (const key of Object.keys(world.keys)) world.keys[key] = false;   // the game pauses and the terrain streams around the camera
  const upd = world.update.bind(world);
  world.update = (dt, active) => {
    upd(dt, false); if (ended) return;
    world.player.position.copy(keep); world.player.visible = false;
    const gp = cam.position.clone(), gq = cam.quaternion.clone(), gf = cam.fov;
    tintEl.style.opacity = scene.frame(cur);
    const b = Math.max(fadeIn ? 0 : 1 - smooth(cur / 1.6), smooth((cur - (total - 1.8)) / 1.8));   // glide in from, and back to, the player's own view
    if (b > 0) { cam.position.lerp(gp, b); cam.quaternion.slerp(gq, b); cam.fov = lerp(cam.fov, gf, b); }
    cam.updateProjectionMatrix();
  };
  const setTime = t => {
    cur = t;
    const c = caps.find(c => t >= c.t0 && t < c.t1); cap.textContent = c ? c.text : ''; cap.style.opacity = c ? Math.min(1, (t - c.t0) / .4, (c.t1 - t) / .4) : 0;
    const tt = clamp01((t - title.t) / .8) * (1 - smooth((t - (total - 1.6)) / .9)); ttl.innerHTML = title.html; ttl.style.opacity = tt; cap.style.opacity = cap.style.opacity * (1 - smooth((t - (total - 1.6)) / .6));
    blk.style.opacity = fadeIn ? 1 - clamp01(t / .8) : 0;
    const bars = smooth(t / 1) * (1 - smooth((t - (total - 1.2)) / 1.2)); root.querySelectorAll('.cs-bar').forEach(e => (e.style.height = 9 * bars + 'vh'));
    root.querySelector('.cs-skip').style.opacity = .55 * bars;
  };
  const dispose = () => { if (ended) return; ended = true; world.cinematic = false; world.player.position.copy(keep); cam.position.copy(cameraPos); cam.quaternion.copy(cameraRotation); for (const key of Object.keys(world.keys)) world.keys[key] = false; world.update = upd; scene.dispose(); cam.fov = fov0; cam.updateProjectionMatrix(); if (hud) { hud.style.visibility = hudShow || ''; hud.style.transition = 'none'; hud.style.opacity = 0; void hud.offsetWidth; hud.style.transition = 'opacity 1.2s'; hud.style.opacity = 1; setTimeout(() => { hud.style.transition = ''; hud.style.opacity = ''; }, 1400); } world.player.visible = pv; holdAwards(false); if (toastEl) toastEl.style.visibility = toastVis || ''; if (mg) mg.visible = mg0; beams.forEach((b, i) => (b.visible = beams0[i])); root.remove(); };
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
    caps: [{ t0: .5, t1: 4, text: 'Storm warning. ' + sub }, { t0: 4.4, t1: 7.5, text: 'Winds in a Mars dust storm can reach 100 km/h' }, { t0: 8, t1: 11, text: 'Sunlight fades. Solar panels will start to clog' }],
    title: { t: 11.4, html: '<div style="font:600 13px ui-monospace,Consolas,monospace;letter-spacing:.4em;opacity:.8">SOL ALERT</div><div style="font:700 clamp(34px,6vw,72px);letter-spacing:.12em;margin-top:6px">DUST STORM</div>' },
  });
}
export function playLanding(world, o = {}) {
  if (!o.manual && reduced()) return Promise.resolve();
  return runScene(createLanding, {
    world, fadeIn: true, total: EDL_T, manual: o.manual,
    caps: [{ t0: .4, t1: 3.6, text: 'Cruise stage separates. 130 km above Mars' }, { t0: 4.1, t1: 7.8, text: 'Entry at 20,000 km/h. The heat shield glows at 1,300 °C' }, { t0: 8.3, t1: 12.2, text: 'A 21 metre parachute opens. The heat shield drops away' }, { t0: 12.7, t1: 15.2, text: 'Eight rockets slow the descent stage' }, { t0: 15.5, t1: 18, text: 'Sky crane: the lander is lowered on cables' }],
    title: { t: 17.9, html: '<div style="font:600 13px ui-monospace,Consolas,monospace;letter-spacing:.4em;opacity:.8">GUSEV CRATER</div><div style="font:700 clamp(30px,5.4vw,64px);letter-spacing:.1em;margin-top:6px">WELCOME TO MARS</div>' },
  });
}
export const CUT = { storm: STORM_T + 1.4, landing: EDL_T };
