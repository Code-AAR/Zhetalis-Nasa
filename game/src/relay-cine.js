// "Signal home": the animated path of a message from your Mars relay dish to Earth, played from gameplay
// (first relay lock, first science message, or the replay button in the communications lab).
//   1. Uplink     - your dish on the ground fires pulses up at a passing orbiter.
//   2. Relay      - above Mars, NASA's Mars Reconnaissance Orbiter (3D model) catches them and turns its big antenna
//                   to Earth; Mars Odyssey (3D model) is the second real relay on another orbit.
//   3. Deep space - the pulse crosses to Earth while a clock counts today's real light-time (NASA JPL positions).
//   4. Earth      - NASA's Deep Space Network hears it; a near-Earth constellation (like Starlink) hands data
//                   from satellite to satellite.
// A message to another Mars site stops after shot 2 (the orbiter beams it straight back down).
// Orbits, sizes and speeds are illustrative, never live tracking. Click, Space, Enter or Esc skips. Same overlay
// pattern as scancine.js. With "reduce motion" on, a still summary card is shown instead.
import * as THREE from 'three';
import { heightAt } from './world.js';
import { latLonDir } from './globe.js';
import { loadModel } from './nasamodels.js';
import { dishAssembly } from './models.js';
import { playNote } from './patch-fx.js';
import { earthMarsLightTime, lightTimeWords } from './light-time.js';

const clamp01 = x => Math.max(0, Math.min(1, x)), smooth = x => (x = clamp01(x)) * x * (3 - 2 * x), lerp = (a, b, t) => a + (b - a) * t;
const SIGNAL = '#7fe3ff', WARM = '#ffd9a0';
const DSN = [['Goldstone, California', 35.43, -116.89], ['Madrid, Spain', 40.43, -4.25], ['Canberra, Australia', -35.40, 148.98]];

export function relaySteps(destination, light) {
  const km = Math.round(light.km / 1e6), wait = lightTimeWords(light.seconds);
  const steps = [
    { name: 'Uplink', seconds: 4.2, text: 'Your relay dish aims at an orbiter passing overhead. Reaching Earth directly would need far more power.' },
    destination === 'mars'
      ? { name: 'Relay', seconds: 6.4, text: 'Mars Reconnaissance Orbiter catches the signal and beams it down to the other outpost. Between Mars sites a message arrives in seconds.' }
      : { name: 'Relay', seconds: 6, text: 'Mars Reconnaissance Orbiter catches the signal and turns its big antenna toward Earth. Mars Odyssey is another real relay orbiter.' },
  ];
  if (destination !== 'mars') steps.push(
    { name: 'Deep space', seconds: 6.2, text: `Radio travels at the speed of light. Today Earth and Mars are about ${km} million km apart, so the message takes ${wait}. It is never under about 3 minutes or over about 22.` },
    { name: 'Earth', seconds: 5.6, text: 'NASA\'s Deep Space Network hears it with giant dishes in California, Spain and Australia: as Earth turns, one always faces Mars. Near Earth, big groups of satellites called constellations (Starlink is one) pass internet data from satellite to satellite.' });
  return steps;
}

