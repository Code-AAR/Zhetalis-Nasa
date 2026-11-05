// Globes you can spin with a mouse or a finger: Mars on arrival, Earth on the power console.
import * as THREE from 'three';

// Drag on `el` to turn `target` (left/right spins, up/down tilts). A flick keeps it turning for a moment.
// busy() is true while the player is touching it (and a few seconds after), so automatic turning can wait.
export function makeSpin(el, target, { maxTilt = 0.9, onSpin } = {}) {
  let drag = null, vx = 0, vy = 0, last = 0;
  el.style.cursor = 'grab'; el.style.touchAction = 'pan-y';   // horizontal drags spin; vertical swipes still scroll the page on phones
  el.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; vx = vy = 0; last = performance.now();
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    vx = dx * 0.012; vy = dy * 0.012; last = performance.now();
    target.rotation.y += vx;
    target.rotation.x = THREE.MathUtils.clamp(target.rotation.x + vy, -maxTilt, maxTilt);
    onSpin?.();
  });
  const up = () => { drag = null; el.style.cursor = 'grab'; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return {
    // call every frame: the flick slows down smoothly
    update(dt) {
      if (drag) return;
      const k = Math.exp(-dt * 3);
      vx *= k; vy *= k;
      target.rotation.y += vx * dt * 60;
      target.rotation.x = THREE.MathUtils.clamp(target.rotation.x + vy * dt * 60, -maxTilt, maxTilt);
    },
    busy: () => !!drag || performance.now() - last < 4000,
  };
}

// Where a latitude/longitude sits on a three.js sphere wrapped in an equirectangular map.
export function latLonDir(lat, lon) {
  const phi = (lon + 180) / 360 * Math.PI * 2, theta = (90 - lat) / 180 * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

// A small 3D Earth on `canvas`. It starts with the side NASA's EPIC camera is photographing right now (the
// side facing the Sun) turned towards you, and you can spin it. Stops by itself when the canvas leaves the page.
export function earthGlobe(canvas, centre) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 4.2);
  scene.add(new THREE.AmbientLight('#ffffff', 0.65));
  const sun = new THREE.DirectionalLight('#fff6ea', 2.6); sun.position.set(1.5, 1, 4); scene.add(sun);   // lit from our side, like EPIC's view
  const spinner = new THREE.Group(); scene.add(spinner);
  const tex = new THREE.TextureLoader().load('assets/earth-map.jpg'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.75, metalness: 0 }));
  spinner.add(earth);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.04, 48, 32), new THREE.MeshBasicMaterial({ color: '#7fc4ff', transparent: true, opacity: 0.18, side: THREE.BackSide })));   // thin blue air
  if (centre) earth.quaternion.setFromUnitVectors(latLonDir(centre.lat, centre.lon), new THREE.Vector3(0, 0, 1));
  const spin = makeSpin(canvas, spinner, { maxTilt: 1.2 });
  const clock = new THREE.Clock();
  const loop = () => {
    if (!canvas.isConnected) { renderer.dispose(); renderer.forceContextLoss?.(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), w = canvas.clientWidth || 120, h = canvas.clientHeight || 120;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    spin.update(dt);
    if (!spin.busy()) spinner.rotation.y += dt * 0.08;                // turns slowly by itself
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
