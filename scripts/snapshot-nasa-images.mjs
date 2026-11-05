// Saves a backup list of real NASA photos into game/data/nasa-images-snapshot.json,
// so the game still shows real pictures if a live NASA service is down on judging day.
//
//   node scripts/snapshot-nasa-images.mjs
//
// The EPIC request goes through api.nasa.gov with the team's NASA_API_KEY from .env
// (like the Space Apps "Earth Change Slideshow" guide). The key is only used here, on our own
// computer - the saved file contains key-free image links, because anything inside a website is public.
import { readFileSync, writeFileSync } from 'node:fs';
import { pickRoverPhotos, epicPhoto } from '../game/src/nasaimages.js';

let key = process.env.NASA_API_KEY;
try { key ||= readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/NASA_API_KEY=(\S+)/)?.[1]; } catch { /* no .env */ }
key ||= 'DEMO_KEY';

const rover = await (await fetch('https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=100&extended=sample_type::full,')).json();
const photos = pickRoverPhotos(rover.images || []);

const epic = await (await fetch(`https://api.nasa.gov/EPIC/api/natural?api_key=${key}`)).json();
const e = epic[Math.floor(epic.length / 2)];

const out = {
  saved: new Date().toISOString(),
  note: 'Backup of real NASA photo links. Perseverance: mars.nasa.gov raw images feed. Earth: NASA EPIC on DSCOVR.',
  rover: photos,
  earth: e ? epicPhoto(e) : null,
};
writeFileSync(new URL('../game/data/nasa-images-snapshot.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`saved ${photos.length} Perseverance photos (newest sol ${photos[0]?.sol}) and Earth ${out.earth?.when}`);
