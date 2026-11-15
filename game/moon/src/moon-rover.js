import {roverSupport,sampledSuspensionPose} from '../../src/rover-support.js';
// The pressurised rover: NASA's Space Exploration Vehicle 3D model (assets/sev.glb, NASA 3D Resources). The SEV
// began life as NASA's Lunar Electric Rover concept, so it fits the Moon. Wheels are cut out of the solid model
// (same approach as the Mars rover, using the shared splitGeometry helper, read-only) so they spin and steer.
// Handling uses lunar gravity: it floats off crater rims and lands softly, but it is just as heavy to stop.
import * as THREE from 'three';
import { loadModel } from '../../src/nasamodels.js';
import { splitGeometry } from '../../src/suit.js';
import { MOON } from './config.js';
import { heightAt, clampToWorld } from './terrain.js';

const MAX = 8, REVERSE = 3, ACCEL = 2.6, BRAKE = 3.2, STEER = 0.55;   // m/s, m/s^2 (game handling)

export class MoonRover {
  constructor(scene) {
    this.scene=scene;
    this.rockSupport=createLunarRockSupport(scene,heightAt);
    this.group = new THREE.Group(); this.group.name = 'Rover'; scene.add(this.group);
    this.body = new THREE.Group(); this.group.add(this.body);
    this.pos = new THREE.Vector3(-12, 0, -14); this.yaw = Math.PI + 0.6; this.speed = 0; this.vy = 0; this.steer = 0; this.air = false;
    this.wheels = []; this.r = 0.42; this.length = 4.6; this.width = 3; this.trackT = 0;
    const lamp = (x) => { const l = new THREE.SpotLight('#f4f7ff', 0, 70, 0.5, 0.55, 1.1); l.position.set(x, 1.7, 2.3); l.target.position.set(x * 2, 0, 18); this.body.add(l, l.target); return l; };
    this.lights = [lamp(-0.8), lamp(0.8)];
    this.placeholder = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 4.4), new THREE.MeshStandardMaterial({ color: '#d8d8d4' })); this.placeholder.position.y = 1.4; this.body.add(this.placeholder);
    this.loading=this.load().catch(error=>{this.loadError=error.message;console.warn("Lunar rover asset failed",error);});
    this.settle();
  }

  async load() {
    const g = await loadModel('sev.glb'); if (!g) return;
    const src = g.scene; src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), mid = box.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z);
    const meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
    const geos = meshes.map(m => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld)));
    const low = [];
    for (const geo of geos) { const p = geo.attributes.position; for (let i = 0; i < p.count; i += 2) if (p.getY(i) < 0.85) low.push([p.getX(i), p.getZ(i)]); }
    const zs = low.filter(([x]) => Math.abs(x) > 1.3).map(([, z]) => z).sort((a, b) => a - b);
    const rows = []; let start = zs[0], prev = zs[0];
    for (const z of [...zs, Infinity]) { if (z - prev > 0.4) { rows.push([start, prev]); start = z; } prev = z; }
    const wide = rows.filter(([a, b]) => b - a > 0.4).slice(0, 3);
    const r = this.r = THREE.MathUtils.clamp(wide.reduce((s, [a, b]) => s + (b - a) / 2, 0) / (wide.length || 1), 0.3, 0.5);
    const axles = wide.map(([a, b]) => (a + b) / 2), xs = low.map(([x]) => Math.abs(x)).filter(x => x > 1.2);
    const xIn = Math.min(...xs) - 0.05, xOut = Math.max(...xs) + 0.05;
    const pick = (x, y, z) => {
      if (Math.abs(x) < xIn || Math.abs(x) > xOut || y > 2 * r + 0.05) return 'body';
      for (let i = 0; i < axles.length; i++) if (Math.hypot(y - r, z - axles[i]) < r * 1.08) return `w${i}${x < 0 ? 'L' : 'R'}`;
      return 'body';
    };
    const mats = meshes.map(m => [].concat(m.material).map(mt => { const c = mt.clone(); c.metalness = Math.min(c.metalness ?? 0, 0.35); c.roughness = Math.max(c.roughness ?? 0.6, 0.45); return c; }));
    geos.forEach((geo, mi) => {
      for (const [part, pg] of Object.entries(splitGeometry(geo, pick))) {
        const mesh = new THREE.Mesh(pg, mats[mi][0]); mesh.castShadow = true; mesh.receiveShadow = true;
        if (part === 'body') { this.body.add(mesh); continue; }
        const row = +part[1], side = part[2];
        let w = this.wheels.find(w => w.row === row && w.side === side);
        if (!w) { w = { row, side, track:(xIn+xOut)/2*(side==='L'?-1:1), axle:axles[row], steer: new THREE.Group(), spin: new THREE.Group() }; w.steer.position.set(w.track, r, axles[row]); w.steer.add(w.spin); this.body.add(w.steer); this.wheels.push(w); }
        pg.translate(-w.track, -r, -axles[row]); w.spin.add(mesh);
      }
    });
    const front = Math.max(...axles), back = Math.min(...axles);
    this.wheels.forEach(w => (w.steers = axles[w.row] === front ? 1 : axles[w.row] === back ? -1 : 0));
    this.length = box.max.z - box.min.z; this.width = box.max.x - box.min.x;
    this.body.remove(this.placeholder); this.ready = true;
  }

  exitPoint() { const back = -this.length / 2 - 1.2; return new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * back, 0, this.pos.z + Math.cos(this.yaw) * back); }

  settle() { this.pos.y = heightAt(this.pos.x, this.pos.z); this.place(0); }

  // input: throttle -1..1, steer -1..1. Returns { driving 0..1, bump 0..1 }
  update(dt, input, colliders, prints, dust) {
    if(dt>1/60+1e-6){const n=Math.ceil(Math.min(dt,.25)*60);let result;for(let i=0;i<n;i++)result=this.update(Math.min(dt,.25)/n,input,colliders,prints,dust);return result;}
    const want = input.throttle > 0 ? MAX * input.throttle : input.throttle < 0 ? -REVERSE * -input.throttle : 0;
    const grip = this.air ? 0.1 : 1;
    if (input.throttle === 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), BRAKE * 0.5 * dt * grip);
    else if (Math.sign(want) !== Math.sign(this.speed) && Math.abs(this.speed) > 0.1) this.speed += Math.sign(want) * BRAKE * dt * grip;
    else this.speed += THREE.MathUtils.clamp(want - this.speed, -ACCEL * dt, ACCEL * dt) * grip;
    if (input.noPower) this.speed *= 1 - Math.min(1, dt * 4);
    this.steer = THREE.MathUtils.damp(this.steer, input.steer * STEER, 4, dt);
    if (!this.air) this.yaw += this.speed * Math.tan(this.steer) / 3.2 * dt;
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    this.pos.x = nx; this.pos.z = nz;
    // Obstacles: glance off and slide round them. Stopping dead on every touch froze the rover, because steering
    // needs speed: once it touched a boulder or mast you could not turn away, only reverse.
    let bump = 0, blocked = false;
    for (const c of colliders) {
      if(c.rock&&c.height<.9)continue;
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), r = c.r + 1.8;
      if (d < r && d > 1e-4) {
        const nx = dx / d, nz = dz / d; this.pos.x = c.x + nx * r; this.pos.z = c.z + nz * r;
        const dir = Math.sign(this.speed) || Math.sign(input.throttle) || 1, hx = Math.sin(this.yaw) * dir, hz = Math.cos(this.yaw) * dir;
        const into = -(hx * nx + hz * nz);                       // 1 = driving straight at it, 0 = brushing past
        if (into <= 0) continue;
        bump = Math.max(bump, Math.min(1, Math.abs(this.speed) * into / 4));
        // turn the nose along the obstacle's edge: the side it already leans to, or the way the driver steers when head-on
        const turn = (tx, tz) => (((Math.atan2(tx * dir, tz * dir) - this.yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        const side = hx * nz - hz * nx, a = turn(nz, -nx), b = turn(-nz, nx);
        const pick = Math.abs(side) > .15 || !input.steer ? (side >= 0 ? a : b) : (Math.sign(a) === Math.sign(input.steer * dir) ? a : b);
        this.yaw += pick * Math.min(1, dt * 2.8 * (.35 + into));
        this.speed *= 1 - Math.min(.9, into * dt * 5);            // scrubs speed in proportion to how square the hit is
        if (into > .75 && Math.abs(this.speed) < 1) blocked = true;
      }
    }
    this.blocked = blocked;
    if (clampToWorld(this.pos, 6)) { this.speed *= 0.5; this.hitEdge = true; } else this.hitEdge = false;
    const ground = this.groundSupport().height;
    if (!this.air && this.pos.y - ground > 0.35 && Math.abs(this.speed) > 2) { this.air = true; this.vy = 0; }
    if (this.air) {
      this.vy -= MOON.gravity * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) { bump = Math.max(bump, Math.min(1, -this.vy / 3)); this.pos.y = ground; this.air = false; this.vy = 0; dust?.kick(this.pos.x, ground, this.pos.z, 0, 0, 30, 2.5); }
    } else {
      const climb = ground - this.pos.y; this.pos.y = ground; this.vy = climb / Math.max(dt, 1e-3);
    }
    this.place(dt);
    // wheels
    for (const w of this.wheels) { w.spin.rotation.x += this.speed * dt / this.r; w.steer.rotation.y = this.steer * w.steers; }
    // tracks every ~0.9 m
    this.trackT += Math.abs(this.speed) * dt;
    if (!this.air && this.trackT > 0.9) {
      this.trackT = 0; const sx = Math.cos(this.yaw) * this.width * 0.36, sz = -Math.sin(this.yaw) * this.width * 0.36;
      prints?.add(this.pos.x + sx, this.pos.z + sz, this.yaw, true); prints?.add(this.pos.x - sx, this.pos.z - sz, this.yaw, true);
      if (Math.abs(this.speed) > 1.5) { const back = -this.length / 2; dust?.kick(this.pos.x + Math.sin(this.yaw) * back + sx, ground, this.pos.z + Math.cos(this.yaw) * back + sz, -Math.sin(this.yaw) * this.speed, -Math.cos(this.yaw) * this.speed, 4, 2); }
    }
    return { driving: Math.min(1, Math.abs(this.speed) / MAX), bump, blocked };
  }

  support(x,z){return this.rockSupport(x,z);}
  groundSupport(){return roverSupport(this.pos,this.yaw,(x,z)=>this.support(x,z),this.wheels);}
  place(dt) {
    for(const w of this.wheels)w.steer.rotation.y=this.steer*w.steers;
    const support=this.groundSupport(),k=dt?1-Math.exp(-dt*8):1;
    if(!this.air){
      this.body.rotation.x+=(support.pitch-this.body.rotation.x)*k;
      this.body.rotation.z+=(support.roll-this.body.rotation.z)*k;
      const pose=sampledSuspensionPose(this.pos,this.yaw,(x,z)=>this.support(x,z),support.contacts,this.body.rotation.x,this.body.rotation.z,this.pos.y,dt,this.r);
      this.pos.y=pose.y;
      this.wheels.forEach((w,i)=>w.steer.position.y=this.r+pose.travel[i]);
    }
    this.group.position.copy(this.pos);this.group.rotation.y=this.yaw;
  }

  setLights(on) { for (const l of this.lights) l.intensity = on ? 60 : 0; }
}

