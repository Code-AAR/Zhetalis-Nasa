import * as THREE from 'three';
import { Outpost, DIFFICULTY, UPGRADES, TUNED, TIERS } from './sim.js';
import { loadSpaceWeather, sunToday, pickStormEvent, flareStrength, flareWords } from './spaceweather.js';
import { World, GH } from './world.js';
import { Launch } from './launch.js';
import { Interior } from './interior.js';
import { Capsule } from './capsule.js';
import { Greenhouse } from './greenhouse.js';
import { showMissionPath } from './missionpath.js';
import { showArrival } from './arrival.js';
import { loadRoverPhotos, loadEarthToday, loadMarsMap, loadMarsToday, dateWords } from './nasaimages.js';
import { $, modal, toast, meter, alerts, factHTML, sourcesHTML, isModalOpen, isPaused, say, logFact, onLog, logbook } from './ui.js';
import { pickQuestions, runQuiz, badgeFor } from './quiz.js';
import { loadModel } from './nasamodels.js';
import { artReady, artUrl, hasArt, artHTML, speakerHTML, artCredit, storyPanels, anyArt } from './art.js';
import { startSound, setSound, tickSound, footstep, toggleMute, isMuted, soundDebug } from './sound.js';
import { initTouch, isTouch } from './touch.js';
import { earthGlobe, moonGlobe } from './globe.js';
import { Colony, newColony, ORES, TOOLS, CROPS, SHOP, GREENHOUSE, BAG, JUG_L, priceWords } from './colony.js';
import { initMissionMenu } from './menu.js';
import { SCREEN_MODES, screenName, screenMode, setScreenMode, nextScreenMode, onLayout } from './layout.js';
loadModel('sls.glb'); loadModel('mobile-launcher.glb');   // NASA's 3D models start downloading on the title screen

// Phones and tablets: draw fewer pixels, and skip shadows on small screens, so the game stays smooth
const coarse = matchMedia('(pointer: coarse)').matches, smallScreen = Math.min(screen.width, screen.height) < 600;
const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: !(coarse && smallScreen) });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !(coarse && smallScreen);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;   // softer, film-like light and colour

const F = (await (await fetch('data/mars-facts.json')).json()).facts;
await artReady;   // team illustrations (assets/art/art.json) - empty slots simply show nothing
for (const [id, f] of Object.entries(F)) f.id = id;   // so the logbook and quiz can refer to each fact
onLog(n => { $('#log-btn').textContent = `📒 Logbook: ${n} (L)`; });

// The mission logbook: every real fact you have met, as cards you can read again.
function openLogbook() {
  const cards = [...logbook.values()];
  modal({ title: `📒 Mission logbook - ${cards.length} fact cards`, pause: !inside, html: `
    <p>Every real NASA fact you discover on your mission is saved here. At the end of the mission there is a quick quiz to earn your <b>Junior Astronaut badge</b>!</p>
    <div class="log-list">${cards.slice().reverse().map(f => factHTML(f, false)).join('') || '<p>No cards yet - explore!</p>'}</div>`,
    choices: [{ label: 'Close', primary: true }] });
}
let weather = { mode: 'archived', flares: [], sources: [] };
const weatherReady = loadSpaceWeather().then(w => { weather = w; showSun(); });

const state = { phase: 'title', difficulty: 'normal', speed: 1 };
let colony, marsNow = null, monitorTipShown = false, toolbarKey = '', visorKey = '';
let capsule, ghRoom, ghTipShown = false, room;   // room: the indoor place you are in - the outpost (interior) or your lander's cabin
let world, launch, interior, outpost, solClock = TUNED.solSeconds * 0.3, suit = 1, inside = false, pending = [], tutorialStep = 0;   // you land in the morning
const queue = [];   // simulation events wait here so pop-ups never land on top of each other

// ---------------- title screen ----------------
const missionMenu = initMissionMenu();
const diffBox = $('#difficulties');
for (const [key, d] of Object.entries(DIFFICULTY)) {
  const b = document.createElement('button');
  b.className = 'card' + (key === state.difficulty ? ' selected' : '');
  b.innerHTML = `<b>${d.label}</b>`;
  b.setAttribute('aria-pressed', String(key === state.difficulty));
  b.onclick = () => {
    state.difficulty = key;
    diffBox.querySelectorAll('.card').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
    b.classList.add('selected'); b.setAttribute('aria-pressed', 'true');
    $('#mission-summary').textContent = d.blurb;
  };
  diffBox.appendChild(b);
}

function showSun() {
  const s = sunToday(weather);
  const tag = s.mode === 'live' ? '<span class="real-tag">LIVE</span>' : '<span class="real-tag archived">ARCHIVED</span>';
  $('#sun-line').innerHTML = s.biggest
    ? `${tag}Real data from NOAA's GOES satellites: the biggest solar flare in the last week was <b>${s.biggest.cls}</b> - ${flareWords(s.biggest.cls)}.`
    : `${tag}Couldn't reach the space-weather satellites right now - the game will use saved real data.`;
}

// "Press E" on a keyboard, "tap Use" on a phone or tablet
const keyWord = (key, tap) => (isTouch() ? tap : key);

$('#howto').onclick = () => modal({ title: 'How to play', html: `
  ${isTouch() ? `<p><b>Move</b>: put your left thumb on the screen and slide it - push all the way to <b>run</b>. <b>Look around</b>: drag with your right thumb. <b>Jump</b>: the Jump button - Mars gravity is weak, so you float!</p>
  <p><b>View</b> switches between first-person (through your helmet) and third-person view.</p>
  <p><b>Use</b> (it lights up when something is close): collect ice and metal parts, salvage the old rover, open supply pods, and go through the outpost door.</p>`
  : `<p><b>Move</b> with WASD or the arrow keys. <b>Look around</b>: click the game, then move the mouse (Esc frees the mouse). <b>Run</b>: Shift. <b>Jump</b>: Space - Mars gravity is weak, so you float!</p>
  <p><b>V</b> switches between first-person (through your helmet) and third-person view.</p>
  <p><b>E</b> uses things: collect ice and metal parts, salvage the old rover, open supply pods, and go through the outpost door.</p>`}
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
    <h4>Real NASA pictures (loaded live, no key needed)</h4>
    <p class="source">• Menu globes: saved Earth and Mars maps from the existing NASA assets, plus the <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener">NASA SVS CGI Moon Kit</a> (NASA / Ernie Wright, LRO / LROC). These are rendered surface maps with body diameters to scale and compressed distances. The Earth preview also links to a dated, archived EPIC photo, refreshed locally with the private NASA key; the key is never shipped with the game.</p>
    <p class="source">• Outpost window: the newest colour photos from Perseverance's Mastcam-Z - <a href="https://mars.nasa.gov/mars2020/multimedia/raw-images/" target="_blank" rel="noopener">NASA/JPL-Caltech/ASU raw images</a></p>
    <p class="source">• Power console: today's whole-Earth photo - <a href="https://epic.gsfc.nasa.gov/" target="_blank" rel="noopener">NASA EPIC camera on DSCOVR</a></p>
    <p class="source">• Arrival globe: <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener">NASA Mars Trek</a> - Viking orbiters colour mosaic</p>
    <p class="source">• If a service is down, the game shows a saved list of the same real photos, labelled ARCHIVED.</p>
    <h4>Real Mars sound and weather</h4>
    <p class="source">• The wind you hear outside: a real recording by Perseverance's SuperCam microphone, sol 4 (22 Feb 2021) - <a href="https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/" target="_blank" rel="noopener">NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-SUPAERO</a>. Breathing, footsteps and the outpost hum are made by the game.</p>
    <p class="source">• Mars weather in the window: <a href="https://mars.nasa.gov/msl/weather/" target="_blank" rel="noopener">Curiosity rover REMS daily report</a>. • Today's real Earth-Mars distance on the console: <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">NASA JPL Horizons</a>.</p>
    <h4>Mars, spaceflight and astronaut health</h4>
    ${Object.values(F).map(f => `<p class="source">• ${f.kid} - <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></p>`).join('')}
    <h4>3D models (NASA's own, from <a href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noopener">NASA 3D Resources</a>)</h4>
    <p class="source">• SLS Block 1 rocket - NASA's 3D-printing model, split into its real stages and coloured from NASA's Artemis II launch photos. • Mobile Launcher. • Perseverance rover (NASA/JPL-Caltech). • Ingenuity helicopter. • Mars Reconnaissance Orbiter. • Pistol Grip Tool (the power drill astronauts use on spacewalks) and Wrench, on the outpost workbench. Terrain colours based on Perseverance's photos of Jezero Crater. • The crew rover: NASA's Space Exploration Vehicle (MMSEV) model; it drives faster in the game than the real one. • Launch pad: NASA's Vehicle Assembly Building model (not at its real distance). • Mars Odyssey relay orbiter (NASA 3D Resources). • NASA logos on models are replaced with the Zhetalis logo. • Planets in the sky (launch and Mars nights) are where they really are today, from <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">NASA JPL's approximate planet positions</a>; the stars are a made-up pattern. • Your astronaut: NASA's Astronaut model (logo removed, cut into jointed parts so it can walk). • The hills and craters around the outpost: shaped from NASA's 3D model of Spirit's landing site, Gusev Crater (shrunk - the real crater is about 160 km wide). • Mars globe map: NASA 3D Resources (and NASA Mars Trek when online). • Spinning Earth: NASA Blue Marble imagery (map from the three.js examples), turned to match today's EPIC photo. The launch pad's towers are simple shapes based on NASA photos.</p>
    <p class="source">• Launch photo: <a href="https://images.nasa.gov/" target="_blank" rel="noopener">NASA Image and Video Library</a> (Artemis II, 1 April 2026).</p>
    ${anyArt() ? `<h4>Illustrations</h4><p class="source">• ${artCredit() || 'Illustrations made by team Zhetalis.'} Every illustration is labelled "Illustration" - only pictures labelled REAL or LIVE are real NASA photos.</p>` : ''}
    <h4>Game balance (not real measurements)</h4>
    <p class="source">• 1 sol passes in ${TUNED.solSeconds} seconds. • Each solar panel makes ${TUNED.kWhPerPanel} kWh per clear sol. • Solar storms are made stronger than real ones so you can see shielding matter in one game. • Supply pods arrive in a few sols (real cargo takes about 7 months). • Upgrade design and parts numbers are made up. • Plants grow in a few sols (real lettuce takes about 4 weeks, potatoes 3 to 4 months). • Ore amounts, trade prices and the 2-sol storm warning are game values; real solar-storm particles take from hours to days to arrive. • Phobos is drawn about twice as big as it really looks, so you can spot it.</p>` });
}

