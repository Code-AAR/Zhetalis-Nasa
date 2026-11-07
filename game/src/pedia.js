// Mars-pedia: a small encyclopedia inside the game. Short word explanations (written for kids) plus every
// real NASA fact card in data/mars-facts.json, with a search box. Each fact keeps its source link.
import { $, modal, factHTML } from './ui.js';

const WORDS = [
  ['Sol', 'One day on Mars: 24 hours, 39 minutes and 35 seconds - a little longer than a day on Earth.'],
  ['Regolith', 'The loose dust, soil and broken rock that covers Mars. Piling it on a base blocks radiation.'],
  ['Perchlorate', 'A salt found in Mars soil by NASA\'s Phoenix lander. It is harmful to people, so soil must be washed before plants can use it.'],
  ['Water ice', 'Frozen water. Mars has a lot of it in the polar caps and just under the ground in some places.'],
  ['Electrolysis', 'Using electricity to split water into oxygen (to breathe) and hydrogen. The space station makes oxygen this way.'],
  ['Distillation', 'Cleaning water by boiling it and catching the steam, which leaves salt and dirt behind.'],
  ['MOXIE', 'A machine on the Perseverance rover that made oxygen out of the carbon dioxide in Mars air.'],
  ['Millisievert (mSv)', 'A unit for how much radiation your body has taken in. Your radiation badge counts it.'],
  ['Galactic cosmic rays', 'Very fast particles from far-away exploding stars. They are always there and are hard to block.'],
  ['Solar storm', 'A burst of particles thrown out by the Sun. Astronauts hide in a shelter with thick walls until it passes.'],
  ['Dust storm', 'Wind lifting dust into the air. Some cover the whole planet and block sunlight for weeks.'],
  ['Dust devil', 'A small spinning whirlwind of dust. On Mars they sometimes blew dust off rovers\' solar panels.'],
  ['Relay orbiter', 'A spacecraft circling Mars that passes messages between the ground and Earth, like a cell tower in the sky.'],
  ['Deep Space Network', 'NASA\'s giant radio dishes in California, Spain and Australia. They are spread around the world so one can always see Mars as Earth turns.'],
  ['High-gain antenna', 'A dish that sends a strong signal in one direction - it must point at Earth. A low-gain antenna sends a weaker signal in all directions.'],
  ['Solar conjunction', 'When the Sun is between Earth and Mars. It scrambles radio signals, so missions go quiet for about two weeks, about every 26 months.'],
  ['Light-minute', 'How far light travels in one minute. Radio messages between Earth and Mars take about 3 to 22 minutes.'],
  ['Trans-Mars injection', 'The big engine burn that pushes a spacecraft out of orbit around Earth onto its path to Mars.'],
  ['Hohmann transfer', 'A fuel-saving path between two planets: half an oval that touches Earth\'s orbit and Mars\'s orbit. It takes about 8 or 9 months.'],
  ['Launch window', 'The weeks, about every 26 months, when Earth and Mars are lined up so a trip uses the least fuel.'],
  ['Entry, descent and landing', 'The "seven minutes of terror" when a spacecraft slows down from thousands of km/h to land: heat shield, parachute, then rockets.'],
  ['Lava tube', 'A cave left behind when the outside of a lava flow cooled and the hot lava inside drained away. Its rock roof could shield a base.'],
  ['Fission reactor', 'A power plant that makes heat by splitting atoms. It works day and night, even in dust storms.'],
  ['Hydroponics', 'Growing plants in water with nutrients instead of in soil.'],
  ['Phobos and Deimos', 'The two small moons of Mars. Phobos is slowly spiralling closer to Mars.'],
  ['ISRU', 'In-situ resource utilization: using what you find on Mars (ice, air, soil) instead of bringing everything from Earth.'],
];

export function openPedia(F) {
  const facts = Object.values(F).filter(f => f.kid);
  modal({ title: '📖 Mars-pedia', html: `
    <p>Look up a word, or read every real fact in the game. Each fact links to where it comes from.</p>
    <input id="pedia-q" type="search" placeholder="Search: ice, radiation, oxygen…" aria-label="Search the Mars-pedia" autocomplete="off">
    <div id="pedia-list" class="pedia-list"></div>`, choices: [{ label: 'Close', primary: true }] });
  const list = $('#pedia-list'), q = $('#pedia-q');
  const draw = () => {
    // match the start of a word, so 'ice' finds "ice" and "Iceland" but not "twice"
    const t = q.value.trim(), re = new RegExp((/^\w/.test(t) ? '\\b' : '') + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), hit = s => !t || re.test(s);
    const words = WORDS.filter(([w, d]) => hit(w + ' ' + d)).map(([w, d]) => `<div class="pedia-word"><b>${w}</b> ${d}</div>`).join('');
    const cards = facts.filter(f => hit(f.kid + ' ' + f.source)).map(f => factHTML(f, false, true)).join('');
    list.innerHTML = (words ? `<h4>Words</h4>${words}` : '') + (cards ? `<h4>Real facts</h4><div class="log-list">${cards}</div>` : '') ||
      '<p>Nothing found - try another word.</p>';
  };
  q.addEventListener('input', draw);
  draw();
}
