// Co-op crewmates: the other players' astronauts, on the surface or inside the habitat.
// Each one is NASA's jointed suit (suit.js) plus a coloured beacon and a name tag: three or four draw calls a player.
// Poses arrive about ten times a second (coop.js); between them the astronaut glides to the newest pose and the
// walk cycle runs locally from its speed, so the legs keep moving smoothly. Off-screen astronauts are not drawn,
// and any surface movement marks the shadow map dirty (world.shadowDirty) so their shadows follow them.
import * as THREE from 'three';
import { loadNasaAstronaut, poseAstronaut } from './suit.js';

const WALK = 3.2, RUN = 6.2, SUIT_H = 1.85;
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function nameTag(name, colour) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,16,22,.72)'; g.beginPath(); g.roundRect(4, 8, 248, 48, 22); g.fill();
  g.fillStyle = colour; g.beginPath(); g.arc(30, 32, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 28px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(name, 50, 33, 196);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(1.1, .275, 1); s.position.y = 2.25; s.renderOrder = 5;
  return s;
}

function fallbackBody(colour) {   // simple shapes until (or if) the NASA suit loads
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: '#f1efe9' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.36, 1.0, 4, 10), m); body.position.y = .9; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), m); head.position.y = 1.65; g.add(head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

class Avatar {
  constructor(id, name, colour) {
    this.id = id; this.name = name; this.colour = colour;
    this.root = new THREE.Group(); this.root.name = 'coop-' + id;
    this.rig = new THREE.Group(); this.root.add(this.rig);
    this.body = fallbackBody(colour); this.rig.add(this.body);
    // a coloured beacon on top of the life-support pack, so you can tell crewmates apart from far away
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: colour }));
    this.beacon.position.set(0, 1.62, -.3); this.rig.add(this.beacon);
    this.tag = nameTag(name, colour); this.root.add(this.tag);
    this.pos = new THREE.Vector3(); this.target = new THREE.Vector3(); this.yaw = 0; this.targetYaw = 0;
    this.gait = 0; this.swing = 0; this.runMix = 0; this.airMix = 0; this.t = 0; this.where = null; this.fresh = true;
    loadNasaAstronaut().then(a => {
      if (!a || this.disposed) return;
      this.rig.remove(this.body); this.suit = a; this.rig.add(a.root);
    }).catch(() => {});
  }
  setPose(p) {
    this.pose = p;
    const where = p.sl ? 'bunk' : p.w;
    if (where !== this.where) this.fresh = true;   // changed place (went inside, lay down...): jump, don't glide
    this.where = where;
    if (p.w === 'out') { this.target.set(p.x, p.y, p.z); this.targetYaw = p.ry; }
    else if (p.w === 'hab') { this.target.set(p.hx, 0, p.hz); this.targetYaw = p.hy; }
  }
  dispose() { this.disposed = true; this.root.removeFromParent(); this.tag.material.map.dispose(); this.tag.material.dispose(); }
}

export class RemotePlayers {
  constructor(world, interior, bunks) {
    this.world = world; this.interior = interior; this.bunks = bunks; this.list = new Map();
    this.frustum = new THREE.Frustum(); this.m = new THREE.Matrix4(); this.sphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
    this.lie = new THREE.Matrix4();
  }
  upsert(id, name, colour) {
    let a = this.list.get(id);
    if (!a) { a = new Avatar(id, name, colour); this.list.set(id, a); }
    return a;
  }
  remove(id) { this.list.get(id)?.dispose(); this.list.delete(id); }
  clear() { for (const id of [...this.list.keys()]) this.remove(id); }
  pose(id, p) { this.list.get(id)?.setPose(p); }
  // camera: the camera you are looking through; viewInside: true when you are in the hab or greenhouse
  update(dt, camera, viewInside) {
    let surfaceMoved = false;
    if (camera) { camera.updateMatrixWorld(); this.frustum.setFromProjectionMatrix(this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
    for (const a of this.list.values()) {
      const p = a.pose; a.t += dt;
      if (!p) { a.root.visible = false; continue; }
      const out = p.w === 'out', hab = p.w === 'hab';
      const scene = out ? this.world.scene : hab ? this.interior.scene : null;
      if (!scene) { a.root.visible = false; a.root.removeFromParent(); continue; }   // driving the rover or in the lander
      if (a.root.parent !== scene) { scene.add(a.root); a.fresh = true; }
      const bunk = hab && p.sl ? this.bunks?.byId(p.sl) : null;
      if (bunk) {   // lying in a bunk, head on the pillow
        a.root.position.copy(bunk.body.pos); a.root.quaternion.copy(bunk.body.quat);
        a.tag.position.set(0, .4, .5);
        if (a.suit) poseAstronaut(a.suit, { phase: 0, pace: 0, run: 0, air: 0, t: a.t * .3 });
        a.rig.position.set(0, 0, 0); a.rig.rotation.set(0, 0, 0);
      } else {
        if (a.tag.position.y !== 2.25) { a.tag.position.set(0, 2.25, 0); a.root.quaternion.identity(); }
        const before = a.pos.clone();
        if (a.fresh) { a.pos.copy(a.target); a.yaw = a.targetYaw; a.fresh = false; }
        else { const k = 1 - Math.exp(-dt * 12); a.pos.lerp(a.target, k); a.yaw += angleTo(a.yaw, a.targetYaw) * (1 - Math.exp(-dt * 10)); }
        a.root.position.copy(a.pos); a.root.rotation.set(0, a.yaw, 0);
        // walk cycle from the reported speed (feet follow distance, like your own astronaut in world.js)
        const speed = Math.min(p.sp || 0, RUN * 1.2), pace = Math.min(1, speed / WALK), run = THREE.MathUtils.clamp((speed - WALK) / (RUN - WALK), 0, 1);
        const ease = k => 1 - Math.exp(-dt * k), grounded = p.g !== 0;
        if (grounded) a.gait += speed * dt / THREE.MathUtils.lerp(2.2, 3.8, run) * Math.PI * 2;
        a.swing += (pace - a.swing) * ease(6); a.runMix += (run - a.runMix) * ease(4); a.airMix += ((grounded ? 0 : 1) - a.airMix) * ease(8);
        if (a.suit) {
          const { bob, sway } = poseAstronaut(a.suit, { phase: a.gait, pace: a.swing, run: a.runMix, air: a.airMix, t: a.t, vy: p.vy || 0, swing: p.sw ?? -1, crouch: p.cr || 0 });
          a.rig.position.set(sway, bob, 0); a.rig.rotation.set(.05 * a.swing + .1 * a.runMix, 0, 0);
        }
        if (out && before.distanceToSquared(a.pos) > 1e-6) surfaceMoved = true;
        if (out && (a.swing > .02 || (p.sw ?? -1) >= 0)) surfaceMoved = true;
      }
      // don't draw crewmates outside the view (the suit is skinned, so three.js can't cull it by itself)
      // (outside crewmates still show through the hab windows; inside ones only when you are inside too)
      this.sphere.center.copy(a.root.position).applyMatrix4(scene.matrixWorld).y += .9;
      a.root.visible = (out || viewInside) && (!camera || this.frustum.intersectsSphere(this.sphere));
      a.tag.visible = !camera || camera.position.distanceToSquared(this.sphere.center) > 4;   // no giant label right in front of the lens
    }
    if (surfaceMoved) this.world.remoteShadowDirty = true;
  }
}
