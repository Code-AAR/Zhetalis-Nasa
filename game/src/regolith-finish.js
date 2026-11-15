import * as THREE from 'three';
// Cosmetic dust communicates shielding level; a thin tint is not physical radiation shielding.
export function regolithFinish(material){
 const base=material.color.clone(),rough=material.roughness??.6,opacity=material.opacity;
 const soil=new THREE.Color('#a96f49'),level={value:0};
 const compile=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);shader.uniforms.regolithDust=level;
  shader.vertexShader='varying vec3 vRegolithLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRegolithLocal=position;');
  shader.fragmentShader='uniform float regolithDust; varying vec3 vRegolithLocal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float grain=fract(sin(dot(floor(vRegolithLocal*170.0),vec3(12.9898,78.233,37.719)))*43758.5453);
    float dustPatch=.5+.5*sin(vRegolithLocal.x*5.3+sin(vRegolithLocal.z*7.1))*sin(vRegolithLocal.y*6.7);
    float dust=regolithDust*(.08+.12*dustPatch+.10*grain);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.40,.22,.12)*( .8+.25*grain),dust);
  `);
 };
 material.customProgramCacheKey=()=> 'regolith-finish-v1';material.needsUpdate=true;
 return n=>{const t=THREE.MathUtils.clamp(Number(n)||0,0,3)/3;level.value=t;material.color.copy(base).lerp(soil,t*(material.transparent?.7:.55));material.roughness=rough+(1-rough)*t*.8;if(material.transparent)material.opacity=Math.min(.36,opacity+t*.12);material.userData.regolithLayer=t*3;};
}

