// Pure progression: saved simulation fields are the single source of truth.
export const POWER_TASKS=[
 ['Collect the power kits','Go inside to the storage locker. Take the landed array and battery kits.','locker'],
 ['Assemble the solar array','At the workbench, mount the solar modules on their frames.','workbench'],
 ['Set up the solar panels','Go to the marked power site outside and press Use to deploy the array.','power'],
 ['Assemble the battery','Return to the workbench and fit the battery and charge controller.','workbench'],
 ['Place the battery','Take the battery to the power site and press Use.','power'],
 ['Connect panels to battery','At the power site, connect the array through its charge controller.','power']
];
export function marsObjective(o,c){
 if(o.powerStep<6){const [title,detail,target]=POWER_TASKS[o.powerStep];return {id:'power-'+o.powerStep,title,detail,target};}
 if(!o.baseConnected)return {id:'base',title:'Connect battery to base',detail:'Use the marked power inlet beside Airlock 01 to close the base circuit.',target:'base'};
 if((o.chargerStep||0)<3){const step=o.chargerStep||0;return {id:'charger-'+step,title:['Assemble the rover charger','Place the charging station','Connect the charging station'][step],detail:['Enter Airlock 02 using the stairs. Inside, face the workbench and press E / Use to assemble the landed charger kit.','Use the marked parking bay outside to install its charger.','At the bay, connect the charger to the base battery bus.'][step],target:step===0?'workbench':'charger'};}
 if(!o.roverCharged)return {id:'charge',title:'Park and charge the rover',detail:'Drive into the cyan bay and stop. The connected station charges from spare daytime solar power or its stored reserve. A full battery also completes this check.',target:'charger'};
 if(!o.upgrades.regolith){const step=o.soilStep||0;return {id:'soil-'+step,title:['Inspect the shelter area','Collect loose Martian soil','Fill the shielding bags','Place the shielding bags'][step],detail:['Use the marked shelter site to check the supports.','Use the nearby soil pile to collect regolith for the shielding bags.','Return to the workbench to fill and seal the support bags.','Use the shelter site to place the supported bags. Soil reduces radiation; it does not remove all risk. Thickness and these protection values are simplified game rules.'][step],target:['shelter','soil','workbench','shelter'][step]};}
 if(!c?.farmQuest?.rewarded)return {id:'harvest',title:'Grow your first meal',detail:'Walk through Life support to the greenhouse. Plant, water and harvest a crop, then prepare it at the locker.',target:'greenhouse'};
 if(!(o.research?.harvests>0))return {id:'culture',title:'Grow a safe food culture',detail:'Open Food cultures & relay network in the quest log (T). Prepare a clean vessel, add starter and water, grow with power, then check and harvest the supplement.',target:'greenhouse'};
 if(!(o.research?.relay>=3))return {id:'relay',title:'Commission the Mars relay terminal',detail:'Use Food cultures & relay network in the quest log (T): request service, await acknowledgement, install and acquire the relay.',target:'base'};
 return {id:'explore',title:'Explore and send science',detail:'Optional jobs: collect samples, explore landmarks and upgrade your shelter. See the map and Information for more.',target:null};
}
export function missionLog(o,c){return [
 ...POWER_TASKS.map(([title],i)=>({title,done:o.powerStep>i})),
 {title:'Connect battery to base',done:!!o.baseConnected},
 {title:'Build and connect rover charger',done:o.chargerStep>=3},
 {title:'Park and charge rover',done:!!o.roverCharged},
 {title:'Inspect, collect soil, fill bags, shield the shelter',done:o.upgrades.regolith>0},
 {title:'Harvest and prepare your first meal',done:!!c?.farmQuest?.rewarded},
 {title:'Grow, check and harvest a culture supplement',done:o.research?.harvests>0},
 {title:'Request and commission a Mars relay terminal',done:o.research?.relay>=3}
];}
