// Optional museum: no Three.js imports, requests, or GPU allocations until opened.
export const LUNAR_EXHIBITS = Object.freeze([
  { id: 'lro', title: 'LRO · Surveying the Moon', file: 'lro-orbiter.glb', bytes: 654500,
    source: 'https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-a/',
    credit: 'NASA / Christopher R. Meaney',
    text: 'Lunar Reconnaissance Orbiter maps the Moon from orbit. Its observations help scientists study terrain, find resources and assess future landing sites. Inspect the spacecraft behind the lunar maps.',
    note: 'Survey spacecraft exhibit. This is not a live orbit or a terrain measurement.' },
  { id: 'apollo', title: 'Apollo · Landing on the Moon', file: 'apollo-lunar-module.glb', bytes: 716840,
    source: 'https://science.nasa.gov/3d-resources/apollo-lunar-module/',
    credit: 'NASA / Michael D. Carbajal',
    text: 'The Apollo Lunar Module carried astronauts from lunar orbit to the surface and back. Look for the wide landing legs and the upper ascent stage. Compare its landing role with LRO’s orbital survey role.',
    note: 'Historical exhibit. The Apollo vehicle is separate from the future south-pole training lander.' },
  { id: 'saturn', title: 'Saturn V · Leaving Earth', file: 'saturn-v-history.glb', bytes: 4821512,
    source: 'https://sketchfab.com/3d-models/saturn-v-nasa-7a2c9709ff8144c8b3b18ec84b5e112e',
    credit: 'Stanley Creative · CC BY-ND 4.0 · user-supplied original',
    license: 'https://creativecommons.org/licenses/by-nd/4.0/',
    text: 'Saturn V launched Apollo missions from Earth. It belongs to the history of the journey to the Moon; it is not equipment on the lunar surface.',
    note: 'Historical exhibit, not an official NASA model. Original file preserved unchanged. Models are fitted individually to the viewer, not shown at a shared scale.' },
]);

export function disposeExhibit(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), images = new Set();
  root?.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [].concat(o.material || [])) {
      materials.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) {
        textures.add(v); if (v.source?.data) images.add(v.source.data);
      }
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose()); images.forEach(i => i.close?.());
}

