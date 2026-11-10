// Educational timings only: actual EVA preparation depends on the suit/cabin protocol.
export class AirlockCycle {
  constructor(direction='out') { this.direction=direction; this.elapsed=0; this.duration=10; }
  tick(dt) { this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,dt)); }
  get ready(){return this.elapsed>=this.duration;}
  get pressure(){const t=Math.max(0,Math.min(1,(this.elapsed-2)/8));const start=this.startPressure??(this.direction==='out'?101.3:.6),end=this.direction==='out'?.6:101.3;return start*(1-t)+end*t;}
  get label(){return this.elapsed<2?'Both hatches sealed · seal check':this.ready?(this.direction==='out'?'Outside pressure matched · open outer hatch':'Cabin pressure matched · open inner hatch'):(this.direction==='out'?'Recovering air · depressurizing':'Outer hatch sealed · repressurizing');}
  canOpen(which){return this.ready&&which===(this.direction==='out'?'outer':'inner');}
}
export function canExitHabitat(eva){return eva.equipped===true&&eva.checked===true;}
