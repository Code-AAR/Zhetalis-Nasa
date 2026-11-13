// Shared by the lunar flyby and Moon-orbit cinematics. Importing makes no requests.
export const ORION_SOURCE = Object.freeze({
  name: 'Orion — NASA/JPL Eyes on the Solar System',
  url: 'https://eyes.nasa.gov/apps/solar-system/#/sc_artemis_2',
  asset: new URL('../../assets/nasa/orion/orion-eyes.glb', import.meta.url).href,
  bytes: 24336596,
  note: 'NASA Artemis II visualization model; also used as a visual proxy for Artemis I. Not a Mars transit craft or engineering/trajectory model.',
});

const disposedModels = new WeakSet();
export function applyOrionDecalPolicy(root) {
  const hidden = new Set(['Logo_and_Flag', 'Worm.002']);
  root.traverse(o => {
    if (!o.isMesh) return;
    const materials = [].concat(o.material || []);
    for (const m of materials) if (hidden.has(m.name)) m.visible = false;
    if (materials.length && materials.every(m => hidden.has(m.name))) o.visible = false;
  });
}

export function disposeNasaOrion(root) {
  if (!root || disposedModels.has(root)) return;
  disposedModels.add(root);
  const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
  root?.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    for(const m of [].concat(o.material||[])){
      materials.add(m);
      for(const value of Object.values(m))if(value?.isTexture){textures.add(value);if(value.source?.data)images.add(value.source.data);}
    }
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  textures.forEach(t=>t.dispose());images.forEach(i=>i.close?.());
}

// Bounds the caller's wait even when a decoder stalls. A late scene is still freed.
export function waitForOrion(promise, signal) {
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason || new DOMException('Orion load cancelled','AbortError'));
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    promise.then(model=>{if(signal.aborted)disposeNasaOrion(model);else resolve(model);},reject)
      .finally(()=>signal.removeEventListener('abort',abort));
  });
}

// Returns an independently owned Group in NASA's native metre-scale coordinates:
// +Y along the crew-module axis, heat-shield region near Y=0. Caller owns placement.
// No mesh/texture simplification, no perpetual parsed-model cache, no forced camera transform.
export async function loadNasaOrion(renderer,{signal,timeoutMs=45000}={}) {
  if(!renderer)throw new Error('loadNasaOrion requires the active WebGL renderer for KTX2 support');
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('timeoutMs must be positive');
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const timer=setTimeout(()=>controller.abort(new DOMException('Orion download or decoding timed out','TimeoutError')),timeoutMs);
  let draco,ktx2;
  const work=async()=>{
    controller.signal.throwIfAborted();
    const response=await fetch(ORION_SOURCE.asset,{signal:controller.signal});
    if(!response.ok)throw new Error(`Orion model: HTTP ${response.status}`);
    const bytes=await response.arrayBuffer();controller.signal.throwIfAborted();
    const [{GLTFLoader},{DRACOLoader},{KTX2Loader}]=await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),import('three/addons/loaders/DRACOLoader.js'),import('three/addons/loaders/KTX2Loader.js'),
    ]);
    controller.signal.throwIfAborted();
    draco=new DRACOLoader().setDecoderPath(new URL('../../assets/nasa/draco/',import.meta.url).href).setWorkerLimit(1);
    ktx2=new KTX2Loader().setTranscoderPath(new URL('../../assets/nasa/orion/basis/',import.meta.url).href).setWorkerLimit(1).detectSupport(renderer);
    try {
      const gltf=await new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).parseAsync(bytes,'');
      gltf.scene.name=ORION_SOURCE.name;gltf.scene.userData.source=ORION_SOURCE;
      // Match the existing game policy: suppress separate NASA branding overlays,
      // not the underlying shell or textures. ESA/structural primitives remain.
      applyOrionDecalPolicy(gltf.scene);
      gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      return gltf.scene;
    } finally {draco.dispose();ktx2.dispose();}
  };
  try {return await waitForOrion(work(),controller.signal);}
  finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    // Worker teardown on timeout/switch; late parse completion is guarded above.
    if(controller.signal.aborted){draco?.dispose();ktx2?.dispose();}
  }
}
