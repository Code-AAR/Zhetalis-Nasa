// Historically inspired educational animation, not trajectory/flight physics.
// Dependencies are supplied by the optional viewer: importing this module is pure.
export const APOLLO_DURATION = 38;
export const APOLLO_STAGES = Object.freeze([0, 4, 16, 20, 34, 38]);
export const APOLLO_NOTE = 'Historically inspired Apollo sequence, accelerated to 38 seconds. Distances and model scales change between scenes. Staging, Earth orbit, the multi-day coast, docking and lunar orbit are omitted. This is not Artemis, Starship, or a flight simulation.';

export function apolloFrame(seconds) {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.min(APOLLO_DURATION, seconds)) : 0;
  if (t < 4) return {t, phase:'pad', rocketY:0, landerY:0, caption:'Earth · Saturn V on the launch pad. The Apollo Lunar Module travelled inside the launch stack.'};
  if (t < 16) {
    const u=(t-4)/12;
    return {t,phase:'launch',rocketY:9*u*u,landerY:0,caption:'Earth launch · Saturn V climbs away from the pad. The intact model illustrates ascent; stage separation is not shown.'};
  }
  if (t < 20) return {t,phase:'coast',rocketY:9,landerY:0,caption:'Time jump · After staging, Earth orbit, a multi-day journey and lunar orbit, astronauts transferred to the Lunar Module. Those steps are omitted here.'};
  if (t < 34) {
    const u=(t-20)/14;
    return {t,phase:'descent',rocketY:0,landerY:3*(1-u)*(1-u),caption:'Moon · The Apollo Lunar Module brakes with its descent engine. The Moon has no air for parachutes; this descent is simplified and accelerated.'};
  }
  return {t,phase:'landed',rocketY:0,landerY:0,caption:'Touchdown · The Lunar Module rests on the Moon. Apollo astronauts later used its ascent stage to return to lunar orbit; that return is not shown.'};
}

// A small deterministic clock also makes pause, replay and visibility behaviour testable in Node.
export function createApolloClock(reducedMotion=false) {
  let elapsed=0,paused=reducedMotion;
  return {
    get time(){return elapsed;}, get paused(){return paused;}, get finished(){return elapsed===APOLLO_DURATION;},
    tick(dt,hidden=false){if(!paused&&!hidden&&Number.isFinite(dt))elapsed=Math.min(APOLLO_DURATION,elapsed+Math.max(0,Math.min(.1,dt)));return apolloFrame(elapsed);},
    seek(t){elapsed=apolloFrame(t).t;return apolloFrame(elapsed);},
    next(){elapsed=APOLLO_STAGES.find(t=>t>elapsed+.001)??APOLLO_DURATION;return apolloFrame(elapsed);},
    toggle(){if(elapsed===APOLLO_DURATION){elapsed=0;paused=false;}else paused=!paused;return paused;},
    restart(){elapsed=0;paused=reducedMotion;return apolloFrame(elapsed);},
  };
}

