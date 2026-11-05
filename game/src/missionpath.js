// "How do we get there?" - an animated, step-by-step diagram of NASA's Artemis system
// (SLS -> Orion -> lunar orbit -> HLS lander -> Moon) and NASA's Moon-to-Mars concept.
import { factHTML } from './ui.js';
import { loadLaunchPhoto, dateWords } from './nasaimages.js';
import { earthGlobe, moonGlobe } from './globe.js';

const PATHS = {
  launch:   'M110,206 C112,170 128,150 160,140',
  toMoon:   'M160,140 C215,92 272,74 312,98',
  nrho:     'M330,58 C352,58 356,140 330,140 C304,140 308,58 330,58',
  landMoon: 'M330,140 L330,122',
  homeMoon: 'M312,118 C260,170 190,214 132,232',
  toMars:   'M160,140 C330,10 560,40 664,206',
  landMars: 'M690,182 L690,214',
};

// A Hohmann transfer, seen from above the Sun: leave Earth, coast half an ellipse, meet Mars.
// Mars moves about 136° while you travel, so it has to be that far ahead when you launch.
const HOHMANN = `
  <svg viewBox="0 0 260 160" class="mp-hohmann" aria-label="Diagram of a Hohmann transfer from Earth to Mars">
    <circle cx="110" cy="80" r="40" class="orb"/><circle cx="110" cy="80" r="62" class="orb"/>
    <path d="M70,80 A51,50 0 0 1 172,80" class="hop"/>
    <circle cx="110" cy="80" r="9" fill="#ffd27a"/><text x="110" y="104" class="lab">Sun</text>
    <circle cx="70" cy="80" r="6" fill="#4f9be8"/><text x="70" y="100" class="lab">Earth at launch</text>
    <circle cx="65" cy="37" r="5" fill="#c9774a" opacity=".45"/><text x="40" y="24" class="lab">Mars at launch</text>
    <circle cx="172" cy="80" r="6" fill="#e0703d"/><text x="200" y="100" class="lab">Mars on arrival</text>
    <text x="198" y="30" class="lab hl">7 to 9 months</text>
  </svg>`;

// Earth and the Moon as real 3D globes you can spin (NASA Blue Marble and LRO maps).
const GLOBES = `<div class="mp-globes">
  <figure><canvas aria-label="3D Earth - drag to spin"></canvas><figcaption>Earth</figcaption></figure>
  <figure class="moon"><canvas aria-label="3D Moon - drag to spin"></canvas><figcaption>The Moon <small>about ¼ of Earth's width</small></figcaption></figure>
  <p class="spin-tip">Drag either one to spin it</p></div>`;

// Each step: which path animates, what kids read, and the real-source fact card.
function steps(F) {
  // Five short slides (each one also draws the earlier legs of the trip, listed in "also").
  return [
    { path: null, title: 'First the Moon, then Mars', text: "NASA's Artemis missions practise at the Moon first - a training ground a few days from home - before the long trip to Mars.", fact: F.moonToMars },
    { path: 'toMoon', also: ['launch'], title: '1. SLS sends Orion to the Moon', text: 'The giant SLS rocket launches the Orion capsule from Florida. One last push sends the crew on a three-day trip to the Moon.', photo: true, fact: F.orion },
    { path: 'landMoon', also: ['nrho', 'homeMoon'], globes: true, title: '2. Practise at the Moon', text: 'Orion loops around the Moon, a lander takes the crew down and back up, then Orion flies them home. In April 2026 Artemis II flew four astronauts around the Moon!', fact: F.artemis2 },
    { path: null, title: '3. Wait for the launch window', text: "Mars is moving, so you aim for where it WILL be. Earth and Mars line up for this only about every 26 months.", fact: F.launchWindow, extra: HOHMANN },
    { path: 'toMars', also: ['landMars'], title: '4. The long trip to Mars', text: "About 7 months in a spaceship with its own engines, then a lander takes the crew down. In our story it is 2126 - and you are the junior astronaut!", fact: F.cruiseDose },
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
      root.querySelector('#mp-fact').innerHTML = (s.photo ? '<figure class="slide mp-photo" id="mp-photo"><figcaption>Loading a real NASA photo…</figcaption></figure>' : '') + (s.globes ? GLOBES : '') + (s.extra || '') + (s.fact ? factHTML(s.fact) : '');
      if (s.globes) { const c = root.querySelectorAll('.mp-globes canvas'); earthGlobe(c[0]); moonGlobe(c[1]); }
      if (s.photo) loadLaunchPhoto().then(p => {
        const fig = root.querySelector('#mp-photo'); if (!fig) return;
        if (!p) return fig.remove();
        const tag = p.mode === 'live' ? '<span class="real-tag">LIVE</span>' : '<span class="real-tag archived">ARCHIVED</span>';
        fig.innerHTML = `<img src="${p.src}" alt="${p.title}"><figcaption>${tag}<b>This really happened:</b> ${p.title}, ${dateWords(p.when)}. Photo: <a href="${p.link}" target="_blank" rel="noopener">${p.credit}</a></figcaption>`;
      });
      root.querySelector('#mp-count').textContent = `${i + 1} / ${list.length}`;
      root.querySelector('#mp-back').disabled = i === 0;
      root.querySelector('#mp-next').textContent = i === list.length - 1 ? 'Go to Mars ›' : 'Next ›';
      root.querySelectorAll('.mp-path').forEach(p => p.classList.toggle('active', p.id === 'p-' + s.path));
      // earlier steps stay drawn as "done", so the whole route builds up
      const done = [...list.slice(0, i).flatMap(x => [x.path, ...(x.also || [])]), ...(s.also || [])];
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
