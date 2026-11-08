// Moon mission: boot, menu, Orion flyby, lander descent, surface play, cabin, saving and the HUD.
// Shared (read-only) modules: src/settings.js (Settings + Information wiki), src/ui.js (modal),
// src/ambient-music.js (music), src/audio-preferences.js (levels), src/suit.js + src/nasamodels.js (3D models).
import * as THREE from 'three';
import { initSettings, openSettings } from '../../src/settings.js';
import { modal } from '../../src/ui.js';
import { startMusic, tickMusic } from '../../src/ambient-music.js';
import { onLayout } from '../../src/layout.js';
import { MOON, GAME_DAY_SECONDS, SITES, WORLD } from './config.js';
import { heightAt, permanentShadow } from './terrain.js';
import { sunAt, earthAt, skyVector } from './sun.js';
import * as sim from './sim.js';
import { currentObjective, questLog, warnings, mapMarker } from './quests.js';
import { packSave, writeSave, readSave, clearSave } from './save.js';
import { MoonWorld, QUALITY } from './world.js';
import { buildLander, BallisticDust, descentHeight, DESCENT_T, LANDER } from './lander.js';
import { Outpost } from './base.js';
import { Astronaut, Prints, lerpAngle } from './player.js';
import { MoonRover } from './moon-rover.js';
import { Flyby } from './flyby.js';
import { MISSIONS } from './orion.js';
import { initControls, readKeys, consume, input, on, holdKeys, CONTROLS_HTML } from './controls.js';
import { startAudio, tickAudio, thump, beep } from './audio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (p, fallback) => fetch(p).then(r => r.ok ? r.json() : fallback).catch(() => fallback);

// ---------- data (archived snapshots with provenance) ----------
const [FACTS, SITE, IMAGES, WEATHER] = await Promise.all([
  json('data/moon-facts.json', { facts: {} }), json('data/moon-site.json', null), json('data/moon-images.json', { items: [] }), json('data/moon-space-weather.json', null),
]);
const facts = FACTS.facts || {};
const horizon = SITE?.horizon || null;
const SEASON = 0.45;   // between equinox and southern winter: the Sun dips behind far ridges once a lunar day
const sepEvents = (WEATHER?.events || []).filter(e => e.time).sort((a, b) => a.time.localeCompare(b.time));
const alertGap = GAME_DAY_SECONDS / Math.max(1, Math.min(3, Math.round(sepEvents.length / 24.7 || 1)));

// ---------- renderer ----------
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.aa, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixel));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;   // training-sim exposure: readable for kids
renderer.shadowMap.enabled = QUALITY.name !== 'low';   // phone Lite: no shadow maps
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }

// ---------- surface scene ----------
const scene = new THREE.Scene(); scene.background = new THREE.Color('#000000');
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 20000);
resize(); addEventListener('resize', resize);
const sunLight = new THREE.DirectionalLight('#ffffff', 3.2);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
const S = QUALITY.name === 'low' ? 45 : 70; Object.assign(sunLight.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 600 });
sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.06;
scene.add(sunLight, sunLight.target);
const fill = new THREE.HemisphereLight('#1a2232', '#4a4a48', 0.32); scene.add(fill);   // earthshine + light bounced off the ground
const world = new MoonWorld(scene, SITE);
const lander = buildLander(); lander.position.set(0, heightAt(0, 0) + 1.7, 0); scene.add(lander);
const outpost = new Outpost(scene, lander);
const dust = new BallisticDust(scene);
const prints = new Prints(scene);
const astro = new Astronaut(scene);
const rover = new MoonRover(scene);
const colliders = outpost.colliders();

// ---------- flyby scene ----------
const flyby = new Flyby(renderer);

// ---------- game state ----------
let mode = 'menu';             // menu | flyby | descent | surface
let state = null;              // sim state (surface)
let place = 'outside';         // outside | hab | rover | lift
let view = 'third';            // third | first
let camYaw = Math.PI, camPitch = 0.28, camDist = 6;
let lamp = 'auto', holdT = 0, nearSpot = null, descentT = 0, liftT = 0, liftDir = 0, edgeToast = 0, saveT = 0, factQueue = [], lastSun = null;
let flybyPhotos = {}, cabinT = 0;
const saved0 = readSave();
if (saved0?.flyby) flybyPhotos = saved0.flyby;

// ---------- settings bridge ----------
initSettings({
  destination: 'Moon', facts: {}, controlsHtml: CONTROLS_HTML,
  actions: { save: () => saveNow(), fullscreen: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()), view: () => toggleView(), sources: () => showSources() },
});
function info(topic) {
  // Shared Settings handles this event. If it is ever missing, show our own card instead.
  const ev = new CustomEvent('open-settings', { detail: { tab: 'information', topic }, cancelable: true });
  dispatchEvent(ev);
  if (!document.querySelector('#modal:not(.hidden)')) factModal(topic);
}
function factModal(id) {
  const f = facts[id]; if (!f) return;
  modal({ title: f.title, html: `<p>${esc(f.text)}</p>${f.game ? `<p><b>In this game:</b> ${esc(f.game)}</p>` : ''}<p class="source">Source: <a href="${esc(f.source.url)}" target="_blank" rel="noopener">${esc(f.source.name)}</a></p>`, choices: [{ label: 'Back to the Moon', primary: true }] });
}

// ---------- UI helpers ----------
function toast(text, kind = '') {
  const d = document.createElement('div'); d.textContent = text; if (kind) d.className = kind; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 4200); while ($('#toast').children.length > 3) $('#toast').firstChild.remove();
}
function showFact(id) {
  const f = facts[id]; if (!f) return; const pop = $('#fact-pop');
  pop.innerHTML = `<h4>${esc(f.title)}</h4><p>${esc(f.short)}</p><div class="row"><button data-more>More in Settings → Information</button><button data-close>Got it</button></div><a href="${esc(f.source.url)}" target="_blank" rel="noopener">Source: ${esc(f.source.name)}</a>`;
  pop.hidden = false; pop.querySelector('[data-more]').onclick = () => info(id); pop.querySelector('[data-close]').onclick = () => (pop.hidden = true);
  clearTimeout(showFact.t); showFact.t = setTimeout(() => (pop.hidden = true), 14000);
}
const meter = (label, v, warnAt = 30) => `<div class="meter ${v < warnAt / 2 ? 'crit' : v < warnAt ? 'low' : ''}"><span>${label}</span><span class="track"><span class="fill" style="width:${v.toFixed(1)}%"></span></span><output>${Math.round(v)}%</output></div>`;
function caption(text, tag = '') { const c = $('#caption'); if (!text) { c.hidden = true; return; } c.innerHTML = (tag ? `<small>${esc(tag)}</small>` : '') + esc(text); c.hidden = false; }
function setMode(m) {
  mode = m; document.body.classList.toggle('surface', m === 'surface' || m === 'descent'); document.body.classList.toggle('flyby', m === 'flyby');
  document.body.classList.toggle('cinematic', m === 'descent');
  $('#menu').hidden = m !== 'menu'; $('#hud').hidden = m === 'menu';
  $('#flyby-hud').hidden = m !== 'flyby'; $('#window-frame').hidden = !(m === 'flyby' && flyby.m?.view === 'window');
  $('#skip').hidden = m !== 'descent'; if (m !== 'descent') caption('');
  $('#cabin').hidden = true; $('#alert').hidden = true; $('#prompt').hidden = true;
  if (m !== 'surface') { closeQuestLog(); document.body.classList.remove('alert-on'); }
  if (m === 'menu') { refreshMenu(); document.exitPointerLock?.(); }
}