// ---------------- save and resume ----------------
// The mission saves itself every few seconds (and when the tab is hidden or closed), in this browser only.
// After a refresh, the title screen offers "Resume" to carry on from the same sol.
const SAVE_KEY = 'ja-save-v1';
function saveGame() {
  if (state.phase !== 'mars' || !outpost || outpost.over || !world) return;
  const o = {};
  for (const [k, v] of Object.entries(outpost)) if (!['d', 'facts', 'today'].includes(k)) o[k] = v;
  const s = world.sev, p = world.driving ? s.exitPoint() : world.player.position;
  const data = {
    v: 1, when: Date.now(), difficulty: state.difficulty, speed: state.speed, outpost: o,
    solClock, suit, inside, ship: inside && room === capsule, gh: inside && room === ghRoom, pending, tutorialStep, sunsetShown, logbook: [...logbook.keys()],
    world: { player: [p.x, p.z], yaw: world.yaw, rover: world.rover.salvaged, heli: !!world.heli.seen, sevShown: !!world.sevShown,
      pickups: world.pickups.map(k => [k.kind, k.x, k.z, k.cargo || null]), sev: [s.pos.x, s.pos.z, s.yaw, s.battery] },
    colony: colony?.s,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage blocked: no saving */ }
}
function readSave() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d?.v === 1 && DIFFICULTY[d.difficulty] ? d : null; } catch { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
setInterval(saveGame, 5000);

const saved = readSave();
if (saved) {
  const b = $('#resume');
  b.textContent = `▶ Resume: sol ${saved.outpost.sol} of ${DIFFICULTY[saved.difficulty].sols} (${DIFFICULTY[saved.difficulty].label})`;
  b.classList.remove('hidden');
  b.onclick = () => resume(saved);
}

// Back to Mars straight away, with everything as it was.
async function resume(d) {
  missionMenu.dispose();
  startSound();
  if (isTouch() && document.body.classList.contains('layout-phone') && canFullscreen) goFullscreen();
  $('#title').classList.add('hidden');
  state.difficulty = d.difficulty; state.speed = d.speed || 1; $('#speed-btn').textContent = 'Speed ×' + state.speed;
  buildWorld();
  Object.assign(outpost, d.outpost); outpost.today = outpost.forecast();
  ({ solClock, suit, pending, tutorialStep, sunsetShown } = d);
  d.logbook.forEach(id => F[id] && logFact(F[id]));
  const w = d.world;
  world.pickups.slice().forEach(p => world.removePickup(p));
  w.pickups.forEach(([kind, x, z, cargo]) => { world.addPickup(kind, x, z); if (cargo) world.pickups.at(-1).cargo = cargo; });
  if (d.colony) { colony.s = Object.assign(newColony(), d.colony); colony.restore(); }
  if (w.rover) { world.rover.salvaged = true; world.rover.group.children[0].visible = false; }
  world.heli.seen = w.heli; world.sevShown = w.sevShown;
  world.player.position.set(w.player[0], 0, w.player[1]); world.yaw = w.yaw;
  world.sev.pos.set(w.sev[0], 0, w.sev[1]); world.sev.yaw = w.sev[2]; world.sev.battery = w.sev[3];
  world.setPanels(outpost.panels); world.setWall(outpost.upgrades.wall); world.setRegolith(outpost.upgrades.regolith > 0);
  world.setLink(outpost.today.link); world.setPanelDust(outpost.clean); world.panelsDirty = outpost.clean < 0.97;
  world.setDust(!!outpost.dust);
  if (d.inside) (d.ship ? goInShip() : d.gh ? goInGreenhouse('hab') : goInside()); else inside = false;
  loadRoverPhotos(); loadEarthToday();
  setSound({ scene: 'mars' });
  await weatherReady;
  state.phase = 'mars';
  $('#hud').classList.remove('hidden');
  phoneTips();
  toast(`👋 Welcome back, astronaut! Sol ${outpost.sol} - your mission carries on where you left it.`);
}

$('#start').onclick = () => {
  missionMenu.dispose();
  clearSave();                                                 // a new mission replaces the old save
  if (isTouch() && document.body.classList.contains('layout-phone') && canFullscreen) goFullscreen();   // phones: fill the screen like an app
  startSound(); setSound({ scene: 'launch', thrust: 0 });   // sound can only start after a click
  $('#title').classList.add('hidden');
  state.phase = 'launch';
  launch = new Launch();
  say('countdown');
  $('#countdown').classList.remove('hidden');
  const skip = document.createElement('button'); skip.textContent = 'Skip launch ›'; skip.id = 'skip';
  Object.assign(skip.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: 5 });
  skip.onclick = () => (launch.done = true); document.body.appendChild(skip);
  buildWorld(); // start building Mars in the background during the countdown
  loadMarsMap(); loadRoverPhotos(); loadEarthToday();   // and start fetching the real NASA pictures
};

function buildWorld() {
  world = new World(renderer, F, () => {});
  interior = new Interior(); capsule = new Capsule(); room = interior;
  capsule.onStep = () => footstep(0, true);
  ghRoom = new Greenhouse(); ghRoom.onStep = () => footstep(0, true);
  if (hasArt('mars-ground')) world.useGroundArt(artUrl('mars-ground'));
  world.onStep = run => footstep(run); interior.onStep = () => footstep(0, true);
  outpost = new Outpost(state.difficulty, F);
  world.setPanels(outpost.panels);
  world.setLink(outpost.today.link);
  colony = new Colony(world);                                 // tools, ores, trading and greenhouses
  loadMarsToday().then(t => (marsNow = t)).catch(() => {});   // real Curiosity weather for the visor and monitor
}

// ---------------- after lift-off: how we get there, then arrival ----------------
async function arrive() {
  $('#countdown').classList.add('hidden'); $('#skip')?.remove();
  setSound({ scene: 'cruise' });
  await showMissionPath(F);
  const fade = $('#fade'), wait = ms => new Promise(r => setTimeout(r, ms));
  fade.innerHTML = `<p>Seven months later…<br><br>On the trip, your crew soaked up about <b>${F.cruiseDose.value} mSv of radiation every day</b> - about 3 times more than on the surface of Mars.<br><br><span class="source">Source: ${F.cruiseDose.source}</span></p>`;
  fade.style.opacity = 0; fade.classList.remove('hidden'); void fade.offsetWidth; fade.style.opacity = 1;   // fade in
  await wait(7000);
  fade.style.opacity = 0; await wait(900);                                                                // fade out slowly
  fade.classList.add('hidden'); fade.style.opacity = '';
  setSound({ scene: 'arrival' });
  await showArrival(F, outpost.delayMinutes());
  setSound({ scene: 'mars' });
  await weatherReady;
  state.phase = 'mars';
  $('#hud').classList.remove('hidden');
  phoneTips();
  say('welcome');
  modal({ title: 'Welcome to Mars, junior astronaut!', html: `
    ${speakerHTML('crew-commander', 'Your commander')}
    <p>You just climbed out of your capsule. The outpost in front of you has only the basics - and limited supplies. Inside, the <b>power console</b> shares out the power from the solar panels.</p>
    ${factHTML(F.sol)}
    <p>In this game <b>1.5 seconds = 1 Mars hour</b>, so you will see the Sun rise and set. Solar panels only work in daylight - at night your <b>batteries</b> must keep the heater running.</p>
    <p>Your mission: keep the crew alive for <b>${outpost.d.sols} sols</b>, or grow your camp into a <b>self-sustaining settlement</b>. Watch your <b>oxygen</b>, <b>food</b> and <b>radiation badge</b>.</p>
    <p>🧰 You carry a <b>pickaxe</b>${keyWord(' (key <b>1</b>)', '')}. Mine the mineral rocks that sparkle, carry the samples to the <b>storage locker</b> inside, and trade them with Earth for seeds. Take the <b>builder</b> from the locker to put up <b>greenhouses</b>, then plant and water them. Check the <b>hazard monitor</b> inside often: it spots storms before they arrive.</p>
    <p>Walk to the glowing green door and ${keyWord('press <b>E</b>', 'tap <b>Use</b>')} to go inside. ${keyWord('Press <b>V</b>', 'Tap <b>View</b>')} any time to see through your own helmet.</p>
    <p>🎧 <b>Listen:</b> the wind you hear outside is a <b>real recording from Mars</b>, made by the Perseverance rover's microphone. ${keyWord('Press <b>M</b>', 'Use the <b>Sound</b> button')} to turn sound on or off.</p>
    ${factHTML(F.marsSound)}`,
    choices: [{ label: "Let's go!", primary: true }] });
}

// ---------------- inside the outpost ----------------
function goInside() {
  inside = true; room = interior; interior.enter(); document.exitPointerLock?.();
  toast(`🏠 Inside the outpost: you are shielded and your suit refills. Walk to the stations and ${keyWord('press E', 'tap Use')}.`, 4500);
}
// Your lander: climb the ladder into its crew cabin (capsule.js)
function goInShip() {
  inside = true; room = capsule; capsule.enter(); document.exitPointerLock?.();
  toast(`🚀 You climbed the ladder into your lander. 4 astronauts rode down to Mars in this cabin! ${keyWord('Press E', 'Tap Use')} at the seats, screens and window.`, 6000);
}
// The base greenhouse (greenhouse.js): from the outpost through the tunnel ('hab'), or from outside through its airlock ('out')
function goInGreenhouse(from) {
  const wasOut = !inside;
  inside = true; room = ghRoom; ghRoom.enter(from); ghRoom.draw(colony.s.base, GREENHOUSE.tank);
  if (wasOut) document.exitPointerLock?.();
  if (!ghTipShown) {
    ghTipShown = true;
    toast(`🌱 The greenhouse! Its 4 grow beds feed the crew. ${keyWord('Press E', 'Tap Use')} at the end of a bed to plant seeds, fill it from the water pipe and harvest food.`, 7000);
  }
}
function goOutside() {
  inside = false;
  if (room === ghRoom) {   // out through the greenhouse airlock
    room = interior;
    world.player.position.set(GH.x - GH.r - 3.2, 0, GH.z); world.yaw = -Math.PI / 2; world.lookPitch = 0;   // west of the dome, facing away
    if (!world.firstPerson) world.yaw = Math.PI / 2;
    return;
  }
  if (room === capsule) {   // down the stairs from the capsule hatch
    room = interior; const d = world.shipDoor;
    world.player.position.set(d.x + 0.35, 0, d.z + 1.0); world.yaw = Math.atan2(-d.x, -d.z); world.lookPitch = 0;
    if (!world.firstPerson) world.yaw += Math.PI;
    return;
  }
  room = interior;
  world.player.position.set(0, 0, 10.5); world.yaw = 0; world.lookPitch = 0; // step out of the door, facing away from it
  if (!world.firstPerson) world.yaw = Math.PI;
  if (outpost.shelter) toast('⚠️ The solar storm is still going - you are not protected out here!', 4500);
}

