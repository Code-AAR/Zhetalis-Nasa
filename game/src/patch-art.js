// Mission patch artwork. No imports, so the preview page and the game share it.
// Real NASA patches are not all circles: Gemini, Apollo and Artemis crews pick a shape, ring it with a
// stitched border, write the mission name on it and hide the mission number in the design. We do the same:
// the shape tells you the kind of patch, the border is "embroidered", and each one has a number.

// Five outlines, all inside the 40x40 box. `rim` is the colour of the stitched border thread.
// dy nudges the picture; numY is where "No. 07" sits; gdy and arc are used on the big version (picture and name arc).
export const SHAPES = {
  circle: { name: 'First steps', rim: '#efe3c0', dy: 0, numY: 9.4, gdy: 0, arc: 'M8.8 21A11.4 11.4 0 0 0 31.2 21', d: 'M20 1A19 19 0 1 1 19.99 1Z' },
  hex: { name: 'Survival', rim: '#cfe4ea', dy: 0, numY: 11.4, gdy: 1.4, arc: 'M8.8 21.6A11.2 11.2 0 0 0 31.2 21.6', d: 'M20 .8 36.7 10.4v19.2L20 39.2 3.3 29.6V10.4Z' },
  shield: { name: 'Honours', rim: '#e9cf7a', dy: -1, numY: 10.6, gdy: .9, arc: 'M9.6 20.4A10.4 10.4 0 0 0 30.4 20.4', d: 'M5 3h30v18c0 9-7 14-15 17C12 35 5 30 5 21Z' },
  arrow: { name: 'Exploration', rim: '#f0c9b8', dy: 1.5, numY: 12.4, gdy: 2.2, arc: 'M8.8 22A11.4 11.4 0 0 0 31.2 22', d: 'M20 1 38.5 15 31.5 38.5h-23L1.5 15Z' },
  square: { name: 'Engineering', rim: '#cfd3d8', dy: 0, numY: 9.6, gdy: 0, arc: 'M8.8 21A11.4 11.4 0 0 0 31.2 21', d: 'M7 2h26a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z' },
};

