// Online co-op: up to 4 players share one Mars mission, joined with a short room code
// (like a private game: one player creates it, friends type the same code).
// Transport: a tiny WebSocket relay (server/coop-relay.mjs) that only forwards messages inside a room.
// The player who created the room is the host: their game owns the mission clock and sends the
// starting snapshot; everyone sends their own astronaut's pose and any change to the shared outpost.
export const PLAYER_COLOURS = ['#4fc3f7', '#ffb74d', '#9ccc65', '#f06292'];
export const RELAY_PORT = 8790;

// Where the relay lives: ?relay=wss://host/coop overrides; a page served by the relay itself uses its own
// origin; the Python dev servers (serve.py) use the relay on the same machine at port 8790.
export function relayUrl() {
  const q = new URLSearchParams(location.search).get('relay');
  if (q) return q;
  try { const saved = localStorage.getItem('coop-relay'); if (saved) return saved; } catch { /* storage blocked */ }
  const secure = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (location.port === String(RELAY_PORT) || (!location.port && location.protocol === 'https:')) return `${secure}//${location.host}/coop`;
  return `${secure}//${location.hostname || 'localhost'}:${RELAY_PORT}/coop`;
}

export class Coop {
  constructor() { this.ws = null; this.id = null; this.code = null; this.hostId = null; this.peers = new Map(); this.handlers = {}; this.name = ''; }
  get active() { return !!this.code && this.ws?.readyState === 1; }
  get isHost() { return this.active && this.id === this.hostId; }
  get guest() { return this.active && this.id !== this.hostId; }
  on(kind, fn) { (this.handlers[kind] ??= []).push(fn); }
  emit(kind, ...args) { for (const fn of this.handlers[kind] ?? []) { try { fn(...args); } catch (e) { console.error('co-op handler', kind, e); } } }
  colourFor(id) { return id === this.id ? this.colour : this.peers.get(id)?.colour; }
  // Open the relay, then create a room (code omitted) or join one. Resolves with the room code.
  open(name, code) {
    this.close(true);
    this.name = String(name || 'Astronaut').slice(0, 16);
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(relayUrl()); } catch (e) { return reject(new Error('Could not reach the co-op server.')); }
      this.ws = ws; let settled = false;
      const fail = msg => { if (!settled) { settled = true; reject(new Error(msg)); } };
      const timer = setTimeout(() => { fail('The co-op server did not answer. Is it running? (node server/coop-relay.mjs)'); ws.close(); }, 6000);
      ws.onopen = () => ws.send(JSON.stringify(code ? { t: 'join', code, name: this.name } : { t: 'create', name: this.name }));
      ws.onerror = () => fail('Could not reach the co-op server. Start it with: node server/coop-relay.mjs');
      ws.onclose = () => { clearTimeout(timer); fail('The co-op server closed the connection.'); if (this.ws === ws) { const was = !!this.code; this.code = null; this.peers.clear(); if (was) this.emit('closed'); } };
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'error') { clearTimeout(timer); fail(m.msg); ws.close(); return; }
        if (m.t === 'joined') {
          clearTimeout(timer); settled = true;
          this.id = m.id; this.code = m.code; this.hostId = m.host; this.peers.clear();
          m.peers.forEach((p, i) => { if (p.id === m.id) this.colour = PLAYER_COLOURS[i % 4]; else this.peers.set(p.id, { id: p.id, name: p.name, colour: PLAYER_COLOURS[i % 4], pose: null }); });
          resolve(m.code); this.emit('joined', m);
          return;
        }
        if (m.t === 'peer-join') {
          const used = new Set([this.colour, ...[...this.peers.values()].map(p => p.colour)]);
          const peer = { id: m.id, name: m.name, colour: PLAYER_COLOURS.find(c => !used.has(c)) ?? PLAYER_COLOURS[0], pose: null };
          this.peers.set(m.id, peer); this.emit('peer-join', peer); return;
        }
        if (m.t === 'peer-leave') { const p = this.peers.get(m.id); this.peers.delete(m.id); this.emit('peer-leave', m.id, p); return; }
        if (m.t === 'host') { this.hostId = m.id; this.emit('host', m.id); return; }
        if (m.t === 'msg' && m.data?.k) {
          if (m.data.k === 'pose') { const p = this.peers.get(m.from); if (p) p.pose = m.data.d; }
          this.emit(m.data.k, m.from, m.data.d);
        }
      };
    });
  }
  send(kind, data, to) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ t: 'msg', to, data: { k: kind, d: data } })); }
  close(quiet) { const ws = this.ws; this.ws = null; this.code = null; this.peers.clear(); if (ws) { ws.onclose = null; ws.close(); if (!quiet) this.emit('closed'); } }
  // Everyone in the room, you first: [{ id, name, colour, pose, me }]
  roster(myPose) { return [{ id: this.id, name: this.name, colour: this.colour, pose: myPose, me: true }, ...this.peers.values()]; }
}

