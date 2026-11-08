// Region tracking for the map: which towers are scanned, and the complete-region bonus. (3D mist was removed.)
// Mist over ground you have not charted yet, like the Sheikah towers in Breath of the Wild.
// - Unscanned ground is hidden under a pale mist, with cyan lines marking each tower's region.
// - Floating rocks and antennas hover in the mist. When a region is scanned they sink away.
// - Scanning a tower sends a bright ring out across its region, and the mist clears behind it.
// - Scan a region and find both of its survey spots, and the region is complete (a small bonus).
import * as THREE from 'three';
import { heightAt, WORLD_SIZE, rockGeometry } from './world.js';
import { revealCircles } from './mapstate.js';
import { isModalOpen } from './ui.js';
import { setRegions, warp } from './chart.js';

const HALF = WORLD_SIZE / 2, MASK_N = 256, REACH = 470;

// shared shader code: how clear is the ground at p (x, z in metres)?
const GLSL = `
uniform sampler2D uMask; uniform vec2 uTw[4]; uniform float uRev[4]; uniform float uTime;
vec2 mistWarp(vec2 p) { return vec2(sin(p.y*.021+1.3)*22. + sin(p.y*.07+p.x*.03)*8. + sin(p.x*.19+p.y*.13)*2.5, sin(p.x*.019-.7)*22. + sin(p.x*.065-p.y*.04)*8. + sin(p.y*.17-p.x*.11)*2.5); }
float mistClear(vec2 p0, out float edge, out float ring, out float maskV) {
  vec2 p = p0 + mistWarp(p0);
  float d0 = distance(p, uTw[0]), d1 = distance(p, uTw[1]), d2 = distance(p, uTw[2]), d3 = distance(p, uTw[3]);
  float a = d0, b = 1e5; int id = 0;
  if (d1 < a) { b = a; a = d1; id = 1; } else b = min(b, d1);
  if (d2 < a) { b = a; a = d2; id = 2; } else b = min(b, d2);
  if (d3 < a) { b = a; a = d3; id = 3; } else b = min(b, d3);
  float rev = uRev[0]; if (id == 1) rev = uRev[1]; else if (id == 2) rev = uRev[2]; else if (id == 3) rev = uRev[3];
  edge = (b - a) * 0.5;
  float reach = rev * ${REACH}.0;
  float rc = rev > 0.001 ? smoothstep(reach, reach - 26.0, a) : 0.0;
  ring = (rev > 0.001 && rev < 0.999) ? exp(-pow((a - reach) / 3.5, 2.0)) : 0.0;
  maskV = texture2D(uMask, p0 / ${WORLD_SIZE}.0 + 0.5).r;
  return max(rc, smoothstep(0.1, 0.9, maskV));
}
float mistNoise(vec2 p) {
  float s = sin(p.x * 1.3 + uTime * .17) * cos(p.y * 1.1 - uTime * .13) + sin(p.x * .7 - p.y * .9 + uTime * .11) * .8
          + sin(p.x * 2.9 + p.y * 2.3 - uTime * .25) * .35;
  return s * .27 + .5;
}`;