// tier decides how big the award moment is: common, rare or key (the three BotW-style lengths)
export const PATCHES = [
  { id: 'steps', name: 'Boots on Mars', hint: 'Walk away from your lander', colour: '#c4532f', g: 'boot', shape: 'circle', tier: 'common' },
  { id: 'hang', name: 'Hang time', hint: 'Jump. Mars pulls on you less than Earth does', colour: '#2f6db5', g: 'jump', shape: 'circle', tier: 'common' },
  { id: 'ice', name: 'Ice miner', hint: 'Collect ice to make oxygen', colour: '#3a9fb5', g: 'ice', shape: 'hex', tier: 'common' },
  { id: 'scrap', name: 'Scrap collector', hint: 'Pick up metal parts', colour: '#7a6f66', g: 'bolt', shape: 'square', tier: 'common' },
  { id: 'percy', name: 'Old friend', hint: 'Find the old rover', colour: '#b5832f', g: 'rover', shape: 'arrow', tier: 'rare' },
  { id: 'heli', name: 'Rotor spotter', hint: 'Find the little helicopter', colour: '#5a4fa8', g: 'heli', shape: 'arrow', tier: 'rare' },
  { id: 'driver', name: 'Long haul', hint: 'Drive the crew rover 200 m', colour: '#3f7d4f', g: 'wheel', shape: 'arrow', tier: 'common' },
  { id: 'dust', name: 'Dust buster', hint: 'Clean the solar panels', colour: '#a86a3c', g: 'wipe', shape: 'square', tier: 'common' },
  { id: 'night', name: 'Night shift', hint: 'Get through your first night', colour: '#1f2a52', g: 'moon', shape: 'hex', tier: 'common' },
  { id: 'storm', name: 'Storm chaser', hint: 'Get through a solar storm', colour: '#d08a1f', g: 'sun', shape: 'hex', tier: 'rare' },
  { id: 'fresh', name: 'Green thumb', hint: 'Eat food grown in the greenhouse', colour: '#4f9a3c', g: 'leaf', shape: 'hex', tier: 'rare' },
  { id: 'build', name: 'Engineer', hint: 'Build something at the workbench', colour: '#8a3c5a', g: 'wrench', shape: 'square', tier: 'common' },
  { id: 'sunset', name: 'Blue hour', hint: 'Be outside for a Mars sunset', colour: '#2a5f9e', g: 'sunset', shape: 'circle', tier: 'common' },
  { id: 'briefing', name: 'Mission ready', hint: 'Watch the whole mission briefing', colour: '#3b3f8f', g: 'rocket', shape: 'circle', tier: 'common' },
  { id: 'shelter', name: 'Safe and sound', hint: 'Hide in the storm shelter during a solar storm', colour: '#6b4b2f', g: 'shelter', shape: 'hex', tier: 'rare' },
  { id: 'tier', name: 'Moving up', hint: 'Grow your camp into a sealed base', colour: '#2f7f7a', g: 'tier', shape: 'square', tier: 'rare' },
  { id: 'reactor', name: 'Fission power', hint: 'Get a reactor running', colour: '#9e3a2f', g: 'atom', shape: 'square', tier: 'rare' },
  { id: 'scholar', name: 'Field notes', hint: 'Collect 15 fact cards in your logbook', colour: '#5f6b2f', g: 'book', shape: 'shield', tier: 'rare' },
  { id: 'lookout', name: 'High ground', hint: 'Scan the land from all four lookout towers', colour: '#3b6f95', g: 'tower', shape: 'arrow', tier: 'rare' },
  { id: 'region', name: 'Region keeper', hint: 'Fully explore a region: scan its tower and find both survey spots', colour: '#8a6a1f', g: 'star', shape: 'circle', tier: 'rare' },
  { id: 'geologist', name: 'Field geologist', hint: 'Visit 6 of the real Gusev stops (rocks, craters and hills)', colour: '#a8683a', g: 'boot', shape: 'hex', tier: 'rare' },
  { id: 'footsteps', name: 'In Spirit\'s footsteps', hint: 'Visit every real Gusev stop on the map', colour: '#7b4a8f', g: 'wheel', shape: 'shield', tier: 'key' },
  { id: 'devil', name: 'Devil spotter', hint: 'Spot a dust devil wandering across the plain', colour: '#b58a4a', g: 'wipe', shape: 'circle', tier: 'common' },
  { id: 'gold', name: 'Top of the class', hint: 'Get every question right in the end-of-mission quiz', colour: '#2a3a78', g: 'star', shape: 'shield', tier: 'key' },
  { id: 'complete', name: 'Mission complete', hint: 'Finish a whole mission', colour: '#b0303a', g: 'flag', shape: 'shield', tier: 'key' },
];
// Earn all of them and the crew medal is awarded. It is not in PATCHES: it is the set's final prize.
export const MEDAL = { id: 'medal', name: 'Flight crew', hint: 'Earn every mission patch', colour: '#c9a227', g: 'star', shape: 'circle', tier: 'key', medal: true };


// ---------------------------------------------------------------- the pictures
// Each patch picture is a white silhouette with one warm accent thread and a few cut lines in the patch colour,
// like the simple shapes on real crew patches. They are drawn in a 40x40 box.
const W = '#fff';
let A = '#ffd27a';   // accent thread; set per patch so it stays readable on the face colour
const f = (d, fill = W) => `<path d="${d}" fill="${fill}"/>`;
const ci = (x, y, r, fill = W) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const el = (x, y, rx, ry, fill = W) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const rc = (x, y, w, h, r, fill = W, t = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${t ? ` transform="${t}"` : ''}/>`;
const ln = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const gear = (cx, cy, r1, r2, n) => { let d = ''; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, w = Math.PI / n * .5; [[r1, a - w * 1.1], [r2, a - w * .6], [r2, a + w * .6], [r1, a + w * 1.1]].forEach(([r, t], j) => { d += (i === 0 && j === 0 ? 'M' : 'L') + (cx + r * Math.cos(t)).toFixed(2) + ' ' + (cy + r * Math.sin(t)).toFixed(2); }); } return d + 'Z'; };
const star = (cx, cy, R, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + q * Math.cos(a)).toFixed(2) + ' ' + (cy + q * Math.sin(a)).toFixed(2); } return d + 'Z'; };
const wedge = (cx, cy, ri, ro, a0, a1) => { const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`; return `M${p(ri, a0)}L${p(ro, a0)}A${ro} ${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri} ${ri} 0 0 0 ${p(ri, a0)}Z`; };
const sparkle = (x, y, r) => f(`M${x} ${y - r}L${x + r * .3} ${y - r * .3}L${x + r} ${y}L${x + r * .3} ${y + r * .3}L${x} ${y + r}L${x - r * .3} ${y + r * .3}L${x - r} ${y}L${x - r * .3} ${y - r * .3}Z`, A);

