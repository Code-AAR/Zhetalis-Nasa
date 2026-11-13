export const ASSEMBLIES={array:['Support frame','Solar module','Output connector'],battery:['Battery module','Charge controller','Protected output'],charger:['Charging post','Charge controller','Rover connector']};
export function buildState(o){return o.construction??={placed:{},cleared:[],rockHits:{},removed:[],connections:[]};}
export function fitPart(o,kind,part,slot){const s=buildState(o);if(part!==slot||!ASSEMBLIES[kind]?.includes(part))return false;const placed=s.placed[kind]??=[];if(placed.includes(part)||ASSEMBLIES[kind].slice(0,ASSEMBLIES[kind].indexOf(part)).some(p=>!placed.includes(p)))return false;placed.push(part);return true;}
export function assemblyDone(o,kind){return ASSEMBLIES[kind].every(p=>buildState(o).placed[kind]?.includes(p));}
export const CIRCUITS=[['solar-out','battery-in'],['battery-out','base-in'],['base-out','charger-in']];
export function circuitFor(a,b){return CIRCUITS.findIndex(pair=>pair.includes(a)&&pair.includes(b)&&a!==b);}
export function circuitReady(o,index){return index===0?o.powerStep===5:index===1?o.powerStep>=6&&!o.baseConnected:index===2?o.baseConnected&&o.chargerStep===2:false;}
export function firstMissionReport(o,c){return [
 {title:'Field power commissioned',done:o.powerStep>=6,lesson:'Solar cells make electricity in daylight; the controller manages battery charging.'},
 {title:'Habitat connected',done:!!o.baseConnected,lesson:'A connected battery can supply the base after sunset while charge remains.'},
 {title:'Water prepared',done:!!c?.farmQuest?.waterMade,lesson:'Collected ice needs processing before it can supply a grow bed.'},
 {title:'First meal prepared',done:!!c?.farmQuest?.rewarded,lesson:'Plants need water, light and time. Harvesting and preparing food completes the supply chain.'}
];}

export function circuitConnected(o,index){return index===0?o.powerStep>=6:index===1?!!o.baseConnected:index===2?o.chargerStep>=3:false;}

// Shared by world highlights, interaction feedback and navigation.
export const SOCKET_LABELS={'solar-out':'Solar array OUT','battery-in':'Battery controller IN','battery-out':'Battery protected OUT','base-in':'Base IN','base-out':'Base charger OUT','charger-in':'Rover charger IN'};
export function socketPartner(id){return CIRCUITS.find(pair=>pair.includes(id))?.find(other=>other!==id)||null;}
export function circuitRequirement(o,index){
 if(index===0)return 'Assemble and place the solar panels and battery first.';
 if(index===1)return 'Connect Solar array OUT to Battery controller IN first.';
 if(index===2)return !o.baseConnected?'Connect Battery protected OUT to Base IN first.':o.chargerStep<1?'Assemble the rover charger at the workbench first.':'Place the charging post at the parking bay first.';
 return 'Choose a marked power socket.';
}
export function socketFeedback(o,id,held=null){
 const index=CIRCUITS.findIndex(pair=>pair.includes(id));
 if(held&&held!==id&&socketPartner(held)!==id)return `Wrong socket. Take this cable to ${SOCKET_LABELS[socketPartner(held)]}. R / Drop cancels.`;
 if(circuitConnected(o,index))return `${SOCKET_LABELS[id]} is already connected.`;
 if(!circuitReady(o,index))return circuitRequirement(o,index);
 if(held===id)return 'E / Use to release this cable.';
 return held?`E / Use to connect ${SOCKET_LABELS[id]}.`:`E / Use to pick up cable. Next: ${SOCKET_LABELS[socketPartner(id)]}.`;
}
export function nextWiringSocket(o,kind,held=null){
 if(held)return socketPartner(held);
 if(kind==='power'&&o.powerStep===5)return 'solar-out';
 if(kind==='base'&&!o.baseConnected&&o.powerStep>=6)return 'battery-out';
 if(kind==='charger'&&o.chargerStep===2&&o.baseConnected)return 'base-out';
 return null;
}
