// The night sky: thousands of stars (different brightness and colour, thicker along the Milky Way) and the
// planets where they really are today.
//
// Planet positions use NASA JPL's "Keplerian Elements for Approximate Positions of the Major Planets"
// (https://ssd.jpl.nasa.gov/planets/approx_pos.html, valid 1800-2050, good to a fraction of a degree here).
// The Moon uses a short standard formula. We place every body by its ecliptic longitude and latitude: the
// planets really do all sit near this one line across the sky (the ecliptic), in this order and spacing.
import * as THREE from 'three';

const RAD = Math.PI / 180;
// a, e, I, L, long. of perihelion, long. of node (J2000) and their changes per century
const ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};

// Heliocentric ecliptic position (in AU) of a planet on a date.
function helio(name, date) {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const [el, rate] = ELEMENTS[name];
  const [a, e, I, L, wbar, node] = el.map((v, i) => v + rate[i] * T);
  const w = wbar - node;
  let M = ((L - wbar) % 360 + 540) % 360 - 180;
  let E = M * RAD + e * Math.sin(M * RAD);
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M * RAD) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w * RAD), sw = Math.sin(w * RAD), cO = Math.cos(node * RAD), sO = Math.sin(node * RAD), cI = Math.cos(I * RAD), sI = Math.sin(I * RAD);
  return new THREE.Vector3(
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    (sw * sI) * xp + (cw * sI) * yp);
}
const lonLat = v => ({ lon: Math.atan2(v.y, v.x) / RAD, lat: Math.atan2(v.z, Math.hypot(v.x, v.y)) / RAD });

const LOOK = {
  sun: { label: 'Sun', color: '#fff4d6', size: 0.09 }, moon: { label: 'Moon', color: '#e8e6e0', size: 0.05 },
  mercury: { label: 'Mercury', color: '#d9cbb8', size: 0.012 }, venus: { label: 'Venus', color: '#fffbe8', size: 0.02 },
  earth: { label: 'Earth', color: '#8fd4ff', size: 0.02 }, mars: { label: 'Mars', color: '#ff7a4d', size: 0.018 },
  jupiter: { label: 'Jupiter', color: '#ffe6bd', size: 0.019 }, saturn: { label: 'Saturn', color: '#f2dca6', size: 0.015 },
};

// Where each body appears in the sky seen from Earth (or from Mars), as ecliptic longitude/latitude in degrees.
export function skyBodies(date = new Date(), from = 'earth') {
  const here = helio(from, date), out = [];
  for (const name of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn']) {
    if (name === from) continue;
    out.push({ name, ...lonLat(helio(name, date).sub(here)), ...LOOK[name] });
  }
  out.push({ name: 'sun', ...lonLat(here.clone().negate()), ...LOOK.sun });
  if (from === 'earth') {   // the Moon (short formula, good to about a degree)
    const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    const L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.229350 * d;
    out.push({ name: 'moon', lon: L + 6.289 * Math.sin(M * RAD), lat: 5.128 * Math.sin(F * RAD), ...LOOK.moon });
  }
  return out;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.2, 'rgba(255,255,255,0.85)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.18)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function label(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = '600 30px Poppins, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 6; g.fillStyle = color; g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
  s.scale.set(0.16, 0.04, 1); s.center.set(0.5, 1.5); return s;
}

// Thousands of stars on a big sphere: sizes and colours like real stars (most are faint; blue-white to orange),
// more of them packed along the Milky Way. Fade the whole sky with .setOpacity(0..1).
export function makeStars(radius, count = 4000, onlyUpper = false) {
  const pos = [], col = [], size = [];
  const tint = [new THREE.Color('#9fbfff'), new THREE.Color('#dfe8ff'), new THREE.Color('#ffffff'), new THREE.Color('#fff2d8'), new THREE.Color('#ffd2a1')];
  const band = new THREE.Vector3(0.35, 0.6, -0.72).normalize();   // the Milky Way's pole
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    let v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue; }
    v.normalize();
    if (i % 3 === 0) v.addScaledVector(band, -v.dot(band) * (0.85 + rnd() * 0.15)).normalize();   // a third of the stars hug the Milky Way
    if (onlyUpper && v.y < -0.05) v.y = -v.y;
    pos.push(v.x * radius, v.y * radius, v.z * radius);
    const m = rnd() ** 3.2;                                       // brightness: lots of faint stars, a few bright ones
    size.push(1.2 + m * 4.2);
    const c = tint[Math.min(4, Math.floor(rnd() * 5))].clone().multiplyScalar(0.45 + m * 0.75);
    col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, scale: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: 'attribute float size; varying vec3 vColor; uniform float scale; void main(){ vColor = color; gl_PointSize = size * scale; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vColor; uniform float opacity; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor, a * opacity); }',
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = -1;
  pts.setOpacity = o => (mat.uniforms.opacity.value = o);
  return pts;
}

// The Sun, Moon and planets as glowing dots with name labels, placed by where they really are today.
// centre: which body to put in the middle of the arc (e.g. 'mars'); yaw/pitch: where that is in the scene.
export function makePlanets(radius, { date = new Date(), from = 'earth', centre = 'mars', yaw = 0, pitch = 0.3, hide = [] } = {}) {
  const g = new THREE.Group(), tex = glowTexture(), bodies = skyBodies(date, from).filter(b => !hide.includes(b.name));
  const c = bodies.find(b => b.name === centre) || bodies[0];
  for (const b of bodies) {
    let dl = ((b.lon - c.lon + 540) % 360) - 180;                 // degrees along the ecliptic from the centre body
    const ay = yaw - dl * RAD, ap = pitch + (b.lat - c.lat) * RAD;
    const dir = new THREE.Vector3(Math.sin(ay) * Math.cos(ap), Math.sin(ap), Math.cos(ay) * Math.cos(ap));
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: b.color, transparent: true, depthWrite: false, fog: false, sizeAttenuation: false, blending: THREE.AdditiveBlending }));
    dot.scale.setScalar(b.size); dot.position.copy(dir).multiplyScalar(radius);
    const tag = label(b.label, b.color); tag.position.copy(dot.position);
    g.add(dot, tag);
  }
  g.userData.setOpacity = o => g.children.forEach(s => (s.material.opacity = o));
  g.userData.setOpacity(0);
  return g;
}
