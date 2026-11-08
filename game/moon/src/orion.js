// Orion, built from simple shapes: the cone-shaped crew module (heat shield at the bottom), the European
// Service Module (a cylinder) and its four X-shaped solar array wings. Artemis I flew it uncrewed with
// cameras on the array wings; Artemis II carried four astronauts (lit windows, crew in the seats).
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
// NASA's printable crew-module mesh. Only the capsule is NASA geometry;
// service module, arrays and materials below remain illustrative game geometry.
const capsuleGeometry = new STLLoader().loadAsync('moon/assets/nasa/orion-capsule.stl').then(geo => {
  geo.computeBoundingBox();
  const box = geo.boundingBox, scale = 5 / (box.max.x - box.min.x);
  geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geo.scale(scale, scale, scale);
  geo.computeBoundingSphere();
  return geo;
}).catch(() => null);


const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o });
const cells = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#0c1630'; g.fillRect(0, 0, 64, 256); g.strokeStyle = '#4b6aa8'; g.lineWidth = 1.5;
  for (let y = 0; y <= 256; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  for (let x = 0; x <= 64; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

export function buildOrion(mission = 'artemis2') {
  const g = new THREE.Group(); g.name = `Orion (${mission})`;
  const silver = std('#c9ccd1', { metalness: 0.75, roughness: 0.32 }), white = std('#eeeeec'), black = std('#1e1f22', { roughness: 0.8 }), gold = std('#c79a3e', { metalness: 0.85, roughness: 0.3 });
  // crew module: truncated cone, heat shield at its wide end facing the service module
  const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 2.5, 3.3, 48), silver); cm.position.y = 1.65; g.add(cm);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.52, 0.18, 48), std('#6b4a2e', { roughness: 0.9 })); shield.position.y = 0.05; g.add(shield);
  const dock = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 24), black); dock.position.y = 3.55; g.add(dock);
  // windows: lit with cabin light when crewed
  const winMat = std('#0b1622', { metalness: 0.7, roughness: 0.1, emissive: mission === 'artemis2' ? '#ffcf8a' : '#000000', emissiveIntensity: mission === 'artemis2' ? 0.7 : 0 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.4, w = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.05), winMat);
    const r = 1.55; w.position.set(Math.sin(a) * r, 2.3, Math.cos(a) * r); w.lookAt(Math.sin(a) * 5, 2.3 + 1.5, Math.cos(a) * 5); g.add(w);
  }
  // service module + adapter
  const ad = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.1, 0.7, 48), white); ad.position.y = -0.45; g.add(ad);
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 2.8, 48), std('#d7d9db', { metalness: 0.35 })); sm.position.y = -2.2; g.add(sm);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.07, 2.07, 0.9, 48, 1, true), gold); band.position.y = -2.7; g.add(band);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 1.6, 24, 1, true), black); nozzle.position.y = -4.4; g.add(nozzle);
  // four solar array wings, each three panels, in an X
  const panelMat = new THREE.MeshStandardMaterial({ map: cells, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide, emissive: '#0a1c44', emissiveIntensity: 0.3 });
  g.userData.wings = [];
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Group(); wing.rotation.y = Math.PI / 4 + i * Math.PI / 2; wing.position.y = -2.1;
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), silver); boom.position.x = 2.6; wing.add(boom);
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 2.0), panelMat); p.position.x = 4.3 + k * 2.05; wing.add(p); }
    if (mission === 'artemis1') { const cam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), black); cam.position.set(9.5, 0.15, 0); wing.add(cam); }
    wing.rotation.z = 0.12; g.add(wing); g.userData.wings.push(wing);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // the whole stack flies heat-shield-forward-ish; rotate so +z is "forward"
  g.rotation.x = Math.PI / 2;
  const root = new THREE.Group(); root.add(g); root.userData.body = g;
  capsuleGeometry.then(geo => {
    if (!geo || root.userData.disposed) return;
    cm.geometry.dispose(); cm.geometry = geo.clone(); cm.position.y = 0;
    cm.name = 'NASA Orion capsule'; root.userData.nasaCapsule = true;
  });
  return root;
}

export const MISSIONS = {
  artemis1: {
    name: 'Artemis I', crew: 0, dates: '16 Nov - 11 Dec 2022', length: '25 days, 10 hours, 53 minutes',
    periapsisKm: 129,   // "within 80 miles of the lunar surface" (NASA Artemis I timeline); 80 mi ~ 129 km
    distanceNote: 'Closest pass: within 80 miles of the surface (NASA).',
    view: 'array', viewName: 'Solar-array wing camera',
    summary: 'Uncrewed test flight. Cameras on the solar array wings took the pictures. After the flyby Orion entered a distant retrograde orbit, then came home. It did not land.',
    fact: 'moon-artemis-1', photo: 'artemis1',
    targets: [
      { id: 'selfie', name: 'Orion selfie with the Moon', hint: 'Turn the wing camera so Orion and the Moon are both in the frame.' },
      { id: 'farside', name: 'The far side', hint: 'Point at the Moon while you are behind it.' },
      { id: 'home', name: 'Earth from deep space', hint: 'Find Earth and centre it.' },
    ],
  },
  artemis2: {
    name: 'Artemis II', crew: 4, dates: '1 - 10 April 2026', length: '9 days, 1 hour, 32 minutes',
    periapsisKm: null, // NASA has not been quoted here; the pass shown is illustrative
    distanceNote: 'Pass distance shown is illustrative. Record set: 252,756 miles from Earth (NASA).',
    view: 'window', viewName: 'Crew window',
    summary: 'Four astronauts - Reid Wiseman, Victor Glover, Christina Koch and Jeremy Hansen - flew around the far side of the Moon and home. A crewed flyby: they did not land.',
    fact: 'moon-artemis-2', photo: 'earthset',
    targets: [
      { id: 'earthset', name: 'Earthset', hint: 'Watch Earth slip behind the Moon\'s edge and take the picture just before it disappears.' },
      { id: 'farside', name: 'The far side', hint: 'Point at the Moon while you are behind it.' },
      { id: 'home', name: 'Earth from deep space', hint: 'Find Earth and centre it.' },
    ],
  },
};
