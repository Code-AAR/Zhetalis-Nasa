// The lunar surface scene: streamed crater terrain (bounded), a distant horizon shaped by NASA LOLA data,
// boulders, a black sky with stars, the Sun and Earth. No fog, no haze: the Moon has no air.
import * as THREE from 'three';
import { effectiveQuality } from '../../src/device-profile.js';
import { WORLD, CHUNKS_PER_SIDE } from './config.js';
import { heightAt, permanentShadow, chunkPlan, chunkOrigin, CRATERS, MAP_CHUNK_CAP } from './terrain.js';
import { horizonAt, skyVector } from './sun.js';

// Shared settings keys: 'mars-graphics' (quality) and 'mission-world-limit' / ?chunks= (detail area).
// Default 'map' = every 80 m chunk touching the minimap's 240 m circle (at most 16).
export const QUALITY = (() => {
  let q, lim; const params = new URLSearchParams(location.search);
  try { q = params.get('graphics') || localStorage.getItem('mars-graphics'); lim = params.get('chunks') || localStorage.getItem('mission-world-limit'); } catch { q = params.get('graphics'); lim = params.get('chunks'); }
  const radius = ['1', '2', '3'].includes(String(lim)) ? Number(lim) : 'map';
  q = effectiveQuality(q);
  if (q === 'low') return { name: 'low', seg: 40, radius, shadow: 1024, rocks: 900, pixel: 1, aa: false, range: lim || 'map' };
  if (q === 'high') return { name: 'high', seg: 96, radius, shadow: 4096, rocks: 2600, pixel: devicePixelRatio, aa: true, range: lim || 'map' };
  return { name: 'balanced', seg: 64, radius, shadow: 2048, rocks: 1800, pixel: 1.5, aa: true, range: lim || 'map' };
})();

// Regolith texture: fine grey grain with tiny craterlets and pebbles (procedural).
function regolithTextures() {
  const n = QUALITY.name === 'low' ? 256 : QUALITY.name === 'high' ? 2048 : 512, c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = c.height = b.width = b.height = n;
  const g = c.getContext('2d'), h = b.getContext('2d'), ci = g.createImageData(n, n), hi = h.createImageData(n, n);
  let seed = 9; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const hgt = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) hgt[i] = r() * 0.5;
  for (let k = 0; k < 60; k++) {   // craterlets
    const cx = r() * n, cy = r() * n, rad = 2 + r() * r() * 14;
    for (let y = -rad * 2; y < rad * 2; y++) for (let x = -rad * 2; x < rad * 2; x++) {
      const d = Math.hypot(x, y) / rad; if (d > 2) continue;
      const i = (((cy + y) | 0) % n + n) % n * n + (((cx + x) | 0) % n + n) % n;
      hgt[i] += d < 1 ? (d * d - 1) * 1.2 : 0.35 * Math.pow(d, -3) * (2 - d);
    }
  }
  for (let i = 0; i < n * n; i++) {
    const peb = r() > 0.996 ? 0.8 : 0, v = hgt[i] + peb;
    const shade = 150 + v * 40 + r() * 18 + peb * 30;
    ci.data.set([shade, shade, shade * 0.985, 255], i * 4);
    const hv = Math.max(0, Math.min(255, 128 + v * 60)); hi.data.set([hv, hv, hv, 255], i * 4);
  }
  g.putImageData(ci, 0, 0); h.putImageData(hi, 0, 0);
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

// Albedo: highland grey with brighter fresh ejecta, darker old soil; permanently shadowed floors are
// pre-darkened so they stay black even beyond the shadow map's reach.
const tint = new THREE.Color();
function colourAt(x, z, out, near) {
  let v = 0.56 + (Math.sin(x * 0.013 + Math.cos(z * 0.011) * 2) * 0.5 + 0.5) * 0.06;
  for (const c of near) { const q = Math.hypot(x - c.x, z - c.z) / c.r; if (q > 0.85 && q < 2.4) v += 0.1 * c.fresh * (1 - Math.abs(q - 1.2) / 1.2); }
  v *= 1 - 0.72 * permanentShadow(x, z);
  return out.setRGB(v, v * 0.995, v * 0.98);
}
function cratersNear(x0, z0, size) { return CRATERS.filter(c => c.r > 4 && c.x + c.r * 2.5 > x0 && c.x - c.r * 2.5 < x0 + size && c.z + c.r * 2.5 > z0 && c.z - c.r * 2.5 < z0 + size); }

