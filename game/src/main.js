import * as THREE from 'three';
import { Outpost, DIFFICULTY, UPGRADES, TUNED } from './sim.js';
import { loadSpaceWeather, sunToday, pickStormEvent, flareStrength, flareWords } from './spaceweather.js';
import { World } from './world.js';
import { Launch } from './launch.js';
import { $, modal, toast, meter, alerts, factHTML, sourcesHTML, isModalOpen, isPaused, say } from './ui.js';

const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const facts = (await (await fetch('data/mars-facts.json')).json()).facts;
const F = facts;
let weather = { mode: 'archived', flares: [], sources: [] };
const weatherReady = loadSpaceWeather().then(w => { weather = w; showSun(); });

const state = { phase: 'title', difficulty: 'normal', speed: 1 };
let world, launch, outpost, solClock = 0, suit = 1, inside = false, pending = [], tutorialStep = 0;
const queue = [];   // simulation events wait here so pop-ups never land on top of each other

// ---------------- title screen ----------------
const diffBox = $('#difficulties');
for (const [key, d] of Object.entries(DIFFICULTY)) {
  const b = document.createElement('button');
  b.className = 'card' + (key === state.difficulty ? ' selected' : '');
  b.innerHTML = `<b>${d.label}</b><small>${d.blurb}</small>`;
  b.onclick = () => { state.difficulty = key; diffBox.querySelectorAll('.card').forEach(c => c.classList.remove('selected')); b.classList.add('selected'); };
  diffBox.appendChild(b);
}

function showSun() {
  const s = sunToday(weather);
  const tag = s.mode === 'live' ? '<span class="real-tag">LIVE</span>' : '<span class="real-tag archived">ARCHIVED</span>';
  $('#sun-line').innerHTML = s.biggest
    ? `${tag}Real data from NOAA's GOES satellites: the biggest solar flare in the last week was <b>${s.biggest.cls}</b> - ${flareWords(s.biggest.cls)}.`
    : `${tag}Couldn't reach the space-weather satellites right now - the game will use saved real data.`;
}

$('#howto').onclick = () => modal({ title: 'How to play', html: `
  <p><b>Move</b> with WASD or the arrow keys. <b>Look around</b>: click the game, then move the mouse (Esc frees the mouse). <b>Run</b>: Shift. <b>Jump</b>: Space - Mars gravity is weak, so you float!</p>
  <p><b>E</b> uses things: collect ice and metal, salvage the old rover, and go into your outpost.</p>
  <p>Inside the outpost (or press <b>P</b>) you split your <b>power</b> between:</p>
  <p>🫁 <b>Life support</b> - makes oxygen and grows food.<br>📡 <b>Talk to Earth</b> - sends your science home (that earns credits) and brings supply pods.<br>🔬 <b>Science</b> - discoveries that become credits once Earth hears about them.<br>🛡 <b>Shielding</b> - protects you from radiation, especially during solar storms.</p>
  <p>There is never enough power for everything. That is the real puzzle astronauts and NASA mission planners have to solve!</p>` });
$('#data-btn-title').onclick = $('#data-btn').onclick = showData;

function showData() {
  const s = sunToday(weather);
  modal({ title: 'Real NASA data in this game', html: `
    <p>This game uses real science wherever it can. Numbers marked "game balance" are made up so a whole mission fits into a few minutes - they are not measurements.</p>
    <h4>Space weather (solar storms)</h4>
    ${sourcesHTML(weather.sources)}
    <p class="source">Right now: ${s.count} flares in the last 7 days; biggest ${s.biggest ? s.biggest.cls : 'unknown'}; radiation-storm level S${s.radiationStorm ?? '?'} on NOAA's 0-5 scale. Every solar storm in the game is based on one of these real flares.</p>
    <h4>Mars and astronaut health</h4>
    ${Object.values(F).map(f => `<p class="source">• ${f.kid} - <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></p>`).join('')}
    <h4>3D models</h4>
    <p class="source">• Perseverance rover: <a href="https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/" target="_blank" rel="noopener">NASA/JPL-Caltech</a>. Terrain colours based on Perseverance's photos of Jezero Crater.</p>
    <h4>Game balance (not real measurements)</h4>
    <p class="source">• 1 sol passes in ${TUNED.solSeconds} seconds. • Each solar panel makes ${TUNED.kWhPerPanel} kWh per clear sol. • Solar storms are made stronger than real ones so you can see shielding matter in one game. • Supply pods arrive in a few sols (real cargo takes about 7 months).</p>` });
}

