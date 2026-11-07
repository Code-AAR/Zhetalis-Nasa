// Small DOM helpers for the HUD, pop-ups and panels.
import { artHTML } from './art.js';
export const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function factHTML(f, log = true, open = false) {
  if (log) logFact(f);
  const body = `${f.id ? artHTML('fact-' + f.id, '', 'fact-art') : ''}${esc(f.kid)}<div class="source">Source: <a href="${f.url}" target="_blank" rel="noopener">${esc(f.source)}</a></div>`;
  // Younger players (ages 7-9 on the title screen) see each fact folded up, so pop-ups stay short.
  if (!open && document.body.classList.contains('young')) return `<details class="fact fact-fold"><summary>🔎 Real NASA fact - tap to read</summary>${body}</details>`;
  return `<div class="fact">${body}</div>`;
}

// The mission logbook: every real fact the player meets is saved as a card, in the order they found it.
export const logbook = new Map();
const logListeners = [];
export function logFact(f) {
  if (!f?.id || logbook.has(f.id)) return;
  logbook.set(f.id, f);
  logListeners.forEach(fn => fn(logbook.size, f));
}
export const onLog = fn => logListeners.push(fn);

let modalOpen = false, modalPauses = true;
export const isModalOpen = () => modalOpen;
export const isPaused = () => modalOpen && modalPauses;   // the outpost panel lets time keep running

// A pop-up with choices. Every choice shows its cost, so no choice is "free".
export function modal({ title, html, choices = [{ label: 'OK' }], onClose, pause = true }) {
  modalPauses = pause;
  const box = $('#modal .modal-box');
  box.innerHTML = `<h3>${title}</h3>${html || ''}<div class="choices"></div>`;
  box.scrollTop = 0;   // every new pop-up starts at its title
  const list = box.querySelector('.choices');
  choices.forEach(c => {
    const b = document.createElement('button');
    b.innerHTML = `${c.label}${c.cost ? `<small>${c.cost}</small>` : ''}`;
    if (c.primary) b.classList.add('primary');
    b.onclick = () => { close(); c.onPick?.(); };
    list.appendChild(b);
  });
  if(choices.length===1&&!choices[0].onPick){const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='modal-dismiss';dismiss.setAttribute('aria-label','Close panel');dismiss.textContent='×';dismiss.onclick=close;box.prepend(dismiss);}
  $('#modal').classList.remove('hidden'); modalOpen = true;
  document.exitPointerLock?.();
  function close() { $('#modal').classList.add('hidden'); modalOpen = false; onClose?.(); }
  return close;
}

// Voice lines: put e.g. audio/welcome.mp3 in the game folder and it plays at that moment.
// Missing files are simply skipped, so the game works before any lines are recorded.
let voice;
export function say(name) {
  try { voice?.pause(); voice = new Audio(`audio/${name}.mp3`); voice.play().catch(() => {}); } catch { /* no audio */ }
}

let toastTimer;
// Short messages: they fade in, stay long enough to read (longer messages stay longer), then fade out slowly.
export function toast(text, ms = 3200) {
  ms = Math.max(ms, 2600 + text.length * 55);
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function meter(id, frac, text, invert = false) {
  const el = $(id); const f = Math.max(0, Math.min(1, frac));
  el.querySelector('i').style.width = (f * 100).toFixed(1) + '%';
  el.querySelector('small').textContent = text;
  const risk = invert ? f : 1 - f;           // for radiation, fuller = worse
  el.classList.toggle('low', risk > 0.75);
  el.classList.toggle('mid', risk > 0.5 && risk <= 0.75);
}

export function alerts(list) {
  $('#alerts').innerHTML = list.map(a => `<div class="alert ${a.info ? 'info' : ''}">${esc(a.text)}</div>`).join('');
}

export function sourcesHTML(sources) {
  return sources.map(s => `<p class="source">• <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.note ? ` - ${esc(s.note)}` : ''}</p>`).join('');
}
