import {recordLesson,tutorialLessons,questHelp} from './player-tutorial.js';
import {RECIPES,builderQuest} from './builder-recipes.js';
import { Construction } from './construction.js';
import { firstMissionReport } from './construction-state.js';
import { zhetela, zhetelaPortraitHTML } from './zhetela.js';
let construction;
import { waitForBase } from './base-loading.js';
import {chargeRover} from './rover-charging.js';
import { heightAt } from './world.js';
import { marsObjective, missionLog } from './mars-objectives.js';
import { openResearch, tickResearch } from './surface-research.js';
import { effectiveQuality } from './device-profile.js';
import { createAdaptiveRes } from './adaptive-res.js';
import { Pebbles, pebblesEnabled } from './pebbles.js';
import { LandmarkTips } from './landmarks.js';
import {initSettings,openSettings} from './settings.js';
import { GRAPHICS_MODE, WORLD_RADIUS, WORLD_LIMIT } from './surface-detail.js';
import * as THREE from 'three';
import { renderInteriorView } from './exterior-view.js';
import { Outpost, DIFFICULTY, UPGRADES, TUNED, TIERS, SITES } from './sim.js';
import { openPedia } from './pedia.js';
import { loadSpaceWeather, sunToday, pickStormEvent, flareStrength, flareWords } from './spaceweather.js';
import { World, GH } from './world.js';
import { Launch } from './launch.js';
import { CrewInterior as Interior } from './crew-interior.js';
import { installSettlement } from './settlement.js';
import { fieldMapHTML, mountFieldMap } from './fieldmap.js';
import { MapState } from './mapstate.js';
import { Minimap } from './minimap.js';
import { Lookouts } from './lookouts.js';
import { Sites } from './sites.js';
import { Mist } from './mist.js';
import { Capsule } from './capsule.js';
import { Greenhouse } from './greenhouse.js';
import { showMissionPath } from './missionpath.js';
import { showArrival } from './arrival.js';
import { Survival } from './survival.js';
import { playLanding, playStorm, placeLander } from './cutscenes.js';
import { devConsole } from './devconsole.js';
import { resetGame, earn, openPatches, patchCount, PATCHES, setPatchContext, setSoundGate, setDuckHook } from './patches.js';
import { loadRoverPhotos, loadEarthToday, loadMarsMap, loadMarsToday, dateWords } from './nasaimages.js';
import { noEmoji, $, modal, toast, meter, alerts, factHTML, sourcesHTML, isModalOpen, isPaused, say, logFact, onLog, logbook } from './ui.js';
import { pickQuestions, runQuiz, badgeFor } from './quiz.js';
import { loadModel } from './nasamodels.js';
import { artReady, artUrl, hasArt, artHTML, speakerHTML, artCredit, storyPanels, anyArt } from './art.js';
import { startSound, setSound, tickSound, footstep, toggleMute, isMuted, soundDebug, crunch, duck } from './sound.js';
import { initTouch, isTouch } from './touch.js';
import { earthGlobe, moonGlobe } from './globe.js';
import { Colony, newColony, ORES, TOOLS, CROPS, SHOP, GREENHOUSE, BAG, JUG_L, priceWords } from './colony.js';
import { initMissionMenu } from './menu.js';
import { SCREEN_MODES, screenName, screenMode, setScreenMode, nextScreenMode, onLayout } from './layout.js';
loadModel('sls.glb'); loadModel('mobile-launcher.glb');   // NASA's 3D models start downloading on the title screen

