// Saves today's real Mars data into game/data/mars-today.json:
//  - the newest daily weather from NASA's Curiosity rover (REMS instrument, Gale Crater)
//  - the real distance between Earth and Mars today, from NASA JPL Horizons
//
//   node scripts/snapshot-mars-data.mjs
//
// (Both are saved by a script because the weather feed is a 1.7 MB file and Horizons doesn't allow
//  requests straight from a web page. Re-run it before a demo to keep the numbers fresh.)
import { writeFileSync } from 'node:fs';

const weatherFeed = await (await fetch('https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json')).json();
const w = weatherFeed.soles.find(s => s.max_temp !== '--' && s.min_temp !== '--' && s.pressure !== '--');

const today = new Date().toISOString().slice(0, 10), tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const q = new URLSearchParams({ format: 'json', COMMAND: "'499'", CENTER: "'500@399'", EPHEM_TYPE: "'OBSERVER'", START_TIME: `'${today}'`, STOP_TIME: `'${tomorrow}'`, STEP_SIZE: "'1d'", QUANTITIES: "'20'" });
const hz = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + q)).json();
const rows = hz.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
const au = parseFloat(rows[0].trim().split(/\s+/).slice(-2)[0]);   // "delta" = Earth-Mars distance in astronomical units
const km = au * 149597870.7;

const out = {
  saved: new Date().toISOString(),
  weather: {
    sol: +w.sol, date: w.terrestrial_date, high: +w.max_temp, low: +w.min_temp, pressure: +w.pressure,
    sky: w.atmo_opacity, sunrise: w.sunrise, sunset: w.sunset, uv: w.local_uv_irradiance_index,
    source: "NASA Curiosity rover, REMS weather station (Centro de Astrobiología), Gale Crater", url: 'https://mars.nasa.gov/msl/weather/',
  },
  distance: { date: today, km: Math.round(km), lightMinutes: +(km / 299792.458 / 60).toFixed(1), source: 'NASA JPL Horizons', url: 'https://ssd.jpl.nasa.gov/horizons/' },
};
writeFileSync(new URL('../game/data/mars-today.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`Curiosity weather sol ${out.weather.sol} (${out.weather.date}): ${out.weather.low}..${out.weather.high} °C, ${out.weather.pressure} Pa`);
console.log(`Earth-Mars today: ${(km / 1e6).toFixed(1)} million km, light takes ${out.distance.lightMinutes} min`);
