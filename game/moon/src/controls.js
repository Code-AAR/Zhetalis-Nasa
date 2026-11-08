// Keyboard, mouse and phone controls for the Moon mission. One state object, read by main.js each frame.
// Phones: left thumb joystick moves, right thumb drag looks, round buttons for Jump / Use / Rover / Lamp.
export const input = { x: 0, z: 0, run: false, jump: false, use: false, useHeld: false, lookX: 0, lookY: 0, zoom: 0, keys: {} };
const pressed = new Set(), handlers = {};
export const on = (name, fn) => { handlers[name] = fn; };
const fire = (name, e) => handlers[name]?.(e);

const KEYMAP = { KeyE: 'use', KeyR: 'rover', KeyL: 'lamp', KeyV: 'view', KeyM: 'map', KeyP: 'photo', KeyT: 'tasks', KeyI: 'info', KeyO: 'settings', Escape: 'menu', KeyF: 'warp' };

export function initControls(canvas) {
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, select, textarea')) return;
    if (document.querySelector('#modal:not(.hidden)')) return;
    pressed.add(e.code);
    if (e.code === 'Space') { input.jump = true; e.preventDefault(); fire('photoKey'); }
    if (e.code === 'KeyE') input.useHeld = true;
    if (!e.repeat && KEYMAP[e.code]) fire(KEYMAP[e.code], e);
  });
  addEventListener('keyup', e => { pressed.delete(e.code); if (e.code === 'KeyE') input.useHeld = false; });
  addEventListener('blur', () => { pressed.clear(); input.useHeld = false; });
  // mouse look: drag, or pointer lock after a click on desktop
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('mousedown', e => { dragging = true; lx = e.clientX; ly = e.clientY; if (!coarse() && document.body.classList.contains('surface')) canvas.requestPointerLock?.(); });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) { input.lookX += e.movementX; input.lookY += e.movementY; }
    else if (dragging) { input.lookX += e.clientX - lx; input.lookY += e.clientY - ly; lx = e.clientX; ly = e.clientY; }
  });
  canvas.addEventListener('wheel', e => { input.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  initTouch(canvas);
}

export function readKeys() {
  const k = c => pressed.has(c);
  const f = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const r = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const stick = touch.active ? touch : null;
  input.x = stick ? stick.x : r; input.z = stick ? -stick.y : -f;   // z: -1 = forward
  input.run = k('ShiftLeft') || k('ShiftRight') || (stick && Math.hypot(stick.x, stick.y) > 0.92);
  input.keys = { left: k('ArrowLeft') || k('KeyA'), right: k('ArrowRight') || k('KeyD'), up: k('ArrowUp') || k('KeyW'), down: k('ArrowDown') || k('KeyS') };
  if (stick) input.keys = { left: stick.x < -0.3, right: stick.x > 0.3, up: stick.y < -0.3, down: stick.y > 0.3 };
  return input;
}
export function holdKeys(codes) { pressed.clear(); for (const c of codes) pressed.add(c); input.jump = codes.includes('Space'); input.useHeld = codes.includes('KeyE'); }
export function consume() { input.jump = false; input.lookX = 0; input.lookY = 0; input.zoom = 0; }

const coarse = () => matchMedia('(pointer: coarse)').matches;
const touch = { active: false, x: 0, y: 0, id: null, look: null };
function initTouch(canvas) {
  const pad = document.querySelector('#stick'), knob = pad?.querySelector('i');
  if (coarse()) document.body.classList.add('touch');
  addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
  if (pad) {
    const move = t => {
      const b = pad.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = b.width / 2;
      let x = (t.clientX - cx) / R, y = (t.clientY - cy) / R; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      touch.x = x; touch.y = y; knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
    };
    pad.addEventListener('pointerdown', e => { touch.active = true; touch.id = e.pointerId; pad.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === touch.id) move(e); });
    const end = e => { if (e.pointerId !== touch.id) return; touch.active = false; touch.x = touch.y = 0; knob.style.transform = ''; };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  }
  // right side of the screen: drag to look
  let look = null;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; look = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => { if (look && e.pointerId === look.id) { input.lookX += (e.clientX - look.x) * 1.6; input.lookY += (e.clientY - look.y) * 1.6; look.x = e.clientX; look.y = e.clientY; } });
  const stop = e => { if (look && e.pointerId === look.id) look = null; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  // buttons
  document.querySelectorAll('[data-touch]').forEach(b => {
    const act = b.dataset.touch;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.classList.add('down');
      if (act === 'jump') { input.jump = true; fire('photoKey'); }
      else if (act === 'use') { input.useHeld = true; fire('use'); }
      else fire(act);
    });
    const up = () => { b.classList.remove('down'); if (act === 'use') input.useHeld = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
}

export const CONTROLS_HTML = `<h4>Moon controls</h4><dl class="controls-list">
<dt>Move / look</dt><dd>WASD or arrows / drag the mouse (click to lock the mouse)</dd>
<dt>Sprint</dt><dd>Hold Shift - 4 m/s (walking: 2 m/s); tuned game speeds</dd>
<dt>Jump</dt><dd>Space - you fall at 1.62 m/s², so jumps float</dd>
<dt>Use / hold to work</dt><dd>E (hold for drilling, masts, samples)</dd>
<dt>Rover in / out</dt><dd>R near the back of the rover</dd>
<dt>Lamp / camera / map / quest log</dt><dd>L / V / M / T</dd>
<dt>Flyby</dt><dd>Drag or arrows to aim, Space or P for a photo, F for time warp</dd>
<dt>Pause menu</dt><dd>Esc (saves your mission)</dd>
<dt>Phone</dt><dd>Left thumb joystick moves (push to the edge to sprint), right thumb drags to look. Round buttons: Jump, Use (hold), Rover, Lamp.</dd>
</dl><p>All cinematics can be skipped. Your mission saves itself every few seconds.</p>`;