$('#start').onclick = async () => {
  $('#title').classList.add('hidden');
  state.phase = 'launch';
  launch = new Launch();
  say('countdown');
  $('#countdown').classList.remove('hidden');
  const skip = document.createElement('button'); skip.textContent = 'Skip launch ›'; skip.id = 'skip';
  Object.assign(skip.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: 5 });
  skip.onclick = () => (launch.done = true); document.body.appendChild(skip);
  buildWorld(); // start loading Mars in the background during the countdown
};

function buildWorld() {
  world = new World(renderer, F, () => {});
  outpost = new Outpost(state.difficulty, F);
  world.setPanels(outpost.panels);
  world.setLink(outpost.today.link);
}

// ---------------- arrival on Mars ----------------
async function arrive() {
  $('#countdown').classList.add('hidden'); $('#skip')?.remove();
  const fade = $('#fade'); fade.classList.remove('hidden');
  fade.innerHTML = `<p>Seven months later…<br><br>On the trip, your crew soaked up about <b>${F.cruiseDose.value} mSv of radiation every day</b> - about 3 times more than on the surface of Mars.<br><br><span class="source">Source: ${F.cruiseDose.source}</span></p>`;
  await new Promise(r => setTimeout(r, 4200));
  await weatherReady;
  fade.classList.add('hidden');
  state.phase = 'mars';
  $('#hud').classList.remove('hidden');
  say('welcome');
  modal({ title: 'Welcome to Mars, junior astronaut!', html: `
    <p>Your outpost is right in front of you. Inside it, you choose how to share out the power from the solar panels.</p>
    ${factHTML(F.sol)}
    <p>Your mission: keep the crew alive for <b>${outpost.d.sols} sols</b>. Watch your <b>oxygen</b>, <b>food</b> and <b>radiation badge</b>.</p>
    <p>Walk to the glowing green door and press <b>E</b> to go inside.</p>`,
    choices: [{ label: "Let's go!", primary: true }] });
}

