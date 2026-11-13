// Pure progression: saved simulation fields are the single source of truth.
export const POWER_TASKS=[
 ['Collect the power kits','Go inside to the storage locker. Take the landed array and battery kits.','locker'],
 ['Assemble the solar array','At the workbench, start assembly. Pick up each part, then fit it into its matching highlighted slot using E / Action.','workbench'],
 ['Set up the solar panels','Go to the marked power site outside and press Action to deploy the array.','power'],
 ['Assemble the battery','At the workbench, fit each battery part into its highlighted matching slot.','workbench'],
 ['Place the battery','Follow the marker to the battery slot beside the solar panels. Stand within 4 m, then press X or tap Place battery. You do not need to aim at the slot.','power'],
 ['Connect panels to battery','Select Solar OUT, then Battery controller IN. Press E / Action at each socket. R cancels the cable.','power']
];
export function marsObjective(o,c){
 if(o.safetyChecks&&!o.safetyChecks.reserves)return {id:"safety-reserves",title:"Check your emergency supplies",detail:"Go inside to the power console. Check stored air, meals and the finite emergency battery before building permanent power.",target:"console"};
 if(o.safetyChecks&&!o.safetyChecks.shelter)return {id:"safety-shelter",title:"Find the storm shelter",detail:"Go inside to the shelter bunks and press E / Action. Know where to shelter before your first construction trip.",target:"safety-shelter"};
 if(o.powerStep===2){const b=o.construction||{},cleared=b.cleared?.length||0,placed=b.placed?.field?.length||0;return {id:'power-2',title:cleared<4?'Clear the remote power site':'Place the solar panels',step:cleared<4?`${cleared}/4 rocks cleared · equip pickaxe from belt`:`${placed}/3 panels placed`,detail:cleared<4?'Walk to the marked field away from camp. Aim at each site rock and strike it with your pickaxe using E / Action.':'Aim at each highlighted panel footprint and press E / Action to place an assembled panel.',target:'power'};}
 if(o.powerStep<6){const [title,detail,target]=POWER_TASKS[o.powerStep];return {id:'power-'+o.powerStep,title,detail,target};}
 if(!o.baseConnected)return {id:'base',title:'Connect battery to base',detail:'Select Battery protected OUT at the field, then walk to Base IN beside Airlock 01 and select it.',target:'base'};
 if(!(o.research?.relay>=3))return {id:'relay',title:'Commission the Mars relay terminal',detail:'Go inside to the monitoring station. Request service, await acknowledgement, install the terminal and acquire the relay. This is a training network, not Starlink at Mars.',target:'monitor'};
 if(!c?.farmQuest?.rewarded)return firstMealObjective(o,c);
 if((o.chargerStep||0)<3){const step=o.chargerStep||0;return {id:'charger-'+step,title:['Go to the workbench','Place the charging station','Connect the charging station'][step],detail:['Go to the workbench inside the base. Press E / Action and choose Assemble landed rover charger kit.','Use the marked parking bay outside to install its charger.','Select Base charger OUT, then walk to Rover charger IN at the parking bay and select it.'][step],target:step===0?'workbench':'charger'};}
 if(!o.roverCharged)return {id:'charge',title:'Park and connect the rover',detail:'Drive into the cyan bay and stop. The connected station charges from spare daytime solar power or its stored reserve. Parking verifies the connection even at night; an empty reserve waits for sunlight.',target:'charger'};
 if(!o.upgrades.regolith){const step=o.soilStep||0;return {id:'soil-'+step,title:['Inspect the shelter area','Collect loose Martian soil','Fill the shielding bags','Place the shielding bags'][step],detail:['Use the marked shelter site to check the supports.','Use the nearby soil pile to collect regolith for the shielding bags.','Return to the workbench to fill and seal the support bags.','Use the shelter site to place the supported bags. Soil reduces radiation; it does not remove all risk. Thickness and these protection values are simplified game rules.'][step],target:['shelter','soil','workbench','shelter'][step]};}

 if(!(o.research?.harvests>0))return {id:'culture',title:'Grow a safe food culture',detail:'Open Food cultures & relay network in the quest log (T). Prepare a clean vessel, add starter and water, grow with power, then check and harvest the supplement.',target:'greenhouse'};

 return {id:'explore',title:'Explore and send science',detail:'Optional jobs: collect samples, explore landmarks and upgrade your shelter. See the map and Information for more.',target:null};
}
export function missionLog(o,c){return [
 {title:"Check emergency supplies",done:o.safetyChecks?.reserves!==false},
 {title:"Locate the storm shelter",done:o.safetyChecks?.shelter!==false},
 ...POWER_TASKS.map(([title],i)=>({title,done:o.powerStep>i})),
 {title:'Connect battery to base',done:!!o.baseConnected},
 {title:'Request and commission a Mars relay terminal',done:o.research?.relay>=3},
 {title:'Harvest and prepare your first meal',done:!!c?.farmQuest?.rewarded},
 {title:'Build and connect rover charger',done:o.chargerStep>=3},
 {title:'Park and charge rover',done:!!o.roverCharged},
 {title:'Inspect, collect soil, fill bags, shield the shelter',done:o.upgrades.regolith>0},
 {title:'Grow, check and harvest a culture supplement',done:o.research?.harvests>0}
];}

// Existing planted crops keep their progress; preparation steps guide new growers.
export function firstMealObjective(o,c={}) {
 const q=c.farmQuest||{}, beds=[...(c.base||[]),...(c.greenhouses||[])];
 let step,detail,target;
 if(q.harvested||c.produce>0){step='Prepare your harvest at the storage locker';target='locker';}
 else if(q.planted||beds.some(b=>b.crop)){
  target='greenhouse';
  if(beds.some(b=>b.ready)){step='Harvest the ready crop in the greenhouse';}
  else if(!q.watered||beds.some(b=>b.crop&&b.tank<=0)){step='Water your planted bed from the base tank';}
  else {step='Keep the grow lights on and wait for harvest';}
 } else if((c.rawWater||0)>0){step='Purify extracted water, check quality, then fill the clean tank';target='water';}
 else if(!q.waterMade){step=c.ice>0?'Extract water from ice at Life support → Water plant':'Collect ice outside for the water plant';target=c.ice>0?'water':'ice';}
 else if(q.seedsLanded&&!q.seedsCollected){step='Collect your seeds · orange square on the minimap';target='seed-pod';}
 else if(q.seedArrival!=null&&!q.seedsCollected){step=`Local cargo arrives on training sol ${q.seedArrival} · ${Math.max(0,q.seedArrival-o.sol)} sols left`;target=null;}
 else if(!q.seedsCollected){step='Request starter seeds at the storage locker';target='locker';}
 else {step='Go to the greenhouse and plant a grow bed';target='greenhouse';}
 detail=step+'. '+(target==='locker'?'Go inside the base to the storage locker.':target==='water'?'Use the water plant inside Life support.':target==='ice'?'Find a simulated ice deposit (a training resource), collect it, then return indoors.':target==='seed-pod'?'Press E / Action at the cargo pod to collect your delivery.':target===null?'The pod will land near the outpost. Its orange map marker appears when it lands.':'Use a grow bed; its panel shows water, power and growth.');
 return {id:'harvest',title:'Grow your first meal',step,detail,target};
}
