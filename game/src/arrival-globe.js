import * as THREE from 'three';
import { makeSpin, latLonDir } from './globe.js';
import { loadMarsMap } from './nasaimages.js';
import { loadModel } from './nasamodels.js';

// The close-up globe and relay orbits from the original arrival briefing.
export class ArrivalGlobe {
  constructor(canvas){
    const renderer=this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    const scene=this.scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100);
    scene.add(new THREE.AmbientLight('#ffffff',.55));
    const light=new THREE.DirectionalLight('#fff4e6',1.6);light.position.set(-4,2,5);scene.add(light);
    const indicator=canvas.parentElement.querySelector('.art-progress');
    let loaded=0;
    const settled=()=>{if(!indicator)return;const n=Math.round(++loaded*100/3);indicator.textContent=n+'%';indicator.style.setProperty('--loaded',n+'%');indicator.setAttribute('aria-valuenow',n);if(n===100)indicator.remove();};
    const texture=this.texture=new THREE.TextureLoader().load('assets/mars-map.jpg',settled,undefined,settled);
    texture.colorSpace=THREE.SRGBColorSpace;
    const globe=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshStandardMaterial({map:texture,roughness:1}));scene.add(globe);
    loadMarsMap().then(({ok,canvas:map})=>{
      if(!ok||this.closed)return;
      const mosaic=new THREE.CanvasTexture(map);mosaic.colorSpace=THREE.SRGBColorSpace;
      globe.material.map=mosaic;globe.material.needsUpdate=true;this.texture.dispose();this.texture=mosaic;
    });
    const site=latLonDir(18.38,77.58);
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.025,12,8),new THREE.MeshBasicMaterial({color:'#ff7a3d'}));
    marker.position.copy(site).multiplyScalar(1.01);globe.add(marker);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.04,.055,24),new THREE.MeshBasicMaterial({color:'#ffd27a',side:THREE.DoubleSide}));
    ring.position.copy(site).multiplyScalar(1.012);ring.lookAt(site.clone().multiplyScalar(2));globe.add(ring);
    globe.rotation.set(.25,-Math.atan2(site.x,site.z)-.9,0);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.03,48,32),new THREE.MeshBasicMaterial({color:'#ffb48a',transparent:true,opacity:.12,side:THREE.BackSide})));
    const orbits=[new THREE.Group(),new THREE.Group()];orbits[0].rotation.set(.5,0,.25);orbits[1].rotation.set(-.35,0,-.5);scene.add(...orbits);
    this.orbits=orbits;
    for(const [i,file] of ['mro.glb','odyssey.glb'].entries()){
      loadModel(file).then(asset=>{
        if(this.closed||!asset)return;
        const model=asset.scene.clone(),size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.setScalar((i ? .32 : .42)/Math.max(size.x,size.y,size.z));
        model.position.set(i?0:1.42,0,i?1.6:0);orbits[i].add(model);
      }).then(settled,settled);
    }
    const spin=makeSpin(canvas,globe,{maxTilt:1}),clock=new THREE.Clock(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let width,height;
    const draw=()=>{
      const w=canvas.clientWidth,h=canvas.clientHeight;
      if(w&&h&&(w!==width||h!==height)){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=4.2*Math.max(1,1.12/camera.aspect);camera.updateProjectionMatrix();}
      const dt=Math.min(clock.getDelta(),.05);spin.update(dt);
      if(!reduced.matches){if(!spin.busy())globe.rotation.y+=dt*.12;orbits[0].rotation.y+=dt*.35;orbits[1].rotation.y-=dt*.22;}
      renderer.render(scene,camera);this.frame=requestAnimationFrame(draw);
    };
    draw();
  }
  dispose(){
    this.closed=true;cancelAnimationFrame(this.frame);
    this.scene.remove(...this.orbits); // The model cache owns the shared orbiter assets.
    this.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
    this.texture.dispose();this.renderer.dispose();this.renderer.forceContextLoss();
  }
}
