import * as THREE from 'three';
import { ArrivalGlobe } from './arrival-globe.js';
import { StarshipLandingVisual } from './starship-landing.js';
import { SITES } from './sim.js';

// Representative map pins for gameplay regions, not surveyed landing coordinates.
export const LANDING_REGIONS=[
  {key:'plains',name:'Arcadia plains',lat:45,lon:-170},
  {key:'polar',name:'Northern polar region',lat:70,lon:-125},
  {key:'jezero',name:'Jezero Crater',lat:18.38,lon:77.58},
  {key:'cave',name:'Tharsis lava-tube region',lat:0,lon:-110},
];
// Set scanVideo to the supplied animation's local asset URL when it is ready.
// A failed video leaves the built-in illustrative scan available.
export function showArrival(F,delayMinutes=10,{scanVideo=null}={}){
 return new Promise(resolve=>{
  let selected=null,phase='select',visual,frame,closed=false,elapsed=0,last=performance.now(),video;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root=document.createElement('section');root.id='arrival';root.className='journey-briefing landing-flow';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','landing-title');
  root.innerHTML=`<div class="landing-shell"><header class="landing-header"><span>MARS APPROACH</span><button data-exit>Back to menu ×</button></header><h2 id="landing-title">Choose where to land</h2><p data-stage>Choose a named marker on Mars, or use the region buttons below.</p><div class="landing-art"><canvas aria-label="Mars globe with selectable landing regions"></canvas></div><div class="landing-regions">${LANDING_REGIONS.map(r=>`<button data-region="${r.key}" aria-pressed="false">${r.name}</button>`).join('')}</div><section class="mission-brief" aria-label="Mission briefing"><h3>Your Mars mission brief</h3><p>Departure burn → interplanetary coast → orbital survey → entry → powered landing.</p><p>Trans-Mars injection sets the course from Earth. On arrival, choose a region and review its resources. The orbiter surveys it before the Starship-style vehicle begins atmospheric entry and engine braking.</p><p data-region-description aria-live="polite">The markers represent broad regions, not certified landing sites.</p></section><p data-status role="status"></p><div class="landing-actions"><button data-confirm disabled>Select a region first</button><button data-skip hidden>Skip animation ›</button></div><details><summary>Science and simulation notes</summary><p>Trans-Mars injection is the earlier departure burn toward Mars. Landing uses entry, descent and engine braking. This Starship-inspired Mars vehicle, including its landing gear, illustrates a concept, not a validated flight simulation.</p><p>The scan is an illustration, not a live satellite measurement. Region positions are approximate. Your choice changes resources and hazards; all missions currently use the same Gusev-inspired training terrain. Lava tubes are a research scenario, not a certified landing area.</p><p><a href="https://www.nasa.gov/directorates/stmd/propulsive-descent-technologies-pdt/" target="_blank" rel="noopener">NASA: propulsive descent for heavy Mars landers</a>. Radio delay: about ${delayMinutes.toFixed(0)} minutes each way.</p></details></div>`;
  document.body.appendChild(root);const previousFocus=document.activeElement;
  const get=s=>root.querySelector(s),status=get('[data-status]'),confirm=get('[data-confirm]'),skip=get('[data-skip]');
  const choose=key=>{if(phase!=='select')return;selected=key;visual?.select?.(key);for(const b of root.querySelectorAll('[data-region]'))b.setAttribute('aria-pressed',String(b.dataset.region===key));get('[data-region-description]').textContent=SITES[key].name+': '+SITES[key].blurb;confirm.disabled=false;confirm.textContent='Confirm '+SITES[key].short+' · begin scan ›';get('[data-stage]').textContent='Zoomed to '+SITES[key].name+'. Review the brief below, then confirm your landing region.';};
  try{visual=new ArrivalGlobe(get('canvas'),{sites:LANDING_REGIONS,onSelect:choose});}catch{status.textContent='Globe unavailable. Choose a region using the buttons.';}
  root.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>choose(b.dataset.region));
  function finish(value){if(closed)return;closed=true;cancelAnimationFrame(frame);visual?.dispose();video?.pause();document.removeEventListener('keydown',key);root.remove();previousFocus?.focus?.();resolve(value);}
  function beginScan(){if(!selected)return;phase='scan';elapsed=0;confirm.hidden=true;skip.hidden=false;root.querySelectorAll('[data-region]').forEach(b=>b.disabled=true);get('#landing-title').textContent='Orbital survey · '+SITES[selected].name;get('[data-stage]').textContent='The orbiter checks the chosen region before the lander begins its descent.';status.textContent='Illustrative scan · placeholder for your animation';visual?.scan?.();
   if(scanVideo){video=document.createElement('video');video.src=scanVideo;video.muted=true;video.playsInline=true;video.className='scan-video';video.onerror=()=>video.remove();get('.landing-art').appendChild(video);video.play().catch(()=>video.remove());}
  }
  function beginDescent(){phase='descent';elapsed=0;video?.pause();video?.remove();visual?.dispose();const canvas=get('canvas');canvas.replaceWith(document.createElement('canvas'));try{visual=new StarshipLandingVisual(get('canvas'));visual.setMode('entry');}catch{visual=null;}get('#landing-title').textContent='Starship approach · '+SITES[selected].name;get('[data-stage]').textContent='Atmospheric entry → engine braking → slow touchdown';get('.landing-regions').hidden=true;}
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
    if(t<7){status.textContent='Entry · the atmosphere removes speed; thermal protection faces the airflow.';if(visual){visual.parts.lander.position.set(-.9+t*.09,.9-t*.1,0);visual.parts.heat.position.copy(visual.parts.lander.position).add(new THREE.Vector3(0,-.18,0));}}
    else{if(visual&&visual.mode!=='landing'){visual.setMode('landing');visual.scene.background=new THREE.Color('#805039');visual.scene.traverse(o=>{if(o.isPoints)o.visible=false;});visual.camera.position.set(0,2.2,14);visual.camera.lookAt(0,0,0);}const p=Math.min(1,(t-7)/17),remaining=(1-p)**2;
     status.textContent=p<.75?'Powered descent · retro-thrust slows the lander.':'Final approach · easing down onto the landing gear.';
     if(visual){const lander=visual.parts.lander;lander.scale.setScalar(1);lander.rotation.z=(1-p)*.12;lander.position.set((1-p)*.65,0,0);lander.updateWorldMatrix(true,true);const bottom=new THREE.Box3().setFromObject(lander).min.y;lander.position.y=-1.4-bottom+2*remaining;visual.parts.heat.visible=p<1;visual.parts.heat.position.set(lander.position.x,-1.4+2*remaining-.18,0);visual.parts.heat.scale.set(.4,.2+.5*(1-p),.4);}
     if(p>=1)touchdown();
    }
   }
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
 });
}