// Abort the UI wait even if a decoder never settles; free any result arriving later.
export function abortableParse(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Model load timed out or cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(value => { if (signal.aborted) disposeExhibit(value.scene); else resolve(value); }, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export function mountLunarExhibit(host = document.querySelector('#menu .menu-row')) {
  if (!host) return { get isOpen() { return false; }, close() {}, dispose() {} };
  const launch = document.createElement('button'); launch.type = 'button';
  launch.textContent = 'Lunar survey & history'; host.append(launch);
  let dialog, session, generation = 0;
  const close = () => { dialog?.close(); };
  const cleanup = () => {
    generation++; session?.controller?.abort(); session?.observer?.disconnect();
    session?.renderer?.setAnimationLoop(null); disposeExhibit(session?.survey);
    session?.controls?.dispose(); disposeExhibit(session?.model);
    session?.renderer?.dispose(); session?.renderer?.forceContextLoss(); session = null;
    dialog?.remove(); dialog = null; launch.focus();
  };
  launch.onclick = async () => {
    if (dialog) return;
    const token = ++generation;
    dialog = document.createElement('dialog'); dialog.setAttribute('aria-labelledby', 'lunar-exhibit-title');
    dialog.style.cssText = 'width:min(880px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;background:var(--panel-solid,#11161d);color:var(--text,#eef2f6);border:1px solid var(--line,#455365);border-radius:16px;padding:20px';
    dialog.innerHTML = `<div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><h2 id="lunar-exhibit-title" style="margin:0">Lunar survey & history</h2><button type="button" data-close>Back to missions</button></div>
      <p>Explore the spacecraft behind lunar mapping and Apollo. Choose a model to download; nothing here is needed to play.</p>
      <div data-choices style="display:flex;flex-wrap:wrap;gap:8px"></div>
      <h3 data-title></h3><p data-description style="max-width:70ch;line-height:1.55"></p>
      <div data-stage style="height:clamp(200px,40dvh,380px);width:100%;background:#05070a;border-radius:12px;overflow:hidden"></div>
      <p data-status role="status" aria-live="polite">Choose an exhibit above.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px" data-tools hidden><button type="button" data-left>Rotate left</button><button type="button" data-right>Rotate right</button><button type="button" data-reset>Reset view</button><button type="button" data-survey hidden>Survey demo</button></div>
      <p data-note style="color:var(--muted,#9aa6b4)"></p><p data-credit></p>`;
    document.body.append(dialog); dialog.addEventListener('close', cleanup, { once: true });
    // Keep menu shortcuts and Space from consuming the viewer's keyboard actions.
    dialog.addEventListener('keydown', e => e.stopPropagation());
    dialog.querySelector('[data-close]').onclick = close;
    const status = dialog.querySelector('[data-status]'), stage = dialog.querySelector('[data-stage]');
    const choiceHost = dialog.querySelector('[data-choices]');
    for (const item of LUNAR_EXHIBITS) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.exhibit = item.id;
      b.disabled = true;
      b.textContent = `${item.title.split(' · ')[0]} (${(item.bytes / 1e6).toFixed(1)} MB)`;
      b.onclick = () => select(item); choiceHost.append(b);
    }
    dialog.showModal(); dialog.querySelector('[data-close]').focus();
    session = {};
    status.textContent = 'Starting the 3D viewer…';
    let THREE, GLTFLoader, OrbitControls, DRACOLoader;
    try {
      [THREE, { GLTFLoader }, { OrbitControls }, { DRACOLoader }] = await Promise.all([
        import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/DRACOLoader.js'),
      ]);
      if (token !== generation) return;
      const renderer = new THREE.WebGLRenderer({ antialias: false }); session.renderer = renderer;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
      renderer.domElement.setAttribute('aria-label', 'Spacecraft model; drag to rotate, scroll or pinch to zoom. Rotation buttons are below.');
      stage.append(renderer.domElement);
      session.scene = new THREE.Scene(); session.scene.background = new THREE.Color('#05070a');
      session.scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2));
      const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, 5, 4); session.scene.add(key);
      session.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      session.camera.position.set(3, 2, 4);
      session.controls = new OrbitControls(session.camera, renderer.domElement);
      session.controls.enablePan = false; session.controls.minDistance = 1.8; session.controls.maxDistance = 12;
      session.controls.addEventListener('change', draw);
      session.observer = new ResizeObserver(() => {
        if (!session) return;
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false); session.camera.aspect = w / h; session.camera.updateProjectionMatrix(); draw();
      }); session.observer.observe(stage);
      choiceHost.querySelectorAll('button').forEach(b => { b.disabled = false; });
      status.textContent = 'Choose an exhibit above.';
      dialog.querySelector('[data-reset]').onclick = () => session.controls.reset();
      dialog.querySelector('[data-survey]').onclick = () => {
        if (session.survey) { stopSurvey(); draw(); return; }
        const group = new THREE.Group(); session.survey = group;
        group.add(new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 24), new THREE.MeshStandardMaterial({color:0x8c9299,roughness:1})));
        const points = Array.from({length:97}, (_,i) => { const a = i / 96 * Math.PI * 2; return new THREE.Vector3(0,Math.sin(a)*1.6,Math.cos(a)*1.6); });
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x6fd3ff})));
        session.scene.add(group); session.model.scale.setScalar(session.modelScale * 0.16);
        dialog.querySelector('[data-survey]').textContent = 'Stop survey demo';
        status.textContent = 'Illustrative polar survey orbit around a schematic Moon. Scale, speed and path are simplified; this is not live tracking, measured coverage or landing-site validation.';
        session.camera.position.set(4,2,4); session.controls.update();
        let angle = 0, last = performance.now();
        session.renderer.setAnimationLoop(now => {
          const dt = Math.min(0.05, Math.max(0,(now-last)/1000)); last = now;
          if (document.hidden || !session?.survey) return;
          angle += dt * 0.45;
          session.model.position.set(0,Math.sin(angle)*1.6,Math.cos(angle)*1.6); draw();
        });
      };
      for (const [selector, angle] of [['[data-left]', -Math.PI / 8], ['[data-right]', Math.PI / 8]]) {
        dialog.querySelector(selector).onclick = () => {
          session.camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle); session.controls.update(); draw();
        };
      }
    } catch (error) {
      if (token === generation) { status.textContent = 'The 3D viewer could not start. Close and reopen to retry, or return to your mission.'; console.warn('Lunar exhibit setup', error); }
    }
    function draw() { if (session?.renderer && session.scene && !document.hidden) session.renderer.render(session.scene, session.camera); }
    function stopSurvey() {
      if (!session?.survey) return;
      session.renderer.setAnimationLoop(null); session.scene.remove(session.survey); disposeExhibit(session.survey); session.survey = null;
      session.model.position.set(0,0,0); session.model.scale.setScalar(session.modelScale);
      dialog.querySelector('[data-survey]').textContent = 'Survey demo';
      status.textContent = 'Drag to rotate; scroll or pinch to zoom. Use the buttons to rotate with a keyboard.';
    }
    async function select(item) {
      if (!session?.controls) { status.textContent = 'Viewer is starting. Please select the model again in a moment.'; return; }
      session.controller?.abort(); const controller = new AbortController(); session.controller = controller;
      const current = session;
      stopSurvey();
      if (current.model) { current.scene.remove(current.model); disposeExhibit(current.model); current.model = null; }
      choiceHost.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.exhibit === item.id)));
      dialog.querySelector('[data-title]').textContent = item.title;
      dialog.querySelector('[data-description]').textContent = item.text;
      dialog.querySelector('[data-note]').textContent = item.note;
      const credit = dialog.querySelector('[data-credit]'); credit.replaceChildren(document.createTextNode(`${item.credit} · `));
      const link = document.createElement('a'); link.href = item.source; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Model source'; link.style.color = 'var(--accent,#6fd3ff)'; credit.append(link);
      if (item.license) { const license = link.cloneNode(); license.href = item.license; license.textContent = 'License'; credit.append(document.createTextNode(' · '), license); }
      status.textContent = `Loading ${item.title.split(' · ')[0]}… You can switch exhibits or return to missions.`;
      dialog.querySelector('[data-tools]').hidden = true; draw();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const url = new URL(`../assets/nasa/${item.file}`, import.meta.url);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (session !== current) return;
        controller.signal.throwIfAborted();
        const draco = new DRACOLoader().setDecoderPath(new URL('../assets/nasa/draco/', import.meta.url).href).setWorkerLimit(1);
        let gltf;
        try { gltf = await abortableParse(new GLTFLoader().setDRACOLoader(draco).parseAsync(bytes, new URL('.', url).href), controller.signal); }
        finally { draco.dispose(); }
        // Parsing cannot be aborted; discard and free a late result after a close/switch.
        if (controller.signal.aborted || session !== current) { disposeExhibit(gltf.scene); return; }
        const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(span) || span <= 0) { disposeExhibit(gltf.scene); throw new Error('Empty model'); }
        const wrapper = new THREE.Group(); gltf.scene.position.sub(box.getCenter(new THREE.Vector3())); wrapper.add(gltf.scene); wrapper.scale.setScalar(2.4 / span);
        current.model = wrapper; current.scene.add(wrapper);
        current.modelScale = wrapper.scale.x;
        dialog.querySelector('[data-survey]').hidden = item.id !== 'lro';
        current.camera.position.set(3, 2, 4); current.controls.target.set(0, 0, 0); current.controls.update(); current.controls.saveState();
        dialog.querySelector('[data-tools]').hidden = false;
        status.textContent = 'Drag to rotate; scroll or pinch to zoom. Use the buttons to rotate with a keyboard.'; draw();
      } catch (error) {
        if (session === current && current.controller === controller) {
          status.textContent = controller.signal.aborted ? 'Download timed out. Select the exhibit to retry.' : 'Model unavailable. Select the exhibit to retry, or return to missions.';
          console.warn('Lunar exhibit load', item.id, error);
        }
      } finally { clearTimeout(timer); }
    }
  };
  return { get isOpen() { return Boolean(dialog?.open); }, close, dispose() { if (dialog) cleanup(); launch.remove(); } };
}
