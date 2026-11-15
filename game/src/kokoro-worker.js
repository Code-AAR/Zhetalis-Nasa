import {voiceChunks} from './voice-chunks.js?v=voice-stream-1';
// One fixed voice. Keep the downloaded model alive across Stop and message changes.
let modelPromise,latest=0,pending=null,running=false;
const cache=new Map();
async function model(){
 if(!modelPromise)modelPromise=(async()=>{
  const {KokoroTTS}=await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js');
  return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm',progress_callback:p=>{
   if(p.status==='progress')postMessage({type:'status',id:latest,text:'Downloading voice'+(Number.isFinite(p.progress)?' · '+Math.round(p.progress)+'%':'')+'…'});
  }});
 })().catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
onmessage=({data})=>{latest=data.id;pending=data.type==='speak'?data:null;if(!running&&pending)run();};
async function run(){
 running=true;
 try{while(pending){const job=pending;pending=null;
  try{
   const send=chunk=>{const samples=chunk.samples.slice();postMessage({type:'audio',id:job.id,samples,rate:chunk.rate},[samples.buffer]);};
   if(cache.has(job.text)){for(const chunk of cache.get(job.text))send(chunk);postMessage({type:'done',id:job.id});continue;}
   postMessage({type:'status',id:job.id,text:'Preparing Kokoro voice…'});
   const tts=await model();if(job.id!==latest)continue;
   const chunks=[];
   for(const text of voiceChunks(job.text)){
    if(job.id!==latest)break;
    postMessage({type:'status',id:job.id,text:'Generating speech…'});
    const audio=await tts.generate(text,{voice:'af_heart',speed:.95});
    if(job.id!==latest)break;
    const chunk={samples:audio.audio,rate:audio.sampling_rate};chunks.push(chunk);send(chunk);
   }
   if(job.id===latest){cache.set(job.text,chunks);while(cache.size>8)cache.delete(cache.keys().next().value);postMessage({type:'done',id:job.id});}
  }catch(e){if(job.id===latest)postMessage({type:'error',id:job.id,text:'Voice unavailable · check your connection, then tap Retry.'});}
 }}finally{running=false;}
}
