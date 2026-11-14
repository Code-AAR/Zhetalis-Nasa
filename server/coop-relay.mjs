// Zhetalis co-op relay: room codes + message forwarding for up to 4 players per room.
// No dependencies (Node 18+). It also serves the game folder, so one command runs everything:
//   node server/coop-relay.mjs            -> http://localhost:8790/  (game + relay at /coop)
//   PORT=9000 node server/coop-relay.mjs  -> another port
// The relay never runs game rules. The player who created the room (the "host") owns the shared
// mission clock; every message is forwarded to the other players in the same room.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || process.argv[2] || 8790);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'game');
const MAX_PLAYERS = 4, MAX_FRAME = 8 * 1024 * 1024;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I/L to mix up when reading a code aloud
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.ktx2': 'image/ktx2', '.drc': 'application/octet-stream' };

// ---------- static files (same no-cache behaviour as serve.py) ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/coop/health') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size })); }
  let file; try { file = path.join(ROOT, decodeURIComponent(url.pathname)); } catch { res.writeHead(400); return res.end(); }   // a malformed %-escape must not crash the relay
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }   // never a sibling folder like game-old
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store, max-age=0' });
      res.end(data);
    });
  });
});

// ---------- minimal WebSocket (RFC 6455) ----------
function frame(text) {
  const body = Buffer.from(text), n = body.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([head, body]);
}
function control(op, payload = Buffer.alloc(0)) { return Buffer.concat([Buffer.from([0x80 | op, payload.length]), payload]); }

class Client {
  constructor(socket) {
    this.socket = socket; this.buf = Buffer.alloc(0); this.parts = []; this.alive = true; this.id = crypto.randomBytes(4).toString('hex');
    socket.on('data', d => this.onData(d));
    socket.on('close', () => this.closed());
    socket.on('error', () => this.closed());
  }
  send(obj) { if (!this.socket.destroyed) this.socket.write(frame(typeof obj === 'string' ? obj : JSON.stringify(obj))); }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const fin = this.buf[0] & 0x80, op = this.buf[0] & 15, masked = this.buf[1] & 0x80;
      let len = this.buf[1] & 127, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_FRAME) return this.socket.destroy();
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const mask = this.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
      this.buf = this.buf.subarray(need);
      if (op === 8) { this.socket.end(control(8)); return this.closed(); }
      if (op === 9) { this.socket.write(control(10, payload.subarray(0, 125))); continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 1 || op === 2 || op === 0) {
        this.parts.push(payload);
        if (!fin) continue;
        const text = Buffer.concat(this.parts).toString('utf8'); this.parts = [];
        let msg; try { msg = JSON.parse(text); } catch { continue; }
        handle(this, msg, text);
      }
    }
  }
  closed() { if (this.gone) return; this.gone = true; leave(this); }
}

// ---------- rooms ----------
const rooms = new Map();   // code -> { code, host, clients: Map(id -> client) }
function newCode() { for (;;) { let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]; if (!rooms.has(c)) return c; } }
const peers = room => [...room.clients.values()].map(c => ({ id: c.id, name: c.name }));
const cleanName = n => String(n || 'Astronaut').replace(/[<>]/g, '').trim().slice(0, 16) || 'Astronaut';

function handle(client, msg) {
  if (msg.t === 'create' && !client.room) {
    const room = { code: newCode(), host: client.id, clients: new Map() };
    rooms.set(room.code, room);
    client.name = cleanName(msg.name); client.room = room; room.clients.set(client.id, client);
    return client.send({ t: 'joined', code: room.code, id: client.id, host: room.host, peers: peers(room) });
  }
  if (msg.t === 'join' && !client.room) {
    const room = rooms.get(String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (!room) return client.send({ t: 'error', msg: 'No game with that code. Check the letters with the host.' });
    if (room.clients.size >= MAX_PLAYERS) return client.send({ t: 'error', msg: `That game is full (${MAX_PLAYERS} players).` });
    client.name = cleanName(msg.name); client.room = room; room.clients.set(client.id, client);
    client.send({ t: 'joined', code: room.code, id: client.id, host: room.host, peers: peers(room) });
    for (const c of room.clients.values()) if (c !== client) c.send({ t: 'peer-join', id: client.id, name: client.name });
    return;
  }
  const room = client.room; if (!room) return;
  if (msg.t === 'msg') {
    const out = JSON.stringify({ t: 'msg', from: client.id, data: msg.data });
    if (msg.to) room.clients.get(msg.to)?.send(out);
    else for (const c of room.clients.values()) if (c !== client) c.send(out);
  }
}
function leave(client) {
  const room = client.room; if (!room) return;
  room.clients.delete(client.id); client.room = null;
  if (!room.clients.size) return rooms.delete(room.code);
  for (const c of room.clients.values()) c.send({ t: 'peer-leave', id: client.id });
  if (room.host === client.id) {   // the host left: the longest-connected player keeps the mission going
    room.host = room.clients.keys().next().value;
    for (const c of room.clients.values()) c.send({ t: 'host', id: room.host });
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || !new URL(req.url, 'http://x').pathname.startsWith('/coop')) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const c = new Client(socket); clients.add(c); socket.on('close', () => clients.delete(c));
});
const clients = new Set();
setInterval(() => { for (const c of clients) { if (!c.alive) { c.socket.destroy(); continue; } c.alive = false; c.socket.write(control(9)); } }, 25000);

server.listen(PORT, HOST, () => console.log(`Zhetalis co-op relay on http://localhost:${PORT}/  (WebSocket: ws://localhost:${PORT}/coop)`));
