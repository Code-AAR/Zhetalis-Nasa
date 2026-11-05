// One lightweight scene for all three menu globes. Textured maps are archived
// NASA imagery, not live camera views; the optional EPIC link is dated separately.
import * as THREE from 'three';
import { latLonDir } from './globe.js';

const BODIES = {
  mars: { name: 'Mars', context: 'Your destination', description: 'A small step for you. A new home for your crew.', credit: 'Surface map: NASA 3D Resources · Rendered globe', map: 'mars-map.jpg', colour: '#b87550' },
  earth: { name: 'Earth', context: 'Where your journey begins', description: 'Home, mission control, and the crew cheering you on.', credit: 'Surface map: NASA Blue Marble · Rendered globe', map: 'earth-map.jpg', colour: '#577e9c' },
  moon: { name: 'The Moon', context: 'A future destination', description: 'Our nearest neighbour. Moon missions are coming later.', credit: 'Surface map: NASA SVS / Ernie Wright · LRO / LROC · Rendered globe', map: 'moon-map.jpg', colour: '#96948e' },
};
// Equatorial diameters, km: NASA's Planetary Fact Sheet.
// Orthographic projection keeps these ratios the same everywhere on screen.
// Positions compress the distances for the menu, but never change body sizes.
const DIAMETERS = { earth: 12756, moon: 3475, mars: 6792 };
const POSITIONS = { earth: [-1.3, .25, 0], moon: [.2, -.95, 0], mars: [1.4, .25, 0] };
const EARTH_RADIUS = 1.18;
const MISSION = 'mars';
// A tilted circular orbit: compressed distance and accelerated time for the
// menu, while the Moon/Earth diameter ratio stays physically proportional.
const MOON_ORBIT_RADIUS = 1.8;
const ORBIT_SECONDS = 60;
const ORBIT_TILT = Math.PI / 3;

