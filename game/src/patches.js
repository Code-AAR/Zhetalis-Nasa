// Mission patches: our version of Minecraft's advancements and Peak's badges. Real NASA crews wear a patch for
// every mission, so each first-time achievement here earns a stitched patch. The artwork is in patch-art.js and
// the award moment (animation and sound) is in patch-fx.js. This file keeps track of what you have earned.
// The patch book shows an empty slot in the shape of each patch you haven't earned yet (like the holes in a
// Pokémon badge case). Tap an earned patch to hear its note and turn it over to see when you earned it.
// Patches are kept in this browser across missions, so a second game starts with the ones you have.
import { modal } from './ui.js';
import { PATCHES, MEDAL, SHAPES, patchSVG, medalSVG } from './patch-art.js';
import { showAward, playNote, setSoundGate, setDuckHook } from './patch-fx.js';

export { PATCHES, patchSVG, setSoundGate, setDuckHook };

const KEY = 'ja-patches-v1', META = 'ja-patches-meta-v1';
let have = new Set(), meta = {};
try { have = new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch { /* storage blocked: patches last this visit only */ }
try { meta = JSON.parse(localStorage.getItem(META)) || {}; } catch { /* fine */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...have])); localStorage.setItem(META, JSON.stringify(meta)); } catch { /* fine */ } };

// The game tells us which sol it is, so the back of each patch can say when you earned it.
let context = () => ({});
export const setPatchContext = fn => { context = fn; };

// awards play one at a time
const queue = []; let showing = false;
let held = false;
export const holdAwards = on => { held = !!on; if (!held) next(); };   // cutscenes pause badge pop-ups
function next() {
  if (held || showing || !queue.length) return;
  showing = true;
  showAward(queue.shift()).catch(() => {}).then(() => { showing = false; next(); });
}

// Earn a patch (does nothing if you already have it). onEarn lets the game react (the sound is played by the award itself).
export let onEarn = null;
export const setOnEarn = fn => (onEarn = fn);
export function earn(id) {
  if (window.__resetting || have.has(id)) return false;
  const p = PATCHES.find(x => x.id === id); if (!p) return false;
  have.add(id); meta[id] = { sol: context().sol ?? null, at: Date.now() };
  queue.push(p);
  if (have.size === PATCHES.length && !meta.medal) { meta.medal = { sol: context().sol ?? null, at: Date.now() }; queue.push(MEDAL); }
  save(); next(); onEarn?.(p);
  return true;
}
export const patchCount = () => have.size;

// Reset badges for testing. In the browser console (F12): resetBadges() clears every badge and the medal;
// resetBadges('lookout') clears one by its id; badgeIds() lists the ids. Earn them again as you play.
export function resetBadges(id) {
  if (id) { have.delete(id); delete meta[id]; if (id !== 'medal') delete meta.medal; }
  else { have.clear(); meta = {}; }
  if (!id || id !== 'medal') meta.medal && have.size < PATCHES.length && delete meta.medal;
  save(); return `${have.size} of ${PATCHES.length} badges now earned`;
}
// Wipe everything saved by this game (saved mission, badges, best score) and reload. Console: resetGame(). Or open the game with #reset.
export function resetGame() {
  window.__resetting = true;
  try { for (const k of Object.keys(localStorage)) if (/^(ja-|zhetalis)/.test(k) && !/muted|screen/.test(k)) localStorage.removeItem(k); } catch { /* storage blocked */ }
  have.clear(); meta = {}; location.replace(location.pathname);
}
if (typeof window !== 'undefined') { window.resetGame = resetGame; if (location.hash === '#reset') resetGame(); window.resetBadges = resetBadges; window.badgeIds = () => PATCHES.map(p => p.id + (have.has(p.id) ? ' (earned)' : '')); }

const when = m => !m ? 'Earned on an earlier mission' : m.sol != null ? `Sol ${m.sol}` : new Date(m.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function openPatches(onBack) {
  const all = have.size === PATCHES.length;
  modal({ title: `Mission patches · ${have.size} of ${PATCHES.length}`, html: `
    <p class="pm-patches">Every crew that flies gets a mission patch. You earn one here for each first: try things out to find them all. Tap one you have to hear it and turn it over.</p>
    <div class="patch-medal ${all ? 'got' : ''}">${medalSVG(44, !all)}<div><b>${all ? MEDAL.name + ' medal' : '???'}</b><small>${all ? when(meta.medal) : MEDAL.hint}</small></div></div>
    <div class="patch-grid">${PATCHES.map((p, i) => {
      const got = have.has(p.id), cat = SHAPES[p.shape].name;
      return `<div class="patch-cell ${got ? 'got' : 'locked'}" data-i="${i}"><div class="pc-in">
        <div class="pc-face pc-front">${patchSVG(p, !got, 64)}<b>${got ? p.name : '???'}</b><small>${p.hint}</small></div>
        ${got ? `<div class="pc-face pc-back"><small>${cat} patch</small><b>No. ${String(i + 1).padStart(2, '0')}</b><span>${when(meta[p.id])}</span></div>` : ''}
      </div></div>`;
    }).join('')}</div>`, choices: [{ label: onBack ? 'Back' : 'Close', primary: true, onPick: onBack }] });
  document.querySelectorAll('.patch-cell.got').forEach(c => {
    c.onclick = () => { playNote(+c.dataset.i); c.classList.toggle('flipped'); };
  });
}