function stationAction(s) {
  if (s.type === 'exit' || s.type === 'ship-exit') return goOutside();
  if (s.type === 'ship-seat') return modal({ pause: false, title: '💺 The crew seats', html: `<p>Your lander has seats for <b>4 astronauts</b>, like NASA's Orion capsule. For launch and landing they lie on their backs with their knees up - that way the strong push of the rockets presses them into the seat instead of draining blood from their heads.</p>${factHTML(F.artemis2)}<p class="source">Orion, the capsule NASA astronauts fly in today, has only about as much living space as a small camper van - for a whole crew!</p>` });
  if (s.type === 'ship-panel') return modal({ pause: false, title: '🖥 The glass cockpit', html: `<p>Like NASA's Orion capsule, your lander is flown with <b>three big screens</b> instead of hundreds of dials and switches. The crew can swap what each screen shows - flight path, power, air and the heat shield.</p>${factHTML(F.orion)}<p>Orion's <b>heat shield</b> is on its bottom. Coming home it gets hotter than the surface of a lava flow, and it slowly burns away to carry the heat off.</p>` });
  if (s.type === 'console') return openPower();
  if (s.type === 'workbench') return openWorkbench();
  if (s.type === 'greenhouse') return goInGreenhouse('hab');
  if (s.type === 'gh-hab') { goInside(); interior.pos.set(-2.8, 0, 0); interior.yaw = Math.PI / 2; return; }   // back through the tunnel
  if (s.type === 'gh-out') return goOutside();
  if (s.type === 'gh-bed') return openGreenhouse(colony.baseBeds[s.bed]);
  if (s.type === 'gh-tap') {
    if (!colony.has('jug')) return toast('💧 This tap fills the water jug for greenhouses you build outside. The jug is in the storage locker in the outpost.', 5000);
    const l = colony.fillJug(); toolbarKey = '';
    return toast(l ? `💧 Filled your jug with ${l} L (base tank: ${colony.s.tank.toFixed(0)} L left).` : colony.s.tank <= 0 ? '💧 The base water tank is empty - collect ice outside!' : '💧 Your jug is already full.');
  }
  if (s.type === 'shelter') return modal({ pause: false, title: '🛏 Storm shelter', html: `<p>During a solar storm, the crew squeezes into this small room with the thickest walls. It blocks most of the radiation - but nobody can do science or go outside.</p><p>${outpost.storm ? (outpost.shelter ? `<b>Sheltering now:</b> ${outpost.shelter} sols left.` : '<b>A solar storm is happening!</b> Choosing "hide in the shelter" in the warning keeps you safe.') : 'No storm right now.'}</p>${factHTML(F.careerLimit)}` });
  if (s.type === 'window') return openWindow();
  if (s.type === 'monitor') return openMonitor();
  if (s.type === 'locker') return openLocker();
}

// The outpost window shows REAL photos from Mars: the newest colour pictures from NASA's Perseverance rover.
async function openWindow() {
  modal({ pause: false, title: '🪟 Mars today - real photos', html: '<p>Loading the newest photos from NASA\'s Perseverance rover…</p>' });
  const { mode, photos } = await loadRoverPhotos();
  if (!isModalOpen() || !$('#modal h3')?.textContent.includes('Mars today')) return;   // the player closed it while loading
  if (!photos.length) return modal({ pause: false, title: '🪟 The view', html: `<p>Couldn't reach NASA's photo server right now.</p>${factHTML(F.air)}${factHTML(F.temperature)}` });
  const tag = mode === 'live' ? '<span class="real-tag">LIVE</span>' : '<span class="real-tag archived">ARCHIVED</span>';
  const today = await loadMarsToday(), w = today?.weather;
  const weather = w ? `<div class="fact"><span class="real-tag">REAL</span><b>Mars weather report:</b> on ${dateWords(w.date)} (sol ${w.sol}), NASA's Curiosity rover in Gale Crater measured a high of <b>${w.high} °C</b> and a low of <b>${w.low} °C</b>. Air pressure: <b>${w.pressure} Pa</b> - less than 1% of Earth's. Sky: ${w.sky.toLowerCase()}, sunrise ${w.sunrise}, sunset ${w.sunset}.<div class="source">Source: <a href="${w.url}" target="_blank" rel="noopener">${w.source}</a></div></div>` : factHTML(F.temperature);
  modal({ pause: false, title: '🪟 Mars today - real photos', html: `
    <p>${tag}These are <b>real photos</b> that NASA's Perseverance rover took in Jezero Crater on Mars a few days ago. In our story it is 2126 - but this is what Mars looks like <b>right now</b>.</p>
    <figure class="slide"><img id="ph-img" alt="Photo of Mars taken by NASA's Perseverance rover"><figcaption id="ph-cap"></figcaption></figure>
    <div class="slide-nav"><button id="ph-prev">‹</button><button id="ph-play">⏸ Pause</button><button id="ph-next">›</button></div>
    ${weather}${factHTML(F.perseverance)}`, choices: [{ label: 'Done', primary: true, onPick: () => clearInterval(timer) }] });
  let i = 0, timer;
  const show = () => {
    const p = photos[i];
    $('#ph-img').src = p.src;
    $('#ph-cap').innerHTML = `Sol ${p.sol} of Perseverance's mission · ${dateWords(p.when + 'Z')} · ${p.camera} · <a href="${p.link}" target="_blank" rel="noopener">NASA/JPL-Caltech/ASU</a> (${i + 1}/${photos.length})`;
  };
  const step = d => { i = (i + d + photos.length) % photos.length; show(); };
  const play = () => { clearInterval(timer); timer = setInterval(() => { if (!$('#ph-img')) return clearInterval(timer); step(1); }, 3500); };
  $('#ph-prev').onclick = () => step(-1); $('#ph-next').onclick = () => step(1);
  $('#ph-play').onclick = e => { if (timer) { clearInterval(timer); timer = null; e.target.textContent = '▶ Play'; } else { play(); e.target.textContent = '⏸ Pause'; } };
  show(); play();
}

// ---------------- the power trade-off ----------------
function openPower() {
  if (!outpost || outpost.over) return;
  const s = outpost.split;
  const rows = [['life', '🫁 Life support'], ['comms', '📡 Talk to Earth'], ['science', '🔬 Science'], ['shield', '🛡 Shielding']];
  const nextTier = TIERS[outpost.tier + 1];
  const next = nextTier ? [null, { name: `"${nextTier.name}" tier`, unlockAt: nextTier.science }] : null;
  const html = `
    <p>Each sol you make <b>${outpost.energy().toFixed(0)} kWh</b>${outpost.dust ? ' (a dust storm is blocking the sunlight!)' : ''}. The night heater takes <b>${TUNED.heaterKWh} kWh</b> first, so you can share out <b>${outpost.today.energy.toFixed(0)} kWh</b>. Move the sliders - the total always stays 100%.</p>
    ${rows.map(([k, label]) => `<div class="split-row"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" data-k="${k}"><b id="v-${k}">${Math.round(s[k] * 100)}%</b></div>`).join('')}
    <div class="forecast" id="forecast"></div>
    <p class="source">Science sent to Earth so far: <b>${outpost.scienceSent}</b>${next ? ` - your base reaches the <b>${next[1].name}</b> at ${next[1].unlockAt}, and Earth sends new designs.` : ' - you are a self-sustaining settlement!'}</p>
    <div class="earth-card" id="earth-card"><div class="earth-globe"><canvas aria-label="A 3D Earth you can spin"></canvas><canvas class="moon-globe" aria-label="The Moon - drag to spin it too"></canvas><a class="epic-thumb" target="_blank" rel="noopener" title="Today's real photo from NASA's EPIC camera"><img alt="The whole Earth today, photographed by NASA's EPIC camera"></a><span class="spin-tip">drag to spin</span></div><p>Looking for today's photo of Earth…</p></div>
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
      <div>Earth link: ${f.link ? '<span class="pos">ON</span>' : '<span class="neg">OFF</span>'}<br><small>needs ${f.commsNeed.toFixed(0)} kWh${outpost.blackout ? ' - blocked by the Sun!' : ''}</small></div>
      <div>Radiation inside: ${f.dose.toFixed(2)} mSv/sol<br><small>${Math.round(f.protection * 100)}% blocked</small></div>
      <div>Science: +${f.science.toFixed(1)}/sol<br><small>${f.link ? 'reaching Earth' : 'stuck here until the link is on'}</small></div>
      <div>Solar panels: ${f.solar.toFixed(0)} kWh<br><small>${Math.round(outpost.clean * 100)}% clean${outpost.clean < 0.8 ? ' - go outside and wipe them!' : ''}${outpost.reactors ? ` · reactor +${outpost.reactors * TUNED.reactorKWh}` : ''}</small></div>
      <div>Night heater: ${f.heater} kWh<br><small>${f.cold ? '<span class="neg">batteries too small - cold nights!</span>' : `batteries hold ${outpost.battery} kWh - enough`}</small></div>
      ${outpost.relayDown ? `<div><span class="neg">Relay orbiter lost</span><br><small>talking straight to Earth needs ${f.commsNeed.toFixed(0)} kWh (${outpost.relayDown} sols until a new one arrives)</small></div>` : ''}`;
    rows.forEach(([k]) => (box.querySelector('#v-' + k).textContent = Math.round(outpost.split[k] * 100) + '%'));
  };
  // the people you are talking to: today's real photo of the whole Earth, from NASA's EPIC camera
  Promise.all([loadEarthToday(), loadMarsToday()]).then(([e, today]) => {
    const card = box.querySelector('#earth-card'); if (!card) return;
    if (!e) return card.remove();
    earthGlobe(card.querySelector('canvas'), e.centre);   // a 3D Earth, turned to the side EPIC sees right now
    moonGlobe(card.querySelector('.moon-globe'));           // ...and the Moon, which you can spin too
    card.querySelector('img').src = e.src; card.querySelector('.epic-thumb').href = e.src;
    card.querySelector('p').innerHTML = `${e.mode === 'live' ? '<span class="real-tag">LIVE</span>' : '<span class="real-tag archived">ARCHIVED</span>'}<b>Home, ${dateWords(e.when.replace(' ', 'T') + 'Z')}.</b> The globe is turned to the side NASA's EPIC camera saw then, from 1.5 million km away - tap the small picture for its real photo. A radio message from here takes <b>${outpost.delayMinutes().toFixed(1)} minutes</b> to get there.${today?.distance ? ` (In real life today, ${dateWords(today.distance.date)}, Mars is ${(today.distance.km / 1e6).toFixed(0)} million km from Earth - a ${today.distance.lightMinutes}-minute wait, says NASA JPL Horizons.)` : ''}<br><span class="source">Source: <a href="${F.epic.url}" target="_blank" rel="noopener">${F.epic.source}</a></span>`;
    logFact(F.epic);
  });
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
  const byTier = TIERS.map((t, i) => {
    const items = Object.entries(UPGRADES).filter(([, u]) => u.tier === i).map(([k, u]) => {
      const open = outpost.unlocked(k), done = u.once && outpost.built(k);
      const why = done ? 'Built!' : open ? u.desc : `Design arrives when your base becomes a ${t.name} (${t.science} science sent).`;
      return `<button data-build="${k}" ${!open || done || outpost.parts < u.parts ? 'disabled' : ''}><span><b>${done ? '✅ ' : open ? '' : '🔒 '}${u.name}</b><small>${why}</small></span><b>${u.parts} parts</b></button>`;
    }).join('');
    return `<h4>${i <= outpost.tier ? '' : '🔒 '}Tier ${i + 1}: ${t.name}</h4><div class="shop">${items}</div>`;
  }).join('');
  modal({ title: '🔧 Workbench', pause: false, html: `
    <p>You have <b>${outpost.parts} parts</b>. Find more outside: metal chunks, the old rover, and supply pods from Earth.</p>
    <p class="source">Your base is a <b>${TIERS[outpost.tier].name}</b>. Science sent to Earth: <b>${outpost.scienceSent}</b>.</p>${byTier}`,
    choices: [{ label: 'Done', primary: true }] });
  $('#modal .modal-box').querySelectorAll('[data-build]').forEach(b => b.onclick = () => {
    const key = b.dataset.build;
    if (outpost.buy(key)) {
      toast(`🔧 Built: ${UPGRADES[key].name}`);
      world.setPanels(outpost.panels); world.setWall(outpost.upgrades.wall); world.setRegolith(outpost.upgrades.regolith > 0);
      if (key === 'regolith') modal({ pause: false, title: '⛏ Outpost buried!', html: factHTML(F.regolith) });
      else if (key === 'reactor') modal({ pause: false, title: '⚛ Reactor online!', html: factHTML(F.fission) });
      else openWorkbench();
    }
  });
}

