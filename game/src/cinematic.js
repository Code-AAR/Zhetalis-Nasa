// Full-screen player for the Blender-made sequences in animation/glb/ (see animation/README.md).
// Each GLB carries its own camera and named clips; captions come from <name>.captions.json next to it.
//   playCinematic('briefing_mission')                        -> Promise that resolves when it ends or is skipped
//   playCinematic('failure_solar_panel', { clip: 'panel_failure', world })   (pauses the game while it plays)
//   const loop = loopCinematic('cruise_loop', parentElement)  -> { stop() }  (loading-screen background)
// Click, Space, Enter or Esc skips. With reduced motion, or if the file can't load, it resolves at once so the
// game always carries on.
import * as THREE from 'three';
import { loadModel } from './nasamodels.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Crew slots: the Blender films mark where each crew member stands and what they do (empties with crew_* extras);
// the real Mixamo characters from assets/crew are loaded there and retargeted exactly like src/hab-crew.js does.
const crewLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const crewCache = new Map();
const crewFile = f => { if (!crewCache.has(f)) crewCache.set(f, crewLoader.loadAsync('assets/crew/' + f)); return crewCache.get(f); };
const norm = n => n.replace(/^mixamorig\d*:?/, '').replace(/_\d+$/, '');
async function fillCrewSlots(root, mixers) {
  const slots = []; root.traverse(o => { if (o.userData?.crew_char) slots.push(o); });
  if (!slots.length) return;
  const clips = (await crewFile('crew-anims.glb')).animations;
  await Promise.all(slots.map(async slot => {
    const d = slot.userData, g = await crewFile(d.crew_char + '.glb');
    const { clone } = await import('three/addons/utils/SkeletonUtils.js');
    const model = clone(g.scene);
    model.updateWorldMatrix(true, true);
    const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y || 1;
    model.scale.multiplyScalar((d.crew_height || 1.7) / h);
    const tint = d.crew_tint && new THREE.Color(...d.crew_tint), match = d.crew_tint_match && new RegExp(d.crew_tint_match);
    model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (tint && match.test(o.name)) { o.material = o.material.clone(); o.material.color.multiply(tint); } } });
    slot.add(model);
    const byName = {};
    model.traverse(o => { if (/^mixamorig/.test(o.name) && norm(o.parent?.name ?? '') !== norm(o.name)) (byName[norm(o.name)] ??= []).push(o.name); });
    const src = THREE.AnimationClip.findByName(clips, d.crew_clip) || clips[0], tracks = [];
    for (const t of src.tracks) { const i = t.name.lastIndexOf('.'), node = t.name.slice(0, i), prop = t.name.slice(i + 1); for (const target of byName[norm(node)] ?? []) { const k = t.clone(); k.name = target + '.' + prop; tracks.push(k); } }
    const mixer = new THREE.AnimationMixer(model), act = mixer.clipAction(new THREE.AnimationClip(src.name, src.duration, tracks));
    act.play(); act.time = (d.crew_offset || 0) * src.duration; mixer.timeScale = d.crew_speed || 1;
    mixers.push(mixer);
  }));
}

const BASE = '../animation/glb/';                     // loadModel() prefixes 'assets/'
const LOOKS = {                                        // background, hemisphere sky/ground, sun colour
  space: { bg: '#000', sky: '#9fb3ff', ground: '#000', sun: '#fff6ea', hemi: .35, sunI: 3.2 },
  room: { bg: '#05070d', sky: '#8fb4ff', ground: '#201008', hemi: .9, sunI: 1.6, glow: true, bars: true },   // the briefing room
  solar: { bg: '#000', sky: '#9fb3ff', ground: '#000', sun: '#fff6ea', hemi: .2, sunI: 3.2, point: true },   // lit by the Sun at the centre
  earth: { bg: '#9db8dc', sky: '#cfe2ff', ground: '#5d6b45', sun: '#fff4e2', hemi: 1.2, sunI: 3.0 },
  mars: { bg: '#c49a78', sky: '#f2d2b4', ground: '#6b3d26', sun: '#ffe6c8', hemi: 1.1, sunI: 2.6, fog: [160, 1400] },
};
const LOOK_OF = { ares_vi_briefing: 'room', briefing_mission: 'solar', launch_earth: 'earth', cruise_loop: 'space', mars_approach: 'space' };
const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const captionsCache = new Map();
function captionsFor(name) {
  if (!captionsCache.has(name)) captionsCache.set(name, fetch(`animation/glb/${name}.captions.json`).then(r => r.ok ? r.json() : null).catch(() => null));
  return captionsCache.get(name);
}