// ---------- menu ----------
function refreshMenu() {
  const s = readSave(), ok = !!s?.state && s.state.status === 'playing';
  $('#resume-btn').hidden = !ok;
  $('#resume-note').textContent = ok ? `Saved: ${sim.tasksDone(s.state)}/${sim.TASKS.length} tasks · science ${Math.round(s.state.science)}` : 'New mission';
  const done = id => Object.keys(flybyPhotos[id] || {}).length;
  document.querySelector('[data-start="artemis1"] small').textContent = `Did not land · photos ${done('artemis1')}/3`;
  document.querySelector('[data-start="artemis2"] small').textContent = `Did not land · photos ${done('artemis2')}/3`;
}
$('#data-note').innerHTML = [
  SITE ? `Horizon & sunlight: NASA LOLA elevation (SVS CGI Moon Kit), archived ${esc(SITE.retrieved)}` : 'Horizon data missing - using a flat horizon',
  sepEvents.length ? `Solar particle alerts: ${sepEvents.length} real NASA DONKI events, archived ${esc(WEATHER.retrieved)}` : 'Solar particle alerts: practice drills (DONKI snapshot not available)',
  'Facts checked on nasa.gov, 8 Nov 2026',
].join(' · ');
document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { unlockAudio(); const id = b.dataset.start; id === 'surface' ? startSurface(false) : startFlyby(id); });
$('#resume-btn').onclick = () => { unlockAudio(); startSurface(true); };
$('#settings-btn').onclick = () => openSettings({ tab: 'audio' });
$('#sources-btn').onclick = () => showSources();
$('#gear-btn').onclick = () => openSettings({ tab: 'audio' });
$('#pause-btn').onclick = () => pause();
$('#info-btn').onclick = () => info(mode === 'flyby' ? flyby.m.fact : (objective?.fact || 'moon-gravity'));
$('#skip').onclick = () => { if (mode === 'descent') descentT = DESCENT_T + 3; };

function showSources() {
  const img = IMAGES.items || [];
  modal({
    title: 'Data sources & credits', html: `<ul class="sources">
    <li><b>Horizon and sunlight</b> - computed from NASA LRO LOLA elevation, <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener">NASA's Scientific Visualization Studio CGI Moon Kit</a> (${esc(SITE?.source?.resolution || '')}) Archived ${esc(SITE?.retrieved || 'n/a')}. Site ${esc(SITE?.site?.lat)}°, ${esc(SITE?.site?.lon)}° - a training site, not an Artemis landing site.</li>
    <li><b>Walkable ground</b> - a procedural crater field (many small craters, few big), not measured topography.</li>
    <li><b>Moon and Earth globes</b> - NASA SVS / LRO LROC colour map; NASA Earth map (shared Mars game assets).</li>
    <li><b>Astronaut and rover models</b> - NASA 3D Resources (Astronaut; Space Exploration Vehicle, which began as the Lunar Electric Rover).</li>
    <li><b>Orion and the training lander</b> - built from simple shapes for this game. The lander is only <i>inspired by</i> human landing system concepts; it is not a real design.</li>
    <li><b>Solar particle alerts</b> - ${sepEvents.length ? `${sepEvents.length} events from <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a>, archived ${esc(WEATHER.retrieved)}, squeezed into game time.` : 'practice drills; the NASA DONKI snapshot could not be downloaded.'}</li>
    <li><b>Reference photos</b> (NASA Image and Video Library, no key needed): ${img.map(i => `<a href="${esc(i.page)}" target="_blank" rel="noopener">${esc(i.title)}</a> (${esc(i.date)})`).join(', ')}.</li>
    <li><b>Facts</b> - NASA pages listed on each Information card, checked ${esc(FACTS.checked)}.</li>
    <li><b>Game rules</b> - power, oxygen and water rates, the compressed lunar day (one 29.53-day lunar day = ${GAME_DAY_SECONDS / 60} minutes) and the lighting angle are simplified for play. Gravity (1.62 m/s²) is real.</li></ul>`,
    choices: [{ label: 'Close', primary: true }],
  });
}

