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

    // launch tower
    const steel = new THREE.MeshLambertMaterial({ color: '#c0392b', flatShading: true });
    const tower = new THREE.Group(); tower.position.set(-9, 2, 0);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 62, 0.6), steel);
      leg.position.set(i % 2 ? 2 : -2, 31, i < 2 ? 2 : -2); tower.add(leg);
    }
    for (let y = 4; y < 62; y += 6) { const bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 4.6), steel); bar.position.y = y; tower.add(bar); }
    this.scene.add(tower);

    // rocket
    const white = new THREE.MeshLambertMaterial({ color: '#f4f4f2', flatShading: true });
    const black = new THREE.MeshLambertMaterial({ color: '#1c1c1e', flatShading: true });
    const r = this.rocket = new THREE.Group(); r.position.y = 2;
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 20), white); stage.position.y = 20; r.add(stage);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 1.2, 20), black); ring.position.y = 30; r.add(ring);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 10, 20), white); upper.position.y = 45; r.add(upper);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 20), white); nose.position.y = 54; r.add(nose);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 4), black);
      fin.position.set(Math.cos(i * Math.PI / 2) * 3.4, 3.5, Math.sin(i * Math.PI / 2) * 3.4); fin.rotation.y = -i * Math.PI / 2; r.add(fin);
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 }));
    this.flame.rotation.x = Math.PI; this.flame.position.y = -7; this.flame.visible = false; r.add(this.flame);
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
    this.flame.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.3, 1 + Math.random() * 0.15);
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
    this.camera.position.set(48 + shake, 14 + follow * 0.85, 70 + shake);
    this.camera.lookAt(0, 26 + follow, 0);
    if (lift > 6.5) this.done = true;
    return { left: Math.ceil(left), lifted: lift > 0 };
  }

  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