// ---------- the main-menu dialog: Create game / Join with code ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function openCoopDialog(coop, { onHostStart, onJoined }) {
  document.querySelector('#coop-dialog')?.remove();
  let savedName = ''; try { savedName = localStorage.getItem('coop-name') || ''; } catch { /* storage blocked */ }
  const preset = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  const d = document.createElement('div'); d.id = 'coop-dialog'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'coop-title');
  d.innerHTML = `<div class="coop-box">
    <header><h2 id="coop-title">Play together</h2><button type="button" class="coop-close" aria-label="Close">×</button></header>
    <p class="coop-lead">Up to 4 astronauts on one mission. One player creates a game and shares the code; the others join with it.</p>
    <label class="coop-field">Your astronaut name<input id="coop-name" maxlength="16" autocomplete="nickname" value="${esc(savedName)}" placeholder="e.g. Sam"></label>
    <div class="coop-cols">
      <section><h3>Create game</h3><p>You host the mission (your saved game, or a new one).</p><button type="button" class="primary" id="coop-create">Create game</button></section>
      <section><h3>Join with code</h3><label class="sr-only" for="coop-code">Game code</label><input id="coop-code" maxlength="5" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" value="${esc(preset)}"><button type="button" id="coop-join">Join</button></section>
    </div>
    <p class="coop-status" role="status" aria-live="polite"></p>
  </div>`;
  document.body.appendChild(d);
  const $ = s => d.querySelector(s), status = $('.coop-status');
  const name = () => { const n = $('#coop-name').value.trim() || 'Astronaut'; try { localStorage.setItem('coop-name', n); } catch { /* storage blocked */ } return n; };
  const busy = on => d.querySelectorAll('button:not(.coop-close),input').forEach(b => (b.disabled = on));
  const close = () => { d.remove(); };
  $('.coop-close').onclick = () => { coop.close(true); close(); };   // cancelled before the mission started
  d.addEventListener('keydown', e => { if (e.key === 'Escape') $('.coop-close').click(); });
  $('#coop-create').onclick = async () => {
    busy(true); status.textContent = 'Opening a room…';
    try {
      const code = await coop.open(name());
      d.querySelector('.coop-box').innerHTML = `<header><h2>Your game code</h2></header>
        <p class="coop-code" aria-label="Code ${code.split('').join(' ')}">${code}</p>
        <p class="coop-lead">Friends choose <b>Play together → Join with code</b> and type it. They appear on Mars as soon as you land (up to 4 players).</p>
        <p class="coop-link">Or share this link: <code>${esc(`${location.origin}${location.pathname}?join=${code}`)}</code></p>
        <div class="coop-actions"><button type="button" class="primary" id="coop-go">Start the mission ↗</button></div>`;
      d.querySelector('#coop-go').focus();
      d.querySelector('#coop-go').onclick = () => { close(); onHostStart(code); };
    } catch (e) { status.textContent = e.message; busy(false); }
  };
  const join = async () => {
    const code = $('#coop-code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { status.textContent = 'Codes have 5 letters and numbers.'; $('#coop-code').focus(); return; }
    busy(true); status.textContent = 'Joining…';
    try {
      await coop.open(name(), code);
      status.textContent = 'Joined! Waiting for the host to land on Mars…';
      onJoined(code, () => close(), msg => { status.textContent = msg; });
    } catch (e) { status.textContent = e.message; busy(false); }
  };
  $('#coop-join').onclick = join;
  $('#coop-code').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  $('#coop-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  (preset ? $('#coop-code') : $('#coop-name')).focus();
}

// ---------- in-game: one small crew chip, and a caption while you sleep ----------
// The chip lives inside the Sol panel (top right), so it never covers the mission card, alerts or hints, and the
// phone layout (phone-layout.js) already measures it. Each crewmate is a coloured initial; a badge shows who is
// asleep (💤) or voting to skip (✋). At night one short line says how close the crew is to skipping it.
const WHERE = { out: 'outside', hab: 'in the hab', drive: 'driving the rover', ship: 'in the lander' };
// small drawn icons (the HUD keeps emoji off the screen; ui.js keepScreenEmojiFree)
const ICON = {
  moon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 1.5a6.5 6.5 0 1 0 4 11.6A5.5 5.5 0 0 1 10.5 1.5Z" fill="currentColor"/></svg>',
  hand: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
export class CoopHud {
  constructor(hud) {
    const status = hud.querySelector('.status') || hud;
    this.chip = document.createElement('div'); this.chip.id = 'coop-chip'; this.chip.hidden = true;
    const menu = status.querySelector('#menu-btn'); status.insertBefore(this.chip, menu || null);
    this.chip.addEventListener('click', e => { if (e.target.closest('.cc-vote')) this.onVote?.(); });
    this.caption = document.createElement('div'); this.caption.id = 'sleep-caption'; this.caption.hidden = true; this.caption.setAttribute('role', 'status'); hud.appendChild(this.caption);
    this.fade = document.createElement('div'); this.fade.id = 'sleep-fade'; hud.appendChild(this.fade);
    this.lastChip = this.lastCaption = ''; this.onVote = null;
  }
  // s: { coop, players: [{ name, colour, sleeping, vote, me, where }], vote, night, sleeping, countdown, touch }
  render(s) {
    const { coop, players, vote, night, sleeping, countdown, touch } = s;
    document.body.classList.toggle('is-sleeping', !!sleeping);
    // crew chip (co-op only)
    let chip = '';
    if (coop?.active) {
      const crew = players.map(p => {
        const badge = p.sleeping ? ICON.moon : night && p.vote ? ICON.hand : '';
        const what = p.sleeping ? 'asleep in a bunk' : night && p.vote ? 'voted to skip the night' : WHERE[p.where] || 'landing';
        return `<li style="--c:${p.colour}" title="${esc(p.name)}${p.me ? ' (you)' : ''}${p.host ? ' · host' : ''} · ${what}"><span class="cc-av${p.me ? ' me' : ''}">${esc(p.name.trim()[0] || '?').toUpperCase()}</span>${badge ? `<i class="cc-badge${p.sleeping ? ' zz' : ' ok'}">${badge}</i>` : ''}<span class="sr-only">${esc(p.name)}${p.me ? ' (you)' : ''}: ${what}.</span></li>`;
      }).join('');
      let line = '';
      if (night) {
        line = countdown != null ? `<p class="cc-night soon">${ICON.sun}Morning in ${Math.ceil(countdown)}</p>`
          : `<p class="cc-night" title="The night is skipped when ${vote.need} of ${vote.total} are asleep or voting">${ICON.moon}${vote.ready}/${vote.need} to skip night</p>`;
        const me = players.find(p => p.me);
        if (!sleeping && countdown == null) line += touch ? `<button type="button" class="cc-vote" aria-pressed="${!!me?.vote}">${me?.vote ? 'Voted to skip' : 'Skip night'}</button>` : `<p class="cc-key">${me?.vote ? 'Voted · N to undo' : 'N to vote skip'}</p>`;
      }
      chip = `<div class="cc-head"><span>Crew</span><b title="Game code">${coop.code}</b></div><ul class="cc-crew" aria-label="Crew">${crew}</ul>${line}`;
    }
    if (chip !== this.lastChip) { this.chip.innerHTML = chip; this.lastChip = chip; this.chip.hidden = !chip; }
    // caption while you sleep: what is happening and how to get up
    let cap = '';
    if (sleeping) {
      const sub = countdown != null ? `Morning in ${Math.ceil(countdown)}…` : coop?.active ? `${vote.ready} of ${vote.total} ready · the night skips at ${vote.need}` : 'Resting until morning…';
      cap = `<b>${ICON.moon}Sleeping</b><span>${sub}</span><small>${touch ? 'Tap Get up to leave the bunk' : 'Press E or move to get up'}</small>`;
    }
    if (cap !== this.lastCaption) { this.caption.innerHTML = cap; this.lastCaption = cap; this.caption.hidden = !cap; }
  }
  setFade(v) { this.fade.style.opacity = String(v); }
}