// ---------------- outside work: mining, the locker, trading, greenhouses ----------------
const cargoWords = c => [...Object.entries(c.seeds || {}).map(([k, n]) => `${n} × ${CROPS[k].name.toLowerCase()} seeds`), c.parts ? `${c.parts} parts` : ''].filter(Boolean).join(', ');
const oreDot = k => `<i class="ore-dot" style="background:${ORES[k].color}"></i>`;

function mine(dep) {
  if (!colony.has('pickaxe')) return toast('⛏ Your pickaxe is in the storage locker at the base. Your belt only holds 2 tools.');
  if (colony.tool !== 'pickaxe') { colony.select(colony.s.belt.indexOf('pickaxe')); toolbarKey = ''; }
  if (colony.bagCount() >= BAG) return toast(`🎒 Your sample bag is full (${BAG}). Unload it at the storage locker inside the base.`);
  world.swingTool(() => {
    footstep(1);
    const r = colony.strike(dep), o = ORES[dep.ore];
    toolbarKey = '';
    if (r.full) return toast(`🎒 Your sample bag is full (${BAG}). Unload it at the storage locker inside the base.`);
    if (!r.broke) return toast(`⛏ ${o.name}: ${r.left} more swing${r.left === 1 ? '' : 's'}`, 900);
    toast(`🪨 +${r.got} ${o.name.toLowerCase()} in your sample bag (${colony.bagCount()}/${BAG})`);
    if (r.firstTime) modal({ pause: false, title: `🪨 You found ${o.name.toLowerCase()}!`, html: `<p>${o.desc}</p>${factHTML(F[o.fact])}<p>Carry samples to the <b>storage locker</b> inside the base. You can build with them, or trade them with Earth for seeds and parts.</p>` });
  });
}

// Real temperature outside: Curiosity's latest daily high and low (NASA REMS), following the time of day -
// coldest just before sunrise, warmest early in the afternoon.
function outsideTemp() {
  const w = marsNow?.weather; if (!w || w.high == null || w.low == null) return null;
  const ph = solClock / TUNED.solSeconds;
  const t = ph >= 0.24 && ph < 0.58 ? (ph - 0.24) / 0.34 : 1 - ((ph - 0.58 + 1) % 1) / 0.66;
  return Math.round(w.low + (w.high - w.low) * t * t * (3 - 2 * t));
}
function marsTime() {
  const h = solClock / TUNED.solSeconds * 24.66;
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
}

// First person: a handful of quiet numbers along the bottom of the visor
function drawVisor() {
  const o = outpost, f = o.today, temp = outsideTemp(), sev = world.driving;
  const cls = frac => (frac < 0.15 ? 'bad' : frac < 0.3 ? 'warn' : '');
  const rad = o.dose / o.limit, o2Sols = f.o2Net < 0 ? o.o2 / -f.o2Net : Infinity;
  const html = [
    sev ? `<span class="${cls(world.sev.battery)}"><small>Rover</small><b>${Math.round(world.sev.battery * 100)}%</b></span>`
        : `<span class="${cls(suit)}"><small>Suit air</small><b>${Math.round(suit * 100)}%</b></span>`,
    `<span class="${o2Sols < 4 ? 'bad' : o2Sols < 8 ? 'warn' : ''}"><small>Base O₂</small><b>${o.o2.toFixed(0)} kg</b></span>`,
    `<span class="${o.food < 8 ? 'warn' : ''}"><small>Food</small><b>${o.food.toFixed(0)}</b></span>`,
    `<span class="${rad > 0.8 ? 'bad' : rad > 0.6 ? 'warn' : ''}"><small>Dose</small><b>${o.dose.toFixed(1)} mSv</b></span>`,
    temp != null ? `<span><small>Outside</small><b>${temp}°C</b></span>` : '',
    `<span><small>Sol ${o.sol}</small><b>${marsTime()}</b></span>`,
  ].join('');
  if (html !== visorKey) { visorKey = html; $('#visor').innerHTML = html; }
}

function drawToolbar() {
  const s = colony.s, key = JSON.stringify([s.belt, s.held, s.bag, s.jug, isTouch()]);
  if (key === toolbarKey) return;
  toolbarKey = key;
  const tb = $('#toolbar');
  tb.innerHTML = s.belt.map((t, i) => `<button data-slot="${i}" class="${i === s.held ? 'held' : ''}" title="${TOOLS[t].name}: ${TOOLS[t].desc}">${TOOLS[t].icon}<small>${keyWord(`${i + 1} · `, '')}${TOOLS[t].name}${t === 'jug' ? ` ${s.jug} L` : ''}</small></button>`).join('')
    + `<div class="bag" title="Rock samples you are carrying - unload them at the storage locker">${Object.keys(ORES).map(k => `<span>${oreDot(k)}${s.bag[k]}</span>`).join(' ')}<small>bag ${colony.bagCount()}/${BAG}</small></div>`;
  tb.querySelectorAll('[data-slot]').forEach(b => (b.onclick = e => { e.stopPropagation(); colony.select(+b.dataset.slot); toolbarKey = ''; }));
}