// Phones and tablets: draw fewer pixels, and skip shadows on small screens, so the game stays smooth
const coarse = matchMedia('(pointer: coarse)').matches, smallScreen = Math.min(screen.width, screen.height) < 600;
const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: effectiveQuality(GRAPHICS_MODE) !== 'low' });
renderer.setPixelRatio(Math.min(devicePixelRatio, effectiveQuality(GRAPHICS_MODE) === 'low' ? 1 : effectiveQuality(GRAPHICS_MODE) === 'high' ? devicePixelRatio : 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = effectiveQuality(GRAPHICS_MODE) !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const targetRatio = () => Math.min(devicePixelRatio, effectiveQuality(GRAPHICS_MODE) === 'low' ? 1 : effectiveQuality(GRAPHICS_MODE) === 'high' ? devicePixelRatio : 1.5);
renderer.shadowMap.autoUpdate = false; let shadowFrame = 0;
const adaptiveRes = createAdaptiveRes(renderer, targetRatio, { enabled: () => !location.search.includes('fixedres') });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;   // softer, film-like light and colour

const F = (await (await fetch('data/mars-facts.json?v=settings-library-35')).json()).facts;
await artReady;   // team illustrations (assets/art/art.json) - empty slots simply show nothing
for (const [id, f] of Object.entries(F)) f.id = id;   // so the logbook and quiz can refer to each fact
onLog(n => { $('#log-btn').textContent = `Logbook ${n} (L)`; if (n >= 15) earn('scholar'); });

// The mission logbook: every real fact you have met, as cards you can read again.
function openLogbook() {
  openSettings({tab:'information'});
}
let weather = { mode: 'archived', flares: [], sources: [] };
const weatherReady = loadSpaceWeather().then(w => { weather = w; showSun(); });

const state = { phase: 'title', difficulty: 'normal', speed: 1, site: 'plains', age: 'older' };
$('#map-btn').onclick = () => { modal({title:'Surface operations map',html:fieldMapHTML(world)+farmQuestHTML(colony?.s)}); mountFieldMap(world); };
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

// Player age remains a title-screen preference; landing is chosen on approach.
try { if (localStorage.getItem('ja-age') === 'younger') state.age = 'younger'; } catch { /* storage blocked */ }
// Player age, a small toggle in the title bar: ages 7-9 get shorter pop-ups (facts folded up until tapped).
const setAge = a => {
  state.age = a; document.body.classList.toggle('young', a === 'younger');
  $('#age-btn').innerHTML = a === 'younger' ? '🧒 <span class="age-word">Ages </span>7-9' : '🧑 <span class="age-word">Ages </span>10-12';
  try { localStorage.setItem('ja-age', a); } catch { /* storage blocked */ }
};
$('#age-btn').onclick = () => { setAge(state.age === 'younger' ? 'older' : 'younger'); toast(state.age === 'younger' ? '🧒 Ages 7-9: shorter pop-ups - tap a fact to read it' : '🧑 Ages 10-12: all the facts, open'); };
setAge(state.age);
$('#pedia-btn-title').onclick = $('#pedia-btn').onclick = () => openSettings({tab:'information'});

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
  <p>At an airlock, aim at the green handle and ${keyWord('press E','tap Use')}. With your pickaxe equipped, aim at a sparkling ore deposit and ${keyWord('click to strike','tap Use to strike')}.</p>
  <p>Inside the outpost, walk to the <b>power console</b> to split your power between:</p>
  <p>🫁 <b>Life support</b> - makes oxygen and powers the grow lights.<br>📡 <b>Talk to Earth</b> - sends your science home and brings supply pods.<br>🔬 <b>Science</b> - when Earth receives enough, its engineers radio you new <b>upgrade designs</b>.<br>🛡 <b>Shielding</b> - protects you from radiation, especially during solar storms.</p>
  <p>📍 <b>Where you land matters.</b> The ice plains are the easy start. The pole has lots of ice but weak sunlight and cold nights. Jezero Crater is best for science but has little ice. A lava tube blocks radiation but is hard to build in.</p>
  <p>🧊 Collect ice outside, then use the <b>water plant</b> inside: melt and filter the ice into clean water, and split water into oxygen. Pile <b>layers of Mars soil</b> on the outpost at the workbench - you decide how thick is thick enough.</p>
  <p><b>Rations</b> (the packs at the bottom) go down as you walk, run and jump. Your helmet stays on outside, so you can only eat inside the outpost or the rover: ${keyWord('hold <b>F</b>', 'hold <b>Eat</b>')}. Greenhouse food keeps you going longer than freeze-dried packs. With three packs or fewer you can't run, and with none you slow down and breathe harder.</p>
  <p>Outside, the <b>ring next to you</b> is your suit air. Running uses it faster. Head back in before it turns red.</p>
  <p>Firsts earn <b>mission patches</b>. See them with the <b>Patches</b> button.</p>
  <p>Build the designs at the <b>workbench</b> using <b>parts</b> you salvage outside. There is never enough power for everything - that is the real puzzle astronauts and NASA mission planners solve!</p>` });
$('#data-btn-title').onclick = $('#data-btn').onclick = showData;
$('#path-btn').onclick = () => showMissionPath(F).then(done => { if (done) earn('briefing'); });
$('#patch-btn').onclick = () => openPatches();

function showData() {
  const s = sunToday(weather);
  modal({ title: 'Real NASA data in this game', html: `
    <p>This game uses real science wherever it can. Numbers marked "game balance" are made up so a whole mission fits into a few minutes - they are not measurements.</p>
    <h4>Space weather (solar storms)</h4>
    ${sourcesHTML(weather.sources)}
    <p class="source">Right now: ${s.count} flares in the last 7 days; biggest ${s.biggest ? s.biggest.cls : 'unknown'}; radiation-storm level S${s.radiationStorm ?? '?'} on NOAA's 0-5 scale. Every solar storm in the game is based on one of these real flares.</p>
    <h4>Settlement design and model credit</h4>
    <p class="source">Habitat geometry based on <a href="https://sketchfab.com/3d-models/mars-one-mission-base-83ced347037f47aba8473147d65df074" target="_blank" rel="noopener">“Mars One” Mission – Base</a> by admone, CC BY 4.0. Adapted with reduced textures, lit materials, refitted collisions and a playable connected interior. Surface shape uses archived NASA MOLA gridded elevations, compressed and vertically exaggerated for the training map; the mission settlement is a future design concept.</p>
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
    <p class="source">• SLS Block 1 rocket - NASA's 3D-printing model, split into its real stages and coloured from NASA's Artemis II launch photos. • Mobile Launcher. • Perseverance rover (NASA/JPL-Caltech). • Ingenuity helicopter. • Mars Reconnaissance Orbiter. • Pistol Grip Tool (the power drill astronauts use on spacewalks) and Wrench, on the outpost workbench. Terrain colours based on Perseverance's photos of Jezero Crater. • The crew rover: NASA's Space Exploration Vehicle (MMSEV) model; it drives faster in the game than the real one. • Launch pad: NASA's Vehicle Assembly Building model (not at its real distance). • Mars Odyssey relay orbiter (NASA 3D Resources). • NASA logos on models are replaced with the Zhetalis logo. • Planets in the sky (launch and Mars nights) are where they really are today, from <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">NASA JPL's approximate planet positions</a>; the stars are a made-up pattern. • Your astronaut: NASA's Astronaut model (logo removed, cut into jointed parts so it can walk). • The hills and craters around the outpost: sampled from NASA MOLA MEGDR measured topography around Gusev Crater (4 degrees compressed into the middle of a 1,216 m game map; the outer ground is invented; height differences scaled by 0.015; base apron flattened). • Mars globe map: NASA 3D Resources (and NASA Mars Trek when online). • Spinning Earth: NASA Blue Marble imagery (map from the three.js examples), turned to match today's EPIC photo. The launch pad's towers are simple shapes based on NASA photos.</p>
    <p class="source">• Launch photo: <a href="https://images.nasa.gov/" target="_blank" rel="noopener">NASA Image and Video Library</a> (Artemis II, 1 April 2026).</p>
    ${anyArt() ? `<h4>Illustrations</h4><p class="source">• ${artCredit() || 'Illustrations made by team Zhetalis.'} Every illustration is labelled "Illustration" - only pictures labelled REAL or LIVE are real NASA photos.</p>` : ''}
    <h4>Game balance (not real measurements)</h4>
    <p class="source">• 1 sol is about 24 Earth hours 39 minutes (24.66 hours). In this game, a full day/night cycle takes ${TUNED.solSeconds / 60} minutes at normal speed. • Each solar panel makes ${TUNED.kWhPerPanel} kWh per clear sol. • Solar storms are made stronger than real ones so you can see shielding matter in one game. • Supply pods arrive in a few sols (real cargo takes about 7 months). • Upgrade design and parts numbers are made up. • Plants grow in a few sols (real lettuce takes about 4 weeks, potatoes 3 to 4 months). • Ore amounts, trade prices and the 2-sol storm warning are game values; real solar-storm particles take from hours to days to arrive. • Phobos is drawn about twice as big as it really looks, so you can spot it. • Landing sites: the real places are real, but how much sun, ice, radiation and science each one gives is game balance. • Mars-soil shielding: 18%, 28% and 33% for 1, 2 and 3 layers are game numbers that follow the real pattern (the first layer helps most). • The water plant's filter keeps 90% of dug-up ice as water (game); splitting 1 L of water into 0.89 kg of oxygen is real chemistry. Hunger drain and faster breathing while running are gameplay settings.</p>` });
}

// ---------------- save and resume ----------------
// The mission saves itself every few seconds (and when the tab is hidden or closed), in this browser only.
// After a refresh, the title screen offers "Resume" to carry on from the same sol.
const SAVE_KEY = 'zhetalis-unity-mars-save-v1';
function saveGame() {
  if (window.__resetting) return;
  if (state.phase !== 'mars' || !outpost || outpost.over || !world) return;
  const o = {};
  for (const [k, v] of Object.entries(outpost)) if (!['d', 'facts', 'today'].includes(k)) o[k] = v;
  const s = world.sev, p = world.driving ? s.exitPoint() : world.player.position;
  const data = {
    v: 1, when: Date.now(), difficulty: state.difficulty, speed: state.speed, outpost: o,
    entry: world.activeEntrance?.index??0, solSeconds: TUNED.solSeconds, solClock, suit, inside, ship: inside && room === capsule, gh: inside && room === ghRoom, pending, tutorialStep, sunsetShown, logbook: [...logbook.keys()], body: body?.save(),
    world: { player: [p.x, p.z], yaw: world.yaw, rover: world.rover.salvaged, heli: !!world.heli.seen, sevShown: !!world.sevShown,
      pickups: world.pickups.map(k => [k.kind, k.x, k.z, k.cargo || null]), sev: [s.pos.x, s.pos.z, s.yaw, s.battery] },
    colony: colony?.s, surveys: [...(world.settlement?.surveys || [])], lookouts: [...(world.lookouts?.got || [])], map: world.mapState?.save(),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
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
  b.classList.remove('hidden'); b.classList.add('primary');
  b.onclick = () => resume(saved);
  $('#start').textContent = 'New game ↗'; $('#start').classList.remove('primary'); b.parentNode.insertBefore(b, $('#start'));
}

// Back to Mars straight away, with everything as it was.
async function resume(d) {
  missionMenu.dispose();
  startSound();
  if (isTouch() && document.body.classList.contains('layout-phone') && canFullscreen) goFullscreen();
  $('#title').classList.add('hidden');
  state.difficulty = d.difficulty; state.site = SITES[d.outpost.site] ? d.outpost.site : 'plains'; state.speed = d.speed || 1; $('#speed-btn').textContent = 'Speed ×' + state.speed;
  buildWorld();
  if (!await waitForBase(world.ready)) return;
  world.settlement.surveys = new Set(d.surveys || []);
  if (world.lookouts) { world.lookouts.got = new Set(d.lookouts || []); world.lookouts.refresh(); }
  world.mapState?.load(d.map); world.mapState?.sync(true); world.mist?.snap(); placeLander(world);
  world.activeEntrance=world.settlement.entrances[d.entry??0];
  Object.assign(outpost, { powerStep: 6, rations: 0, baseConnected:true, chargerStep:0, roverCharged:false,soilStep:0,chargeReserve:0 }, d.outpost); outpost.d={...DIFFICULTY[d.difficulty]};outpost.today = outpost.forecast();
  ({ solClock, suit, pending, tutorialStep, sunsetShown } = d);
  solClock = (solClock / (d.solSeconds || 37) % 1) * TUNED.solSeconds;
  if (d.body) Object.assign(body, d.body);
  d.logbook.forEach(id => F[id] && logFact(F[id]));
  const w = d.world;
  world.pickups.slice().forEach(p => world.removePickup(p));
  w.pickups.forEach(([kind, x, z, cargo]) => { world.addPickup(kind, x, z); if (cargo) world.pickups.at(-1).cargo = cargo; });
  if (d.colony) { colony.s = Object.assign(newColony(), d.colony); colony.restore(); }
  colony.renewOres(outpost.sol);
  if (w.rover) { world.rover.salvaged = true; world.rover.group.children[0].visible = false; }
  world.heli.seen = w.heli; world.sevShown = w.sevShown;
  world.player.position.set(w.player[0], 0, w.player[1]); world.yaw = w.yaw;
  world.sev.pos.set(w.sev[0], 0, w.sev[1]); world.sev.yaw = w.sev[2]; world.sev.battery = w.sev[3];
  syncPowerHardware(); world.setWall(outpost.upgrades.wall); world.setRegolith(outpost.upgrades.regolith);
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

$('#reset-progress').onclick = () => modal({ title: 'Reset progress?', html: '<p>This deletes your saved mission and all your badges. It cannot be undone.</p>', choices: [{ label: 'Keep my progress', primary: true }, { label: 'Delete everything', onPick: resetGame }] });
function startNew() {
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
  const retry=document.createElement('button');retry.id='retry-launch';retry.textContent='Retry model download';retry.hidden=true;
  Object.assign(retry.style,{position:'fixed',left:'16px',bottom:'16px',zIndex:5});retry.onclick=()=>location.reload();document.body.appendChild(retry);
  buildWorld(); // start building Mars in the background during the countdown
  loadMarsMap(); loadRoverPhotos(); loadEarthToday();   // and start fetching the real NASA pictures
}
$('#start').onclick = () => {
  const s = readSave();
  if (!s) return startNew();
  modal({ title: 'You have a saved game', html: `<p>Sol ${s.outpost.sol} of ${DIFFICULTY[s.difficulty].sols} (${DIFFICULTY[s.difficulty].label}). Starting a new game replaces it.</p>`,
    choices: [{ label: `Continue my game (sol ${s.outpost.sol})`, primary: true, onPick: () => resume(s) }, { label: 'Start a new game', onPick: startNew }] });
};

function buildWorld() {
  world = new World(renderer, F, () => {});
  interior = new Interior(); capsule = new Capsule(); room = interior;
  capsule.onStep = () => footstep(0, true);
  ghRoom = new Greenhouse(); interior.scene.position.set(-20.4,0,23);
  ghRoom.scene.add(interior.scene);
  ghRoom.onStep = () => footstep(0, true);
  if (hasArt('mars-ground')) world.useGroundArt(artUrl('mars-ground'));
  world.onStep = run => footstep(run); interior.onStep = () => footstep(0, true);
  world.onJump = () => { body?.jumped(); if (earn('hang')) toast('A jump on Mars keeps you in the air about 2.6 times longer than the same jump on Earth.', 6000); };
  if (!body) body = new Survival();
  outpost = new Outpost(state.difficulty, F, state.site);
  world.setPanels(outpost.panels);
  world.setLink(outpost.today.link);
  colony = new Colony(world); colony.renewOres(outpost.sol);                                 // tools, ores, trading and greenhouses
  renderer.localClippingEnabled=true;
  world.ready = Promise.all([installSettlement(world),ghRoom.walkwayReady]).then(() => {
    world.settlement.bindGreenhouse(ghRoom);
    const targets = world.extraTargets;
    world.extraTargets = p => {
      const list = targets(p), step = outpost.powerStep;
      const task=marsObjective(outpost,colony.s),target=missionTarget(task.target);
      if(['base','charger','shelter','soil'].includes(task.target)&&target&&task.id!=='charge')list.unshift({type:'mission-work',task,range:2.8,d:Math.hypot(p.x-target.x,p.z-target.z)});
      return list;
    };
    construction = new Construction(world,interior,{state:()=>outpost,colony:()=>colony,save:saveGame,sync:syncPowerHardware,advance:advancePower,guide:zhetela});
    setupMissionHud();syncPowerHardware();
    new Lookouts(world, { modal, onFirst: (spot, i, n) => { outpost.science += 4; if (n === 4 && earn('lookout')) toast('Patch earned: High ground', 5000); } });
    new Sites(world, { toast, modal,
      onVisit: (s, n, total) => { outpost.science += s.points; logFact({ id: 'site-' + s.id, kid: s.kid, source: s.source, url: s.url }); toast(`${s.name}: +${s.points} science. ${n} of ${total} stops visited.`, 4500); if (n >= 3 && earn('geologist')) toast('Patch earned: Field geologist', 5000); if (n === total && earn('footsteps')) toast('Patch earned: In Spirit\'s footsteps', 5000); },
      onDevil: () => { outpost.science += 1; logFact({ id: 'site-devils-seen', kid: 'You spotted a dust devil! These swirling columns of dust cross Gusev\'s floor. NASA\'s Spirit photographed them from the ground.', source: 'Wikipedia: Gusev', url: 'https://en.wikipedia.org/wiki/Gusev_(Martian_crater)' }); toast('A dust devil! They wander the plain. +1 science', 5000); if (earn('devil')) toast('Patch earned: Devil spotter', 5000); } });
    // the crater map: charted ground, trail, flags, survey finds, Ingenuity scout flights, Gusev landmarks
    const ms = new MapState(world, {
      toast, modal,
      onFind: f => { outpost.science += 3; toast(`Found: ${f.name}. +3 science`, 4000); },
      onLandmark: (l, quiet) => { logFact({ id: l.id, ...l.fact }); if (!quiet) toast(`Landmark charted: ${l.name}. Added to your logbook.`, 4500); },
    });
    ms.weather = () => {
      const h = outpost.hazards?.find(x => x.kind === 'dust' && x.seen);
      return outpost.dust ? { dust: 'now' } : h ? { dust: 'coming', sols: Math.max(0, Math.ceil(h.at - outpost.sol)) } : {};
    };
    new Mist(world, {
      onRegion: (i, sp) => {
        outpost.science += 8; const first = earn('region');
        modal({ title: `Region complete: ${sp.name}`, html: `<p>You scanned the tower and found both survey spots here. Nothing is left hidden in this region.</p><p class="pos">+8 science.${first ? ' You earned the <b>Region keeper</b> patch.' : ''}</p><p class="fact">Mapmakers call this a survey: walk the ground, mark what you see, and leave no gaps in the sheet.</p>`, pause: false });
      },
    });
    if (pebblesEnabled()) world.pebbles = new Pebbles(world);
    new LandmarkTips(world, m => toast(`Landmark: ${m.tip}`, 9000));
    new Minimap(world, $('#hud'), { onOpen: () => $('#map-btn').click() });
    ms.sync(true);
    return world.settlement;
  });
  world.ready.catch(() => {}); // Report failures in the arrival loading panel, not an unhandled rejection.
  loadMarsToday().then(t => (marsNow = t)).catch(() => {});   // real Curiosity weather for the visor and monitor
}

// ---------------- after lift-off: how we get there, then arrival ----------------

async function arrive() {
  $('#countdown').classList.add('hidden'); $('#skip')?.remove(); $('#retry-launch')?.remove();
  // Clear launch captions before waiting for network-dependent base assets.
  const ready = await waitForBase(world.ready);
  if (!ready) return;
  setSound({ scene: 'arrival' });
  const selectedSite = await showArrival(F, outpost.delayMinutes(), {onDescent:()=>playLanding(world)});
  if (!selectedSite) { location.reload(); return; }
  state.site = selectedSite;
  outpost.site = selectedSite;
  outpost.parts = Math.max(0, outpost.d.parts + SITES[selectedSite].parts);
  outpost.today = outpost.forecast();
  world.setLink(outpost.today.link);
  setSound({ scene: 'mars' });
  await weatherReady;
  state.phase = 'mars';
  $('#hud').classList.remove('hidden');
  phoneTips();
  say('welcome');
  modal({ title: 'Welcome to Mars, junior astronaut!', html: `
    <p>Collect the landed power kits and rations from the habitat locker. Follow the arrow to assemble and deploy your equipment.</p>
    <p>At an airlock, aim at the lit handle and ${keyWord('press E','tap Use')}. Your lander supplies startup power.</p>
    <p>Landing scenario: <b>${outpost.s.name}</b>. ${outpost.s.why} All scenarios use the same scaled MOLA Gusev terrain. It is measured regional relief with a flattened training base, not a survey of the selected landing region.</p>
    <p>Collect ice and process it at the water plant in the greenhouse service room.</p><p>Use the map to find survey towers. ${keyWord('Hold F','Hold Eat')} indoors or in the rover to eat; greenhouse meals keep you full longer.</p>`,
    choices: [{ label: "Let's go!", primary: true }] });
}

// ---------------- inside the outpost ----------------
function goInside(entrance=world?.activeEntrance||world?.settlement?.entrances[0]) {
  if(entrance)world.activeEntrance=entrance;
  inside = true; room = interior; interior.enter();
  if(entrance)interior.pos.set(entrance.index*10.2,0,1.25);
  document.exitPointerLock?.();
  toast(`🏠 Inside the outpost: you are shielded and your suit refills. Walk to the stations and ${keyWord('press E', 'tap Use')}.`, 4500);
}
// Your lander: climb the ladder into its crew cabin (capsule.js)
function goInShip() {
  inside = true; room = capsule; capsule.enter(); document.exitPointerLock?.();
  toast(`🚀 You climbed the ladder into your lander. 4 astronauts rode down to Mars in this cabin! ${keyWord('Press E', 'Tap Use')} at the seats, screens and window.`, 6000);
}
// The base greenhouse (greenhouse.js): from the outpost through the tunnel ('hab'), or from outside through its airlock ('out')

function farmQuestHTML(s) {
  if(!s)return '';
  if(outpost.powerStep<6)return `<div class="hazard"><b>Surface power</b><p>${powerSteps[outpost.powerStep]}</p></div>`;
  const q=s.farmQuest||{};
  if(q.rewarded)return '<p>✓ First meal complete · Expand your camp</p>';
  const goals=[['visited','Enter the greenhouse'],['planted','Plant a grow bed'],['watered','Connect water to a planted bed'],['harvested','Harvest a ripe crop'],['prepared','Prepare portions at the locker']];
  return `<div class="hazard"><b>Mission: First harvest</b><p>${goals.map(([k,label])=>`${q[k]?'✓':'○'} ${label}`).join('<br>')}</p><p>${q.rewarded?'Complete · +12 science earned':'Reward: +12 science for preparing your first harvest. Growth needs water and life-support power.'}</p></div>`;
}
function farmProgress(step) {
  const q=colony.s.farmQuest??={};q[step]=true;
  if(['visited','planted','watered','harvested','prepared'].every(k=>q[k])&&!q.rewarded){q.rewarded=true;outpost.science+=12;toast('First meal complete! +12 science. Your camp is ready to expand.',6500);}
  saveGame();
}

function goInGreenhouse(from) {
  farmProgress('visited');
  const wasOut = !inside;
  inside = true; room = ghRoom; ghRoom.enter(from); ghRoom.draw(colony.s.base, GREENHOUSE.tank, outpost.today.total*outpost.split.life>=1);
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
  const entry=world.activeEntrance||world.settlement.entrances[0];
  world.player.position.set(entry.x,entry.y,entry.z+.5);world.move.set(0,0,0);world.vel.set(0,0,0); world.yaw = 0; world.lookPitch = 0; // step out of the door, facing away from it
  if (!world.firstPerson) world.yaw = Math.PI;
  if (outpost.shelter) toast('⚠️ The solar storm is still going - you are not protected out here!', 4500);
}

function stationAction(s) {
  if (s.type === 'exit' || s.type === 'ship-exit') return goOutside();
  if (s.type === 'ship-seat') return modal({ pause: false, title: '💺 The crew seats', html: `<p>Your lander has seats for <b>4 astronauts</b>, like NASA's Orion capsule. For launch and landing they lie on their backs with their knees up - that way the strong push of the rockets presses them into the seat instead of draining blood from their heads.</p>${factHTML(F.artemis2)}<p class="source">Orion, the capsule NASA astronauts fly in today, has only about as much living space as a small camper van - for a whole crew!</p>` });
  if (s.type === 'ship-panel') return modal({ pause: false, title: '🖥 The glass cockpit', html: `<p>Like NASA's Orion capsule, your lander is flown with <b>three big screens</b> instead of hundreds of dials and switches. The crew can swap what each screen shows - flight path, power, air and the heat shield.</p>${factHTML(F.orion)}<p>Orion's <b>heat shield</b> is on its bottom. Coming home it gets hotter than the surface of a lava flow, and it slowly burns away to carry the heat off.</p>` });
  if (s.type === 'console') return openPower();
  if (s.type === 'workbench') return openWorkbench();
  if (s.type === 'greenhouse') return toast('Walk forward through the pressure tube.');

  if (s.type === 'gh-out') return goOutside();
  if (s.type === 'gh-bed') return openGreenhouse(colony.baseBeds[s.bed]);
  if (s.type === 'gh-tap') {
    if (!colony.has('jug')) return toast('💧 This tap fills the water jug for greenhouses you build outside. The jug is in the storage locker in the outpost.', 5000);
    const l = colony.fillJug(); toolbarKey = '';
    return toast(l ? `💧 Filled your jug with ${l} L (base tank: ${colony.s.tank.toFixed(0)} L left).` : colony.s.tank <= 0 ? '💧 The base water tank is empty - collect ice outside and melt it at the water plant!' : '💧 Your jug is already full.');
  }
  if (s.type === 'shelter') return modal({ pause: false, title: '🛏 Storm shelter', html: `<p>During a solar storm, the crew squeezes into this small room with the thickest walls. It blocks most of the radiation - but nobody can do science or go outside.</p><p>${outpost.storm ? (outpost.shelter ? `<b>Sheltering now:</b> ${outpost.shelter} sols left.` : '<b>A solar storm is happening!</b> Choosing "hide in the shelter" in the warning keeps you safe.') : 'No storm right now.'}</p>${factHTML(F.careerLimit)}` });
  if(s.type==='window'&&room===capsule)return toast('The windows show the live landscape outside your lander. Look around to see the camp and changing Martian sky.',5000);
  if (s.type === 'window') return openWindow();
  if (s.type === 'monitor') return researchMenu();
  if (s.type === 'locker') return openLocker();
  if (s.type === 'water') return openWaterPlant();
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
    <p>Each sol you make <b>${outpost.energy().toFixed(0)} kWh</b>${outpost.dust ? ' (a dust storm is blocking the sunlight!)' : ''}. The night heater takes <b>${outpost.today.heater} kWh</b> first, so you can share out <b>${outpost.today.energy.toFixed(0)} kWh</b>. Move the sliders - the total always stays 100%.</p>
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

const powerSteps = ['Collect kits at locker', 'Assemble array at workbench', 'Deploy array outside', 'Assemble battery at workbench', 'Place battery outside', 'Connect panels to battery'];
function advancePower(expected) {
  if (outpost.powerStep !== expected) return;
  outpost.powerStep++;
  if (expected === 5) {
    outpost.panels = Math.max(3,outpost.panels);
    outpost.battery += TUNED.batteryUpgrade;
    outpost.today = outpost.forecast();
  }
  syncPowerHardware();
  saveGame();
  toast(powerSteps[outpost.powerStep] || 'Power online. Walk through Life support to plant your first crop.');
}
function suitAirSeconds(){
  // Two real minutes at baseline, including night and sprinting; upgrades add capacity.
  return outpost.suitSeconds();
}

function syncPowerHardware(){
  world.setPanels(outpost.powerStep>=6?outpost.panels:outpost.powerStep>=3?3:0);
  if(world.settlement){
    world.settlement.pack.visible = outpost.powerStep >= 5;
    world.settlement.cable.visible = false;
    world.settlement.charging.visible=outpost.chargerStep>=2;
    world.settlement.chargerCable.visible=false;
  }
}
function openWorkbench() {
  const byTier = TIERS.map((t, i) => {
    const items = Object.entries(UPGRADES).filter(([, u]) => u.tier === i).map(([k, u]) => {
      const open = outpost.unlocked(k), done = (u.once || u.max) && outpost.built(k);
      const why = !open && outpost.powerStep<6 && ['panel','battery'].includes(k) ? 'Commission the landed power kit first.' : done ? 'Built!' : open ? u.desc : `Design arrives when your base becomes a ${t.name} (${t.science} science sent).`;
      const count = u.max ? ` (${outpost.upgrades[k]} of ${u.max} layers)` : '';
      return `<button data-build="${k}" ${!open || done || outpost.parts < u.parts ? 'disabled' : ''}><span><b>${done ? '✅ ' : open ? '' : '🔒 '}${u.name}${count}</b><small>${why}</small></span><b>${u.parts} parts</b></button>`;
    }).join('');
    return `<h4>${i <= outpost.tier ? '' : '🔒 '}Tier ${i + 1}: ${t.name}</h4><div class="shop">${items}</div>`;
  }).join('');
  const closeWorkbench=modal({ title: '🔧 Workbench', pause: false, html: `
    ${[1,3].includes(outpost.powerStep)?`<button data-assemble>${outpost.powerStep===1?'Mount photovoltaic modules on their frame':'Fit battery pack and charge controller'}</button><p>These flight-built components arrived with the lander. The crew assembles and connects them on site. <a href="https://www.nasa.gov/lunar-surface-technology/" target="_blank" rel="noopener">NASA surface power research</a></p>`:''}
    ${outpost.baseConnected&&outpost.chargerStep===0?'<button data-charger>Assemble landed rover charger kit</button>':''}
    ${outpost.soilStep===2&&!outpost.upgrades.regolith?'<button data-soil>Fill and seal regolith shielding bags</button>':''}
    <p>You have <b>${outpost.parts} parts</b>. Find more outside: metal chunks, the old rover, and supply pods from Earth.</p>
    <p class="source">Your base is a <b>${TIERS[outpost.tier].name}</b>. Science sent to Earth: <b>${outpost.scienceSent}</b>.</p>${byTier}`,
    choices: [{ label: 'Done', primary: true }] });
  const step = outpost.powerStep, box=$('#modal .modal-box');
  box.querySelector('[data-charger]')?.addEventListener('click',()=>{closeWorkbench();construction.begin('charger');});
  box.querySelector('[data-soil]')?.addEventListener('click',()=>{outpost.soilStep=3;saveGame();openWorkbench();});
  $('#modal [data-assemble]')?.addEventListener('click', () => { closeWorkbench();construction.begin(step===1?'array':'battery'); });
  $('#modal .modal-box').querySelectorAll('[data-build]').forEach(b => b.onclick = () => {
    const key = b.dataset.build;
    if (outpost.buy(key)) {
      earn('build');
      toast(`🔧 Built: ${UPGRADES[key].name}`);
      syncPowerHardware(); world.setWall(outpost.upgrades.wall); world.setRegolith(outpost.upgrades.regolith);
      if (key === 'regolith') soilLayerReport();
      else if (key === 'reactor') earn('reactor'), modal({ pause: false, title: '⚛ Reactor online!', html: factHTML(F.fission) });
      else openWorkbench();
    }
  });
}

// How thick is thick enough? After each layer of Mars soil, show what every layer adds - the first helps most.
function soilLayerReport() {
  const n = outpost.upgrades.regolith, cuts = TUNED.regolithCuts;
  const rows = [1, 2, 3].map(i => `<div class="${i <= n ? 'pos' : ''}">${i <= n ? '✅' : '⬜'} Layer ${i} (${(i * 0.5).toFixed(1)} m of soil): blocks <b>${Math.round(cuts[i] * 100)}%</b> <small>(+${Math.round((cuts[i] - cuts[i - 1]) * 100)}% from this layer)</small></div>`).join('');
  modal({ pause: false, title: `⛏ Soil layer ${n} added!`, html: `
    <p>Your outpost is now under about <b>${(n * 0.5).toFixed(1)} m</b> of Mars soil. Look how much each layer adds:</p>
    <div class="forecast layer-list">${rows}</div>
    <p>Every layer costs parts and work, but each one helps less than the one before. ${n < 3 ? 'Is another layer worth it? You decide!' : 'That is as thick as your crew can pile it.'}</p>
    ${factHTML(n === 1 ? F.regolith : F.regolithDepth)}
    <p class="source">The percentages are game numbers that follow the real pattern - they are not measurements.</p>`,
    choices: [{ label: 'Back to the workbench', primary: true, onPick: openWorkbench }] });
}

// The water plant: dirty ice → melt and filter → clean water → split by electrolysis → oxygen.
const ICE_TO_WATER = 0.9;   // game: 10% of what you dig up is dust and grit the filter takes out
const O2_PER_L = 0.89;      // real: splitting 1 L (1 kg) of water gives 0.89 kg of oxygen
function openWaterPlant() {
  const s = colony.s; s.ice = s.ice || 0;
  modal({ pause: false, title: '💧 The water plant', html: `
    <p>Water is life on Mars: you drink it, plants drink it, and you can even <b>breathe</b> it - after you split it.</p>
    <div class="forecast stock">
      <div>🧊 Dirty ice: <b>${s.ice.toFixed(0)} kg</b><small>collect ice outside</small></div>
      <div>💧 Clean water: <b>${s.tank.toFixed(0)} L</b><small>for greenhouses and oxygen</small></div>
      <div>🫁 Oxygen: <b>${outpost.o2.toFixed(1)} kg</b><small>the crew breathes ${outpost.o2Need.toFixed(1)} kg a sol</small></div>
    </div>
    <div class="water-steps">
      <button data-melt ${s.ice <= 0 ? 'disabled' : ''}>🔥 1. Melt and filter all the ice<small>Heat melts it, a filter removes the dust and grit. ${s.ice.toFixed(0)} kg of ice → ${(s.ice * ICE_TO_WATER).toFixed(0)} L of clean water.</small></button>
      <button data-split ${s.tank < 5 ? 'disabled' : ''}>⚡ 2. Split 5 L of water into oxygen<small>Electrolysis: 5 L of water → ${(5 * O2_PER_L).toFixed(1)} kg of oxygen (and hydrogen).</small></button>
    </div>
    ${factHTML(F.electrolysis)}${factHTML(F.waterRecovery)}`, choices: [{ label: 'Done', primary: true }] });
  const box = $('#modal .modal-box');
  box.querySelector('[data-melt]').onclick = () => { const l = s.ice * ICE_TO_WATER; s.tank += l; s.ice = 0; if(l>0)(s.farmQuest??={}).waterMade=true; saveGame(); toast(`💧 +${l.toFixed(1)} L into the base tank · now ${s.tank.toFixed(1)} L.`); openWaterPlant(); };
  box.querySelector('[data-split]').onclick = () => { s.tank -= 5; outpost.o2 += 5 * O2_PER_L; saveGame(); toast(`🫁 +${(5 * O2_PER_L).toFixed(1)} kg oxygen · base tank now ${s.tank.toFixed(1)} L.`); openWaterPlant(); };
}

// ---------------- outside work: mining, the locker, trading, greenhouses ----------------
const cargoWords = c => [...Object.entries(c.seeds || {}).map(([k, n]) => `${n} × ${CROPS[k].name.toLowerCase()} seeds`), c.parts ? `${c.parts} parts` : ''].filter(Boolean).join(', ');
const oreDot = k => `<i class="ore-dot" style="background:${ORES[k].color}"></i>`;

function mine(dep) {
  if (!colony.has('pickaxe')) return toast('⛏ Your pickaxe is in the storage locker at the base. Your belt only holds 2 tools.');
  if (colony.tool !== 'pickaxe' || !world.aimsAt(dep.group)) return;
  if (colony.bagCount() >= BAG) return toast(`🎒 Your sample bag is full (${BAG}). Unload it at the storage locker inside the base.`);
  world.swingTool(() => {
    footstep(1);
    const r = colony.strike(dep), o = ORES[dep.ore];
    if(r.broke){recordLesson(colony.s,'mine');saveGame();}
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
  const h = solClock / TUNED.solSeconds * 24;
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

function selectPlayerTool(slot){
  if(!colony||isModalOpen()||world?.cinematic)return;
  if(!colony.select(slot))return;
  recordLesson(colony.s,colony.tool?'equip':'unequip');toolbarKey='';saveGame();
  toast(colony.tool?`${TOOLS[colony.tool].name} equipped · tap again or Q to put away`:'Empty hands · tools remain in your belt',2200);
}
function openTutorial(){
  const task=builderQuest(outpost,colony.s)||marsObjective(outpost,colony.s),lessons=tutorialLessons(outpost,colony.s),done=lessons.filter(l=>l.done).length;
  modal({title:'Field guide · learn by doing',html:`${zhetelaPortraitHTML()}<h4>Now: ${task.title}</h4><p>${questHelp(task)}</p><p>${done}/${lessons.length} skills practised. Help does not reset your mission.</p>${lessons.map((l,i)=>`<details ${!l.done&&i===lessons.findIndex(x=>!x.done)?'open':''}><summary>${l.done?'✓ ':''}${i+1}. ${l.title}</summary><p>${l.text}</p></details>`).join('')}<p>Low air? Return inside to refill. T opens the quest log; the current objective stays at the side of the screen.</p>`,choices:[{label:'Repeat current hint',onPick:()=>zhetela(questHelp(task))},{label:'Back to game',primary:true}]});
}

function drawToolbar() {
  const s = colony.s, key = JSON.stringify([s.belt, s.held, s.bag, s.jug, isTouch()]);
  if (key === toolbarKey) return;
  toolbarKey = key;
  const tb = $('#toolbar');
  tb.innerHTML = `<button data-slot="-1" aria-pressed="${s.held===-1}" class="${s.held===-1?'held':''}" title="Unequip tools (Q)">✋<small>Empty hands</small></button>` + s.belt.map((t, i) => `<button data-slot="${i}" aria-pressed="${i===s.held}" class="${i === s.held ? 'held' : ''}" title="${TOOLS[t].name}: ${TOOLS[t].desc}">${TOOLS[t].icon}<small>${keyWord(`${i + 1} · `, '')}${TOOLS[t].name}${t === 'jug' ? ` ${s.jug} L` : ''}</small></button>`).join('')
    + `<div class="bag" title="Rock samples you are carrying - unload them at the storage locker">${Object.keys(ORES).map(k => `<span>${oreDot(k)}${s.bag[k]}</span>`).join(' ')}<small>bag ${colony.bagCount()}/${BAG}</small></div>`;
  tb.querySelectorAll('[data-slot]').forEach(b => (b.onclick = e => { e.stopPropagation(); selectPlayerTool(+b.dataset.slot); }));
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
  const unloaded = colony.unload(); if(unloaded){recordLesson(colony.s,'unload');saveGame();} if (unloaded) toast(`🪨 Unloaded ${unloaded} rock sample${unloaded === 1 ? '' : 's'} into storage.`);
  const s = colony.s, o = outpost, link = o.today.link, beltFull = s.belt.length >= 2;
  const onWay = pending.filter(p => p.cargo);
  const req = s.request;
  const shop = SHOP.map(item => `<button data-buy="${item.id}" ${!link || !colony.canPay(item.price, o) ? 'disabled' : ''}><span><b>${item.label}</b><small>${priceWords(item.price)}</small></span></button>`).join('');
  modal({ pause: false, title: '🗄 Storage locker', html: `
    ${s.produce ? `<button data-prepare>Prepare harvested food · ${s.produce} portions</button>` : ''}
    <p>Sealed rations · <b>${o.rations}</b> portions <button data-rations ${o.rations ? '' : 'disabled'}>Stock galley</button></p>
    ${o.powerStep===0?'<button data-kits>Collect landed power kits</button>':''}
    <div class="inv-grid">
      <div><h5>Tool belt (holds 2)</h5>${s.belt.map(t => `<div>${TOOLS[t].icon} ${TOOLS[t].name} <button data-store="${t}">Put away</button></div>`).join('') || '<p>Empty</p>'}</div>
      <div><h5>In the locker</h5>${s.locker.map(t => `<div>${TOOLS[t].icon} ${TOOLS[t].name} <button data-take="${t}" ${beltFull ? 'disabled title="Your belt is full - put a tool away first"' : ''}>Take</button></div>`).join('') || '<p>Empty</p>'}</div>
      <div><h5>Rock samples</h5>${Object.keys(ORES).map(k => `<div>${oreDot(k)}${ORES[k].name}: <b>${s.store[k]}</b></div>`).join('')}<div>🔩 Parts: <b>${o.parts}</b></div></div>
      <div><h5>Seeds and water</h5>${Object.keys(CROPS).map(k => `<div>${CROPS[k].icon} ${CROPS[k].name}: <b>${s.seeds[k]}</b></div>`).join('')}
        <div>💧 Water tank: <b>${s.tank} L</b> · jug: <b>${s.jug} L</b></div>
        <button data-fill ${!colony.has('jug') || s.tank <= 0 || s.jug >= JUG_L ? 'disabled' : ''}>Fill the water jug</button>${colony.has('jug') ? '' : '<small> (take the jug first)</small>'}</div>
    </div>
    <h4>📡 Trade with Earth</h4>
    ${!s.farmQuest?.seedsCollected && !s.farmQuest?.seedsLanded && s.farmQuest?.seedArrival==null ? `<button data-starter ${!link?'disabled':''}>Request starter seeds · free training supply</button><small>Arrives near the base in 3 sols. Orange minimap marker on landing.</small>` : ''}
    ${link ? '<p>Scientists on Earth want Mars samples. Pay with samples from storage; your order comes down on a cargo pod in about 3 sols. Open the pod at the orange square on your minimap to receive the seeds.</p>' : '<p class="neg">The Earth link is off. Give "Talk to Earth" more power at the console to trade.</p>'}
    ${req ? `<div class="hazard"><b>Request:</b> ${req.who} wants <b>${req.n} ${ORES[req.ore].name.toLowerCase()}</b> (until sol ${req.until}). Reward: +${req.reward.science} science and ${cargoWords(req.reward)}. <button data-request ${!link || s.store[req.ore] < req.n ? 'disabled' : ''}>Send samples</button></div>` : ''}
    <div class="shop">${shop}</div>
    ${onWay.length ? `<p class="source">On the way: ${onWay.map(p => `${cargoWords(p.cargo)} (lands sol ${p.sol})`).join('; ')}</p>` : ''}
    ${factHTML(F.samples)}`, choices: [{ label: 'Done', primary: true }] });
  const box = $('#modal .modal-box'), again = () => { toolbarKey = ''; openLocker(); };
  box.querySelector('[data-starter]')?.addEventListener('click',()=>{
    const q=s.farmQuest??={};if(q.seedArrival!=null||!o.today.link)return;
    q.seedArrival=o.sol+3;pending.push({sol:q.seedArrival,type:'pod',cargo:{seeds:{lettuce:2},starter:true}});
    saveGame();toast(`Seeds requested · lands sol ${q.seedArrival} near base.`);again();
  });
  box.querySelector('[data-kits]')?.addEventListener('click', () => { advancePower(0); again(); });
  box.querySelector('[data-prepare]')?.addEventListener('click', () => {
    o.food += s.produce; s.freshMeals = (s.freshMeals || 0) + s.produce; s.produce = 0; farmProgress('prepared'); again();
  });
  box.querySelector('[data-rations]').onclick = () => { o.food += o.rations; o.rations = 0; saveGame(); again(); };
  box.querySelectorAll('[data-take]').forEach(b => (b.onclick = () => { if(colony.take(b.dataset.take)){recordLesson(colony.s,'equip');saveGame();} again(); }));
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
let activeBed=null;
function openGreenhouse(h) {
  activeBed=h;
  const s = colony.s, gh = h.gh, c = gh.crop && CROPS[gh.crop];
  const status = !c ? '<p>Empty. Plant some seeds!</p>'
    : gh.ready ? `<p class="pos">${c.icon} <b>${c.name}</b> - ripe and ready to harvest (${Math.round(c.meals*(1+.4*outpost.upgrades.greenhouse))} portions).</p>`
    : `<p>${c.icon} <b>${c.name}</b> - ${Math.round(gh.grown * 100)}% grown. Ready in about ${Math.ceil((1 - gh.grown) * c.sols - 1e-6)} sol(s) <small>(in real life: ${c.real})</small>.</p>`;
  const plantBtns = outpost.powerStep < 6 ? "<p>Connect the field power kit to commission the grow beds.</p>" : !c ? Object.entries(CROPS).map(([k, cr]) => `<button data-plant="${k}" ${s.seeds[k] ? '' : 'disabled'}><span><b>${cr.icon} ${cr.name}</b><small>${s.seeds[k]} seeds · grows in ${cr.sols} sols · drinks ${cr.water} L · ${cr.meals} meals</small></span></button>`).join('') : '';
  const how = h.base ? `This bed is plumbed into the outpost's water tank (<b>${s.tank.toFixed(0)} L</b> left - melt ice to refill it).` : colony.has('jug') ? `Your jug holds <b>${s.jug} L</b>.` : 'Bring the water jug from the locker to top it up.';
  const closeBed = modal({ onClose:()=>{activeBed=null;}, pause: false, title: h.base ? `🌱 Grow bed ${h.bed + 1}` : '🌱 Your greenhouse', html: `${farmQuestHTML(s)}${outpost.today.total*outpost.split.life<1?'<p class="neg">Grow lights are off. Allocate life-support power at the console to resume growth.</p>':''}${status}
    <p>💧 Water: <b>${gh.tank.toFixed(1)} / ${GREENHOUSE.tank} L</b>${c && !gh.ready ? ` · the plants drink ${(c.water / c.sols).toFixed(1)} L a sol` : ''}. ${how}</p>
    <div class="shop" data-bed-controls>${plantBtns}
      ${h.base && s.tank > 0 && gh.tank < GREENHOUSE.tank ? '<button data-pipe><span><b>💧 Fill from the water pipe</b></span></button>' : ''}
      ${!h.base && colony.has('jug') && s.jug > 0 && gh.tank < GREENHOUSE.tank ? '<button data-water><span><b>💧 Pour in the water</b></span></button>' : ''}
      ${gh.ready ? '<button data-harvest class="primary"><span><b>🧺 Harvest</b></span></button>' : ''}</div>
    <button data-research>Food cultures & nutrition research</button><details><summary>Crop research</summary><p>ISS astronauts ate Outredgeous red romaine after 33 days. It supplemented their packaged meals. <a href="https://ntrs.nasa.gov/citations/20150021302" target="_blank" rel="noopener">NASA flight experiment</a></p><p>NASA tested wheat and potatoes in a controlled chamber on Earth. Each harvest returns two planting units to your locker: seeds, or seed potatoes. This is a simplified game reward; lettuce normally needs a separate flowering and seed-setting stage. Growth is accelerated here and portions simplify crew nutrition. <a href="https://ntrs.nasa.gov/citations/20040089951" target="_blank" rel="noopener">NASA chamber trials</a></p></details>`, choices: [{ label: 'Done', primary: true }] });
  const box = $('#modal .modal-box'), again = () => { toolbarKey = ''; openGreenhouse(h); };
  box.querySelector('[data-research]')?.addEventListener('click',researchMenu);
  box.querySelectorAll('[data-plant]').forEach(b => (b.onclick = () => { if(!colony.plant(h,b.dataset.plant))return;farmProgress('planted');if(h.gh.tank>0)farmProgress('watered'); toast(`🌱 Planted ${CROPS[b.dataset.plant].name.toLowerCase()}.`); again(); }));
  box.querySelector('[data-pipe]')?.addEventListener('click', () => { const l = colony.waterFromPipe(h);if(l>0&&h.gh.crop)farmProgress('watered'); toast(`💧 ${l.toFixed(0)} L of water flowed into the bed.`); again(); });
  box.querySelector('[data-water]')?.addEventListener('click', () => { const l = colony.water(h);if(l>0&&h.gh.crop)farmProgress('watered'); toast(`💧 Poured ${l} L into the hydroponic tank.`); again(); });
  box.querySelector('[data-harvest]')?.addEventListener('click', () => { const crop=h.gh.crop;const m = colony.harvest(h, outpost);if(m<=0)return; closeBed(); toolbarKey=''; farmProgress('harvested'); toast(`Harvest stored · ${m} portions + 2 ${crop==='potato'?'seed potatoes':'seed packs'} in your locker.`); });
}

// Building with the builder tool: a greenhouse goes a few metres in front of you.
function openBuild() {
  const s=colony.s;
  const rows=Object.entries(RECIPES).map(([key,r])=>{
    const unlocked=outpost.powerStep>=6&&outpost.baseConnected&&outpost.tier>=r.tier;
    const cost=Object.entries(r.cost).map(([k,n])=>`${k==='parts'?'Parts':ORES[k].name}: <b>${k==='parts'?outpost.parts:s.store[k]}/${n}</b>${k==='parts'?'':` <small>(bag ${s.bag[k]})</small>`}`).join(' · ');
    const spot=key==='greenhouse'?colony.buildSpot(world.player.position,world.yaw):{ok:true};
    const can=unlocked&&!(key==='panel'&&outpost.panels>=12)&&colony.tool==='builder'&&!inside&&spot.ok&&colony.canPay(r.cost,outpost);
    return `<section class="builder-recipe"><h4>${r.name}</h4><p>${r.description}</p><p>${cost}</p><p>${key==='panel'&&outpost.panels>=12?'Solar field full: 12 panels installed.':!unlocked?'Finish starter power and unlock tier '+(r.tier+1):inside?'Go outside to build.':colony.tool!=='builder'?'Equip your builder tool from the belt.':!spot.ok?spot.why:'Materials come from base storage. Unload samples at the locker.'}</p><div class="builder-actions"><button data-track="${key}">${s.buildPlan===key?'Stop tracking':'Track materials & build'}</button><button data-recipe="${key}" ${can?'':'disabled'}>${key==='greenhouse'?'Build here':'Install in power field'}</button></div></section>`;
  }).join('');
  let buildSubmitted=false;
  const close=modal({title:'Builder · choose a project',html:`<p>Collect minerals, unload at the locker, then equip the builder. Track a recipe for one step at a time.</p>${rows}<details><summary>Game rules & starter kits</summary><p>Ore deposits replenish each sol in safe, unoccupied spots. This is a renewable game resource; real minerals do not regrow. Mineral costs represent simplified processing with landed components, not making electronics directly from raw rocks.</p><p>Your first array, battery and charger use landed kits. Assemble those at the workbench and connect their sockets.</p></details>`,choices:[{label:'Back to game',primary:true}]});
  const box=$('#modal .modal-box');
  box.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>{s.buildPlan=s.buildPlan===b.dataset.track?null:b.dataset.track;if(s.buildPlan)recordLesson(s,'track');missionKey='';saveGame();close();if(s.buildPlan)zhetela(builderQuest(outpost,s)?.step||'Project tracked. Finish the current starter power step first.');});
  box.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{
    const key=b.dataset.recipe,r=RECIPES[key];
    if(buildSubmitted)return;
    if(inside||colony.tool!=='builder'||outpost.powerStep<6||!outpost.baseConnected||outpost.tier<r.tier||!colony.canPay(r.cost,outpost))return;
    if(key==='greenhouse'){const spot=colony.buildSpot(world.player.position,world.yaw);if(!spot.ok){openBuild();return;}buildSubmitted=true;colony.pay(r.cost,outpost);colony.build(spot,world.yaw);}
    else {if(!outpost.buy(key))return;buildSubmitted=true;const ores={...r.cost};delete ores.parts;colony.pay(ores,outpost);syncPowerHardware();}
    s.buildHistory??={};s.buildHistory[key]=(s.buildHistory[key]||0)+1;if(s.buildPlan===key)s.buildPlan=null;missionKey='';toolbarKey='';saveGame();close();zhetela(r.name+' built. Open Builder (B) to choose your next project.',true);
  });
}

// ---------------- events from the simulation ----------------
// Mission Control's portrait + an event picture, when the team has added them (assets/art/)
const eventArt = (type, alt) => zhetelaPortraitHTML() + artHTML('event-' + type, alt, 'event-art');

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
          { label: 'Hide in the storm shelter', cost: `Safest. But no science for ${outpost.storm.sols} sols, and you must be inside the outpost.`, onPick: () => { earn('shelter'); outpost.shelter = outpost.storm.sols; if (!inside) toast('Head back to the outpost - the shelter only works inside!', 4500); } },
          { label: '🛡 Put more power into shielding', cost: 'Takes power away from science and talking to Earth.', onPick: () => { outpost.setSplit({ ...outpost.split, shield: Math.max(outpost.split.shield, 0.45), science: outpost.split.science * 0.4, comms: outpost.split.comms * 0.8 }); toast('🛡 Shields up! Science and the radio get less power for now.'); } },
          { label: '⛏ Keep working and hope for the best', cost: 'You keep everything running - but your radiation badge will fill up much faster.' },
        ] });
      break;
    }
    case 'storm-end': toast('☀️ The solar storm has passed.'); earn('storm'); break;
    case 'hazard-detected':   // the monitor inside blinks; the first time, tell the player where to look
      if (!monitorTipShown) { monitorTipShown = true; toast('📟 New reading! The hazard monitor inside the base has spotted something. Go and check it.', 6000); }
      break;
    case 'dust-cinematic': if(!inside)playStorm(world); break;
    case 'dust':
      queue.push({type:'dust-cinematic'});
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
      earn('tier');
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
  if(n.type==='mission-work')return performMissionWork(n.task);
  if(n.type==='power-site') return zhetela('Aim at a highlighted placement slot or cable socket and press E / Use.');
  if (n.type === 'lookout') return world.lookouts?.use(n.i);
  if (n.type === 'site') return world.sites?.use(n.id);
  if (n.type === 'find') return world.mapState?.collect(n.id);
  if (n.type === 'scout') return world.mapState?.openScout();
  if(n.type.startsWith('survey-')) {
    const key=n.type.slice(7),mission=world.settlement;
    const titles={meteorite:'Meteorite field survey',relay:'Relay station inspection',ice:'Subsurface survey'};
    const notes={meteorite:'Inspect the iron-rich meteorite and compare it with the surrounding basalt. Meteorites help scientists study materials from elsewhere in the solar system.',relay:'Check the communications instrument. Reliable links and relay orbiters let Mars explorers send their science home.',ice:'Take a below-ground survey reading. This is a prospecting task: it does not mean an ice deposit has already been confirmed at the site.'};
    const first=!mission.surveys.has(key);mission.surveys.add(key);if(first){outpost.science+=8;logFact(F[key==='meteorite'?'meteorite':key==='relay'?'relay':'ice']);}
    modal({title:titles[key],html:`<p>${notes[key]}</p><p>${first?'Survey complete: +8 science stored for transmission to Earth.':'This survey has already been logged.'}</p>`,choices:[{label:'Continue',primary:true}]});return;
  }

  if (n.type === 'door') return goInside(n.entrance);
  if (n.type === 'ship') return goInShip();
  if (n.type === 'ghdoor') return goInGreenhouse('out');
  if (n.type === 'ore') { mine(n.deposit); return; }
  if (n.type === 'greenhouse') return openGreenhouse(n.house);
  if (n.type === 'sev') {
    world.enterRover(); roverFrom = world.sev.pos.clone();
    if (!world.sevShown) { world.sevShown = true; modal({ pause: true, title: '🚙 The crew rover', html: `<p>This is NASA's <b>Space Exploration Vehicle</b> - a real design for a small rover the crew can live in. Inside, the air is like the outpost's, so you take off your helmet and your <b>suit air refills</b>. Astronauts get in and out through <b>suitports</b> at the back: the spacesuits stay docked outside, so no dust comes in.</p><p><b>${keyWord('W / S', 'Left thumb up / down')}</b> to drive, <b>${keyWord('A / D', 'left / right')}</b> to steer, <b>${keyWord('E', 'Use')}</b> to climb out. Driving uses the rover's <b>battery</b>: park it in your connected charging bay to charge it.</p><p class="source">Real NASA 3D model (NASA 3D Resources). In the game it drives faster than the real one so trips are short.</p>`, choices: [{ label: "Let's drive!", primary: true }] }); }
    else toast(`🚙 In the rover - battery ${Math.round(world.sev.battery * 100)}%. ${keyWord('E', 'Use')} to get out.`);
    return;
  }
  if (n.type === 'sev-exit') { world.exitRover(); toast('🧑‍🚀 Out through the suitport at the back of the rover.'); return; }
  if (n.type === 'panels') {
    if(outpost.clean>=.999)return toast('Solar panels are already clean.');
    outpost.cleanPanels(); world.setPanelDust(1); world.panelsDirty = false; earn('dust');
    modal({ title: '🧽 Solar panels cleaned!', html: `<p>Back to full power. Dust settles on them a little every sol - and a lot during dust storms - so check them often.</p>${factHTML(F.dustPanels)}` });
    return;
  }
  if (n.type === 'rover') {
    world.rover.salvaged = true; outpost.parts += 8; say('rover'); earn('percy');
    world.rover.group.children[0].visible = false; // switch off its beacon
    modal({ title: '🤖 You found an old rover!', html: `${factHTML(F.perseverance)}${factHTML(F.moxie)}<p>You carefully salvage <b>8 spare parts</b> for your workbench.</p>` });
    return;
  }
  if (n.type === 'heli') {
    world.heli.seen = true; earn('heli');
    modal({ title: '🚁 Ingenuity - the first helicopter on another planet', html: `<p>This little helicopter weighs only 1.8 kg. It is made from NASA's own 3D model, at its real size.</p>${factHTML(F.ingenuity)}<p>The air on Mars is so thin that its blades had to spin thousands of times a minute - much faster than a helicopter's on Earth - just to lift off.</p>` });
    return;
  }
  const p = n.pickup; world.removePickup(p);
  if (p.kind === 'ice') { earn('ice'); const kg = Math.round(8 * outpost.s.ice); colony.s.ice = (colony.s.ice || 0) + kg; toast(`🧊 Ice! +${kg} kg of dirty ice for the water plant inside the outpost${outpost.s.ice > 1 ? ' (thick ice here!)' : outpost.s.ice < 1 ? ' (ice is thin here)' : ''}.`); }
  if (p.kind === 'metal') { earn('scrap'); outpost.parts += 1; toast('🔩 Useful metal: +1 part'); }
  if (p.kind === 'pod' && p.cargo) { colony.receive(p.cargo, outpost); if(p.cargo.seeds)(colony.s.farmQuest??={}).seedsCollected=true; toast(`📦 Your order from Earth: ${cargoWords(p.cargo)}. Seeds go into the storage locker.`, 5000); }
  else if (p.kind === 'pod') { outpost.o2 += 15; outpost.food += 20; outpost.parts += 3; toast('📦 Supplies from Earth: +15 kg oxygen, +20 meals, +3 parts'); }
  if(p.kind==='pod')saveGame();
}

function endMission() {
  clearSave();   // the mission is over, so there is nothing to resume
  document.exitPointerLock?.();
  const o = outpost.over;
  if (o.win) earn('complete');
  say(o.win ? 'win' : 'lose');
  const why = {
    complete: `You kept your crew alive for all ${outpost.d.sols} sols. Mission complete! Your base reached the "${TIERS[outpost.tier].name}" tier.`,
    settlement: `Your base makes its own power, oxygen and food - a self-sustaining settlement on Mars! That is the big goal of NASA's Moon to Mars plans.`,
    oxygen: 'The oxygen ran out. Next time give life support more power, or collect more ice to make oxygen.',
    food: 'The crew ran out of food. Stock the galley from the locker and prepare harvested crops before your supplies run out.',
    radiation: `Your radiation badge reached NASA's ${F.careerLimit.value} mSv limit, so the crew had to go home. Try more shielding, or hiding in the shelter during solar storms.`,
  }[o.why];
  modal({ title: o.win ? '🏆 Mission complete!' : '🚀 Mission over', html: `
    ${zhetelaPortraitHTML()}<p>${why}</p>${firstMissionReport(outpost,colony.s).filter(m=>m.done).map(m=>`<p>✓ ${m.title}: ${m.lesson}</p>`).join('')}
    <p>Sols survived: <b>${outpost.sol}</b> · Science sent to Earth: <b>${outpost.scienceSent}</b> · Radiation: <b>${outpost.dose.toFixed(0)} mSv</b> · Score: <b>${outpost.score()}</b></p>
    ${factHTML(F.roundTrip)}
    <h4>📒 You collected ${logbook.size} real NASA fact cards. Quick quiz for your badge:</h4>
    <div id="quiz"></div><div id="badge"></div>
    <details><summary>📒 Read my logbook</summary><div class="log-list">${[...logbook.values()].map(f => factHTML(f, false)).join('')}</div></details>`,
    choices: [{ label: 'Play again', primary: true, onPick: () => location.reload() }] });
  const qs = pickQuestions(new Set(logbook.keys()));
  runQuiz($('#quiz'), qs, score => {
    const b = badgeFor(score, qs.length);
    if (b.key === 'gold') earn('gold');
    $('#badge').innerHTML = `<div class="badge">${hasArt('badge-' + b.key) ? artHTML('badge-' + b.key, b.name + ' badge', 'badge-art') : `<b>${b.icon}</b>`}${score} of ${qs.length} right - you earned the <b>${b.name}</b> badge!</div>`;
    try { const best = +localStorage.getItem('ja-best') || 0; if (score > best) localStorage.setItem('ja-best', score); } catch { /* storage blocked */ }
  });
}

// ---------------- input ----------------
// One place for the game's actions - the keyboard and the touch buttons both come here
function pressKey(code) {
  if(world?.cinematic)return;
  if (state.phase !== 'mars' || isModalOpen()) return;
  if (code === 'KeyB') { openBuild(); return; }
  if (code === 'KeyX') { construction?.placeBattery(); return; }
  if (code === 'KeyR') { construction?.cancel(); return; }
  if (code === 'KeyE') {
    if(construction?.use()) return;
    if (inside) { const s = room.nearest(); if (s) stationAction(s); }
    else { const n = world.nearest(); if (n) collect(n); else if (colony.tool === 'builder' && !world.driving) openBuild(); }
  }
  if ((code === 'Digit1' || code === 'Digit2') && colony) { selectPlayerTool(+code.slice(5) - 1); }
  if(code==='KeyQ'&&colony){selectPlayerTool(-1);}
  if(code==='KeyT')openMissionLog();
  if (code === 'KeyG') $('#map-btn').click();
  if (code === 'KeyP') openPower();
  if (code === 'KeyL') openLogbook();
  if (code === 'KeyM') muteButton();
  if (code === 'KeyV' && !inside) { world.firstPerson = !world.firstPerson; toast(world.firstPerson ? `👁 First-person view (${keyWord('V', 'tap View')} to switch back)` : '🎥 Third-person view'); }
}
addEventListener('keydown', e => { if (world) world.keys[e.code] = true; if(!e.repeat)pressKey(e.code); });
addEventListener('keyup', e => { if (world) world.keys[e.code] = false; });
// Mouse look needs pointer lock (desktop only). Phones have no pointer lock - they use the touch drag below.
let lastPointer = 'mouse';
$('#view').addEventListener('pointerdown', e => {
  lastPointer=e.pointerType;
  if(world && e.pointerType==='touch')world.aimPoint={x:2*e.clientX/innerWidth-1,y:1-2*e.clientY/innerHeight};
});
const mouseLocked = () => document.pointerLockElement === $('#view');
function captureMouse() {
  if (state.phase !== 'mars' || isModalOpen() || isTouch()) return;
  try { $('#view').requestPointerLock?.()?.catch?.(() => {}); } catch { /* no pointer lock here */ }
}
$('#view').addEventListener('pointermove', e => {
  if(!world)return;
  world.aimPoint=mouseLocked()||e.pointerType==='touch'?null:{x:2*e.clientX/innerWidth-1,y:1-2*e.clientY/innerHeight};
});
document.addEventListener('pointerlockchange',()=>{if(world)world.aimPoint=null;});
$('#view').addEventListener('click', () => {
  if (lastPointer==='touch')return;
  if(state.phase==='mars'&&!isModalOpen()&&construction?.use()){captureMouse();return;}
  if(state.phase==='mars' && colony.tool==='builder' && !world.driving && !isModalOpen()){openBuild();return;}
  if(state.phase==='mars' && !inside && !world.driving && !isModalOpen()){
    const target=world.nearest();if(target?.type==='panels')collect(target);else if(target?.type==='ore')mine(target.deposit);
  }
  captureMouse();
});
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
let lookReadyAt=0;
document.addEventListener('pointerlockchange',()=>{lookReadyAt=performance.now()+120;drawMouseNote();});
// Turning the camera: the mouse and the touch drag share the same math
function look(dx, dy) {
  if (!world || isModalOpen() || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
  if(Math.abs(dx)>250||Math.abs(dy)>250)return; // discard pointer-lock recenter spikes
  if (inside) {
    room.yaw -= dx * 0.0032;
    room.pitch = Math.max(-1.2, Math.min(1.2, room.pitch - dy * 0.0028));
  } else {
    world.yaw -= dx * 0.0032;
    if (world.firstPerson) world.lookPitch = Math.max(-1.2, Math.min(1.2, world.lookPitch - dy * 0.0028));
    else world.pitch = Math.max(-0.15, Math.min(1.2, world.pitch + dy * 0.0025));
  }
}
addEventListener('mousemove', e => { if (document.pointerLockElement === $('#view') && performance.now()>lookReadyAt) look(e.movementX, e.movementY); });
const touch = initTouch({ keys: () => world?.keys, look, press: pressKey });

// Screen size: Auto / Phone / Tablet / Desktop (title screen row + a HUD button)
const pick = $('#screen-pick');
pick.insertAdjacentHTML('beforeend', SCREEN_MODES.map(m => `<button data-screen="${m}">${screenName(m)}</button>`).join(''));
pick.querySelectorAll('button').forEach(b => b.onclick = () => setScreenMode(b.dataset.screen));
$('#screen-btn').onclick = () => { nextScreenMode(); toast(`📱 Screen: ${screenName(screenMode())}`); };
onLayout((mode, used) => {
  pick.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.screen === mode));
  $('#screen-btn').textContent = `Screen: ${screenName(mode)}${mode === 'auto' ? ` (${screenName(used)})` : ''}`;
});
$('#cine-btn').onclick = () => {
  if (inside) return toast('Go outside to watch a cutscene.');
  modal({ title: 'Cutscenes', html: '<p>Watch the big moments again. Click, Space or Esc skips them.</p>', choices: [
    { label: 'Mars landing', primary: true, onPick: () => { playLanding(world).catch(() => {}); } },
    { label: 'Dust storm', onPick: () => { playStorm(world).catch(() => {}); } }, { label: 'Close' }] });
};
$('#menu-btn').onclick = () => $('#hud').classList.toggle('menu-open');
$('#information-btn').onclick=()=>openSettings({tab:'information'});
$('#quit-menu-btn').onclick=()=>{
  if(!outpost?.over && !saveGame()){
    modal({title:'Could not save your mission',html:'<p>Your browser could not store the save. Your game is still open; free some browser storage and try again.</p>',choices:[{label:'Back to game'}]});
    return;
  }
  document.exitPointerLock?.();
  const url=new URL(location.href);url.hash='';location.assign(url.href);
};

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
const soundLabel = () => { $('#sound-btn').textContent = `Sound ${isMuted() ? 'off' : 'on'}${keyWord(' (M)', '')}`; };
function muteButton() { const m = toggleMute(); soundLabel(); toast(m ? '🔇 Sound off' : 'Sound on'); }
$('#sound-btn').onclick = () => openSettings({tab:'audio'});
soundLabel(); addEventListener('touchstart', soundLabel, { passive: true, once: true });
$('#view-btn').onclick = () => { if (world && !inside) world.firstPerson = !world.firstPerson; };
$('#speed-btn').onclick = () => { state.speed = state.speed === 1 ? 3 : 1; $('#speed-btn').textContent = 'Speed ×' + state.speed; };
let viewportFrame;
function resizeGame(){cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(()=>{renderer.setPixelRatio(Math.max(.5,targetRatio()*adaptiveRes.scale));renderer.setSize(innerWidth,innerHeight,false);renderer.shadowMap.enabled=effectiveQuality(GRAPHICS_MODE)!=='low';world?.resize();launch?.resize();interior?.resize();capsule?.resize();ghRoom?.resize();});}
addEventListener('resize',resizeGame);window.visualViewport?.addEventListener('resize',resizeGame);

