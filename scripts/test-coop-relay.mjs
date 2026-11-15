// Starts the co-op relay on a spare port and checks create / join / relay / full room / host hand-over.
// Usage: node scripts/test-coop-relay.mjs   (Node 22+ for the built-in WebSocket client)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const PORT = 18790 + Math.floor(Math.random() * 500);
const relay = spawn(process.execPath, ['server/coop-relay.mjs', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => relay.stdout.once('data', r));
const open = () => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/coop`); ws.inbox = []; ws.waiters = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); const w = ws.waiters.findIndex(w => w.t === m.t); if (w >= 0) ws.waiters.splice(w, 1)[0].res(m); else ws.inbox.push(m); };
  ws.onopen = () => res(ws); ws.onerror = rej; });
const next = (ws, t) => { const i = ws.inbox.findIndex(m => m.t === t); if (i >= 0) return Promise.resolve(ws.inbox.splice(i, 1)[0]);
  return Promise.race([new Promise(res => ws.waiters.push({ t, res })), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout waiting for ' + t)), 2000))]); };
const send = (ws, m) => ws.send(JSON.stringify(m));
try {
  const a = await open(); send(a, { t: 'create', name: 'Ana' });
  const made = await next(a, 'joined'); assert.match(made.code, /^[A-Z2-9]{5}$/); assert.equal(made.host, made.id);
  const b = await open(); send(b, { t: 'join', code: made.code.toLowerCase(), name: 'Ben' });
  const j = await next(b, 'joined'); assert.equal(j.code, made.code); assert.equal(j.peers.length, 2);
  assert.equal((await next(a, 'peer-join')).name, 'Ben');
  send(a, { t: 'msg', data: { k: 'pose', x: 1 } }); const relayed = await next(b, 'msg'); assert.equal(relayed.from, made.id); assert.equal(relayed.data.x, 1);
  const big = 'x'.repeat(200000); send(b, { t: 'msg', to: made.id, data: { big } }); assert.equal((await next(a, 'msg')).data.big.length, 200000);
  const c = await open(), d = await open(), e = await open();
  for (const w of [c, d, e]) send(w, { t: 'join', code: made.code, name: 'X' });
  await next(c, 'joined'); await next(d, 'joined'); assert.match((await next(e, 'error')).msg, /full/);
  const bad = await open(); send(bad, { t: 'join', code: 'ZZZZZ' }); assert.match((await next(bad, 'error')).msg, /No game/);
  a.close(); const h = await next(b, 'host'); assert.notEqual(h.id, made.id);
  const badUrl = await fetch(`http://127.0.0.1:${PORT}/%E0`); assert.equal(badUrl.status, 400, 'malformed URL is refused');
  const sib = await fetch(`http://127.0.0.1:${PORT}/../server/coop-relay.mjs`); assert.notEqual(sib.status, 200, 'no files outside game/');
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/coop/health`)).status, 200, 'still running after bad requests');
  console.log('co-op relay: all checks passed');
  for (const w of [b, c, d, e, bad]) w.close();
} finally { relay.kill(); }
