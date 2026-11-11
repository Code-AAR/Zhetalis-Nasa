// The crew who live in the hab (fictional). Simple, stylised people on a daily routine that follows the sol clock:
// asleep in their cabins at night (doors shut), breakfast and a treadmill run in the morning, work during the day,
// dinner together at the Wardroom table in the evening. Talk to them with E.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Realistic crew: Mixamo characters (converted to compressed GLB in assets/crew/) driven by Mixamo animations.
// If a file is missing or fails to load, that crewmate keeps the simple built-in figure below.
export const CREW_MODELS = { amara: 'ch48.glb', meilin: 'ch22.glb', mateo: 'ch23.glb' };   // Ch48 flight-suit woman = commander Freya, Ch22 = Mei Lin, Ch23 = Mateo
const HEIGHT = { amara: 1.72, meilin: 1.62, mateo: 1.79 };   // metres
const CLIP = { sit: 'sit', eat: 'eat', run: 'run', work: 'idle', drink: 'drink', sleep: 'sleep' };

// Merge a group's direct (non-moving) mesh children by material: fewer draw calls per person.
function mergeStatic(group) {
  group.updateMatrix(); const byMat = new Map();
  for (const o of [...group.children]) if (o.isMesh) { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); o.updateMatrix(); g.applyMatrix4(o.matrix); (byMat.get(o.material) ?? byMat.set(o.material, []).get(o.material)).push(g); group.remove(o); }
  for (const [m, list] of byMat) group.add(new THREE.Mesh(mergeGeometries(list, false), m));
}

const skinTones = { amara: '#6b4632', meilin: '#e2b994', mateo: '#b98563' };
const hairStyles = { amara: 'curls', meilin: 'bob', mateo: 'short' };

function std(c, r = .85) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }
function capsule(r, len, m) { const g = new THREE.CapsuleGeometry(r, len, 4, 10); const o = new THREE.Mesh(g, m); return o; }

// A jointed figure about 1.7 m tall, facing +z. Limbs hang from pivots so poses are just rotations.
function figure(p) {
  const skin = std(skinTones[p.id] ?? '#c99a7a', .7), shirt = std(p.colour, .9), pants = std('#2b3447', .95), shoe = std('#e9ecef', .7), hairM = std(p.id === 'meilin' ? '#14110f' : '#1e1612', 1);
  const root = new THREE.Group(), hips = new THREE.Group(); root.rotation.order = 'YXZ'; hips.position.y = .93; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = capsule(.16, .36, shirt); body.scale.set(1.15, 1, .78); body.position.y = .32; torso.add(body);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .1, 14), pants); belt.scale.set(1.12, 1, .8); belt.position.y = .06; torso.add(belt);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(.035, 12), std('#f2c230', .6)); patch.position.set(-.1, .46, .128); torso.add(patch);   // mission patch on the shirt
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.05, .055, .08, 10), skin); neck.position.y = .63; torso.add(neck);
  const head = new THREE.Group(); head.position.y = .76; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 12), skin); skull.scale.set(.95, 1.15, 1.02); head.add(skull);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), skin); ear.position.set(s * .1, 0, 0); head.add(ear); }
  const eyeM = std('#1a1a1a', .3); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 4), eyeM); e.position.set(s * .038, .02, .095); head.add(e); }
  const style = hairStyles[p.id];
  if (style === 'curls') { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, c = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), hairM); c.position.set(Math.cos(a) * .085, .07 + (i % 2) * .02, Math.sin(a) * .085 - .01); head.add(c); } const top = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), hairM); top.position.y = .08; top.scale.y = .6; head.add(top); }
  else if (style === 'bob') { const cap = new THREE.Mesh(new THREE.SphereGeometry(.118, 16, 12, 0, Math.PI * 2, 0, Math.PI * .62), hairM); cap.position.y = .01; cap.rotation.x = -.25; head.add(cap); const fringe = new THREE.Mesh(new THREE.BoxGeometry(.17, .04, .04), hairM); fringe.position.set(0, .085, .085); head.add(fringe); }
  else { const cap = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * .45), hairM); cap.position.y = .02; cap.rotation.x = -.3; head.add(cap); const beard = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8, 0, Math.PI * 2, Math.PI * .55, Math.PI * .45), hairM); beard.position.set(0, -.01, .015); head.add(beard); }
  const limb = (parent, x, y, r1, l1, r2, l2, m1, m2, endM, foot) => {
    const top = new THREE.Group(); top.position.set(x, y, 0); parent.add(top);
    const a = capsule(r1, l1, m1); a.position.y = -l1 / 2 - r1 * .3; top.add(a);
    const joint = new THREE.Group(); joint.position.y = -l1 - r1 * .4; top.add(joint);
    const b = capsule(r2, l2, m2); b.position.y = -l2 / 2 - r2 * .3; joint.add(b);
    const end = foot ? new THREE.Mesh(new THREE.BoxGeometry(.1, .07, .24), endM) : new THREE.Mesh(new THREE.SphereGeometry(r2 * 1.1, 8, 6), endM);
    end.position.set(0, -l2 - r2 * .6, foot ? .06 : 0); joint.add(end);
    return { top, joint };
  };
  const arms = [-1, 1].map(s => limb(torso, s * .23, .55, .052, .24, .045, .22, shirt, skin, skin, false));
  const legs = [-1, 1].map(s => limb(hips, s * .095, 0, .075, .36, .06, .36, pants, pants, shoe, true));
  for (const a of arms) a.top.rotation.z = 0;
  mergeStatic(head); mergeStatic(torso); for (const l of [...arms, ...legs]) { mergeStatic(l.joint); mergeStatic(l.top); }
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { root, hips, torso, head, arms, legs };
}

