// Skip drawing parts that are too small to see from where the camera is (bolts, hatch handles, far rocks, a rover
// 300 m away). The base and the stops are built from a couple of thousand small meshes; from the far side of the
// map most of them cover only a pixel or two but still cost a draw call each. This hides them from the camera
// (and from shadows) by taking them off render layer 0. It never touches .visible, so game code that shows and
// hides things keeps working. Big shapes, the terrain, the player and anything held by the camera are left alone.
const HIDE = 1 / 450, SHOW = 1 / 380;          // size on screen, as radius / distance (about 3 px tall at 1080p)

export class DetailCull {
  constructor(world) {
    this.world = world; this.list = []; this.hidden = new Set(); this.t = 0; this.scan = 0;
    const upd = world.update.bind(world);
    world.update = (dt, active) => { upd(dt, active); this.tick(dt); };
  }
  collect() {
    const w = this.world, skip = new Set([w.player, w.camera, w.sky, w.terrain].filter(Boolean));
    this.list = [];
    const walk = o => {
      if (skip.has(o)) return;
      if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.geometry) {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        if (o.geometry.boundingSphere && o.geometry.boundingSphere.radius < 30) this.list.push(o);
      }
      for (const c of o.children) walk(c);
    };
    walk(w.scene);
  }
  tick(dt) {
    if ((this.scan -= dt) <= 0) { this.scan = 3; this.collect(); }   // new buildings and models appear over time
    if ((this.t -= dt) > 0) return; this.t = .25;
    const cam = this.world.camera?.position; if (!cam) return;
    for (const o of this.list) {
      const m = o.matrixWorld.elements, bs = o.geometry.boundingSphere, c = bs.center;
      const x = m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12] - cam.x, y = m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13] - cam.y, z = m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14] - cam.z;
      const s = Math.sqrt(Math.max(m[0] * m[0] + m[1] * m[1] + m[2] * m[2], m[4] * m[4] + m[5] * m[5] + m[6] * m[6], m[8] * m[8] + m[9] * m[9] + m[10] * m[10]));
      const k = bs.radius * s / Math.max(.5, Math.sqrt(x * x + y * y + z * z)), off = this.hidden.has(o);
      if (!off && k < HIDE) { o.layers.disable(0); o.layers.enable(30); this.hidden.add(o); }
      else if (off && k > SHOW) { o.layers.enable(0); o.layers.disable(30); this.hidden.delete(o); }
    }
  }
}
