export const crouchHeld=keys=>!!(keys.ControlLeft||keys.ControlRight);
export function updateCrouch(actor,dt,held){
 actor.crouching=!!held;
 actor.crouch=(actor.crouch||0)+((held?1:0)-(actor.crouch||0))*(1-Math.exp(-12*Math.max(0,dt)));
 return actor.crouch*.45;
}
export function footSpeed(keys,walk,run){return crouchHeld(keys)?walk*.5:(keys.ShiftLeft||keys.ShiftRight?run:walk);}