function pose(f, kind, t, phase = 0) {
  const [aL, aR] = f.arms, [lL, lR] = f.legs, breath = Math.sin(t * 1.6 + phase) * .012;
  f.root.rotation.set(0, f.root.rotation.y, 0); f.hips.position.set(0, .93, 0); f.torso.rotation.set(0, 0, 0); f.head.rotation.set(0, 0, 0);
  for (const l of [aL, aR, lL, lR]) { l.top.rotation.set(0, 0, 0); l.joint.rotation.set(0, 0, 0); }
  aL.top.rotation.z = -.08; aR.top.rotation.z = .08; f.torso.scale.set(1, 1 + breath, 1);
  if (kind === 'sit' || kind === 'eat') {
    f.hips.position.y = .53; lL.top.rotation.x = lR.top.rotation.x = -Math.PI / 2 + .1; lL.joint.rotation.x = lR.joint.rotation.x = Math.PI / 2 - .1;
    aL.top.rotation.x = -.55; aL.joint.rotation.x = -.9; aR.top.rotation.x = -.55; aR.joint.rotation.x = -.9; f.torso.rotation.x = .08;
    if (kind === 'eat') { const k = Math.max(0, Math.sin(t * .9 + phase)); aR.top.rotation.x = -.55 - k * .5; aR.joint.rotation.x = -.9 - k * 1.1; f.head.rotation.x = -.05 * k; }
    f.head.rotation.y = Math.sin(t * .3 + phase) * .35;   // looking round the table at the others
  } else if (kind === 'run') {
    const s = Math.sin(t * 9 + phase);
    lL.top.rotation.x = s * .65; lR.top.rotation.x = -s * .65; lL.joint.rotation.x = Math.max(0, -s) * 1.1 + .2; lR.joint.rotation.x = Math.max(0, s) * 1.1 + .2;
    aL.top.rotation.x = -s * .6; aR.top.rotation.x = s * .6; aL.joint.rotation.x = aR.joint.rotation.x = -1.3;
    f.hips.position.y = .93 + Math.abs(Math.cos(t * 9 + phase)) * .04; f.torso.rotation.x = .12;
  } else if (kind === 'work') {
    aL.top.rotation.x = -.85 + Math.sin(t * 1.3 + phase) * .08; aR.top.rotation.x = -.7 + Math.sin(t * 2.1 + phase) * .15; aL.joint.rotation.x = aR.joint.rotation.x = -.6;
    f.head.rotation.x = .18; f.head.rotation.y = Math.sin(t * .4 + phase) * .2;
  } else if (kind === 'drink') {
    aR.top.rotation.x = -.5 - Math.max(0, Math.sin(t * .7 + phase)) * .4; aR.joint.rotation.x = -1.7; f.head.rotation.y = Math.sin(t * .25 + phase) * .4;
  } else if (kind === 'sleep') {
    f.root.rotation.x = -Math.PI / 2; aL.top.rotation.z = -.15; aR.top.rotation.z = .15; f.head.rotation.y = .3; f.torso.scale.set(1, 1 + breath * .6, 1);
  }
}

