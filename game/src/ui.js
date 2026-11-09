import {audioVolume} from './audio-preferences.js';
// Small DOM helpers for the HUD, pop-ups and panels.
export const $ = s => document.querySelector(s);
// Pop-up titles and toasts are written with an emoji in front. The HUD draws its own icons, so the emoji is
// dropped here to keep the screen looking like a game rather than a chat.
export const plain = t => String(t).replace(/^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]|\s)+/u, '');
export const noEmoji = t => String(t).replace(/(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D])+\s?/gu, '').trim();   // for HUD lines
// Team rule: no emoji anywhere on the game screen. Lots of older text still has them, so one watcher strips them
// from every bit of page text as it appears (arrows like the ones on menu buttons are kept). The 3D view is untouched.
const EMOJI = /(?:\p{Emoji_Presentation}|[\u{1F300}-\u{1FAFF}]|\p{Extended_Pictographic}\uFE0F|[\u26CF\u2692\u2699\u26A0\u2622\u2696\u26F0\u2604\u26CF\u2694\u26F1\u2620])[\uFE0F\u200D]*\s?/gu;
export const stripEmoji = t => t.replace(EMOJI, '');
export function keepScreenEmojiFree(root = document.body) {
  const fix = n => { if (n.nodeType === 3) { const v = n.nodeValue, w = stripEmoji(v); if (w !== v) n.nodeValue = w; } else if (n.nodeType === 1 && !/^(SCRIPT|STYLE|CANVAS)$/.test(n.nodeName)) { const tw = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) fix(t); } };
  fix(root);
  new MutationObserver(list => { for (const m of list) { if (m.type === 'characterData') fix(m.target); else for (const n of m.addedNodes) fix(n); } }).observe(root, { childList: true, subtree: true, characterData: true });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function factHTML(f, log = true, open = false) {
  if (log) logFact(f);
  if(open)return `<div class="fact">${esc(f.kid)}<div class="source">Source: <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a></div></div>`;
  const line=f.short || f.kid?.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || f.kid || 'Learn more about this discovery.';
  return `<div class="fact fact-short"><p>${esc(line)}</p><button type="button" class="information-link" data-info="${esc(f.id||'')}">More in Settings → Information</button></div>`;

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

let modalOpen = false, modalPauses = true, dismissCurrent;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOpen) { e.preventDefault(); e.stopImmediatePropagation(); dismissCurrent?.(); }
}, true);
export const isModalOpen = () => modalOpen;
export const isPaused = () => modalOpen && modalPauses;   // the outpost panel lets time keep running

// A pop-up with choices. Every choice shows its cost, so no choice is "free".
export function modal({ title, html, choices = [{ label: 'OK' }], onClose, pause = true }) {
  modalPauses = pause;
  const box = $('#modal .modal-box');
  const previousFocus=document.activeElement;
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',plain(title));
  box.innerHTML = `<header class="message-header"><h3>${plain(title)}</h3><button type="button" class="modal-dismiss" aria-label="Close message">×</button></header>${html || ''}<div class="choices"></div>`;
  box.scrollTop = 0;   // every new pop-up starts at its title
  const list = box.querySelector('.choices');
  choices.forEach(c => {
    const b = document.createElement('button');
    b.innerHTML = `${c.label}${c.cost ? `<small>${c.cost}</small>` : ''}`;
    if (c.primary) b.classList.add('primary');
    b.onclick = () => { close(); c.onPick?.(); };
    list.appendChild(b);
  });
  box.querySelector('.modal-dismiss').onclick = close;
  box.onkeydown=e=>{if(e.key!=='Tab')return;const focusable=[...box.querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
  let closed = false;
  dismissCurrent = close;
  $('#modal').classList.remove('hidden'); modalOpen = true;box.querySelector('.modal-dismiss').focus();
  document.exitPointerLock?.();
  function close() { if (closed) return; closed = true; if (dismissCurrent === close) { $('#modal').classList.add('hidden'); modalOpen = false; dismissCurrent = null;if(previousFocus?.isConnected)previousFocus.focus?.(); } onClose?.(); }
  return close;
}

// Voice lines: put e.g. audio/welcome.mp3 in the game folder and it plays at that moment.
// Missing files are simply skipped, so the game works before any lines are recorded.
let voice;
export function say(name) {
  try { voice?.pause(); voice = new Audio(`audio/${name}.mp3`); voice.volume=audioVolume('voice'); voice.play().catch(() => {}); } catch { /* no audio */ }
}

let toastTimer;
// Short messages: they fade in, stay long enough to read (longer messages stay longer), then fade out slowly.
export function toast(text, ms = 3200) {
  ms = Math.min(6000, Math.max(ms, 2000 + text.length * 20));
  const t = $('#toast'); t.innerHTML = '<span></span><button type="button" aria-label="Dismiss notification">×</button>'; t.querySelector('span').textContent = plain(text); t.classList.add('show');
  t.querySelector('button').onclick = () => { clearTimeout(toastTimer); t.classList.remove('show'); };
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
  $('#alerts').innerHTML = list.map(a => `<div class="alert ${a.info ? 'info' : ''}">${esc(noEmoji(a.text))}</div>`).join('');
}

export function sourcesHTML(sources) {
  return sources.map(s => `<p class="source">• <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.note ? ` - ${esc(s.note)}` : ''}</p>`).join('');
}

addEventListener('audio-levels',()=>{if(voice)voice.volume=audioVolume('voice');});
addEventListener('mission-mute',()=>{if(voice)voice.volume=audioVolume('voice');});
document.addEventListener('click',event=>{const link=event.target.closest('[data-info]');if(link){event.preventDefault();dispatchEvent(new CustomEvent('open-settings',{detail:{tab:'information',topic:link.dataset.info}}));}});