// ---------------- inside the outpost: the power trade-off ----------------
function openPower() {
  if (!outpost || outpost.over) return;
  const s = outpost.split;
  const rows = [['life', '🫁 Life support'], ['comms', '📡 Talk to Earth'], ['science', '🔬 Science'], ['shield', '🛡 Shielding']];
  const html = `
    <p>You have <b>${outpost.energy().toFixed(0)} kWh</b> of power for each sol${outpost.dust ? ' (a dust storm is blocking the sunlight!)' : ''}. Move the sliders - the total always stays 100%.</p>
    ${rows.map(([k, label]) => `<div class="split-row"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" data-k="${k}"><b id="v-${k}">${Math.round(s[k] * 100)}%</b></div>`).join('')}
    <div class="forecast" id="forecast"></div>
    ${factHTML(F.sunlight)}
    <h4>Upgrades (you have ${outpost.credits} credits)</h4>
    <div class="shop">${Object.entries(UPGRADES).map(([k, u]) => `<button data-buy="${k}" ${outpost.credits < u.cost ? 'disabled' : ''}><span><b>${u.name}</b><small>${u.desc}</small></span><b>${u.cost}</b></button>`).join('')}</div>`;
  // Inside the outpost time keeps running (you are protected and your suit refills);
  // the remote power panel used outside pauses the game so kids can think.
  const close = modal({ title: inside ? '🏠 Inside your outpost - time is passing' : '⚡ Power control (game paused)', pause: !inside, html,
    choices: [{ label: inside ? 'Go back outside' : 'Close', primary: true, onPick: () => { if (inside) goOutside(); } }] });
  const box = $('#modal .modal-box');
  const sliders = [...box.querySelectorAll('input[type=range]')];
  const draw = () => {
    const f = outpost.today;
    const sign = v => (v >= 0 ? `<span class="pos">+${v.toFixed(2)}</span>` : `<span class="neg">${v.toFixed(2)}</span>`);
    box.querySelector('#forecast').innerHTML = `
      <div>Oxygen each sol: ${sign(f.o2Net)} kg<br><small>Crew breathes ${outpost.o2Need.toFixed(2)} kg (${outpost.crew} × ${F.oxygen.value} kg)</small></div>
      <div>Food each sol: ${sign(f.foodNet)} meals</div>
      <div>Earth link: ${f.link ? '<span class="pos">ON</span>' : '<span class="neg">OFF</span>'}<br><small>needs ${TUNED.commsNeedKWh} kWh${outpost.blackout ? ' - blocked by the Sun!' : ''}</small></div>
      <div>Radiation inside: ${f.dose.toFixed(2)} mSv/sol<br><small>${Math.round(f.protection * 100)}% blocked</small></div>
      <div>Science: +${f.science.toFixed(1)}/sol<br><small>${f.link ? 'sent to Earth = credits' : 'stuck here until the link is on'}</small></div>`;
    rows.forEach(([k]) => (box.querySelector('#v-' + k).textContent = Math.round(outpost.split[k] * 100) + '%'));
  };
  sliders.forEach(sl => sl.oninput = () => {
    // Moving one slider takes the difference evenly from the others, so the total is always 100%.
    const k = sl.dataset.k, want = sl.value / 100, others = rows.map(r => r[0]).filter(x => x !== k);
    const rest = others.reduce((a, o) => a + outpost.split[o], 0) || 1;
    const next = { [k]: want };
    others.forEach(o => (next[o] = (1 - want) * (outpost.split[o] / rest || 1 / others.length)));
    outpost.setSplit(next);
    sliders.forEach(x => { if (x !== sl) x.value = Math.round(outpost.split[x.dataset.k] * 100); });
    draw();
  });
  box.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const key = b.dataset.buy;
    if (outpost.buy(key)) {
      toast(`Bought: ${UPGRADES[key].name}`);
      world.setPanels(outpost.panels); world.setWall(outpost.upgrades.wall);
      close(); openPower();
    }
  });
  draw();
}

// ---------------- events from the simulation ----------------
function handle(ev) {
  switch (ev.type) {
    case 'solar-storm-warning': {
      const real = pickStormEvent(weather);
      const strength = Math.max(0.6, flareStrength(real.cls));
      outpost.startStorm(strength, real.cls, real.real);
      const when = real.time ? new Date(real.time).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      say('storm');
      modal({ title: '☀️ Solar storm warning!', html: `
        <p>The Sun just shot out ${flareWords(real.cls)}. Fast particles are on their way - they will hit Mars for about ${outpost.storm.sols} sols.</p>
        ${real.real ? `<p class="fact"><span class="real-tag">REAL</span>This storm is based on a real <b>${real.cls}</b> flare seen by ${real.source}${when ? ' on ' + when : ''}.</p>` : ''}
        <p>What do you do?</p>`,
        choices: [
          { label: '🏠 Hide in the storm shelter', cost: `Safest. But no science and no going outside for ${outpost.storm.sols} sols.`, onPick: () => { outpost.shelter = outpost.storm.sols; if (!inside) toast('Head back to the outpost - the shelter only works inside!'); } },
          { label: '🛡 Put more power into shielding', cost: 'Takes power away from science and talking to Earth.', onPick: () => { outpost.setSplit({ ...outpost.split, shield: Math.max(outpost.split.shield, 0.45), science: outpost.split.science * 0.4, comms: outpost.split.comms * 0.8 }); openPower(); } },
          { label: '⛏ Keep working and hope for the best', cost: 'You keep everything running - but your radiation badge will fill up much faster.' },
        ] });
      break;
    }
    case 'storm-end': toast('☀️ The solar storm has passed.'); break;
    case 'dust':
      world.setDust(true); outpost.today = outpost.forecast(); say('dust');
      modal({ title: '🌪 Dust storm!', html: `<p>Dust is blocking the sunlight. Your solar panels only make about a third of their normal power for ${ev.sols} sols.</p>${factHTML(F.dustStorm)}`,
        choices: [{ label: 'Open power control', primary: true, onPick: openPower }, { label: "I'll manage" }] });
      break;
    case 'dust-end': world.setDust(false); toast('🌤 The dust storm is over - full power again!'); break;
    case 'conjunction': say('conjunction'); modal({ title: '📵 The Sun is in the way!', html: `${factHTML(F.conjunction)}<p>No supply pods and no credits from science until it passes. Your science waits safely until then.</p>` }); break;
    case 'blackout-end': toast('📡 Earth can hear you again!'); break;
    case 'supply-launched':
      say('supply');
      toast(`📡 Earth heard you (your message took ${ev.delay.toFixed(1)} minutes to get there). A supply pod is coming!`, 5000);
      pending.push({ sol: outpost.sol + 3, type: 'pod' }); break;
    case 'supply-missed': toast('📡 Earth couldn\'t hear you - not enough power for the radio. No supply pod this time.', 5000); break;
  }
}

function goInside() { inside = true; world.player.visible = false; openPower(); }
function goOutside() {
  inside = false; world.player.visible = true;
  world.player.position.set(0, 0, 10.5); world.yaw = Math.PI; // step out with the outpost in view
  if (outpost.shelter) toast('⚠️ The solar storm is still going - you are not protected out here!', 4500);
}

function collect(n) {
  if (n.type === 'door') { goInside(); return; }
  if (n.type === 'rover') {
    world.rover.salvaged = true; outpost.credits += 60; say('rover');
    world.rover.group.children[0].visible = false; // switch off its beacon
    modal({ title: '🤖 You found an old rover!', html: `${factHTML(F.perseverance)}${factHTML(F.moxie)}<p>You salvage spare parts worth <b>60 credits</b>.</p>` });
    return;
  }
  const p = n.pickup; world.removePickup(p);
  if (p.kind === 'ice') { outpost.o2 += 6; toast('🧊 Ice! Splitting water makes oxygen: +6 kg oxygen'); }
  if (p.kind === 'metal') { outpost.credits += 10; toast('🔩 Useful metal: +10 credits'); }
  if (p.kind === 'pod') { outpost.o2 += 15; outpost.food += 20; outpost.credits += 25; toast('📦 Supplies from Earth: +15 kg oxygen, +20 meals, +25 credits'); }
}

function endMission() {
  document.exitPointerLock?.();
  const o = outpost.over;
  say(o.win ? 'win' : 'lose');
  const why = {
    complete: `You kept your crew alive for all ${outpost.d.sols} sols. Mission complete!`,
    oxygen: 'The oxygen ran out. Next time give life support more power, or collect more ice to make oxygen.',
    food: 'The crew ran out of food. The greenhouse needs power from life support - or supply pods from Earth.',
    radiation: `Your radiation badge reached NASA's ${F.careerLimit.value} mSv limit, so the crew had to go home. Try more shielding, or hiding in the shelter during solar storms.`,
  }[o.why];
  modal({ title: o.win ? '🏆 Mission complete!' : '🚀 Mission over', html: `
    <p>${why}</p>
    <p>Sols survived: <b>${outpost.sol}</b> · Science sent to Earth: <b>${outpost.scienceSent}</b> · Radiation: <b>${outpost.dose.toFixed(0)} mSv</b> · Score: <b>${outpost.score()}</b></p>
    ${factHTML(F.roundTrip)}`,
    choices: [{ label: 'Play again', primary: true, onPick: () => location.reload() }] });
}

