// Arriving at Mars: a 3D globe wrapped in NASA's real Mars map (Mars Trek / Viking orbiters),
// then the landing step by step - heat shield, parachute, rockets - and why it is called
// "seven minutes of terror" (Earth can't help: radio takes longer than the landing).
import * as THREE from 'three';
import { factHTML } from './ui.js';
import { loadMarsMap } from './nasaimages.js';
import { loadModel } from './nasamodels.js';

const JEZERO = { lat: 18.38, lon: 77.58 };   // Perseverance's landing site (and our outpost)

const ICONS = {
  globe: '',
  heat: `<svg viewBox="0 0 120 120"><defs><radialGradient id="hg"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ff3d1f" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="60" cy="78" rx="52" ry="34" fill="url(#hg)"/><path d="M30 70 Q60 92 90 70 L74 40 Q60 34 46 40 Z" fill="#d9d4c8"/><path d="M28 70 Q60 96 92 70" stroke="#5a2a14" stroke-width="7" fill="none"/></svg>`,
  chute: `<svg viewBox="0 0 120 120"><path d="M14 46 Q60 -6 106 46 Z" fill="#f5f1e8" stroke="#ff7a3d" stroke-width="3"/><path d="M14 46 L54 92 M106 46 L66 92 M40 44 L56 92 M80 44 L64 92" stroke="#bbb" stroke-width="1.5"/>
    <path d="M50 92 L70 92 L66 108 L54 108 Z" fill="#d9d4c8"/></svg>`,
  rockets: `<svg viewBox="0 0 120 120"><rect x="34" y="30" width="52" height="26" rx="6" fill="#d9d4c8"/><path d="M38 56 L30 74 M82 56 L90 74 M54 56 L52 76 M66 56 L68 76" stroke="#6b6b6b" stroke-width="5"/>
    <path d="M24 74 L36 74 L30 100 Z M84 74 L96 74 L90 100 Z M46 76 L58 76 L52 104 Z M62 76 L74 76 L68 104 Z" fill="#ffb347"/><rect x="0" y="108" width="120" height="12" fill="#b5643c"/></svg>`,
  clock: `<svg viewBox="0 0 120 120"><circle cx="60" cy="62" r="44" fill="none" stroke="#ffd27a" stroke-width="6"/><path d="M60 62 L60 30 M60 62 L84 74" stroke="#fff7ee" stroke-width="6" stroke-linecap="round"/><text x="60" y="122" text-anchor="middle" fill="#ffd27a" font-size="16" font-weight="700">7 min</text></svg>`,
};

function steps(F, delay) {
  return [
    { icon: 'globe', zoom: 0, title: 'Arriving at Mars', text: "This is the real Mars - a map NASA made from thousands of photos taken by the Viking orbiters. The orange dot is Jezero Crater, an ancient lake bed where the Perseverance rover is exploring. That is where your outpost is! The spacecraft circling the planet are NASA's Mars Reconnaissance Orbiter and Mars Odyssey - relay orbiters that will carry your messages to Earth.", fact: F.marsMap, fact2: F.mro },
    { icon: 'heat', zoom: 1, title: '1. Entry: the heat shield', text: "The lander hits the top of the Martian air at nearly 20,000 km/h. Rubbing through the air makes the heat shield glow hotter than 1,260 °C - but the crew inside stays cool. The air does most of the braking.", fact: F.edl },
    { icon: 'chute', zoom: 2, title: '2. Descent: a supersonic parachute', text: "Still going faster than sound, a giant parachute opens - Perseverance's was 21.5 metres wide, about as wide as a tennis court is long. Then the heat shield drops off so the radar can see the ground.", fact: F.edl },
    { icon: 'rockets', zoom: 3, title: '3. Landing: rocket engines', text: "Mars's air is so thin that a parachute can't slow you down enough. For the last part, rocket engines fire downwards to land gently. Perseverance's descent stage used eight rockets and lowered the rover on ropes - a 'sky crane'!", fact: F.edl },
    { icon: 'clock', zoom: 3, title: '"Seven minutes of terror"', text: `The whole landing takes about 7 minutes. Right now a radio message takes about ${delay.toFixed(0)} minutes to reach Earth - so when mission control hears "we've reached the air", the landing is already over. Nobody can steer it from Earth: the lander must fly itself.`, fact: F.delay },
  ];
}

