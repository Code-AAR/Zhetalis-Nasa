import * as THREE from 'three';
import { ArrivalGlobe } from './arrival-globe.js';
import { StarshipLandingVisual } from './starship-landing.js';
import { SITES } from './sim.js';

// Representative map pins for gameplay regions, not surveyed landing coordinates.
export const LANDING_REGIONS=[
  {key:'gusev',name:'Gusev Crater (Spirit)',lat:-14.57,lon:175.47},
  {key:'plains',name:'Arcadia plains',lat:45,lon:-170},
  {key:'polar',name:'Northern polar region',lat:70,lon:-125},
  {key:'jezero',name:'Jezero Crater',lat:18.38,lon:77.58},
  {key:'cave',name:'Tharsis lava-tube region',lat:0,lon:-110},
];
// Set scanVideo to the supplied animation's local asset URL when it is ready.
// A failed video leaves the built-in illustrative scan available.
export function showArrival(F,delayMinutes=10,{scanVideo=null,onDescent=null}={}){
 return new Promise(resolve=>{
  let selected=null,phase='select',visual,frame,closed=false,elapsed=0,last=performance.now(),video;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root=document.createElement('section');root.id='arrival';root.className='journey-briefing landing-flow';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','landing-title');
  root.innerHTML=`<div class="landing-shell"><header class="landing-header"><span>MARS APPROACH</span><button data-exit>Back to menu ×</button></header><h2 id="landing-title">Choose where to land</h2><p data-stage>Choose a region below or tap a yellow dot on Mars.</p><div class="landing-art"><canvas aria-label="Mars globe with selectable landing regions"></canvas></div><div class="landing-regions">${LANDING_REGIONS.map(r=>`<button data-region="${r.key}" aria-pressed="false">${r.name}</button>`).join('')}</div><section class="mission-brief" aria-label="Mission briefing"><h3>Your Mars mission brief</h3><p><b>One sol = about 24 Earth hours 39 minutes (24.66 hours).</b> A full day and night takes 5 real minutes at normal speed in this game.</p><p>Departure burn → interplanetary coast → orbital survey → entry → powered landing.</p><p>Trans-Mars injection sets the course from Earth. On arrival, choose a region and review its resources. The orbiter surveys it before your lander begins its entry, parachute descent and rocket-powered touchdown.</p><p data-region-description aria-live="polite">The markers represent broad regions, not certified landing sites.</p></section><p data-status role="status"></p><div class="landing-actions"><button data-confirm disabled>Select a region first</button><button data-skip hidden>Skip</button></div><details><summary>Science and simulation notes</summary><p>Trans-Mars injection is the earlier departure burn toward Mars. The landing follows the steps NASA used for Curiosity and Perseverance: heat shield entry, parachute, rocket descent stage and sky crane. Sizes and timings are simplified, so it is not a flight simulation.</p><p>The scan is an illustration, not a live satellite measurement. Region positions are approximate. Your choice changes resources and hazards; every mission uses the same Gusev Crater ground, built from NASA height data. Lava tubes are a research scenario, not a certified landing area.</p><p><a href="https://www.nasa.gov/directorates/stmd/propulsive-descent-technologies-pdt/" target="_blank" rel="noopener">NASA: propulsive descent for heavy Mars landers</a>. Radio delay: about ${delayMinutes.toFixed(0)} minutes each way.</p></details></div>`;
  document.body.appendChild(root);const previousFocus=document.activeElement;
  const get=s=>root.querySelector(s),status=get('[data-status]'),confirm=get('[data-confirm]'),skip=get('[data-skip]');
  const choose=key=>{if(phase!=='select')return;selected=key;visual?.select?.(key);for(const b of root.querySelectorAll('[data-region]'))b.setAttribute('aria-pressed',String(b.dataset.region===key));get('[data-region-description]').textContent=SITES[key].name+': '+SITES[key].blurb;confirm.disabled=false;confirm.textContent='Confirm '+SITES[key].short+' · begin scan ›';get('[data-stage]').textContent='Turning toward '+SITES[key].name+'. Review the brief below, then confirm your landing region.';};
  try{visual=new ArrivalGlobe(get('canvas'),{sites:LANDING_REGIONS,onSelect:choose});}catch{status.textContent='Globe unavailable. Choose a region using the buttons.';}
  root.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>choose(b.dataset.region));
  function finish(value){if(closed)return;closed=true;cancelAnimationFrame(frame);visual?.dispose();video?.pause();document.removeEventListener('keydown',key);root.remove();previousFocus?.focus?.();resolve(value);}
  function beginScan(){if(!selected)return;phase='scan';elapsed=0;confirm.hidden=true;skip.hidden=false;root.querySelectorAll('[data-region]').forEach(b=>b.disabled=true);get('#landing-title').textContent='Orbital survey · '+SITES[selected].name;get('[data-stage]').textContent='The orbiter checks the chosen region before the lander begins its descent.';status.textContent='The orbiter scans your landing region.';visual?.scan?.();
   if(scanVideo){video=document.createElement('video');video.src=scanVideo;video.muted=true;video.playsInline=true;video.className='scan-video';video.onerror=()=>video.remove();get('.landing-art').appendChild(video);video.play().catch(()=>video.remove());}
  }
  function beginDescent(){
   if(onDescent){phase='cinematic';video?.pause();video?.remove();visual?.dispose();visual=null;root.style.display='none';   // the panel sets its own display, so the hidden attribute alone would leave it covering the cutscene
    Promise.resolve().then(onDescent).then(()=>finish(selected)).catch(()=>{root.style.display='';status.textContent='Landing complete. Continue to your outpost.';touchdown();});return;}
   phase='descent';elapsed=0;video?.pause();video?.remove();visual?.dispose();const canvas=get('canvas');canvas.replaceWith(document.createElement('canvas'));try{visual=new StarshipLandingVisual(get('canvas'));visual.setMode('entry');}catch{visual=null;}get('#landing-title').textContent='Starship approach · '+SITES[selected].name;get('[data-stage]').textContent='Atmospheric entry → engine braking → slow touchdown';get('.landing-regions').hidden=true;}
  function touchdown(){phase='landed';status.textContent='Touchdown confirmed. Engines off.';confirm.hidden=false;confirm.disabled=false;confirm.textContent='Step outside ›';skip.hidden=true;}
  confirm.onclick=()=>phase==='select'?beginScan():phase==='landed'?finish(selected):null;
  skip.onclick=()=>phase==='scan'?beginDescent():finish(selected);
  get('[data-exit]').onclick=()=>finish(null);
  function key(e){if(e.key==='Escape'){e.preventDefault();phase==='select'?finish(null):phase==='scan'?beginDescent():finish(selected);}if(e.key==='Tab'){const all=[...root.querySelectorAll('button:not(:disabled),summary,a[href]')].filter(e=>e.getClientRects().length);const first=all[0],end=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}}}
  document.addEventListener('keydown',key);get('[data-exit]').focus();
  function draw(now){if(closed)return;const dt=Math.min(.1,(now-last)/1000);last=now;if(!document.hidden)elapsed+=dt;
   if(phase==='scan'){status.textContent='Illustrative orbital scan · '+Math.min(100,Math.floor(elapsed/6*100))+'%';if(elapsed>=6)beginDescent();}
   if(phase==='descent'){
    const t=reduced?24:elapsed;
    visual?.updateFlight(t);
    status.textContent=t<7?'Entry · the atmosphere removes speed.':t<20?'Powered descent · retro-thrust slows the vehicle.':'Final approach · easing onto the landing gear.';
    if(t>=24)touchdown();
   }
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
 });
}