// ---------- flyby ----------
function startFlyby(id) {
  flyby.start(id, flybyPhotos[id] || {}); flyby.warp = 1;
  setMode('flyby'); buildFlybyHud(); showFact(MISSIONS[id].fact);
  toast(MISSIONS[id].crew ? 'Crew window view: drag to look around.' : 'Wing camera view: drag to aim the camera.');
}
// Built once per flight; afterwards only numbers and ticks change, so buttons keep focus and touches.
function buildFlybyHud() {
  const m = flyby.m;
  $('#flyby-hud').innerHTML = `<small class="tag real">Real mission · simplified path</small><h3>${m.name} <small>${m.crew ? '· 4 crew' : '· uncrewed'}</small></h3>
    <div class="stat">Above the Moon <b data-v="alt">-</b></div>
    <div class="stat">Speed <b data-v="speed">-</b></div>
    <ul>${m.targets.map(t => `<li data-t="${t.id}" title="${esc(t.hint)}">${esc(t.name)}</li>`).join('')}</ul>
    <div class="row"><button data-f="photo" class="primary">Photo</button><button data-f="warp">Time ×1</button><button data-f="about">About</button><button data-f="menu">Menu</button></div>`;
  $('#flyby-hud').querySelectorAll('[data-f]').forEach(b => b.onclick = () => ({ photo: takePhoto, warp: toggleWarp, about: () => info(m.fact), menu: () => setMode('menu') })[b.dataset.f]());
  drawFlybyHud();
}
function drawFlybyHud() {
  const hud = $('#flyby-hud'); if (!hud.querySelector('[data-v]')) return;
  const v = flyby.view(), ph = flyby.photos;
  hud.querySelector('[data-v="alt"]').textContent = Math.round(v.altKm).toLocaleString() + ' km';
  hud.querySelector('[data-v="speed"]').textContent = flyby.speedKmS().toFixed(2) + ' km/s';
  hud.querySelectorAll('[data-t]').forEach(li => li.classList.toggle('done', !!ph[li.dataset.t]));
  hud.querySelector('[data-f="warp"]').textContent = 'Time ×' + flyby.warp;
}
function toggleWarp() { flyby.warp = flyby.warp === 1 ? 4 : flyby.warp === 4 ? 10 : 1; drawFlybyHud(); }
function takePhoto() {
  if (mode !== 'flyby') return;
  const res = flyby.photo(), shot = flyby.snapshot();
  beep(res.hit ? 'done' : 'ok');
  if (!res.hit) { toast(res.reason); return; }
  flybyPhotos[flyby.id] = { ...flyby.photos }; saveNow();
  const ref = (IMAGES.items || []).find(i => i.id === (res.hit.id === 'earthset' ? 'earthset' : res.hit.id === 'farside' ? (flyby.id === 'artemis2' ? 'farside' : 'artemis1') : flyby.m.photo));
  modal({
    title: `Photo: ${res.hit.name}`, html: `<div class="shot"><figure><img src="${shot}" alt="Your photo"><figcaption>Your photo (3D game view)</figcaption></figure>
    ${ref?.file ? `<figure><a href="${esc(ref.page)}" target="_blank" rel="noopener"><img src="${esc(ref.file)}" alt="${esc(ref.title)}"></a><figcaption>Reference: “${esc(ref.title)}”, NASA, ${esc(ref.date)}. ${esc(ref.why)}.</figcaption></figure>` : ''}</div>
    <p>${res.hit.id === 'earthset' ? 'Earth slid behind the edge of the Moon - an Earthset. The Artemis II crew photographed one on 6 April 2026.' : res.hit.id === 'selfie' ? 'Artemis I had no crew, so cameras on the tips of its solar array wings took pictures of Orion with the Moon.' : res.hit.id === 'farside' ? 'The far side always faces away from Earth, so only spacecraft and the Apollo and Artemis II crews have seen it directly.' : 'From out here Earth is a small, bright ball - all of humanity in one picture.'}</p>`,
    choices: [{ label: 'Keep flying', primary: true }],
  });
  drawFlybyHud();
}
function finishFlyby() {
  const m = flyby.m, n = Object.keys(flyby.photos).length;
  modal({
    title: `${m.name} flyby complete`, html: `<p>${esc(m.summary)}</p><p>Mission length: <b>${esc(m.length)}</b>. Your photos: <b>${n}/3</b>.</p><p>The next step for Artemis is landing. NASA's plan (checked Nov 2026): Artemis III in 2027 tests landers in Earth orbit, and the first Artemis landing is planned for Artemis IV in 2028. Want to try a future landing in training?</p>`,
    choices: [{ label: 'Try the surface training', primary: true, cost: 'Future training scenario - not a real mission', onPick: () => startSurface(!!readSave()?.state) }, { label: 'Fly it again', onPick: () => startFlyby(flyby.id) }, { label: 'Menu', onPick: () => setMode('menu') }],
  });
}

// ---------- surface ----------
function startSurface(resume) {
  const s = resume ? readSave() : null;
  if (s?.state) {
    state = s.state; prints.load(s.prints);
    if (s.player) { astro.pos.set(s.player.x, heightAt(s.player.x, s.player.z), s.player.z); astro.yaw = s.player.yaw; astro.vel.set(0, 0, 0); astro.grounded = true; }
    if (s.rover) { rover.pos.set(s.rover.x, s.rover.y, s.rover.z); rover.yaw = s.rover.yaw; rover.settle(); }
    place = s.player?.place === 'rover' ? 'rover' : s.player?.place === 'hab' ? 'hab' : 'outside';
    lander.userData.lift.position.y = place === 'hab' ? LANDER.hatchY : 0.2 - 1.7;
    setMode('surface'); if (place === 'hab') enterCabin(); toast('Mission resumed.', 'good');
  } else {
    state = sim.newState(); prints.load([]); place = 'hab';
    rover.pos.set(SITES.rover.x, 0, SITES.rover.z); rover.yaw = 0.6; rover.settle();
    astro.pos.set(0, heightAt(0, LANDER.radius + 2.6), LANDER.radius + 2.6);
    descentT = 0; setMode('descent');
  }
  astro.group.visible = place === 'outside';
}

function enterCabin() {
  place = 'hab'; astro.group.visible = false; document.exitPointerLock?.();
  const msg = sim.stowSamples(state); if (msg) { toast(msg, 'good'); beep('done'); }
  drawCabin(); $('#cabin').hidden = false;
}
function drawCabin() {
  const s = state;
  $('#cabin').innerHTML = `<h3>Lander cabin</h3><p>Your suit refills from the cabin air and battery. The cabin is your storm shelter: its walls and supplies cut down radiation exposure a lot.</p>
    <div class="cabin-meters"></div>
    <div class="actions">
      <button class="primary" data-c="out">Go outside<small>Ride the crew elevator down (${Math.round(LANDER.hatchY)} m)</small></button>
      <button data-c="o2">${s.electrolysis ? 'Switch oxygen maker OFF' : 'Switch oxygen maker ON'}<small>${s.electrolysis ? 'Saves power' : 'Costs power and water, makes oxygen'}</small></button>
      <button data-c="menu">Save and go to menu</button>
    </div>`;
  updateCabin();
  $('#cabin').querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    if (b.dataset.c === 'out') { $('#cabin').hidden = true; place = 'lift'; liftDir = -1; liftT = 0; }
    if (b.dataset.c === 'o2') { toast(sim.toggleElectrolysis(state)); drawCabin(); }
    if (b.dataset.c === 'menu') { saveNow(); setMode('menu'); }
  });
}

function updateCabin() { const el = document.querySelector('#cabin .cabin-meters'); if (el && state) el.innerHTML = meter('Suit O₂', state.suitO2) + meter('Suit power', state.suitPower) + meter('Base power', state.battery, 25) + meter('Base O₂', state.oxygen, 30); }