// What each crewmate is doing at a given time of sol (0..1). Spots come from hab-dressing.js.
const ROUTINE = {
  amara: f => f < .22 || f >= .9 ? 'bed' : f < .32 ? 'galley' : f < .72 ? 'power' : 'table0',
  meilin: f => f < .24 || f >= .9 ? 'bed' : f < .32 ? 'table1' : f < .72 ? 'lab' : 'table1',
  mateo: f => f < .2 || f >= .9 ? 'bed' : f < .32 ? 'treadmill' : f < .72 ? 'lifesupport' : 'table2',
};
const LINES = {
  amara: { bed: 'Asleep. Quiet hours.', galley: '"Morning! Coffee first, then we check the batteries. The night heater ate a lot of charge."', power: '"Watching the power split. Life support always comes first, then science, then comfort."', table0: '"Dinner together every night. It is the best part of the sol. My kids ask what we eat — I say: whatever grew."' },
  meilin: { bed: 'Asleep. Quiet hours.', table1: '"I sketch the rocks we brought back while I eat. Home Plate has layers like a kueh lapis."', lab: '"These samples are from the sites Spirit visited. I compare them with what the rover saw twenty years ago."' },
  mateo: { bed: 'Asleep. Quiet hours.', treadmill: '"Two hours of exercise every day, like on the ISS — or my bones and muscles get weaker in the low gravity."', lifesupport: '"Swapping a filter in the CO₂ scrubber. If this stops, we notice in hours, not days."', table2: '"Who wants to hear a song after dinner? Bruno — my dog — always howled at this one."' },
};