export function showArrival(F, delayMinutes = 10) {
  return new Promise(async resolve => {
    const list = steps(F, delayMinutes);
    const root = document.createElement('div');
    root.id = 'arrival';
    root.innerHTML = `
      <div class="mp-box">
        <p class="kicker">ENTRY, DESCENT AND LANDING</p>
        <div class="ar-stage"><canvas id="ar-globe"></canvas><div id="ar-icon"></div><p id="ar-map" class="source"></p></div>
        <h3 id="mp-title"></h3><p id="mp-text"></p><div id="mp-fact"></div>
        <div class="mp-nav"><button id="mp-back">‹ Back</button><span id="mp-count"></span><button id="mp-next" class="primary">Next ›</button><button id="mp-skip">Skip</button></div>
      </div>`;
    document.body.appendChild(root);

    // the globe
    const canvas = root.querySelector('#ar-globe');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 2, 0.1, 100);
    scene.add(new THREE.AmbientLight('#ffffff', 0.55));
    const sun = new THREE.DirectionalLight('#fff4e6', 1.6); sun.position.set(-4, 2, 5); scene.add(sun);
    const mat = new THREE.MeshStandardMaterial({ color: '#c9774a', roughness: 1 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat); scene.add(globe);
    // marker at Jezero, as a child of the globe so it turns with it
    const phi = (JEZERO.lon + 180) / 360 * Math.PI * 2, theta = (90 - JEZERO.lat) / 180 * Math.PI;
    const dir = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff7a3d' }));
    marker.position.copy(dir.clone().multiplyScalar(1.01)); globe.add(marker);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.055, 24), new THREE.MeshBasicMaterial({ color: '#ffd27a', side: THREE.DoubleSide }));
    ring.position.copy(dir.clone().multiplyScalar(1.012)); ring.lookAt(dir.clone().multiplyScalar(2)); globe.add(ring);
    // a thin dusty atmosphere
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.03, 48, 32), new THREE.MeshBasicMaterial({ color: '#ffb48a', transparent: true, opacity: 0.12, side: THREE.BackSide })));
    // NASA's Mars Reconnaissance Orbiter (official NASA 3D model) circling the planet - a real relay orbiter
    const orbit = new THREE.Group(); orbit.rotation.set(0.5, 0, 0.25); scene.add(orbit);
    loadModel('mro.glb').then(g => {
      if (!g) return;
      const m = g.scene.clone(), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
      m.scale.setScalar(0.42 / Math.max(size.x, size.y, size.z));        // not to scale - shown big enough to see
      m.traverse(o => { if (o.isMesh) for (const mt of [].concat(o.material)) { mt.metalness = Math.min(mt.metalness, 0.3); mt.color?.multiplyScalar(1.4); } });
      const holder = new THREE.Group(); holder.position.set(1.42, 0, 0); holder.add(m); orbit.add(holder);
      orbit.userData.mro = holder;
    });
    // NASA's Mars Odyssey (NASA 3D Resources): in orbit since 2001, and also a relay for rovers' messages
    const orbit2 = new THREE.Group(); orbit2.rotation.set(-0.35, 0, -0.5); scene.add(orbit2);
    loadModel('odyssey.glb').then(g => {
      if (!g) return;
      const m = g.scene.clone(), size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      m.scale.setScalar(0.32 / Math.max(size.x, size.y, size.z));
      m.traverse(o => { if (o.isMesh) for (const mt of [].concat(o.material)) mt.metalness = Math.min(mt.metalness, 0.3); });
      const holder = new THREE.Group(); holder.position.set(0, 0, 1.6); holder.add(m); orbit2.add(holder);
    });
    // turn the globe so Jezero starts facing us
    const faceJezero = Math.atan2(dir.x, dir.z);
    globe.rotation.y = -faceJezero - 0.9; globe.rotation.x = 0.25;

    const mapNote = root.querySelector('#ar-map');
    mapNote.textContent = 'Loading NASA\'s Mars map…';
    // NASA 3D Resources' Mars map (saved in the game) shows at once; the live Mars Trek map replaces it if it loads
    let trek = false;
    new THREE.TextureLoader().load('assets/mars-map.jpg', tex => {
      if (trek) return;
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mat.map = tex; mat.color.set('#ffffff'); mat.needsUpdate = true;
      mapNote.innerHTML = 'Real map: NASA 3D Resources - Mars (<a href="https://science.nasa.gov/3d-resources/mars/" target="_blank" rel="noopener">science.nasa.gov</a>)';
    });
    loadMarsMap().then(({ canvas: map, ok }) => {
      if (!ok) { if (!mat.map) mapNote.textContent = 'Couldn\'t reach NASA Mars Trek right now - showing a plain planet.'; return; }
      trek = true;
      const tex = new THREE.CanvasTexture(map); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mat.map = tex; mat.color.set('#ffffff'); mat.needsUpdate = true;
      mapNote.innerHTML = ok
        ? 'Real map: NASA Mars Trek - Viking orbiters colour mosaic (<a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener">trek.nasa.gov</a>)'
        : 'Couldn\'t reach NASA Mars Trek right now - showing a plain planet.';
    });

    let i = 0, raf, camZ = 4.2, alive = true;
    const size = () => { const w = canvas.clientWidth || 600, h = canvas.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const clock = new THREE.Clock();
    const loop = () => {
      if (!alive) return;
      const dt = Math.min(clock.getDelta(), 0.05), s = list[i];
      size();
      const wantZ = [4.2, 2.6, 2.0, 1.55][s.zoom];
      camZ += (wantZ - camZ) * Math.min(1, dt * 2);
      globe.rotation.y += dt * (s.zoom ? 0.02 : 0.12);
      if (s.zoom) globe.rotation.y += ((-faceJezero) - globe.rotation.y) * Math.min(1, dt * 1.2);   // swing Jezero to the front
      camera.position.set(0, 0, camZ); camera.lookAt(0, 0, 0);
      ring.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.2);
      orbit.rotation.y += dt * 0.35; orbit.visible = s.zoom < 2;
      orbit2.rotation.y -= dt * 0.22; orbit2.visible = s.zoom < 2;   // out of the way once we are diving into the air
      orbit.userData.mro?.rotation.set(0, clock.elapsedTime * 0.2, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    function render() {
      const s = list[i];
      root.querySelector('#mp-title').textContent = s.title;
      root.querySelector('#mp-text').textContent = s.text;
      root.querySelector('#mp-fact').innerHTML = (s.fact ? factHTML(s.fact) : '') + (s.fact2 ? factHTML(s.fact2) : '');
      root.querySelector('#ar-icon').innerHTML = ICONS[s.icon];
      root.querySelector('#mp-count').textContent = `${i + 1} / ${list.length}`;
      root.querySelector('#mp-back').disabled = i === 0;
      root.querySelector('#mp-next').textContent = i === list.length - 1 ? 'Step outside ›' : 'Next ›';
    }
    const finish = () => {
      alive = false; cancelAnimationFrame(raf);
      renderer.dispose(); renderer.forceContextLoss?.(); root.remove(); resolve();
    };
    root.querySelector('#mp-next').onclick = () => { if (i < list.length - 1) { i++; render(); } else finish(); };
    root.querySelector('#mp-back').onclick = () => { if (i > 0) { i--; render(); } };
    root.querySelector('#mp-skip').onclick = finish;
    render(); loop();
  });
}
