// Costs and daily renewal are game rules, not mineral processing recipes.
export const RECIPES={
 greenhouse:{name:'Hydroponic greenhouse',cost:{hematite:3,iron:1,parts:2},tier:0,description:'Place a new grow house on clear, flat ground.'},
 battery:{name:'Extra battery',cost:{hematite:2,gypsum:1,iron:1,parts:3},tier:0,description:'Add storage to the commissioned power field.'},
 panel:{name:'Extra solar panel',cost:{hematite:2,silica:2,parts:4},tier:1,description:'Expand the commissioned solar array. Silica makes the cover glass.'}
};
const NAMES={hematite:'hematite',gypsum:'sulfate salt',iron:'meteorite iron',silica:'silica',carbonate:'carbonate rock'};
export function builderQuest(o,c){
 const key=c.buildPlan,r=RECIPES[key];if(!r)return null;
 const base={id:'build-'+key,title:'Build: '+r.name};
 const result=(step,target,ore)=>({...base,step,detail:step+'. Open Builder (B) to check the recipe or stop tracking.',target,ore});
 if(o.powerStep<6||!o.baseConnected)return null; // Preserve the step-by-step starter mission until power is connected.
 if(key==='panel'&&o.panels>=12)return result('Solar field full (12 panels). Choose another project',null);
 if(key==='greenhouse'&&(c.greenhouses||[]).length>=4)return result('Greenhouse limit reached (4). Choose another project',null);
 if(o.tier<r.tier)return result('Use the indoor power console: allocate power to Science and Talk to Earth to unlock tier '+(r.tier+1),'console');
 if(!c.belt.includes('builder'))return result('Take the builder tool from the storage locker','locker');
 for(const [ore,n] of Object.entries(r.cost)){
  if(ore==='parts')continue;
  const stored=c.store[ore]||0,bag=c.bag[ore]||0;
  if(stored+bag<n)return result(`Mine ${n-stored-bag} more ${NAMES[ore]||ore} (${stored+bag}/${n})`,'build-ore',ore);
 }
 if(Object.entries(r.cost).some(([k,n])=>k!=='parts'&&(c.store[k]||0)<n))return result('Unload your sample bag at the storage locker','locker');
 if(o.parts<r.cost.parts)return result(`Collect ${r.cost.parts-o.parts} more parts from supply pods or salvage`,'build-parts');
 return result(key==='greenhouse'?'Equip builder, find clear ground and choose Build here':'Equip builder and choose Install in power field','build-ready');
}
export function renewDeposits(state,sol,eligible){
 if(state.oreRenewedSol==null){state.oreRenewedSol=sol;return [];}
 if(sol<=state.oreRenewedSol)return [];
 state.oreRenewedSol=sol;
 const ids=state.mined.filter(id=>eligible(id));
 state.mined=state.mined.filter(id=>!ids.includes(id));
 for(const id of ids)delete state.hits[id];
 return ids;
}
