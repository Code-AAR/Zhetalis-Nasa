// The crew rover you can drive: NASA's Space Exploration Vehicle (MMSEV) 3D model, from NASA 3D Resources.
// It is a real NASA design for a small pressurised rover: the crew ride inside in normal clothes and climb
// into their spacesuits through suitports at the back. The model is one solid mesh, so when it loads we cut out
// its 12 wheels (6 pairs) so they can roll, and the front and back pairs steer.
//
// Game rules (made up for balance): driving uses the rover's battery, which recharges when parked near the
// outpost. Inside, your suit refills from the cabin air, and the walls block some radiation.
import { WORLD_EXTENT } from './chunk-plan.js';
import { driftLift } from './landmarks.js';
import { softSoil } from './resource-zones.js';
import * as THREE from 'three';
import { blockPanel } from './panel-contact.js';
import { moveOverSurface, ROVER_MOTION } from './rover-terrain.js';
import { loadModel } from './nasamodels.js';
import { splitGeometry } from './suit.js';

const {max:MAX, reverse:REVERSE, accel:ACCEL, brake:BRAKE} = ROVER_MOTION; // Deliberately accelerated game handling.
const DRAIN = 1 / 150, CHARGE = 1 / 25;                   // battery per second: about 2.5 min of driving, 25 s to fill up

export class Rover {
  constructor(scene, surfaceAt, colliders) {
    this.surfaceAt = surfaceAt; this.colliders = colliders;
    this.group = new THREE.Group(); scene.add(this.group);
    this.body = new THREE.Group(); this.group.add(this.body);
    this.pos = new THREE.Vector3(-15, 0, 13); this.yaw = 0.5;
    this.speed = 0; this.battery = 1; this.wheels = []; this.r = 0.4; this.ready = false;
    this.tilt = { pitch: 0, roll: 0, y: 0 };
    this.lights = new THREE.SpotLight('#fff4e0', 0, 45, 0.55, 0.6, 1.2);
    this.lights.position.set(0, 1.6, 2.6); this.lights.target.position.set(0, 0, 14);
    this.body.add(this.lights, this.lights.target);
    this.dust = makeDust(scene);
    this.load();
    this.place(0);
  }