function doAction(spot) {
  let msg = '';
  const roverNear = rover.pos.distanceTo(astro.pos) < 25;
  if (spot.id === 'elevator') { place = 'lift'; liftDir = 1; liftT = 0; astro.pos.set(0, astro.pos.y, LANDER.radius + 1.25); return; }
  if (spot.id === 'mast') msg = sim.deployMast(state, spot.i);
  if (spot.id === 'drill') { msg = sim.drillIce(state, roverNear); dust.kick(spot.x, heightAt(spot.x, spot.z), spot.z, 0, 0, 25, 1.4); }
  if (spot.id === 'processor') msg = (state.handIce || (roverNear && state.roverIce)) ? sim.deliverIce(state, rover.pos.distanceTo(new THREE.Vector3(SITES.processor.x, rover.pos.y, SITES.processor.z)) < 25) : sim.toggleElectrolysis(state);
  if (spot.id === 'sample') msg = sim.collectSample(state, spot.sid);
  if (spot.id === 'instrument') msg = sim.deployInstrument(state, spot.key);
  if (msg) { toast(msg); beep('ok'); }
}

function onEvents(ev) {
  for (const e of ev) {
    if (e.type === 'task') { const t = sim.TASKS.find(t => t.id === e.id); toast(`Task done: ${t.title}`, 'good'); beep('done'); showFact(t.fact); }
    else if (e.type === 'warn') { toast(e.text, 'warn'); beep('warn'); }
    else if (e.type === 'info') toast(e.text);
    else if (e.type === 'alert') { beep('warn'); showFact(e.fact); const ev0 = sepEvents.length ? sepEvents[Math.floor(Math.random() * sepEvents.length)] : null; state.alert.source = ev0 ? `Based on a real solar particle event on ${ev0.time.slice(0, 10)} (NASA DONKI, archived)` : 'Practice drill'; }
    else if (e.type === 'rescue') { sim.rescue(state); if (place === 'rover') exitRover(); astro.pos.set(0, heightAt(0, LANDER.radius + 2.6), LANDER.radius + 2.6); enterCabin(); toast(e.text, 'warn'); }
    else if (e.type === 'end') endMission();
  }
}
function endMission() {
  const s = state, won = s.status === 'won'; saveNow();
  modal({
    title: won ? 'Training mission complete!' : 'Mission over',
    html: `<p>${won ? 'You set up power, made water and oxygen from Moon ice, and did real science - the jobs future Artemis crews will train for.' : esc(s.lostReason) + ' Keeping oxygen up means balancing power, water and time.'}</p>
      <p>Score <b>${sim.score(s)}</b> · science ${Math.round(s.science)} · tasks ${sim.tasksDone(s)}/${sim.TASKS.length} · rescues ${s.rescues} · ${Math.round(s.t / GAME_DAY_SECONDS * MOON.synodicDays * 10) / 10} Earth days on the Moon</p>
      <p>Your bootprints will stay sharp for a very long time - there is no wind on the Moon to blow them away.</p>`,
    choices: [won ? { label: 'Keep exploring', primary: true, onPick: () => { s.status = 'playing'; s.tasks = Object.fromEntries(Object.keys(s.tasks).map(k => [k, true])); } } : { label: 'Try again', primary: true, onPick: () => { clearSave(); startSurface(false); } }, { label: 'Menu', onPick: () => setMode('menu') }],
  });
}
function enterRover() { place = 'rover'; astro.group.visible = false; rover.vy = 0; toast('In the rover. W/S drive, A/D steer, R to get out.'); }
function exitRover() { const p = rover.exitPoint(); astro.pos.set(p.x, heightAt(p.x, p.z), p.z); astro.vel.set(0, 0, 0); astro.grounded = true; place = 'outside'; astro.group.visible = view !== 'first'; }
function toggleView() { view = view === 'third' ? 'first' : 'third'; astro.group.visible = place === 'outside' && view === 'third'; toast(view === 'first' ? 'Helmet view' : 'Follow camera'); }

function pause() {
  if (mode === 'menu') return; saveNow();
  modal({ title: 'Paused', html: '<p>Your mission is saved.</p>', choices: [
    { label: 'Resume', primary: true }, { label: 'Settings', onPick: () => openSettings({ tab: 'audio' }) },
    ...(mode === 'surface' ? [{ label: 'Restart surface training', cost: 'Clears this save', onPick: () => { clearSave(); startSurface(false); } }] : []),
    { label: 'Main menu', onPick: () => setMode('menu') }] });
}

// ---------- save ----------
function saveNow() {
  const prev = readSave();
  const data = state ? packSave({ state, player: { x: astro.pos.x, y: astro.pos.y, z: astro.pos.z, yaw: astro.yaw, place: place === 'lift' ? 'hab' : place }, rover: { x: rover.pos.x, y: rover.pos.y, z: rover.pos.z, yaw: rover.yaw }, prints: prints.list, flyby: flybyPhotos })
    : { ...(prev || { v: 1, prints: [] }), v: 1, flyby: flybyPhotos };
  writeSave(data);
}
addEventListener('pagehide', saveNow); document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// Shared screen-layout setting: forcing Phone or Tablet shows the touch controls as a preview; Desktop hides them
// unless the device really is touch-first.
const realTouch = matchMedia('(pointer: coarse)').matches;
onLayout((choice, l) => { document.body.classList.toggle('touch', realTouch || (choice !== 'auto' && l !== 'desktop')); });

// ---------- input ----------
initControls(canvas);
let audioOn = false;
function unlockAudio() { if (audioOn) return; audioOn = true; startAudio(); startMusic(); }
addEventListener('pointerdown', unlockAudio, { once: true }); addEventListener('keydown', unlockAudio, { once: true });
on('use', () => { if (mode === 'surface' && place === 'outside' && nearSpot && !nearSpot.hold) doAction(nearSpot); });
on('rover', () => {
  if (mode !== 'surface') return;
  if (place === 'rover') { if (Math.abs(rover.speed) > 0.6) { toast('Stop the rover first.'); return; } exitRover(); }
  else if (place === 'outside' && (astro.pos.distanceTo(rover.exitPoint().setY(astro.pos.y)) < 3.5 || Math.hypot(astro.pos.x - rover.pos.x, astro.pos.z - rover.pos.z) < 5.5)) enterRover();
  else if (place === 'outside') toast('Walk to the back of the rover to climb in.');
});
on('lamp', () => { lamp = lamp === 'auto' ? 'on' : lamp === 'on' ? 'off' : 'auto'; toast('Lamps: ' + lamp); });
on('view', toggleView);
on('menu', () => { if (questOpen) closeQuestLog(); else pause(); });
on('settings', () => openSettings({ tab: 'audio' }));
on('info', () => $('#info-btn').click());
on('tasks', () => { if (mode === 'surface') toggleQuestLog(); });
on('photo', () => takePhoto()); on('photoKey', () => { if (mode === 'flyby') takePhoto(); });
on('warp', () => { if (mode === 'flyby') toggleWarp(); });
on('map', () => $('#minimap').classList.toggle('big'));