export class Mist {
  constructor(world, { onRegion } = {}) {
    this.world = world; this.onRegion = onRegion; this.done = new Set(); this.rev = [0, 0, 0, 0]; this.snapNext = true; this.sig = ''; this.t = 0; this.wasOn = [false, false, false, false];
    const lo = world.lookouts, spots = lo?.spots || [];
    this.spots = spots; setRegions(spots);
    this.mask = document.createElement('canvas'); this.mask.width = this.mask.height = MASK_N; this.mctx = this.mask.getContext('2d');
    this.maskTex = new THREE.CanvasTexture(this.mask); this.maskTex.colorSpace = THREE.NoColorSpace; this.maskTex.minFilter = this.maskTex.magFilter = THREE.LinearFilter;
    this.u = {
      uMask: { value: this.maskTex }, uTime: { value: 0 }, uRev: { value: [0, 0, 0, 0] },
      uTw: { value: [0, 1, 2, 3].map(i => new THREE.Vector2(spots[i]?.x ?? 1e4 * (i + 1), spots[i]?.z ?? 1e4)) },
      uMistCol: { value: new THREE.Color('#c9d3da') }, uLine: { value: new THREE.Color('#5fe3ff') },
    };
    this.group = new THREE.Group(); world.scene.add(this.group);
    this.hovers = [];   // the 3D mist, lines and floating props were removed: only the map and region bonus remain
    this.drawMask(true);
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(dt); };
    world.mist = this;
  }

  snap() { this.snapNext = true; this.sig = ''; }

  // ----- the ground itself gets the mist and the lines -----
  patchTerrain() {
    const mat = this.world.terrain.material, u = this.u;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec3 vMistPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vMistPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vMistPos; uniform vec3 uMistCol; uniform vec3 uLine;\n' + GLSL + '\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
        { vec2 p = vMistPos.xz; float edge, ring, mv;
          float clear = mistClear(p, edge, ring, mv);
          float n = mistNoise(p * .035);
          float home = smoothstep(105.0, 135.0, length(p)) * (1.0 - smoothstep(262.0, 300.0, length(p)));
          float mist = (1.0 - clear) * mix(.55, .75, n);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistCol * (.9 + .12 * n) * .6, mist);
          float w = clamp(fwidth(edge), .35, 1.6);
          float border = (1.0 - smoothstep(.5, .5 + w, edge)) * home;
          float contour = (1.0 - smoothstep(0.0, .08, abs(mv - .5))) * .7;
          vec2 g = abs(fract(p / 32.0) - .5) * 32.0; float gw = max(fwidth(p.x), .2) * 1.2;
          float grid = (1.0 - smoothstep(.0, gw, min(g.x, g.y) - 15.4)) * (1.0 - clear) * .18;
          float glow = ring * 1.4 * home;
          gl_FragColor.rgb += uLine * glow * 1.15 * (0.85 + .15 * sin(uTime * 2.0 + p.x * .05));
        }
        #include <tonemapping_fragment>`);
    };
    mat.needsUpdate = true;
  }

  // ----- a thin layer of mist floating just above the ground -----
  makeLayer() {
    const seg = 160, geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)) + 2.4);
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 uMistCol;\n' + GLSL + `
        void main(){ float e, r, mv; float clear = mistClear(vP.xz, e, r, mv);
          float n = mistNoise(vP.xz * .05 + 3.0), n2 = mistNoise(vP.xz * .13 - 7.0);
          float d = distance(vP, cameraPosition);
          float a = (1.0 - clear) * (.05 + .2 * n * n2) * smoothstep(3.0, 22.0, d);
          gl_FragColor = vec4(uMistCol, a * 1.4); }`,
    });
    this.layer = new THREE.Mesh(geo, m); this.layer.renderOrder = 4; this.layer.frustumCulled = false; this.group.add(this.layer);
  }

  // ----- rocks and antennas that float above unscanned ground -----
  makeHovers() {
    let s = 4417; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const rockGeos = [rockGeometry(21, { detail: 2, rough: .6 }), rockGeometry(34, { detail: 2, squash: .8, rough: .7 }), rockGeometry(48, { detail: 2, rough: .5 })];
    const rockMat = new THREE.MeshStandardMaterial({ color: '#7d6a68', vertexColors: true, roughness: .92, flatShading: true, emissive: '#0d3a46', emissiveIntensity: .55 });
    const metal = new THREE.MeshStandardMaterial({ color: '#8d98a2', roughness: .45, metalness: .7, emissive: '#0d3a46', emissiveIntensity: .4 });
    const glowMat = new THREE.MeshBasicMaterial({ color: '#5fe3ff', transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false });
    const tipMat = new THREE.MeshBasicMaterial({ color: '#8cf0ff' });
    const lineGeo = new THREE.CylinderGeometry(.04, .04, 1, 5, 1, true), ringGeo = new THREE.RingGeometry(.75, 1, 28).rotateX(-Math.PI / 2);
    this.hovers = [];
    const spots = [];
    for (let k = 0, tries = 0; k < 44 && tries < 600; tries++) {
      const a = rnd() * Math.PI * 2, r = 118 + rnd() * 160, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (spots.some(q => Math.hypot(q.x - x, q.z - z) < 26)) continue;
      spots.push({ x, z }); k++;
      const kind = k % 4 === 0 ? 'antenna' : 'rocks', gy = heightAt(x, z), g = new THREE.Group();
      const hover = kind === 'antenna' ? 6.5 + rnd() * 3 : 7 + rnd() * 9;
      if (kind === 'rocks') {
        const n = 1 + Math.floor(rnd() * 3);
        for (let j = 0; j < n; j++) {
          const m = new THREE.Mesh(rockGeos[Math.floor(rnd() * 3)], rockMat), sc = (j ? .35 : 1) * (1.3 + rnd() * 2.4);
          m.scale.set(sc * (.8 + rnd() * .5), sc * (.6 + rnd() * .5), sc * (.8 + rnd() * .5));
          m.position.set(j ? (rnd() - .5) * 6 : 0, j ? (rnd() - .3) * 3.5 : 0, j ? (rnd() - .5) * 6 : 0); m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
          g.add(m);
        }
      } else {
        const H = 5 + rnd() * 3.5, mast = new THREE.Mesh(new THREE.CylinderGeometry(.05, .14, H, 8), metal); mast.position.y = H / 2;
        const bar = (y, w) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, .07, .07), metal); b.position.y = y; return b; };
        const dish = new THREE.Mesh(new THREE.SphereGeometry(.7, 14, 8, 0, Math.PI * 2, 0, 1.1), metal); dish.position.set(.3, H * .62, 0); dish.rotation.z = -1.1; dish.material = metal;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), tipMat); tip.position.y = H + .1; g.userData.tip = tip;
        g.add(mast, bar(H * .88, 1.5), bar(H * .74, 1.0), dish, tip); g.position.y = -H / 2; const hold = new THREE.Group(); hold.add(g);
        g.userData.hold = hold; g.rotation.set((rnd() - .5) * .5, 0, (rnd() - .5) * .5);
      }
      const root = kind === 'antenna' ? g.userData.hold : g; root.position.set(x, gy + hover, z);
      const line = new THREE.Mesh(lineGeo, glowMat); line.scale.set(1, hover, 1); line.position.set(x, gy + hover / 2, z);
      const ring = new THREE.Mesh(ringGeo, glowMat); ring.position.set(x, gy + .15, z); ring.scale.setScalar(kind === 'antenna' ? 1.6 : 2.6);
      const item = { x, z, gy, hover, root, line, ring, kind, tip: g.userData.tip, ph: rnd() * 6.28, k: 1, tilt: root.rotation.clone() };
      this.group.add(root, line, ring); this.hovers.push(item);
    }
  }

  // how clear is a point? (same rules as the shader, for the floating things)
  clearAt(x0, z0) {
    const [wx, wz] = warp(x0, z0), x = x0 + wx, z = z0 + wz;
    let best = 1e9, id = 0, second = 1e9;
    this.spots.forEach((sp, i) => { const d = Math.hypot(x - sp.x, z - sp.z); if (d < best) { second = best; best = d; id = i; } else if (d < second) second = d; });
    let c = this.spots.length && best < this.rev[id] * REACH ? 1 : 0;
    if (!c) for (const k of this.circles) if (Math.hypot(x0 - k.x, z0 - k.z) < k.r * .9) { c = 1; break; }
    return c;
  }

  drawMask(force) {
    const ci = revealCircles(this.world).filter(c => c.r < 200), sig = ci.length + ':' + ci.reduce((a, c) => a + c.x + c.z, 0).toFixed(0);
    this.circles = ci; if (!force && sig === this.sig) return; this.sig = sig;
    const c = this.mctx, S = MASK_N / WORLD_SIZE; c.fillStyle = '#000'; c.fillRect(0, 0, MASK_N, MASK_N);
    for (const k of ci) {
      const x = (k.x + HALF) * S, y = (k.z + HALF) * S, r = k.r * S, g = c.createRadialGradient(x, y, r * .72, x, y, r);
      g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    this.maskTex.needsUpdate = true;
  }

  // is a region complete? its tower is scanned and both survey finds are collected
  regionDone(i) { const ms = this.world.mapState; return !!ms && this.world.lookouts.got.has(i) && ms.finds.filter(f => f.tower === i).every(f => ms.found.has(f.id)); }

  tick(dt) {
    const w = this.world, lo = w.lookouts; if (!lo) return;
    this.t += dt; this.u.uTime.value = this.t;
    const fog = w.scene.fog?.color; if (fog) this.u.uMistCol.value.set('#0a1118').lerp(fog, .06);
    this.u.uLine.value.set(w.night ? '#7fe9ff' : '#2fb6d8');
    this.drawMask();
    const calm = !isModalOpen();
    for (let i = 0; i < 4; i++) {
      const target = lo.got.has(i) ? 1 : 0;
      if (this.snapNext) this.rev[i] = target;
      else if (this.rev[i] < target && calm) this.rev[i] = Math.min(target, this.rev[i] + dt * .3);
      else if (this.rev[i] > target) this.rev[i] = target;
      this.u.uRev.value[i] = this.rev[i];
      if (this.rev[i] >= 1 && !this.done.has(i) && this.regionDone(i)) { this.done.add(i); this.onRegion?.(i, this.spots[i]); }
    }
    this.snapNext = false;
    const cam = w.camera.position;
    for (const h of this.hovers) {
      const hide = this.clearAt(h.x, h.z), want = hide ? 0 : 1; h.k += (want - h.k) * Math.min(1, dt * 1.8);
      const vis = h.k > .02 && Math.hypot(h.x - cam.x, h.z - cam.z) < 380;
      h.root.visible = h.line.visible = h.ring.visible = vis; if (!vis) continue;
      const bob = Math.sin(this.t * .6 + h.ph) * .9, k = h.k * h.k * (3 - 2 * h.k), sink = (1 - k) * h.hover * .6;
      h.root.position.y = h.gy + h.hover + bob - sink; h.root.scale.setScalar(.05 + .95 * k);
      h.root.rotation.y = this.t * (h.kind === 'rocks' ? .12 : .2) + h.ph;
      h.line.scale.set(1, Math.max(.1, h.hover + bob - sink), 1); h.line.position.y = h.gy + (h.hover + bob - sink) / 2; h.line.material.opacity = .22;
      h.ring.scale.setScalar((h.kind === 'antenna' ? 1.6 : 2.6) * (.9 + .1 * Math.sin(this.t * 1.5 + h.ph)) * k);
      if (h.tip) h.tip.material.color.set(Math.sin(this.t * 3 + h.ph) > .2 ? '#bff7ff' : '#1f5668');
    }
  }
}
