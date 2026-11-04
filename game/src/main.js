import * as THREE from 'three';
import { Outpost, DIFFICULTY, UPGRADES, TUNED } from './sim.js';
import { loadSpaceWeather, sunToday, pickStormEvent, flareStrength, flareWords } from './spaceweather.js';
import { World } from './world.js';
import { Launch } from './launch.js';
import { Interior } from './interior.js';
import { showMissionPath } from './missionpath.js';
import { $, modal, toast, meter, alerts, factHTML, sourcesHTML, isModalOpen, isPaused, say } from './ui.js';

const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const F = (await (await fetch('data/mars-facts.json')).json()).facts;
let weather = { mode: 'archived', flares: [], sources: [] };
const weatherReady = loadSpaceWeather().then(w => { weather = w; showSun(); });

const state = { phase: 'title', difficulty: 'normal', speed: 1 };
let world, launch, interior, outpost, solClock = 0, suit = 1, inside = false, pending = [], tutorialStep = 0;
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
  <p><b>V</b> switches between first-person (through your helmet) and third-person view.</p>
  <p><b>E</b> uses things: collect ice and metal parts, salvage the old rover, open supply pods, and go through the outpost door.</p>
  <p>Inside the outpost, walk to the <b>power console</b> to split your power between:</p>
  <p>🫁 <b>Life support</b> - makes oxygen and grows food.<br>📡 <b>Talk to Earth</b> - sends your science home and brings supply pods.<br>🔬 <b>Science</b> - when Earth receives enough, its engineers radio you new <b>upgrade designs</b>.<br>🛡 <b>Shielding</b> - protects you from radiation, especially during solar storms.</p>
  <p>Build the designs at the <b>workbench</b> using <b>parts</b> you salvage outside. There is never enough power for everything - that is the real puzzle astronauts and NASA mission planners solve!</p>` });
$('#data-btn-title').onclick = $('#data-btn').onclick = showData;
$('#path-btn').onclick = () => showMissionPath(F);

function showData() {
  const s = sunToday(weather);
  modal({ title: 'Real NASA data in this game', html: `
    <p>This game uses real science wherever it can. Numbers marked "game balance" are made up so a whole mission fits into a few minutes - they are not measurements.</p>
    <h4>Space weather (solar storms)</h4>
    ${sourcesHTML(weather.sources)}
    <p class="source">Right now: ${s.count} flares in the last 7 days; biggest ${s.biggest ? s.biggest.cls : 'unknown'}; radiation-storm level S${s.radiationStorm ?? '?'} on NOAA's 0-5 scale. Every solar storm in the game is based on one of these real flares.</p>
    <h4>Mars, spaceflight and astronaut health</h4>
    ${Object.values(F).map(f => `<p class="source">• ${f.kid} - <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></p>`).join('')}
    <h4>3D models</h4>
    <p class="source">• Perseverance rover: <a href="https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/" target="_blank" rel="noopener">NASA/JPL-Caltech</a>. Terrain colours based on Perseverance's photos of Jezero Crater. The SLS rocket is a simplified model made for this game.</p>
    <h4>Game balance (not real measurements)</h4>
    <p class="source">• 1 sol passes in ${TUNED.solSeconds} seconds. • Each solar panel makes ${TUNED.kWhPerPanel} kWh per clear sol. • Solar storms are made stronger than real ones so you can see shielding matter in one game. • Supply pods arrive in a few sols (real cargo takes about 7 months). • Upgrade design and parts numbers are made up.</p>` });
}

$('#start').onclick = () => {
  $('#title').classList.add('hidden');
  state.phase = 'launch';
  launch = new Launch();
  say('countdown');
  $('#countdown').classList.remove('hidden');
  const skip = document.createElement('button'); skip.textContent = 'Skip launch ›'; skip.id = 'skip';
  Object.assign(skip.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: 5 });
  skip.onclick = () => (launch.done = true); document.body.appendChild(skip);
  buildWorld(); // start building Mars in the background during the countdown
};

function buildWorld() {
  world = new World(renderer, F, () => {});
  interior = new Interior();
  outpost = new Outpost(state.difficulty, F);
  world.setPanels(outpost.panels);
  world.setLink(outpost.today.link);
}

// ---------------- after lift-off: how we get there, then arrival ----------------
async function arrive() {
  $('#countdown').classList.add('hidden'); $('#skip')?.remove();
  await showMissionPath(F);
  const fade = $('#fade'); fade.classList.remove('hidden');
  fade.innerHTML = `<p>Seven months later…<br><br>On the trip, your crew soaked up about <b>${F.cruiseDose.value} mSv of radiation every day</b> - about 3 times more than on the surface of Mars.<br><br><span class="source">Source: ${F.cruiseDose.source}</span></p>`;
  await new Promise(r => setTimeout(r, 4200));
  await weatherReady;
  fade.classList.add('hidden');
  state.phase = 'mars';
  $('#hud').classList.remove('hidden');
  say('welcome');
  modal({ title: 'Welcome to Mars, junior astronaut!', html: `
    <p>Your outpost is right in front of you. Inside, the <b>power console</b> decides how to share out the power from the solar panels.</p>
    ${factHTML(F.sol)}
    <p>Your mission: keep the crew alive for <b>${outpost.d.sols} sols</b>. Watch your <b>oxygen</b>, <b>food</b> and <b>radiation badge</b>.</p>
    <p>Walk to the glowing green door and press <b>E</b> to go inside. Press <b>V</b> any time to see through your own helmet.</p>`,
    choices: [{ label: "Let's go!", primary: true }] });
}

// ---------------- inside the outpost ----------------
function goInside() {
  inside = true; interior.enter(); document.exitPointerLock?.();
  toast('🏠 Inside the outpost: you are shielded and your suit refills. Walk to the stations and press E.', 4500);
}
function goOutside() {
  inside = false;
  world.player.position.set(0, 0, 10.5); world.yaw = 0; world.lookPitch = 0; // step out of the door, facing away from it
  if (!world.firstPerson) world.yaw = Math.PI;
  if (outpost.shelter) toast('⚠️ The solar storm is still going - you are not protected out here!', 4500);
}

function stationAction(s) {
  if (s.type === 'exit') return goOutside();
  if (s.type === 'console') return openPower();
  if (s.type === 'workbench') return openWorkbench();
  if (s.type === 'greenhouse') return modal({ pause: false, title: '🌱 The greenhouse', html: `<p>Plants here grow your food. They need light and warmth, so they use <b>life-support power</b>. Right now they make <b>${outpost.today.food.toFixed(1)} meals</b> each sol and your crew eats <b>${outpost.crew}</b>.</p>${factHTML(F.farming)}` });
  if (s.type === 'shelter') return modal({ pause: false, title: '🛏 Storm shelter', html: `<p>During a solar storm, the crew squeezes into this small room with the thickest walls. It blocks most of the radiation - but nobody can do science or go outside.</p><p>${outpost.storm ? (outpost.shelter ? `<b>Sheltering now:</b> ${outpost.shelter} sols left.` : '<b>A solar storm is happening!</b> Choosing "hide in the shelter" in the warning keeps you safe.') : 'No storm right now.'}</p>${factHTML(F.careerLimit)}` });
  if (s.type === 'window') return modal({ pause: false, title: '🪟 The view', html: `<p>Outside it is about <b>${F.temperature.value} °C</b>, the air is far too thin to breathe and it is mostly carbon dioxide.</p>${factHTML(F.air)}${factHTML(F.temperature)}` });
}

// ---------------- the power trade-off ----------------
function openPower() {
  if (!outpost || outpost.over) return;
  const s = outpost.split;
  const rows = [['life', '🫁 Life support'], ['comms', '📡 Talk to Earth'], ['science', '🔬 Science'], ['shield', '🛡 Shielding']];
  const next = Object.entries(UPGRADES).filter(([k]) => !outpost.unlocked(k)).sort((a, b) => a[1].unlockAt - b[1].unlockAt)[0];
  const html = `
    <p>You have <b>${outpost.energy().toFixed(0)} kWh</b> of power for each sol${outpost.dust ? ' (a dust storm is blocking the sunlight!)' : ''}. Move the sliders - the total always stays 100%.</p>
    ${rows.map(([k, label]) => `<div class="split-row"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" data-k="${k}"><b id="v-${k}">${Math.round(s[k] * 100)}%</b></div>`).join('')}
    <div class="forecast" id="forecast"></div>
    <p class="source">Science sent to Earth so far: <b>${outpost.scienceSent}</b>${next ? ` - Earth will send the <b>${next[1].name}</b> design at ${next[1].unlockAt}.` : ' - you have every design!'}</p>
    ${factHTML(F.sunlight)}`;
  const remote = !inside;
  modal({ title: remote ? '⚡ Power control (game paused)' : '🖥 Power console - time is passing', pause: remote, html, choices: [{ label: 'Done', primary: true }] });
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
      <div>Science: +${f.science.toFixed(1)}/sol<br><small>${f.link ? 'reaching Earth' : 'stuck here until the link is on'}</small></div>`;
    rows.forEach(([k]) => (box.querySelector('#v-' + k).textContent = Math.round(outpost.split[k] * 100) + '%'));
  };
  sliders.forEach(sl => sl.oninput = () => {
    // Moving one slider takes the difference from the others, so the total is always 100%.
    const k = sl.dataset.k, want = sl.value / 100, others = rows.map(r => r[0]).filter(x => x !== k);
    const rest = others.reduce((a, o) => a + outpost.split[o], 0) || 1;
    const nextSplit = { [k]: want };
    others.forEach(o => (nextSplit[o] = (1 - want) * (outpost.split[o] / rest || 1 / others.length)));
    outpost.setSplit(nextSplit);
    sliders.forEach(x => { if (x !== sl) x.value = Math.round(outpost.split[x.dataset.k] * 100); });
    draw();
  });
  draw();
}