// ---------- per-frame ----------
const clock = new THREE.Clock(); let hudT = 0, flyHudT = 0;
const tmp = new THREE.Vector3();
function frame() { requestAnimationFrame(frame); step(Math.min(0.05, clock.getDelta())); }
function step(dt) {
  const paused = !!document.querySelector('#modal:not(.hidden)');
  tickMusic(); readKeys();
  if (mode === 'menu') { flyby.backdrop(performance.now() / 1000); consume(); return; }
  if (mode === 'flyby') {
    if (!paused) { flyby.look(input.lookX, input.lookY); flyby.update(dt, input.keys); }
    flyby.render(); flyHudT += dt; if (flyHudT > 0.25) { flyHudT = 0; drawFlybyHud(); }
    if (flyby.done && !flyby.reported) { flyby.reported = true; finishFlyby(); }
    if (!flyby.done) flyby.reported = false;
    tickAudio(dt, { inSuit: false }); consume(); return;
  }
  // surface + descent
  const sun = sunAt(state.t, { horizon, season: SEASON }), earth = earthAt(state.t, { horizon });
  if (mode === 'descent') { if (!paused) descentFrame(dt, sun); }
  else if (!paused) surfaceFrame(dt, sun);
  // lighting: real azimuth; elevation raised to a few degrees for visibility (true polar Sun is 0-2 deg)
  const lightEl = 6 + Math.max(0, sun.el) * 2, focus = place === 'rover' ? rover.pos : astro.pos;
  const dir = skyVector(sun.az, lightEl);
  sunLight.position.set(focus.x + dir.x * 300, focus.y + dir.y * 300, focus.z + dir.z * 300); sunLight.target.position.copy(focus);
  sunLight.intensity = 3.6 * sun.lit; fill.intensity = 0.42 + 0.2 * sun.lit;
  const sd = skyVector(sun.az, sun.el), ed = skyVector(earth.az, earth.el);
  world.sky(camera.position, tmp.set(sd.x, sd.y, sd.z), new THREE.Vector3(ed.x, ed.y, ed.z));
  world.sun.material.opacity = 0.15 + 0.85 * sun.lit;
  world.update(focus);
  prints.update(); dust.update(paused ? 0 : dt);
  const dark = sun.lit < 0.5 || permanentShadow(focus.x, focus.z) > 0.3;
  astro.lamp.intensity = (lamp === 'on' || (lamp === 'auto' && dark)) && place === 'outside' ? 45 : 0;
  rover.setLights(place === 'rover' && (lamp === 'on' || (lamp === 'auto' && dark)));
  outpost.update(dt, state, sun.az, sun.lit, earth.az, earth.el);
  renderer.render(scene, camera);
  hudT += dt; if (hudT > 0.2 && mode === 'surface') { hudT = 0; drawHud(sun, earth); }
  if (mode === 'surface' && state) drawMap();
  lastSun = sun; consume();
}

function descentFrame(dt, sun) {
  descentT += dt;
  const h = descentHeight(descentT), y = heightAt(0, 0) + 1.7 + h;
  lander.position.y = y;
  const firing = descentT < DESCENT_T + 0.3, near = Math.max(0, 1 - h / 50);
  lander.userData.plume.material.opacity = firing ? 0.12 + 0.1 * Math.random() : 0;
  lander.userData.engineLight.intensity = firing ? 40 : 0;
  if (firing && h < 50) dust.emit(0, 0, near, dt);
  // camera: wide, low shot that slowly circles
  const a = 0.9 + descentT * 0.03, r = 70 - near * 20;
  camera.position.set(Math.sin(a) * r, heightAt(Math.sin(a) * r, Math.cos(a) * r) + 4 + Math.max(0, h * 0.25), Math.cos(a) * r);
  camera.lookAt(0, y + 12 - near * 6, 0);
  if (descentT < 6) caption('Future surface-training scenario. This white lander is inspired by human landing system concepts - it is not a real mission or design.', 'Training simulation');
  else if (descentT < 13) caption('No air means no wind and no parachutes: the lander brakes only with its engines, all the way down.', 'Descent');
  else if (descentT < DESCENT_T + 1) caption('Engine blast throws dust outward. With no air, each grain follows a ballistic path: slow dust settles nearby, fast grains can fly a long way before landing.', 'Touchdown');
  else caption('Touchdown near the lunar south pole. No air means no drifting dust cloud - the grains near you have already landed.', 'Landed');
  if (descentT > DESCENT_T + 3.5) {
    lander.position.y = heightAt(0, 0) + 1.7; caption('');
    setMode('surface'); enterCabin(); showFact('moon-dust');
    modal({ title: 'Welcome to the Moon', html: `<p>You're a trainee at a future south-pole outpost. Your jobs: raise solar power, bring ice from a crater that never sees sunlight, turn it into water and oxygen, and do science.</p><p><b>Every choice costs something.</b> Making oxygen uses power and water. The cold crater drains your suit heater. The Sun circles low on the horizon and sometimes hides behind far-off mountains - then you live on batteries.</p><p>A real lunar day - sunrise to sunrise - lasts 29.53 Earth days. Here it is squeezed into ${GAME_DAY_SECONDS / 60} real minutes.</p>`, choices: [{ label: 'Go outside', primary: true, onPick: () => { $('#cabin').hidden = true; place = 'lift'; liftDir = -1; liftT = 0; } }, { label: 'Stay in the cabin for now' }] });
  }
}

