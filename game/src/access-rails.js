// Guardrail collision follows the stair slope; feet/head heights are world-space.
export function blockAccessRails(position, previous, entrances, radius=.35, bodyHeight=1.85) {
  for(const e of entrances)for(const side of [-1,1]){
    const railX=e.x+side*1.15,clearance=radius+.045;
    const dx=position.x-previous.x;
    const from=previous.x<railX?-1:1;
    const boundary=railX+from*clearance;
    const crossing=from<0?position.x>boundary:position.x<boundary;
    if(!crossing)continue;
    // Evaluate the swept crossing, not just the end point, so fast diagonal
    // movement cannot skip a rail or collide with its imaginary extension.
    const t=Math.abs(dx)>1e-8?Math.max(0,Math.min(1,(boundary-previous.x)/dx)):1;
    const z=previous.z+(position.z-previous.z)*t;
    if(z<e.doorZ || z>e.bottom)continue;
    const deck=z<=e.landingEnd?e.y:e.y*Math.max(0,Math.min(1,(e.bottom-z)/(e.bottom-e.landingEnd)));
    const feet=previous.y+(position.y-previous.y)*t;
    if(feet>=deck+1.10 || feet+bodyHeight<=deck-.05)continue;
    // Ignore a rail entirely on the other side of the walkway.
    if(from*(position.x-railX)>clearance)continue;
    position.x=boundary;
  }
  return position;
}
