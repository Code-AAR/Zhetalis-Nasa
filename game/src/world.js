import { landmarkLift, driftLift, craterLift, craterField, rockWeight, bindBase, plateWeight, nearStop, channelFloor } from './landmarks.js';
import { WORLD_EXTENT, WORLD_HALF } from './chunk-plan.js';
import { createMeasuredTerrain } from './measured-terrain.js';
import { makeTerrainChunks, nearbyRocks } from './terrain-chunks.js';
import { GroundMarks } from './ground-marks.js';
// The 3D Mars surface: terrain, sky, outpost, rocks, things to collect, and the astronaut.
import * as THREE from 'three';
import { blockPanel } from './panel-contact.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadModel } from './nasamodels.js';
import { loadNasaAstronaut, poseAstronaut } from './suit.js';
import { Rover } from './rover.js';
import { createRockContact } from './rock-contact.js';
import { SURFACE_DETAIL, regolithMaps, rockMaterial, makeGroundDust } from './surface-detail.js';
import { solarPanel, makeCellMat } from './models.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeStars, makePlanets } from './sky.js';

// ---------- terrain shape (deterministic, so every player gets the same map) ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 5) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }

export const WORLD_SIZE = WORLD_EXTENT;
// Archived measured MOLA topography, cropped without resampling by the importer.
// The game compresses this region, exaggerates relief and flattens its base apron.
const [terrainResponse,metaResponse]=await Promise.all([
  fetch('assets/terrain/gusev-mola-128.bin'),fetch('assets/terrain/gusev-mola-128.json')
]);
if(!terrainResponse.ok||!metaResponse.ok)throw new Error('Measured Mars terrain could not load. Reload to retry.');
export const terrainMetadata=await metaResponse.json();
const terrainBuffer=await terrainResponse.arrayBuffer(),terrainView=new DataView(terrainBuffer);
if(terrainBuffer.byteLength!==terrainMetadata.n**2*2)throw new Error('Incomplete MOLA terrain download');
const measuredHeights=new Int16Array(terrainMetadata.n**2);
for(let i=0;i<measuredHeights.length;i++)measuredHeights[i]=terrainView.getInt16(i*2,true);
const measuredTerrain=createMeasuredTerrain(measuredHeights,terrainMetadata);
// Real ground brightness (albedo) over the same crop: Viking orbiter detail scaled to TES albedo (scripts/bake-gusev-albedo.py).
// Darker = dust swept away, showing dark basalt sand; brighter = more red dust. Optional: the game still runs without it.
const albedoMap=await Promise.all([fetch('assets/terrain/gusev-albedo-256.bin'),fetch('assets/terrain/gusev-albedo-256.json')])
  .then(async([b,j])=>b.ok&&j.ok?{q:new Uint8Array(await b.arrayBuffer()),meta:await j.json()}:null).catch(()=>null);
export const albedoMetadata=albedoMap?.meta||null;
const albedoMean=albedoMap?(albedoMap.meta.mean-albedoMap.meta.min)/(albedoMap.meta.max-albedoMap.meta.min):0;
// 0..1 sample of the stored albedo, or -1 outside the crop / when missing
function albedoSample(x,z){
  if(!albedoMap)return -1;const n=albedoMap.meta.n,span=albedoMap.meta.worldSpan;
  const u=(x/span+.5)*n-.5,v=(z/span+.5)*n-.5;if(u<0||v<0||u>n-1||v>n-1)return -1;
  const x0=Math.floor(u),z0=Math.floor(v),x1=Math.min(n-1,x0+1),z1=Math.min(n-1,z0+1),fx=u-x0,fz=v-z0,q=albedoMap.q;
  return((q[z0*n+x0]*(1-fx)+q[z0*n+x1]*fx)*(1-fz)+(q[z1*n+x0]*(1-fx)+q[z1*n+x1]*fx)*fz)/255;
}
// How much darker (dark > 0) or brighter (bright > 0) than average the real ground is here, faded out over the invented edge
export function groundAlbedo(x,z){
  const a=albedoSample(x,z);if(a<0)return{dark:0,bright:0,w:0};
  const w=1-edgeWeight(x,z);
  return{dark:Math.max(0,(albedoMean-a)/albedoMean),bright:Math.max(0,(a-albedoMean)/(1-albedoMean)),w};
}
// The measured NASA grid is very bumpy in the south-east, which is where Home Plate and the hills sit. Blur it there so the
// ground reads as the broad, quiet inner basin Spirit crossed, and blend back to the raw data further out.
function blurred(src,n,k){
  const a=Float32Array.from(src),b=new Float32Array(src.length),w=2*k+1;
  for(let pass=0;pass<2;pass++){
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){let s=0;for(let d=-k;d<=k;d++)s+=a[y*n+Math.min(n-1,Math.max(0,x+d))];b[y*n+x]=s/w;}
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){let s=0;for(let d=-k;d<=k;d++)s+=b[Math.min(n-1,Math.max(0,y+d))*n+x];a[y*n+x]=s/w;}
  }
  return a;
}
const calmHeights=blurred(measuredHeights,terrainMetadata.n,16);
const calmTerrain=createMeasuredTerrain(calmHeights,terrainMetadata);
const calmWeight=(x,z)=>{const t=Math.min(1,Math.max(0,(Math.hypot(x-235,z-235)-150)/130));return 1-t*t*(3-2*t);};
// The NASA crop covers 960 m. Past its edge (Gusev's outer rim and the cratered highlands beyond) the ground is invented:
// the regional level from a very smooth copy of the NASA grid, plus rolling hills and worn ridges. The fade ends before
// the data does (476 m), because past 480 m the grid only repeats its edge row and would draw straight streaks.
const farTerrain=createMeasuredTerrain(blurred(measuredHeights,terrainMetadata.n,48),terrainMetadata);
const edgeWeight=(x,z)=>{const t=Math.min(1,Math.max(0,(Math.max(Math.abs(x),Math.abs(z))-400)/76));return t*t*(3-2*t);};
const ridged=(x,z)=>1-Math.abs(2*fbm(x,z,3)-1);
const edgeSwell=(x,z)=>farTerrain.height(x,z)+16*(fbm(x*.0048+5,z*.0048-3,4)-.5)+3.5*(ridged(x*.012+2,z*.012+7)-.6);
const nasaAt=(x,z)=>{const w=calmWeight(x,z);return w<=0?measuredTerrain.height(x,z):measuredTerrain.height(x,z)*(1-w)+calmTerrain.height(x,z)*w;};
const baseAt=(x,z)=>{const e=edgeWeight(x,z);return e<=0?nasaAt(x,z):nasaAt(x,z)*(1-e)+edgeSwell(x,z)*e;};
bindBase(baseAt);
// Chart colours use a normalized copy; physics always samples the signed metre values.
// The map shows the landmark hills and crater too: add their game height, converted back to raw metres, before scaling.
const chartHeights=Uint16Array.from(measuredHeights,(_,i)=>{
  const n=terrainMetadata.n,span=WORLD_EXTENT,x=((i%n+.5)/n-.5)*span,z=((Math.floor(i/n)+.5)/n-.5)*span;
  const cw=calmWeight(x,z),h0=measuredTerrain.elevation(x,z),h1=calmTerrain.elevation(x,z),e=edgeWeight(x,z);
  const nasa=h0*(1-cw)+h1*cw,h=nasa*(1-e)+(measuredTerrain.origin+edgeSwell(x,z)/terrainMetadata.verticalScale)*e;
  const raw=h+(landmarkLift(x,z)+craterLift(x,z))/terrainMetadata.verticalScale;
  return Math.max(0,Math.min(65535,Math.round((raw-terrainMetadata.minMetres)/(terrainMetadata.maxMetres-terrainMetadata.minMetres)*65535)));
});
export const gusevGrid=()=>({data:chartHeights,n:terrainMetadata.n,cx:.5,cy:.5,span:WORLD_EXTENT});
export const heightAt=(x,z)=>baseAt(x,z)+landmarkLift(x,z)+driftLift(x,z)+craterLift(x,z);   // measured NASA MOLA ground plus the enlarged landmarks (landmarks.js)
// The far ground is drawn from a coarser grid (24 cells per 64 m tile) than the near ground, so the surface you see
// can sit up to about half a metre above the exact height. For anything that stands on the ground (rocks, masts)
// use this: it is the highest of the exact height and both ways the coarse mesh can be cut, so nothing floats.
const COARSE = 64 / 24;
export function groundHeight(x, z) {
  const exact = heightAt(x, z);
  if (Math.abs(x) >= WORLD_HALF || Math.abs(z) >= WORLD_HALF) return exact;
  const gx = (x + WORLD_HALF) / COARSE, gz = (z + WORLD_HALF) / COARSE, i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const at = (a, b) => heightAt(-WORLD_HALF + a * COARSE, -WORLD_HALF + b * COARSE);
  const h00 = at(i, j), h10 = at(i + 1, j), h01 = at(i, j + 1), h11 = at(i + 1, j + 1);
  const A = fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  const B = fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  return Math.max(exact, A, B);
}

