// Drop-in illustrations (made by the team, e.g. with ChatGPT image generation).
// 1. Put the picture in game/assets/art/ with one of the slot names from assets/art/README.md
// 2. Add its file name to "files" in assets/art/art.json
// The game shows it automatically. Every illustration gets an "Illustration" label, so nobody mistakes
// it for a real NASA photo (real photos in the game are labelled REAL / LIVE instead).

let manifest = { credit: '', files: [], story: [] };
export const artReady = fetch('assets/art/art.json')
  .then(r => (r.ok ? r.json() : {}))
  .then(m => (manifest = { credit: '', files: [], story: [], ...m }))
  .catch(() => manifest);

const base = f => f.replace(/\.[a-z0-9]+$/i, '');
export const artUrl = name => { const f = manifest.files.find(x => base(x) === name); return f ? 'assets/art/' + f : null; };
export const hasArt = name => !!artUrl(name);
export const artCredit = () => manifest.credit;
export const storyPanels = () => (manifest.story || []).filter(p => manifest.files.includes(p.file));
export const anyArt = () => manifest.files.length > 0;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// <figure> with the picture and its "Illustration" label - or '' if that slot is empty.
export function artHTML(name, alt = '', cls = '') {
  const url = artUrl(name);
  return url ? `<figure class="art ${cls}"><img src="${url}" alt="${esc(alt)}" loading="lazy"><span class="ill-tag">Illustration</span></figure>` : '';
}
// A small round portrait + name, for whoever is talking in a pop-up.
export function speakerHTML(name, label) {
  const url = artUrl(name);
  return url ? `<div class="speaker"><img src="${url}" alt="${esc(label)}"><b>${esc(label)}</b><span class="ill-tag">Illustration</span></div>` : '';
}
