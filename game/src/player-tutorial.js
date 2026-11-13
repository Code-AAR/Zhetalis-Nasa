// Tutorial completion follows actions; opening a help page never completes a lesson.
export function recordLesson(s,key){(s.tutorial??={})[key]=true;}
export function tutorialLessons(o,s){const t=s.tutorial||{};return [
 {title:'Equip a tool',done:!!t.equip,text:'Press 1 or 2, or tap a tool in your belt. The highlighted slot is equipped. Take the builder from the storage locker; your belt holds two tools.'},
 {title:'Put it away',done:!!t.unequip,text:'Press the same number again, press Q, or tap Empty hands. On a phone, tap the selected tool again. This keeps the tool in your belt.'},
 {title:'Mine a mineral deposit',done:!!t.mine||s.seenOre?.length>0,text:'Equip the pickaxe. Aim at a mineral deposit and press E, click, or tap Action several times. Ordinary rubble clears space but gives no mineral samples.'},
 {title:'Unload your samples',done:!!t.unload,text:'Go inside and use the storage locker. Opening it unloads your bag automatically. Builders spend stored materials, not samples still in your bag.'},
 {title:'Choose a project',done:!!s.buildPlan||!!t.track,text:'Press B or choose Builder in the menu. Select Track materials & build. The quest shows the next missing material and marks the nearest matching deposit.'},
 {title:'Assemble the solar kit',done:o.powerStep>=2,text:'Take the power kits from the locker. At the workbench, fit Support frame, Solar module, then Output connector into matching slots.'},
 {title:'Clear and place the array',done:o.powerStep>=3,text:'Follow the field marker. Break all four marked site rocks with the pickaxe, then use each of the three panel footprints.'},
 {title:'Assemble and place the battery',done:o.powerStep>=5,text:'Fit Battery module, Charge controller, then Protected output at the workbench. Walk to the battery slot beside the panels and press X or tap Place battery.'},
 {title:'Connect solar to battery',done:o.powerStep>=6,text:'Select Solar array OUT with E / Action, then follow the marker to Battery controller IN. Purple marks the matching socket. R / Drop cancels.'},
 {title:'Power the base',done:!!o.baseConnected,text:'Select Battery protected OUT at the field, then follow the marker to Base IN at Airlock 01. Grey sockets need an earlier step; green sockets are already connected.'},
 {title:'Charge the rover',done:!!o.roverCharged,text:'Assemble and place the charger when its quest appears. Connect Base charger OUT to Rover charger IN, then park and stop in the cyan bay. Charging needs available power; a full battery cannot gain more charge.'},
 {title:'Grow your first meal',done:!!s.farmQuest?.rewarded,text:'Follow each food quest: collect ice, process safe water, request seeds, collect the marked delivery, plant, water, harvest, then prepare food at the locker. The current quest shows the next unfinished step.'},
 {title:'Build an expansion',done:Object.values(s.buildHistory||{}).some(n=>n>0),text:'Unload the recipe materials, equip the builder and go outside. Open Builder. A greenhouse needs flat, clear ground; batteries and panels expand the existing power field. Locked recipes explain what is missing.'}
];}
export function questHelp(task){
 if(task.target==='workbench')return 'Go inside to the workbench marker. Press E / Action. For assembly, take a part from the front row, then select its matching highlighted slot.';
 if(task.target==='locker')return 'Enter the base and follow the indoor locker marker. Press E / Action at the storage locker. Use Take to move a tool onto your two-slot belt.';
 if(task.target==='build-ore')return 'Follow the quest marker to the mineral deposit. Equip the pickaxe (1 or 2 / tap its slot), aim at the rock and use it repeatedly.';
 if(task.id==='power-2')return 'At the remote field, clear the four marked rocks with the pickaxe. Then aim at each highlighted panel footprint and press E / Action.';
 if(task.id==='power-5'||task.id==='base'||task.id==='charger-2')return 'Aim at the named OUT socket and press E / Action. Walk to the matching IN socket and use it. The cable preview and quest marker guide you. R / Drop cancels.';
 return task.detail;
}