// The hazard monitor: live readings, and storms the instruments have spotted before they arrive.
function openMonitor() {
  const o = outpost, f = o.today, temp = outsideTemp(), w = marsNow?.weather, sun = sunToday(weather);
  o.hazards.forEach(h => (h.seen = true));
  const items = o.hazards.map((h, i) => {
    const n = h.at - o.sol, when = n <= 0 ? 'any moment now' : `in <b>${n} sol${n === 1 ? '' : 's'}</b>`;
    return h.kind === 'solar'
      ? `<div class="hazard solar"><b>☀️ Solar particle storm on the way</b> - arrives ${when}. The Sun has thrown out a cloud of fast particles, and it is crossing space towards Mars.<br>
         <button data-plan="${i}">${h.plan ? '✅ Crew will shelter when it hits' : '🏠 Plan: shelter when it arrives'}</button> <button data-shield>🛡 Shields up now</button></div>`
      : `<div class="hazard"><b>🌪 Dust storm growing</b> - reaches the outpost ${when}, and should last about ${h.sols} sols. Solar power will drop to about a third.<br><small>Get ready: clean the solar panels and give life support more power.</small></div>`;
  }).join('') || '<p>No storms spotted right now. The instruments update every sol, so check back often.</p>';
  modal({ pause: false, title: '📟 Hazard monitor', html: `
    <div class="readings">
      <div>Radiation inside<b>${f.dose.toFixed(2)} mSv/sol</b><small>${Math.round(f.protection * 100)}% blocked</small></div>
      <div>Radiation outside<b>${F.surfaceDose.value} mSv/sol</b><small>measured by Curiosity's RAD</small></div>
      <div>Your badge<b>${o.dose.toFixed(1)} / ${o.limit} mSv</b><small>NASA career limit</small></div>
      ${temp != null ? `<div>Outside now<b>${temp} °C</b><small>real: ${w.low} to ${w.high} °C (REMS)</small></div>` : ''}
      ${w ? `<div>Air pressure<b>${w.pressure} Pa</b><small>under 1% of Earth's</small></div>` : ''}
      <div>Dust<b>${o.dust ? 'Storm!' : w?.sky || 'Clear'}</b><small>panels ${Math.round(o.clean * 100)}% clean</small></div>
      <div>The Sun (NOAA)<b>${sun.count} flares</b><small>last 7 days · radiation level S${sun.radiationStorm ?? '?'}</small></div>
    </div>
    <h4>Forecast</h4>${items}
    ${factHTML(o.hazards.some(h => h.kind === 'dust') ? F.marci : F.cme)}`, choices: [{ label: 'Done', primary: true }] });
  const box = $('#modal .modal-box');
  box.querySelectorAll('[data-plan]').forEach(b => (b.onclick = () => { const h = o.hazards[+b.dataset.plan]; h.plan = !h.plan; b.textContent = h.plan ? '✅ Crew will shelter when it hits' : '🏠 Plan: shelter when it arrives'; }));
  box.querySelectorAll('[data-shield]').forEach(b => (b.onclick = () => { o.setSplit({ ...o.split, shield: Math.max(o.split.shield, 0.45), science: o.split.science * 0.4, comms: o.split.comms * 0.8 }); toast('🛡 Shields up! Science and the radio get less power for now.'); }));
}

// The storage locker: tools, samples, seeds and water - and the radio link for trading with Earth.
function openLocker() {
  const unloaded = colony.unload(); if (unloaded) toast(`🪨 Unloaded ${unloaded} rock sample${unloaded === 1 ? '' : 's'} into storage.`);
  const s = colony.s, o = outpost, link = o.today.link, beltFull = s.belt.length >= 2;
  const onWay = pending.filter(p => p.cargo);
  const req = s.request;
  const shop = SHOP.map(item => `<button data-buy="${item.id}" ${!link || !colony.canPay(item.price, o) ? 'disabled' : ''}><span><b>${item.label}</b><small>${priceWords(item.price)}</small></span></button>`).join('');
  modal({ pause: false, title: '🗄 Storage locker', html: `
    <div class="inv-grid">
      <div><h5>Tool belt (holds 2)</h5>${s.belt.map(t => `<div>${TOOLS[t].icon} ${TOOLS[t].name} <button data-store="${t}">Put away</button></div>`).join('') || '<p>Empty</p>'}</div>
      <div><h5>In the locker</h5>${s.locker.map(t => `<div>${TOOLS[t].icon} ${TOOLS[t].name} <button data-take="${t}" ${beltFull ? 'disabled title="Your belt is full - put a tool away first"' : ''}>Take</button></div>`).join('') || '<p>Empty</p>'}</div>
      <div><h5>Rock samples</h5>${Object.keys(ORES).map(k => `<div>${oreDot(k)}${ORES[k].name}: <b>${s.store[k]}</b></div>`).join('')}<div>🔩 Parts: <b>${o.parts}</b></div></div>
      <div><h5>Seeds and water</h5>${Object.keys(CROPS).map(k => `<div>${CROPS[k].icon} ${CROPS[k].name}: <b>${s.seeds[k]}</b></div>`).join('')}
        <div>💧 Water tank: <b>${s.tank} L</b> · jug: <b>${s.jug} L</b></div>
        <button data-fill ${!colony.has('jug') || s.tank <= 0 || s.jug >= JUG_L ? 'disabled' : ''}>Fill the water jug</button>${colony.has('jug') ? '' : '<small> (take the jug first)</small>'}</div>
    </div>
    <h4>📡 Trade with Earth</h4>
    ${link ? '<p>Scientists on Earth want Mars samples. Pay with samples from storage; your order comes down on a cargo pod in about 3 sols.</p>' : '<p class="neg">The Earth link is off. Give "Talk to Earth" more power at the console to trade.</p>'}
    ${req ? `<div class="hazard"><b>Request:</b> ${req.who} wants <b>${req.n} ${ORES[req.ore].name.toLowerCase()}</b> (until sol ${req.until}). Reward: +${req.reward.science} science and ${cargoWords(req.reward)}. <button data-request ${!link || s.store[req.ore] < req.n ? 'disabled' : ''}>Send samples</button></div>` : ''}
    <div class="shop">${shop}</div>
    ${onWay.length ? `<p class="source">On the way: ${onWay.map(p => `${cargoWords(p.cargo)} (lands sol ${p.sol})`).join('; ')}</p>` : ''}
    ${factHTML(F.samples)}`, choices: [{ label: 'Done', primary: true }] });
  const box = $('#modal .modal-box'), again = () => { toolbarKey = ''; openLocker(); };
  box.querySelectorAll('[data-take]').forEach(b => (b.onclick = () => { colony.take(b.dataset.take); again(); }));
  box.querySelectorAll('[data-store]').forEach(b => (b.onclick = () => { colony.store(b.dataset.store); again(); }));
  box.querySelector('[data-fill]')?.addEventListener('click', () => { const l = colony.fillJug(); toast(`💧 Filled the jug with ${l} L.`); again(); });
  box.querySelectorAll('[data-buy]').forEach(b => (b.onclick = () => {
    const item = SHOP.find(x => x.id === b.dataset.buy);
    if (!colony.pay(item.price, o)) return;
    pending.push({ sol: o.sol + 3, type: 'pod', cargo: item.gives });
    toast(`📡 Order sent: ${item.label}. It lands near the outpost in about 3 sols.`, 4500); again();
  }));
  box.querySelector('[data-request]')?.addEventListener('click', () => {
    s.store[req.ore] -= req.n; o.scienceSent += req.reward.science;
    pending.push({ sol: o.sol + 3, type: 'pod', cargo: { seeds: req.reward.seeds } }); s.request = null;
    toast(`🔬 Samples sent! +${req.reward.science} science. Your reward seeds are on the next cargo pod.`, 5000); again();
  });
}

// A greenhouse you built: plant, water, harvest.
function openGreenhouse(h) {
  const s = colony.s, gh = h.gh, c = gh.crop && CROPS[gh.crop];
  const status = !c ? '<p>Empty. Plant some seeds!</p>'
    : gh.ready ? `<p class="pos">${c.icon} <b>${c.name}</b> - ripe and ready to harvest (${c.meals} meals).</p>`
    : `<p>${c.icon} <b>${c.name}</b> - ${Math.round(gh.grown * 100)}% grown. Ready in about ${Math.ceil((1 - gh.grown) * c.sols - 1e-6)} sol(s) <small>(in real life: ${c.real})</small>.</p>`;
  const plantBtns = !c ? Object.entries(CROPS).map(([k, cr]) => `<button data-plant="${k}" ${s.seeds[k] ? '' : 'disabled'}><span><b>${cr.icon} ${cr.name}</b><small>${s.seeds[k]} seeds · grows in ${cr.sols} sols · drinks ${cr.water} L · ${cr.meals} meals</small></span></button>`).join('') : '';
  const how = h.base ? `This bed is plumbed into the outpost's water tank (<b>${s.tank.toFixed(0)} L</b> left - melt ice to refill it).` : colony.has('jug') ? `Your jug holds <b>${s.jug} L</b>.` : 'Bring the water jug from the locker to top it up.';
  modal({ pause: false, title: h.base ? `🌱 Grow bed ${h.bed + 1}` : '🌱 Your greenhouse', html: `${status}
    <p>💧 Water: <b>${gh.tank.toFixed(1)} / ${GREENHOUSE.tank} L</b>${c && !gh.ready ? ` · the plants drink ${(c.water / c.sols).toFixed(1)} L a sol` : ''}. ${how}</p>
    <div class="shop">${plantBtns}
      ${h.base && s.tank > 0 && gh.tank < GREENHOUSE.tank ? '<button data-pipe><span><b>💧 Fill from the water pipe</b></span></button>' : ''}
      ${!h.base && colony.has('jug') && s.jug > 0 && gh.tank < GREENHOUSE.tank ? '<button data-water><span><b>💧 Pour in the water</b></span></button>' : ''}
      ${gh.ready ? '<button data-harvest class="primary"><span><b>🧺 Harvest</b></span></button>' : ''}</div>
    ${factHTML(c ? F.veggie : F.perchlorate)}`, choices: [{ label: 'Done', primary: true }] });
  const box = $('#modal .modal-box'), again = () => { toolbarKey = ''; openGreenhouse(h); };
  box.querySelectorAll('[data-plant]').forEach(b => (b.onclick = () => { colony.plant(h, b.dataset.plant); toast(`🌱 Planted ${CROPS[b.dataset.plant].name.toLowerCase()}.`); again(); }));
  box.querySelector('[data-pipe]')?.addEventListener('click', () => { const l = colony.waterFromPipe(h); toast(`💧 ${l.toFixed(0)} L of water flowed into the bed.`); again(); });
  box.querySelector('[data-water]')?.addEventListener('click', () => { const l = colony.water(h); toast(`💧 Poured ${l} L into the hydroponic tank.`); again(); });
  box.querySelector('[data-harvest]')?.addEventListener('click', () => { const m = colony.harvest(h, outpost); toast(`🧺 Harvested! +${m} meals for the crew.`); again(); });
}

// Building with the builder tool: a greenhouse goes a few metres in front of you.
function openBuild() {
  const spot = colony.buildSpot(world.player.position, world.yaw), cost = GREENHOUSE.cost, s = colony.s;
  const have = Object.entries(cost).map(([k, n]) => `${k === 'parts' ? '🔩' : oreDot(k)} ${n} ${k === 'parts' ? 'parts' : ORES[k].name.toLowerCase()} <small>(have ${k === 'parts' ? outpost.parts : s.store[k]})</small>`).join(' · ');
  const can = spot.ok && colony.canPay(cost, outpost);
  modal({ pause: false, title: '🛠 Build a greenhouse', html: `
    <p>An inflatable greenhouse with hydroponic racks and pink LED lights. It needs: ${have}. Samples must be in the base storage (unload your bag at the locker first).</p>
    ${spot.ok ? '<p class="pos">✅ Good spot - flat, clear and close to the outpost.</p>' : `<p class="neg">${spot.why}</p>`}
    ${factHTML(F.perchlorate)}`,
    choices: [can ? { label: '🛠 Build it here', primary: true, onPick: () => {
      colony.pay(cost, outpost); colony.build(spot, world.yaw);
      modal({ pause: false, title: '🏕 Greenhouse built!', html: `<p>Now plant seeds and fill its water tank: carry water from the base tank in the jug. Plants grow every sol while they have water.</p>${factHTML(F.veggie)}` });
    } } : { label: 'OK', primary: true }] });
}

// ---------------- events from the simulation ----------------
// Mission Control's portrait + an event picture, when the team has added them (assets/art/)
const eventArt = (type, alt) => speakerHTML('mission-control', 'Mission Control') + artHTML('event-' + type, alt, 'event-art');

function handle(ev) {
  switch (ev.type) {
    case 'solar-storm-warning': {
      const real = pickStormEvent(weather);
      const strength = Math.max(0.6, flareStrength(real.cls));
      outpost.startStorm(strength, real.cls, real.real);
      const surprise = ev.seen === false, planned = !!ev.plan;
      if (surprise) outpost.dose += TUNED.surpriseDose * strength * TUNED.stormDose / outpost.storm.total * (1 - outpost.today.protection);   // caught in the open
      if (planned) { outpost.shelter = outpost.storm.sols; if (!inside) toast('Head back to the outpost - the crew is going into the shelter!', 4500); }
      const when = real.time ? new Date(real.time).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      say('storm');
      modal({ title: '☀️ Solar storm warning!', html: `${eventArt('solar-storm', 'A solar storm reaching Mars')}
        <p>The Sun just shot out ${flareWords(real.cls)}. Fast particles are hitting Mars - they will keep coming for about ${outpost.storm.sols} sols.</p>
        ${surprise ? `<p class="neg">⚠️ <b>Nobody checked the hazard monitor</b>, so this storm arrived without warning. The crew got a dose of radiation before they could react. Check the monitor inside the base every sol or two.</p>${factHTML(F.cme)}` : planned ? '<p class="pos">✅ You saw it coming on the hazard monitor, so the crew went straight into the storm shelter as planned.</p>' : '<p>The hazard monitor warned you about this one.</p>'}
        ${real.real ? `<p class="fact"><span class="real-tag">REAL</span>This storm is based on a real <b>${real.cls}</b> flare seen by ${real.source}${when ? ' on ' + when : ''}.</p>` : ''}
        <p>${planned ? 'Sheltering already. Anything else?' : 'What do you do?'}</p>`,
        choices: planned ? [{ label: 'Stay in the shelter', primary: true }] : [
          { label: '🏠 Hide in the storm shelter', cost: `Safest. But no science for ${outpost.storm.sols} sols, and you must be inside the outpost.`, onPick: () => { outpost.shelter = outpost.storm.sols; if (!inside) toast('Head back to the outpost - the shelter only works inside!', 4500); } },
          { label: '🛡 Put more power into shielding', cost: 'Takes power away from science and talking to Earth.', onPick: () => { outpost.setSplit({ ...outpost.split, shield: Math.max(outpost.split.shield, 0.45), science: outpost.split.science * 0.4, comms: outpost.split.comms * 0.8 }); toast('🛡 Shields up! Science and the radio get less power for now.'); } },
          { label: '⛏ Keep working and hope for the best', cost: 'You keep everything running - but your radiation badge will fill up much faster.' },
        ] });
      break;
    }
    case 'storm-end': toast('☀️ The solar storm has passed.'); break;
    case 'hazard-detected':   // the monitor inside blinks; the first time, tell the player where to look
      if (!monitorTipShown) { monitorTipShown = true; toast('📟 New reading! The hazard monitor inside the base has spotted something. Go and check it.', 6000); }
      break;
    case 'dust':
      world.setDust(true); say('dust');
      if (ev.seen === false) outpost.clean = Math.max(0.3, outpost.clean - 0.12);   // no warning: the panels were caught dirty and got caked
      outpost.today = outpost.forecast();
      modal({ title: '🌪 Dust storm!', html: `${eventArt('dust-storm', 'A dust storm covering the outpost')}${ev.seen === false ? '<p class="neg">⚠️ Nobody checked the hazard monitor, so it arrived without warning and caked the solar panels in extra dust.</p>' : ev.seen ? '<p class="pos">You saw this one coming on the hazard monitor.</p>' : ''}<p>Dust is blocking the sunlight. Your solar panels only make about a third of their normal power for ${ev.sols} sols. Consider moving power from science to life support at the console.</p>${factHTML(F.dustStorm)}` });
      break;
    case 'dust-end': world.setDust(false); toast('🌤 The dust storm is over - full power again!'); break;
    case 'conjunction': say('conjunction'); modal({ title: '📵 The Sun is in the way!', html: `${eventArt('conjunction', 'The Sun between Earth and Mars')}${factHTML(F.conjunction)}<p>No supply pods and no new designs from Earth until it passes. Your science waits safely until then.</p>` }); break;
    case 'blackout-end': toast('📡 Earth can hear you again!'); break;
    case 'supply-launched':
      say('supply');
      toast(`📡 Earth heard you (your message took ${ev.delay.toFixed(1)} minutes to get there). A supply pod is coming!`, 5000);
      pending.push({ sol: outpost.sol + 3, type: 'pod' }); break;
    case 'supply-missed': toast('📡 Earth couldn\'t hear you - not enough power for the radio. No supply pod this time.', 5000); break;
    case 'tier-up': {
      const t = TIERS[ev.tier], designs = Object.values(UPGRADES).filter(u => u.tier === ev.tier);
      say('design');
      modal({ title: `🏗 Your base is now a ${t.name}!`, html: `${eventArt('tier-up', 'The outpost growing bigger')}<p>Earth's engineers studied the science you sent and radioed you new designs:</p><p>${designs.map(u => `• <b>${u.name}</b> - ${u.desc}`).join('<br>')}</p><p>Build them at the <b>workbench</b> inside the outpost using parts.</p>` });
      break;
    }
    case 'cold-night': toast('🥶 Your batteries ran flat before morning - the cold slowed the oxygen maker and greenhouse. Build an extra battery!', 5000); break;
    case 'wind-clean': toast('💨 A gust of wind blew some dust off your solar panels! (This really happened to the Spirit and Opportunity rovers.)', 5000); break;
    case 'relay-lost': outpost.today = outpost.forecast(); say('relay'); modal({ title: '📡 A relay orbiter has failed!', html: `${eventArt('relay-lost', 'A relay orbiter above Mars')}<p>Your messages to Earth usually bounce off orbiters circling Mars. One of them just went silent. Until Earth moves another one into place (about ${outpost.relayDown} sols), you must talk straight to Earth - which needs much more power.</p>${factHTML(F.relay)}` }); break;
    case 'relay-restored': toast('📡 A new relay orbiter is in place - talking to Earth is easy again.'); break;
  }
}

function collect(n) {
  if (n.type === 'door') return goInside();
  if (n.type === 'ship') return goInShip();
  if (n.type === 'ghdoor') return goInGreenhouse('out');
  if (n.type === 'ore') return mine(n.deposit);
  if (n.type === 'greenhouse') return openGreenhouse(n.house);
  if (n.type === 'sev') {
    world.enterRover();
    if (!world.sevShown) { world.sevShown = true; modal({ pause: true, title: '🚙 The crew rover', html: `<p>This is NASA's <b>Space Exploration Vehicle</b> - a real design for a small rover the crew can live in. Inside, the air is like the outpost's, so you take off your helmet and your <b>suit air refills</b>. Astronauts get in and out through <b>suitports</b> at the back: the spacesuits stay docked outside, so no dust comes in.</p><p><b>${keyWord('W / S', 'Left thumb up / down')}</b> to drive, <b>${keyWord('A / D', 'left / right')}</b> to steer, <b>${keyWord('E', 'Use')}</b> to climb out. Driving uses the rover's <b>battery</b>: park it near the outpost to charge it.</p><p class="source">Real NASA 3D model (NASA 3D Resources). In the game it drives faster than the real one so trips are short.</p>`, choices: [{ label: "Let's drive!", primary: true }] }); }
    else toast(`🚙 In the rover - battery ${Math.round(world.sev.battery * 100)}%. ${keyWord('E', 'Use')} to get out.`);
    return;
  }
  if (n.type === 'sev-exit') { world.exitRover(); toast('🧑‍🚀 Out through the suitport at the back of the rover.'); return; }
  if (n.type === 'panels') {
    outpost.cleanPanels(); world.setPanelDust(1); world.panelsDirty = false;
    modal({ title: '🧽 Solar panels cleaned!', html: `<p>Back to full power. Dust settles on them a little every sol - and a lot during dust storms - so check them often.</p>${factHTML(F.dustPanels)}` });
    return;
  }
  if (n.type === 'rover') {
    world.rover.salvaged = true; outpost.parts += 8; say('rover');
    world.rover.group.children[0].visible = false; // switch off its beacon
    modal({ title: '🤖 You found an old rover!', html: `${factHTML(F.perseverance)}${factHTML(F.moxie)}<p>You carefully salvage <b>8 spare parts</b> for your workbench.</p>` });
    return;
  }
  if (n.type === 'heli') {
    world.heli.seen = true;
    modal({ title: '🚁 Ingenuity - the first helicopter on another planet', html: `<p>This little helicopter weighs only 1.8 kg. It is made from NASA's own 3D model, at its real size.</p>${factHTML(F.ingenuity)}<p>The air on Mars is so thin that its blades had to spin thousands of times a minute - much faster than a helicopter's on Earth - just to lift off.</p>` });
    return;
  }
  const p = n.pickup; world.removePickup(p);
  if (p.kind === 'ice') { outpost.o2 += 4; colony.s.tank += 8; toast('🧊 Ice! Melted into 8 L for the water tank, and split into +4 kg oxygen'); }
  if (p.kind === 'metal') { outpost.parts += 1; toast('🔩 Useful metal: +1 part'); }
  if (p.kind === 'pod' && p.cargo) { colony.receive(p.cargo, outpost); toast(`📦 Your order from Earth: ${cargoWords(p.cargo)}. Seeds go into the storage locker.`, 5000); }
  else if (p.kind === 'pod') { outpost.o2 += 15; outpost.food += 20; outpost.parts += 3; toast('📦 Supplies from Earth: +15 kg oxygen, +20 meals, +3 parts'); }
}

function endMission() {
  clearSave();   // the mission is over, so there is nothing to resume
  document.exitPointerLock?.();
  const o = outpost.over;
  say(o.win ? 'win' : 'lose');
  const why = {
    complete: `You kept your crew alive for all ${outpost.d.sols} sols. Mission complete! Your base reached the "${TIERS[outpost.tier].name}" tier.`,
    settlement: `Your base makes its own power, oxygen and food - a self-sustaining settlement on Mars! That is the big goal of NASA's Moon to Mars plans.`,
    oxygen: 'The oxygen ran out. Next time give life support more power, or collect more ice to make oxygen.',
    food: 'The crew ran out of food. The greenhouse needs power from life support - or supply pods from Earth.',
    radiation: `Your radiation badge reached NASA's ${F.careerLimit.value} mSv limit, so the crew had to go home. Try more shielding, or hiding in the shelter during solar storms.`,
  }[o.why];
  modal({ title: o.win ? '🏆 Mission complete!' : '🚀 Mission over', html: `
    <p>${why}</p>
    <p>Sols survived: <b>${outpost.sol}</b> · Science sent to Earth: <b>${outpost.scienceSent}</b> · Radiation: <b>${outpost.dose.toFixed(0)} mSv</b> · Score: <b>${outpost.score()}</b></p>
    ${factHTML(F.roundTrip)}
    <h4>📒 You collected ${logbook.size} real NASA fact cards. Quick quiz for your badge:</h4>
    <div id="quiz"></div><div id="badge"></div>
    <details><summary>📒 Read my logbook</summary><div class="log-list">${[...logbook.values()].map(f => factHTML(f, false)).join('')}</div></details>`,
    choices: [{ label: 'Play again', primary: true, onPick: () => location.reload() }] });
  const qs = pickQuestions(new Set(logbook.keys()));
  runQuiz($('#quiz'), qs, score => {
    const b = badgeFor(score, qs.length);
    $('#badge').innerHTML = `<div class="badge">${hasArt('badge-' + b.key) ? artHTML('badge-' + b.key, b.name + ' badge', 'badge-art') : `<b>${b.icon}</b>`}${score} of ${qs.length} right - you earned the <b>${b.name}</b> badge!</div>`;
    try { const best = +localStorage.getItem('ja-best') || 0; if (score > best) localStorage.setItem('ja-best', score); } catch { /* storage blocked */ }
  });
}

// ---------------- input ----------------
// One place for the game's actions - the keyboard and the touch buttons both come here
function pressKey(code) {
  if (state.phase !== 'mars' || isModalOpen()) return;
  if (code === 'KeyE') {
    if (inside) { const s = room.nearest(); if (s) stationAction(s); }
    else { const n = world.nearest(); if (n) collect(n); else if (colony.tool === 'builder' && !world.driving) openBuild(); }
  }
  if ((code === 'Digit1' || code === 'Digit2') && colony) { colony.select(+code.slice(5) - 1); toolbarKey = ''; }
  if (code === 'KeyP') openPower();
  if (code === 'KeyL') openLogbook();
  if (code === 'KeyM') muteButton();
  if (code === 'KeyV' && !inside) { world.firstPerson = !world.firstPerson; toast(world.firstPerson ? `👁 First-person view (${keyWord('V', 'tap View')} to switch back)` : '🎥 Third-person view'); }
}
addEventListener('keydown', e => { if (world) world.keys[e.code] = true; pressKey(e.code); });
addEventListener('keyup', e => { if (world) world.keys[e.code] = false; });
// Mouse look needs pointer lock (desktop only). Phones have no pointer lock - they use the touch drag below.
let lastPointer = 'mouse';
$('#view').addEventListener('pointerdown', e => { lastPointer = e.pointerType; });
const mouseLocked = () => document.pointerLockElement === $('#view');
function captureMouse() {
  if (state.phase !== 'mars' || isModalOpen() || isTouch()) return;
  try { $('#view').requestPointerLock?.()?.catch?.(() => {}); } catch { /* no pointer lock here */ }
}
$('#view').addEventListener('click', () => { if (lastPointer !== 'touch') captureMouse(); });
// Free the mouse (Esc, which the browser always handles, or C) and capture it again (click the game, or C).
addEventListener('keydown', e => {
  if (e.code !== 'KeyC' || e.repeat || state.phase !== 'mars' || isModalOpen()) return;
  if (mouseLocked()) document.exitPointerLock?.(); else captureMouse();
});
// A small note says which mode the mouse is in, so nobody gets "stuck" in the game.
const mouseNote = document.createElement('div'); mouseNote.id = 'mouse-note'; mouseNote.className = 'hidden';
$('#hud').appendChild(mouseNote);
let mouseNoteKey = '';
function drawMouseNote() {
  const show = state.phase === 'mars' && !isTouch() && !isModalOpen() && !outpost?.over;
  const text = !show ? '' : mouseLocked() ? '🖱 Mouse is steering the view · <b>Esc</b> or <b>C</b> frees the mouse' : '🖱 Mouse is free · <b>click the game</b> or press <b>C</b> to look around';
  if (text === mouseNoteKey) return;
  mouseNoteKey = text; mouseNote.innerHTML = text; mouseNote.classList.toggle('hidden', !text); mouseNote.classList.toggle('locked', mouseLocked());
}
document.addEventListener('pointerlockchange', drawMouseNote);
// Turning the camera: the mouse and the touch drag share the same math
function look(dx, dy) {
  if (!world) return;
  if (inside) {
    room.yaw -= dx * 0.0032;
    room.pitch = Math.max(-1.2, Math.min(1.2, room.pitch - dy * 0.0028));
  } else {
    world.yaw -= dx * 0.0032;
    if (world.firstPerson) world.lookPitch = Math.max(-1.2, Math.min(1.2, world.lookPitch - dy * 0.0028));
    else world.pitch = Math.max(-0.15, Math.min(1.2, world.pitch + dy * 0.0025));
  }
}
addEventListener('mousemove', e => { if (document.pointerLockElement === $('#view')) look(e.movementX, e.movementY); });
const touch = initTouch({ keys: () => world?.keys, look, press: pressKey });

// Screen size: Auto / Phone / Tablet / Desktop (title screen row + a HUD button)
const pick = $('#screen-pick');
pick.insertAdjacentHTML('beforeend', SCREEN_MODES.map(m => `<button data-screen="${m}">${screenName(m)}</button>`).join(''));
pick.querySelectorAll('button').forEach(b => b.onclick = () => setScreenMode(b.dataset.screen));
$('#screen-btn').onclick = () => { nextScreenMode(); toast(`📱 Screen: ${screenName(screenMode())}`); };
onLayout((mode, used) => {
  pick.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.screen === mode));
  $('#screen-btn').textContent = `📱 Screen: ${screenName(mode)}${mode === 'auto' ? ` (${screenName(used)})` : ''}`;
});
$('#menu-btn').onclick = () => $('#hud').classList.toggle('menu-open');