function surfaceFrame(dt, sun) {
  const lift = lander.userData.lift, ground = heightAt(0, LANDER.radius + 1.25) - lander.position.y;
  // crew elevator ride
  if (place === 'lift') {
    liftT += dt / 5;
    const k = Math.min(1, liftT), y = liftDir > 0 ? THREE.MathUtils.lerp(ground + 0.1, LANDER.hatchY, k) : THREE.MathUtils.lerp(LANDER.hatchY, ground + 0.1, k);
    lift.position.y = y; astro.group.visible = view === 'third'; astro.pos.set(0, lander.position.y + y + 0.08, LANDER.radius + 1.25); astro.group.position.copy(astro.pos); astro.group.rotation.y = liftDir > 0 ? Math.PI : 0;
    if (k >= 1) {
      if (liftDir > 0) enterCabin();
      else { place = 'outside'; astro.pos.z += 1.5; astro.yaw = 0; astro.grounded = false; astro.vy = 0; astro.group.visible = view === 'third'; camYaw = 0; }
    }
  } else if (place === 'outside' || place === 'rover') lift.position.y = place === 'hab' ? LANDER.hatchY : ground + 0.1;
  // camera input
  camYaw -= input.lookX * 0.004; camPitch = THREE.MathUtils.clamp(camPitch + input.lookY * 0.003, -0.35, 1.2); camDist = THREE.MathUtils.clamp(camDist + input.zoom * 0.8, 2.5, 16);
  let env = { place: place === 'lift' ? 'hab' : place, lit: sun.lit, alertGap };
  if (place === 'outside') {
    const spots = outpost.spots(state, place);
    nearSpot = null; let best = 1e9;
    for (const sp of spots) { const d = Math.hypot(sp.x - astro.pos.x, sp.z - astro.pos.z); if (d < sp.r && d < best) { best = d; nearSpot = sp; } }
    if (nearSpot?.hold && input.useHeld) { holdT += dt; astro.swing = nearSpot.id === 'drill' ? (holdT * 1.2) % 1 : -1; if (holdT >= nearSpot.hold) { holdT = 0; astro.swing = -1; doAction(nearSpot); } }
    else { holdT = 0; astro.swing = -1; }
    const busy = holdT > 0;
    astro.update(dt, busy ? { x: 0, z: 0 } : input, camYaw + Math.PI, colliders.concat(world.rockList.filter(r => Math.abs(r.x - astro.pos.x) < 8 && Math.abs(r.z - astro.pos.z) < 8)), dust, prints, s => thump(s));
    if (astro.jumped) { state.stats.jumps++; astro.jumped = false; }
    if (!state.tasks.stepDown && Math.hypot(astro.pos.x, astro.pos.z) > LANDER.legReach + 5) { state.tasks.stepDown = true; onEvents([{ type: 'task', id: 'stepDown' }]); }
    env = { ...env, shadow: permanentShadow(astro.pos.x, astro.pos.z), running: input.run && astro.speed > 2, nearBase: rover.pos.length() < 25 };
    if (astro.hitEdge && performance.now() - edgeToast > 6000) { edgeToast = performance.now(); toast('Edge of the 1 km training area - head back toward the base.', 'warn'); }
    // follow camera
    if (view === 'first') { camera.position.copy(astro.head()); camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = camYaw + Math.PI; camera.rotation.x = -camPitch * 0.8; }
    else chase(astro.pos, 1.3, camDist);
    $('#prompt').hidden = !nearSpot;
    if (nearSpot) { $('#prompt').classList.toggle('holding', !!nearSpot.hold); $('#prompt span').innerHTML = `<kbd>${document.body.classList.contains('touch') ? 'Use' : 'E'}</kbd> ${nearSpot.hold ? 'Hold: ' : ''}${esc(nearSpot.label)}`; $('#prompt .hold b').style.width = (holdT / (nearSpot.hold || 1) * 100) + '%'; }
    tickAudio(dt, { effort: Math.min(1, astro.speed / 3 + (astro.grounded ? 0 : 0.4)), inSuit: true });
  } else if (place === 'rover') {
    const noPower = state.roverBattery <= 0;
    const r = rover.update(dt, { throttle: noPower ? 0 : -input.z, steer: -input.x, noPower }, colliders, prints, dust);
    if (r.bump > 0.3) thump(r.bump);
    if (!state.tasks.drive && permanentShadow(rover.pos.x, rover.pos.z) > 0.5) { state.tasks.drive = true; onEvents([{ type: 'task', id: 'drive' }]); }
    if (rover.hitEdge && performance.now() - edgeToast > 6000) { edgeToast = performance.now(); toast('Edge of the 1 km training area.', 'warn'); }
    env = { ...env, driving: r.driving, nearBase: false };
    astro.pos.copy(rover.pos);
    if (!input.lookX && Math.abs(rover.speed) > 0.5) camYaw = lerpAngle(camYaw, rover.yaw + (rover.speed < 0 ? Math.PI : 0), Math.min(1, dt * 1.5));
    chase(rover.pos, 2.4, Math.max(camDist, 9) + 3);
    $('#prompt').hidden = true;
    tickAudio(dt, { driving: r.driving, inSuit: false });
  } else {
    // in the cabin (or riding the lift): look out over the base from the hatch
    camYaw += dt * 0.05; camPitch = 0.22;
    chase(new THREE.Vector3(0, lander.position.y + 12, 0), 0, 42);   // slow orbit around the lander and base
    $('#prompt').hidden = true; tickAudio(dt, { inSuit: place === 'lift' });
    if (place === 'hab') { cabinT += dt; if (cabinT > 0.3) { cabinT = 0; updateCabin(); } }
  }
  if (rover.pos.length() < 25 && place !== 'rover') env.nearBase = true;
  onEvents(sim.tick(state, dt, env));
  saveT += dt; if (saveT > 8) { saveT = 0; saveNow(); }
}

// Third-person chase camera that never dips under the ground.
function chase(target, height, dist) {
  // keep the camera out of the lander hull: shorten the boom when it would end up inside
  const inHull = d => Math.hypot(target.x - Math.sin(camYaw) * d * Math.cos(camPitch), target.z - Math.cos(camYaw) * d * Math.cos(camPitch)) < LANDER.radius + 1 && target.y + height < lander.position.y + 40;
  if (Math.hypot(target.x, target.z) > LANDER.radius + 1) while (dist > 1.6 && inHull(dist)) dist -= 0.25;
  const cx = target.x - Math.sin(camYaw) * dist * Math.cos(camPitch), cz = target.z - Math.cos(camYaw) * dist * Math.cos(camPitch);
  let cy = target.y + height + Math.sin(camPitch) * dist;
  cy = Math.max(cy, heightAt(cx, cz) + 0.5);
  camera.position.lerp(tmp.set(cx, cy, cz), 0.25);
  camera.lookAt(target.x, target.y + height, target.z);
}

