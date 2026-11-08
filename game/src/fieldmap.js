// The Surface operations map: the survey chart sheet, layer tabs, flags, landmarks and distances.
import { drawChart, makeCanvas, chartHeight, chartedShare, LAYERS } from './chart.js';
import { revealCircles, chartedLandmarks, LANDMARKS } from './mapstate.js';

export function fieldMapHTML(world) {
  const ms = world.mapState;
  return `<p>The crater around your outpost, from NASA's 3D model of Spirit's landing site. Blank paper is <b>uncharted</b>: climb a <b>lookout tower</b> (triangles), drive the <b>crew rover</b> or send <b>Ingenuity</b> on a scout flight to chart more. Diamonds are survey finds.</p>
  <div class="fm-tabs" role="group" aria-label="Map layer">${LAYERS.map(([id, name]) => `<button type="button" data-layer="${id}" aria-pressed="${(ms?.layer || 'relief') === id}">${name}</button>`).join('')}</div>
  <div id="fm-wrap" style="display:flex;justify-content:center"></div>
  <div class="fm-actions"><button type="button" id="fm-flag">Plant a flag here (B)</button><span id="fm-stats"></span></div>
  <div id="fm-flags"></div>
  <div id="fm-lm"></div>
  <p>Each first survey stores <b>8 science</b> for transmission to Earth, each new lookout tower <b>4</b> and each survey find <b>3</b>. Take the <b>crew rover</b> for the more distant sites; suit oxygen and the return trip matter.</p>
  <div class="forecast">${forecastHTML(world)}</div>`;
}

function forecastHTML(world) {
  const sites = world.settlement.layout.locations, names = world.settlement.layout.names, p = world.player.position, lo = world.lookouts;
  return Object.entries(sites).filter(([key]) => key !== 'base').map(([key, [x, z]]) => `<div><b>${names[key]}</b><br>${Math.round(Math.hypot(x - p.x, z - p.z))} m away · ${world.settlement.surveys.has(key) ? 'Logged' : 'Awaiting survey'}</div>`).join('')
    + (lo?.spots || []).map((s, i) => `<div><b>Lookout: ${s.name}</b><br>${Math.round(Math.hypot(s.x - p.x, s.z - p.z))} m away · ${lo.got.has(i) ? 'Scanned' : 'Not scanned'}</div>`).join('');
}

// Called straight after the pop-up opens: draws the sheet and wires the buttons.
export function mountFieldMap(world) {
  const ms = world.mapState, wrap = document.getElementById('fm-wrap'); if (!wrap) return;
  const box = wrap.closest('.modal-box'), S = Math.max(300, Math.min(540, (box?.clientWidth || 560) - 40));
  const redraw = () => {
    const circles = revealCircles(world), name = (LAYERS.find(l => l[0] === ms?.layer) || LAYERS[0])[1], cv = makeCanvas(S, chartHeight(S));
    drawChart(cv.getContext('2d'), S, { layer: ms?.layer || 'relief', layerName: name, circles, charted: chartedShare(circles), stamp: world.solLabel?.() || '', overlay: (c, P) => ms?.draw(c, P) });
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Survey chart of the crater with the outpost, survey sites, towers, finds, flags and your position');
    cv.style.maxWidth = '100%'; cv.style.height = 'auto'; wrap.replaceChildren(cv);
    const lo = world.lookouts, finds = ms?.finds || [];
    document.getElementById('fm-stats').textContent = `Towers ${lo?.got.size || 0}/${lo?.spots.length || 0} · Finds ${ms?.found.size || 0}/${finds.length} · Scout flights left ${ms?.scout.left ?? 0}`;
    lists();
  };
  const lists = () => {
    const fl = document.getElementById('fm-flags'); fl.replaceChildren();
    (ms?.flags || []).forEach(f => {
      const row = document.createElement('div'); row.className = 'fm-flag';
      const dot = document.createElement('i'); dot.style.background = f.c;
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = f.n; inp.maxLength = 18; inp.setAttribute('aria-label', 'Flag name'); inp.oninput = () => { f.n = inp.value.trim() || 'Flag'; }; inp.onchange = redraw;
      const d = document.createElement('small'); d.textContent = `${Math.round(Math.hypot(f.x - world.player.position.x, f.z - world.player.position.z))} m away`;
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Take down'; del.onclick = () => { ms.removeFlag(f); redraw(); };
      row.append(dot, inp, d, del); fl.appendChild(row);
    });
    const on = new Set(chartedLandmarks(revealCircles(world)).map(l => l.id)), lm = document.getElementById('fm-lm');
    lm.innerHTML = `<h4>Landmarks charted: ${on.size} of ${LANDMARKS.length}</h4>` + LANDMARKS.map(l => on.has(l.id)
      ? `<details class="fm-lm"><summary>${l.name}</summary><p>${l.fact.kid}</p></details>` : '<div class="fm-lm off">Uncharted</div>').join('');
  };
  document.querySelectorAll('.fm-tabs button').forEach(b => b.onclick = () => { ms.layer = b.dataset.layer; document.querySelectorAll('.fm-tabs button').forEach(x => x.setAttribute('aria-pressed', x === b)); redraw(); });
  document.getElementById('fm-flag').onclick = () => { if (ms?.addFlag()) redraw(); };
  redraw();
}