// ---------------- HUD ----------------
function questBearing(){
  const task=marsObjective(outpost,colony.s),step=outpost.powerStep,exterior=['power','base','charger','shelter','soil','ice','seed-pod'].includes(task.target);
  let target,label;
  const galley=step===6 && colony.s.produce>0;
  if(!inside&&['workbench','greenhouse','locker','water'].includes(task.target))return ({workbench:'Workbench',greenhouse:'Grow beds',locker:'Storage locker',water:'Water plant'})[task.target]+' · inside the base';
  if(!inside){
    target=exterior?missionTarget(task.target):missionTarget(task.target)||world.settlement.entrances[1];
    label=exterior?task.title:'Airlock';
  }else{
    let station=room===capsule?'ship-exit':room===ghRoom?'gh-out':exterior?'exit':task.target==='water'?'water':task.target==='locker'?'locker':task.target==='workbench'?'workbench':'greenhouse';
    if(step===6&&room===ghRoom)station=task.target==='greenhouse'?'gh-bed':'tunnel';
    if(galley&&room===interior)station='locker';
    target=station==='tunnel'?{x:0,z:18.5}:room.stations.find(s=>s.type===station);
    if(station==='gh-bed'){
      const beds=colony.s.base, i=beds.findIndex(b=>b.ready), growing=beds.findIndex(b=>b.crop);
      target=room.stations.find(s=>s.type==='gh-bed' && s.bed===Math.max(0,i>=0?i:growing));
    }
    label=({tunnel:'Habitat tunnel','ship-exit':'Hatch','gh-out':'Airlock',exit:'Airlock',water:'Water plant',locker:'Locker',workbench:'Workbench',greenhouse:'Grow beds','gh-bed':'Grow beds'})[station];
  }
  if(!target)return 'Map';
  const pos=inside?room.pos:world.player.position, camera=inside?room.camera:world.camera;
  const look=camera.getWorldDirection(new THREE.Vector3());
  const angle=Math.atan2(target.x-pos.x,target.z-pos.z)-Math.atan2(look.x,look.z);
  const arrow=['↑','↖','←','↙','↓','↘','→','↗'][(Math.round(angle/(Math.PI/4))+16)%8];
  return arrow+' '+label+' · '+Math.round(Math.hypot(target.x-pos.x,target.z-pos.z))+' m';
}
function drawHUD() {
  drawMissionHud();
  const o = outpost, f = o.today;
  // Short numbers on the chips; the full sentence shows when you hover over one
  const o2Left = f.o2Net >= 0 ? null : Math.floor(o.o2 / -f.o2Net), foodLeft = f.foodNet >= 0 ? null : Math.floor(o.food / -f.foodNet);
  meter('#m-o2', o.o2 / 60, `${o.o2.toFixed(0)} kg${o2Left !== null && o2Left < 15 ? ` · ${o2Left} sols` : ''}`);
  meter('#m-food', o.food / 60, `${o.food.toFixed(0)}${foodLeft !== null && foodLeft < 15 ? ` · ${foodLeft} sols` : ''}`);
  meter('#m-power', f.total / Math.max(1,o.panels * TUNED.kWhPerPanel + o.reactors * TUNED.reactorKWh), `${f.total.toFixed(0)} kWh${o.dust ? ' · dust!' : ''}`);
  meter('#m-rad', o.dose / o.limit, `${o.dose.toFixed(1)} mSv`, true);
  $('#m-suit').classList.toggle('hidden', inside);
  meter('#m-suit', suit, `${Math.round(suit * suitAirSeconds())} s`);
  $('#m-o2').title = `Oxygen: ${o.o2.toFixed(1)} kg · ${o2Left === null ? 'steady' : o2Left + ' sols left'}`;
  $('#m-food').title = `Food: ${o.food.toFixed(0)} meals · ${foodLeft === null ? 'steady' : foodLeft + ' sols left'}`;
  $('#m-power').title = `Power today: ${f.total.toFixed(0)} kWh/sol · panels ${Math.round(o.clean * 100)}% clean${o.dust ? ' · dust storm!' : ''}`;
  $('#m-rad').title = `Radiation badge: ${o.dose.toFixed(1)} of ${o.limit} mSv`;
  $('#m-suit').title = `Suit oxygen: ${Math.round(suit * suitAirSeconds())} s of air left`;
  $('#sol').textContent = `Sol ${o.sol} of ${o.d.sols}`;
  // A sol uses a 24-hour Mars clock; its real duration is about 24.66 Earth hours. Battery gauge: charges in daylight, the heater drains it at night
  const ph = solClock / TUNED.solSeconds, hour = Math.floor(ph * 24), isDay = ph > TUNED.dayStart && ph < TUNED.dayEnd;
  const nightDone = ph >= TUNED.dayEnd ? (ph - TUNED.dayEnd) / (1 - TUNED.dayEnd + TUNED.dayStart) : (ph + 1 - TUNED.dayEnd) / (1 - TUNED.dayEnd + TUNED.dayStart);
  const battery = o.reactors ? 1 : isDay ? Math.min(1, (ph - TUNED.dayStart) / 0.3) : Math.max(0, 1 - nightDone * f.heater / o.battery);
  $('#tod').textContent = `${isDay ? '☀️ Day' : '🌙 Night'} · ${String(hour).padStart(2, '0')}:00 Mars time · 🔋 ${Math.round(battery * 100)}% · 🏗 ${TIERS[o.tier].name} · ${o.s.icon} ${o.s.short}`;
  const quest=colony?.s.farmQuest;
  $('#map-btn').textContent=quest?.rewarded?'Map · Harvest ✓':'Map · First harvest';
  $('#credits').textContent = noEmoji(`🔩 ${o.parts} parts · 🔬 ${o.scienceSent} science sent${o.science >= 1 ? ` (+${Math.floor(o.science)} waiting)` : ''}`);
  $('#link').textContent = noEmoji(f.link ? `📡 Earth link on · messages take ${o.delayMinutes().toFixed(1)} min` : (o.blackout ? '📵 Sun blocking the radio' : '📡 Earth link OFF (needs more power)'));
  const list = [];
  if (o.storm) list.push({ text: `☀️ Solar storm! ${o.shelter ? (inside ? 'Sheltering - stay inside' : 'Get back inside!') : 'Get inside or shield up!'}` });
  if (o.dust) list.push({ text: `🌪 Dust storm: ${o.dust} sols left` });
  if (f.o2Net < 0 && o.o2 / -f.o2Net < 8) list.push({ text: '🫁 Oxygen running low - more power to life support!' });
  if (world.driving && world.sev.battery < 0.25) list.push({ text: world.sev.battery > 0 ? '🔋 Rover battery low - drive to the connected charging bay' : '🔋 Rover battery flat - crawling home slowly' });
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
  $('#crosshair').classList.toggle('hidden', (!inside && !world.firstPerson && !mouseLocked() && !isTouch()) || isModalOpen());
  let hint = '', near = null;
  const useWord = keyWord('Press E', 'Tap Use');
  if (!isModalOpen()) {
    if (inside) {
      near = room.nearest();
      hint = near ? `${useWord} to ${near.label}` : body.canEat && body.rations < 14 ? keyWord('Hold F to eat. Your helmet is off in here', 'Hold Eat to eat. Your helmet is off in here') : `Walk to a station · ${keyWord('click', 'drag')} to look around`;
    } else {
      near = world.nearest();
      const names = { 'survey-meteorite':'inspect the meteorite field', 'survey-relay':'check the relay station', 'survey-ice':'perform a subsurface survey', door: 'go inside the outpost', rover: 'salvage the old rover', heli: 'look at the Ingenuity helicopter', ice: 'collect ice', metal: 'collect metal parts', pod: 'open the supply pod', panels: `clean the dusty solar panels (${Math.round(o.clean * 100)}% clean)` };
      names['mission-work']=near?.task?.title;
      if (near?.type === 'site') names.site = near.label; names['power-site']=powerSteps[o.powerStep]; names.lookout = 'scan the land from the lookout tower'; names.find = 'collect the survey find'; names.scout = 'send Ingenuity on a scout flight'; names.sev = 'get in the rover and drive'; names.ship = 'climb the ladder into your lander'; names.ghdoor = 'go into the greenhouse'; names['sev-exit'] = 'climb out';
      if (near?.type === 'ore') hint = `${useWord} to mine ${ORES[near.deposit.ore].name.toLowerCase()}${colony.tool === 'pickaxe' ? '' : ' with your pickaxe'}${colony.bagCount() >= BAG ? ' (bag full!)' : ''}`;
      else if (near?.type === 'greenhouse') hint = `${useWord} to tend the greenhouse${near.house.gh.ready ? ' - ready to harvest!' : ''}`;
      else if (world.driving) hint = `🚙 Battery ${Math.round(world.sev.battery * 100)}% · ${keyWord('W/S drive, A/D steer', 'left thumb drives')} · ${useWord} to climb out${body.canEat && body.rations < 14 ? keyWord(' · hold F to eat', ' · hold Eat to eat') : ''}`;
      else if (!near && colony.tool === 'builder') hint = `🛠 ${useWord} to build a greenhouse in front of you`;
      else hint = near ? `${useWord} to ${names[near.type]}` : (tutorialStep === 0 ? keyWord('Walk to the outpost door (green light) · click the game to look around · V for first person', 'Walk to the outpost door (green light) · left thumb moves, right thumb looks') : '');
    }
  }
  if(!near && !isModalOpen() && !world.driving){
    const atDoor=!inside && world.settlement.entrances.some(e=>world.player.position.distanceTo(e.handle.getWorldPosition(new THREE.Vector3()))<2.1);
    if(atDoor)hint=keyWord('Aim at the green handle · E to open','Tap the green handle, then Use');
    else if(marsObjective(outpost,colony.s).target)hint=questBearing();
  }
  const hintEl = $('#hint');                       // a hint that is no longer needed fades away slowly
  if(world.driving&&outpost.chargerStep>=3&&world.settlement){
    if(world.chargingStatus?.inBay)hint=`Charging bay · ${Math.round(world.sev.battery*100)}% · ${world.chargingStatus.status} · E / Use to exit`;
  }
  if(construction?.hint&&!isModalOpen())hint=construction.hint;
  hint = noEmoji(hint);
  if (hint) { if (hintEl.textContent !== hint) hintEl.textContent = hint; hintEl.classList.remove('gone'); }
  else hintEl.classList.add('gone');
  drawMouseNote();
  touch.sync({ active: !isModalOpen() && !o.over && !$('#hud').classList.contains('menu-open'), canUse: !!near || (!inside && colony.tool === 'builder'), inside, canEat: !!body.canEat });
  // rations row and the suit-air ring next to your astronaut
  let sx = null, sy = null;
  if (!inside && !world.driving) {
    if (world.firstPerson) { sx = innerWidth / 2 + 90; sy = innerHeight / 2; }
    else { const v = world.player.position.clone().add(new THREE.Vector3(0, 1.3, 0)).project(world.camera); sx = (v.x + 1) / 2 * innerWidth + 70; sy = (1 - v.y) / 2 * innerHeight; }
  }
  body.draw({ show: !isModalOpen() && !o.over && !world.cinematic && !$('#hud').classList.contains('menu-open'), suit, outside: !inside && !world.driving, sx, sy, t: clock.elapsedTime });
}