function drawHud(sun, earth) {
  const s = state;
  $('#bars').innerHTML = meter('Power', s.battery, 25) + meter('Oxygen', s.oxygen, 30) + meter('Water', s.water, 20) + `<div class="science"><span>Science</span><b>${Math.round(s.science)}</b></div>`;
  $('#suit').innerHTML = meter('Suit O₂', s.suitO2, 30) + meter('Suit pwr', s.suitPower, 25) + (place === 'rover' || s.roverIce ? meter('Rover', s.roverBattery, 20) : '') + (s.dose > 0 ? `<div class="science"><span>Radiation dose</span><b>${Math.round(s.dose)}</b></div>` : '') +
    (s.carried.length || s.handIce || s.roverIce ? `<div class="science"><span>Carrying</span><b>${[s.carried.length ? s.carried.length + ' samples' : '', s.handIce ? '1 ice' : '', s.roverIce ? s.roverIce + ' ice in rover' : ''].filter(Boolean).join(', ')}</b></div>` : '');
  const short = document.body.classList.contains('layout-phone') || innerWidth < 520;   // phones: shorter words so the row fits
  $('#clock').innerHTML = `<span><span class="sun-dot ${sun.lit < 0.5 ? 'off' : ''}"></span>${sun.lit < 0.5 ? (short ? 'Sun hidden' : 'Sun hidden by far ridges') : 'Sun up'}</span><span>${short ? 'Day' : 'Lunar day: Earth day'} ${sun.earthDays.toFixed(1)} of ${MOON.synodicDays}</span><span>${earth.visible ? (short ? 'Radio OK' : 'Earth in view · radio OK') : (short ? 'No Earth link' : 'Earth below horizon')}</span>`;
  updateObjective();
  // The most urgent warning stays on screen at the top, even with the quest log open.
  const al = $('#alert'), warn = currentWarnings.find(w => w.level === 'critical');
  if (s.alert) {
    const left = Math.ceil(s.alert.start + sim.RATES.sepWarning - s.t), storm = left <= 0;
    al.hidden = false; al.className = 'alert-banner critical'; al.innerHTML = `${storm ? `Solar particle storm! ${place === 'hab' ? 'You are sheltered.' : place === 'rover' ? 'The rover blocks some of it - the cabin is safer.' : 'Get inside!'}` : `Solar particle alert: shelter in ${left} s`}<br><small>${esc(s.alert.source || '')}</small>`;
  } else if (warn) { al.hidden = false; al.className = 'alert-banner critical'; al.textContent = warn.text; }
  else al.hidden = true;
  document.body.classList.toggle('alert-on', !al.hidden);
  if (questOpen) drawQuestLog();
}

// ---------- quests: compact objective card, quest log, minimap target ----------
let objective = null, objKey = '', objPinned = false, objUntil = 0, questOpen = false, currentWarnings = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const questCtx = () => ({ place, player: { x: astro.pos.x, z: astro.pos.z }, rover: { x: rover.pos.x, z: rover.pos.z }, sunLit: lastSun?.lit });
const focusPos = () => (place === 'rover' ? rover.pos : place === 'outside' ? astro.pos : { x: 0, z: 0 });
function setObjectiveOpen(open) {
  $('#task').classList.toggle('collapsed', !open);
  $('#obj-toggle').setAttribute('aria-expanded', String(open));
}
function updateObjective() {
  if (!state) return;
  const ctx = questCtx(), o = currentObjective(state, ctx), f = focusPos();
  objective = o; currentWarnings = warnings(state, ctx);
  if (o.key !== objKey) {
    const first = !objKey, newTask = objKey.split(':')[0] !== o.id; objKey = o.key;
    $('#obj-count').textContent = o.id === 'free' ? 'All objectives done' : `Objective ${o.index + 1} of ${o.total}`;
    $('#obj-title').textContent = o.title;
    $('#obj-detail').textContent = o.detail;
    // A new objective shows its full explanation for a few seconds, then folds down to its title.
    if (newTask || first) {
      setObjectiveOpen(true); objUntil = state.t + 9;   // game seconds: pausing or Settings does not eat the reading time
      const card = $('#task'); card.classList.remove('fresh'); void card.offsetWidth; if (!reducedMotion.matches) card.classList.add('fresh');
    }
  }
  if (objUntil && state.t > objUntil) { objUntil = 0; if (!objPinned) setObjectiveOpen(false); }
  $('#obj-step').textContent = o.step;
  $('#obj-dist').textContent = o.target ? `${Math.round(Math.hypot(o.target.x - f.x, o.target.z - f.z))} m` : '';
  const lg = $('#map-legend');
  lg.hidden = !o.target; if (o.target) lg.querySelector('span').textContent = `${o.target.label} · ${Math.round(Math.hypot(o.target.x - f.x, o.target.z - f.z))} m`;
}
$('#obj-toggle').onclick = () => { const open = $('#task').classList.contains('collapsed'); objPinned = open; objUntil = 0; setObjectiveOpen(open); };
$('#obj-info').onclick = () => info(objective?.fact || 'moon-gravity');
$('#obj-log').onclick = () => openQuestLog();
$('#quest-btn').onclick = () => toggleQuestLog();
$('#ql-close').onclick = () => closeQuestLog();
function openQuestLog() { if (mode !== 'surface') return; questOpen = true; $('#quest-log').hidden = false; document.body.classList.add('quest-open'); $('#quest-btn').setAttribute('aria-expanded', 'true'); drawQuestLog(); document.exitPointerLock?.(); }
function closeQuestLog() { questOpen = false; $('#quest-log').hidden = true; document.body.classList.remove('quest-open'); $('#quest-btn').setAttribute('aria-expanded', 'false'); }
function toggleQuestLog() { questOpen ? closeQuestLog() : openQuestLog(); }
function drawQuestLog() {
  if (!state) return;
  const ctx = questCtx(), q = questLog(state, ctx), w = warnings(state, ctx), f = focusPos(), a = q.active;
  const dist = a.target ? ` · ${Math.round(Math.hypot(a.target.x - f.x, a.target.z - f.z))} m away` : '';
  const legend = [['#ff4fd8', 'Objective (pulsing diamond; arrow at the edge when off the map)'], ['#7dffb2', 'You'], ['#ffffff', 'Lander'], ['#6fd3ff', 'Rover'], ['#ffd34d', 'Solar mast site'], ['#ffb347', 'Rock sample'], ['#5ab8ff', 'Ice drill'], ['#7dffb2', 'Processor / instruments']];
  $('#ql-body').innerHTML = `
    ${w.length ? `<h4>Warnings</h4><ul>${w.map(x => `<li class="warn-${x.level}">${esc(x.text)}</li>`).join('')}</ul>` : ''}
    <h4>Active</h4><ul><li class="active"><b>${esc(a.title)}</b><small>${esc(a.step)}${a.target ? ` · ${esc(a.target.label)}${dist}` : ''}</small></li></ul>
    ${q.upcoming.length ? `<h4>Up next</h4><ul>${q.upcoming.map(t => `<li>${esc(t.title)}</li>`).join('')}</ul>` : ''}
    <h4>Optional</h4><ul>${q.optional.map(o => `<li class="${o.done ? 'done' : o.failed ? 'failed' : ''}"><span class="prog">${esc(o.progress)}</span>${esc(o.title)}<small>${esc(o.why)}</small></li>`).join('')}</ul>
    <h4>Completed (${q.completed.length}/${sim.TASKS.length})</h4>${q.completed.length ? `<ul>${q.completed.map(t => `<li class="done">${esc(t.title)}</li>`).join('')}</ul>` : '<p>None yet.</p>'}
    <h4>Map key</h4><div class="ql-legend">${legend.map(([c, t]) => `<i style="background:${c}"></i><span>${esc(t)}</span>`).join('')}</div>`;
}

