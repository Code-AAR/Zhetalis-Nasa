// How long a radio message takes between Earth and Mars on a given date. Pure maths (tested in Node).
// Planet positions use NASA JPL's "approximate positions of the planets" (Keplerian elements, valid 1800-2050):
// https://ssd.jpl.nasa.gov/planets/approx_pos.html  - good to a small fraction of a light-minute.
const RAD = Math.PI / 180, AU_LIGHT_SECONDS = 499.004784;   // light crosses 1 astronomical unit in ~499 s
// [a (AU), e, I (deg), L (deg), long. of perihelion (deg), long. of node (deg)] and their change per century
const ELEMENTS = {
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
};

// Heliocentric position in the ecliptic plane, in astronomical units.
export function heliocentric(planet, date = new Date()) {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const [a, e, I, L, peri, node] = ELEMENTS[planet][0].map((v, i) => v + ELEMENTS[planet][1][i] * T);
  const w = (peri - node) * RAD, M = (((L - peri) % 360) + 540) % 360 - 180;
  let E = M * RAD + e * Math.sin(M * RAD);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M * RAD) / (1 - e * Math.cos(E));   // Kepler's equation
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E), i = I * RAD, o = node * RAD;
  return {
    x: (Math.cos(w) * Math.cos(o) - Math.sin(w) * Math.sin(o) * Math.cos(i)) * x + (-Math.sin(w) * Math.cos(o) - Math.cos(w) * Math.sin(o) * Math.cos(i)) * y,
    y: (Math.cos(w) * Math.sin(o) + Math.sin(w) * Math.cos(o) * Math.cos(i)) * x + (-Math.sin(w) * Math.sin(o) + Math.cos(w) * Math.cos(o) * Math.cos(i)) * y,
    z: Math.sin(w) * Math.sin(i) * x + Math.cos(w) * Math.sin(i) * y,
  };
}

// One-way Earth-Mars signal time. Returns { au, km, seconds, minutes }.
export function earthMarsLightTime(date = new Date()) {
  const e = heliocentric('earth', date), m = heliocentric('mars', date);
  const au = Math.hypot(m.x - e.x, m.y - e.y, m.z - e.z), seconds = au * AU_LIGHT_SECONDS;
  return { au, km: au * 149597870.7, seconds, minutes: seconds / 60 };
}

// "12 min 40 s" - for captions.
export function lightTimeWords(seconds) {
  const m = Math.floor(seconds / 60), s = Math.round(seconds - m * 60);
  return s === 60 ? `${m + 1} min 0 s` : `${m} min ${s} s`;
}
