// Training abstraction: extraction does not make potable water.
export function extractWater(s, source='ice') {
 let litres=0;
 if(source==='ice'){litres=Math.max(0,Number(s.ice)||0)*.9;s.ice=0;}
 else if(source==='gypsum'&&s.store?.gypsum>0){s.store.gypsum--;litres=3;}
 s.rawWater=Math.max(0,Number(s.rawWater)||0)+litres;
 return litres;
}
export function purifyWater(s){
 const litres=Math.max(0,Number(s.rawWater)||0);
 if(!litres)return 0;
 s.tank=(Number(s.tank)||0)+litres;s.rawWater=0;
 Object.assign(s.farmQuest??={}, {waterMade:true,waterChecked:true});
 return litres;
}
