// The little HUD map in the corner: a round, north-up crop of the same chart, fogged where nothing is charted.
// Tap or click it to open the full map.
import { MINIMAP_SPAN } from './chunk-plan.js';
import { drawMini, makeCanvas } from './chart.js';
import { revealCircles } from './mapstate.js';

export class Minimap {
  constructor(world, hud, { onOpen, size = 132, span = MINIMAP_SPAN } = {}) {
    this.world = world; this.size = size; this.span = span; this.t = 0; this.shown = false;
    this.cv = makeCanvas(size, size); this.cv.id = 'minimap'; this.cv.className = 'hidden'; this.cv.title = 'Open the surface map (G)';
    this.cv.setAttribute('role', 'button'); this.cv.setAttribute('aria-label', 'Mini map. Open the surface map');
    this.cv.onclick = () => onOpen?.(); hud.appendChild(this.cv); this.ctx = this.cv.getContext('2d'); world.minimap = this;
  }
  // call every frame; redraws four times a second
  draw(show, dt) {
    if (show !== this.shown) { this.shown = show; this.cv.classList.toggle('hidden', !show); this.t = 9; }
    if (!show || (this.t += dt) < .25) return; this.t = 0;
    const w = this.world, ms = w.mapState, p = w.driving ? w.sev.pos : w.player.position;
    drawMini(this.ctx, this.size, { cx: p.x, cz: p.z, span: this.span, circles: revealCircles(w), layer: ms?.layer, dust: ms?.weather().dust === 'now', overlay: (c, P) => ms?.draw(c, P, { mini: true }) });
  }
}