// MoonWorld builds static Boulders before the rover. Index the *rendered* instance
// transforms once, including batch/parent transforms; visibility culling is irrelevant
// to physics. Rebuild this sampler if a future world moves/replaces its rocks.
export function createLunarRockSupport(scene,groundAt){
 const cells=new Map(),memo=new Map(),cellSize=4;
 const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),hits=[];
 let initialized=false;
 function initialize(){
  initialized=true;
  const rocks=scene.getObjectByName('Boulders');
  if(!rocks)return;
  rocks.updateWorldMatrix(true,true);
  const local=new THREE.Matrix4();
  rocks.traverse(batch=>{
   if(!batch.isInstancedMesh)return;
   if(!batch.geometry.boundingBox)batch.geometry.computeBoundingBox();
   // One reusable raycast mesh per batch: never invoke InstancedMesh.raycast,
   // which would iterate every instance for every wheel correction.
   const proxy=new THREE.Mesh(batch.geometry,batch.material);
   proxy.matrixAutoUpdate=false;
   for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,local);
    const matrix=new THREE.Matrix4().multiplyMatrices(batch.matrixWorld,local);
    const bounds=batch.geometry.boundingBox.clone().applyMatrix4(matrix);
    const entry={matrix,bounds,proxy};
    for(let x=Math.floor(bounds.min.x/cellSize);x<=Math.floor(bounds.max.x/cellSize);x++)
     for(let z=Math.floor(bounds.min.z/cellSize);z<=Math.floor(bounds.max.z/cellSize);z++){
      const key=x+','+z;
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push(entry);
     }
   }
  });
 }
 return (x,z)=>{
  if(!initialized)initialize();
  const key=x+','+z;
  if(memo.has(key))return memo.get(key);
  let h=groundAt(x,z);
  for(const {matrix,bounds,proxy} of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]){
   if(x<bounds.min.x||x>bounds.max.x||z<bounds.min.z||z>bounds.max.z||bounds.max.y<=h)continue;
   origin.set(x,bounds.max.y+.01,z);ray.set(origin,down);ray.far=bounds.max.y-h+.02;
   proxy.matrixWorld.copy(matrix);hits.length=0;
   ray.intersectObject(proxy,false,hits);
   if(hits.length)h=Math.max(h,hits[0].point.y);
  }
  // Static terrain/rocks permit cross-frame reuse; cap memory during long drives.
  if(memo.size>=256)memo.clear();
  memo.set(key,h);
  return h;
 };
}
