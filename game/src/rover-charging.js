// Training battery units: a full rover pack is represented by 1 kWh.
export function chargeRover(o,rover,bay,dt){
 const inBay=Math.abs(rover.pos.x-bay.x)<=3.3&&Math.abs(rover.pos.z-bay.z)<=4.3;
 const parked=inBay&&Math.abs(rover.speed)<.2;
 let status=!inBay?'Drive between the cyan lines':!parked?'Stop to connect':o.chargerStep<3?'Connect the charger cable first':!o.baseConnected?'Connect base power first':rover.battery>=.999?'Battery full':o.chargeReserve>0?'Charging':'Docked · waiting for solar power';
 const docked=parked&&o.chargerStep>=3&&o.baseConnected;
 let amount=0;if(docked){amount=Math.max(0,Math.min(1-rover.battery,dt/25,o.chargeReserve||0));rover.battery+=amount;o.chargeReserve=Math.max(0,(o.chargeReserve||0)-amount);o.roverDocked=true;
  // Verifying the connection is possible even when the reserve is empty at night.
  o.roverCharged=true;
 }
 return {inBay,parked,docked,amount,status};
}
