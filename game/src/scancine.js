// The tower-scan cutscene. Three shots, like the activation scenes in open-world games (the Sheikah towers in
// Breath of the Wild, the Ubisoft viewpoints, Horizon's tallnecks):
//   1. From space: Mars turns, a survey orbiter slides in and points its scanner at Gusev crater.
//   2. Close to the ground: the orbiter flies over the land and a curtain of light sweeps across it. Mist hides the
//      ground ahead of the scan; behind it the land clears and a blue survey grid glows on it.
//   3. The camera climbs to look straight down, the name of the region appears and the chart opens.
// Click, Space or Esc skips it. Resolves when it ends.
import * as THREE from 'three';
import { heightAt } from './world.js';
import { latLonDir } from './globe.js';
import { loadModel } from './nasamodels.js';
import { playNote } from './patch-fx.js';

const T_A = 3.4, T_B = 6.6, T_C = 2.2, TOTAL = T_A + T_B + T_C;
const clamp01 = x => Math.max(0, Math.min(1, x)), smooth = x => (x = clamp01(x)) * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;

const TERRAIN_V = `varying vec3 vP; varying vec3 vN;
void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const TERRAIN_F = `precision highp float; varying vec3 vP; varying vec3 vN; uniform float uSat; uniform float uTime; uniform float uDone;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float gridLine(float v){ float d = abs(fract(v + .5) - .5) * 22.; return 1. - smoothstep(.25, 1.1, d); }
void main(){
  vec3 n = normalize(vN); float slope = 1. - n.y;
  vec3 col = mix(vec3(.64, .41, .27), vec3(.36, .24, .18), smoothstep(.12, .5, slope));
  col *= .78 + .5 * clamp(vP.y / 70., 0., 1.);
  col *= .3 + .85 * max(dot(n, normalize(vec3(.55, .75, .35))), 0.);
  float s = uSat - vP.x, a = smoothstep(0., 8., s), nz = noise(vP.xz * .028 + uTime * .06) * .6 + noise(vP.xz * .09 - uTime * .1) * .4;
  vec3 mist = vec3(.8, .73, .67);
  vec3 ahead = mix(col * .42, vec3(.52, .46, .43), clamp(.55 + .3 * nz, 0., 1.));
  vec3 behind = mix(col, mist, exp(-max(s, 0.) / 32.) * (.55 * nz));
  vec3 c = mix(ahead, behind, a);
  float gl = max(gridLine(vP.x / 22.), gridLine(vP.z / 22.));
  c += vec3(.15, .75, 1.) * gl * a * (exp(-max(s, 0.) / 90.) * .8 + .08 * (1. - uDone));
  c += vec3(.45, .9, 1.) * exp(-abs(s) / 2.6) * 1.7;
  c = mix(c, c * 1.15 + vec3(.05, .04, .02), uDone * .5);
  float edge = 1. - smoothstep(280., 385., length(vP.xz));
  gl_FragColor = vec4(mix(vec3(.02, .025, .05), c, edge), 1.);
}`;
const CURTAIN_F = `precision highp float; varying vec2 vUv; uniform float uTime;
void main(){ float g = vUv.y, stripes = .6 + .4 * sin(vUv.x * 160. - uTime * 6.), band = .9 + .1 * sin(g * 60. - uTime * 10.);
  float a = (.05 + .26 * pow(g, 1.8)) * stripes * band; a += smoothstep(.93, 1., g) * .9;
  gl_FragColor = vec4(vec3(.35, .9, 1.) * (.7 + g * .6), a * (1. - smoothstep(.0, .06, 1. - abs(vUv.x - .5) * 2.) * .0)); }`;

function procSat(size) {
  const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: '#e7e3d8', metalness: .3, roughness: .5 }),
    pan = new THREE.MeshStandardMaterial({ color: '#1d3f78', metalness: .6, roughness: .35, emissive: '#0a1c3c' });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(size * .4, size * .35, size * .4), body));
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(size * 1.1, size * .03, size * .5), pan); p.position.x = s * size * .85; g.add(p); }
  const d = new THREE.Mesh(new THREE.SphereGeometry(size * .3, 16, 8, 0, Math.PI * 2, 0, 1), body); d.position.y = -size * .3; d.rotation.x = Math.PI; g.add(d);
  return g;
}
function makeSat(size, alive) {
  const out = new THREE.Group(); out.add(procSat(size));
  loadModel('mro.glb').then(m => {
    if (!m || !alive()) return;
    const o = m.scene.clone(true), box = new THREE.Box3().setFromObject(o);
    const dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const w = new THREE.Group(); o.position.sub(c); w.add(o);
    w.scale.setScalar(size * 2.2 / Math.max(dim.x, dim.y, dim.z));
    out.clear(); out.add(w);
  }).catch(() => {});
  return out;
}

export async function playScanCinematic({ x, z, name = 'Lookout', lat = -14.5692, lon = 175.4729, onDone }) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#02030a;overflow:hidden;cursor:pointer;font-family:Poppins,system-ui,sans-serif;color:#eaf8ff';
  root.innerHTML = `<canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    <div style="position:absolute;left:0;right:0;top:0;height:9vh;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:9vh;background:#000"></div>
    <div id="sc-cap" style="position:absolute;left:5vw;bottom:12vh;font:500 13px/1.6 ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 12px #2ab8ff"></div>
    <button type="button" id="sc-skip" style="position:absolute;right:4vw;top:11vh;font:12px ui-monospace,Consolas,monospace;letter-spacing:.12em;min-height:44px;padding:8px 18px;z-index:2">Skip</button>
    <div id="sc-title" style="position:absolute;inset:0;display:grid;place-content:center;text-align:center;opacity:0;pointer-events:none"></div>
    <div id="sc-flash" style="position:absolute;inset:0;background:#cfefff;opacity:0;pointer-events:none"></div><div id="sc-black" style="position:absolute;inset:0;background:#000;opacity:0;pointer-events:none"></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), cap = root.querySelector('#sc-cap'), title = root.querySelector('#sc-title'), flash = root.querySelector('#sc-flash'), black = root.querySelector('#sc-black');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); } catch { root.remove(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(innerWidth, innerHeight, false);
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .5, 4000);

  // ---- shot 1: Mars from orbit
  const A = new THREE.Scene(); A.background = new THREE.Color('#02030a');
  A.add(new THREE.AmbientLight('#8896b0', .5)); const sunA = new THREE.DirectionalLight('#fff1dc', 2.3); sunA.position.set(-200, 120, 260); A.add(sunA);
  const stars = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(1500); stars.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3)); A.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#cfe6ff', size: 2.2, sizeAttenuation: false })));
  const mars = new THREE.Mesh(new THREE.SphereGeometry(120, 64, 48), new THREE.MeshStandardMaterial({ color: '#b96a45', roughness: 1 }));
  new THREE.TextureLoader().load('assets/mars-map.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; mars.material.map = t; mars.material.color.set('#ffffff'); mars.material.needsUpdate = true; });
  mars.quaternion.setFromUnitVectors(latLonDir(lat, lon), new THREE.Vector3(0, 0, 1)); A.add(mars);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(128, 48, 32), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 n; void main(){ float i = pow(.72 - dot(n, vec3(0., 0., 1.)), 3.); gl_FragColor = vec4(.95, .55, .35, 1.) * i * 1.4; }' })); A.add(glow);
  const target = new THREE.Vector3(0, 0, 120);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.4, 48), new THREE.MeshBasicMaterial({ color: '#59d0ff', transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); ring.position.copy(target).setZ(120.6); A.add(ring);
  const beamA = new THREE.Mesh(new THREE.CylinderGeometry(.25, 7, 1, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#59d0ff', transparent: true, opacity: .35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); A.add(beamA);
  const satA = makeSat(13, () => root.isConnected); A.add(satA);

  // ---- shot 2: the ground
  const B = new THREE.Scene(); B.background = new THREE.Color('#02030a');
  B.add(new THREE.AmbientLight('#aab8d0', .7)); const sunB = new THREE.DirectionalLight('#fff1dc', 2.2); sunB.position.set(120, 200, 80); B.add(sunB);
  const N = 170, SPAN = 780, tg = new THREE.PlaneGeometry(SPAN, SPAN, N, N); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(x + pos.getX(i), z + pos.getZ(i)) * 1.5);
  tg.computeVertexNormals();
  const tmat = new THREE.ShaderMaterial({ vertexShader: TERRAIN_V, fragmentShader: TERRAIN_F, uniforms: { uSat: { value: -1e4 }, uTime: { value: 0 }, uDone: { value: 0 } } });
  B.add(new THREE.Mesh(tg, tmat));
  const satB = makeSat(46, () => root.isConnected); B.add(satB);
  const SAT_Y = 140, GROUND = 14, cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute([0, SAT_Y - 8, 0, 0, GROUND, -400, 0, GROUND, 400], 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute([.5, 0, 0, 1, 1, 1], 2));
  const cmat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: CURTAIN_F,
    uniforms: { uTime: { value: 0 } }, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const curtain = new THREE.Mesh(cg, cmat); B.add(curtain);

  let done = false, T0 = null, noteAt = 0; const notes = [0, 2, 4, 7, 9, 12];
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); renderer.dispose(); [tg, cg, sg].forEach(g => g.dispose()); root.remove(); removeEventListener('keydown', key, true); onDone?.(); };
  const key = e => { if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); finish(); } };
  addEventListener('keydown', key, true); root.addEventListener('click', finish);
  const show = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
  let raf;
  const frame = now => {
    if (done) return;
    T0 ??= now; const t = (now - T0) / 1000; if (t >= TOTAL) return finish();
    for (; noteAt < notes.length && t > 1.4 + noteAt * 1.05; noteAt++) playNote(notes[noteAt]);
    const cut = T_A, fl = Math.max(0, 1 - Math.abs(t - cut) / .3);
    flash.style.opacity = (fl * fl * .95).toFixed(3);
    const endFade = clamp01((t - (TOTAL - .6)) / .6); black.style.opacity = endFade.toFixed(3);
    if (t < T_A) {
      const u = t / T_A, e = smooth(u);
      cam.position.set(lerp(-14, 6, u), lerp(10, 22, u), lerp(330, 232, e)); cam.lookAt(0, 6, 120);
      satA.position.set(lerp(-230, 6, e), lerp(34, 26, e), lerp(168, 150, e)); satA.rotation.set(0, Math.PI / 2, Math.sin(t) * .08);
      const bt = target.clone(), dir = bt.clone().sub(satA.position), len = dir.length();
      beamA.visible = u > .45; beamA.scale.set(1, len, 1); beamA.position.copy(satA.position).addScaledVector(dir, .5); beamA.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
      beamA.material.opacity = .15 + .3 * Math.sin(t * 12) ** 2 * smooth((u - .45) * 3);
      const pulse = (t * 1.6) % 1; ring.scale.setScalar(2 + pulse * 22); ring.material.opacity = u > .4 ? (1 - pulse) * .9 : 0;
      mars.rotation.y += .0007; glow.visible = true;
      show(cap, 'Orbiter pass<br>Target: Gusev crater &nbsp; 14.6&deg;S &nbsp; 175.5&deg;E');
      renderer.render(A, cam);
    } else if (t < T_A + T_B) {
      const u = (t - T_A) / T_B, sx = lerp(-400, 400, smooth(u * 1.04 - .02)); tmat.uniforms.uSat.value = sx; tmat.uniforms.uTime.value = t; cmat.uniforms.uTime.value = t;
      satB.position.set(sx, SAT_Y + Math.sin(t * 2) * 2, 0); satB.rotation.set(0, Math.PI / 2, Math.sin(t * 1.5) * .06);
      curtain.position.set(sx, 0, 0); curtain.visible = u > .02 && u < .98;
      cam.position.set(lerp(-90, 90, smooth(u)), lerp(235, 215, u), lerp(400, 340, u)); cam.lookAt(0, 80, 0);
      show(cap, `Surface scan &middot; ${name}<br>Mapping the height and type of the ground`);
      renderer.render(B, cam);
    } else {
      const u = clamp01((t - T_A - T_B) / T_C), e = smooth(u);
      tmat.uniforms.uSat.value = 1e4; tmat.uniforms.uDone.value = e; tmat.uniforms.uTime.value = t; curtain.visible = false; satB.visible = false;
      cam.position.set(lerp(90, 0, e), lerp(120, 560, e), lerp(300, 30, e)); cam.lookAt(0, lerp(40, 0, e), 0);
      const ta = clamp01((u - .15) / .3);
      show(cap, '');
      show(title, `<div style="font:500 12px ui-monospace,Consolas,monospace;letter-spacing:.5em;color:#7fe0ff;text-indent:.5em">SURVEY MAST ACTIVATED</div><div style="font:800 clamp(30px,6vw,64px)/1.1 Poppins,system-ui,sans-serif;letter-spacing:.14em;margin:.25em 0 .1em;text-transform:uppercase;text-shadow:0 0 26px #2ab8ff">${name}</div><div style="height:2px;background:linear-gradient(90deg,transparent,#7fe0ff,transparent);margin:0 auto;width:${(ta * 70).toFixed(1)}%"></div><div style="font:13px ui-monospace,Consolas,monospace;letter-spacing:.3em;margin-top:.8em;opacity:.8">MAP DATA RECEIVED</div>`);
      title.style.opacity = ta.toFixed(3);
      renderer.render(B, cam);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return new Promise(res => { const old = onDone; onDone = () => { old?.(); res(); }; });
}
