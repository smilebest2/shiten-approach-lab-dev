import assert from 'node:assert/strict';
import {ApproachEngine,defaults} from './engine.js';
import {makeScene,presets} from './scenes.js';
const results=[];
for(const [kind,preset]of Object.entries(presets))for(const mode of ['stop','hit','miss','cross']){
 const config={...defaults,...preset,mode};const world=makeScene(kind,config),e=new ApproachEngine(config,world.collider);e.start();
 for(let i=0;i<30000&&e.state==='running';i++)e.step(1/30);
 assert.equal(e.state,'finished',`${kind}/${mode}`);assert.equal(e.reason,mode==='stop'?'stopped':mode==='hit'?'contact':'passed',`${kind}/${mode}`);
 assert.ok(e.minimum>=-1e-6,`${kind}/${mode}: did not enter collider`);
 if(mode==='stop')assert.ok(Math.abs(e.metrics.distance-config.gap)<.002);
 if(['miss','cross'].includes(mode))assert.ok(e.minimum>=config.gap-.002);
 results.push({kind,mode,reason:e.reason,minimum:e.minimum});world.dispose();
}
// An observer above a small object must pass it rather than trigger a false hit.
const e=new ApproachEngine({...defaults,size:.25,height:8,mode:'hit'});e.start();for(let i=0;i<10000&&e.state==='running';i++)e.step(1/30);assert.equal(e.reason,'passed');
console.log(JSON.stringify({result:'PASS',scenarios:results,highCamera:'passes correctly'},null,2));
