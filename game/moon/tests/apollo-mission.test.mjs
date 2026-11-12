import test from 'node:test';
import assert from 'node:assert/strict';
import {apolloFrame,createApolloClock,createApolloMission,APOLLO_DURATION} from '../src/apollo-mission.js';
test('historical stages are ordered and finite at boundaries',()=>{
  assert.deepEqual([0,4,16,20,34,38].map(t=>apolloFrame(t).phase),['pad','launch','coast','descent','landed','landed']);
  for(const t of [-100,NaN,Infinity,0,4,15.999,16,20,34,100]){
    const f=apolloFrame(t);assert.ok(Number.isFinite(f.t)&&Number.isFinite(f.rocketY)&&Number.isFinite(f.landerY));assert.ok(f.t>=0&&f.t<=38);
  }
});
test('launch rises, landing slows smoothly to the surface without overshoot',()=>{
  let last=0;for(let t=4;t<16;t+=.02){const y=apolloFrame(t).rocketY;assert.ok(y>=last);last=y;}
  last=3;for(let t=20;t<=34;t+=.02){const y=apolloFrame(t).landerY;assert.ok(y>=0&&y<=last);last=y;}
  assert.ok(apolloFrame(33.999).landerY<1e-6);assert.equal(apolloFrame(34).landerY,0);
});
test('clock pauses, clamps long frames, freezes in hidden tabs, and replays',()=>{
  const c=createApolloClock();c.tick(20);assert.equal(c.time,.1);c.toggle();c.tick(1);assert.equal(c.time,.1);
  c.toggle();c.tick(.1,true);assert.equal(c.time,.1);c.seek(38);assert.equal(c.finished,true);c.restart();assert.equal(c.time,0);assert.equal(c.paused,false);
  c.seek(100);assert.equal(c.time,APOLLO_DURATION);c.seek(NaN);assert.equal(c.time,0);
  c.seek(38);c.toggle();assert.equal(c.time,0);assert.equal(c.paused,false);
});

function fixture(loadModel,timeoutMs=100) {
  class Group {constructor(){this.children=[];}add(o){this.children.push(o);}clear(){this.children=[];}}
  const removed=[],disposed=[],loops=[],scene={background:'original',add(){},remove(o){removed.push(o);}};
  const mission=createApolloMission({THREE:{Group,Color:class{}},scene,camera:{},renderer:{setAnimationLoop(fn){loops.push(fn);}},loadModel,disposeTree:o=>disposed.push(o),timeoutMs});
  return {mission,removed,disposed,loops,scene};
}
test('closing before model decode resolves disposes its late result and never starts a loop',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>finish=resolve));
  f.mission.dispose();f.mission.dispose();const model={};finish(model);
  assert.equal(await f.mission.ready,false);assert.equal(f.removed.length,1);assert.equal(f.disposed.filter(o=>o===model).length,1);assert.ok(f.loops.every(x=>x===null));
  assert.equal(f.scene.background,'original');
});
test('deadline cancels loading without preventing host cleanup',async()=>{
  const f=fixture((id,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})),5);
  assert.equal(await f.mission.ready,false);assert.equal(f.mission.state.failed,true);f.mission.dispose();assert.ok(f.loops.every(x=>x===null));
});
test('reduced motion starts and replays paused with stage-by-stage control',()=>{
  const c=createApolloClock(true);c.tick(.1);assert.equal(c.time,0);
  for(const phase of ['launch','coast','descent','landed','landed'])assert.equal(c.next().phase,phase);
  assert.equal(c.finished,true);c.restart();assert.equal(c.paused,true);c.toggle();c.tick(.1);assert.equal(c.time,.1);
});