// ---------------- input ----------------
addEventListener('keydown', e => {
  if (world) world.keys[e.code] = true;
  if (state.phase !== 'mars' || isModalOpen()) return;
  if (e.code === 'KeyE') { const n = world.nearest(); if (n) collect(n); }
  if (e.code === 'KeyP') openPower();
});
addEventListener('keyup', e => { if (world) world.keys[e.code] = false; });
$('#view').addEventListener('click', () => { if (state.phase === 'mars' && !isModalOpen()) $('#view').requestPointerLock?.(); });
addEventListener('mousemove', e => {
  if (!world || document.pointerLockElement !== $('#view')) return;
  world.yaw -= e.movementX * 0.0032;
  world.pitch = Math.max(-0.15, Math.min(1.2, world.pitch + e.movementY * 0.0025));
});
$('#power-btn').onclick = openPower;
$('#speed-btn').onclick = () => { state.speed = state.speed === 1 ? 3 : 1; $('#speed-btn').textContent = 'Speed ×' + state.speed; };
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); world?.resize(); launch?.resize(); });

// ---------------- HUD ----------------
function drawHUD() {
  const o = outpost, f = o.today;
  meter('#m-o2', o.o2 / 60, `${o.o2.toFixed(1)} kg · ${f.o2Net >= 0 ? 'steady' : Math.floor(o.o2 / -f.o2Net) + ' sols left'}`);
  meter('#m-food', o.food / 60, `${o.food.toFixed(0)} meals · ${f.foodNet >= 0 ? 'steady' : Math.floor(o.food / -f.foodNet) + ' sols left'}`);
  meter('#m-power', f.energy / (o.panels * TUNED.kWhPerPanel), `${f.energy.toFixed(0)} kWh${o.dust ? ' - dust storm!' : ''}`);
  meter('#m-rad', o.dose / o.limit, `${o.dose.toFixed(1)} of ${o.limit} mSv`, true);
  $('#m-suit').classList.toggle('hidden', inside);
  meter('#m-suit', suit, `${Math.round(suit * o.suitSeconds())} s of air left`);
  $('#sol').textContent = `Sol ${o.sol} of ${o.d.sols}`;
  $('#credits').textContent = `${o.credits} credits${o.science >= 1 ? ` · ${Math.floor(o.science)} science waiting` : ''}`;
  $('#link').textContent = f.link ? `📡 Earth link on · messages take ${o.delayMinutes().toFixed(1)} min` : (o.blackout ? '📵 Sun blocking the radio' : '📡 Earth link OFF (needs more power)');
  const list = [];
  if (o.storm) list.push({ text: `☀️ Solar storm! ${o.shelter ? 'Sheltering' : 'Get inside or shield up!'}` });
  if (o.dust) list.push({ text: `🌪 Dust storm: ${o.dust} sols left` });
  if (f.o2Net < 0 && o.o2 / -f.o2Net < 8) list.push({ text: '🫁 Oxygen running low - more power to life support!' });
  if (!inside && suit < 0.3) list.push({ text: '🧑‍🚀 Suit air low - go back inside!' });
  alerts(list);
  const n = world.nearest();
  const names = { door: 'go inside the outpost', rover: 'salvage the old rover', ice: 'collect ice', metal: 'collect metal', pod: 'open the supply pod' };
  $('#hint').textContent = isModalOpen() ? '' : n ? `Press E to ${names[n.type]}` : (tutorialStep === 0 ? 'Walk to the outpost door (green light) · click the game to look around' : '');
}