// The Mars sky, coloured like NASA rover photos: butterscotch near the horizon, darker and browner overhead
// (fine red dust hangs high in the thin air), a pale glow around the Sun, and a BLUE glow at sunset
// (the same dust scatters blue light forward, towards you). Night is almost black - the air is 1% of Earth's.
function makeSky(scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zenith: { value: new THREE.Color('#9c6646') }, horizon: { value: new THREE.Color('#dcb08a') },
      halo: { value: new THREE.Color('#f2eee6') }, haloPower: { value: 1 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, haze: { value: 0 },
      cloudTime: { value: 0 }, cloudCol: { value: new THREE.Color('#e9e4de') }, cloudAmt: { value: 1 },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 zenith, horizon, halo, sunDir, cloudCol; uniform float haloPower, haze, cloudTime, cloudAmt; varying vec3 vDir;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm2(vec2 p) { float a = .5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(up, 0.5));
        col = mix(col, horizon * 0.85, clamp(-d.y * 5.0, 0.0, 1.0));            // below the horizon line
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += halo * (pow(s, 10.0) * 0.45 + pow(s, 80.0) * 0.7) * haloPower;    // wide halo + bright core around the Sun
        // Thin water-ice clouds, high up and stretched out by the wind, like the wisps NASA's rovers have filmed.
        // They catch the light after sunset (cloudCol from setTime) and hide in a dust storm.
        if (d.y > 0.0) {
          vec2 q = d.xz / (d.y + 0.12) * 1.3 + vec2(cloudTime * .006, cloudTime * .0022);
          float w = fbm2(q * vec2(1.0, 4.0) + fbm2(q * .7) * 1.6);
          float c = smoothstep(.6, .86, w) * smoothstep(.03, .3, d.y) * cloudAmt;
          col = mix(col, cloudCol, c * .3);
        }
        col = mix(col, horizon, haze * 0.65);                                    // a dust storm flattens everything
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), material);
  scene.add(sky);
  return sky;
}

// Fine dust floating in the air around you, catching the sunlight (and a lot more of it in a dust storm).
function makeMotes() {
  const N = SURFACE_DETAIL.dust, R = 24, pos = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 2 * R;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16); grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: '#bca18a', size: 0.009, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.NormalBlending, fog: true });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  points.userData.update = (dt, cam, t, wind) => {
    // specks stay put in the world (so they slide past as you walk); any that fall too far behind you
    // wrap round to the other side, so there is always a cloud around you. Each drifts with the wind.
    const a = geo.attributes.position.array, c = [cam.x, cam.y, cam.z];
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      a[j] += (wind + Math.sin(t * 0.3 + i) * 0.15) * dt; a[j + 1] += Math.sin(t * 0.5 + i * 1.7) * 0.05 * dt; a[j + 2] += Math.cos(t * 0.2 + i) * 0.12 * dt;
      for (let k = 0; k < 3; k++) { const rel = a[j + k] - c[k]; a[j + k] = c[k] + ((rel + R) % (2 * R) + 2 * R) % (2 * R) - R; }
    }
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}

// Mars's two small moons. Phobos orbits so fast (every 7.7 hours) that it rises in the WEST and sets in the
// EAST, crossing the sky about twice a sol; from the surface it looks about a third as wide as our Moon.
// Deimos is farther out and slower, and looks like a bright star.
function makeMoons() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 3), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {   // a lumpy potato, not a ball
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    v.multiply(new THREE.Vector3(1.35, 1, 1.1)).multiplyScalar(1 + (Math.sin(v.x * 7) * Math.cos(v.y * 5) + Math.sin(v.z * 9)) * 0.05);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  // Phobos is lit by the Sun even when it is night on the ground (it is high above Mars), so it glows softly
  const phobos = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#8d857c', emissive: '#7a7168', emissiveIntensity: 0.9, fog: false, transparent: true }));
  phobos.scale.setScalar(4.5);   // drawn about twice its real size (it looks about a third as wide as our Moon), so you can spot it
  const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dg = dc.getContext('2d');
  const grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16); grad.addColorStop(0, 'rgba(255,250,240,1)'); grad.addColorStop(0.3, 'rgba(255,250,240,0.5)'); grad.addColorStop(1, 'rgba(255,250,240,0)');
  dg.fillStyle = grad; dg.fillRect(0, 0, 32, 32);
  const deimos = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(dc), fog: false, transparent: true, depthWrite: false }));
  deimos.scale.setScalar(5);
  g.add(phobos, deimos);
  const tilt = new THREE.Euler(0.26, 0, 0);   // Gusev Crater is about 15° south of the equator, so the moons' path tilts
  g.userData = {
    phobos, deimos,
    place(phase, cam, night) {
      const hours = phase * 24.66;
      const pa = -hours / 11.1 * Math.PI * 2 + 1.2, da = -hours / 131 * Math.PI * 2 + 2.5;   // west -> east
      const on = (a, r) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0).applyEuler(tilt).add(cam);
      phobos.position.copy(on(pa, 780)); phobos.rotation.y = pa;
      deimos.position.copy(on(da, 800));
      phobos.material.opacity = 0.25 + 0.75 * night; deimos.material.opacity = night;
      phobos.visible = phobos.position.y > cam.y - 20; deimos.visible = deimos.position.y > cam.y;
    },
  };
  return g;
}