// One stage: its own canvas and renderer, so the game's renderer and scene are never touched.
async function stage(name, parent, { clip, loop = false } = {}) {
  const [gltf, caps] = await Promise.all([loadModel(BASE + name + '.glb'), captionsFor(name)]);
  if (!gltf) throw new Error('could not load ' + name);
  const look = LOOKS[LOOK_OF[name] || 'mars'];
  const canvas = document.createElement('canvas'); canvas.className = 'cine-canvas';
  parent.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(look.bg);
  if (look.fog) scene.fog = new THREE.Fog(look.bg, ...look.fog);
  scene.add(new THREE.HemisphereLight(look.sky, look.ground, look.hemi));
  const sun = look.point ? new THREE.PointLight(look.sun, look.sunI, 0, 0) : new THREE.DirectionalLight(look.sun, look.sunI);
  if (!look.point) sun.position.set(-300, 500, 260);
  scene.add(sun);
  if (look.glow) { const g = new THREE.PointLight('#ff7a3d', 6, 9, 1.5); g.position.set(0, 1.6, 0); scene.add(g);
    const key = new THREE.SpotLight('#ffffff', 40, 20, .8, .5, 1.5); key.position.set(0, 6, 3); scene.add(key); }
  const root = gltf.scene.clone(true); scene.add(root);    // loadModel caches the file; play a fresh copy
  const cams = []; root.traverse(o => { if (o.isCamera) cams.push(o); });
  const cam = cams[0] || new THREE.PerspectiveCamera(40, 1, .5, 60000);
  const clips = gltf.animations;
  const c = (clip && THREE.AnimationClip.findByName(clips, clip)) || clips[0];
  const crewMixers = [];
  await fillCrewSlots(root, crewMixers).catch(e => console.warn('Crew could not load:', e));
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(c); action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); action.clampWhenFinished = true; action.play();
  const info = caps?.clips?.find(x => x.name === c.name) || { start: 0 };
  const lines = (caps?.captions || []).map(l => ({ ...l, t0: l.t0 - info.start, t1: l.t1 - info.start })).filter(l => l.t1 > 0.05 && l.t0 < c.duration - 0.05);   // ignore rounding overlaps with the next clip
  const sunFactor = root.getObjectByName('sun_factor');
  return {
    duration: c.duration, lines, bars: !!look.bars,
    frame(dt) {
      mixer.update(dt); for (const m of crewMixers) m.update(dt);
      if (sunFactor) sun.intensity = look.sunI * sunFactor.scale.x;
      const w = parent.clientWidth || innerWidth, h = parent.clientHeight || innerHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      return action.time;
    },
    dispose() { renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove(); root.traverse(o => { o.geometry?.dispose?.(); }); },
  };
}

export function playCinematic(name, { clip, world } = {}) {
  if (reduced()) return Promise.resolve(false);
  return new Promise(resolve => {
    const box = document.createElement('section'); box.className = 'cinematic'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cutscene');
    box.innerHTML = '<p class="cine-phase"></p><p class="cine-cap" aria-live="polite"></p><button type="button" class="cine-skip">Skip ›</button><p class="cine-load">Loading…</p>';
    document.body.append(box);
    const cap = box.querySelector('.cine-cap'), phase = box.querySelector('.cine-phase');
    let st = null, raf = 0, done = false, last = performance.now();
    if (world) { world.cinematic = true; for (const k of Object.keys(world.keys || {})) world.keys[k] = false; }
    const end = played => {
      if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true);
      st?.dispose(); box.classList.add('cine-out');
      setTimeout(() => box.remove(), 400);
      if (world) world.cinematic = false;
      resolve(played);
    };
    const key = e => { if (['Escape', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); end(true); } };
    addEventListener('keydown', key, true);
    box.querySelector('.cine-skip').onclick = () => end(true);
    box.onclick = e => { if (e.target === box || e.target.tagName === 'CANVAS') end(true); };
    stage(name, box, { clip }).then(s => {
      if (done) { s.dispose(); return; }
      st = s; box.querySelector('.cine-load').remove(); last = performance.now();
      box.classList.toggle('cine-bars', st.bars);
      const tick = now => {
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        const t = st.frame(dt);
        const l = st.lines.find(l => t >= l.t0 && t < l.t1), key = l ? l.t0 + l.text : '';
        if (cap.dataset.key !== key) {              // speaker on its own line, then the words
          cap.dataset.key = key; cap.textContent = '';
          if (l?.who) { const w = document.createElement('b'); w.className = 'cine-who'; w.textContent = l.who; cap.append(w); }
          if (l) cap.append(l.text);
          phase.textContent = l?.phase || '';
        }
        if (t >= st.duration - 1e-3) return end(true);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch(err => { console.warn('Cutscene unavailable:', name, err); end(false); });
  });
}

// Looping background (the loading screen during the trip). Captions show under it; stop() removes it.
export function loopCinematic(name, parent) {
  let st = null, raf = 0, stopped = false, last = performance.now();
  const holder = document.createElement('div'); holder.className = 'cine-loop'; parent.prepend(holder);
  const cap = document.createElement('p'); cap.className = 'cine-cap'; holder.append(cap);
  if (!reduced()) stage(name, holder, { loop: true }).then(s => {
    if (stopped) return s.dispose();
    st = s;
    const tick = now => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const t = st.frame(dt) % st.duration;
      cap.textContent = st.lines.find(l => t >= l.t0 && t < l.t1)?.text || '';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }).catch(err => console.warn('Loading-screen animation unavailable:', err));
  return { stop() { stopped = true; cancelAnimationFrame(raf); st?.dispose(); holder.remove(); } };
}