export class MoonWorld {
  constructor(scene, site) {
    this.scene = scene; this.site = site;
    this.tex = regolithTextures();
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: this.tex.map, bumpMap: this.tex.bump, bumpScale: 0.6 });
    this.tex.map.repeat.set(0.25, 0.25); this.tex.bump.repeat.set(0.25, 0.25);   // 4 m texture tiles (world-space UVs)
    this.group = new THREE.Group(); this.group.name = 'Moon terrain'; scene.add(this.group);
    this.coarse = new Map(); this.detailed = new Map(); this.queue = []; this.sig = '';
    for (let iz = 0; iz < CHUNKS_PER_SIDE; iz++) for (let ix = 0; ix < CHUNKS_PER_SIDE; ix++) {
      const m = this.tile(ix, iz, 8); this.coarse.set(ix + ',' + iz, m); this.group.add(m);
    }
    this.addHorizon();
    this.addRocks();
    this.addSky();
    this.stats = { detailed: 0, queued: 0, limit: QUALITY.radius === 'map' ? MAP_CHUNK_CAP : (2 * QUALITY.radius + 1) ** 2, range: QUALITY.radius };
  }

  tile(ix, iz, n) {
    const o = chunkOrigin(ix, iz), S = WORLD.chunk, geo = new THREE.PlaneGeometry(S, S, n, n); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color(), near = cratersNear(o.x, o.z, S);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + o.x + S / 2, z = pos.getZ(i) + o.z + S / 2, y = heightAt(x, z);
      pos.setXYZ(i, x, y, z); uv.setXY(i, x, -z);
      const nx = heightAt(x - 0.3, z) - heightAt(x + 0.3, z), nz = heightAt(x, z - 0.3) - heightAt(x, z + 0.3), l = Math.hypot(nx, 0.6, nz);
      nrm.setXYZ(i, nx / l, 0.6 / l, nz / l);
      colourAt(x, z, c, near); col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    addSkirt(geo, n);
    const mesh = new THREE.Mesh(geo, this.material); mesh.receiveShadow = true; mesh.castShadow = n > 8; mesh.name = `Moon chunk ${ix},${iz} (${n})`;
    return mesh;
  }

  // Streams detailed chunks around the focus point; at most one new chunk per frame (no hitches) and never
  // more than (2r+1)^2 detailed chunks alive. Game state never lives in chunks.
  update(focus) {
    // Avoid rebuilding the same residency plan while standing still; queued chunks still stream.
    const moved = focus.x !== this.lastFocusX || focus.z !== this.lastFocusZ;
    const plan = moved ? chunkPlan(focus.x, focus.z, QUALITY.radius) : null;
    this.lastFocusX = focus.x; this.lastFocusZ = focus.z;
    const sig = plan ? plan.map(c => c.key).join(';') : this.sig;
    if (plan && sig !== this.sig) {
      this.sig = sig; const want = new Set(plan.map(c => c.key));
      for (const [k, m] of this.detailed) if (!want.has(k)) { this.group.remove(m); m.geometry.dispose(); this.detailed.delete(k); this.coarse.get(k).visible = true; }
      this.queue = plan.filter(c => !this.detailed.has(c.key));
    }
    const next = this.queue.shift();
    if (next) { const m = this.tile(next.x, next.z, QUALITY.seg); this.detailed.set(next.key, m); this.group.add(m); this.coarse.get(next.key).visible = false; }
    this.stats.detailed = this.detailed.size; this.stats.queued = this.queue.length;
    this.rocks.position.set(0, 0, 0);
  }

  // Distant land out to 6 km. Its skyline uses the real horizon angles computed from NASA LOLA elevation
  // around the site (data/moon-site.json), so far ridges stand where real ones do.
  addHorizon() {
    const rings = [300, 420, 500, 560, 620, 690, 760, 860, 1000, 1200, 1500, 1900, 2500, 3300, 4400, 6000], seg = 360;
    const pos = [], col = [], idx = [], eye = heightAt(0, 0) + 1.7;
    for (let r = 0; r < rings.length; r++) for (let a = 0; a <= seg; a++) {
      const az = a / seg * 360, rad = rings[r], x = Math.sin(az * Math.PI / 180) * rad, z = -Math.cos(az * Math.PI / 180) * rad;
      const inside = Math.abs(x) < WORLD.half - 2 && Math.abs(z) < WORLD.half - 2;
      const local = heightAt(x, z) - (inside ? 6 : 0);
      const far = eye + rad * Math.tan(horizonAt(this.site?.horizon, az) * Math.PI / 180) - 4 + Math.sin(az * 0.7) * 3;
      const k = THREE.MathUtils.smoothstep(rad, 700, 6000);
      const lump = (Math.sin(x * 0.004 + Math.cos(z * 0.005)) + Math.sin(z * 0.0031 - x * 0.002)) * 14 * k * (1 - k);
      pos.push(x, local * (1 - k) + far * k + lump, z);
      const v = 0.5 - 0.08 * k; col.push(v, v, v * 0.98);
    }
    for (let r = 0; r < rings.length - 1; r++) for (let a = 0; a < seg; a++) {
      const i = r * (seg + 1) + a, j = i + seg + 1; idx.push(i, j, i + 1, i + 1, j, j + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    m.receiveShadow = true; m.name = 'LOLA horizon'; this.horizon = m; this.scene.add(m);
  }

  addRocks() {
    const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const s = 0.75 + Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.5; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#8d8c88', roughness: 0.95, flatShading: true, bumpMap: this.tex.bump, bumpScale: 0.2 });
    const n = QUALITY.rocks, rocks = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let seed = 77; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    this.rockList = [];
    let k = 0;
    // Boulders gather around crater rims, where impacts threw them.
    for (const c of CRATERS) {
      if (c.r < 5) continue;
      const count = Math.min(40, Math.round(c.r * 0.9 * (0.3 + c.fresh)));
      for (let i = 0; i < count && k < n; i++) {
        const a = r() * Math.PI * 2, d = c.r * (0.9 + r() * r() * 1.6), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (Math.abs(x) > WORLD.half - 3 || Math.abs(z) > WORLD.half - 3 || Math.hypot(x, z) < 26) continue;
        const s = 0.15 + r() * r() * (c.r > 30 ? 1.8 : 0.8);
        e.set(r() * 3, r() * 6, r() * 3); q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.25, z), q, new THREE.Vector3(s, s, s));
        rocks.setMatrixAt(k++, m); if (s > 0.6) this.rockList.push({ x, z, r: s * 0.9 });
      }
    }
    while (k < n) {   // pebbles everywhere else
      const x = (r() * 2 - 1) * (WORLD.half - 3), z = (r() * 2 - 1) * (WORLD.half - 3); if (Math.hypot(x, z) < 22) continue;
      const s = 0.06 + r() * r() * 0.3; e.set(r() * 3, r() * 6, r() * 3); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.2, z), q, new THREE.Vector3(s, s, s)); rocks.setMatrixAt(k++, m);
    }
    rocks.castShadow = rocks.receiveShadow = true; rocks.name = 'Boulders'; this.rocks = rocks; this.scene.add(rocks);
  }

  addSky() {
    // stars: faint, because the bright ground and Sun swamp them for eyes and cameras
    const n = 2600, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    let seed = 5; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p.set([Math.cos(a) * s * 9000, u * 9000, Math.sin(a) * s * 9000], i * 3);
      const b = 0.25 + r() ** 3 * 0.75, warm = r(); c.set([b, b * (0.92 + warm * 0.08), b * (1.05 - warm * 0.1)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
    this.stars.frustumCulled = false; this.scene.add(this.stars);
    // the Sun: a small white disc with glare (no blue sky to scatter it)
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const gg = cv.getContext('2d');
    const grd = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.07, 'rgba(255,255,250,1)'); grd.addColorStop(0.1, 'rgba(255,250,235,.5)'); grd.addColorStop(0.3, 'rgba(255,245,225,.08)'); grd.addColorStop(1, 'rgba(255,245,225,0)');
    gg.fillStyle = grd; gg.fillRect(0, 0, 256, 256);
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, fog: false, toneMapped: false }));
    this.sun.scale.setScalar(1200); this.scene.add(this.sun);
    // Earth: ~2 degrees wide from the Moon, lit by the same Sun so it shows the right phase
    const earthTex = new THREE.TextureLoader().load('assets/earth-map.jpg'); earthTex.colorSpace = THREE.SRGBColorSpace;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(85, 48, 32), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.8, emissive: '#0b1830', emissiveIntensity: 0.15 }));
    this.earth.name = 'Earth'; this.scene.add(this.earth);
  }

  // Place sky bodies around the camera.
  sky(camPos, sunDir, earthDir) {
    this.stars.position.copy(camPos);
    this.sun.position.copy(camPos).addScaledVector(sunDir, 8000);
    this.earth.position.copy(camPos).addScaledVector(earthDir, 5000);
    this.earth.rotation.y += 0.0004;
  }
}

function addSkirt(geo, n) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal, col = geo.attributes.color;
  const edge = []; for (let i = 0; i <= n; i++) edge.push(i); for (let i = 1; i <= n; i++) edge.push(i * (n + 1) + n);
  for (let i = n - 1; i >= 0; i--) edge.push(n * (n + 1) + i); for (let i = n - 1; i > 0; i--) edge.push(i * (n + 1));
  const P = Array.from(pos.array), U = Array.from(uv.array), N = Array.from(nrm.array), C = Array.from(col.array), I = Array.from(geo.index.array), start = pos.count;
  for (const id of edge) { P.push(pos.getX(id), pos.getY(id) - 8, pos.getZ(id)); U.push(uv.getX(id), uv.getY(id)); N.push(nrm.getX(id), nrm.getY(id), nrm.getZ(id)); C.push(col.getX(id), col.getY(id), col.getZ(id)); }
  for (let i = 0; i < edge.length; i++) { const j = (i + 1) % edge.length; I.push(edge[i], start + i, edge[j], edge[j], start + i, start + j); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeBoundingSphere();
}

export { skyVector };
