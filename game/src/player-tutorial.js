// Tutorial completion follows actions; opening a help page never completes a lesson.
export function recordLesson(s,key){(s.tutorial??={})[key]=true;}
export function tutorialLessons(o,s){const t=s.tutorial||{};return [
 {title:'Equip a tool',done:!!t.equip,text:'Press 1 or 2, or tap a tool in your belt. The highlighted slot is equipped. Take the builder from the storage locker; your belt holds two tools.'},
 {title:'Put it away',done:!!t.unequip,text:'Press the same number again, press Q, or tap Empty hands. On a phone, tap the selected tool again. This keeps the tool in your belt.'},
 {title:'Mine a mineral deposit',done:!!t.mine||s.seenOre?.length>0,text:'Equip the pickaxe. Aim at a mineral deposit and press E, click, or tap Use several times. Ordinary rubble clears space but gives no mineral samples.'},
 {title:'Unload your samples',done:!!t.unload,text:'Go inside and use the storage locker. Opening it unloads your bag automatically. Builders spend stored materials, not samples still in your bag.'},
 {title:'Choose a project',done:!!s.buildPlan||!!t.track,text:'Press B or choose Builder in the menu. Select Track materials & build. The quest shows the next missing material and marks the nearest matching deposit.'},
 {title:'Assemble and connect',done:o.powerStep>=6&&!!o.baseConnected,text:'Starter kits: open the workbench, pick a part, then fit it into its matching highlighted slot. Clear the field and place the panels and battery. Connect Solar OUT → Battery IN, then Battery OUT → Base IN. R or Drop cancels a held part or cable.'},
 {title:'Build an expansion',done:Object.values(s.buildHistory||{}).some(n=>n>0),text:'Unload the recipe materials, equip the builder and go outside. Open Builder. A greenhouse needs flat, clear ground; batteries and panels expand the existing power field. Locked recipes explain what is missing.'}
];}
export function questHelp(task){
 if(task.target==='workbench')return 'Go inside to the workbench marker. Press E / Use. For assembly, take a part from the front row, then select its matching highlighted slot.';
 if(task.target==='locker')return 'Enter the base and follow the indoor locker marker. Press E / Use at the storage locker. Use Take to move a tool onto your two-slot belt.';
 if(task.target==='build-ore')return 'Follow the quest marker to the mineral deposit. Equip the pickaxe (1 or 2 / tap its slot), aim at the rock and use it repeatedly.';
 if(task.id==='power-2')return 'At the remote field, clear the four marked rocks with the pickaxe. Then aim at each highlighted panel footprint and press E / Use.';
 if(task.id==='power-5'||task.id==='base'||task.id==='charger-2')return 'Aim at the named OUT socket and press E / Use. Walk to the matching IN socket and use it. The cable preview and quest marker guide you. R / Drop cancels.';
 return task.detail;
}