// Testing helper for the team: open the game with #debug in the address, then use
// game.event('solar-storm-warning'), game.event('dust', {sols: 5}), game.outpost.credits = 500 ...
if (location.hash === '#debug') window.game = { get outpost() { return outpost; }, get world() { return world; }, event: (type, extra = {}) => queue.push({ type, ...extra }) };

// ---------------- main loop ----------------
const clock = new THREE.Clock();
$('#loading').classList.add('hidden');
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.phase === 'launch') {
    const { left, lifted } = launch.update(dt);
    $('#countdown').innerHTML = lifted ? 'LIFT-OFF!<small>Next stop: Mars</small>' : `${Math.max(0, left)}<small>${left > 3 ? 'Systems check…' : 'Engines igniting!'}</small>`;
    renderer.render(launch.scene, launch.camera);
    if (launch.done) { state.phase = 'cruise'; arrive(); }
    return;
  }
  if (state.phase === 'mars' && world) {
    const paused = isPaused();
    world.update(dt, !isModalOpen() && !inside);
    if (!paused && !outpost.over) {
      const step = dt * state.speed;
      solClock += step;
      if (world.nearest()?.type === 'door') tutorialStep = 1;
      if (!inside) {
        // Outside, the suit uses air and the outpost's shielding isn't protecting you.
        suit -= step / outpost.suitSeconds();
        const f = outpost.today, perSol = step / TUNED.solSeconds;
        outpost.dose += F.surfaceDose.value * f.protection * perSol;   // the part the shield would have blocked
        if (outpost.storm) outpost.dose += outpost.storm.strength * TUNED.stormDose / outpost.storm.total * perSol * f.protection;
        if (suit <= 0) {
          suit = 1; outpost.credits = Math.max(0, outpost.credits - 15);
          modal({ title: '🆘 Out of suit air!', html: '<p>Your crewmates came out and carried you back inside just in time. It cost 15 credits of spare air tanks. Keep an eye on your suit meter!</p>', onClose: goInside });
        }
      } else suit = Math.min(1, suit + step * 0.25);
      if (solClock >= TUNED.solSeconds) {
        solClock -= TUNED.solSeconds;
        queue.push(...outpost.tick());
        pending = pending.filter(p => { if (p.sol <= outpost.sol) { world.dropSupplyPod(); toast('📦 A supply pod landed near the outpost - follow the orange beam!'); return false; } return true; });
        world.setLink(outpost.today.link);
        if (outpost.over) { queue.length = 0; endMission(); }
      }
    }
    // One event at a time; after it, go back to the outpost panel if you were inside.
    if (!isPaused() && queue.length && !outpost.over) handle(queue.shift());
    if (inside && !isModalOpen() && !outpost.over) openPower();
    drawHUD();
    renderer.render(world.scene, world.camera);
    return;
  }
  // title / cruise: slow pan over Mars once it exists, otherwise a dark background
  if (world) { world.yaw += dt * 0.05; world.update(dt, false); renderer.render(world.scene, world.camera); }
  else renderer.clear();
});
