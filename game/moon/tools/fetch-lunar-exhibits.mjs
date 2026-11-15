// Run from any working directory. Downloads only the two official NASA originals.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const destination = new URL('../../assets/nasa/', import.meta.url);
const models = [
  ['lro-orbiter.glb', 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/lunar-reconnaissance-orbiter-%28a%29/Lunar%20Reconnaissance%20Orbiter%20%28A%29.glb'],
  ['apollo-lunar-module.glb', 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/apollo-lunar-module/Apollo%20Lunar%20Module.glb'],
];
export function inspectGLB(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid GLB 2.0');
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  if (!(json.meshes?.length > 0)) throw new Error('GLB has no meshes');
  if ([...(json.buffers || []), ...(json.images || [])].some(x => x.uri && !x.uri.startsWith('data:'))) throw new Error('GLB has external dependencies');
  if (json.extensionsRequired?.some(x => !['KHR_draco_mesh_compression', 'KHR_materials_unlit', 'KHR_mesh_quantization', 'KHR_texture_transform'].includes(x))) throw new Error('GLB requires an unconfigured decoder/extension');
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), meshes: json.meshes.length, asset: json.asset };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await mkdir(destination, { recursive: true });
  for (const [file, source] of models) {
    const target = new URL(file, destination);
    if (process.argv.includes('--verify')) { console.log(file, inspectGLB(await readFile(target))); continue; }
    const response = await fetch(source, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer()); const info = inspectGLB(bytes);
    await writeFile(target, bytes); console.log(file, info);
  }
  if (!process.argv.includes('--verify')) {
    await mkdir(new URL('draco/', destination), { recursive: true });
    for (const file of ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js']) {
      const source = `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/${file}`;
      const response = await fetch(source, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(new URL(`draco/${file}`, destination), bytes);
      console.log(file, bytes.length, createHash('sha256').update(bytes).digest('hex'));
    }
  }
}
