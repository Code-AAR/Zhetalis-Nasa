// Save / resume for the Moon mission. One versioned JSON record in localStorage (storage is injectable for
// tests). Saves are small and bounded: footprints and rover tracks are capped.
import { validState } from './sim.js';

export const SAVE_KEY = 'zhetalis-moon-save-v1';
export const MAX_PRINTS = 240;

const defaultStore = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function packSave({ state, player, rover, prints = [], flyby = null, camera = null }) {
  const r2 = v => Math.round(v * 100) / 100;
  return {
    v: 1, savedAt: new Date().toISOString(), state,
    player: player && { x: r2(player.x), y: r2(player.y), z: r2(player.z), yaw: r2(player.yaw), place: player.place },
    rover: rover && { x: r2(rover.x), y: r2(rover.y), z: r2(rover.z), yaw: r2(rover.yaw) },
    prints: prints.slice(-MAX_PRINTS).map(p => [r2(p[0]), r2(p[1]), r2(p[2]), p[3] ? 1 : 0]),
    flyby, camera,
  };
}

export function writeSave(data, store = defaultStore()) {
  if (!store) return false;
  try { store.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function readSave(store = defaultStore()) {
  if (!store) return null;
  let d; try { d = JSON.parse(store.getItem(SAVE_KEY) || 'null'); } catch { return null; }
  if (!d || d.v !== 1) return null;
  if (d.state && !validState(d.state)) d.state = null;
  const ok = p => p && ['x', 'y', 'z', 'yaw'].every(k => Number.isFinite(p[k]));
  if (!ok(d.player)) d.player = null;
  if (!ok(d.rover)) d.rover = null;
  d.prints = Array.isArray(d.prints) ? d.prints.filter(p => Array.isArray(p) && p.slice(0, 3).every(Number.isFinite)).slice(-MAX_PRINTS) : [];
  return d;
}

export function clearSave(store = defaultStore()) { try { store?.removeItem(SAVE_KEY); } catch { /* private mode */ } }
