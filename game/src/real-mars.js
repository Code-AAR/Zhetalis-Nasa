// "Real Mars" cards: the first time you meet a dust devil or a dust storm, a short card says what really happens on
// Mars, with one Earth-vs-Mars comparison bar. It never pauses the game or takes your keys; "Got it" closes it, and
// each card shows once (remembered in this browser). Numbers come from NASA's Mars Fact Sheet unless noted.
//
// Wind push: F = 1/2 · air density · speed² · drag coefficient (~1.2) · area facing the wind (~1 m²).
// Mars surface air ~0.016 kg/m³, Earth 1.217 kg/m³. At 25 m/s (90 km/h): Mars ≈ 6 N, Earth ≈ 456 N.
const push = (rho, v) => .5 * rho * v * v * 1.2;
const CARDS = {
  'dust-devil': {
    title: 'Dust devils can’t lift you',
    compare: { label: 'Push from a 90 km/h whirlwind', earth: push(1.217, 25), mars: push(.016, 25), unit: 'N', earthName: 'On Earth', marsName: 'On Mars' },
    body: 'Mars air is only about 1% as thick as Earth’s, so even a fast dust devil pushes on you about as hard as holding a small water bottle. It can still hide the view and dust your suit. Spirit filmed hundreds in Gusev Crater, and in 2005 one blew the dust off its solar panels.',
    game: 'In the game: walking into one fills your visor with dust for a moment, and one that crosses your solar panels sweeps them cleaner.',
    source: { text: 'NASA Mars Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' },
  },
  'dust-storm': {
    title: 'Dust storms dim the Sun',
    compare: { label: 'Solar power reaching your panels', earth: 100, mars: 35, unit: '%', earthName: 'Clear sky', marsName: 'This storm' },
    body: 'Storm winds reach 17 to 30 m/s, but in air this thin they feel like a breeze. The danger is darkness: dust blocks sunlight, so solar power drops. In 2018 a storm covered the whole planet and Opportunity never woke up. Dust devils stop too, because the ground no longer heats up.',
    game: 'In the game: the haze closes in and your panels make about a third of their usual power. Dust also piles onto them much faster than on real Mars, so go out and clean them at least twice a sol. Jump, and the wind carries you a few centimetres.',
    source: { text: 'NASA: the fact and fiction of Martian dust storms', url: 'https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/' },
  },
};
const KEY = 'real-mars-seen';
let seen; try { seen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { seen = new Set(); }
let open = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (v, unit) => unit === '%' ? `${Math.round(v)}%` : `${v < 20 ? Math.round(v) : Math.round(v / 10) * 10} ${unit}`;
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 9.5c3 1.2 6.5-.8 9.5.4M7 15c2.6.8 5.2-.6 8.2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

export function hasSeenRealMars(id) { return seen.has(id); }
// Show card `id` once. Returns true if it was shown now.
// Something else is on screen (a patch award, a discovery banner, a pop-up, a cutscene): the card waits its turn.
const busy = () => !!document.querySelector('.pa, .dc, #mission-path, #arrival, #modal:not(.hidden), #fade:not(.hidden)');
let waiting = null;
export function showRealMars(id) {
  const c = CARDS[id]; if (!c || seen.has(id) || open) return false;
  if (busy()) {   // try again shortly; the first card asked for keeps its place
    if (!waiting) { waiting = id; const retry = setInterval(() => { if (busy() || open) return; clearInterval(retry); const w = waiting; waiting = null; showRealMars(w); }, 700); }
    return false;
  }
  seen.add(id); try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch { /* storage blocked: shows again next time */ }
  const max = Math.max(c.compare.earth, c.compare.mars), pct = v => Math.max(1.2, v / max * 100);
  const el = document.createElement('aside'); el.id = 'real-mars'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'rm-title');
  el.innerHTML = `
    <p class="rm-kicker">${ICON}<span>Real Mars</span></p>
    <h2 id="rm-title">${esc(c.title)}</h2>
    <figure class="rm-compare" aria-label="${esc(`${c.compare.label}: ${c.compare.earthName} ${fmt(c.compare.earth, c.compare.unit)}, ${c.compare.marsName} ${fmt(c.compare.mars, c.compare.unit)}`)}">
      <figcaption>${esc(c.compare.label)}</figcaption>
      <div class="rm-row earth"><span>${esc(c.compare.earthName)}</span><i style="--w:${pct(c.compare.earth)}%"></i><b>${fmt(c.compare.earth, c.compare.unit)}</b></div>
      <div class="rm-row mars"><span>${esc(c.compare.marsName)}</span><i style="--w:${pct(c.compare.mars)}%"></i><b>${fmt(c.compare.mars, c.compare.unit)}</b></div>
    </figure>
    <p class="rm-body">${esc(c.body)}</p>
    <p class="rm-game">${esc(c.game)}</p>
    <footer><a href="${c.source.url}" target="_blank" rel="noopener">${esc(c.source.text)}</a><button type="button" class="rm-ok">Got it</button></footer>`;
  document.body.appendChild(el); document.body.classList.add('has-real-mars'); open = el;
  const close = () => { if (open !== el) return; open = null; el.classList.add('closing'); document.body.classList.remove('has-real-mars'); setTimeout(() => el.remove(), 180); };
  el.querySelector('.rm-ok').addEventListener('click', close);
  setTimeout(() => el.classList.add('in'), 20);   // next tick: lets the slide-in transition run
  return true;
}
