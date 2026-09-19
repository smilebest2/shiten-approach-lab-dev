import * as T from './three.module.min.js';
import {planChunks} from './osaka-engine.js';

export class OsakaStream {
 constructor(manifest,scene,onChange){
  this.manifest=manifest;this.scene=scene;this.onChange=onChange;this.loaded=new Map();this.pending=new Map();this.wanted=new Map();this.failed=new Map();this.queue=[];this.active=0;this.building=null;this.worker=new Worker(new URL('./osaka-worker.js',import.meta.url),{type:'module'});
  this.stats={requests:0,bytes:0,evicted:0,peakChunks:0,maxBuildMs:0,missingFrames:0,errors:0};
  this.material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  this.buildingMaterial=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  // Generic facade rhythm only, not a copy of real building textures.
  this.buildingMaterial.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 cityPosition; varying vec3 cityNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncityPosition=position; cityNormal=normal;');
   shader.fragmentShader='varying vec3 cityPosition; varying vec3 cityNormal;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(abs(cityNormal.y)<0.5){float axis=abs(cityNormal.x)>abs(cityNormal.z)?cityPosition.z:cityPosition.x;vec2 cell=fract(vec2(axis,cityPosition.y)/vec2(3.2,3.4));float glass=step(.18,cell.x)*step(cell.x,.78)*step(.25,cell.y)*step(cell.y,.75);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.38,.55,.62),glass*.65);}');
  };
  this.worker.onmessage=e=>{const {id,meshes,error,buildMs}=e.data;this.building=null;this.pending.delete(id);if(error){this.fail(id,error);}else if(this.wanted.has(id)){
   const group=new T.Group(),origin=this.wanted.get(id).origin;group.position.set(origin[0],0,origin[1]);
   const parts={};for(const key of ['near','far','ground','detail']){const d=meshes[key];if(!d.position.length)continue;const g=new T.BufferGeometry();for(const k of ['position','normal','color'])g.setAttribute(k,new T.BufferAttribute(d[k],3));g.computeBoundingSphere();const m=new T.Mesh(g,key==='near'?this.buildingMaterial:this.material);group.add(m);parts[key]=m;}
   if(parts.far)parts.far.visible=false;
   this.scene.add(group);this.loaded.set(id,{group,parts,buildingCount:meshes.buildingCount});this.stats.peakChunks=Math.max(this.stats.peakChunks,this.loaded.size);this.stats.maxBuildMs=Math.max(this.stats.maxBuildMs,buildMs);this.onChange();
  }this.pumpBuild();this.pumpFetch();};
  this.worker.onerror=e=>{this.workerError=e.message||'Geometry worker failed';this.stats.errors++;this.onChange();};
 }
 update(engine){
  const plan=planChunks(this.manifest,engine);this.wanted=new Map(plan.map(x=>[x.id,x]));
  for(const [id,c]of this.loaded)if(!this.wanted.has(id)){this.scene.remove(c.group);c.group.traverse(o=>o.geometry?.dispose());this.loaded.delete(id);this.stats.evicted++;}
  for(const [id,p]of this.pending)if(!this.wanted.has(id)&&p.controller)p.controller.abort();
  this.queue=this.queue.filter(x=>this.wanted.has(x.id));
  for(const [id,p]of this.pending)if(p.status==='queued'&&!this.wanted.has(id))this.pending.delete(id);
  const p=engine.sample();for(const c of this.loaded.values()){const x=c.group.position.x+125,z=c.group.position.z+125,d=Math.hypot(x-p[0],z-p[1]),near=d<520;if(c.parts.near)c.parts.near.visible=near;if(c.parts.far)c.parts.far.visible=!near;if(c.parts.detail)c.parts.detail.visible=d<350;}
  this.pumpFetch();this.onChange();
 }
 fail(id,error){const old=this.failed.get(id);this.failed.set(id,{attempts:(old?.attempts||0)+1,next:performance.now()+10000,error:String(error)});this.stats.errors++;this.onChange();}
 pumpFetch(){if(this.workerError)return;for(const t of this.wanted.values()){
  if(this.active>=3)break;if(this.loaded.has(t.id)||this.pending.has(t.id))continue;const failed=this.failed.get(t.id);if(failed&&(failed.attempts>=3||failed.next>performance.now()))continue;
  const controller=new AbortController();this.pending.set(t.id,{controller,status:'fetch'});this.active++;this.stats.requests++;
  fetch(new URL(`./osaka/${t.id}.json?v=${encodeURIComponent(this.manifest.sourceTimestamp)}`,import.meta.url),{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);const text=await r.text();this.stats.bytes+=new TextEncoder().encode(text).length;const data=JSON.parse(text);if(this.wanted.has(t.id)){this.pending.set(t.id,{status:'queued'});this.queue.push({id:t.id,data});this.pumpBuild();}else this.pending.delete(t.id);}).catch(e=>{this.pending.delete(t.id);if(e.name!=='AbortError')this.fail(t.id,e);}).finally(()=>{this.active--;this.pumpFetch();this.onChange();});
 }}
 pumpBuild(){if(this.building||!this.queue.length||this.workerError)return;this.queue.sort((a,b)=>(this.wanted.get(a.id)?.priority??Infinity)-(this.wanted.get(b.id)?.priority??Infinity));const job=this.queue.shift();if(!this.wanted.has(job.id)){this.pending.delete(job.id);this.pumpBuild();return;}this.building=job.id;this.pending.set(job.id,{status:'building'});this.worker.postMessage(job);}
 coverage(engine){const p=engine.sample(),id=`${Math.floor(p[0]/250)}_${Math.floor(p[1]/250)}`;return this.loaded.has(id);}
 startReady(engine){return this.coverage(engine)&&[...this.wanted.values()].filter(t=>t.d<300).every(t=>this.loaded.has(t.id));}
 get report(){return{...this.stats,loaded:this.loaded.size,wanted:this.wanted.size,pending:this.pending.size,fetching:this.active,queuedGeometry:this.queue.length,failed:this.failed.size,workerError:this.workerError||null,buildings:[...this.loaded.values()].reduce((n,c)=>n+c.buildingCount,0)};}
 dispose(){for(const p of this.pending.values())p.controller?.abort();this.worker.terminate();for(const c of this.loaded.values()){this.scene.remove(c.group);c.group.traverse(o=>o.geometry?.dispose());}this.material.dispose();this.buildingMaterial.dispose();this.loaded.clear();}
}