// Command window: press ` or F2. Fires events on demand so nobody waits for the weather.
const needOut = () => { if (state.phase !== 'mars') throw new Error('Start the game and reach Mars first.'); if (inside) throw new Error('Go outside first.'); };
devConsole({
  landing: { help: 'play the Mars landing cutscene', run: () => { needOut(); playLanding(world).catch(() => {}); return 'landing...'; } },
  storm: { help: 'play the dust storm cutscene only', run: () => { needOut(); playStorm(world).catch(() => {}); return 'storm rolling in...'; } },
  dust: { help: 'real dust storm event (cutscene, pop-up, power drop)', run: () => { if (state.phase !== 'mars') throw new Error('Reach Mars first.'); queue.push({ type: 'dust', sols: 3, seen: true }); return 'dust event queued'; } },
  'dust-end': { help: 'end the dust storm', run: () => { queue.push({ type: 'dust-end' }); return 'queued'; } },
  conjunction: { help: 'Sun-blocks-Earth pop-up', run: () => { queue.push({ type: 'conjunction' }); return 'queued'; } },
  'blackout-end': { help: 'Earth can hear you again', run: () => { queue.push({ type: 'blackout-end' }); return 'queued'; } },
  event: { help: 'event <type> : push any event type by name', run: t => { if (!t) throw new Error('usage: event <type>'); queue.push({ type: t }); return 'queued ' + t; } },
});

