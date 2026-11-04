// Opening scene: Earth launch pad, countdown, lift-off.
import * as THREE from 'three';

export class Launch {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7fb2e5');
    this.scene.fog = new THREE.Fog('#a9cdef', 80, 520);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
    this.scene.add(new THREE.HemisphereLight('#dcefff', '#4b6b3a', 1.2));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.8); sun.position.set(60, 120, 40); this.scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: '#5f8a4a' }));
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 2, 24), new THREE.MeshLambertMaterial({ color: '#9a9a96' }));
    pad.position.y = 1; this.scene.add(pad);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 700), new THREE.MeshLambertMaterial({ color: '#3d78b8' }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, -650); this.scene.add(sea);

    const L = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

    // Mobile launcher tower (grey steel, like the one at Kennedy's Launch Complex 39B)
    const steel = L('#5b6068');
    const tower = new THREE.Group(); tower.position.set(-11, 2, 0);
    for (let i = 0; i < 4; i++) tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 76, 0.7), steel), i % 2 ? 2.6 : -2.6, 38, i < 2 ? 2.6 : -2.6));
    for (let y = 5; y < 76; y += 6) tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.45, 5.8), steel), 0, y, 0));
    tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 1.4), steel), 6.5, 63, 0));   // crew access arm to Orion
    this.scene.add(tower);

    // SLS Block 1: orange core stage + two white solid rocket boosters + upper stage + Orion + abort tower
    const orange = L('#d4711f'), white = L('#f2f1ee'), dark = L('#26272b'), silver = L('#b9bcc2');
    const r = this.rocket = new THREE.Group(); r.position.y = 2;
    r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 52, 24), orange), 0, 27, 0));        // core stage (foam is orange)
    r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 24), dark), 0, 1.5, 0));
    for (const side of [-1, 1]) {                                                                         // solid rocket boosters
      r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 47, 16), white), side * 5, 24.5, 0));
      r.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 16), white), side * 5, 50, 0));
      for (const y of [12, 24, 36]) r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.6, 16), dark), side * 5, y, 0));
      r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.7, 2.4, 16), dark), side * 5, 0, 0));
    }
    r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 4, 24), white), 0, 55, 0));          // adapter + upper stage
    r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6, 24), white), 0, 60, 0));
    r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 24), silver), 0, 65, 0));         // Orion service module
    r.add(at(new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 24), white), 0, 69.5, 0));                 // Orion capsule (in its cover)
    r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 10), white), 0, 75.5, 0));      // launch abort system tower
    r.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.35, 2, 10), dark), 0, 80, 0));
    for (let i = 0; i < 4; i++) r.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.6, 10), dark), (i % 2 ? 1 : -1) * 1.3, 0.2, (i < 2 ? 1 : -1) * 1.3)); // 4 RS-25 engines
    this.flame = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 });
    for (const x of [-5, 0, 5]) this.flame.add(at(new THREE.Mesh(new THREE.ConeGeometry(x ? 1.6 : 2.8, x ? 18 : 14, 14, 1, true), flameMat), x, -8, 0));
    this.flame.children.forEach(c => (c.rotation.x = Math.PI));
    this.flame.visible = false; r.add(this.flame);
    this.scene.add(r);

    // smoke puffs
    this.smoke = [];
    const puffMat = new THREE.MeshLambertMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.8 });
    for (let i = 0; i < 60; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), puffMat); s.visible = false; this.scene.add(s);
      this.smoke.push({ mesh: s, life: 0, vel: new THREE.Vector3() });
    }
    this.t = 0; this.countFrom = 10; this.done = false;
  }

  update(dt) {
    this.t += dt;
    const left = this.countFrom - this.t;          // seconds until lift-off
    const lift = Math.max(0, -left);
    if (left <= 1.5) this.flame.visible = true;
    this.flame.children.forEach(c => c.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.3, 1 + Math.random() * 0.15));
    this.rocket.position.y = 2 + 4 * lift * lift;  // accelerating upwards
    if (left < 1.5) {
      for (const s of this.smoke) {
        if (s.life <= 0 && Math.random() < 0.25) {
          s.life = 2.5; s.mesh.visible = true;
          s.mesh.position.set((Math.random() - 0.5) * 4, Math.max(1, this.rocket.position.y - 8), (Math.random() - 0.5) * 4);
          s.vel.set((Math.random() - 0.5) * 14, Math.random() * 2, (Math.random() - 0.5) * 14);
        }
        if (s.life > 0) { s.life -= dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.scale.setScalar(1 + (2.5 - s.life) * 2.2); if (s.life <= 0) s.mesh.visible = false; }
      }
    }
    const shake = left < 1.5 && lift < 4 ? (Math.random() - 0.5) * 0.4 : 0;
    const follow = Math.min(this.rocket.position.y, 400);
    this.camera.position.set(62 + shake, 16 + follow * 0.85, 92 + shake);
    this.camera.lookAt(0, 34 + follow, 0);
    if (lift > 6.5) this.done = true;
    // what the commentator explains at each moment of the countdown
    const caption = left > 6 ? 'This is SLS, NASA\'s Space Launch System - 98 m tall'
      : left > 3 ? 'On top: the Orion capsule, where the crew sits'
      : left > 0 ? 'Main engines and the two boosters light up'
      : 'Lift-off! 8.8 million pounds of thrust';
    return { left: Math.ceil(left), lifted: lift > 0, caption };
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