export const GLYPHS = {
  // astronaut boot: suit leg, locking ring, orange-ish band, boot with a thick treaded sole
  boot: c => f('M14 4h9v14h-9Z') + f('M13 3.5h11v4h-11Z', A) + ln('M14 11h9M14 14h9', c, .8)
    + f('M14 18h9l1.5 4.5c4.500.8 8.500 2.200 8.500 6v2.500H11.500v-3.500c0-1.500 1.500-2 2.500-5.500Z') + ln('M27 25c2 1 4 3 4 5', c, .8)
    + f('M9 31h26v4.5H9Z', A) + ln('M12.5 31v4.5M15 31v4.5M19 31v4.5M23 31v4.5M27 31v4.5M31 31v4.5', c, .9),
  // astronaut mid-jump
  jump: c => ci(20, 9, 5.4) + el(21.2, 9.4, 3.2, 2.6, A) + f('M14.5 16h11a2 2 0 0 1 2 2v9h-15v-9a2 2 0 0 1 2-2Z') + rc(17.5, 19, 5, 3.4, 1, c)
    + ln('M15.5 18 8 9', W, 3.4) + ln('M24.5 18 32 9', W, 3.4) + ci(7.8, 8.4, 2) + ci(32.2, 8.4, 2) + ln('M17.5 27 14 34', W, 3.6) + ln('M22.5 27 27 33', W, 3.6)
    + el(11, 36.6, 5, 1.5, A) + el(29.5, 36.2, 5.5, 1.6, A),
  // ice crystals
  ice: c => `<g transform="rotate(-14 9 26)">` + f('M9 13l4 3.5v12L9 32l-4-3.5v-12Z') + ln('M9 13v19', c, .8) + '</g>' + `<g transform="rotate(14 31 26)">` + f('M31 15l4 3.5v12L31 34l-4-3.5v-12Z') + ln('M31 15v19', c, .8) + '</g>'
    + f('M20 3l6 5v18l-6 6-6-6V8Z') + ln('M20 3v29', c, .9) + ln('M14 8l6 5 6-5', c, .8) + ln('M3 35h34', A, 1.8) + sparkle(33, 6, 2.6),
  // gear, hex nut and a bent plate
  bolt: c => f(gear(15, 20, 8.6, 11.2, 8)) + ci(15, 20, 3.8, c) + f('M31 6l5 2.9v5.8L31 17.6l-5-2.9V8.9Z', A) + ci(31, 11.8, 1.9, c)
    + f('M22 27l14-2 1.2 8-15 3Z') + ci(27, 31, .9, c) + ci(33, 30, .9, c),
  // Perseverance: six wheels, deck, mast with a camera head, arm
  rover: c => ln('M9 27v4M20 27v4M31 27v4', W, 1.4) + ci(9, 31, 3.7) + ci(20, 31, 3.7) + ci(31, 31, 3.7) + ci(9, 31, 1.3, c) + ci(20, 31, 1.3, c) + ci(31, 31, 1.3, c)
    + rc(7, 19, 26, 8, 2) + rc(7, 19, 26, 2.6, 1.2, A) + ln('M26 19V9.5', W, 2.2) + rc(21.5, 4, 9, 5, 1.4) + ci(24.2, 6.5, 1.1, c) + ci(27.8, 6.5, 1.1, c) + ln('M33 23l4 4.5', W, 2) + ci(14, 16.5, 2.4),
  // Ingenuity: two rotors, panel, foil body and spindly legs
  heli: c => rc(13.5, 2.5, 13, 4.2, .8) + ln('M17.8 2.8v3.6M22.2 2.8v3.6', c, .5) + rc(3, 8.5, 34, 2.2, 1.1) + rc(19, 10.7, 2, 5.5, .4)
    + rc(14.5, 16, 11, 9, 3, A) + rc(17.5, 18.5, 5, 3.5, 1, c) + ln('M16 25l-6 9M24 25l6 9M18 25l-1 9.5M22 25l1 9.5', W, 1.2) + ci(9.6, 34.6, 1.1) + ci(30.4, 34.6, 1.1),
  // crew rover
  wheel: c => f('M9 21l2.6-8.5Q12.4 10 15.2 10h9.6q2.8 0 3.6 2.5L31 21Z') + f('M14.5 12.5h11l1.8 6.5H12.7Z', c) + rc(5, 21, 30, 6, 2, A)
    + ci(11, 29.5, 5.2) + ci(29, 29.5, 5.2) + ci(11, 29.5, 2.2, c) + ci(29, 29.5, 2.2, c) + ln('M13 10V5', W, 1.2) + f('M9 4a4.2 3 0 0 0 8.4 0Z'),
  // solar panel with dust and a squeegee
  wipe: c => f('M5 28l6-19h24l-6 19Z') + ln('M17 9 11 28M23 9 17 28M29 9 23 28', c, .7) + ln('M9 15.3h24M7 21.7h22', c, .7)
    + rc(8, 16.5, 24, 3.6, 1.4, A, 'rotate(-12 20 18.3)') + ln('M32 13l4-7', A, 2.6) + ci(13, 25, 1.1, A) + ci(19, 26, 1.3, A) + ci(25, 24.5, 1, A) + ln('M17 28v8M10 36h14', W, 2),
  // Phobos night: crescent, stars and a little base
  moon: c => f('M24 5a12 12 0 1 0 8 19 10 10 0 0 1-8-19Z') + sparkle(10, 8, 2.6) + sparkle(33, 8, 2) + sparkle(31, 18, 1.5) + f('M6 36a6 6 0 0 1 12 0Z') + rc(10.5, 31.5, 2.2, 2.6, .4, c) + ln('M3 36.5h34', A, 1.8),
  // solar flare: sun with rays and a stream of particles
  sun: c => `<g transform="translate(-1 3)">` + [...Array(10)].map((_, i) => { const a = i / 10 * 2 * Math.PI; return ln(`M${(14 + 8.8 * Math.cos(a)).toFixed(1)} ${(14 + 8.8 * Math.sin(a)).toFixed(1)}L${(14 + 12.4 * Math.cos(a)).toFixed(1)} ${(14 + 12.4 * Math.sin(a)).toFixed(1)}`, W, 2); }).join('')
    + ci(14, 14, 6.4) + ci(14, 14, 3.2, A) + f('M28 13h6l-3.5 6.5h5L24 33l3-9.5h-5Z', A) + '</g>',
  // lettuce seedling and a drop of water
  leaf: c => f('M8 30C8 16 17 8 33 8c0 14-8 22-25 22Z') + ln('M8 30 24 15', c, 1.3) + ln('M15 23l-1-6M20 19l-1-6', c, .8) + ln('M4 34.5h22', A, 2) + f('M32 23c2 3 3 4.400 3 6.400a3 3 0 0 1-6 0c0-2 1-3.400 3-6.400Z', A),
  // spanner and hammer crossed
  wrench: c => ln('M8 32 25 15', W, 4.2) + ci(28, 12, 6) + f('M28 12l7.5-4 1.8 3.8-5.8 4.2Z', c) + ln('M32 32 16 16', A, 3.4) + rc(8.5, 11, 12, 6.4, 1.2, W, 'rotate(-45 14.5 14.2)'),
  // sunset over the horizon
  sunset: c => f('M10 27a10 10 0 0 1 20 0Z') + ln('M20 8v4M9 13l3 3M31 13l-3 3M4 21h4M32 21h4', A, 1.8) + ln('M4 29.5h32', W, 2) + ln('M10 33.5h20M14 36.5h12', A, 1.6),
  // launching rocket
  orbit: c => f('M16.500 29c1 7 6 7 7 0Z', A) + f('M15 20 8 29l7-2Zm10 0 7 9-7-2Z', A) + f('M20 4c6 5 7 13 5 24H15c-2-11-1-19 5-24Z') + f('M20 4c2.400 1.900 4 4.200 4.800 6.600h-9.600C16 8.200 17.600 5.900 20 4Z', A) + ci(20, 15.500, 3.200, c) + ci(20, 15.500, 1.400, A),
  // half-buried storm shelter with a radiation sign
  shelter: c => f('M5 32a15 15 0 0 1 30 0Z') + rc(16.5, 23, 7, 9, 2.4, c) + ci(20, 9.5, 3.2, A) + [...Array(8)].map((_, i) => { const a = i / 8 * 2 * Math.PI; return ln(`M${(20 + 5 * Math.cos(a)).toFixed(1)} ${(9.5 + 5 * Math.sin(a)).toFixed(1)}L${(20 + 7 * Math.cos(a)).toFixed(1)} ${(9.5 + 7 * Math.sin(a)).toFixed(1)}`, A, 1.4); }).join('') + ln('M2 34h36', A, 1.8),
  // a camp that grows: three domes of rising size and an arrow
  tier: c => f('M1.500 32a3 3 0 0 1 6 0Z') + f('M7.500 32a6 6 0 0 1 12 0Z') + f('M20 32a9.500 9.500 0 0 1 19 0Z') + ci(13.500, 28, 1.200, c) + ci(29.500, 27, 2, c) + ln('M1 34h38', A, 1.8) + f('M20 3l5 6h-3.500v5h-3V9H15Z', A),
  // cooling tower with steam and a glowing core
  atom: c => ci(15, 5, 3.200) + ci(21, 3.800, 3.600) + ci(26.500, 5.800, 3) + f('M9 35q5-13 4-26h14q-1 13 4 26Z') + ln('M13 9.500h14', c, 1) + ci(20, 27.500, 4.400, A) + ci(20, 27.500, 1.800, c),
  // open logbook with a bookmark
  book: c => f('M3 12c6-2.600 12-1.600 17 2v19c-5-3.600-11-4.600-17-2Z') + f('M37 12c-6-2.600-12-1.600-17 2v19c5-3.600 11-4.600 17-2Z') + ln('M20 14v19', c, 1)
    + ln('M7 17c3-1 6-.8 9 .6M7 21.500c3-1 6-.8 9 .6M24 18c3-1.400 6-1.600 9-.6M24 22.500c3-1.400 6-1.600 9-.6', c, .9) + rc(21.500, 26, 3, 9.500, .4, A),
  // trophy cup
  star: c => ln('M11 8H6q-1 7 6 9.500', W, 2) + ln('M29 8h5q1 7-6 9.500', W, 2) + f('M11 5h18v9c0 6-4 9-9 9s-9-3-9-9Z') + rc(18, 22.500, 4, 6.500, 0) + rc(12, 29, 16, 3.600, 1) + rc(10, 32.600, 20, 3, 1, A) + f(star(20, 13, 5, 2.100), A),
  // survey tower with a glowing beacon
  tower: c => f('M13 36 18.5 12h3L27 36h-3.4l-1.4-6h-4.4l-1.4 6Z') + ln('M15.8 26h8.4M17.2 20h5.6', c, 1) + ci(20, 8.5, 3.2, A) + ln('M20 4V2M14.6 6.5l-2-1.5M25.4 6.5l2-1.5', A, 1.2) + ln('M8 36.5h24', A, 1.8),
  // flag planted on Mars with footprints
  flag: c => ln('M10 35V6', W, 2) + f('M11 7h22l-5 6 5 6H11Z') + f(star(18, 13, 3.600, 1.500), c) + el(17, 35, 3, 1.300, A) + el(24, 33.600, 3, 1.300, A) + ln('M3 37.500h34', A, 1.400),
};

