import assert from 'node:assert/strict';import{ApproachEngine,raySphere,sanitize}from'./engine.js';
function run(p,dt=1/60){const e=new ApproachEngine(p);e.start();const sizes=[];for(let i=0;i<120000&&e.state==='running';i++){e.step(dt);sizes.push(e.metrics.theta);}assert.equal(e.state,'finished');return{e,sizes};}
const a=run({mode:'stop'});assert.equal(a.e.reason,'stopped');assert.ok(Math.abs(a.e.metrics.distance-.08)<.003);assert.ok(a.sizes.every((x,i)=>!i||x>=a.sizes[i-1]));
const hit=run({mode:'hit',speed:20,acceleration:6},.1).e;assert.equal(hit.reason,'contact');assert.ok(hit.metrics.distance>=0);assert.ok(hit.metrics.distance<.004);
const miss=run({mode:'miss'}).e;assert.equal(miss.reason,'passed');assert.ok(miss.minimum>=.079);
const cross=run({mode:'cross'}).e;assert.equal(cross.reason,'passed');assert.ok(Math.abs(cross.minimum-.08)<.001);
const fine=run({mode:'stop'},1/120).e,coarse=run({mode:'stop'},1/30).e;assert.ok(Math.abs(fine.pos[2]-coarse.pos[2])<.002);
const e=new ApproachEngine();e.start();e.step(.1);e.pause();const previous=[...e.pos];e.step(1);assert.deepEqual(e.pos,previous);
for(const scale of [.025,1,3390000]){const other=run({mode:'stop',scale}).e;assert.deepEqual(other.pos,a.e.pos);assert.equal(other.metrics.theta,a.e.metrics.theta);}
assert.equal(raySphere([0,1,24],[0,0,-1],[0,1,0],1),23);assert.equal(raySphere([2,1,24],[0,0,-1],[0,1,0],1),Infinity);assert.equal(sanitize({fov:NaN,speed:-3}).fov,68);
console.log(JSON.stringify({result:'PASS',checks:['monotonic angular expansion','stop clearance','high-speed swept collision','near miss clearance','cross clearance','frame-step consistency','pause invariant','scale invariance','ray collision','input bounds'],stopDistance:a.e.metrics.distance,missMinimum:miss.minimum,crossMinimum:cross.minimum},null,2));
