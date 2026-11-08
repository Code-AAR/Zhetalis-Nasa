// Touch controls for phones and tablets.
// Left thumb: a joystick that presses the same W/A/S/D (and Shift to run) as the keyboard, so the walking
// animation in world.js and the outpost walk in interior.js work unchanged. Right thumb: drag to look around.
// Buttons call the same game actions as the keys (main.js passes them in) - no game logic lives here.

let on = false;
export const isTouch = () => on;

const coarse = () => matchMedia?.('(pointer: coarse)').matches;

export function initTouch({ keys, look, press }) {
  const root = document.createElement('div');
  root.id = 'touch'; root.className = 'hidden';
  root.innerHTML = `
    <div class="t-stick" id="t-stick"><i></i></div>
    <div class="t-buttons">
      <button id="t-use" class="t-big">✋<span>Use</span></button>
      <button id="t-jump">⤒<span>Jump</span></button>
      <button id="t-view">👁<span>View</span></button>
      <button id="t-power">⚡<span>Power</span></button>
      <button id="t-log">📒<span>Log</span></button>
      <button id="t-eat" class="hidden">🍽<span>Eat</span></button>
    </div>`;
  document.querySelector('#hud').appendChild(root);
  const stick = root.querySelector('#t-stick'), knob = stick.querySelector('i');

  const turnOn = () => { if (on) return; on = true; document.body.classList.add('touch'); };
  if (coarse()) turnOn();
  addEventListener('touchstart', turnOn, { passive: true, once: true });

  // ---- joystick: starts wherever the left thumb lands, so small and large hands both work ----
  const R = 56;   // how far the knob can move, in pixels
  let stickId = null, sx = 0, sy = 0;
  const setKeys = (nx, ny) => {
    const k = keys(); if (!k) return;
    k.KeyW = ny < -0.35; k.KeyS = ny > 0.35; k.KeyA = nx < -0.35; k.KeyD = nx > 0.35;
    k.ShiftLeft = Math.hypot(nx, ny) > 0.92;   // push all the way = run
  };
  const releaseStick = () => {
    stickId = null; setKeys(0, 0);
    knob.style.transform = ''; stick.classList.remove('active'); stick.style.left = stick.style.top = '';
  };

  // ---- look: drag anywhere else on the screen (same math as the mouse in main.js) ----
  let lookId = null, lx = 0, ly = 0;
  const view = document.querySelector('#view');
  view.style.touchAction = 'none';
  view.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || root.classList.contains('hidden')) return;
    turnOn();
    if (stickId === null && e.clientX < innerWidth * 0.45) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.classList.add('active');
      const radius=stick.offsetWidth/2,buttonsLeft=root.querySelector('.t-buttons').getBoundingClientRect().left;
      stick.style.left = Math.max(radius+8,Math.min(sx,buttonsLeft-radius-8))+'px';stick.style.top=Math.max(radius+8,Math.min(sy,innerHeight-radius-8))+'px';
    } else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    else return;
    try { view.setPointerCapture(e.pointerId); } catch { /* fine without it */ }
  });
  view.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      setKeys(dx / R, dy / R);
    } else if (e.pointerId === lookId) {
      look((e.clientX - lx) * 1.5, (e.clientY - ly) * 1.5);
      lx = e.clientX; ly = e.clientY;
    }
  });
  const up = e => { if (e.pointerId === stickId) releaseStick(); if (e.pointerId === lookId) lookId = null; };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);view.addEventListener('lostpointercapture',up);
  const resetTouches=()=>{const ids=[stickId,lookId];releaseStick();lookId=null;const k=keys();if(k)k.Space=false;root.querySelectorAll('.down').forEach(b=>b.classList.remove('down'));for(const id of ids)if(id!==null&&view.hasPointerCapture(id))view.releasePointerCapture(id);};
  addEventListener('blur',resetTouches);addEventListener('resize',resetTouches);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTouches();});

  // ---- buttons: Jump is held like the space bar, the rest are one tap = one key press ----
  const btn = (id, down, upFn) => {
    const b = root.querySelector(id);
    b.addEventListener('pointerdown', e => { e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch{} b.classList.add('down'); down(); });
    const lift = () => { b.classList.remove('down'); upFn?.(); };
    b.addEventListener('pointerup', lift); b.addEventListener('pointercancel', lift); b.addEventListener('pointerleave', lift);
    b.addEventListener('lostpointercapture',lift);
    b.addEventListener('click',e=>{if(e.detail===0){down();upFn?.();}});
    b.addEventListener('contextmenu', e => e.preventDefault());
  };
  btn('#t-use', () => press('KeyE'));
  btn('#t-jump', () => { const k = keys(); if (k) k.Space = true; }, () => { const k = keys(); if (k) k.Space = false; });
  btn('#t-view', () => press('KeyV'));
  btn('#t-power', () => press('KeyP'));
  btn('#t-log', () => press('KeyL'));
  btn('#t-eat', () => { const k = keys(); if (k) k.KeyF = true; }, () => { const k = keys(); if (k) k.KeyF = false; });   // hold to eat, like holding F

  let shown = false;
  return {
    // main.js calls this every frame: hide the controls while a pop-up is open, light up Use when something is near
    sync({ active, canUse, inside, canEat }) {
      const show = on && active;
      if (show !== shown) {
        shown = show; root.classList.toggle('hidden', !show);
        if (!show) { releaseStick(); lookId = null; const k = keys(); if (k) k.Space = false; }   // don't keep walking behind a pop-up
      }
      root.querySelector('#t-use').classList.toggle('ready', !!canUse);
      root.querySelector('#t-view').classList.toggle('hidden', !!inside);
      root.querySelector('#t-eat').classList.toggle('hidden', !canEat);
    },
  };
}