// Fine sand and pebbles, tiled over the ground (made in code, so nothing to download). Light grey, so it
// only adds grain on top of the terrain's own colours.
function gravelTexture() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) { const v = 205 + rnd() * 50; img.data.set([v, v * 0.97, v * 0.94, 255], i * 4); }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 120; i++) {                       // little stones with a shadow side
    const x = rnd() * N, y = rnd() * N, r = 0.8 + rnd() * 2.6;
    g.fillStyle = `rgba(90,45,25,${0.12 + rnd() * 0.18})`; g.beginPath(); g.arc(x + r * 0.4, y + r * 0.4, r, 0, 7); g.fill();
    g.fillStyle = `rgba(255,236,215,${0.15 + rnd() * 0.2})`; g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(150, 150);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function makeTerrain() {
  const rust=new THREE.Color('#9e7054'),dusty=new THREE.Color('#bc9470'),basalt=new THREE.Color('#55504a'),darkSand=new THREE.Color('#6b5444'),pale=new THREE.Color('#cab292');
  return makeTerrainChunks(heightAt,(x,z,y,col)=>{
    const slope=Math.abs(heightAt(x+1.5,z)-y)+Math.abs(heightAt(x,z+1.5)-y);
    // Broad patches (dark basalt sand against pale dust), rocky hill flanks, pale dust drifted into the dips.
    const patch=fbm(x*.011+9,z*.011-4,3),fine=fbm(x*.08,z*.08,3),hollow=THREE.MathUtils.clamp((heightAt(x+6,z)+heightAt(x-6,z)+heightAt(x,z+6)+heightAt(x,z-6))/4-y,0,.6)/.6;
    craterLift(x,z);const bowl=craterField.bowl,rimW=craterField.rim,hillH=landmarkLift(x,z);
    // dark and pale patches: from NASA's albedo map inside the measured crop, invented noise on the outer ground
    const ga=groundAlbedo(x,z),made=THREE.MathUtils.clamp((patch-.5)*2.2,0,.7);
    // (contrast boosted about three times so the real pattern reads on screen; real Gusev dark ground is about 12% darker)
    const gd=ga.dark*ga.w,gb=ga.bright*ga.w,darkMix=THREE.MathUtils.lerp(made,THREE.MathUtils.clamp(ga.dark*(.8+.3*fine),0,.95),ga.w);
    col.copy(rust).lerp(dusty,fine*(1-gd*.7)+gb*.5).lerp(darkSand,darkMix).lerp(basalt,gd*.45).multiplyScalar(1-.3*gd+.12*gb).lerp(pale,THREE.MathUtils.clamp((y-25)/60,0,.6)).lerp(pale,hollow*.45).lerp(basalt,THREE.MathUtils.clamp(slope/4-.15+(y>6?.12:0),0,.8));
    // Crater floors fill with pale dust and sit in shade; rims and ejecta are darker. Hills show bands of darker and paler rock.
    col.lerp(pale,bowl*.5).multiplyScalar(1-.22*bowl).lerp(basalt,rimW*.35);
    const inChannel=channelFloor(x,z);if(inChannel>0)col.lerp(darkSand,inChannel*.55).multiplyScalar(1-.12*inChannel);   // dark sand on Ma'adim's channel floor
    const onPlate=plateWeight(x,z);
    if(hillH>1.5&&onPlate<.5){const strata=.5+.5*Math.sin(hillH*1.7+fbm(x*.05,z*.05,2)*3);col.lerp(strata>.55?basalt:dusty,Math.min(.3,hillH/30)*Math.abs(strata-.5)*1.6);}
    // Home Plate's top: pale layered rock under thin dust, with darker sand caught in hollows
    if(onPlate>0)col.lerp(pale,onPlate*.55).lerp(darkSand,onPlate*THREE.MathUtils.clamp((fbm(x*.09+3,z*.09,3)-.52)*3,0,.45));
    col.offsetHSL(0,-.2,-.015);
  },(x,z)=>{const g=groundAlbedo(x,z);return g.dark*g.w;});   // last part: how dark NASA says it is, so storm dust can cover it
}

// Boulders, flat slabs and loose pebbles like the Perseverance photo of Jezero Crater. The stones are lumpy
// (noise pushes every point in or out), smooth-shaded, flat on the bottom, darker in the hollows and lighter on top.
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), t = fz * fz * (3 - 2 * fz), L = (a, b, k) => a + (b - a) * k;
  return L(L(L(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), L(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
           L(L(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), L(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v), t);
}
export function rockGeometry(seed, { detail = 3, squash = 1, rough = .3 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = noise3(v.x * 1.6 + seed, v.y * 1.6 + seed * .7, v.z * 1.6 - seed) - .5, m = noise3(v.x * 5 + seed, v.y * 5, v.z * 5 - seed) - .5;
    const r = 1 + n * rough * 1.6 + m * rough * .35 + (v.y > 0 ? -.05 : 0);
    v.multiplyScalar(r); v.y = Math.max(v.y * squash, -.32 * squash);                    // flat underside, so it sits in the ground
    p.setXYZ(i, v.x, v.y, v.z);
    const shade = .5 + .4 * THREE.MathUtils.clamp(v.y * .5 + .55, 0, 1) + n * .5 + m * .45; col[i * 3] = shade; col[i * 3 + 1] = shade * .97; col[i * 3 + 2] = shade * .95;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function makeRocks(rng) {
  const count = 900;
  const geo = SURFACE_DETAIL.texture >= 1024
    ? rockGeometry(73, {detail: 5, rough: .35})
    : new THREE.DodecahedronGeometry(1, 0);
  // Spherical coordinates keep the fine mineral relief attached to the mesh.
  if (!geo.attributes.uv) {
    const positions=geo.attributes.position,uv=new Float32Array(positions.count*2);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=Math.hypot(x,y,z);
      uv[i*2]=.5+Math.atan2(z,x)/(Math.PI*2);uv[i*2+1]=.5+Math.asin(y/r)/Math.PI;
    }
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  const mat = rockMaterial();
  mat.vertexColors=!!geo.attributes.color;mat.flatShading=!geo.attributes.color;
  const rocks = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const tints = ['#65544a', '#7f6450', '#403d39', '#8f7158', '#2f2d2b', '#4b4540'].map(c => new THREE.Color(c));
  const colliders = [], lowRocks = [];
  const vertices = geo.attributes.position, vertex = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    let x, z, tries = 0;
    do { x = (rng() - 0.5) * WORLD_SIZE * 0.82; z = (rng() - 0.5) * WORLD_SIZE * 0.82; tries++; }
    while (Math.hypot(x, z) < 24 || nearStop(x, z) || (tries < 60 && rng() > rockWeight(x, z, fbm(x * .018 + 3, z * .018 - 7, 3))));
    // Many small stones, few big ones (a power law, like real boulder counts); the biggest are rare.
    const slab = rng() < 0.4, size = Math.min(slab ? 4.6 : 3.2, (slab ? .9 : .32) * Math.pow(1 - rng() * .985, -.55));
    const stretch = .6 + rng() * 1.1;   // some stones long and thin, some round
    s.set(size * (0.7 + rng() * .5) * stretch, slab ? size * (0.22 + rng() * .16) : size * (0.45 + rng() * 0.8), size * (0.7 + rng() * .5) / Math.sqrt(stretch));
    p.set(x, heightAt(x, z) + s.y * 0.35, z);
    q.setFromEuler(e.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3));
    // Follow the local slope, then embed the whole lower cap rather than
    // balancing a wide slab on its single highest contact point.
    const normal=new THREE.Vector3(heightAt(x-.5,z)-heightAt(x+.5,z),1,heightAt(x,z-.5)-heightAt(x,z+.5)).normalize();
    q.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal));
    let support=Infinity;
    for(let j=0;j<vertices.count;j++){
      if(vertices.getY(j)>-.12)continue;
      vertex.fromBufferAttribute(vertices,j).multiply(s).applyQuaternion(q);
      support=Math.min(support,groundHeight(x+vertex.x,z+vertex.z)-vertex.y);
    }
    p.y=support-Math.max(.08,Math.min(.25,s.y*.15));
    rocks.setMatrixAt(i, m.compose(p, q, s));
    const dark = rng() < .22;   // dark vesicular basalt
    rocks.setColorAt(i, tints[dark ? 2 + Math.floor(rng() * 2) * 2 : Math.floor(rng() * tints.length)].clone().multiplyScalar(dark ? .8 : .8 + rng() * .4));
    let top = -Infinity, radiusSq = 0;
    for (let j = 0; j < vertices.count; j++) {
      vertex.fromBufferAttribute(vertices, j).multiply(s).applyQuaternion(q);
      top = Math.max(top, p.y + vertex.y);
      radiusSq = Math.max(radiusSq, vertex.x * vertex.x + vertex.z * vertex.z);
    }
    const radius = Math.sqrt(radiusSq);
    if (top - heightAt(x, z) <= 0.8) lowRocks.push({ x, z, top, radius });
    else colliders.push({ x, z, rock: true, r: slab ? radius * 0.6 : size * 0.9 });
  }
  rocks.castShadow = true; rocks.receiveShadow = true;
  return { rocks, colliders, lowRocks };
}

// Blend the visible rock top into the surrounding soil so boots and tyres can
// climb gradually. Keep the bare terrain sampler for scenery and placement.
function surfaceAt(x, z, lowRocks, padding) {
  const ground = heightAt(x, z);
  let support = ground;
  for (const rock of lowRocks) {
    const dx = x - rock.x, dz = z - rock.z;
    const distanceSq = dx * dx + dz * dz;
    const edge = rock.radius + padding;
    if (distanceSq >= edge * edge || rock.top <= ground) continue;
    const weight = 1 - THREE.MathUtils.smoothstep(Math.sqrt(distanceSq), rock.radius * 0.35, edge);
    support = Math.max(support, THREE.MathUtils.lerp(ground, rock.top, weight));
  }
  return support;
}

export const GH={x:0,z:38,r:7};
const LANDER_SCALE = 1.6;   // the team lander model is 11 m tall; 1.6x makes it a roomy crew lander
function mat(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }); }
// Three.js positions can't be replaced, only changed - this places a mesh and returns it.
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