// Testing helper for the team: open the game with #debug in the address, then use
// game.event('solar-storm-warning'), game.event('dust', {sols: 5}), game.outpost.parts = 50 ...
if (location.hash === '#debug') window.game = { get construction(){return construction;}, mission: { objective:()=>marsObjective(outpost,colony.s), tick:updateMissionPower, target:missionTarget, log:openMissionLog }, get body() { return body; }, patches: () => openPatches(), get colony() { return colony; }, get outpost() { return outpost; }, get launch() { return launch; }, get world() { return world; }, get interior() { return interior; }, get capsule() { return capsule; }, goInShip: () => goInShip(), goInGreenhouse: (f = 'hab') => goInGreenhouse(f), get ghRoom() { return ghRoom; }, get renderer() { return renderer; }, get inside() { return inside; }, event: (type, extra = {}) => queue.push({ type, ...extra }), goInside: () => goInside(), station: t => stationAction({ type: t }), sound: soundDebug, phase: p => (solClock = p * TUNED.solSeconds) };
let sunsetShown = false, hudElapsed = 0, body = null, roverFrom = null, lastCrunch = 0, wasNight = false;
setPatchContext(() => ({ sol: outpost?.sol }));
setSoundGate(() => !isMuted());
setDuckHook(on => duck(on));

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
  adaptiveRes.tick();
  // Shadows refresh every frame normally. Only when the game is already struggling (resolution lowered) do they refresh every second frame.
  renderer.shadowMap.needsUpdate = adaptiveRes.scale >= 1 || (++shadowFrame & 1) === 0 || !renderer.shadowMap.enabled;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.phase === 'launch') {
    const { left, lifted, title, caption, km, karman } = launch.update(dt);
    const lift = -left;   // seconds since lift-off: engines start at T-1.5, full power after lift-off, quieter once the core stage is gone
    setSound({ thrust: left > 1.5 ? 0 : lift < 0 ? 0.5 : lift < 37 ? 1 : 0.25 }); tickSound(dt);
    showCaption(launch.modelsReady ? (lifted ? title : String(Math.max(0,left))) : (launch.modelError ? 'Download interrupted' : 'Preparing launch'), lifted ? 'cd-phase' : '', launch.modelsReady ? caption : (launch.modelError ? 'The detailed rocket or launcher could not load. Retry, or skip to the Mars briefing.' : 'Loading the detailed NASA rocket and mobile launcher. Countdown begins when both are ready.'));
    const retry=document.getElementById('retry-launch');if(retry)retry.hidden=!launch.modelError;
    cdAlt.classList.toggle('hidden', !lifted); cdAlt.classList.toggle('space', !!karman);
    cdAlt.textContent = `Height: ${Math.round(km)} km${km >= 100 ? ' · in space!' : ''}`;
    if (karman) logFact(F.karman);
    if (lifted && !launch.logged) { launch.logged = true; [F.sls, F.mobileLauncher, F.boosters, F.ascent, F.orbitSpeed].forEach(logFact); }
    renderer.render(launch.scene, launch.camera);
    if (launch.done) { state.phase = 'cruise'; arrive(); }
    return;
  }
  if (state.phase === 'mars' && world) {
    const paused = isPaused() || !!world.cinematic;
    setSound({ inside, suit, dust: !!outpost.dust, running: !!(world.keys.ShiftLeft || world.keys.ShiftRight) }); tickSound(dt);
    if (inside) room.update(dt, world.keys, !isModalOpen());
    if (inside && room===interior && interior.pos.z < -4.65){
      if(!colony.s.farmQuest.visited)farmProgress('visited');
      room=ghRoom;
      ghRoom.pos.set(interior.pos.x-20.4,0,interior.pos.z+23);
      ghRoom.yaw=interior.yaw;ghRoom.pitch=interior.pitch;ghRoom.vel={...interior.vel};ghRoom.update(0,world.keys,false);
    } else if(inside && room===ghRoom && ghRoom.pos.z>18.8){
      room=interior;interior.pos.set(ghRoom.pos.x+20.4,0,ghRoom.pos.z-23);
      interior.yaw=ghRoom.yaw;interior.pitch=ghRoom.pitch;interior.vel={...ghRoom.vel};interior.update(0,world.keys,false);
    }
    if (inside && room === ghRoom) ghRoom.draw(colony.s.base, GREENHOUSE.tank, outpost.today.total*outpost.split.life>=1);
    if (!inside) world.update(dt, !isModalOpen());
    construction?.update(inside,room,isModalOpen()||world.cinematic);
    if(!isModalOpen())updateMissionPower(dt);
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
        const runningNow = (world.keys.ShiftLeft || world.keys.ShiftRight) && !world.noRun && world.move.lengthSq() > 4;
        suit -= dt / suitAirSeconds();   // breathing harder (game balance)
        const f = outpost.today, perSol = step / TUNED.solSeconds;
        outpost.dose += F.surfaceDose.value * f.protection * perSol;   // the part the shield would have blocked
        if (outpost.storm) outpost.dose += outpost.storm.strength * TUNED.stormDose / outpost.storm.total * perSol * f.protection;
        if (suit <= 0) {
          suit = 1; outpost.o2 = Math.max(0, outpost.o2 - 5);
          modal({ title: '🆘 Out of suit air!', html: '<p>Your crewmates came out and carried you back inside just in time. Refilling your suit in a hurry used <b>5 kg of the outpost\'s oxygen</b>. Keep an eye on your suit meter!</p>', onClose: goInside });
        }
      } else suit = Math.min(1, suit + step * 0.25);
      // your own hunger (survival.js)
      const moving = !inside && !world.driving && world.move.lengthSq() > 0.5;
      const ev = body.update(step, { inside, driving: world.driving, moving, running: moving && (world.keys.ShiftLeft || world.keys.ShiftRight) && !world.noRun, eatHeld: !!world.keys.KeyF, foodStock: outpost.food, fresh: (colony.s.freshMeals || 0) >= .5 });
      world.noRun = !body.canRun; world.speedMul = body.starving ? 0.7 : body.rations<=6 ? .85 : 1;
      if (body.eatT > 0 && Math.floor(clock.elapsedTime * 5) !== lastCrunch) { lastCrunch = Math.floor(clock.elapsedTime * 5); crunch(); }
      if (ev === 'ate' || ev === 'ate-fresh') {
        outpost.food = Math.max(0, outpost.food - 0.5);
        if (ev === 'ate-fresh') { colony.s.freshMeals = Math.max(0, (colony.s.freshMeals || 0) - .5); earn('fresh'); toast('Fresh from the greenhouse. That keeps you going longer than the freeze-dried packs.', 4500); }
        else toast('Freeze-dried ration. Better than nothing.', 3000);
      }
      if (ev === 'starving') toast(keyWord('You are out of rations, so you are slower and breathing harder. Eat inside the outpost or the rover (hold F).', 'You are out of rations, so you are slower and breathing harder. Eat inside the outpost or the rover.'), 6000);
      if (!inside && !world.driving && Math.hypot(world.player.position.x - 28, world.player.position.z + 35) > 25) earn('steps');
      if (world.driving && roverFrom && world.sev.pos.distanceTo(roverFrom) > 200) earn('driver');
      if (wasNight && !world.night) earn('night');   // the Sun is up again
      wasNight = world.night;
      if (solClock >= TUNED.solSeconds) {
        solClock -= TUNED.solSeconds;
        queue.push(...outpost.tick());
        const renewed=colony.renewOres(outpost.sol);if(renewed)toast(`${renewed} ore deposits replenished · new sol`,3500);
        const notes = colony.tickSol(outpost);
        if(activeBed && isModalOpen() && $('[data-bed-controls]'))openGreenhouse(activeBed);
        const ripe = notes.filter(n => n.type === 'ripe'), dry = notes.filter(n => n.type === 'thirsty');
        if (ripe.length) toast(`🌱 ${ripe.map(n => CROPS[n.gh.crop].name).join(' and ')} ready to harvest in your greenhouse!`, 5000);
        else if (dry.length) toast(`💧 ${dry.length > 1 ? dry.length + ' greenhouse tanks are' : 'A greenhouse tank is'} empty - the plants stopped growing. Bring water in the jug.`, 5000);
        pending = pending.filter(p => {
          if (p.sol > outpost.sol) return true;
          world.dropSupplyPod(); if (p.cargo) world.pickups.at(-1).cargo = p.cargo;
          if(p.cargo?.seeds)(colony.s.farmQuest??={}).seedsLanded=true;
          toast(p.cargo?.seeds ? 'Seeds arrived near base · orange map square.' : 'Supplies landed · orange map square.');
          return false;
        });
        saveGame();
        world.setLink(outpost.today.link);
        world.setPanelDust(outpost.clean); world.panelsDirty = outpost.clean < 0.97;
        if (outpost.over) { queue.length = 0; endMission(); }
      }
    }
    if (!isModalOpen() && !world.cinematic && queue.length && !outpost.over) handle(queue.shift());   // wait until no pop-up is open, so events never replace one
    world.setTime(solClock / TUNED.solSeconds);
    if (!sunsetShown && !inside && solClock / TUNED.solSeconds > 0.72 && solClock / TUNED.solSeconds < 0.78) {
      sunsetShown = true; earn('sunset'); toast('🌅 Look at the sunset - on Mars sunsets are BLUE! Fine dust lets blue light through. (NASA Curiosity photographed one in 2015.)', 7000);
    }
    interior.setStorm(!!outpost.storm, clock.elapsedTime);
    interior.setMonitor(outpost.hazards.some(h => !h.seen), clock.elapsedTime);
    colony.update(clock.elapsedTime, world.night);
    hudElapsed+=dt;
    if(hudElapsed>=.1){drawHUD();hudElapsed=0;}
    world.minimap?.draw(!inside && !isModalOpen() && !$('#hud').classList.contains('menu-open'), dt);
    world.settlement?.updateGreenhouse(colony.s.base, outpost.today.total*outpost.split.life>=1);
    if(inside&&(room===ghRoom||room===capsule))renderInteriorView(renderer,world,room,room===ghRoom?'greenhouse':'capsule',dt);
    else if (inside) {
      const cam=interior.sharedCamera??=interior.camera.clone();
      cam.copy(interior.camera);cam.position.add(interior.scene.position);cam.updateMatrixWorld();
      renderInteriorView(renderer,world,{camera:cam,scene:ghRoom.scene,exteriorCamera:interior.exteriorCamera??=cam.clone()},'habitat',dt);
    }
    else renderer.render(world.scene, world.camera);
    return;
  }
  tickSound(dt);
  // title / explainer / cruise: slow pan over Mars once it exists
  if (world) { world.yaw += dt * 0.05; world.update(dt, false); renderer.render(world.scene, world.camera); }
  else renderer.clear();
});

