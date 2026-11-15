// Where the Sun and Earth are in the sky at the south-polar training site. Pure functions (tested in Node).
// The horizon profile comes from NASA LOLA elevation (data/moon-site.json, made by tools/fetch-moon-data.mjs).
import { MOON, GAME_DAY_SECONDS } from './config.js';
const D2R = Math.PI / 180;

// Horizon elevation (degrees) in a compass direction, interpolated from the 360-sample profile.
export function horizonAt(horizon, azDeg) {
  if (!horizon?.length) return 0;
  const n = horizon.length, a = ((azDeg % 360) + 360) % 360 * n / 360, i = Math.floor(a) % n, f = a - Math.floor(a);
  const v = k => (typeof horizon[k] === 'number' ? horizon[k] : horizon[k].el);
  return v(i) * (1 - f) + v((i + 1) % n) * f;
}

// Sun position for a game time (seconds). season -1..1 sets the declination (-1 = southern summer).
// Returns { az, el, lit, dayFraction, earthDays }.
export function sunAt(t, { lat = -89.46, horizon = null, season = -0.6, dayStart = 0.12 } = {}) {
  const dayFraction = (((t / GAME_DAY_SECONDS) + dayStart) % 1 + 1) % 1;
  const hAng = dayFraction * 360, p = lat * D2R, d = MOON.sunTiltDeg * season * D2R;
  const el = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(hAng * D2R)) / D2R;
  const az = (Math.atan2(Math.sin(hAng * D2R), Math.cos(hAng * D2R) * Math.sin(p) - Math.tan(d) * Math.cos(p)) / D2R + 180) % 360;
  const top = horizonAt(horizon, az);
  // 0..1 share of the Sun's disc (0.53 deg wide) above the horizon - panels fade in and out smoothly
  const lit = Math.max(0, Math.min(1, (el - top) / 0.53 + 0.5));
  return { az, el, horizon: top, lit, dayFraction, earthDays: dayFraction * MOON.synodicDays };
}

// Earth hangs low over the near-side horizon. Libration makes it bob by a few degrees over a month.
export function earthAt(t, { horizon = null, lonDeg = -137.78 } = {}) {
  const az = ((-lonDeg) % 360 + 360) % 360;   // towards 0 deg longitude (the near side)
  const el = 1.2 + 4.5 * Math.sin((t / GAME_DAY_SECONDS) * Math.PI * 2 * 1.085 + 0.9);
  return { az, el, visible: el > horizonAt(horizon, az) };
}

// Fraction of a lunar day that is sunlit for a horizon and season (used by tests and the briefing).
export function sunlitFraction(horizon, season, steps = 720) {
  let up = 0; for (let i = 0; i < steps; i++) if (sunAt(i / steps * GAME_DAY_SECONDS, { horizon, season, dayStart: 0 }).lit > 0.5) up++;
  return up / steps;
}

// Unit vector (x east, y up, z south) for an azimuth (deg from north, clockwise) and elevation.
export function skyVector(az, el) {
  const a = az * D2R, e = el * D2R;
  return { x: Math.sin(a) * Math.cos(e), y: Math.sin(e), z: -Math.cos(a) * Math.cos(e) };
}