  async load() {
    const g = await loadModel('sev.glb'); if (!g) return;
    const src = g.scene; src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), mid = box.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4().makeTranslation(-mid.x, -box.min.y, -mid.z);
    const meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
    // wheels sit in 3 rows along the rover; find them from the low parts of the model
    const geos = meshes.map(m => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld)));
    const low = [];
    for (const geo of geos) { const p = geo.attributes.position; for (let i = 0; i < p.count; i += 2) if (p.getY(i) < 0.85) low.push([p.getX(i), p.getZ(i)]); }
    const zs = low.filter(([x]) => Math.abs(x) > 1.3).map(([, z]) => z).sort((a, b) => a - b);
    const rows = []; let start = zs[0], prev = zs[0];
    for (const z of [...zs, Infinity]) { if (z - prev > 0.4) { rows.push([start, prev]); start = z; } prev = z; }
    const wide = rows.filter(([a, b]) => b - a > 0.4).slice(0, 3);                 // each wheel row is about 0.8 m long
    const r = this.r = THREE.MathUtils.clamp(wide.reduce((s, [a, b]) => s + (b - a) / 2, 0) / (wide.length || 1), 0.3, 0.5);
    const axles = wide.map(([a, b]) => (a + b) / 2), xs = low.map(([x]) => Math.abs(x)).filter(x => x > 1.2);
    console.info('Rover wheels: rows at', axles.map(z => z.toFixed(2)).join(', '), 'radius', r.toFixed(2));
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
        if (!w) {
          const track = (xIn + xOut) / 2 * (side === 'L' ? -1 : 1);
          w = { row, side, track, axle: axles[row], travel: 0, steer: new THREE.Group(), spin: new THREE.Group() };
          w.steer.position.set(0, r, axles[row]); w.steer.add(w.spin); this.body.add(w.steer); this.wheels.push(w);
        }
        pg.translate(0, -r, -axles[row]);
        w.spin.add(mesh);
      }
    });
    const front = Math.max(...axles), back = Math.min(...axles);
    this.wheels.forEach(w => (w.steers = axles[w.row] === front ? 1 : axles[w.row] === back ? -1 : 0));
    this.length = box.max.z - box.min.z; this.width = box.max.x - box.min.x;
    this.rearZ = box.min.z - mid.z;
    this.ready = true;
  }

  // Where the driver climbs out: behind the rover, at the suitports.
  exitPoint() {
    const back = (this.rearZ ?? -3) - 1.2;
    return new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * back, 0, this.pos.z + Math.cos(this.yaw) * back);
  }

  // keys: the shared key state (W/S = drive, A/D = steer). driving = someone is at the wheel.
  update(dt, keys, driving, nearHome, night) {
    if(dt>1/60+1e-6){const n=Math.ceil(Math.min(dt,.25)*60);for(let i=0;i<n;i++)this.update(Math.min(dt,.25)/n,keys,driving,nearHome,night);return;}
    this.dustLight=night?0:1;
    let throttle = 0, steer = 0;
    if (driving) {
      throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    }
    // soft sand in the wind-blown drifts drags the wheels: up to 30 percent slower on the crest of a drift
    // and the bright salty soil (Paso Robles, Arad, Tyrone) is softer still: up to 55 percent slower (game balance)
    this.softSoil = softSoil(this.pos.x, this.pos.z);
    const drag = (1 - .3 * Math.min(1, driftLift(this.pos.x, this.pos.z) / .42)) * (1 - .55 * this.softSoil);
    const max = (this.battery > 0 ? MAX : 1.2) * drag;       // flat battery: crawl home on the last of it
    if (throttle > 0) this.speed = Math.min(max, this.speed + (this.speed < 0 ? BRAKE : ACCEL) * dt);
    else if (throttle < 0) this.speed = Math.max(-REVERSE, this.speed - (this.speed > 0 ? BRAKE : ACCEL) * dt);
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3 * dt);   // rolls to a stop
    if (this.speed > max) this.speed = Math.max(max, this.speed - BRAKE * dt);
    this.steer = (this.steer ?? 0) + (steer - (this.steer ?? 0)) * (1 - Math.exp(-dt * 5));
    // a car turns more the faster it rolls (and the other way when reversing)
    this.yaw += this.steer * 0.75 * Math.min(1, Math.abs(this.speed) / 2.5) * Math.sign(this.speed) * dt;
    const step = this.speed * dt;
    const dx = Math.sin(this.yaw) * step, dz = Math.cos(this.yaw) * step;
    if(this.surfaceSample){
      const moved = moveOverSurface(this.pos,dx,dz,this.yaw,this.surfaceSample);
      if(moved < 1)this.speed *= moved;
    }else{this.pos.x+=dx;this.pos.z+=dz;}
    // bump into the outpost, boulders and the old rover
    for (const c of this.colliders) {
      if (c.self || (c.rock && this.surfaceSample) || (c.object && !c.object.visible)) continue;
      if(c.halfX !== undefined){if(blockPanel(this.pos,c,2.2))this.speed*=0.5;continue;}
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + 2.2;
      if (d < min && d > 0.001) { this.pos.x = c.x + dx / d * min; this.pos.z = c.z + dz / d * min; this.speed *= 0.5; }
    }
    const lim = WORLD_EXTENT * 0.42, rr = Math.hypot(this.pos.x, this.pos.z);
    if (rr > lim) { this.pos.x *= lim / rr; this.pos.z *= lim / rr; this.speed *= 0.5; }
    // battery
    if (driving && Math.abs(this.speed) > 0.2) this.battery = Math.max(0, this.battery - DRAIN * dt * (0.4 + 0.6 * Math.abs(this.speed) / MAX));
    // Roof solar charges slowly in sunlight; the commissioned bay adds faster charging.
    if(!night)this.battery=Math.min(1,this.battery+dt/300);
    this.lights.intensity = driving && night ? 60 : 0;
    this.place(dt, step);
  }

  // Sit on the ground: tilt to follow the slope under the wheels, smoothly (the suspension soaks up small bumps).
  place(dt, step = 0) {
    const h = this.surfaceAt, s = Math.sin(this.yaw), c = Math.cos(this.yaw), L = 2.2, W = 1.6;
    const at = (f, rgt) => h(this.pos.x + s * f + c * rgt, this.pos.z + c * f - s * rgt);
    const fl = at(L, -W), fr = at(L, W), bl = at(-L, -W), br = at(-L, W);
    const front = (fl + fr) / 2, back = (bl + br) / 2, left = (fl + bl) / 2, right = (fr + br) / 2;
    for (const w of this.wheels) w.ground = at(w.axle, w.track);
    const k = dt ? 1 - Math.exp(-dt * 6) : 1;
    this.tilt.pitch += (Math.atan2(back - front, 2 * L) - this.tilt.pitch) * k;
    this.tilt.roll += (Math.atan2(right - left, 2 * W) - this.tilt.roll) * k;
    const wheelHigh = this.wheels.reduce((high, wheel) => Math.max(high, wheel.ground), -Infinity);
    // A rock can pass between the tyres. Give the underside clearance too.
    const bellyHigh = Math.max(at(L / 2, 0), at(0, 0), at(-L / 2, 0));
    const rideHeight = Math.max((front + back) / 2, wheelHigh - 0.45, bellyHigh - 0.35);
    this.tilt.y += (rideHeight - this.tilt.y) * k;
    this.tilt.y = Math.max(this.tilt.y, rideHeight - .22); // keep the chassis above rising rock while suspension eases
    this.pos.y = this.tilt.y;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, 0);
    this.body.rotation.set(this.tilt.pitch, 0, this.tilt.roll);
    this.body.position.y = Math.sin(performance.now() / 90) * 0.012 * Math.min(1, Math.abs(this.speed) / 4);   // engine/terrain buzz
    const pitch = this.tilt.pitch, roll = this.tilt.roll;
    const suspensionEase = dt ? 1 - Math.exp(-dt * 18) : 1;
    for (const w of this.wheels) {
      // Subtract the chassis slope so a wheel can rise independently over a rock.
      const contact = this.tilt.y + Math.cos(pitch) * Math.sin(roll) * w.track - Math.sin(pitch) * w.axle;
      const travel = THREE.MathUtils.clamp(w.ground - contact, -0.35, 0.55);
      w.travel += (travel - w.travel) * suspensionEase;
      w.steer.position.y = this.r + w.travel;
      w.spin.rotation.x += step / this.r;
      w.steer.rotation.y = (this.steer ?? 0) * 0.32 * w.steers;
    }
    if (dt) this.dust.update(dt, this, step);
  }
}

