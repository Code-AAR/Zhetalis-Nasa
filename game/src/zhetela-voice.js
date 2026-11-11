import {audioVolume,audioMuted} from './audio-preferences.js';
let enabled=false;try{enabled=localStorage.getItem('zhetela-kokoro')==='1';}catch{}
let worker,context,serial=0,timer,status='Voice off',active=false,done=false,nextStart=0;
const sources=new Set(),gains=new Set();
export const voiceEnabled=()=>enabled;
export const voiceStatus=()=>status;
export const voiceBusy=()=>active;
function report(text){status=text;dispatchEvent(new CustomEvent('zhetela-voice-status',{detail:text}));}
function unlock(){context??=new AudioContext();if(context.state==='suspended')context.resume().catch(()=>{fail('Audio blocked · tap Retry to allow playback.');});}
function watchdog(){clearTimeout(timer);timer=setTimeout(()=>{worker?.terminate();worker=null;fail('Voice timed out · tap Retry.');},120000);}
function fail(text){stopZhetelaVoice();report(text);}
function finish(){if(done&&!sources.size){active=false;clearTimeout(timer);report('Voice ready');}}
export function stopZhetelaVoice(){
 active=false;serial++;clearTimeout(timer);done=false;nextStart=0;
 for(const source of sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}sources.clear();
 for(const gain of gains)gain.disconnect();gains.clear();
 // Cancel output but preserve the worker/model, including an in-progress download.
 worker?.postMessage({type:'cancel',id:serial});report(enabled?'Voice ready':'Voice off');
}
export function setZhetelaVoice(on){enabled=!!on;try{localStorage.setItem('zhetela-kokoro',enabled?'1':'0');}catch{}stopZhetelaVoice();if(!enabled){worker?.terminate();worker=null;}}
export function speakZhetela(text){
 if(!enabled)return;
 if(audioMuted()||audioVolume('voice')===0){report('Voice muted · raise voice volume in Settings.');return;}
 stopZhetelaVoice();active=true;const id=serial;
 try{
  unlock();
  if(!worker){worker=new Worker(new URL('./kokoro-worker.js?v=voice-stream-1',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{
    if(data.id!==serial||!enabled||!active)return;
    if(data.type==='status'){watchdog();if(!sources.size)report(data.text);return;}
    if(data.type==='error'){fail(data.text);return;}
    if(data.type==='done'){clearTimeout(timer);done=true;finish();return;}
    if(data.type!=='audio')return;
    watchdog();
    if(audioMuted()||audioVolume('voice')===0){fail('Voice muted · raise voice volume in Settings.');return;}
    try{
     const buffer=context.createBuffer(1,data.samples.length,data.rate);buffer.copyToChannel(data.samples,0);
     const source=context.createBufferSource(),gain=context.createGain(),job=serial;
     source.buffer=buffer;gain.gain.value=audioVolume('voice');source.connect(gain).connect(context.destination);
     sources.add(source);gains.add(gain);
     source.onended=()=>{source.disconnect();gain.disconnect();sources.delete(source);gains.delete(gain);if(job!==serial)return;finish();if(active&&!sources.size)report('Generating speech…');};
     nextStart=Math.max(context.currentTime+.02,nextStart);source.start(nextStart);nextStart+=buffer.duration;report('Speaking');
    }catch{fail('Audio could not play · tap Retry.');}
   };
   worker.onerror=()=>{worker?.terminate();worker=null;fail('Voice failed to load · tap Retry.');};
  }
  report('Preparing Kokoro voice…');watchdog();
  worker.postMessage({type:'speak',id,text:String(text).replace(/→/g,' to ').replace(/\bOUT\b/g,'output').replace(/\bIN\b/g,'input').slice(0,700)});
 }catch{worker?.terminate();worker=null;fail('Voice unavailable in this browser · tap Retry.');}
}
addEventListener('mission-mute',()=>{if(audioMuted())stopZhetelaVoice();});
addEventListener('audio-levels',()=>{for(const gain of gains)gain.gain.value=audioVolume('voice');if(audioVolume('voice')===0)stopZhetelaVoice();});
addEventListener('pagehide',()=>{stopZhetelaVoice();worker?.terminate();worker=null;});