function openWorkbench() {
  const html = `
    <p>You have <b>${outpost.parts} parts</b>. Find more outside: metal chunks, the old rover, and supply pods from Earth.</p>
    <p class="source">New designs arrive from Earth's engineers when they receive enough of your science (sent so far: <b>${outpost.scienceSent}</b>).</p>
    <div class="shop">${Object.entries(UPGRADES).map(([k, u]) => {
      const open = outpost.unlocked(k);
      return `<button data-build="${k}" ${!open || outpost.parts < u.parts ? 'disabled' : ''}><span><b>${open ? '' : '🔒 '}${u.name}</b><small>${open ? u.desc : `Design arrives when Earth has received ${u.unlockAt} science.`}</small></span><b>${u.parts} parts</b></button>`;
    }).join('')}</div>`;
  modal({ title: '🔧 Workbench', pause: false, html, choices: [{ label: 'Done', primary: true }] });
  $('#modal .modal-box').querySelectorAll('[data-build]').forEach(b => b.onclick = () => {
    const key = b.dataset.build;
    if (outpost.buy(key)) {
      toast(`🔧 Built: ${UPGRADES[key].name}`);
      world.setPanels(outpost.panels); world.setWall(outpost.upgrades.wall);
      openWorkbench();
    }
  });
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
          { label: '🏠 Hide in the storm shelter', cost: `Safest. But no science for ${outpost.storm.sols} sols, and you must be inside the outpost.`, onPick: () => { outpost.shelter = outpost.storm.sols; if (!inside) toast('Head back to the outpost - the shelter only works inside!', 4500); } },
          { label: '🛡 Put more power into shielding', cost: 'Takes power away from science and talking to Earth.', onPick: () => { outpost.setSplit({ ...outpost.split, shield: Math.max(outpost.split.shield, 0.45), science: outpost.split.science * 0.4, comms: outpost.split.comms * 0.8 }); toast('🛡 Shields up! Science and the radio get less power for now.'); } },
          { label: '⛏ Keep working and hope for the best', cost: 'You keep everything running - but your radiation badge will fill up much faster.' },
        ] });
      break;
    }
    case 'storm-end': toast('☀️ The solar storm has passed.'); break;
    case 'dust':
      world.setDust(true); outpost.today = outpost.forecast(); say('dust');
      modal({ title: '🌪 Dust storm!', html: `<p>Dust is blocking the sunlight. Your solar panels only make about a third of their normal power for ${ev.sols} sols. Consider moving power from science to life support at the console.</p>${factHTML(F.dustStorm)}` });
      break;
    case 'dust-end': world.setDust(false); toast('🌤 The dust storm is over - full power again!'); break;
    case 'conjunction': say('conjunction'); modal({ title: '📵 The Sun is in the way!', html: `${factHTML(F.conjunction)}<p>No supply pods and no new designs from Earth until it passes. Your science waits safely until then.</p>` }); break;
    case 'blackout-end': toast('📡 Earth can hear you again!'); break;
    case 'supply-launched':
      say('supply');
      toast(`📡 Earth heard you (your message took ${ev.delay.toFixed(1)} minutes to get there). A supply pod is coming!`, 5000);
      pending.push({ sol: outpost.sol + 3, type: 'pod' }); break;
    case 'supply-missed': toast('📡 Earth couldn\'t hear you - not enough power for the radio. No supply pod this time.', 5000); break;
    case 'blueprint': {
      const u = UPGRADES[ev.key];
      say('design');
      modal({ title: '📨 New design from Earth!', html: `<p>Earth's engineers studied the science you sent and radioed you the design for the <b>${u.name}</b>.</p><p>${u.desc}</p><p>Build it at the <b>workbench</b> inside the outpost with <b>${u.parts} parts</b>.</p>` });
      break;
    }
  }
}