// Puffs of red dust kicked up behind the wheels.
function makeDust(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, 'rgba(214,150,110,0.9)'); grad.addColorStop(1, 'rgba(214,150,110,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), puffs = [];
  for (let i = 0; i < 40; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false; scene.add(sp); puffs.push({ sp, life: 0, vel: new THREE.Vector3() });
  }
  let next = 0;
  return {
    update(dt, rover, step) {
      const v = Math.abs(rover.speed);
      if (v > 1.5 && Math.random() < v / MAX * 0.9) {
        const p = puffs[next++ % puffs.length], side = Math.random() < 0.5 ? -1 : 1, back = (rover.rearZ ?? -2.5) + 0.6;
        p.life = 1.6; p.sp.visible = true;
        p.sp.position.set(rover.pos.x + Math.sin(rover.yaw) * back + Math.cos(rover.yaw) * side * 1.7, rover.pos.y + 0.4, rover.pos.z + Math.cos(rover.yaw) * back - Math.sin(rover.yaw) * side * 1.7);
        p.vel.set((Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.5);
      }
      for (const p of puffs) if (p.life > 0) {
        p.life -= dt; p.sp.position.addScaledVector(p.vel, dt);
        const t = 1 - p.life / 1.6; p.sp.scale.setScalar(0.10 + t * .45); p.sp.material.opacity = 0.18 * (1 - t) * (rover.dustLight??1);
        if (p.life <= 0) p.sp.visible = false;
      }
    },
  };
}
