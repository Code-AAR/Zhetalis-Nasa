import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAssetWithRetry, createAssetLoadQueue } from '../game/src/asset-loading.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const timedOut = error => error.cause?.name === 'TimeoutError';

// Concurrent callers share one operation and the exact full-quality result.
{
  const gate = deferred(); let calls = 0;
  const loader = { loadAsync() { calls++; return gate.promise; } };
  const a = loadAssetWithRetry(loader, 'same');
  const b = loadAssetWithRetry(loader, 'same');
  assert.equal(a,b);
  await tick(); assert.equal(calls,1);
  const model = { scene: {}, animations: ['all clips'] };
  gate.resolve(model); assert.equal(await a, model);
}
// Timeout is terminal for callers, but does not release a running load or retry it.
{
  const gate = deferred(); let calls = 0;
  const loader = { loadAsync() { calls++; return gate.promise; } };
  const a = loadAssetWithRetry(loader, 'stalled', {timeout:20,delay:0});
  await assert.rejects(a,timedOut);
  assert.equal(loadAssetWithRetry(loader,'stalled'),a);
  assert.equal(calls,1);
  gate.reject(new Error('late failure'));
  await tick(); assert.equal(calls,1);
  loader.loadAsync = async () => { calls++; return 'recovered'; };
  assert.equal(await loadAssetWithRetry(loader,'stalled'),'recovered');
  assert.equal(calls,2);
}
// Both occupied slots remain occupied after timeout; queued deadlines remove work.
{
  const gates = [deferred(),deferred()]; let calls = 0;
  const loader = { loadAsync() { return gates[calls++].promise; } };
  await Promise.all(['one','two'].map(url => assert.rejects(loadAssetWithRetry(loader,url,{timeout:20}),timedOut)));
  await assert.rejects(loadAssetWithRetry(loader,'queued',{timeout:20}),timedOut);
  assert.equal(calls,2);
  gates.forEach(g => g.resolve({scene:{}})); await tick();
  assert.equal(calls,2,'expired queued operation must never start');
}
// Retry backoff is interrupted by the total deadline.
{
  let calls=0;
  await assert.rejects(loadAssetWithRetry({loadAsync(){calls++;throw Error('offline');}},'offline',{timeout:20,delay:10000}),timedOut);
  await tick(); assert.equal(calls,1);
}
// Queue enforces FIFO admission and releases slots on rejection.
{
  const run = createAssetLoadQueue(1), signal = new AbortController().signal;
  const gate=deferred(), order=[];
  const a=run(()=>{order.push('a');return gate.promise;},signal);
  const b=run(()=>{order.push('b');return 2;},signal);
  await tick(); assert.deepEqual(order,['a']);
  const failure=assert.rejects(a,/decode/); gate.reject(Error('decode')); await failure;
  assert.equal(await b,2); assert.deepEqual(order,['a','b']);
}
for (const options of [{attempts:0},{attempts:1.5},{timeout:0},{timeout:Infinity},{delay:-1}]) {
  await assert.rejects(loadAssetWithRetry({loadAsync(){assert.fail('invalid options must not load');}},'invalid',options),RangeError);
}
// Exercise the actual NASA cache code with dependency stubs (no browser/WebGL needed).
{
  let source = await readFile(new URL('../game/src/nasamodels.js', import.meta.url),'utf8');
  source = source.replace(/^import .*;\r?\n/gm,'');
  const gates=[], usedLoaders=[];
  const scenery=[deferred(),deferred()];
  const sceneryLoader={loadAsync(url){return scenery[Number(url)].promise;}};
  await Promise.all([0,1].map(i=>assert.rejects(loadAssetWithRetry(sceneryLoader,String(i),{timeout:20}),timedOut)));
  class GLTFLoader { setDRACOLoader(d){this.draco=d;} loadAsync(){usedLoaders.push(this);const g=deferred();gates.push(g);return g.promise;} }
  class DRACOLoader {setDecoderPath(){} setWorkerLimit(n){this.limit=n;}}
  class Image {set src(_){this.onload();}}
  globalThis.__loadingTest = {loadAssetWithRetry: (loader,url,options) => loadAssetWithRetry(loader,url,{...options,attempts:1}),GLTFLoader,DRACOLoader,Image};
  const module = await import('data:text/javascript,'+encodeURIComponent('const {loadAssetWithRetry,GLTFLoader,DRACOLoader,Image}=globalThis.__loadingTest;\n'+source));
  delete globalThis.__loadingTest;
  assert.equal(module.loader.draco.limit,2);
  const a=module.loadModel('__proto__',{required:true});
  const b=module.loadModel('__proto__',{required:true});
  assert.equal(a,b); await tick(); assert.equal(gates.length,1);
  const model={scene:{},animations:[1,2,3]}; gates[0].resolve(model);
  assert.equal(await a,model);
  assert.equal(await module.loadModel('__proto__'),model);
  assert.equal(gates.length,1);
  const required=module.loadModel('broken',{required:true});
  const optional=module.loadModel('broken');
  const failure=assert.rejects(required,/Could not load/);
  await tick(); gates[1].reject(Error('missing'));
  await failure;
  assert.equal(await optional,null);
  const retry=module.loadModel('broken',{required:true});
  await tick(); assert.equal(gates.length,3);
  gates[2].resolve(model); assert.equal(await retry,model);
  // Optional prefetch of known walkable geometry must use reserved capacity too.
  const walkway=module.loadModel('greenhouse-walkway.glb');
  const walkwayRequired=module.loadModel('greenhouse-walkway.glb',{required:true});
  await tick(); assert.equal(gates.length,4);
  assert.notEqual(usedLoaders[3],module.loader);
  assert.notEqual(usedLoaders[3].draco,module.loader.draco);
  assert.equal(usedLoaders[3].draco.limit,2);
  gates[3].resolve(model);
  assert.equal(await walkway,model); assert.equal(await walkwayRequired,model);
  // Execute the actual settlement loading expression, with its real options.
  const settlement=await readFile(new URL('../game/src/settlement.js',import.meta.url),'utf8');
  const expression=settlement.match(/loadAssetWithRetry\(new GLTFLoader\(\), 'assets\/mars-base\/scene\.gltf'[^\n]*?\)/)[0];
  const base=Function('loadAssetWithRetry','GLTFLoader',`return ${expression}`)(loadAssetWithRetry,GLTFLoader);
  await tick(); assert.equal(gates.length,5);
  gates[4].resolve(model); assert.equal(await base,model);
  scenery[0].reject(Error('late scenery failure')); scenery[1].resolve({});
  await tick();

}
console.log('Loading deadlines, no-overlap retries, dedup, queue limits, cache and Draco checks passed.');

// Hung critical work also has bounded caller waits and cannot spawn overlap.
{
  const gates=[deferred(),deferred()]; let calls=0;
  const loader={loadAsync(){return gates[calls++].promise;}};
  await Promise.all(['critical-a','critical-b'].map(url=>assert.rejects(loadAssetWithRetry(loader,url,{critical:true,timeout:20}),timedOut)));
  await assert.rejects(loadAssetWithRetry(loader,'critical-queued',{critical:true,timeout:20}),timedOut);
  assert.equal(calls,2);
  gates.forEach(g=>g.reject(Error('late critical failure')));
  await tick(); assert.equal(calls,2);
}
console.log('Reserved critical capacity survives hung scenery; critical deadlines and late rejection handling passed.');