GLYPHS.rocket = GLYPHS.orbit;

const inset = (k) => `translate(20 20) scale(${k}) translate(-20 -20)`;
let uid = 0;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const METAL = { rare: '#d5dbe3', key: '#e2bd48' };
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return .299 * r + .587 * g + .114 * b; };
// the accent thread is warm cream-gold, unless the face is too close to it, then a dark tone of the face colour
const accentFor = h => (214 - lum(h) < 90 ? '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * .36).toString(16).padStart(2, '0')).join('') : '#ffd27a');
const FLAT = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0';

// Draw a patch. locked = an empty slot in the shape of the patch.
// Past about 90 px the patch also shows its number and its name stitched around the bottom.
export function patchSVG(p, locked = false, size = 56, opts = {}) {
  const sh = SHAPES[p.shape] || SHAPES.circle, id = 'pt' + (++uid), detail = size >= 90 && !locked;
  const place = detail ? `translate(20 ${20.4 + sh.gdy * .5}) scale(.4) translate(-20 -20)` : `translate(20 ${20 + sh.dy * .7}) scale(.72) translate(-20 -20)`;
  A = accentFor(p.colour);
  const glyph = (GLYPHS[p.g] || GLYPHS.boot)(p.colour);
  if (locked) {
    return `<svg class="patch locked" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><defs><filter id="${id}s" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .2  0 0 0 0 .22  0 0 0 0 .27  0 0 0 1 0"/></filter></defs>
      <path d="${sh.d}" fill="#14161c" stroke="#3a3e48" stroke-width=".9" stroke-dasharray="2 1.6" stroke-linejoin="round"/>
      <path d="${sh.d}" transform="${inset(.88)}" fill="#0f1116" stroke="#242831" stroke-width=".6"/>
      <g transform="${place}" filter="url(#${id}s)">${glyph}</g>
    </svg>`;
  }
  const tier = p.tier || 'common', rim = tier === 'common' ? sh.rim : METAL[tier];
  const arcR = +sh.arc.split('A')[1].split(' ')[0], name = esc(p.name).toUpperCase(), fs = Math.min(2.6, (Math.PI * arcR * .67) / (name.length * .72)).toFixed(2);
  const num = `No. ${String(PATCHES.findIndex(x => x.id === p.id) + 1).padStart(2, '0')}`;
  return `<svg class="patch" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <pattern id="${id}w" width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.1" height=".5" fill="#000" opacity=".11"/></pattern>
      <filter id="${id}f" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${FLAT}"/></filter>
      <clipPath id="${id}c"><path d="${sh.d}" transform="${inset(.88)}"/></clipPath>
      ${detail ? `<path id="${id}a" d="${sh.arc}" fill="none"/>` : ''}
    </defs>
    <path d="${sh.d}" fill="#000" opacity=".38" transform="translate(.5 .9)"/>
    <path d="${sh.d}" fill="${rim}" stroke="#1d1e28" stroke-width=".8" stroke-linejoin="round"/>
    <path d="${sh.d}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".5" transform="${inset(.955)}" stroke-linejoin="round"/>
    <path d="${sh.d}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".55" stroke-dasharray=".6 .5 .9 .5 .5 .6" transform="${inset(.92)}" stroke-linejoin="round"/>
    <path d="${sh.d}" transform="${inset(.885)}" fill="#1d1e28" stroke-linejoin="round"/>
    <path d="${sh.d}" transform="${inset(.875)}" fill="${p.colour}" stroke-linejoin="round"/>
    <path d="${sh.d}" transform="${inset(.875)}" fill="url(#${id}w)"/>
    <path d="${sh.d}" transform="${inset(.8)} rotate(.5 20 20) translate(.1 -.08)" fill="none" stroke="#fff" stroke-width=".7" stroke-dasharray="1.7 1.1 1.2 1.3 1.9 1 1.4 1.2" opacity=".85" stroke-linejoin="round"/>
    <path class="sew" pathLength="1" d="${sh.d}" transform="${inset(.8)}" fill="none" stroke="#fff6d8" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>
    <g transform="${place}">${glyph}</g>
    ${detail ? `<text font-family="system-ui,sans-serif" font-weight="800" font-size="${fs}" letter-spacing=".3" fill="#fff" stroke="#1d1e28" stroke-opacity=".4" stroke-width=".3" paint-order="stroke" text-anchor="middle"><textPath href="#${id}a" startOffset="50%">${name}</textPath></text>
    <text x="20" y="${sh.numY}" font-family="system-ui,sans-serif" font-weight="800" font-size="2.3" letter-spacing=".4" fill="#fff" fill-opacity=".85" text-anchor="middle">${num}</text>` : ''}
    ${opts.glint ? `<g clip-path="url(#${id}c)"><g transform="rotate(20 20 20)"><rect class="glint" x="-30" y="-5" width="9" height="50" fill="#fff" opacity="0"/></g></g>` : ''}
  </svg>`;
}

// The medal for earning every patch: a gold disc with a beaded rim, laurel wreath and star, hung from a striped ribbon.
export function medalSVG(size = 80, locked = false) {
  const cx = 20, cy = 31, D = '#1d1e28', leaves = (s) => [...Array(7)].map((_, i) => {
    const th = (112 + i * 21) * Math.PI / 180, x = cx + s * 9.3 * Math.cos(th) * (s === 1 ? 1 : 1), y = cy + 9.3 * Math.sin(th), deg = (s === 1 ? 1 : -1) * ((th * 180 / Math.PI) + 90 - 28);
    return `<ellipse cx="${(s === 1 ? x : 2 * cx - (cx + 9.3 * Math.cos(th))).toFixed(2)}" cy="${y.toFixed(2)}" rx="2.7" ry="1.15" fill="#f6dc7e" stroke="#8a6512" stroke-width=".3" transform="rotate(${deg.toFixed(1)} ${(s === 1 ? x : 2 * cx - (cx + 9.3 * Math.cos(th))).toFixed(2)} ${y.toFixed(2)})"/>`;
  }).join('');
  if (locked) return `<svg class="patch locked" viewBox="0 0 40 48" width="${size}" height="${size * 1.2}" aria-hidden="true"><path d="M8 0h10l5 17h-8ZM32 0H22l-5 17h8Z" fill="#14161c" stroke="#3a3e48" stroke-width=".6"/><circle cx="${cx}" cy="${cy}" r="15.5" fill="#14161c" stroke="#3a3e48" stroke-width=".9" stroke-dasharray="2 1.6"/><path d="${star(cx, cy, 7, 3)}" fill="#3a3e48"/></svg>`;
  const strap = (x0, x1) => `<path d="M${x0} -1L${x1} 18" stroke="${D}" stroke-width="10.4" fill="none"/><path d="M${x0} -1L${x1} 18" stroke="#b0303a" stroke-width="9" fill="none"/><path d="M${x0} -1L${x1} 18" stroke="#f4f4f0" stroke-width="5.4" fill="none"/><path d="M${x0} -1L${x1} 18" stroke="#2a4f9e" stroke-width="2.8" fill="none"/>`;
  return `<svg class="patch" viewBox="0 0 40 48" width="${size}" height="${size * 1.2}" aria-hidden="true">
    <defs><clipPath id="mclip"><rect x="0" y="0" width="40" height="13.5"/></clipPath></defs>
    <g clip-path="url(#mclip)">${strap(12.5, 19.5)}${strap(27.5, 20.5)}</g>
    <circle cx="${cx + .6}" cy="${cy + .9}" r="16" fill="#000" opacity=".35"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="#d9ae32" stroke="${D}" stroke-width=".9"/>
    <circle cx="${cx}" cy="${cy}" r="14.3" fill="none" stroke="#f6dc7e" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="0 2.05"/>
    <circle cx="${cx}" cy="${cy}" r="12.2" fill="#c99a26" stroke="#8a6512" stroke-width=".6"/>
    ${leaves(1)}${leaves(-1)}
    <path d="${star(cx + .7, cy + 1.1, 6.4, 2.7)}" fill="#8a6512"/>
    <path d="${star(cx, cy, 6.4, 2.7)}" fill="#fff3c4" stroke="#8a6512" stroke-width=".5" stroke-linejoin="round"/>
    <rect x="14.5" y="10.6" width="11" height="4.2" rx="1.7" fill="#d9ae32" stroke="${D}" stroke-width=".8"/>
    <circle cx="${cx}" cy="16.4" r="2.2" fill="none" stroke="${D}" stroke-width="2.2"/><circle cx="${cx}" cy="16.4" r="2.2" fill="none" stroke="#e8c65a" stroke-width="1.1"/>
    <path d="M6.6 26.6A13.8 13.8 0 0 1 22.6 17.3" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/>
  </svg>`;
}
