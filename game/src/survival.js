// Your own body, on top of the outpost's numbers.
//
// Rations: a hunger bar in the style of Minecraft's, ten packs that empty in halves. Walking, running and
// jumping use them up. The twist: your helmet stays on outside, so you can only eat inside the outpost or
// in the pressurised rover. Hold F (or Eat) for 1.6 seconds to eat one meal from the outpost's food store.
// Food grown in the greenhouse also fills "fibre", a hidden buffer that is used up before the packs
// (Minecraft calls it saturation). Freeze-dried food from supply pods doesn't give any.
// Low rations reduce movement speed, but Shift remains available. Empty rations use air faster.
//
// Suit air: a ring next to your astronaut (like the stamina wheel in Zelda: Breath of the Wild). It only
// shows up outside when the tank isn't full, turns yellow, then red and flashes when you're nearly out.
// Running makes you breathe harder, so it drains faster.
//
// The drain rates are game balance, not measurements.
import { $ } from './ui.js';

export const RATE = { inside: 0.035, idle: 0.05, walk: 0.13, run: 0.3, jump: 0.25 };   // packs (halves) per second
export const EAT_SECONDS = 1.6, MAX = 20, NO_RUN = 6;

const PACK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path class="pk-bg" d="M3 3.2 4.2 2h7.6L13 3.2V14l-1.2.8H4.2L3 14Z"/><path class="pk-fill" d="M3 3.2 4.2 2h7.6L13 3.2V14l-1.2.8H4.2L3 14Z"/><path class="pk-half" d="M3 3.2 4.2 2H8v12.8H4.2L3 14Z"/><path class="pk-seal" d="M3.4 4.6h9.2"/></svg>`;

export class Survival {
  constructor(saved) {
    this.rations = saved?.rations ?? MAX; this.fibre = saved?.fibre ?? 4; this.eatT = 0; this.starvingSaid = false;
    // the ration packs, bottom middle
    const row = document.createElement('div'); row.id = 'rations';
    row.innerHTML = `<div class="rt-packs">${Array.from({ length: MAX / 2 }, () => `<i class="pk">${PACK}</i>`).join('')}</div><div class="rt-eat"><b></b></div><span class="rt-label">Rations</span>`;
    $('#hud').appendChild(row); this.row = row; this.packs = [...row.querySelectorAll('.pk')];
    // the suit-air ring
    const wheel = document.createElement('div'); wheel.id = 'air-wheel';
    wheel.innerHTML = `<svg viewBox="0 0 44 44"><circle class="aw-track" cx="22" cy="22" r="17"/><circle class="aw-fill" cx="22" cy="22" r="17"/></svg><span>O₂</span>`;
    $('#hud').appendChild(wheel); this.wheel = wheel; this.wheelFill = wheel.querySelector('.aw-fill'); this.wheelSeen = 0;
  }

  save() { return { rations: +this.rations.toFixed(2), fibre: +this.fibre.toFixed(2) }; }
  get canRun() { return true; }
  get starving() { return this.rations <= 0; }

  // Use some up. `what` is one of the RATE keys.
  burn(amount) {
    const fromFibre = Math.min(this.fibre, amount); this.fibre -= fromFibre;
    this.rations = Math.max(0, this.rations - (amount - fromFibre));
  }

  // Called every frame. Returns 'ate' / 'ate-fresh' when a meal finishes, 'starving' the first time you hit 0.
  update(dt, { inside, driving, moving, running, eatHeld, foodStock, fresh }) {
    let out = null;
    this.burn((inside || driving ? RATE.inside : running ? RATE.run : moving ? RATE.walk : RATE.idle) * dt);
    const canEat = (inside || driving) && this.rations < MAX && foodStock >= 0.5;
    if (eatHeld && canEat) {
      this.eatT += dt;
      if (this.eatT >= EAT_SECONDS) {
        this.eatT = 0; this.rations = Math.min(MAX, this.rations + 6);
        if (fresh) this.fibre = Math.min(10, this.fibre + 6);
        out = fresh ? 'ate-fresh' : 'ate';
      }
    } else this.eatT = Math.max(0, this.eatT - dt * 3);
    if (this.starving && !this.starvingSaid) { this.starvingSaid = true; out = 'starving'; }
    if (this.rations > 2) this.starvingSaid = false;
    this.canEat = canEat;
    return out;
  }

  jumped() { this.burn(RATE.jump); }

  draw({ show, suit, outside, sx, sy, t }) {
    this.row.classList.toggle('hidden', !show);
    const r = this.rations;
    this.row.querySelector('.rt-label').textContent=r<=NO_RUN?'Low rations · slower movement · eat inside':'Rations';
    this.packs.forEach((p, i) => { p.className = 'pk ' + (r >= i * 2 + 2 ? 'full' : r >= i * 2 + 1 ? 'half' : 'empty'); });
    this.row.classList.toggle('low', r <= NO_RUN);
    this.row.classList.toggle('shake', r <= NO_RUN && Math.sin(t * 9) > 0.6);
    this.row.querySelector('.rt-eat b').style.width = (this.eatT / EAT_SECONDS * 100).toFixed(1) + '%';
    this.row.classList.toggle('eating', this.eatT > 0.02);
    // the ring: shows while the tank isn't full, then hangs around for a second before fading out
    if (outside && suit < 0.995) this.wheelSeen = t;
    const visible = show && outside && t - this.wheelSeen < 1.2;
    this.wheel.classList.toggle('on', visible);
    if (sx != null) { this.wheel.style.left = sx + 'px'; this.wheel.style.top = sy + 'px'; }
    const c = 2 * Math.PI * 17;
    this.wheelFill.style.strokeDasharray = `${(Math.max(0, suit) * c).toFixed(1)} ${c.toFixed(1)}`;
    this.wheel.dataset.level = suit < 0.25 ? 'red' : suit < 0.5 ? 'yellow' : 'green';
  }
}
