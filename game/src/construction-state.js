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
 if(held===id)return 'E / Action to release this cable.';
 const pole=nextPole(o,index);
 return held?`E / Action to connect ${SOCKET_LABELS[id]} (matching colour).`:`E / Action to pick up the ${POLE_NAME[pole]} lead. Next: ${SOCKET_LABELS[socketPartner(id)]}.`;
}
export function nextWiringSocket(o,kind,held=null){
 if(held)return socketPartner(held);
 if(kind==='power'&&o.powerStep===5)return 'solar-out';
 if(kind==='base'&&!o.baseConnected&&o.powerStep>=6)return 'battery-out';
 if(kind==='charger'&&o.chargerStep===2&&o.baseConnected)return 'base-out';
 return null;
}

// ---- Polarity: every cable is a pair of leads, red + (positive) and black − (negative).
// Red goes on first and black last (the safe order on a real battery), colours must match, and power flows only
// once both are on: electricity needs a closed loop out of +, through the load and back into −.
export const POLE_NAME={'+':'red + (positive)','-':'black − (negative)'};
export function leadsOn(o,index){if(circuitConnected(o,index))return ['+','-'];return buildState(o).leads?.[index]||[];}
export function nextPole(o,index){const on=leadsOn(o,index);return !on.includes('+')?'+':!on.includes('-')?'-':null;}
export function connectLead(o,index,heldPole,targetPole){
 if(heldPole!==targetPole)return {ok:false,reason:'reverse'};
 const s=buildState(o),on=(s.leads??={})[index]??=[];
 if(!on.includes(heldPole))on.push(heldPole);
 return {ok:true,complete:on.includes('+')&&on.includes('-')};
}
// What each circuit carries (illustrative, rounded): power P = voltage V × current I, so I = P ÷ V.
export const CIRCUIT_FACTS=[
 {volts:48,watts:1200,load:'battery',fact:'The three panels give about 1,200 W. The charge controller turns their changing voltage into a steady 48 V for the battery: I = P ÷ V = 1,200 ÷ 48 = 25 A.'},
 {volts:48,watts:1000,load:'habitat',fact:'The habitat draws about 1,000 W at 48 V: I = P ÷ V ≈ 21 A. The 60 A fuse in the protected output opens if a fault ever pulls far more.'},
 {volts:48,watts:1500,load:'rover',fact:'The rover charges at about 1,500 W at 48 V: I = P ÷ V ≈ 31 A, so this lead is thicker to keep it cool.'}
];
export const ORDER_LESSON='Connect the red + lead first and the black − lead last. That is the safe order on a real battery: if a tool slips while you make the last connection, it cannot short + to the metal frame.';
export const REVERSE_LESSON='Stop: that is + to −. Red + must meet red +, and black − must meet black −. Reversed polarity drives current the wrong way and can destroy a charge controller. Joining + straight to − with nothing in between would be a short circuit.';
export function leadLesson(index,pole,complete){
 const f=CIRCUIT_FACTS[index];
 if(!complete)return `${pole==='+'?'Red + lead':'Black − lead'} connected. Nothing flows yet: the circuit is open. Current needs a complete loop, out of the + terminal, through the ${f.load} and back into −. Now connect the ${POLE_NAME[pole==='+'?'-':'+']} lead between the same two sockets.`;
 return `Loop closed, so current flows. ${f.fact}`;
}
