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