function collect(n) {
  if (n.type === 'door') return goInside();
  if (n.type === 'rover') {
    world.rover.salvaged = true; outpost.parts += 8; say('rover');
    world.rover.group.children[0].visible = false; // switch off its beacon
    modal({ title: '🤖 You found an old rover!', html: `${factHTML(F.perseverance)}${factHTML(F.moxie)}<p>You carefully salvage <b>8 spare parts</b> for your workbench.</p>` });
    return;
  }
  const p = n.pickup; world.removePickup(p);
  if (p.kind === 'ice') { outpost.o2 += 6; toast('🧊 Ice! Splitting water makes oxygen: +6 kg oxygen'); }
  if (p.kind === 'metal') { outpost.parts += 1; toast('🔩 Useful metal: +1 part'); }
  if (p.kind === 'pod') { outpost.o2 += 15; outpost.food += 20; outpost.parts += 3; toast('📦 Supplies from Earth: +15 kg oxygen, +20 meals, +3 parts'); }
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
  if (e.code === 'KeyE') {
    if (inside) { const s = interior.nearest(); if (s) stationAction(s); }
    else { const n = world.nearest(); if (n) collect(n); }
  }
  if (e.code === 'KeyP') openPower();
  if (e.code === 'KeyV' && !inside) { world.firstPerson = !world.firstPerson; toast(world.firstPerson ? '👁 First-person view (V to switch back)' : '🎥 Third-person view'); }
});
addEventListener('keyup', e => { if (world) world.keys[e.code] = false; });
$('#view').addEventListener('click', () => { if (state.phase === 'mars' && !isModalOpen()) $('#view').requestPointerLock?.(); });
addEventListener('mousemove', e => {
  if (!world || document.pointerLockElement !== $('#view')) return;
  if (inside) {
    interior.yaw -= e.movementX * 0.0032;
    interior.pitch = Math.max(-1.2, Math.min(1.2, interior.pitch - e.movementY * 0.0028));
  } else {
    world.yaw -= e.movementX * 0.0032;
    if (world.firstPerson) world.lookPitch = Math.max(-1.2, Math.min(1.2, world.lookPitch - e.movementY * 0.0028));
    else world.pitch = Math.max(-0.15, Math.min(1.2, world.pitch + e.movementY * 0.0025));
  }
});
$('#power-btn').onclick = openPower;
$('#view-btn').onclick = () => { if (world && !inside) world.firstPerson = !world.firstPerson; };
$('#speed-btn').onclick = () => { state.speed = state.speed === 1 ? 3 : 1; $('#speed-btn').textContent = 'Speed ×' + state.speed; };
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); world?.resize(); launch?.resize(); interior?.resize(); });

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
  $('#credits').textContent = `🔩 ${o.parts} parts · 🔬 ${o.scienceSent} science sent${o.science >= 1 ? ` (+${Math.floor(o.science)} waiting)` : ''}`;
  $('#link').textContent = f.link ? `📡 Earth link on · messages take ${o.delayMinutes().toFixed(1)} min` : (o.blackout ? '📵 Sun blocking the radio' : '📡 Earth link OFF (needs more power)');
  const list = [];
  if (o.storm) list.push({ text: `☀️ Solar storm! ${o.shelter ? (inside ? 'Sheltering - stay inside' : 'Get back inside!') : 'Get inside or shield up!'}` });
  if (o.dust) list.push({ text: `🌪 Dust storm: ${o.dust} sols left` });
  if (f.o2Net < 0 && o.o2 / -f.o2Net < 8) list.push({ text: '🫁 Oxygen running low - more power to life support!' });
  if (!inside && suit < 0.3) list.push({ text: '🧑‍🚀 Suit air low - go back inside!' });
  alerts(list);
  $('#crosshair').classList.toggle('hidden', !(inside || world.firstPerson) || isModalOpen());
  let hint = '';
  if (!isModalOpen()) {
    if (inside) {
      const s = interior.nearest();
      hint = s ? `Press E to ${s.label}` : 'Walk to a station · click to look around';
    } else {
      const n = world.nearest();
      const names = { door: 'go inside the outpost', rover: 'salvage the old rover', ice: 'collect ice', metal: 'collect metal parts', pod: 'open the supply pod' };
      hint = n ? `Press E to ${names[n.type]}` : (tutorialStep === 0 ? 'Walk to the outpost door (green light) · click the game to look around · V for first person' : '');
    }
  }
  $('#hint').textContent = hint;
}