// Full screen: hides the browser's bars so the game fills the phone like an app. (iPhones don't allow
// this for web pages - there, "Add to Home Screen" gives the same thing, thanks to manifest.webmanifest.)
const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
document.body.classList.toggle('can-fullscreen', canFullscreen);
function goFullscreen() {
  const el = document.documentElement;
  try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch { /* not allowed here */ }
}
function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  else goFullscreen();
}
document.querySelectorAll('.fs-btn').forEach(b => (b.onclick = toggleFullscreen));
let sidewaysTip = false;
function phoneTips() {   // once per game: on a phone held upright, suggest turning it for a bigger view
  if (sidewaysTip || !isTouch() || !document.body.classList.contains('layout-phone') || innerWidth > innerHeight) return;
  sidewaysTip = true; setTimeout(() => toast('📱 Tip: turn your phone sideways for a bigger view of Mars.'), 2500);
}
$('#power-btn').onclick = openPower;
$('#log-btn').onclick = openLogbook;
const soundLabel = () => { $('#sound-btn').textContent = `${isMuted() ? '🔇' : '🔊'} Sound${keyWord(' (M)', '')}`; };
function muteButton() { const m = toggleMute(); soundLabel(); toast(m ? '🔇 Sound off' : '🔊 Sound on - the wind is a real recording from Mars'); }
$('#sound-btn').onclick = muteButton;
soundLabel(); addEventListener('touchstart', soundLabel, { passive: true, once: true });
$('#view-btn').onclick = () => { if (world && !inside) world.firstPerson = !world.firstPerson; };
$('#speed-btn').onclick = () => { state.speed = state.speed === 1 ? 3 : 1; $('#speed-btn').textContent = 'Speed ×' + state.speed; };
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); world?.resize(); launch?.resize(); interior?.resize(); capsule?.resize(); });