// Quality changes rebuild geometry once, retaining the current mission through its normal save.
for (const button of document.querySelectorAll('.graphics-btn')) {
  button.textContent = `Graphics: ${GRAPHICS_MODE === 'low' ? 'low memory' : GRAPHICS_MODE}`;
  button.onclick = () => modal({ title: 'Graphics detail', html: '<p>Low memory reduces texture size, terrain detail and effects, and disables shadows. Auto adapts to your device. Balanced uses fewer terrain polygons; High gives the smoothest terrain. Nearby terrain loads in 64 m chunks; distant terrain stays coarse. Unloaded chunks retain mission progress. Applying saves your mission and reloads the game. Choose Resume afterwards.</p>', choices: [
    ...['low','auto','balanced','high'].map(mode => ({label: mode==='low'?'Low memory':mode[0].toUpperCase()+mode.slice(1), primary:mode===GRAPHICS_MODE, onPick:()=>{
      saveGame(); try {localStorage.setItem('mars-graphics',mode);} catch {}
      const url=new URL(location.href);url.searchParams.set('graphics',mode);location.assign(url.href);
    }})), ...['map',1,2,3].map(radius=>({label:radius==='map'?'Match minimap (240 m)':`World limit: ${radius} chunk${radius>1?'s':''} radius (up to ${(radius*2+1)**2} detailed tiles)`,primary:radius===WORLD_LIMIT,onPick:()=>{saveGame();try{localStorage.setItem('mission-world-limit',String(radius));}catch{}const url=new URL(location.href);url.searchParams.set('chunks',radius);location.assign(url.href);}})), {label:'Cancel'}
  ] });
}