// Testing helper for the team: open the game with #debug in the address, then use
// game.event('solar-storm-warning'), game.event('dust', {sols: 5}), game.outpost.parts = 50 ...
if (location.hash === '#debug') window.game = { get outpost() { return outpost; }, get world() { return world; }, get interior() { return interior; }, get inside() { return inside; }, event: (type, extra = {}) => queue.push({ type, ...extra }), goInside: () => goInside(), station: t => stationAction({ type: t }) };

// ---------------- main loop ----------------
const clock = new THREE.Clock();
$('#loading').classList.add('hidden');
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.phase === 'launch') {
    const { left, lifted, caption } = launch.update(dt);
    $('#countdown').innerHTML = `${lifted ? 'LIFT-OFF!' : Math.max(0, left)}<small>${caption}</small>`;
    renderer.render(launch.scene, launch.camera);
    if (launch.done) { state.phase = 'cruise'; arrive(); }
    return;
  }
  if (state.phase === 'mars' && world) {
    const paused = isPaused();
    if (inside) interior.update(dt, world.keys, !isModalOpen());
    else world.update(dt, !isModalOpen());
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
          suit = 1; outpost.o2 = Math.max(0, outpost.o2 - 5);
          modal({ title: '🆘 Out of suit air!', html: '<p>Your crewmates came out and carried you back inside just in time. Refilling your suit in a hurry used <b>5 kg of the outpost\'s oxygen</b>. Keep an eye on your suit meter!</p>', onClose: goInside });
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
    if (!isPaused() && queue.length && !outpost.over) handle(queue.shift());
    interior.setStorm(!!outpost.storm, clock.elapsedTime);
    drawHUD();
    if (inside) renderer.render(interior.scene, interior.camera);
    else renderer.render(world.scene, world.camera);
    return;
  }
  // title / explainer / cruise: slow pan over Mars once it exists
  if (world) { world.yaw += dt * 0.05; world.update(dt, false); renderer.render(world.scene, world.camera); }
  else renderer.clear();
});
