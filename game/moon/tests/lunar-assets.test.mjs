import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectGLB } from '../tools/fetch-lunar-exhibits.mjs';
import { LUNAR_EXHIBITS, disposeExhibit, abortableParse } from '../src/lunar-assets.js';

test('packaged exhibits are standalone valid GLBs with exact advertised sizes', async () => {
  for (const item of LUNAR_EXHIBITS) {
    const info = inspectGLB(await readFile(new URL(`../assets/nasa/${item.file}`, import.meta.url)));
    assert.equal(info.bytes, item.bytes); assert.ok(info.meshes > 0);
    assert.ok(item.source.startsWith('https://'));
    if (item.id === 'saturn') { assert.match(info.asset.extras.author, /Stanley Creative/); assert.match(info.asset.extras.license, /CC-BY-ND-4.0/); }
  }
});
test('disposal frees shared geometry, materials, textures and image bitmaps once', () => {
  const calls = {geometry:0,material:0,texture:0,image:0};
  const image = {close(){calls.image++;}};
  const texture = {isTexture:true, source:{data:image}, dispose(){calls.texture++;}};
  const geometry = {dispose(){calls.geometry++;}};
  const material = {map:texture, emissiveMap:texture, dispose(){calls.material++;}};
  disposeExhibit({traverse(fn){fn({geometry,material}); fn({geometry,material:[material]});}});
  assert.deepEqual(calls,{geometry:1,material:1,texture:1,image:1});
  disposeExhibit(null);
});
test('invalid downloads fail before installation', () => {
  assert.throws(() => inspectGLB(Buffer.from('<html>not a model</html>')), /Invalid GLB/);
});
test('Draco WASM decoder is packaged locally', async () => {
  const bytes = await readFile(new URL('../assets/nasa/draco/draco_decoder.wasm', import.meta.url));
  assert.deepEqual([...bytes.subarray(0,4)], [0,97,115,109]);
});
test('timeout covers a decoder that never resolves', async () => {
  const controller = new AbortController();
  const wait = abortableParse(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(wait, /timed out or cancelled/);
});
test('late decoder result is disposed after cancellation', async () => {
  const controller = new AbortController(); let finish, disposed = 0;
  const wait = abortableParse(new Promise(resolve => { finish = resolve; }), controller.signal);
  controller.abort(); await assert.rejects(wait);
  finish({scene:{traverse(fn){fn({geometry:{dispose(){disposed++;}}});}}});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(disposed, 1);
});
