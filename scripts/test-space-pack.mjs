// Run: node scripts/test-space-pack.mjs  - every space-pack GLB is valid glTF 2.0 and matches the manifest and the
// original OBJ triangle counts.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url), m = JSON.parse(readFileSync(new URL('game/assets/space-pack/manifest.json', root)));
const original = JSON.parse(readFileSync(new URL('source-assets/space-pack/model-manifest.json', root))).models;
assert.equal(m.models.length, 17);
for (const model of m.models) {
  const buf = readFileSync(new URL('game/' + model.file, root));
  assert.equal(buf.readUInt32LE(0), 0x46546C67, model.name + ' magic'); assert.equal(buf.readUInt32LE(4), 2); assert.equal(buf.readUInt32LE(8), buf.length);
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString());
  const tris = json.meshes.reduce((n, mesh) => n + json.accessors[mesh.primitives[0].attributes.POSITION].count / 3, 0);
  assert.equal(tris, model.triangles, model.name + ' triangles');
  const o = original.find(x => x.name === model.name); if (o) assert.equal(tris, o.triangles, model.name + ' matches the Unity pack');
  assert.ok(json.materials.length > 0 && json.materials.every(x => x.pbrMetallicRoughness.baseColorFactor.length === 4));
  assert.ok(existsSync(new URL('source-assets/space-pack/' + model.name + '.obj', root)), model.name + ' original kept');
}
console.log(`Space pack: ${m.models.length} GLBs are valid and match the original triangle counts.`);