function patchTexture(colour) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#2b3a67'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#d9683a'; g.beginPath(); g.arc(72, 76, 28, 0, 7); g.fill();
  g.strokeStyle = colour; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke(); g.fillStyle = '#fff'; for (let i = 0; i < 9; i++) g.fillRect(20 + i * 11 % 80, 24 + i * 17 % 40, 3, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
async function loadRealCrew(I, people) {
  const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), base = 'assets/crew/';
  let clips;
  try { clips = (await gl.loadAsync(base + 'crew-anims.glb')).animations; } catch { return; }
  for (const person of people) {
    const file = CREW_MODELS[person.p.id]; if (!file) continue;
    let gltf; try { gltf = await gl.loadAsync(base + file); } catch { continue; }
    const model = gltf.scene, holder = new THREE.Group(); holder.rotation.order = 'YXZ'; holder.add(model);
    model.updateWorldMatrix(true, true);
    const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y || 1;
    model.scale.multiplyScalar((HEIGHT[person.p.id] ?? 1.7) / h);
    model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; if (o.material) { o.material.roughness = Math.max(.6, o.material.roughness ?? .8); } } });
    // Mixamo numbers its skeletons differently per download (mixamorig2Hips vs mixamorig7Hips) and the export can
    // duplicate bones (Hips, Hips_1): match by the plain bone name and drive every copy.
    const norm = n => n.replace(/^mixamorig\d*:?/, '').replace(/_\d+$/, ''), byName = {};
    // The FBX gives each body part its own copy of some bones. A copy nested directly inside a same-named bone just
    // follows it (driving it too would double the turn); every other copy needs driving.
    model.traverse(o => { if (/^mixamorig/.test(o.name) && norm(o.parent?.name ?? '') !== norm(o.name)) (byName[norm(o.name)] ??= []).push(o.name); });
    const mixer = new THREE.AnimationMixer(model), actions = {};
    for (const c of clips) {
      const tracks = [];
      for (const t of c.tracks) { const i = t.name.lastIndexOf('.'), node = t.name.slice(0, i), prop = t.name.slice(i + 1); for (const target of byName[norm(node)] ?? []) { const k = t.clone(); k.name = target + '.' + prop; tracks.push(k); } }
      actions[c.name] = mixer.clipAction(new THREE.AnimationClip(c.name, c.duration, tracks));
    }
    let head = null, chest = null, hipsB = null; model.traverse(o => { if (/Head$/.test(o.name) && !head) head = o; if (/Spine2$/.test(o.name) && !chest) chest = o; if (/Hips$/.test(o.name) && !hipsB) hipsB = o; });
    if (chest) {   // mission patch on the chest (sized in the bone's own units, which are centimetres from the Mixamo file)
      const k = 1 / (chest.getWorldScale(new THREE.Vector3()).x || 1), patch = new THREE.Mesh(new THREE.CircleGeometry(.035 * k, 20), new THREE.MeshStandardMaterial({ map: patchTexture(person.p.colour), roughness: .8 }));
      patch.position.set(-.07 * k, .07 * k, .115 * k); patch.name = 'crew-patch'; chest.add(patch); person.patch = patch;
    }
    // swap the simple figure for the real one, in the same spot
    const old = person.f.root; holder.position.copy(old.position); holder.rotation.y = old.rotation.y; holder.visible = old.visible;
    old.removeFromParent(); I.scene.add(holder);
    person.f = { root: holder, real: { model, mixer, actions, head, bones: { hips: hipsB }, current: null } }; person.spot = null;
  }
}
function playReal(person, kind, dt, t, I) {
  const r = person.f.real, name = CLIP[kind] ?? 'idle', next = r.actions[name] ?? r.actions.idle;
  if (next && r.current !== next) { next.reset().setEffectiveWeight(1).fadeIn(.35).play(); r.current?.fadeOut(.35); r.current = next; next.time = (person.k * 3.1) % (next.getClip().duration || 1); }
  // undo last frame's look-turn first: clips that don't key this head bone would otherwise add it up every frame (the spinning heads)
  if (r.head) { r.headBase ??= r.head.quaternion.clone(); r.head.quaternion.copy(r.headBase); }
  r.mixer.update(dt);
  if (r.head) r.headBase.copy(r.head.quaternion);
  // Mixamo's sleeping pose lies on the floor in its own direction: line it up with the bunk (head to the pillow) and
  // lift it onto the mattress. Worked out once from where the head and hips end up.
  if (kind === 'sleep' && !r.sleepFit && r.current?.getEffectiveWeight() > .98) {
    const hips = r.bones?.hips, head = r.head; if (hips && head) {
      r.model.rotation.set(0, 0, 0); r.model.position.set(0, 0, 0); r.model.updateWorldMatrix(true, true);
      const root = person.f.root, inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const hp = hips.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), hd = head.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      const turn = Math.atan2(hd.x - hp.x, hd.z - hp.z) - Math.PI;   // make head point along -z (towards the pillow)
      r.model.rotation.y = -turn; r.model.updateWorldMatrix(true, true);
      const hp2 = hips.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      r.model.position.set(-hp2.x, .6 - Math.min(hp2.y, .15) + .02, -hp2.z); r.sleepFit = true;
    }
  } else if (kind !== 'sleep' && r.sleepFit) { r.model.rotation.set(0, 0, 0); r.model.position.set(0, 0, 0); r.sleepFit = false; }
  // look at you when you're close (not while asleep or running)
  if (r.head && kind !== 'sleep' && kind !== 'run') {
    const root = person.f.root, dx = I.pos.x - root.position.x, dz = I.pos.z - root.position.z, d = Math.hypot(dx, dz);
    let want = 0; if (d < 3.5) { let a = Math.atan2(dx, dz) - root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); want = Math.max(-.9, Math.min(.9, a)) * (1 - d / 3.5 * .5); }
    person.look = THREE.MathUtils.lerp(person.look ?? 0, want, Math.min(1, dt * 3)); r.head.rotateY(person.look);
  }
}
const REAL_OFFSET = { sleep: { y: 0, pitch: 0, yaw: 0 } };   // tuned per animation after testing