export function initMissionMenu() {
  const canvas = document.querySelector('#menu-globes');
  const stage = canvas.parentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer, alive = true, selected = 'mars', frame = 0;
  const groups = {}, resources = [], textures = [], surfaces = [];
  const motion = {}, listeners = [];
  let drag = null;
  let orbitAngle = .65;
  const annotations = [...stage.querySelectorAll('.planet-annotation')];
  const tabs = [...document.querySelectorAll('[data-planet]')];
  let earthData;

  function select(name) {
    selected = name;
    const body = BODIES[name];
    document.querySelector('#planet-name').textContent = body.name;
    document.querySelector('#planet-context').textContent = body.context;
    document.querySelector('#planet-description').textContent = `${body.description} Diameter: ${DIAMETERS[name].toLocaleString('en-US')} km.`;
    document.querySelector('#planet-credit').textContent = body.credit;
    document.querySelector('#planet-status').textContent = `${body.name}. ${body.description}`;
    tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.planet === name)));
    // Browsing a preview changes the information, never the physical scale or
    // the mission marker. Only Mars is currently a playable destination.
    stage.dataset.mission = MISSION;
    const fallback = stage.querySelector('.planet-fallback');
    fallback.style.backgroundImage = `url("assets/${body.map}")`;
    const photo = document.querySelector('#menu-earth-photo');
    photo.classList.toggle('hidden', name !== 'earth' || !earthData?.src);
    draw();
  }
  tabs.forEach(button => button.addEventListener('click', () => select(button.dataset.planet)));
  fetch('data/menu-space-data.json').then(r => r.ok ? r.json() : null).then(data => {
    if (!alive) return;
    earthData = data?.earth;
    if (earthData?.src?.startsWith('https://epic.gsfc.nasa.gov/archive/')) {
      const photo = document.querySelector('#menu-earth-photo');
      photo.href = earthData.src;
      photo.textContent = `NASA EPIC Earth photo · ${String(earthData.when).slice(0, 10)} · Archived ↗`;
      if (groups.earth && Number.isFinite(earthData.centre?.lat) && Number.isFinite(earthData.centre?.lon)) {
        groups.earth.children[0].quaternion.setFromUnitVectors(latLonDir(earthData.centre.lat, earthData.centre.lon), new THREE.Vector3(0, 0, 1));
      }
      photo.classList.toggle('hidden', selected !== 'earth');
      draw();
    } else earthData = null;
  }).catch(() => { /* The three bundled surface maps still work. */ });

  let scene, camera, observer;
  function moonPosition(angle) {
    return new THREE.Vector3(
      POSITIONS.earth[0] + Math.cos(angle) * MOON_ORBIT_RADIUS,
      POSITIONS.earth[1] + Math.sin(angle) * MOON_ORBIT_RADIUS * Math.cos(ORBIT_TILT),
      POSITIONS.earth[2] + Math.sin(angle) * MOON_ORBIT_RADIUS * Math.sin(ORBIT_TILT),
    );
  }
  function draw() {
    if (!renderer || !alive || document.hidden) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const ratio = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      renderer.setSize(w, h, false);
      const aspect = w / h, vertical = Math.max(1.8, 3.55 / aspect);
      camera.left = -vertical * aspect; camera.right = vertical * aspect;
      camera.top = vertical; camera.bottom = -vertical;
      camera.updateProjectionMatrix();
    }
    for (const label of annotations) {
      const key = label.dataset.body;
      const { x, y, z } = groups[key]?.position || new THREE.Vector3(...POSITIONS[key]);
      const radius = EARTH_RADIUS * DIAMETERS[key] / DIAMETERS.earth;
      const above = key === 'moon' && y > POSITIONS.earth[1];
      const point = new THREE.Vector3(x, y + (above ? radius + .13 : -radius - .18), z).project(camera);
      label.style.left = `${(point.x + 1) / 2 * 100}%`;
      label.style.top = `${(1 - point.y) / 2 * 100}%`;
      label.style.transform = above ? 'translate(-50%, -100%)' : 'translateX(-50%)';
      // Do not label the Moon through Earth during the far half of its orbit.
      label.hidden = key === 'moon' && z < POSITIONS.earth[2] &&
        Math.hypot(x - POSITIONS.earth[0], y - POSITIONS.earth[1]) < EARTH_RADIUS - radius * .3;
    }
    renderer.render(scene, camera);
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 30);
    camera.position.set(0, 0, 8);
    scene.add(new THREE.AmbientLight('#d6e1ef', .65));
    const sun = new THREE.DirectionalLight('#fff3df', 3.2); sun.position.set(-3, 3, 5); scene.add(sun);
    const geometry = new THREE.SphereGeometry(1, 64, 48); resources.push(geometry);
    for (const [key, body] of Object.entries(BODIES)) {
      const group = new THREE.Group(); groups[key] = group; scene.add(group);
      group.position.set(...POSITIONS[key]);
      group.scale.setScalar(EARTH_RADIUS * DIAMETERS[key] / DIAMETERS.earth);
      motion[key] = { vx: 0, vy: 0, last: -Infinity };
      const material = new THREE.MeshStandardMaterial({ color: body.colour, roughness: .95 }); resources.push(material);
      const mesh = new THREE.Mesh(geometry, material); mesh.rotation.y = key === 'mars' ? 1.1 : -.5; group.add(mesh);
      mesh.userData.planet = key; surfaces.push(mesh);
      const texture = new THREE.TextureLoader().load('assets/' + body.map, t => {
        if (!alive) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
        material.map = t; material.color.set('#ffffff'); material.needsUpdate = true; draw();
      }, undefined, () => {
        if (selected === key) document.querySelector('#planet-credit').textContent = `${body.name} surface map unavailable · Simplified globe`;
      });
      textures.push(texture);
    }
    groups.moon.position.copy(moonPosition(orbitAngle));
    const orbitPoints = Array.from({ length: 128 }, (_, i) => moonPosition(i / 128 * Math.PI * 2));
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: '#89969f', transparent: true, opacity: .3 });
    scene.add(new THREE.LineLoop(orbitGeometry, orbitMaterial));
    resources.push(orbitGeometry, orbitMaterial);
    // A fixed, camera-facing outline marks the actual mission destination.
    // Keep it outside the rotating group so it never tilts with a drag.
    const missionRadius = groups[MISSION].scale.x;
    const ringGeometry = new THREE.RingGeometry(missionRadius + .08, missionRadius + .095, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#f4c485', transparent: true, opacity: .95, side: THREE.DoubleSide });
    const missionRing = new THREE.Mesh(ringGeometry, ringMaterial);
    missionRing.position.set(...POSITIONS[MISSION]); scene.add(missionRing);
    resources.push(ringGeometry, ringMaterial);
    // Hit-test the actual spheres, independently of the information tabs. Lock
    // a drag to its starting globe, even if the cursor crosses another one.
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const hit = event => {
      const box = canvas.getBoundingClientRect();
      pointer.set((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1);
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(surfaces, false)[0]?.object.userData.planet;
    };
    const listen = (type, handler) => { canvas.addEventListener(type, handler); listeners.push([type, handler]); };
    const hover = event => {
      const key = hit(event);
      canvas.style.cursor = key ? 'grab' : 'default';
      canvas.dataset.hoveredPlanet = key || '';
    };
    canvas.style.touchAction = 'pan-y';
    listen('pointerdown', event => {
      if (drag || event.button !== 0 || !event.isPrimary) return;
      const key = hit(event);
      if (!key) return;
      drag = { key, id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
      Object.assign(motion[key], { vx: 0, vy: 0, last: performance.now() });
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
      canvas.dataset.draggingPlanet = key;
    });
    listen('pointermove', event => {
      if (!drag) { hover(event); return; }
      if (event.pointerId !== drag.id) return;
      const now = performance.now(), elapsed = Math.max((now - drag.time) / 1000, 1 / 120);
      const dx = (event.clientX - drag.x) * .012, dy = (event.clientY - drag.y) * .012;
      const group = groups[drag.key], velocity = motion[drag.key];
      group.rotation.y += dx; group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy, -.65, .65);
      velocity.vx = THREE.MathUtils.clamp(dx / elapsed, -5, 5);
      velocity.vy = THREE.MathUtils.clamp(dy / elapsed, -3, 3); velocity.last = now;
      Object.assign(drag, { x: event.clientX, y: event.clientY, time: now });
      draw();
    });
    const release = event => {
      if (!drag || event.pointerId !== drag.id) return;
      const velocity = motion[drag.key];
      if (event.type !== 'pointerup' || performance.now() - drag.time > 100 || reduced.matches) velocity.vx = velocity.vy = 0;
      velocity.last = performance.now();
      drag = null; delete canvas.dataset.draggingPlanet;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      hover(event);
    };
    listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', release);
    listen('pointerleave', () => { if (!drag) { canvas.style.cursor = 'default'; delete canvas.dataset.hoveredPlanet; } });
    select('mars'); stage.classList.add('has-globes');
    observer = new ResizeObserver(draw); observer.observe(stage);
    let previous = performance.now();
    const tick = now => {
      if (!alive) return;
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      if (!document.hidden && !reduced.matches) {
        // Let the user grab the Moon without the orbit pulling it away.
        if (drag?.key !== 'moon' && canvas.dataset.hoveredPlanet !== 'moon' && performance.now() - motion.moon.last > 1500) {
          orbitAngle += dt * Math.PI * 2 / ORBIT_SECONDS;
          groups.moon.position.copy(moonPosition(orbitAngle));
        }
        for (const [key, group] of Object.entries(groups)) {
          if (drag?.key === key) continue;
          const velocity = motion[key], decay = Math.exp(-dt * 3);
          velocity.vx *= decay; velocity.vy *= decay;
          group.rotation.y += velocity.vx * dt;
          group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + velocity.vy * dt, -.65, .65);
          if (key === selected && performance.now() - velocity.last > 4000) group.rotation.y += dt * .045;
        }
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } catch {
    document.querySelector('#planet-spin').textContent = 'Surface map preview';
    canvas.classList.add('hidden');
    renderer?.dispose(); renderer = null;
  }
  return {
    dispose() {
      alive = false; cancelAnimationFrame(frame); observer?.disconnect();
      listeners.forEach(([type, handler]) => canvas.removeEventListener(type, handler));
      drag = null;
      textures.forEach(t => t.dispose()); resources.forEach(r => r.dispose());
      renderer?.dispose(); renderer?.forceContextLoss();
    },
  };
}
