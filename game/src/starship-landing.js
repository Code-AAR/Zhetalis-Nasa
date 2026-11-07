import * as THREE from 'three';
import { JourneyVisual } from './journey-visual.js';

// Original procedural illustration, not a SpaceX flight model. Mars landing
// gear, scale and trajectory are conceptual; no validated vehicle telemetry.
export class StarshipLandingVisual extends JourneyVisual {
  async installModel(file,key,height){if(key==='lander')return;return super.installModel(file,key,height);}
  lander(){
    const ship=new THREE.Group();
    const silver=this.material('#b9c1c6',{metalness:.82,roughness:.32});
    const dark=this.material('#242b31',{metalness:.3,roughness:.7});
    const hull=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,1.22,40),silver);hull.position.y=-.12;ship.add(hull);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.22,.58,40),silver);nose.position.y=.78;ship.add(nose);
    const tiles=new THREE.Mesh(new THREE.CylinderGeometry(.223,.223,1.2,32,1,true,0,Math.PI),dark);tiles.position.y=-.12;ship.add(tiles);
    for(const side of [-1,1])for(const [y,w,h] of [[-.46,.25,.32],[.55,.16,.2]]){
      const flap=new THREE.Mesh(new THREE.BoxGeometry(w,h,.035),silver);flap.position.set(side*(.2+w/2),y,0);flap.rotation.z=-side*.18;ship.add(flap);
    }
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,engine=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,.14,16,1,true),dark);engine.position.set(Math.cos(a)*.1,-.79,Math.sin(a)*.1);ship.add(engine);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.3,8),silver);leg.position.set(Math.cos(a)*.28,-.8,Math.sin(a)*.28);leg.rotation.z=-Math.cos(a)*.3;ship.add(leg);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.025,12),dark);foot.position.set(Math.cos(a)*.31,-.95,Math.sin(a)*.31);ship.add(foot);
    }
    return ship;
  }
}
