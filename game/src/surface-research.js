import * as THREE from 'three';
import {modal,toast} from './ui.js';
import {dishAssembly} from './models.js';
// Fictional training equipment and accelerated biology, never live satellite ephemerides.
const initial=()=>({culture:0,growth:0,harvests:0,relay:0,message:'',destination:'earth',wait:0});
export function researchState(o){return o.research??=initial();}
export function openResearch(o,colony,world,save){
 const r=researchState(o),s=colony.s;
 const again=()=>{save();openResearch(o,colony,world,save);};
 const act=(fn)=>()=>{const error=fn();if(error)toast(error);again();};
 // "Signal home" animation (relay-cine.js): the game stays paused behind a hidden pop-up, like the tower scan.
 const watch=dest=>{r.seen={...r.seen,[dest]:true};save();const hold=modal({title:'',html:'',choices:[{label:''}]}),box=document.getElementById('modal');box?.classList.add('cine-hide');
  const back=()=>{hold();box?.classList.remove('cine-hide');openResearch(o,colony,world,save);};
  import('./relay-cine.js').then(m=>m.playRelayCinematic({destination:dest,site:{x:-25,z:18}})).catch(()=>{}).then(back);};
 const actThen=(fn,after)=>()=>{const error=fn();if(error){toast(error);again();}else after();};
 modal({title:'Food & communications lab',html:`<h4>Grow food safely</h4><p>Grow leafy greens, potatoes and wheat in the greenhouse with clean water, nutrients, light and controlled air. Keep packaged meals: one crop cannot supply a complete diet.</p><p>Spirulina culture: ${['Kit not prepared','Clean vessel ready','Growing: '+Math.floor(r.growth*100)+'%','Batch ready for safety check','Checked batch ready'][r.culture]}. Harvests: ${r.harvests}.</p><p>This is a sealed research culture, not raw Martian soil. A batch uses 2 L water and powered life support. Growth takes 90 training seconds; real cultivation is much slower.</p><details><summary>Nutrition and evidence</summary><p>Spirulina is a protein supplement studied for life support. Vitamins supply no food energy. Worm farming is not treated here as a proven astronaut diet. Crops and cultures need contamination monitoring and a balanced menu.</p><a href="https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Melissa/Targets_Scientific_domains" target="_blank" rel="noopener">ESA MELiSSA research</a> · <a href="https://ntrs.nasa.gov/citations/20150021302" target="_blank" rel="noopener">NASA crop experiment</a></details><h4>Mars relay network</h4><p>${['Request a relay service from Earth.','Request acknowledged; install the surface terminal.','Terminal ready; acquire a relay pass.','Linked to the training constellation.'][r.relay]}</p><p>Destination: ${r.destination==='earth'?'Earth via Mars relay':'Another Mars outpost'}. ${r.message||'No message queued.'}</p><p>Training constellation: four distant markers with enlarged visibility, not real tracked spacecraft. Existing Mars relays communicate with Earth through ground networks; Earth Starlink is not a Mars service. Earth messages still take minutes, not instant chat.</p><a href="https://science.nasa.gov/mars/mars-relay-network/" target="_blank" rel="noopener">NASA Mars Relay Network</a>`,choices:[
 ...(r.culture===0?[{label:'Sterilize culture vessel',onPick:act(()=>{if(!o.baseConnected)return 'Connect base power first.';r.culture=1;})}]:[]),
 ...(r.culture===1?[{label:'Add starter, nutrients and 2 L water',onPick:act(()=>{if(s.tank<2)return 'Refill the clean-water tank.';s.tank-=2;r.culture=2;})}]:[]),
 ...(r.culture===3?[{label:'Run batch contamination check',onPick:act(()=>{r.culture=4;})}]:[]),
 ...(r.culture===4?[{label:'Harvest and prepare supplement',onPick:act(()=>{r.harvests++;s.freshMeals=(s.freshMeals||0)+1;r.culture=1;r.growth=0;toast('One supplemental portion prepared. Keep a balanced food supply.');})}]:[]),
 ...(r.relay<3?[{label:['Request future Mars relay service','Install landed terminal kit','Acquire relay signal'][r.relay],onPick:actThen(()=>{if(!o.baseConnected)return 'Connect base power first.';if(r.relay===0){r.wait=20;r.message='Request sent. Acknowledgement arrives after a compressed training delay.';}else if(r.relay===1&&r.wait>0)return 'Await the request acknowledgement.';r.relay++;},()=>r.relay===3?watch('earth'):again())}]:[{label:'Select '+(r.destination==='earth'?'Mars outpost':'Earth'),onPick:act(()=>{r.destination=r.destination==='earth'?'mars':'earth';})},{label:'Send science message',onPick:actThen(()=>{if(!o.today.link)return 'Allocate communications power and wait for the link.';r.wait=r.destination==='earth'?20:4;r.message='Message queued; awaiting delivery.';},()=>r.seen?.[r.destination]?again():watch(r.destination))},{label:'Watch the signal path · '+(r.destination==='earth'?'Mars to Earth':'outpost to outpost'),cost:'Animation · about 20 seconds · can be skipped',onPick:()=>watch(r.destination)}]),
 {label:'Back to game'}]});
}
export function tickResearch(dt,o,colony,world){
 const r=researchState(o);
 if(r.culture===2&&o.baseConnected&&o.today.total*o.split.life>=1){r.growth=Math.min(1,r.growth+dt/90);if(r.growth>=1){r.culture=3;toast('Culture ready · run the safety check in the food lab.');}}
 if(r.wait>0){r.wait=Math.max(0,r.wait-dt);if(!r.wait){r.message='Acknowledgement received (compressed training delay).';toast(r.message);}}
 if(r.relay<2)return;
 if(!world.relayDish){
  const assembly=dishAssembly(1.6),base=assembly.group;base.position.set(-25,world.groundHeightAt(-25,18),18);world.scene.add(base);
  world.relayDish=assembly.el;
  world.clearRocksAround?.(-25,18,3);world.relayCollider={x:-25,z:18,halfX:2,halfZ:2,minY:base.position.y,maxY:base.position.y+5,object:base};world.colliders.push(world.relayCollider);
 }

 if(!world.trainingRelays){
  const a=new Float32Array(12),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));
  const points=new THREE.Points(g,new THREE.PointsMaterial({color:'#d8e8f5',size:1.5,sizeAttenuation:false,transparent:true,opacity:.6,depthWrite:false}));points.frustumCulled=false;world.scene.add(points);world.trainingRelays=points;
 }
 const pts=world.trainingRelays.geometry.attributes.position,origin=world.camera.position;
 for(let i=0;i<4;i++){const phase=world.time/180+i*Math.PI/2;pts.setXYZ(i,origin.x+Math.cos(phase)*700,origin.y+100+Math.sin(phase*.7+i)*220,origin.z+Math.sin(phase)*700);}pts.needsUpdate=true;
 world.relayTracking=true;const dish=world.relayDish;
 const target=r.destination==='earth'?new THREE.Vector3(pts.getX(0),pts.getY(0),pts.getZ(0)):new THREE.Vector3(pts.getX(2),pts.getY(2),pts.getZ(2));
 const here=dish.getWorldPosition(new THREE.Vector3()),direction=target.sub(here).normalize();
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction);dish.quaternion.slerp(q,1-Math.exp(-dt*2));
 // Track the whole moving dish, not just the mast.
 const bounds=new THREE.Box3().setFromObject(world.relayCollider.object),c=world.relayCollider;
 c.x=(bounds.min.x+bounds.max.x)/2;c.z=(bounds.min.z+bounds.max.z)/2;
 c.halfX=(bounds.max.x-bounds.min.x)/2;c.halfZ=(bounds.max.z-bounds.min.z)/2;c.minY=bounds.min.y;c.maxY=bounds.max.y;
}