const mapCtx = $('#minimap').getContext('2d'); let mapBg = null, mapKey = '';
function drawMap() {
  const c = mapCtx, W = 160, span = 240, f = place === 'rover' ? rover.pos : astro.pos, k = W / span;
  const key = Math.round(f.x / 8) + ',' + Math.round(f.z / 8);
  if (key !== mapKey) {   // shaded relief, recomputed only when you move a few metres
    mapKey = key; const img = c.createImageData(W, W);
    for (let y = 0; y < W; y += 2) for (let x = 0; x < W; x += 2) {
      const wx = f.x + (x - W / 2) / k, wz = f.z + (y - W / 2) / k, h = heightAt(wx, wz), dx = heightAt(wx + 2, wz) - h;
      let v = Math.max(0, Math.min(255, 70 + h * 3 + dx * 40)); v *= 1 - 0.6 * permanentShadow(wx, wz);
      if (Math.abs(wx) > WORLD.half || Math.abs(wz) > WORLD.half) v = 20;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) img.data.set([v, v, v * 1.04, 255], ((y + oy) * W + x + ox) * 4);
    }
    mapBg = img;
  }
  c.putImageData(mapBg, 0, 0);
  const dot = (x, z, col, r = 3) => { const px = W / 2 + (x - f.x) * k, pz = W / 2 + (z - f.z) * k; c.fillStyle = col; c.beginPath(); c.arc(Math.max(4, Math.min(W - 4, px)), Math.max(4, Math.min(W - 4, pz)), r, 0, 7); c.fill(); };
  dot(0, 0, '#ffffff', 5); dot(rover.pos.x, rover.pos.z, '#6fd3ff', 4);
  for (const [id, b] of outpost.beacons) if (b.visible && id !== 'elevator') dot(b.position.x, b.position.z, id.startsWith('sample') ? '#ffb347' : id === 'drill' ? '#5ab8ff' : id.startsWith('mast') ? '#ffd34d' : '#7dffb2', 3);
  drawTarget(c, f, W, span);
  c.save(); c.translate(W / 2, W / 2); c.rotate(-(place === 'rover' ? rover.yaw : astro.yaw) + Math.PI);
  c.fillStyle = '#7dffb2'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5); c.fill(); c.restore();
  c.fillStyle = '#9aa6b4'; c.font = '10px Poppins, sans-serif'; c.fillText('N', W / 2 - 3, 12);
}

// Objective marker: magenta diamond with a pulsing cyan ring at the real target; if the target is beyond the
// 120 m map radius it becomes an arrow on the rim pointing the way, with the distance.
function drawTarget(c, f, W, span) {
  const t = objective?.target; if (!t) return;
  const mk = mapMarker(t, f, { size: W, span }); if (!mk) return;
  const pulse = reducedMotion.matches ? 0.5 : (performance.now() / 1100) % 1;
  c.save(); c.translate(mk.x, mk.y);
  c.strokeStyle = '#4ff0ff'; c.lineWidth = 2;
  if (!mk.clamped) {
    c.globalAlpha = reducedMotion.matches ? 0.9 : 1 - pulse; c.beginPath(); c.arc(0, 0, 6 + pulse * 9, 0, 7); c.stroke(); c.globalAlpha = 1;
    c.rotate(Math.PI / 4); c.fillStyle = '#ff4fd8'; c.fillRect(-4.5, -4.5, 9, 9); c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.strokeRect(-4.5, -4.5, 9, 9);
  } else {
    c.rotate(mk.angle); const grow = reducedMotion.matches ? 0 : Math.sin(pulse * Math.PI * 2) * 1.5;
    c.fillStyle = '#ff4fd8'; c.strokeStyle = '#4ff0ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(8 + grow, 0); c.lineTo(-5, -6 - grow * 0.5); c.lineTo(-2, 0); c.lineTo(-5, 6 + grow * 0.5); c.closePath(); c.fill(); c.stroke();
    c.rotate(-mk.angle);
    const label = mk.metres >= 1000 ? (mk.metres / 1000).toFixed(1) + ' km' : Math.round(mk.metres) + ' m';
    const lx = -Math.cos(mk.angle) * 20, ly = -Math.sin(mk.angle) * 14;
    c.font = '600 10px Poppins, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(label, lx, ly); c.fillStyle = '#ffffff'; c.fillText(label, lx, ly);
  }
  c.restore();
}

// ---------- integration API (for the shared menu / tests) ----------
window.MoonMission = {
  version: 1,
  start: m => (m === 'surface' ? startSurface(!!readSave()?.state) : m === 'artemis1' || m === 'artemis2' ? startFlyby(m) : setMode('menu')),
  save: saveNow,
  state: () => state && JSON.parse(JSON.stringify(state)),
  // Test hook: patch mission numbers (e.g. { nextAlert: 0 } or { suitO2: 8 }) to check warnings and alerts.
  debugSet: patch => { if (!state) return false; for (const [k, v] of Object.entries(patch || {})) if (k in state && typeof v !== 'object') state[k] = v; return true; },
  // Test hook: move the astronaut (outside only).
  teleport: (x, z) => { if (place !== 'outside') return false; astro.pos.set(x, heightAt(x, z), z); astro.vel.set(0, 0, 0); astro.grounded = true; return true; },
  press: code => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); },
  // Test hook: run the real frame logic for a number of game seconds with keys held (KeyboardEvent codes).
  simulate: (seconds = 1, codes = [], fps = 30) => { holdKeys(codes); for (let i = 0; i < seconds * fps; i++) step(1 / fps); holdKeys([]); return window.MoonMission.debug(); },
  debug: () => ({ mode, place, quality: QUALITY, chunks: { ...world.stats }, dust: dust.n, prints: prints.list.length, player: { x: +astro.pos.x.toFixed(2), y: +astro.pos.y.toFixed(2), z: +astro.pos.z.toFixed(2), grounded: astro.grounded, vy: +astro.vy.toFixed(2) }, rover: { x: +rover.pos.x.toFixed(2), z: +rover.pos.z.toFixed(2), speed: +rover.speed.toFixed(2) }, gravity: MOON.gravity, sun: lastSun, renderer: renderer.info.render, memory: renderer.info.memory }),
  info,
  quests: () => ({ objective, warnings: currentWarnings, log: state ? questLog(state, questCtx()) : null, open: questOpen, expanded: !$('#task').classList.contains('collapsed'), marker: objective?.target ? mapMarker(objective.target, focusPos()) : null }),
  three: () => ({ THREE, scene, camera, renderer, sunLight, fill, world, flyby }),
};

const want = new URLSearchParams(location.search).get('start');
setMode('menu'); document.body.classList.remove('booting');
if (want) window.MoonMission.start(want);
frame();
