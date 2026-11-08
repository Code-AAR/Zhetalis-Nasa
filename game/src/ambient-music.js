// Original slow, quiet ambient score, synthesized locally. Music is not a sound recorded in space.
import {audioVolume} from './audio-preferences.js';
let context,output,voices=[],lastChord=-1,start=0;
const chords=[[130.81,164.81,196,246.94],[110,146.83,164.81,220],[87.31,130.81,174.61,220],[98,146.83,196,246.94]];
function gain(){if(output)output.gain.setTargetAtTime(document.hidden?0:audioVolume('music')*.32,context.currentTime,.8);}
export async function startMusic(){
 if(context){await context.resume();gain();return;}
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
 context=new AC();output=context.createGain();output.gain.value=0;output.connect(context.destination);start=context.currentTime;
 for(let i=0;i<4;i++){const o=context.createOscillator(),g=context.createGain(),pan=context.createStereoPanner();o.type='sine';o.frequency.value=chords[0][i];g.gain.value=i===0?.13:.055;pan.pan.value=(i-1.5)*.35;o.connect(g).connect(pan).connect(output);o.start();voices.push(o);}
 gain();tickMusic();
}
export function tickMusic(){if(!context||context.state!=='running')return;const c=Math.floor((context.currentTime-start)/16)%chords.length;if(c!==lastChord){voices.forEach((o,i)=>o.frequency.setTargetAtTime(chords[c][i],context.currentTime,2.8));lastChord=c;}}
addEventListener('audio-levels',gain);addEventListener('mission-mute',gain);document.addEventListener('visibilitychange',gain);
export const musicDebug=()=>({state:context?.state||'idle',voices:voices.length,volume:output?.gain.value||0});