// The outpost that is "already there" when you land.
function makeOutpost() {
  const g = new THREE.Group();
  const white = mat('#ece8e1', { flatShading: false }), stripe = mat('#d9683a', { flatShading: false }), dark = mat('#23262b'), glass = new THREE.MeshLambertMaterial({ color: '#9fd7c9', transparent: true, opacity: 0.45 });
  const hab = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 4.5, 64), white); hab.position.y = 2.25; g.add(hab);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), white); dome.position.y = 4.5; g.add(dome);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.45, 6.45, 0.5, 64), stripe); band.position.y = 3.6; g.add(band);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.6), dark); door.position.set(0, 1.5, 6.1); g.add(door);
  const doorLight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7), new THREE.MeshBasicMaterial({ color: '#7dffb2' })); doorLight.position.set(0, 3.1, 6.15); g.add(doorLight);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 32), white); tunnel.rotation.z = Math.PI / 2; tunnel.position.set(-8.5, 1.4, 1); g.add(tunnel);
  // greenhouse
  const gh = new THREE.Mesh(new THREE.SphereGeometry(4.2, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass); gh.position.set(-14, 0, 1); g.add(gh);
  for (let i = 0; i < 14; i++) {
    const plant = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1 + (i % 3) * 0.3, 8), mat('#4caf50'));
    plant.position.set(-14 + Math.cos(i) * 2.4 * ((i % 4) / 4 + 0.3), 0.6, 1 + Math.sin(i * 1.7) * 2.2 * ((i % 3) / 3 + 0.3)); g.add(plant);
  }
  // comms dish
  const comms = new THREE.Group(); comms.position.set(9, 0, 9);
  comms.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 5, 20), white), 0, 2.5, 0));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2, 40, 10, 0, Math.PI * 2, 0, Math.PI / 3.2), new THREE.MeshLambertMaterial({ color: '#ece8e1', side: THREE.DoubleSide }));
  dish.rotation.x = -Math.PI / 2.6; dish.position.y = 5.2; comms.add(dish);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshBasicMaterial({ color: '#7dffb2' })); beacon.position.y = 6.4; comms.add(beacon);
  g.add(comms);
  // water-wall shielding ring, shown after the upgrade
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(6.9, 6.9, 2.6, 64, 1, true), new THREE.MeshLambertMaterial({ color: '#3b7bd8', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  wall.position.y = 1.3; wall.visible = false; g.add(wall);
  // the lander you arrived in: the team's lander model (assets/lander.glb, loaded in World), made 1.6x bigger -
  // about 17.6 m tall and 6.3 m wide, like the big crew landers NASA studies for Mars. Its ladder and door face the outpost.
  // These simple shapes stand in until the model arrives.
  const lander = new THREE.Group(); lander.position.set(-6, 0, -17); lander.rotation.y = Math.atan2(6, 17); lander.scale.setScalar(LANDER_SCALE); lander.name = 'lander';
  lander.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 7, 48), white), 0, 4.5, 0));
  lander.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 48), white), 0, 9.5, 0));
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), dark);
    leg.position.set(Math.cos(i * Math.PI / 2) * 2.3, 1.2, Math.sin(i * Math.PI / 2) * 2.3); leg.rotation.z = Math.cos(i * Math.PI / 2) * 0.35; leg.rotation.x = -Math.sin(i * Math.PI / 2) * 0.35; lander.add(leg);
  }
  lander.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 48), stripe), 0, 6.5, 0));
  // a glowing green strip at the foot of the ladder: walk here and press E to climb up to the door
  const foot = new THREE.Group(); foot.position.copy(lander.position); foot.rotation.y = lander.rotation.y; g.add(foot);
  foot.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: '#7dffb2' })), 0, 0.05, 2.2 * LANDER_SCALE + 0.9));
  g.add(lander);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, dish, beacon, wall, colliders: [{ x: 0, z: 0, r: 7 }, { x: -14, z: 1, r: 4.4 }, { x: -8.5, z: 1, r: 1.8 }, { x: -6, z: -17, r: 2.3 * LANDER_SCALE }, { x: 9, z: 9, r: 0.6 }] };
}

// Sun disc + glow (the glow turns blue at sunset - real Mars sunsets are blue) and a star field for night.
function makeSkyLights(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#fff1dc', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(260); scene.add(glow);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 20), new THREE.MeshBasicMaterial({ color: '#fffaf0', fog: false }));
  scene.add(disc);
  // thousands of stars and the Milky Way; the thin, dry air of Mars makes the night sky very clear
  const stars = makeStars(850, 3500, true); scene.add(stars);
  // the planets as seen from Mars tonight (NASA JPL formulas) - Earth is the blue "star"
  const planets = makePlanets(840, { from: 'mars', centre: 'earth', yaw: 0.25, pitch: 0.42, hide: ['sun'] }); scene.add(planets);
  const moons = makeMoons(); scene.add(moons);
  const motes = makeMotes(); scene.add(motes);
  return { glow, disc, stars, planets, moons, motes };
}

function makeSolarField() {
  const g = new THREE.Group(); g.position.set(16, 0, -8);
  const cellMat = makeCellMat(); g.userData.panelMat = cellMat;
  const panels = [];
  for (let i = 0; i < 12; i++) {
    const px = (i % 4) * 4.6, pz = Math.floor(i / 4) * 3.4, p = solarPanel(cellMat, { w: 3.2, d: 2, tilt: .5, low: .6 });
    p.position.set(px, heightAt(g.position.x + px, g.position.z + pz), pz);
    p.visible = false; g.add(p); panels.push(p);
  }
  return { group: g, panels };
}

// Glowing pickups with a tall beam, like the beacon in No Man's Sky, so kids can find them.
function makePickup(kind) {
  const g = new THREE.Group();
  const looks = {
    ice:   { geo: new THREE.IcosahedronGeometry(0.7, 0), color: '#9fe7ff', beam: '#9fe7ff' },
    metal: { geo: new THREE.OctahedronGeometry(0.6, 0),  color: '#c9ced6', beam: '#ffd27a' },
    pod:   { geo: new THREE.CylinderGeometry(0.9, 1.1, 1.8, 24), color: '#f2f2f2', beam: '#ff7a3d' },
  }[kind];
  const body = new THREE.Mesh(looks.geo, new THREE.MeshLambertMaterial({ color: looks.color, emissive: looks.color, emissiveIntensity: 0.35, flatShading: true }));
  body.geometry.computeBoundingBox();
  body.castShadow = true; body.position.y = -body.geometry.boundingBox.min.y; g.add(body);
  // a soft glowing column that fades out upward (a hard 40 m line looked like a glitch in the sky)
  const beamGeo = new THREE.CylinderGeometry(0.03, 0.24, 10, 10, 6, true), bp = beamGeo.attributes.position, ba = new Float32Array(bp.count * 4);
  for (let i = 0; i < bp.count; i++) { const up = (bp.getY(i) + 5) / 10; ba.set([1, 1, 1, Math.pow(1 - up, 2)], i * 4); }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(ba, 4));
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: looks.beam, vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 5; g.add(beam);
  g.userData.body = body;
  return g;
}

// The astronaut: `g` is where the physics puts you; `rig` holds everything you see, so the body can bob,
// lean and squash without moving the physics. Arms and legs hang from pivots at the shoulders and hips.
function makeAstronaut() {
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
  const suit = mat('#f3f1ec'), orange = mat('#e2622f'), visor = new THREE.MeshPhongMaterial({ color: '#1b2a3a', shininess: 90, specular: '#ffcf9a' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 10), suit); body.position.y = 0.95; rig.add(body);
  const head = new THREE.Group(); head.position.y = 1.62; rig.add(head);                     // the helmet nods a little as you walk
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), suit); helmet.position.y = 0.16; head.add(helmet);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 4, Math.PI / 2.4), visor); face.position.set(0, 0.18, 0.1); head.add(face);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), suit); pack.position.set(0, 1.05, -0.42); rig.add(pack);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.86), orange); band.position.y = 1.3; rig.add(band);
  const limb = (x, y, len, r) => {                       // a pivot with the limb hanging below it
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), suit); m.position.y = -len / 2 - r; pivot.add(m);
    rig.add(pivot); return pivot;
  };
  const legs = [limb(-0.18, 0.62, 0.36, 0.15), limb(0.18, 0.62, 0.36, 0.15)];
  const arms = [limb(-0.5, 1.38, 0.42, 0.11), limb(0.5, 1.38, 0.42, 0.11)];
  arms[0].rotation.z = -0.12; arms[1].rotation.z = 0.12;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  Object.assign(g.userData, { rig, legs, arms, head });
  return g;
}

