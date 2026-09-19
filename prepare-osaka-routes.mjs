// Offline only. All edges retain OSM node / way provenance; no invented connectors.
import fs from 'node:fs';import zlib from 'node:zlib';
const manifest=JSON.parse(fs.readFileSync('osaka/manifest.json')),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync('osaka/source.json.gz')));
const project=g=>[Math.round((g.lon-manifest.origin[0])*manifest.metres*manifest.cos*100)/100,Math.round((manifest.origin[1]-g.lat)*manifest.metres*100)/100];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),nodes=new Map(),graph=new Map(),edgeMeta=new Map();
const allowed=new Set(['trunk','primary','secondary','tertiary','unclassified','residential']);
for(const w of raw.elements){const t=w.tags||{};if(w.type!=='way'||!allowed.has(t.highway)||!w.geometry||t.tunnel==='yes'||t.location==='underground'||Number(t.layer)<0||(Number(t.layer)>0&&t.bridge!=='yes')||['private','no'].includes(t.access)||['private','no'].includes(t.motor_vehicle))continue;
 const width=Math.max(3.2,Math.min(45,parseFloat(t.width)||((parseFloat(t.lanes)||(['residential','unclassified'].includes(t.highway)?1:2))*3.2+1)));
 for(let i=1;i<w.nodes.length;i++){const ga=w.geometry[i-1],gb=w.geometry[i];if([ga,gb].some(g=>g.lat<34.662||g.lat>34.706||g.lon<135.492||g.lon>135.509))continue;
  const a=w.nodes[i-1],b=w.nodes[i],p=project(ga),q=project(gb),length=dist(p,q);if(length<.05)continue;
  nodes.set(a,p);nodes.set(b,q);if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);
  const id=[a,b].sort((x,y)=>x-y).join(':'),meta={id,way:w.id,name:t.name||'名称未登録の道路',width,length,bridge:t.bridge==='yes',kind:t.highway};edgeMeta.set(id,meta);
  graph.get(a).push({n:b,...meta});graph.get(b).push({n:a,...meta});
 }
}
const cps=manifest.route.checkpoints.map(c=>({...c,node:[...nodes.keys()].reduce((a,b)=>dist(nodes.get(a),c.position)<dist(nodes.get(b),c.position)?a:b)}));
function path(start,end,penalty){const cost=new Map([[start,0]]),prev=new Map(),todo=new Set([start]),done=new Set();while(todo.size){let a=[...todo].reduce((a,b)=>cost.get(a)<cost.get(b)?a:b);todo.delete(a);if(a===end)break;done.add(a);for(const e of graph.get(a)){if(done.has(e.n))continue;const value=cost.get(a)+e.length*(e.width<5?1.8:1)*(penalty.get(e.id)||1);if(value<(cost.get(e.n)??Infinity)){cost.set(e.n,value);prev.set(e.n,{a,e});todo.add(e.n);}}}if(!prev.has(end))throw Error('Disconnected destination');const ns=[end],es=[];let n=end;while(n!==start){const v=prev.get(n);if(!v)throw Error('Disconnected path');es.unshift(v.e);n=v.a;ns.unshift(n);}return{nodeIds:ns,points:ns.map(n=>nodes.get(n)),edges:es};}
function turns(points){let count=0;for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],u=Math.atan2(b[1]-a[1],b[0]-a[0]),v=Math.atan2(c[1]-b[1],c[0]-b[0]);if(Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)))>.6)count++;}return count;}
const pairs={};for(let a=0;a<cps.length;a++)for(let b=a+1;b<cps.length;b++){
 const penalty=new Map(),candidates=[],signatures=new Set();let shortest=Infinity;
 for(let attempt=0;attempt<10&&candidates.length<4;attempt++){
  const r=path(cps[a].node,cps[b].node,penalty),length=r.edges.reduce((s,e)=>s+e.length,0),signature=r.nodeIds.join(',');shortest=Math.min(shortest,length);
  for(const e of r.edges)penalty.set(e.id,Math.min(6,(penalty.get(e.id)||1)*1.45));
  if(signatures.has(signature)||length>shortest*1.5||new Set(r.nodeIds).size!==r.nodeIds.length)continue;signatures.add(signature);
  const names=[...new Set(r.edges.map(e=>e.name).filter(n=>n!=='名称未登録の道路'))];
  candidates.push({...r,id:`${cps[a].id}-${cps[b].id}-${candidates.length}`,name:names.slice(0,3).join(' → ')||'街区を巡る',length,turns:turns(r.points),wayIds:r.edges.map(e=>e.way)});
 }
 pairs[`${cps[a].id}:${cps[b].id}`]=candidates;
}
// Place labels originate from tagged OSM features, never guessed business signage.
const labels=[];for(const e of raw.elements){const t=e.tags||{};if(!t.name||!(t.waterway||t.bridge==='yes'||t.leisure==='park'||t.railway==='station'||t.building&&t.name.includes('大阪')))continue;const g=e.geometry||e.members?.flatMap(m=>m.geometry||[])||[];if(!g.length)continue;const p=project(g[Math.floor(g.length/2)]);if(p[0]<-820||p[0]>825||p[1]<-2900||p[1]>1900)continue;labels.push({id:`${e.type}/${e.id}`,name:t.name,position:p,kind:t.waterway?'川':t.bridge==='yes'?'橋':t.leisure==='park'?'公園':t.railway?'駅':'建物'});}
const output={sourceTimestamp:manifest.sourceTimestamp,checkpoints:cps,pairs,labels,notes:'Real OSM roads; virtual bidirectional travel ignores one-way restrictions. Alternatives precomputed with shared-edge penalties; no loops; length <= 1.5 × shortest accepted length.'};fs.writeFileSync('osaka/routes.json',JSON.stringify(output));console.log(JSON.stringify({nodes:nodes.size,pairs:Object.keys(pairs).length,bytes:fs.statSync('osaka/routes.json').size,labels:labels.length,routes:Object.fromEntries(Object.entries(pairs).map(([key,v])=>[key,v.map(r=>({id:r.id,length:Math.round(r.length),turns:r.turns}))]))}));
