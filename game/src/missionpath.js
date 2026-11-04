// "How do we get there?" - an animated, step-by-step diagram of NASA's Artemis system
// (SLS -> Orion -> lunar orbit -> HLS lander -> Moon) and NASA's Moon-to-Mars concept.
import { factHTML } from './ui.js';

const PATHS = {
  launch:   'M110,206 C112,170 128,150 160,140',
  toMoon:   'M160,140 C215,92 272,74 312,98',
  nrho:     'M330,58 C352,58 356,140 330,140 C304,140 308,58 330,58',
  landMoon: 'M330,140 L330,122',
  homeMoon: 'M312,118 C260,170 190,214 132,232',
  toMars:   'M160,140 C330,10 560,40 664,206',
  landMars: 'M690,182 L690,214',
};

// Each step: which path animates, what kids read, and the real-source fact card.
function steps(F) {
  return [
    { path: null, title: 'First the Moon, then Mars', text: "NASA's Artemis missions go to the Moon to practise everything astronauts will need for Mars - like a training ground close to home. Here is how the system works, step by step.", fact: F.moonToMars },
    { path: 'launch', title: '1. SLS launches Orion', text: 'The giant SLS rocket lifts off from Kennedy Space Center in Florida with the Orion capsule (and its crew) on top. The two white boosters drop off after about two minutes, then the orange core stage.', fact: F.sls },
    { path: 'toMoon', title: '2. Off to the Moon', text: "A smaller upper stage gives Orion one big push towards the Moon. The trip takes a few days. Orion is the crew's home for the journey.", fact: F.orion },
    { path: 'nrho', title: '3. A giant loop around the Moon', text: "Orion goes into a huge, stretched loop around the Moon. A lander is already waiting there.", fact: F.nrho },
    { path: 'landMoon', title: '4. Change spaceships: the HLS lander', text: 'Orion cannot land, so it docks with the Human Landing System (HLS). The astronauts float across into the lander, which flies them down to the surface - and later back up to Orion.', fact: F.hls },
    { path: 'homeMoon', title: '5. Home again', text: "Orion brings the crew back to Earth and splashes down in the ocean, slowed by parachutes. In April 2026 Artemis II flew four astronauts around the Moon - real people, not a game!", fact: F.artemis2 },
    { path: 'toMars', title: '6. To Mars: a bigger spaceship', text: "Mars is much farther, so NASA is designing a 'transit habitat' with its own engines - a house that flies. SLS and Orion take the crew up to meet it, then the long trip begins: about 7 months!", fact: F.cruiseDose },
    { path: 'landMars', title: '7. Landing on Mars', text: "In orbit around Mars, the crew moves into a Mars lander that takes them down to the outpost. A return rocket sent ahead of time waits there to lift them back up for the trip home. In our game it is the year 2126 - this plan has become real, and you are the junior astronaut!", fact: F.moonToMars },
  ];
}

export function showMissionPath(F, { from = 0 } = {}) {
  return new Promise(resolve => {
    const list = steps(F);
    let i = from;
    const root = document.createElement('div');
    root.id = 'mission-path';
    root.innerHTML = `
      <div class="mp-box">
        <p class="kicker">HOW DO ASTRONAUTS GET THERE?</p>
        <svg viewBox="0 0 800 300" class="mp-svg" aria-label="Diagram of the journey from Earth to the Moon and Mars">
          <defs><radialGradient id="g-earth"><stop offset="0" stop-color="#7fc4ff"/><stop offset="1" stop-color="#1d5fa8"/></radialGradient>
                <radialGradient id="g-mars"><stop offset="0" stop-color="#ffb07a"/><stop offset="1" stop-color="#a8462a"/></radialGradient></defs>
          ${Object.entries(PATHS).map(([k, d]) => `<path id="p-${k}" d="${d}" class="mp-path"/>`).join('')}
          <circle cx="110" cy="244" r="38" fill="url(#g-earth)"/><text x="110" y="298" class="mp-label">Earth</text>
          <circle cx="330" cy="130" r="13" fill="#bdbdbd"/><text x="330" y="44" class="mp-label">Moon</text>
          <circle cx="690" cy="240" r="30" fill="url(#g-mars)"/><text x="690" y="292" class="mp-label">Mars</text>
          <text id="mp-tag" x="0" y="0" class="mp-tag"></text>
          <circle id="mp-ship" r="6" fill="#ffffff" stroke="#ff7a3d" stroke-width="3"/>
        </svg>
        <h3 id="mp-title"></h3>
        <p id="mp-text"></p>
        <div id="mp-fact"></div>
        <div class="mp-nav"><button id="mp-back">‹ Back</button><span id="mp-count"></span><button id="mp-next" class="primary">Next ›</button><button id="mp-skip">Skip</button></div>
      </div>`;
    document.body.appendChild(root);
    const ship = root.querySelector('#mp-ship'), tag = root.querySelector('#mp-tag');
    const tags = { launch: 'SLS + Orion', toMoon: 'Orion', nrho: 'Lunar orbit (NRHO)', landMoon: 'HLS lander', homeMoon: 'Splashdown', toMars: 'Transit habitat', landMars: 'Mars lander' };
    let raf, t0;

    function render() {
      const s = list[i];
      root.querySelector('#mp-title').textContent = s.title;
      root.querySelector('#mp-text').textContent = s.text;
      root.querySelector('#mp-fact').innerHTML = s.fact ? factHTML(s.fact) : '';
      root.querySelector('#mp-count').textContent = `${i + 1} / ${list.length}`;
      root.querySelector('#mp-back').disabled = i === 0;
      root.querySelector('#mp-next').textContent = i === list.length - 1 ? 'Go to Mars ›' : 'Next ›';
      root.querySelectorAll('.mp-path').forEach(p => p.classList.toggle('active', p.id === 'p-' + s.path));
      // earlier steps stay drawn as "done", so the whole route builds up
      const done = list.slice(0, i).map(x => x.path);
      root.querySelectorAll('.mp-path').forEach(p => p.classList.toggle('done', done.includes(p.id.slice(2))));
      cancelAnimationFrame(raf);
      if (!s.path) { ship.setAttribute('cx', 110); ship.setAttribute('cy', 206); tag.textContent = ''; return; }
      const path = root.querySelector('#p-' + s.path), len = path.getTotalLength();
      t0 = performance.now();
      const loop = now => {
        const k = Math.min(1, ((now - t0) / 2200) % 1.4);   // travel, pause, repeat
        const pt = path.getPointAtLength(len * k);
        ship.setAttribute('cx', pt.x); ship.setAttribute('cy', pt.y);
        tag.setAttribute('x', pt.x + 10); tag.setAttribute('y', pt.y - 10); tag.textContent = tags[s.path];
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const finish = () => { cancelAnimationFrame(raf); root.remove(); resolve(); };
    root.querySelector('#mp-next').onclick = () => { if (i < list.length - 1) { i++; render(); } else finish(); };
    root.querySelector('#mp-back').onclick = () => { if (i > 0) { i--; render(); } };
    root.querySelector('#mp-skip').onclick = finish;
    render();
  });
}