// Turn by the shortest way round (so you never spin 350° to face 10° to the left).
const WALK = 3.2, RUN = 6.2;   // m/s - a brisk walk and a low-gravity lope (take the rover for long trips)
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class World {
  constructor(renderer, facts, onLoaded) {
    this.facts = facts;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1800);
    this.scene.fog = new THREE.Fog('#d9a27a', 45, 520);
    this.sky = makeSky(this.scene);
    this.skyLights = makeSkyLights(this.scene);
    this.hemi = new THREE.HemisphereLight('#ffe2c4', '#6b3a22', 1.15); this.scene.add(this.hemi);
    this.headlamp = new THREE.SpotLight('#fff4e0', 0, 40, 0.5, 0.8, 1.4);   // switches on at night
    this.scene.add(this.headlamp, this.headlamp.target);
    this.phase = 0.3; this.dustOn = false;
    this.sun = new THREE.DirectionalLight('#fff1dc', 1.9);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    // a tighter, sharper shadow area around you, so the suit and rover shade themselves
    Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.terrain = makeTerrain(); this.scene.add(this.terrain);
    this.groundDust = makeGroundDust(heightAt); this.scene.add(this.groundDust);

    let seed = 2126; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const { rocks, colliders, lowRocks } = makeRocks(rng); this.scene.add(rocks); this.rocks=rocks;
    this.lowRocks = lowRocks;
    this.rockContact = createRockContact(rocks);
    rocks.visible=false;this.rockDisplay=nearbyRocks(rocks,this.terrain);this.scene.add(this.rockDisplay);
    this.outpost = makeOutpost(); this.scene.add(this.outpost.group);
    this.solar = makeSolarField(); this.scene.add(this.solar.group);
    this.colliders = [...colliders, ...this.outpost.colliders];
    this.door = new THREE.Vector3(0, 0, 8.2);

    this.pickups = [];
    for (let i = 0; i < 34; i++) {
      const kind = rng() < 0.55 ? 'ice' : 'metal';
      let x, z; do { const a = rng() * Math.PI * 2, d = 35 + rng() * 170; x = Math.cos(a) * d; z = Math.sin(a) * d; } while (heightAt(x, z) > 40);
      this.addPickup(kind, x, z);
    }

    // NASA's real Perseverance model (NASA/JPL-Caltech) as the old rover to salvage.
    this.rover = { x: 95, z: -110, salvaged: false, group: new THREE.Group() };
    this.rover.group.position.set(this.rover.x, heightAt(this.rover.x, this.rover.z), this.rover.z);
    this.scene.add(this.rover.group);
    const roverBeam = makePickup('metal').children[1]; roverBeam.material = roverBeam.material.clone(); roverBeam.material.color.set('#ffd27a');
    this.rover.group.add(roverBeam);
    this.colliders.push({ x: this.rover.x, z: this.rover.z, r: 2.2 });
    new GLTFLoader().load('assets/perseverance.glb', gltf => {
      const model = gltf.scene, box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      const scale = 3 / Math.max(size.x, size.z);  // the real rover is about 3 m long
      model.scale.setScalar(scale);
      const b2 = new THREE.Box3().setFromObject(model); model.position.y -= b2.min.y;
      model.rotation.y = 0.7;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material?.color) o.material.color.lerp(new THREE.Color('#c58a62'), 0.35); } }); // 105 years of Mars dust
      this.rover.group.add(model);
      onLoaded?.();
    }, undefined, err => { console.warn('Perseverance model failed to load', err); onLoaded?.(); });

    // NASA's Ingenuity helicopter (official NASA 3D model), resting near the old rover - real size, 49 cm tall
    this.heli = { x: this.rover.x + 5, z: this.rover.z + 4, seen: false };
    loadModel('ingenuity.glb').then(g => {
      if (!g) return;
      const m = g.scene, size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      m.scale.setScalar(0.49 / size.y);
      const b = new THREE.Box3().setFromObject(m);
      m.position.set(this.heli.x, heightAt(this.heli.x, this.heli.z) - b.min.y, this.heli.z);
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; for (const mt of [].concat(o.material)) { mt.metalness = Math.min(mt.metalness, 0.3); mt.color?.lerp(new THREE.Color('#c58a62'), 0.25); } } });
      this.scene.add(m); this.heli.model = m;
    });

    // NASA's Space Exploration Vehicle: a pressurised crew rover you can drive (rover.js)
    // Sample rendered rock triangles, including large sloping slabs. Cache only
    // within a frame so movement checks and suspension share exact contacts.
    this.roverSurfaceCache = new Map();
    const roverSample = (x,z) => {
      const key = `${x},${z}`;
      let value = this.roverSurfaceCache.get(key);
      if(!value){value=this.rockContact.surface(x,z,heightAt(x,z));this.roverSurfaceCache.set(key,value);}
      return value;
    };
    this.sev = new Rover(this.scene, (x,z)=>roverSample(x,z).height, this.colliders);
    this.sev.surfaceSample = roverSample;
    this.sevCollider = { x: this.sev.pos.x, z: this.sev.pos.z, r: 2.4, self: true };
    this.marks = new GroundMarks(this.scene, heightAt, { onBright: z => this.onBrightSoil?.(z) });   // tyre tracks and boot prints (ground-marks.js)
    this.colliders.push(this.sevCollider);
    this.driving = false;

    this.player = makeAstronaut();
    this.player.position.set(-1.5, 0, -11);                 // you climb out of your capsule (the lander)...
    this.yaw = Math.atan2(1.5, 11);                          // ...and see the outpost waiting for you
    this.scene.add(this.player);

    // regolith (Mars soil) mound, shown once you bury the outpost - with a gap left for the door
    const soil = new THREE.MeshLambertMaterial({ color: '#9a5a36' });
    this.regolith = new THREE.Group();
    this.regolith.add(at(new THREE.Mesh(new THREE.CylinderGeometry(7.6, 8.4, 4.8, 56, 1, false, Math.PI * 0.12, Math.PI * 1.76), soil), 0, 2.4, 0));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(7.6, 56, 16, 0, Math.PI * 2, 0, Math.PI / 2), soil); cap.position.y = 4.6; cap.scale.y = 0.75;
    this.regolith.add(cap);
    this.regolith.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.regolith.visible = false; this.scene.add(this.regolith);

    // Team models: drop a .glb with one of these names into game/assets/ and it replaces the
    // placeholder shape automatically (scaled to the same height). No code changes needed.
    // NASA's own Astronaut 3D model, cut into jointed parts so it can really walk (suit.js).
    // If it can't load, the team model (assets/astronaut.glb) or the simple shapes are used instead.
    loadNasaAstronaut().then(a => {
      if (!a) return this.swapModel('astronaut.glb', this.player.userData.rig, 1.85);
      const rig = this.player.userData.rig;
      rig.children.forEach(c => (c.visible = false));
      rig.add(a.root); this.suit = a;
      a.elbows[1].add(this.handSlot); this.handSlot.position.set(0.15, 0, 0); this.handSlot.visible = true;   // into the right glove (it was hidden with the placeholder body above)
    }).catch(err => { console.warn('NASA astronaut failed', err); this.swapModel('astronaut.glb', this.player.userData.rig, 1.85); });
    // The mission settlement loads the supplied connected habitat modules. // main hab parts
    this.useLander();
    // the tool in your hands: on the suit's right forearm in third person, and in front of the camera in first person
    this.toolSwing = -1;                   // 0..1 while swinging the pickaxe, -1 otherwise
    this.handSlot = new THREE.Group(); this.player.userData.rig.add(this.handSlot);   // moved onto the forearm once the suit loads
    this.handSlot.position.set(0.55, 0.85, 0.12);
    this.viewSlot = new THREE.Group(); this.camera.add(this.viewSlot); this.scene.add(this.camera);
    this.placeViewSlot();
    this.vel = new THREE.Vector3(); this.onGround = true; this.pitch = 0.25;
    this.move = new THREE.Vector3(); this.gait = 0; this.swing = 0; this.squash = 0; this.lean = { x: 0, z: 0 };   // animation state
    this.firstPerson = true; this.lookPitch = 0;   // V switches view; lookPitch is up/down in first person
    this.keys = {}; this.time = 0; this.panelsDirty = false;
    this.setTime(this.phase);
  }

  // The team's lander model, scaled up (LANDER_SCALE). Its door and ladder face local +z.
  useLander() {
    const lander = this.outpost.group.getObjectByName('lander');
    lander.updateWorldMatrix(true, false);
    this.shipDoor = lander.localToWorld(new THREE.Vector3(0, 0, 2.2 + 0.9 / LANDER_SCALE)); this.shipDoor.y = 0;   // the foot of the ladder
    this.swapModel('lander.glb', lander, 11);
  }

  swapModel(file, target, height, onlyChildren) {
    if (!target) return;
    new GLTFLoader().load('assets/' + file, gltf => {
      const model = gltf.scene;
      const old = onlyChildren ? onlyChildren.map(i => target.children[i]).filter(Boolean) : [...target.children];
      const ref = new THREE.Box3(); old.forEach(o => ref.expandByObject(o));
      const want = height ?? ref.getSize(new THREE.Vector3()).y;
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      if (size.y > 0) model.scale.setScalar(want / size.y);
      const box = new THREE.Box3().setFromObject(model); model.position.y -= box.min.y;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      old.forEach(o => (o.visible = false));
      target.add(model);
      console.info('Using team model', file);
      // If the model comes with animations named like "Idle", "Walk" and "Run" (e.g. from Mixamo), play them.
      if (file === 'astronaut.glb' && gltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(model), find = re => gltf.animations.find(a => re.test(a.name));
        const clips = { idle: find(/idle|stand|breath/i), walk: find(/walk/i), run: find(/run|jog/i) };
        const actions = {};
        for (const [k, c] of Object.entries(clips)) if (c) { actions[k] = mixer.clipAction(c); actions[k].play(); actions[k].setEffectiveWeight(0); }
        this.astroAnim = { mixer, actions };
        console.info('Astronaut animations:', Object.keys(actions).join(', ') || 'none matched', gltf.animations.map(a => a.name));
      }
    }, undefined, () => { /* no team model yet - keep the placeholder */ });
  }

  // Optional team illustration: a seamless ground-detail texture (assets/art/mars-ground.*), tiled across Mars.
  // It multiplies the terrain's own colours, so a light, neutral texture works best.
  useGroundArt(url) {
    new THREE.TextureLoader().load(url, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(70, 70); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      this.terrain.material.map = tex; this.terrain.material.needsUpdate = true;
    });
  }

  addPickup(kind, x, z) {
    const g = makePickup(kind); g.position.set(x, heightAt(x, z), z);
    this.scene.add(g); this.pickups.push({ kind, group: g, x, z });
    return g;
  }
  removePickup(p) { this.scene.remove(p.group); this.pickups.splice(this.pickups.indexOf(p), 1); }

  dropSupplyPod() {
    const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 25;
    return this.addPickup('pod', Math.cos(a) * d, Math.sin(a) * d);
  }

  setPanels(n) { this.solar.panels.forEach((p, i) => (p.visible = i < n)); }
  setPanelDust(clean) {
    const material=this.solar.group.userData.panelMat;
    const dust=THREE.MathUtils.clamp(1-clean,0,1);
    material.userData.dust.value=dust;
    material.roughness=.3+.6*dust;
    material.metalness=.5*(1-dust);
    material.emissiveIntensity=.55*(1-dust);
  }
  setWall(level) { if(this.settlement)return this.settlement.setWall(level);this.outpost.wall.visible = level > 0; }
  setRegolith(on) {
    if(this.settlement)return this.settlement.setRegolith(on);
    this.regolith.visible = on;
    const hab = this.colliders.find(c => c.x === 0 && c.z === 0); if (hab) hab.r = on ? 8.2 : 7;
  }
  setLink(up) { this.outpost.beacon.material.color.set(up ? '#7dffb2' : '#ff4b3a'); this.linkUp = up; }
  setDust(on) { if (this.dustOn && !on) this.marks?.clear(); this.buried = 0; this.dustOn = on; this.setTime(this.phase); }   // a storm buries every track

  // phase: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset (one sol = 24.66 Mars hours)
  setTime(phase) {
    this.phase = phase;
    const ang = (phase - 0.25) * Math.PI * 2, elev = Math.sin(ang);          // sun height, -1..1
    const day = THREE.MathUtils.smoothstep(elev, -0.3, 0.22);                  // 0 at night, 1 in full day (long dusty twilight)
    const dusk = Math.max(0, 1 - Math.abs(elev + 0.05) / 0.38);                // around sunrise and sunset
    const dir = new THREE.Vector3(Math.cos(ang) * 0.9, elev, 0.35).normalize();
    this.sunDir = dir;
    this.sun.intensity = (this.dustOn ? 0.6 : 1.9) * day;
    this.sun.color.set('#fff1dc').lerp(new THREE.Color('#ffc08a'), dusk);
    this.hemi.intensity = 0.22 + 0.93 * day * (this.dustOn ? 0.7 : 1);
    const u = this.sky.material.uniforms, C = c => new THREE.Color(c);
    u.zenith.value.copy(C(this.dustOn ? '#8a5232' : '#9c6646')).lerp(C('#2a1f2a'), dusk * 0.6).lerp(C('#3d2c38'), THREE.MathUtils.clamp((1 - day) * 1.2, 0, 1) * 0.8).lerp(C('#020308'), THREE.MathUtils.clamp((1 - day - 0.55) / 0.45, 0, 1));
    u.horizon.value.copy(C(this.dustOn ? '#b5744c' : '#dcb08a')).lerp(C('#b07a5a'), dusk * 0.5).lerp(C('#0d0b12'), 1 - day);
    u.halo.value.copy(C('#f2eee6')).lerp(C('#4f8be0'), Math.min(1, dusk * 1.5));   // pale by day, blue at sunset
    // ice clouds: pale by day, blue-white glow while the Sun is just below the horizon (the clouds are high enough to stay lit), dark at night
    const glowAfter = THREE.MathUtils.clamp(1 - Math.abs(elev + .1) / .14, 0, 1);
    u.cloudCol.value.copy(C('#efe9e2')).multiplyScalar(.35 + .65 * day).lerp(C('#a9c4f0'), glowAfter * .8).multiplyScalar(Math.max(day, glowAfter * .9, .06));
    u.cloudAmt.value = this.dustOn ? 0 : 1;
    u.haloPower.value = (0.6 + dusk * 1.6) * THREE.MathUtils.clamp((elev + 0.25) / 0.2, 0, 1) * (this.dustOn ? 0.35 : 1);
    u.sunDir.value.copy(dir); u.haze.value = this.dustOn ? 1 : 0;
    this.skyLights.motes.material.opacity = (0.10 * day * day) * (this.dustOn ? 2 : 1);
    this.skyLights.motes.material.size = this.dustOn ? 0.007 : 0.003;
    this.nightness = 1 - day;
    const fogDay = new THREE.Color(this.dustOn ? '#b06a43' : '#d9a27a');
    this.scene.fog.color.copy(fogDay).lerp(new THREE.Color('#121019'), 1 - day);
    this.scene.fog.near = this.dustOn ? 18 : 45; this.scene.fog.far = this.dustOn ? 140 : 520 - 200 * (1 - day);
    this.skyLights.stars.setOpacity((1 - day) * (this.dustOn ? 0.2 : 1));
    this.skyLights.planets.userData.setOpacity((1 - day) * (this.dustOn ? 0.15 : 0.9));
    this.skyLights.glow.material.color.set('#fff1dc').lerp(new THREE.Color('#3f86ff'), Math.min(1, dusk * 1.4));  // the blue sunset
    this.skyLights.glow.material.opacity = THREE.MathUtils.clamp((elev + 0.3) / 0.2, 0, 0.95);
    this.skyLights.glow.scale.setScalar(260 + dusk * 520);
    this.glowDir = new THREE.Vector3(dir.x, Math.max(dir.y, 0.07), dir.z).normalize();   // keep the glow just above the hills
    this.skyLights.disc.visible = elev > -0.06;
    this.headlamp.intensity = (1 - day) * 25;
    this.night = day < 0.35;
  }

  // Astronaut animation. With NASA's jointed suit (suit.js) the hips, knees and arms really move, and the body
  // rises and falls in a smooth wave over each foot. Steps follow the distance walked, so feet don't slide.
  // Mars has 38% of Earth's gravity, so running becomes long, floaty strides.
  animateAstronaut(dt, running) {
    const u = this.player.userData, rig = u.rig, speed = Math.hypot(this.move.x, this.move.z);
    const pace = Math.min(1, speed / WALK), run = THREE.MathUtils.clamp((speed - WALK) / (RUN - WALK), 0, 1);
    const ease = k => 1 - Math.exp(-dt * k);
    // face where you are going, turning smoothly (no snapping)
    if (speed > 0.4) {
      const turn = angleTo(this.player.rotation.y, Math.atan2(this.move.x, this.move.z));
      this.player.rotation.y += turn * ease(7);
      this.lean.z += (THREE.MathUtils.clamp(-turn * 0.35, -0.12, 0.12) * pace - this.lean.z) * ease(5);
    } else this.lean.z *= Math.exp(-dt * 5);
    // one full cycle (left + right step) per 2.2 m walking, 3.8 m running
    const cycle = THREE.MathUtils.lerp(2.2, 3.8, run), before = this.gait;
    if (this.onGround) this.gait += speed * dt / cycle * Math.PI * 2;
    else this.gait += (Math.round(this.gait / Math.PI) * Math.PI - this.gait) * ease(3);   // in the air: legs drift to neutral
    if (Math.floor(before / Math.PI) !== Math.floor(this.gait / Math.PI) && pace > 0.3 && this.onGround) { this.onStep?.(run); this.marks?.step(this.player.position, this.player.rotation.y); }
    this.swing += (pace - this.swing) * ease(6);                 // the stride grows and shrinks smoothly
    this.runMix = (this.runMix ?? 0) + (run - (this.runMix ?? 0)) * ease(4);
    this.airMix = (this.airMix ?? 0) + ((this.onGround ? 0 : 1) - (this.airMix ?? 0)) * ease(8);
    const breathe = Math.sin(this.time * 1.6) * 0.008 * (1 - this.swing);
    this.squash *= Math.exp(-dt * 8);
    let bob = 0, sway = 0;
    if (this.suit) {
      ({ bob, sway } = poseAstronaut(this.suit, { phase: this.gait, pace: this.swing, run: this.runMix, air: this.airMix, t: this.time, vy: this.vel.y, swing: this.toolSwing }));
    } else {   // simple shapes: legs and arms swing, no knees; in the air the legs tuck and reach
      const s = Math.sin(this.gait), rise = THREE.MathUtils.clamp(this.vel.y / 3.2, -1, 1), air = this.airMix;
      u.legs[0].rotation.x = s * this.swing * 0.5 * (1 - air) - air * (0.5 - 0.3 * Math.max(0, -rise));
      u.legs[1].rotation.x = -s * this.swing * 0.5 * (1 - air) - air * (0.2 + 0.2 * Math.max(0, rise));
      if (u.arms) { u.arms[0].rotation.x = -s * this.swing * 0.4; u.arms[1].rotation.x = s * this.swing * 0.4; u.arms[0].rotation.z = -0.12 - air * 0.5; u.arms[1].rotation.z = 0.12 + air * 0.5; }
      if (this.toolSwing >= 0 && u.arms) { const l = Math.sin(this.toolSwing * Math.PI); u.arms[1].rotation.x = u.arms[0].rotation.x = -0.5 - 2 * l; }
      bob = ((Math.cos(this.gait * 2) + 1) / 2) * 0.04 * this.swing;
    }
    rig.position.set(sway, bob + breathe - this.squash * 0.08, 0);
    rig.scale.set(1, 1 - this.squash * 0.04, 1);
    this.lean.x += ((0.05 * this.swing + 0.1 * this.runMix) - this.lean.x) * ease(4);   // lean a little into the walk
    rig.rotation.set(this.lean.x, 0, this.lean.z);
    // first person: a gentle head bob through the helmet
    this.headBob = { y: (bob - 0.02) * 0.6 - this.squash * 0.1, x: sway * 0.6 };
    // a rigged team model with its own animations: blend idle -> walk -> run by speed
    const anim = this.astroAnim;
    if (anim && !this.suit) {
      const a = anim.actions, w = { idle: 1 - pace, walk: pace * (1 - (a.run ? run : 0)), run: a.run ? pace * run : 0 };
      if (!a.walk) w.idle = 1;
      for (const [k, act] of Object.entries(a)) act.setEffectiveWeight(w[k] ?? 0);
      if (a.walk) a.walk.timeScale = Math.max(0.4, speed / WALK) * 0.85;
      if (a.run) a.run.timeScale = Math.max(0.5, speed / RUN) * 0.85;
      anim.mixer.update(dt);
    }
  }

  // Show a tool in your hands. `hand` is the copy the astronaut holds, `view` the one you see in first person.
  holdTool(hand, view) {
    this.handSlot.clear(); this.viewSlot.clear();
    if (hand) this.handSlot.add(hand);
    if (view) { view.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.depthTest = false; o.material.fog = false; } o.renderOrder = 10; }); this.viewSlot.add(view); }
  }
  // One pickaxe swing. `onStrike` is called at the moment the point hits the rock.
  swingTool(onStrike) {
    if (this.toolSwing >= 0) return false;
    this.toolSwing = 0; this.onStrike = onStrike; return true;
  }
  updateSwing(dt) {
    if (this.toolSwing < 0) { this.viewSlot.rotation.set(0, 0, 0); return; }
    const before = this.toolSwing;
    this.toolSwing += dt / 0.75;
    if (before < 0.55 && this.toolSwing >= 0.55) { this.onStrike?.(); this.onStrike = null; }
    const k = this.toolSwing, lift = k < 0.45 ? Math.sin(k / 0.45 * Math.PI / 2) : k < 0.6 ? 1 - (k - 0.45) / 0.15 * 1.3 : -0.3 * (1 - (k - 0.6) / 0.4);
    this.viewSlot.rotation.set(lift * 1.1, 0, -lift * 0.25);       // first person: the pickaxe comes up and chops down
    if (this.toolSwing >= 1) this.toolSwing = -1;
  }

  clearRocksAround(x,z,radius){
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
    for(let i=0;i<this.rocks.count;i++){this.rocks.getMatrixAt(i,m);m.decompose(p,q,scale);if(Math.hypot(p.x-x,p.z-z)<radius+Math.max(scale.x,scale.z)){m.makeTranslation(p.x,-10000,p.z);this.rocks.setMatrixAt(i,m);}}
    this.rocks.instanceMatrix.needsUpdate=true;this.rocks.computeBoundingSphere();
    this.lowRocks=this.lowRocks.filter(c=>Math.hypot(c.x-x,c.z-z)>radius+c.radius);
    for(let i=this.colliders.length-1;i>=0;i--){const c=this.colliders[i];if(c.rock&&Math.hypot(c.x-x,c.z-z)<radius+c.r)this.colliders.splice(i,1);}
  }

  groundHeightAt(x,z){const ground=heightAt(x,z),surface=this.settlement?.crossings.height(x,z,ground)??ground;return this.settlement?.walkHeight(x,z,surface)??surface;}

  // Simple circle collisions so you can't walk through the base or big boulders.
  collide(pos) {
    for (const c of this.colliders) {
      if (c.rock) continue;
      if(c.object && !c.object.visible)continue;
      if(c.solar){const x=Math.max(c.x-c.halfX+.12,Math.min(c.x+c.halfX-.12,pos.x)),z=Math.max(c.z-.7,Math.min(c.z+.7,pos.z));const top=this.panelHeight?.(x,z)??Infinity;if(pos.y>=top-.25)continue;}
      if(c.halfX !== undefined){if(c.minY===undefined||(pos.y<c.maxY&&pos.y+1.85>c.minY))blockPanel(pos,c,0.45);continue;}
      if(c.habitatIndex!==undefined&&this.settlement?.onAccessRamp(pos,c.habitatIndex))continue;
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.45;
      if (d < min && d > 0.0001) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    }
    const lim = WORLD_SIZE * 0.42, r = Math.hypot(pos.x, pos.z);
    if (r > lim) { pos.x *= lim / r; pos.z *= lim / r; }
  }

  enterRover() { this.driving = true; this.firstPerson = false; this.move.set(0, 0, 0); this.yaw = this.sev.yaw; this.pitch = 0.35; }
  exitRover() {
    const e = this.sev.exitPoint();
    this.driving = false; this.sev.speed = 0;
    this.player.position.set(e.x, heightAt(e.x, e.z), e.z); this.player.rotation.y = this.sev.yaw + Math.PI;
    this.yaw = this.sev.yaw + Math.PI; this.pitch = 0.25;
  }

  update(dt, controlsActive) {
    this.time += dt; this.frameDt = dt; this.sky.material.uniforms.cloudTime.value = this.time;
    const nearHome = Math.hypot(this.sev.pos.x, this.sev.pos.z) < 32;
    this.roverSurfaceCache.clear();
    this.sev.update(dt, controlsActive ? this.keys : {}, this.driving, nearHome, this.night);
    this.sevCollider.x = this.sev.pos.x; this.sevCollider.z = this.sev.pos.z;
    this.marks.rover(this.sev);
    // storm dust on the dark ground (sim.js dustCover), eased so it never pops; the marks fade while a storm blows
    const cover = this.terrain.userData.dustCover;
    if (cover) cover.value += ((this.stormDust || 0) - cover.value) * (1 - Math.exp(-dt * .5));
    if (this.devilTracks) this.devilTracks.material.opacity = 1 - .95 * (cover?.value || 0);
    if (this.dustOn) this.marks.setBuried(this.buried = Math.min(1, (this.buried || 0) + dt / 25));
    if (this.driving) return this.updateDriving(dt);
    const p = this.player.position, g = this.facts.gravity.value;
    const k = this.keys, running = (k.ShiftLeft || k.ShiftRight) && !this.noRun;   // no running on an empty stomach (main.js sets noRun)
    const want = this.wantMove??=new THREE.Vector3();want.set(0,0,0);
    if (controlsActive) {
      const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      want.set(Math.sin(this.yaw) * f + Math.cos(this.yaw) * -s, 0, Math.cos(this.yaw) * f - Math.sin(this.yaw) * -s);
      if (want.lengthSq() > 0) want.normalize().multiplyScalar((running ? RUN : WALK) * (this.speedMul ?? 1));
      if (this.toolSwing >= 0) want.multiplyScalar(0.15);                          // you plant your feet to swing
      if (k.Space && this.onGround && this.toolSwing < 0) { this.vel.y = 4.2; this.onGround = false; this.onJump?.(); }   // same push as on Earth...
    }
    this.updateSwing(dt);
    // Speed up and slow down smoothly (less grip in the air, and a bulky suit, so a little slide)
    const grip = this.onGround ? (want.lengthSq() ? 7 : 9) : 1.5;
    this.move.lerp(want, 1 - Math.exp(-grip * dt));
    const previous = this.previousFeetPosition ??= new THREE.Vector3();
    previous.copy(p);
    p.x += this.move.x * dt; p.z += this.move.z * dt;
    if (!this.onGround) {
      this.vel.y -= g * dt;
      p.y += this.vel.y * dt;
    }
    this.rockContact.block(p, previous, this.onGround);
    this.collide(p);
    this.settlement?.blockEquipment(p);
    const ceiling = Math.max(previous.y, p.y) + (this.onGround ? 0.45 : 0.02);
    const ground = Math.max(this.groundHeightAt(p.x, p.z), this.rockContact.height(p.x, p.z, ceiling),this.panelHeight?.(p.x,p.z,ceiling)??-Infinity);
    if ((this.onGround && Math.abs(p.y - ground) <= 0.45) || (this.vel.y <= 0 && p.y <= ground)) {
      if (!this.onGround && this.vel.y < -1.5) this.squash = Math.min(0.6, -this.vel.y / 8);
      p.y = ground; this.vel.y = 0; this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.animateAstronaut(dt, running);

    if (this.firstPerson) {
      // first person: eyes inside the helmet, body hidden so it doesn't block the view
      this.player.visible = false; this.viewSlot.visible = true;
      const hb = this.headBob || { x: 0, y: 0 };
      const eyeFP = new THREE.Vector3(p.x + Math.cos(this.yaw) * hb.x, p.y + 1.7 + hb.y, p.z - Math.sin(this.yaw) * hb.x);
      this.camera.position.copy(eyeFP);
      this.camera.lookAt(eyeFP.x + Math.sin(this.yaw) * Math.cos(this.lookPitch), eyeFP.y + Math.sin(this.lookPitch), eyeFP.z + Math.cos(this.yaw) * Math.cos(this.lookPitch));
      this.placeSky(p);
            // Collectibles rest on the soil; their light beams mark their locations.
      if (this.linkUp && !this.relayTracking) this.outpost.dish.rotation.z = Math.sin(this.time * 0.3) * 0.25;
      return;
    }
    this.player.visible = true; this.viewSlot.visible = false;
    // third-person camera
    const dist = 7.5, eye = new THREE.Vector3(p.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch), p.y + 2 + Math.sin(this.pitch) * dist, p.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch));
    // Retract along the viewing ray; never push the camera sideways across the player.
    const anchor=new THREE.Vector3(p.x,p.y+1.6,p.z),boom=eye.clone().sub(anchor),length=boom.length();
    this.cameraRay??=new THREE.Raycaster();this.cameraRay.set(anchor,boom.normalize());this.cameraRay.far=length;
    const objects=[this.rocks,...this.colliders.filter(c=>c.object?.visible).map(c=>c.object)];
    const hit=this.cameraRay.intersectObjects(objects,true)[0];
    if(hit)eye.copy(anchor).addScaledVector(boom,Math.max(.65,hit.distance-.25));
    eye.y = Math.max(eye.y, heightAt(eye.x, eye.z) + 0.6);
    this.camera.position.lerp(eye, 1 - Math.exp(-dt * 10));
    this.cameraTarget??=new THREE.Vector3(p.x,p.y+1.6,p.z);
    if(this.cameraTarget.distanceToSquared(p)>400)this.cameraTarget.set(p.x,p.y+1.6,p.z);
    this.cameraAim??=new THREE.Vector3();this.cameraAim.set(p.x,p.y+1.6,p.z);
    this.cameraTarget.lerp(this.cameraAim,1-Math.exp(-dt*14));
    this.camera.lookAt(this.cameraTarget);
    this.placeSky(p);
    
    // Collectibles rest on the soil; their light beams mark their locations.
    if (this.linkUp && !this.relayTracking) this.outpost.dish.rotation.z = Math.sin(this.time * 0.3) * 0.25;
  }

  // In the rover: you ride inside; the camera follows behind (or sits in the cockpit in first person).
  updateDriving(dt) {
    const r = this.sev, p = this.player.position;
    this.player.visible = false; this.viewSlot.visible = false;
    p.copy(r.pos);
    this.move.set(0, 0, 0); this.swing = 0;
    if (this.firstPerson) {
      const f = 1.4, eye = new THREE.Vector3(r.pos.x + Math.sin(r.yaw) * f, r.pos.y + 2.3, r.pos.z + Math.cos(r.yaw) * f);
      this.camera.position.copy(eye);
      const yaw = this.yaw; // mouse-controlled cockpit view
      this.camera.lookAt(eye.x + Math.sin(yaw), eye.y - 0.12 + Math.sin(this.lookPitch), eye.z + Math.cos(yaw));
    } else {
      // Camera yaw belongs to the mouse, including while driving.
      const dist = 12, eye = new THREE.Vector3(r.pos.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch), r.pos.y + 3 + Math.sin(this.pitch) * dist, r.pos.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch));
      eye.y = Math.max(eye.y, heightAt(eye.x, eye.z) + 1);
      this.camera.position.lerp(eye, 1 - Math.exp(-dt * 6));
      this.camera.lookAt(r.pos.x, r.pos.y + 2, r.pos.z);
    }
    this.placeSky(r.pos);
    // Collectibles rest on the soil; their light beams mark their locations.
    if (this.linkUp && !this.relayTracking) this.outpost.dish.rotation.z = Math.sin(this.time * 0.3) * 0.25;
  }

  // Sun, glow, stars, sky and headlamp follow the camera; the sun's direction follows the time of day.
  placeSky(p) {
    const focus=this.cinematic?this.camera.position:p;
    this.terrain.userData.update(focus);this.rockDisplay.userData.update(focus);
    const cam = this.camera.position, dir = this.sunDir || new THREE.Vector3(0.5, 0.8, 0.3);
    this.sun.position.set(p.x + dir.x * 120, p.y + Math.max(dir.y, 0.05) * 120, p.z + dir.z * 120); this.sun.target.position.copy(p);
    this.sky.position.copy(cam);
    this.skyLights.glow.position.copy(cam).addScaledVector(this.glowDir || dir, 800);
    this.skyLights.disc.position.copy(cam).addScaledVector(dir, 820);
    this.skyLights.stars.position.copy(cam); this.skyLights.planets.position.copy(cam);
    this.skyLights.moons.userData.place(this.phase, cam, (this.nightness ?? 0) * (this.dustOn ? 0.2 : 1));
    this.groundDust.userData.update(cam, this.time, this.dustOn, this.nightness ?? 0);
    this.skyLights.motes.userData.update(this.frameDt || 0.016, cam, this.time, this.dustOn ? 3.5 : 0.6);
    const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
    this.headlamp.position.copy(cam); this.headlamp.target.position.copy(cam).addScaledVector(look, 10);
  }

  // What the player is close enough to use with E.
  aimsAt(object){
    const ray=this.aimRay??=new THREE.Raycaster();
    ray.setFromCamera(this.aimPoint||{x:0,y:0},this.camera);
    return ray.intersectObject(object,true).some(hit=>hit.object.isMesh);
  }
  nearest() {
    if (this.driving) return { type: 'sev-exit', d: 0 };
    const p = this.player.position, list = [];
    if (this.sev.ready) list.push({ type: 'sev', d: Math.hypot(p.x - this.sev.pos.x, p.z - this.sev.pos.z) - 2.6 });
    if(this.settlement){for(const entrance of this.settlement.entrances)if(Math.hypot(p.x-entrance.x,p.z-entrance.z)<1.85 && Math.abs(p.y-entrance.y)<.65)list.push({type:'door',entrance,range:1.8,d:Math.hypot(p.x-entrance.x,p.y-entrance.y,p.z-entrance.z)});}
    else list.push({type:'door',d:Math.hypot(p.x-this.door.x,p.z-this.door.z)});
    list.push({type:'ghdoor',d:Math.hypot(p.x-(GH.x-GH.r-2.6),p.z-GH.z)});
    if (this.shipDoor) list.push({ type: 'ship', d: Math.hypot(p.x - this.shipDoor.x, p.z - this.shipDoor.z) + 0.8 });   // a little closer than the outpost door, so it doesn't pop up where you start
    { // Panels remain usable with any tool, even before dust becomes severe.
      const point = this.panelPoint ??= new THREE.Vector3();
      for (const panel of this.solar.panels) if (panel.visible) {
        panel.getWorldPosition(point);
        const dx = Math.max(0, Math.abs(p.x-point.x)-1.7), dz = Math.max(0, Math.abs(p.z-point.z)-1.05);
        list.push({type:'panels',d:Math.hypot(dx,dz,p.y-point.y),range:2});
      }
    }
    for(const panel of this.fixedSolar||[]){const dx=Math.max(0,Math.abs(p.x-panel.x)-panel.halfX),dz=Math.max(0,Math.abs(p.z-panel.z)-panel.halfZ);list.push({type:'panels',d:Math.hypot(dx,dz,p.y-panel.y),range:2});}
    if (!this.rover.salvaged) list.push({ type: 'rover', d: Math.hypot(p.x - this.rover.x, p.z - this.rover.z) - 1.5 });
    if (this.heli.model && !this.heli.seen) list.push({ type: 'heli', d: Math.hypot(p.x - this.heli.x, p.z - this.heli.z) });
    for (const pk of this.pickups) list.push({ type: pk.kind, pickup: pk, d: Math.hypot(p.x - pk.x, p.z - pk.z) });
    if (this.extraTargets) list.push(...this.extraTargets(p));   // ore rocks and greenhouses (colony.js)
    list.sort((a, b) => a.d - b.d);
    const panel=list.find(n=>n.type==='panels'&&n.d<1.25);if(panel)return panel;
    return list.find(n=>n.d<(n.range??3.2))||null;
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.placeViewSlot(); }
  // the first-person tool sits in the bottom-right corner - closer to the middle on tall, narrow screens
  placeViewSlot() { this.viewSlot.position.set(Math.min(0.36, 0.25 * this.camera.aspect), -0.34, -0.7); }
}
