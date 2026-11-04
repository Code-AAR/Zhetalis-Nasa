// Small DOM helpers for the HUD, pop-ups and panels.
export const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function factHTML(f) {
  return `<div class="fact">${esc(f.kid)}<div class="source">Source: <a href="${f.url}" target="_blank" rel="noopener">${esc(f.source)}</a></div></div>`;
}

let modalOpen = false, modalPauses = true;
export const isModalOpen = () => modalOpen;
export const isPaused = () => modalOpen && modalPauses;   // the outpost panel lets time keep running

// A pop-up with choices. Every choice shows its cost, so no choice is "free".
export function modal({ title, html, choices = [{ label: 'OK' }], onClose, pause = true }) {
  modalPauses = pause;
  const box = $('#modal .modal-box');
  box.innerHTML = `<h3>${title}</h3>${html || ''}<div class="choices"></div>`;
  const list = box.querySelector('.choices');
  choices.forEach(c => {
    const b = document.createElement('button');
    b.innerHTML = `${c.label}${c.cost ? `<small>${c.cost}</small>` : ''}`;
    if (c.primary) b.classList.add('primary');
    b.onclick = () => { close(); c.onPick?.(); };
    list.appendChild(b);
  });
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
export function toast(text, ms = 3200) {
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