initSettings({facts:F,destination:'Mars',actions:{save:saveGame,sources:showData,howto:()=>$('#howto').click(),graphics:()=>document.querySelector('.graphics-btn').click(),screen:()=>document.querySelector('#screen-btn').click(),fullscreen:()=>document.querySelector('#fs-btn').click(),view:()=>document.querySelector('#view-btn').click()}});
document.querySelectorAll('.settings-open').forEach(b=>b.onclick=()=>openSettings());
// Legacy controls remain wired for shortcuts, but their duplicate buttons live in Settings.
for(const id of ['sound-btn','data-btn','pedia-btn','log-btn','screen-btn','fs-btn'])document.getElementById(id).hidden=true;
document.querySelectorAll('.graphics-btn').forEach(b=>b.hidden=true);

for(const id of ['screen-pick','fs-btn-title','data-btn-title','pedia-btn-title'])document.getElementById(id).hidden=true;

$("#moon-mission").onclick=()=>{saveGame();location.assign(new URL("moon/",location.href).href);};

// Guided construction missions share state with the actual simulation and hardware.
let missionCard,missionKey='',missionCollapseAt=0;
function setupMissionHud(){
  if(missionCard)return;
  missionCard=document.createElement('details');missionCard.id='mission-objective';missionCard.innerHTML='<summary></summary><small class="mission-progress"></small><p></p><button type="button">Quest log (T)</button>';
  $('#hud').appendChild(missionCard);missionCard.querySelector('button').onclick=openMissionLog;
  const help=document.createElement('button');help.textContent='How do I do this?';help.onclick=openTutorial;missionCard.append(help);
  const buildButton=document.createElement('button');buildButton.textContent='Builder (B)';buildButton.onclick=openBuild;$('#map-btn').after(buildButton);
  const button=document.createElement('button');button.textContent='Quest log (T)';button.onclick=openMissionLog;$('#map-btn').after(button);
}
function missionTarget(kind){
  const m=world?.settlement;if(!m)return null;
  if(['workbench','greenhouse','locker','water','console'].includes(kind))return null; // The objective is the indoor station, never the stairs.
  if(kind==='ice'||kind==='seed-pod')return world.pickups.filter(p=>kind==='ice'?p.kind==='ice':p.kind==='pod'&&p.cargo?.seeds).sort((a,b)=>Math.hypot(a.x-world.player.position.x,a.z-world.player.position.z)-Math.hypot(b.x-world.player.position.x,b.z-world.player.position.z))[0]||null;
  if(construction?.wire){const destination={'solar-out':'battery-in','battery-in':'solar-out','battery-out':'base-in','base-in':'battery-out','base-out':'charger-in','charger-in':'base-out'}[construction.wire];const socket=construction.sockets.find(p=>p.userData.id===destination);if(socket)return socket.position;}
  if(kind==='build-ore'){const ore=builderQuest(outpost,colony.s)?.ore;return colony.deposits.filter(d=>d.ore===ore&&d.group.parent).sort((a,b)=>Math.hypot(a.x-world.player.position.x,a.z-world.player.position.z)-Math.hypot(b.x-world.player.position.x,b.z-world.player.position.z))[0]||null;}
  if(kind==='build-parts')return world.pickups.filter(p=>p.kind==='pod'||p.kind==='parts').sort((a,b)=>Math.hypot(a.x-world.player.position.x,a.z-world.player.position.z)-Math.hypot(b.x-world.player.position.x,b.z-world.player.position.z))[0]||null;
  if(kind==='power')return outpost.powerStep===4?m.pack.position:{x:47,z:-17};
  if(kind==='base')return {x:m.entrances[0].x+2.7,z:m.entrances[0].doorZ+1};
  if(kind==='charger')return outpost.chargerStep<3?m.chargerSite:m.chargingBay;
  if(kind==='shelter')return m.shelterSite;if(kind==='soil')return m.soilSite;
  if(!kind)return null;
  const e=m.entrances[kind==='greenhouse'?2:1];
  return {x:e.x,z:e.bottom+.65,y:heightAt(e.x,e.bottom+.65)};
}
function performMissionWork(task){
  if(marsObjective(outpost,colony.s).id!==task.id)return;
  if(task.id==='charger-1'){zhetela('Aim at the highlighted charging-post slot in the parking bay and press E / Use.');return;}
  if(task.id==='base'||task.id==='charger-2'){zhetela('Select the output socket, then walk to the matching input socket and press E / Use.');return;}
  else if(task.id.startsWith('charger-'))outpost.chargerStep++;
  else if(task.id==='soil-0')outpost.soilStep=1;
  else if(task.id==='soil-1')outpost.soilStep=2;
  else if(task.id==='soil-3'){outpost.upgrades.regolith=Math.max(1,outpost.upgrades.regolith);outpost.soilStep=4;world.setRegolith(outpost.upgrades.regolith);outpost.today=outpost.forecast();}
  outpost.today=outpost.forecast();syncPowerHardware();saveGame();toast('Done · '+task.title);
}
function drawMissionHud(){
  let charge=document.getElementById('rover-charge-status');if(!charge){charge=document.createElement('div');charge.id='rover-charge-status';document.getElementById('hud').append(charge);}
  const nearby=world.settlement&&Math.hypot(world.player.position.x-world.settlement.chargingBay.x,world.player.position.z-world.settlement.chargingBay.z)<12;
  charge.hidden=!nearby||inside||isModalOpen()||outpost.chargerStep<2;charge.textContent=`Rover ${Math.round(world.sev.battery*100)}% · ${world.chargingStatus?.status||'Approach charging bay'} · Stored charge ${(outpost.chargeReserve||0).toFixed(2)} kWh`;

  let delivery=document.getElementById('delivery-status');
  if(!delivery){delivery=document.createElement('button');delivery.id='delivery-status';document.getElementById('hud').append(delivery);delivery.onclick=()=>modal({title:'Cargo deliveries',html:`<p>Orange squares on the minimap mark unopened pods. Go to a pod and press E / Use. Seeds enter your locker only after collection.</p><ul>${world.pickups.filter(p=>p.kind==='pod').map(p=>`<li>${p.cargo?cargoWords(p.cargo):'Base supplies'} · ${Math.round(Math.hypot(p.x-world.player.position.x,p.z-world.player.position.z))} m away · map (${Math.round(p.x)}, ${Math.round(p.z)})</li>`).join('')}${pending.filter(p=>p.cargo).map(p=>`<li>${cargoWords(p.cargo)} · lands in ${Math.max(0,p.sol-outpost.sol)} sols</li>`).join('')}</ul>`});}
  const pods=world.pickups.filter(p=>p.kind==='pod'),orders=pending.filter(p=>p.cargo),nearest=pods.reduce((n,p)=>Math.min(n,Math.hypot(p.x-world.player.position.x,p.z-world.player.position.z)),Infinity);
  let dismiss=document.getElementById('delivery-dismiss');
  if(!dismiss){dismiss=document.createElement('button');dismiss.id='delivery-dismiss';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss cargo notice');delivery.after(dismiss);dismiss.onclick=()=>{delivery.dataset.dismissed=delivery.dataset.key;};}
  delivery.dataset.key=pods.map(p=>`${p.x},${p.z}`).join('|')+';'+orders.map(p=>p.sol).join('|');
  delivery.hidden=(!pods.length&&!orders.length)||isModalOpen()||delivery.dataset.dismissed===delivery.dataset.key;dismiss.hidden=delivery.hidden;if(!delivery.hidden){const rect=delivery.getBoundingClientRect();dismiss.style.top=rect.top+'px';dismiss.style.right=(innerWidth-rect.right)+'px';dismiss.style.bottom='auto';}delivery.textContent=pods.length?`▣ Cargo landed · ${Math.round(nearest)} m · map marker`:orders.length?`Cargo incoming · ${Math.max(0,Math.min(...orders.map(p=>p.sol))-outpost.sol)} sols`:'';

  if(!missionCard||!world.settlement)return;
  const q=colony.s.farmQuest??={};
  if(!q.seedsCollected){const seedOrder=pending.find(p=>p.cargo?.seeds);if(seedOrder)q.seedArrival=seedOrder.sol;q.seedsLanded=world.pickups.some(p=>p.kind==='pod'&&p.cargo?.seeds);}
  const task=builderQuest(outpost,colony.s)||marsObjective(outpost,colony.s);
  const milestones=firstMissionReport(outpost,colony.s);
  missionCard.querySelector('.mission-progress').textContent=`First base: ${milestones.filter(m=>m.done).length}/4 milestones · E / Use to interact`;
  if(milestones.every(m=>m.done)&&!outpost.firstBaseDebrief){outpost.firstBaseDebrief=true;saveGame();zhetela('First base mission complete! Open the quest log for your learning debrief. The rover, shielding and relay are your next projects.',true);}
  missionCard.hidden=isModalOpen()||world.cinematic||$('#hud').classList.contains('menu-open');
  if(task.id+'|'+(task.step||'')!==missionKey){missionKey=task.id+'|'+(task.step||'');zhetela(task.step||task.detail);missionCard.querySelector('summary').textContent=task.target==='workbench'?'Go to the workbench':task.title;if(task.step){const next=document.createElement('small');next.className='mission-next-step';next.textContent=task.step;missionCard.querySelector('summary').append(next);}missionCard.querySelector('p').textContent=task.detail;missionCard.open=true;missionCollapseAt=performance.now()+8000;}
  if(missionCollapseAt&&performance.now()>missionCollapseAt){missionCard.open=false;missionCollapseAt=0;}
  if(!interior.workbenchMarker){
    const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.16),new THREE.MeshBasicMaterial({color:'#c995ff',depthTest:false,depthWrite:false}));
    marker.name='workbench-objective';marker.renderOrder=100;interior.scene.add(marker);interior.workbenchMarker=marker;
  }
  const isGrow=task.target==='greenhouse';
  if(isGrow&&!ghRoom.objectiveMarker){ghRoom.objectiveMarker=interior.workbenchMarker.clone();ghRoom.scene.add(ghRoom.objectiveMarker);}
  const grow=ghRoom.objectiveMarker;if(grow){grow.visible=inside&&room===ghRoom&&isGrow&&!isModalOpen();const bedIndex=colony.s.base.findIndex(b=>b.ready)||0;const bed=ghRoom.stations.find(s=>s.type==='gh-bed'&&s.bed===Math.max(0,bedIndex));if(bed)grow.position.set(bed.x,2,bed.z);}
  const marker=interior.workbenchMarker,bench=interior.stations.find(s=>s.type===(task.target==='water'?'water':task.target==='locker'?'locker':task.target==='console'?'console':'workbench'));
  marker.visible=inside&&room===interior&&['workbench','locker','water','console'].includes(task.target)&&!isModalOpen();
  if(marker.visible&&bench){marker.position.set(bench.x,2.1+.08*Math.sin(performance.now()/300),bench.z);marker.rotation.y=performance.now()/1000;}
  world.objectiveTarget=missionTarget(task.target);
  const beacon=world.settlement.objectiveBeacon;
  if(beacon){beacon.visible=!!world.objectiveTarget&&!inside;if(beacon.visible){beacon.position.set(world.objectiveTarget.x,heightAt(world.objectiveTarget.x,world.objectiveTarget.z)+.08,world.objectiveTarget.z);beacon.scale.setScalar(1+.12*Math.sin(performance.now()/250));}}

}
function researchMenu(){openResearch(outpost,colony,world,saveGame);}
function openMissionLog(){
  if(!outpost||!colony)return;
  const task=builderQuest(outpost,colony.s)||marsObjective(outpost,colony.s);
  modal({title:'Mission objectives',choices:[{label:'Tutorial & current step',onPick:openTutorial},{label:'Food cultures & relay network',onPick:researchMenu}],html:`${zhetelaPortraitHTML()}<h4>${task.title}</h4><p>${task.detail}</p><details><summary>First base · progress & learning debrief</summary>${firstMissionReport(outpost,colony.s).map(m=>`<p>${m.done?'✓':'○'} <b>${m.title}</b>${m.done?'<br>'+m.lesson:''}</p>`).join('')}<p>Equipment, construction steps and growth times are simplified training rules. Continue playing to improve your base.</p></details><p>Builder projects completed: ${Object.entries(colony.s.buildHistory||{}).map(([k,n])=>`${RECIPES[k]?.name||k} × ${n}`).join(', ')||'none yet'}.</p><ol>${missionLog(outpost,colony.s).map(t=>`<li>${t.done?'✓':'○'} ${t.title}</li>`).join('')}</ol><details><summary>Optional exploration</summary><p>Collect samples, map landmarks, grow more crops and improve your shelter. The surface map tracks exploration; Settings → Information explains the science.</p></details><p>Solar panels make electricity. Solar sails propel spacecraft and are not needed here. Regolith shielding reduces radiation; it never makes exposure zero.</p>`});
}
function updateMissionPower(dt){
  if(!outpost||!world.settlement)return;
  const o=outpost,m=world.settlement;
  tickResearch(dt,o,colony,world);
  // A separate 2 kWh charging allocation. Values/rates are training-game rules.
  const surplus=o.baseConnected&&!world.night?o.chargerAllocation():0;
  o.chargeReserve=Math.min(2,(o.chargeReserve||0)+surplus*dt/TUNED.solSeconds);
  const wasDocked=o.roverCharged;
  world.chargingStatus=chargeRover(o,world.sev,m.chargingBay,dt);
  if(!wasDocked&&o.roverCharged){saveGame();toast('Rover connected · '+world.chargingStatus.status);}
}