function simpleSat(size) {   // stand-in while a NASA model loads, and the small near-Earth constellation satellites
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: '#e7e3d8', metalness: .3, roughness: .5 }),
    pan = new THREE.MeshStandardMaterial({ color: '#28508f', metalness: .6, roughness: .35, emissive: '#0d2247' });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(size * .4, size * .3, size * .4), body));
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(size * 1.05, size * .03, size * .45), pan); p.position.x = s * size * .8; g.add(p); }
  return g;
}
function nasaSat(file, size, alive) {
  const out = new THREE.Group(); out.add(simpleSat(size));
  loadModel(file).then(m => {
    if (!m || !alive()) return;
    const o = m.scene.clone(true), box = new THREE.Box3().setFromObject(o), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    o.traverse(x => { x.userData.sharedAsset = true; });   // geometry and textures belong to the model cache: never disposed here
    const w = new THREE.Group(); o.position.sub(c); w.add(o); w.scale.setScalar(size * 2.1 / Math.max(dim.x, dim.y, dim.z));
    out.children.forEach(ch => ch.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.(); })); out.clear(); out.add(w);
  }).catch(() => { });
  return out;
}
function starField(radius, count = 900) {
  const a = new Float32Array(count * 3), v = new THREE.Vector3();
  for (let i = 0; i < count; i++) { v.randomDirection().multiplyScalar(radius); a.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfe6ff', size: 1.8, sizeAttenuation: false }));
}
function globe(radius, map, fallback, glowColor) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), new THREE.MeshStandardMaterial({ color: fallback, roughness: 1 }));
  new THREE.TextureLoader().load(map, t => { t.colorSpace = THREE.SRGBColorSpace; mesh.material.map = t; mesh.material.color.set('#ffffff'); mesh.material.needsUpdate = true; });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 48, 32), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { c: { value: new THREE.Color(glowColor) } },
    vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 n; uniform vec3 c; void main(){ float i = pow(.72 - dot(n, vec3(0., 0., 1.)), 3.); gl_FragColor = vec4(c, 1.) * i * 1.4; }' }));
  const g = new THREE.Group(); g.add(mesh, glow); g.userData.mesh = mesh; return g;
}
// A row of glowing beads that run from a to b: the "signal". setLink(a, b, phase, strength) each frame.
function signalLink(scene, beads = 7, size = 1, daylight = false) {
  const group = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: daylight ? '#eafcff' : SIGNAL, transparent: true, blending: daylight ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, fog: false });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: daylight ? '#eafcff' : SIGNAL, transparent: true, opacity: .3, blending: daylight ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, fog: false }));
  group.add(line); const dots = [];
  for (let i = 0; i < beads; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), mat.clone()); group.add(d); dots.push(d); }
  scene.add(group);
  return (a, b, phase, strength = 1) => {
    group.visible = strength > .01; if (!group.visible) return;
    line.geometry.setFromPoints([a, b]); line.material.opacity = (daylight ? .7 : .28) * strength;
    dots.forEach((d, i) => { const k = (phase + i / beads) % 1; d.position.lerpVectors(a, b, k); d.material.opacity = strength * Math.sin(k * Math.PI); d.scale.setScalar(.6 + .8 * Math.sin(k * Math.PI)); });
  };
}