// Owns only its group, models and loop; never the host renderer or viewer controls.
export function createApolloMission({THREE,scene,camera,renderer,loadModel,disposeTree,onStatus=()=>{},onState=()=>{},reducedMotion=false,timeoutMs=45000}) {
  const clock=createApolloClock(reducedMotion),controller=new AbortController();
  const group=new THREE.Group();group.name='Historical Apollo mission';scene.add(group);
  const background=scene.background,clockNow=()=>performance.now();
  const earthBackground=new THREE.Color('#17354f'),moonBackground=new THREE.Color('#05070a');
  let disposed=false,ready=false,failed=false,rocket,lander,ground,plume,last=clockNow(),phase='';
  const timer=setTimeout(()=>controller.abort(new Error('Apollo model loading timed out')),timeoutMs);
  const state=()=>({ready,failed,paused:clock.paused,finished:clock.finished,phase:apolloFrame(clock.time).phase,time:clock.time});
  function draw(){if(!disposed&&!document.hidden)renderer.render(scene,camera);}
  function normalize(model,height,vertical=false) {
    const container=new THREE.Group();container.add(model);
    let bounds=new THREE.Box3().setFromObject(container),size=bounds.getSize(new THREE.Vector3());
    // Saturn V sources may use Z-up; orient the long rocket axis upright without editing the asset.
    if(vertical){if(size.z>size.y&&size.z>size.x)model.rotation.x-=Math.PI/2;else if(size.x>size.y&&size.x>size.z)model.rotation.z+=Math.PI/2;}
    bounds=new THREE.Box3().setFromObject(container);size=bounds.getSize(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Model has no usable bounds');
    const center=bounds.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    container.scale.setScalar(height/size.y);return container;
  }
  function pose() {
    if(!ready||disposed)return;
    const frame=apolloFrame(clock.time),earth=frame.phase==='pad'||frame.phase==='launch',moon=frame.phase==='descent'||frame.phase==='landed';
    rocket.visible=earth;lander.visible=moon;ground.visible=earth||moon;
    rocket.position.y=frame.rocketY;lander.position.set(0,frame.landerY,0);
    ground.material.color.set(earth?'#52615b':'#777775');
    scene.background=earth?earthBackground:moonBackground;
    plume.visible=frame.phase==='launch'||frame.phase==='descent';
    plume.scale.set(earth?.22:.12,earth?.9:.38,earth?.22:.12);
    plume.position.set(0,(earth?frame.rocketY:frame.landerY)+.15-plume.scale.y*.5,0);
    const lookY=earth?1.4+frame.rocketY:moon?1+frame.landerY*.45:1;
    camera.position.set(earth?5:4,lookY+(earth?1.6:1.4),earth?7:6);camera.lookAt(0,lookY,0);
    if(frame.phase!==phase){phase=frame.phase;onStatus(frame.caption);onState(state());}
    draw();
  }
  function syncLoop() {
    renderer.setAnimationLoop(null);
    if(!ready||disposed||clock.paused||clock.finished)return;
    last=clockNow();
    renderer.setAnimationLoop(now=>{
      if(disposed)return;
      clock.tick((now-last)/1000,document.hidden);last=now;pose();
      if(clock.finished){renderer.setAnimationLoop(null);onState(state());}
    });
  }
  function dispose(){if(disposed)return;disposed=true;clearTimeout(timer);controller.abort();renderer.setAnimationLoop(null);scene.remove(group);disposeTree(group);scene.background=background;}
  // loadModel must honour AbortSignal, including disposing decoded results that arrive late.
  const readyPromise=(async()=>{
    onStatus('Loading Saturn V and the Apollo Lunar Module… You can return to the viewer at any time.');
    try {
      // Sequential loads bound decoder memory; successful partial loads belong to group immediately.
      for(const [id,height,vertical] of [['saturn',3,true],['apollo',1.2,false]]) {
        const model=await loadModel(id,controller.signal);
        if(disposed||controller.signal.aborted){disposeTree(model);throw new Error('Apollo mission cancelled');}
        let fitted;
        try{fitted=normalize(model,height,vertical);}catch(error){disposeTree(model);throw error;}
        group.add(fitted);fitted.visible=false;if(id==='saturn')rocket=fitted;else lander=fitted;
      }
      ground=new THREE.Mesh(new THREE.CylinderGeometry(8,8,.12,64),new THREE.MeshStandardMaterial({color:'#52615b',roughness:1}));ground.position.y=-.06;group.add(ground);
      // A separate explanatory exhaust effect; original vehicle geometry/materials remain unchanged.
      plume=new THREE.Mesh(new THREE.ConeGeometry(1,1,24),new THREE.MeshBasicMaterial({color:'#ffd59a',transparent:true,opacity:.75,depthWrite:false}));group.add(plume);
      clearTimeout(timer);ready=true;pose();onState(state());syncLoop();return true;
    }catch(error){
      clearTimeout(timer);controller.abort();
      if(!disposed){failed=true;renderer.setAnimationLoop(null);scene.remove(group);disposeTree(group);group.clear();onStatus('Apollo mission could not load. Choose Fly Apollo mission to retry, or select an exhibit.');onState(state());}
      return false;
    }
  })();
  return {ready:readyPromise,get state(){return state();},
    toggle(){if(!ready||disposed)return;clock.toggle();pose();onState(state());syncLoop();},
    next(){if(!ready||disposed)return;clock.next();pose();onState(state());syncLoop();},
    restart(){if(!ready||disposed)return;clock.restart();pose();onState(state());syncLoop();},
    dispose,
  };
}