export function createCrew(I, CREW) {
  const people = CREW.filter(c => c.id !== 'you').map((p, k) => { const f = figure(p); f.root.visible = false; I.scene.add(f.root); return { p, f, k, spot: null }; });
  const tmpV = new THREE.Vector3();
  const place = (person, spotName) => {
    const s = I.habSpots[spotName]; if (!s) { person.f.root.visible = false; return; }
    s.group.updateWorldMatrix(true, false);
    tmpV.copy(person.f.real && s.realLocal ? s.realLocal : s.local); s.group.localToWorld(tmpV); I.scene.worldToLocal(tmpV);
    person.f.root.position.copy(tmpV); person.f.root.rotation.y = s.group.rotation.y + (s.yaw ?? 0) + (s.group.parent?.rotation?.y ?? 0);
    person.kind = s.pose; person.spot = spotName; person.f.root.visible = true;
  };
  const talk = [];   // live 'talk to' stations
  let last = performance.now(), t = 0;
  I.updateCrew = (frac, crewCount) => {
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; t += dt;
    for (const person of people) {
      const here = CREW.indexOf(person.p) < crewCount;
      if (!here) { person.f.root.visible = false; continue; }
      let want = ROUTINE[person.p.id](frac);
      if (want === 'bed') want = 'bed-' + person.p.id;
      if (want !== person.spot) place(person, want);
      if (person.f.root.visible) { const near = Math.abs(person.f.root.position.x - I.pos.x) < 16; person.f.root.children[0].visible = near; if (near) person.f.real ? playReal(person, person.kind, dt, t, I) : pose(person.f, person.kind, t, person.k * 1.7); }
    }
    // doors shut while someone sleeps inside; treadmill hum only while it is in use
    for (const c of I.habCabins ?? []) { const id = c.person.id, sleeping = people.some(pp => pp.p.id === id && pp.spot === 'bed-' + id && pp.f.root.visible); c.openDoor.visible = c.lived.visible && !sleeping; c.sleepDoor.visible = c.lived.visible && sleeping; }
    I.habTreadmill = people.some(pp => pp.spot === 'treadmill' && pp.f.root.visible);
    // talk stations follow the people
    for (const st of talk) I.stations.splice(I.stations.indexOf(st), 1); talk.length = 0;
    for (const person of people) {
      if (!person.f.root.visible) continue;
      const sleeping = person.spot.startsWith('bed'), pos = person.f.root.position, line = LINES[person.p.id][sleeping ? 'bed' : person.spot] ?? '';
      if (sleeping) continue;   // asleep behind a closed door: let them be
      const st = { type: 'hab-note', priority: .9, label: `talk to ${person.p.first}`, x: pos.x, z: pos.z, title: `${person.p.first} · ${person.p.role}`, html: `<p>${line}</p><p class="source">${person.p.first} is a fictional crewmate. Home: ${person.p.home}.</p>` };
      talk.push(st); I.stations.push(st);
    }
  };
  I.crewBodies = people;
  loadRealCrew(I, people);
  return people;
}