// Plays the sequence. destination: 'earth' | 'mars'. site: { x, z } of the relay dish in the world.
// Resolves when it ends or is skipped. Never rejects. startAt / freeze are for tests: begin at that second, or hold on it.
export function playRelayCinematic({ destination = 'earth', site = { x: -25, z: 18 }, date = new Date(), startAt = 0, freeze = false } = {}) {
  return new Promise(resolve => {
    const light = earthMarsLightTime(date), steps = relaySteps(destination, light);
    const root = document.createElement('div'); root.id = 'relay-cine';
    root.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#02030a;overflow:hidden;font-family:Poppins,system-ui,sans-serif;color:#eaf8ff';
    const tagCss = 'position:absolute;left:0;top:0;font:600 11px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border:1px solid rgba(127,227,255,.6);border-radius:6px;background:rgba(4,12,20,.72);white-space:nowrap;pointer-events:none;will-change:transform';
    const capCss = 'position:absolute;left:max(5vw,env(safe-area-inset-left));right:max(5vw,env(safe-area-inset-right));bottom:calc(10vh + env(safe-area-inset-bottom));max-width:760px;margin:0 auto;text-align:center;text-shadow:0 1px 8px #000';
    const finishBtn = '<button type="button" data-skip style="min-height:44px;padding:8px 18px;font:600 13px Poppins,system-ui,sans-serif">';
    // reduce motion: a still summary instead of the animation
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      root.style.cssText += ';display:grid;place-items:center;padding:20px;overflow:auto';
      root.innerHTML = `<div style="max-width:640px"><p style="letter-spacing:.14em;text-transform:uppercase;color:${SIGNAL};font-size:12px">Signal ${destination === 'mars' ? 'to the other outpost' : 'home'}</p>
        <ol style="line-height:1.6;padding-left:20px">${steps.map(s => `<li><b>${s.name}.</b> ${s.text}</li>`).join('')}</ol>${finishBtn}Continue</button></div>`;
      document.body.appendChild(root); root.querySelector('[data-skip]').onclick = () => { root.remove(); resolve('summary'); }; root.querySelector('[data-skip]').focus();
      return;
    }
    root.innerHTML = `<canvas style="position:absolute;inset:0;width:100%;height:100%;cursor:pointer"></canvas>
      <div style="position:absolute;left:0;right:0;top:0;height:7vh;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:7vh;background:#000"></div>
      <div style="position:absolute;left:0;right:0;bottom:7vh;height:34vh;background:linear-gradient(to top,rgba(2,3,10,.88),rgba(2,3,10,0));pointer-events:none"></div>
      <div data-tags></div>
      <div data-clock style="position:absolute;left:0;right:0;top:16vh;text-align:center;font:600 clamp(20px,5vw,40px)/1.2 ui-monospace,Consolas,monospace;letter-spacing:.08em;opacity:0;text-shadow:0 0 18px #2ab8ff;z-index:2;pointer-events:none;padding:0 16px"></div>
      <div style="${capCss}"><p data-step style="margin:0 0 6px;font:600 12px ui-monospace,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:${SIGNAL}"></p>
        <p data-cap role="status" aria-live="polite" style="margin:0;font-size:clamp(14px,2.4vw,18px);line-height:1.5"></p>
        <p data-note style="margin:8px 0 0;font-size:11px;color:#9db4c4"></p></div>
      <div style="position:absolute;right:max(4vw,env(safe-area-inset-right));top:calc(9vh + env(safe-area-inset-top))">${finishBtn}Skip</button></div>
      <div data-black style="position:absolute;inset:0;background:#000;opacity:1;pointer-events:none"></div>`;
    document.body.appendChild(root);
    const cv = root.querySelector('canvas'), q = s => root.querySelector(s), black = q('[data-black]'), clock = q('[data-clock]');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); } catch { root.remove(); resolve('unsupported'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const cam = new THREE.PerspectiveCamera(45, 1, .3, 6000), alive = () => root.isConnected;
    const tags = new Map(), tag = (id, text, pos, dy = -10) => {   // a label that follows a 3D point
      let el = tags.get(id); if (!el) { el = document.createElement('div'); el.style.cssText = tagCss; el.textContent = text; q('[data-tags]').appendChild(el); tags.set(id, el); }
      const p = pos.clone().project(cam), on = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      const W = cv.clientWidth, px = (p.x + 1) / 2 * W, w = el.offsetWidth, x = px + 12 + w > W - 8 ? Math.max(8, px - 12 - w) : px + 12;   // flips to the left near the right edge
      el.style.opacity = on ? 1 : 0; el.style.transform = `translate(${x.toFixed(1)}px, ${((1 - p.y) / 2 * cv.clientHeight + dy).toFixed(1)}px)`;
    };
    const hideTags = () => tags.forEach(el => (el.style.opacity = 0));

    // ---------- shot 1: the dish on the ground ----------
    const A = new THREE.Scene(); A.background = new THREE.Color('#b98a63'); A.fog = new THREE.Fog('#b98a63', 60, 330);
    A.add(new THREE.HemisphereLight('#f3d2ae', '#6b4630', 1.1)); const sunA = new THREE.DirectionalLight('#fff0dc', 2); sunA.position.set(-60, 90, 40); A.add(sunA);
    const tg = new THREE.PlaneGeometry(420, 420, 84, 84); tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position, h0 = heightAt(site.x, site.z);
    for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(site.x + tp.getX(i), site.z + tp.getZ(i)) - h0);
    tg.computeVertexNormals(); A.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: '#9a5f3f', roughness: 1 })));
    const dish = dishAssembly(1.6); A.add(dish.group);
    const beamDir = new THREE.Vector3(.34, .9, -.26).normalize(), dishTop = new THREE.Vector3(0, 3.1, 0);
    dish.group.traverse(o => { o.userData.sharedMaterial = true; });   // dish materials are shared with the live game (models.js MAT)
    const upA = signalLink(A, 18, .34, true), skySat = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false })); A.add(skySat);

    // ---------- shot 2: Mars orbit with the NASA relay orbiters ----------
    const B = new THREE.Scene(); B.background = new THREE.Color('#02030a'); B.add(starField(3000));
    B.add(new THREE.AmbientLight('#8896b0', .55)); const sunB = new THREE.DirectionalLight('#fff1dc', 2.4); sunB.position.set(-220, 140, 300); B.add(sunB);
    const mars = globe(100, 'assets/mars-map.jpg', '#b96a45', '#f28c5a'); B.add(mars);
    const s0 = new THREE.Vector3(.22, .2, 1).normalize();   // where the base sits on the globe as drawn
    mars.userData.mesh.quaternion.setFromUnitVectors(latLonDir(-14.5692, 175.4729), s0);   // Gusev crater faces the camera
    const axisM = new THREE.Vector3(-.25, 1, .1).normalize(), baseP = s0.clone().multiplyScalar(100.4);
    const mro = nasaSat('mro.glb', 15, alive), ody = nasaSat('odyssey.glb', 12, alive); B.add(mro, ody);
    const ring = (scene, pos, normal, r = 2.4) => { const m = new THREE.Mesh(new THREE.RingGeometry(r * .65, r, 40), new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.copy(pos); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); scene.add(m); return m; };
    const baseRing = ring(B, baseP, s0), otherDir = s0.clone().applyAxisAngle(axisM, .62), otherP = otherDir.clone().multiplyScalar(100.4), otherRing = ring(B, otherP, otherDir);
    otherRing.visible = destination === 'mars';
    const upB = signalLink(B, 7, 1.1), outB = signalLink(B, 9, 1.3), earthDirB = new THREE.Vector3(-1, .22, .5).normalize();

    // ---------- shot 3: Mars to Earth ----------
    const C = new THREE.Scene(); C.background = new THREE.Color('#02030a'); C.add(starField(3000, 1300));
    C.add(new THREE.AmbientLight('#9aa6c0', .5)); const sunC = new THREE.DirectionalLight('#fff4e2', 2.2); sunC.position.set(0, 60, 200); C.add(sunC);
    const marsC = globe(5.3, 'assets/mars-map.jpg', '#b96a45', '#f28c5a'), earthC = globe(10, 'assets/earth-map.jpg', '#3f6fa5', '#6fb4ff');
    const mC = new THREE.Vector3(78, -6, 0), eC = new THREE.Vector3(-78, 8, 0); marsC.position.copy(mC); earthC.position.copy(eC); C.add(marsC, earthC);
    const path = new THREE.QuadraticBezierCurve3(mC.clone().add(new THREE.Vector3(-6, 1, 0)), new THREE.Vector3(0, 26, 0), eC.clone().add(new THREE.Vector3(11, 0, 0)));
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(80)), new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); C.add(trail);
    const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(80)), new THREE.LineDashedMaterial({ color: '#52708a', dashSize: 1.6, gapSize: 1.4, transparent: true, opacity: .5 })); guide.computeLineDistances(); C.add(guide);
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' })); C.add(pulse);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 12), new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); pulse.add(halo);

    // ---------- shot 4: Earth, the Deep Space Network and a constellation ----------
    const D = new THREE.Scene(); D.background = new THREE.Color('#02030a'); D.add(starField(3000));
    D.add(new THREE.AmbientLight('#8fa0c0', .6)); const sunD = new THREE.DirectionalLight('#fff7ea', 2.3); sunD.position.set(160, 120, 300); D.add(sunD);
    const earth = globe(100, 'assets/earth-map.jpg', '#3f6fa5', '#6fb4ff'); D.add(earth);
    const front = new THREE.Vector3(.12, .3, 1).normalize(), spin = new THREE.Group(); earth.add(spin); spin.add(earth.userData.mesh);   // the globe mesh spins inside `spin`, glow stays put
    spin.quaternion.setFromUnitVectors(latLonDir(DSN[0][1], DSN[0][2]), front);
    const stations = DSN.map(([name, lat, lon]) => { const dir = latLonDir(lat, lon), m = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.6, 32), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.copy(dir).multiplyScalar(100.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); spin.add(m); return { name, mesh: m }; });
    const inD = signalLink(D, 9, 1.3), marsDirD = new THREE.Vector3(1, .3, .75).normalize();
    const planes = [[116, .5, -.5, 0], [124, -.62, .7, .5]].map(([radius, tilt, heading, offset]) => {   // two orbit planes of small satellites
      const plane = new THREE.Group(); plane.rotation.set(tilt, 0, heading, 'ZYX'); const turn = new THREE.Group(); plane.add(turn); const sats = [];
      for (let i = 0; i < 8; i++) { const a = (i + offset) * Math.PI / 4, s = simpleSat(4.2); s.position.set(radius * Math.cos(a), 0, radius * Math.sin(a)); s.rotation.y = -a; turn.add(s); sats.push(s); }
      const pts = Array.from({ length: 97 }, (_, i) => new THREE.Vector3(radius * Math.cos(i * Math.PI / 48), 0, radius * Math.sin(i * Math.PI / 48)));
      plane.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#4c6f8f', transparent: true, opacity: .45 }))); D.add(plane); return { turn, sats };
    });
    const hop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); D.add(hop);

    // ---------- timeline ----------
    const scenes = [A, B, C, D], starts = []; let total = 0; for (const s of steps) { starts.push(total); total += s.seconds; }
    const END = 1.6; let done = false, raf = 0, T0 = null, shown = -1;
    const finish = how => {
      if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true); removeEventListener('resize', size);
      for (const s of scenes) s.traverse(o => { if (o.userData.sharedAsset) return; o.geometry?.dispose(); if (o.userData.sharedMaterial) return; for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); } });
      renderer.dispose(); root.remove(); resolve(how);
    };
    const key = e => { if (['Space', 'Escape', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); finish('skipped'); } };
    addEventListener('keydown', key, true); cv.addEventListener('click', () => finish('skipped')); root.querySelector('[data-skip]').onclick = () => finish('skipped');
    const size = () => { renderer.setSize(root.clientWidth, root.clientHeight, false); cam.aspect = root.clientWidth / Math.max(1, root.clientHeight); cam.fov = cam.aspect < .8 ? 62 : 45; cam.updateProjectionMatrix(); };
    addEventListener('resize', size); size();
    const v = new THREE.Vector3(), v2 = new THREE.Vector3(), satPos = new THREE.Vector3();

    const frame = now => {
      if (done) return; raf = requestAnimationFrame(frame);
      T0 ??= now - startAt * 1000;
      const t = freeze ? startAt : (now - T0) / 1000; if (t >= total + END) return finish('watched');
      let i = steps.length - 1; while (i > 0 && t < starts[i]) i--;
      const k = clamp01((t - starts[i]) / steps[i].seconds), name = steps[i].name;
      if (i !== shown) {
        shown = i; hideTags(); playNote([0, 4, 7, 12][i] ?? 0);
        q('[data-step]').textContent = `${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')} · ${name}`; q('[data-cap]').textContent = steps[i].text;
        q('[data-note]').textContent = name === 'Deep space' ? 'In this training the wait is squeezed to 20 seconds. Sizes and distances are not to scale.' : name === 'Relay' ? '3D models: NASA 3D Resources. Orbits are illustrative, not live tracking.' : name === 'Earth' ? 'Satellite paths are illustrative. Dish sites are the real Deep Space Network locations.' : '';
      }
      // fade through black between shots and at both ends
      const edge = Math.min(t - starts[i], starts[i] + steps[i].seconds - t), fade = t > total ? clamp01((t - total) / .5) : 1 - clamp01(edge / .45);
      black.style.opacity = (i === steps.length - 1 && t <= total && starts[i] + steps[i].seconds - t < .45) ? 0 : fade;
      clock.style.opacity = name === 'Deep space' || t > total ? 1 : 0;

      if (name === 'Uplink') {
        dish.el.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir), .05);
        const far = v.copy(dishTop).addScaledVector(beamDir, 46); skySat.position.copy(dishTop).addScaledVector(beamDir, 300).add(v2.set(lerp(-40, 30, k), 0, lerp(20, -10, k)));
        upA(dishTop, far, t * .3, smooth((k - .2) / .2));
        const e = smooth(k); cam.position.set(lerp(9, 11.5, e), lerp(2.3, 2, e), lerp(11.5, 14.5, e)); cam.lookAt(v2.set(.8, lerp(2.4, 4.4, smooth((k - .25) / .75)), 0));   // dish stays in frame, pulses climb away
        tag('dish', 'Your relay dish', dishTop);
        renderer.render(A, cam);
      } else if (name === 'Relay') {
        const ang = lerp(-.5, .34, k); satPos.copy(s0).applyAxisAngle(axisM, ang).multiplyScalar(134); mro.position.copy(satPos);
        mro.lookAt(0, 0, 0); mro.rotateY(lerp(0, destination === 'mars' ? .3 : -1.1, smooth((k - .45) / .25)));   // swings its antenna round to the next link
        ody.position.set(Math.cos(t * .12 + 2.2) * 150, 62 + Math.sin(t * .12) * 18, Math.sin(t * .12 + 2.2) * 150).applyAxisAngle(new THREE.Vector3(1, 0, 0), .5); ody.lookAt(0, 0, 0);
        const up = smooth((k - .1) / .15) * (1 - smooth((k - .62) / .12)), out = smooth((k - .55) / .15);
        upB(baseP, satPos, t * .6, up);
        if (destination === 'mars') outB(satPos, otherP, t * .6, out); else outB(satPos, v.copy(satPos).addScaledVector(earthDirB, 420), t * .35, out);
        baseRing.scale.setScalar(1 + .25 * Math.sin(t * 5)); otherRing.scale.setScalar(1 + .25 * Math.sin(t * 5 + 1)); otherRing.material.opacity = out;
        const orbit = lerp(-.28, .3, smooth(k)), far = cam.aspect < .8 ? 470 : 350; cam.position.set(Math.sin(orbit) * far + 40, 66, Math.cos(orbit) * far); cam.lookAt(12, 14, 0);
        tag('mro', 'Mars Reconnaissance Orbiter', satPos); tag('ody', 'Mars Odyssey', ody.position); tag('base', 'Your base', baseP, 16); if (destination === 'mars') tag('other', 'Other outpost', otherP);
        renderer.render(B, cam);
      } else if (name === 'Deep space') {
        const go = clamp01((k - .08) / .8); path.getPoint(go, pulse.position); halo.scale.setScalar(1 + .25 * Math.sin(t * 9));
        trail.geometry.setDrawRange(0, Math.max(2, Math.round(go * 80) + 1));
        marsC.userData.mesh.rotation.y += .003; earthC.userData.mesh.rotation.y += .004;
        cam.position.set(lerp(14, -10, smooth(k)), 20, cam.aspect < .8 ? 250 : 178); cam.lookAt(0, 8, 0);
        clock.textContent = `Signal travelling · ${lightTimeWords(light.seconds * go)}`;
        tag('marsC', 'Mars', v.copy(mC).add(v2.set(0, 8, 0))); tag('earthC', 'Earth', v.copy(eC).add(v2.set(0, 13, 0)));
        renderer.render(C, cam);
      } else {
        spin.rotateOnWorldAxis(new THREE.Vector3(.05, 1, 0).normalize(), .0009);
        planes.forEach((p, n) => (p.turn.rotation.y += (n ? .0042 : -.005)));
        const dsn = stations[0].mesh.getWorldPosition(v), arrive = smooth((k - .04) / .12) * (1 - smooth((k - .5) / .12));
        inD(v2.copy(dsn).addScaledVector(marsDirD, 430), dsn, t * .4, arrive);
        stations.forEach((s, n) => { s.mesh.scale.setScalar(1 + .3 * Math.sin(t * 4 + n)); s.mesh.material.opacity = n === 0 ? 1 : .55; });
        // after it lands, data hops between the three nearest constellation satellites
        const hops = smooth((k - .45) / .15), all = planes.flatMap(p => p.sats).map(s => s.getWorldPosition(new THREE.Vector3())).sort((a, b) => a.distanceTo(dsn) - b.distanceTo(dsn)).slice(0, 4);
        hop.geometry.setFromPoints([dsn.clone(), ...all]); hop.material.opacity = hops * (.55 + .3 * Math.sin(t * 8));
        const orbit = lerp(-.2, .22, smooth(k)); cam.position.set(Math.sin(orbit) * (cam.aspect < .8 ? 440 : 340), 70, Math.cos(orbit) * (cam.aspect < .8 ? 440 : 340)); cam.lookAt(0, 6, 0);
        tag('dsn', 'Deep Space Network · ' + stations[0].name, dsn); tag('con', 'Constellation satellite', all[0], -26);
        renderer.render(D, cam);
      }
      if (t > total) { clock.textContent = destination === 'mars' ? 'Message delivered to the other outpost' : `Message delivered · ${lightTimeWords(light.seconds)} after it left Mars`; }
    };
    raf = requestAnimationFrame(frame);
  });
}
