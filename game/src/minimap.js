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
    drawMini(this.ctx, this.size, { cx: p.x, cz: p.z, span: this.span, circles: revealCircles(w), layer: ms?.layer, dust: ms?.weather().dust === 'now', overlay: (c,P)=>{
      ms?.draw(c,P,{mini:true});
      // Deliveries remain visible until opened, including an edge marker beyond map range.
      for(const pod of w.pickups.filter(k=>k.kind==='pod')){
        let [x,y]=P.toPx(pod.x,pod.z);const mid=this.size/2,dx=x-mid,dy=y-mid,len=Math.hypot(dx,dy),limit=mid-12;
        if(len>limit){x=mid+dx/len*limit;y=mid+dy/len*limit;}
        c.save();c.strokeStyle='#ffad52';c.fillStyle='#ffad52';c.lineWidth=2;c.shadowColor='#ff8c22';c.shadowBlur=7;
        const r=6+2*Math.sin(performance.now()/300);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.fillRect(x-3,y-3,6,6);c.restore();
      }
      if(w.objectiveTarget){const [x,y]=P.toPx(w.objectiveTarget.x,w.objectiveTarget.z),r=5+2*Math.sin(performance.now()/250);c.save();c.strokeStyle='#bf86ff';c.fillStyle='#e0c1ff';c.shadowColor='#b674ff';c.shadowBlur=10;c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();c.restore();}
    } });
  }
}