// ---------------- HUD ----------------
function drawHUD() {
  const o = outpost, f = o.today;
  // Short numbers on the chips; the full sentence shows when you hover over one
  const o2Left = f.o2Net >= 0 ? null : Math.floor(o.o2 / -f.o2Net), foodLeft = f.foodNet >= 0 ? null : Math.floor(o.food / -f.foodNet);
  meter('#m-o2', o.o2 / 60, `${o.o2.toFixed(0)} kg${o2Left !== null && o2Left < 15 ? ` · ${o2Left} sols` : ''}`);
  meter('#m-food', o.food / 60, `${o.food.toFixed(0)}${foodLeft !== null && foodLeft < 15 ? ` · ${foodLeft} sols` : ''}`);
  meter('#m-power', f.total / (o.panels * TUNED.kWhPerPanel + o.reactors * TUNED.reactorKWh), `${f.total.toFixed(0)} kWh${o.dust ? ' · dust!' : ''}`);
  meter('#m-rad', o.dose / o.limit, `${o.dose.toFixed(1)} mSv`, true);
  $('#m-suit').classList.toggle('hidden', inside);
  meter('#m-suit', suit, `${Math.round(suit * o.suitSeconds())} s`);
  $('#m-o2').title = `Oxygen: ${o.o2.toFixed(1)} kg · ${o2Left === null ? 'steady' : o2Left + ' sols left'}`;
  $('#m-food').title = `Food: ${o.food.toFixed(0)} meals · ${foodLeft === null ? 'steady' : foodLeft + ' sols left'}`;
  $('#m-power').title = `Power today: ${f.total.toFixed(0)} kWh/sol · panels ${Math.round(o.clean * 100)}% clean${o.dust ? ' · dust storm!' : ''}`;
  $('#m-rad').title = `Radiation badge: ${o.dose.toFixed(1)} of ${o.limit} mSv`;
  $('#m-suit').title = `Suit oxygen: ${Math.round(suit * o.suitSeconds())} s of air left`;
  $('#sol').textContent = `Sol ${o.sol} of ${o.d.sols}`;
  // time of day (1 s = 1 Mars hour) and a battery gauge: charges in daylight, the heater drains it at night
  const ph = solClock / TUNED.solSeconds, hour = Math.floor(ph * 24.66), isDay = ph > TUNED.dayStart && ph < TUNED.dayEnd;
  const nightDone = ph >= TUNED.dayEnd ? (ph - TUNED.dayEnd) / (1 - TUNED.dayEnd + TUNED.dayStart) : (ph + 1 - TUNED.dayEnd) / (1 - TUNED.dayEnd + TUNED.dayStart);
  const battery = o.reactors ? 1 : isDay ? Math.min(1, (ph - TUNED.dayStart) / 0.3) : Math.max(0, 1 - nightDone * TUNED.heaterKWh / o.battery);
  $('#tod').textContent = `${isDay ? '☀️ Day' : '🌙 Night'} · ${String(hour).padStart(2, '0')}:00 Mars time · 🔋 ${Math.round(battery * 100)}% · 🏗 ${TIERS[o.tier].name}`;
  $('#credits').textContent = `🔩 ${o.parts} parts · 🔬 ${o.scienceSent} science sent${o.science >= 1 ? ` (+${Math.floor(o.science)} waiting)` : ''}`;
  $('#link').textContent = f.link ? `📡 Earth link on · messages take ${o.delayMinutes().toFixed(1)} min` : (o.blackout ? '📵 Sun blocking the radio' : '📡 Earth link OFF (needs more power)');
  const list = [];
  if (o.storm) list.push({ text: `☀️ Solar storm! ${o.shelter ? (inside ? 'Sheltering - stay inside' : 'Get back inside!') : 'Get inside or shield up!'}` });
  if (o.dust) list.push({ text: `🌪 Dust storm: ${o.dust} sols left` });
  if (f.o2Net < 0 && o.o2 / -f.o2Net < 8) list.push({ text: '🫁 Oxygen running low - more power to life support!' });
  if (world.driving && world.sev.battery < 0.25) list.push({ text: world.sev.battery > 0 ? '🔋 Rover battery low - drive back to the outpost to charge' : '🔋 Rover battery flat - crawling home slowly' });
  if (!inside && !world.driving && suit < 0.3) list.push({ text: '🧑‍🚀 Suit air low - go back inside!' });
  if (o.clean < 0.7) list.push({ text: '🧽 Solar panels are dusty - go and clean them!' });
  if (f.cold) list.push({ text: '🥶 Batteries too small for the night heater' });
  if (o.relayDown) list.push({ text: `📡 Relay orbiter lost: ${o.relayDown} sols` });
  alerts(list);
  const fp = !inside && world.firstPerson;
  document.body.classList.toggle('fp', fp);
  $('#helmet').classList.toggle('hidden', !fp || world.driving || isModalOpen());
  if (fp) drawVisor();
  drawToolbar();
  $('#crosshair').classList.toggle('hidden', !(inside || world.firstPerson) || isModalOpen());
  let hint = '', near = null;
  const useWord = keyWord('Press E', 'Tap Use');
  if (!isModalOpen()) {
    if (inside) {
      near = room.nearest();
      hint = near ? `${useWord} to ${near.label}` : `Walk to a station · ${keyWord('click', 'drag')} to look around`;
    } else {
      near = world.nearest();
      const names = { door: 'go inside the outpost', rover: 'salvage the old rover', heli: 'look at the Ingenuity helicopter', ice: 'collect ice', metal: 'collect metal parts', pod: 'open the supply pod', panels: `clean the dusty solar panels (${Math.round(o.clean * 100)}% clean)` };
      names.sev = 'get in the rover and drive'; names.ship = 'climb the ladder into your lander'; names.ghdoor = 'go into the greenhouse'; names['sev-exit'] = 'climb out';
      if (near?.type === 'ore') hint = `${useWord} to mine ${ORES[near.deposit.ore].name.toLowerCase()}${colony.tool === 'pickaxe' ? '' : ' with your pickaxe'}${colony.bagCount() >= BAG ? ' (bag full!)' : ''}`;
      else if (near?.type === 'greenhouse') hint = `${useWord} to tend the greenhouse${near.house.gh.ready ? ' - ready to harvest!' : ''}`;
      else if (world.driving) hint = `🚙 Battery ${Math.round(world.sev.battery * 100)}% · ${keyWord('W/S drive, A/D steer', 'left thumb drives')} · ${useWord} to climb out`;
      else if (!near && colony.tool === 'builder') hint = `🛠 ${useWord} to build a greenhouse in front of you`;
      else hint = near ? `${useWord} to ${names[near.type]}` : (tutorialStep === 0 ? keyWord('Walk to the outpost door (green light) · click the game to look around · V for first person', 'Walk to the outpost door (green light) · left thumb moves, right thumb looks') : '');
    }
  }
  const hintEl = $('#hint');                       // a hint that is no longer needed fades away slowly
  if (hint) { if (hintEl.textContent !== hint) hintEl.textContent = hint; hintEl.classList.remove('gone'); }
  else hintEl.classList.add('gone');
  drawMouseNote();
  touch.sync({ active: !isModalOpen() && !o.over, canUse: !!near || (!inside && colony.tool === 'builder'), inside });
}

// Testing helper for the team: open the game with #debug in the address, then use
// game.event('solar-storm-warning'), game.event('dust', {sols: 5}), game.outpost.parts = 50 ...
if (location.hash === '#debug') window.game = { get colony() { return colony; }, get outpost() { return outpost; }, get launch() { return launch; }, get world() { return world; }, get interior() { return interior; }, get capsule() { return capsule; }, goInShip: () => goInShip(), goInGreenhouse: (f = 'hab') => goInGreenhouse(f), get ghRoom() { return ghRoom; }, get inside() { return inside; }, event: (type, extra = {}) => queue.push({ type, ...extra }), goInside: () => goInside(), station: t => stationAction({ type: t }), sound: soundDebug, phase: p => (solClock = p * TUNED.solSeconds) };
let sunsetShown = false;

// Launch captions: when the words change, the old ones fade out slowly while the new ones fade in,
// so there is time to finish reading. The countdown number and the height gauge update in place.
let cdKey = null, cdLine = null;
const cdAlt = document.createElement('em'); cdAlt.className = 'cd-alt hidden'; $('#countdown').appendChild(cdAlt);
function showCaption(big, bigClass, caption) {
  if (caption !== cdKey) {
    cdKey = caption;
    if (cdLine) { const old = cdLine; old.classList.add('leaving'); setTimeout(() => old.remove(), 1200); }
    cdLine = document.createElement('div'); cdLine.className = 'cd-line entering';
    cdLine.innerHTML = '<span></span><small></small>';
    cdLine.querySelector('small').textContent = caption;
    $('#countdown').insertBefore(cdLine, cdAlt);
    void cdLine.offsetWidth; cdLine.classList.remove('entering');   // start the fade-in
  }
  const sp = cdLine.querySelector('span'); sp.className = bigClass; if (sp.textContent !== big) sp.textContent = big;
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
// The menu uses the team's existing badge; optional story panels still work.
{ const l = document.createElement('link'); l.rel = 'icon'; l.href = 'assets/zhetalis-badge.png'; document.head.appendChild(l); }
if (storyPanels().length) {
  const b = document.createElement('button'); b.id = 'story-btn'; b.textContent = '📖 The story'; b.onclick = showStory;
  $('#path-btn').before(b);
}
function showStory() {
  const panels = storyPanels(); let i = 0;
  const draw = () => modal({ title: `📖 The story (${i + 1}/${panels.length})`, html: `${artHTML(base(panels[i].file), panels[i].caption, 'story-art')}<p>${panels[i].caption || ''}</p>`,
    choices: [...(i < panels.length - 1 ? [{ label: 'Next ›', primary: true, onPick: () => { i++; draw(); } }] : [{ label: 'Close', primary: true }])] });
  const base = f => f.replace(/\.[a-z0-9]+$/i, '');
  draw();
}
$('#loading').classList.add('hidden');
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.phase === 'launch') {
    const { left, lifted, title, caption, km, karman } = launch.update(dt);
    const lift = -left;   // seconds since lift-off: engines start at T-1.5, full power after lift-off, quieter once the core stage is gone
    setSound({ thrust: left > 1.5 ? 0 : lift < 0 ? 0.5 : lift < 37 ? 1 : 0.25 }); tickSound(dt);
    showCaption(lifted ? title : String(Math.max(0, left)), lifted ? 'cd-phase' : '', caption);
    cdAlt.classList.toggle('hidden', !lifted); cdAlt.classList.toggle('space', !!karman);
    cdAlt.textContent = `Height: ${Math.round(km)} km${km >= 100 ? ' · in space!' : ''}`;
    if (karman) logFact(F.karman);
    if (lifted && !launch.logged) { launch.logged = true; [F.sls, F.mobileLauncher, F.boosters, F.ascent, F.orbitSpeed].forEach(logFact); }
    renderer.render(launch.scene, launch.camera);
    if (launch.done) { state.phase = 'cruise'; arrive(); }
    return;
  }
  if (state.phase === 'mars' && world) {
    const paused = isPaused();
    setSound({ inside, suit, dust: !!outpost.dust, running: !!(world.keys.ShiftLeft || world.keys.ShiftRight) }); tickSound(dt);
    if (inside) room.update(dt, world.keys, !isModalOpen());
    if (inside && room === ghRoom) ghRoom.draw(colony.s.base, GREENHOUSE.tank);
    else world.update(dt, !isModalOpen());
    if (!paused && !outpost.over) {
      const step = dt * state.speed;
      solClock += step;
      if (world.nearest()?.type === 'door') tutorialStep = 1;
      if (!inside && world.driving) {
        // in the pressurised rover: the suit refills from the cabin air, and its walls block some radiation (game value)
        suit = Math.min(1, suit + step * 0.15);
        const f = outpost.today, perSol = step / TUNED.solSeconds;
        outpost.dose += F.surfaceDose.value * f.protection * perSol * 0.6;
        if (outpost.storm) outpost.dose += outpost.storm.strength * TUNED.stormDose / outpost.storm.total * perSol * f.protection * 0.6;
      } else if (!inside) {
        // Outside, the suit uses air (faster in the freezing night) and the outpost's shielding isn't protecting you.
        suit -= step / outpost.suitSeconds() * (world.night ? TUNED.coldSuit : 1);
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
        const notes = colony.tickSol(outpost);
        const ripe = notes.filter(n => n.type === 'ripe'), dry = notes.filter(n => n.type === 'thirsty');
        if (ripe.length) toast(`🌱 ${ripe.map(n => CROPS[n.gh.crop].name).join(' and ')} ready to harvest in your greenhouse!`, 5000);
        else if (dry.length) toast(`💧 ${dry.length > 1 ? dry.length + ' greenhouse tanks are' : 'A greenhouse tank is'} empty - the plants stopped growing. Bring water in the jug.`, 5000);
        pending = pending.filter(p => {
          if (p.sol > outpost.sol) return true;
          world.dropSupplyPod(); if (p.cargo) world.pickups.at(-1).cargo = p.cargo;
          toast(p.cargo ? '📦 Your order from Earth landed - follow the orange beam!' : '📦 A supply pod landed near the outpost - follow the orange beam!');
          return false;
        });
        world.setLink(outpost.today.link);
        world.setPanelDust(outpost.clean); world.panelsDirty = outpost.clean < 0.97;
        if (outpost.over) { queue.length = 0; endMission(); }
      }
    }
    if (!isModalOpen() && queue.length && !outpost.over) handle(queue.shift());   // wait until no pop-up is open, so events never replace one
    world.setTime(solClock / TUNED.solSeconds);
    if (!sunsetShown && !inside && solClock / TUNED.solSeconds > 0.72 && solClock / TUNED.solSeconds < 0.78) {
      sunsetShown = true; toast('🌅 Look at the sunset - on Mars sunsets are BLUE! Fine dust lets blue light through. (NASA Curiosity photographed one in 2015.)', 7000);
    }
    interior.setStorm(!!outpost.storm, clock.elapsedTime);
    interior.setMonitor(outpost.hazards.some(h => !h.seen), clock.elapsedTime);
    colony.update(clock.elapsedTime, world.night);
    drawHUD();
    if (inside) renderer.render(room.scene, room.camera);
    else renderer.render(world.scene, world.camera);
    return;
  }
  tickSound(dt);
  // title / explainer / cruise: slow pan over Mars once it exists
  if (world) { world.yaw += dt * 0.05; world.update(dt, false); renderer.render(world.scene, world.camera); }
  else renderer.clear();
});
