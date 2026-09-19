// Offline conversion only. No Overpass/OSM API is called by the website.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
const rawPath=process.argv[2]||'../work/osaka-source.json';
const raw=fs.readFileSync(rawPath), source=JSON.parse(raw);
if(source.remark) throw Error(source.remark);
const out='osaka', size=250, origin=[135.5,34.68], metres=111319.49079327358, cos=Math.cos(origin[1]*Math.PI/180);
fs.mkdirSync(out,{recursive:true});
const project=g=>[Math.round((g.lon-origin[0])*metres*cos*100)/100,Math.round(-(g.lat-origin[1])*metres*100)/100];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ways=source.elements.filter(e=>e.type==='way'),relations=source.elements.filter(e=>e.type==='relation');
const nodes=new Map(),graph=new Map();
for(const w of ways.filter(w=>w.tags?.name==='御堂筋'&&w.tags.highway==='trunk')){
 w.nodes.forEach((n,i)=>{nodes.set(n,project(w.geometry[i]));if(!graph.has(n))graph.set(n,[]);});
 for(let i=1;i<w.nodes.length;i++){const a=w.nodes[i-1],b=w.nodes[i],d=distance(nodes.get(a),nodes.get(b));graph.get(a).push({n:b,d,id:w.id});graph.get(b).push({n:a,d,id:w.id});}
}
function closest(lat,lon){const p=project({lat,lon});return [...nodes.keys()].sort((a,b)=>distance(nodes.get(a),p)-distance(nodes.get(b),p))[0];}
const first=closest(34.664794,135.4999867),last=closest(34.701788,135.4983226),cost=new Map([[first,0]]),prev=new Map(),todo=new Set([first]),done=new Set();
while(todo.size){let n=[...todo].reduce((a,b)=>cost.get(a)<cost.get(b)?a:b);todo.delete(n);if(n===last)break;done.add(n);for(const e of graph.get(n)){if(done.has(e.n))continue;const c=cost.get(n)+e.d;if(c<(cost.get(e.n)??Infinity)){cost.set(e.n,c);prev.set(e.n,{n,id:e.id});todo.add(e.n);}}}
if(!prev.has(last))throw Error('OSM road graph is disconnected; never fill a missing road with an invented segment.');
const routeNodes=[last],routeWays=[];let n=last;while(n!==first){const p=prev.get(n);routeWays.unshift(p.id);n=p.n;routeNodes.unshift(n);}
const route=routeNodes.map(n=>nodes.get(n)),cumulative=[0];for(let i=1;i<route.length;i++)cumulative.push(cumulative.at(-1)+distance(route[i-1],route[i]));
const checkpoints=[['namba','難波駅周辺',34.664794,135.4999867],['dotonbori','道頓堀',34.66905,135.50034],['shinsaibashi','心斎橋',34.6751,135.50034],['hommachi','本町',34.68217,135.50059],['yodoyabashi','淀屋橋・中之島',34.6935,135.50104],['umeda','梅田・大阪駅前',34.701788,135.4983226]].map(([id,name,lat,lon])=>{const p=project({lat,lon});let i=0;for(let j=1;j<route.length;j++)if(distance(route[j],p)<distance(route[i],p))i=j;return{id,name,index:i,s:Math.round(cumulative[i]*100)/100,position:route[i]};});
const tiles=new Map();
function tile(ix,iz){const id=`${ix}_${iz}`;if(!tiles.has(id))tiles.set(id,{id,origin:[ix*size,iz*size],buildings:[],lines:[],areas:[]});return tiles.get(id);}
const closed=r=>r.length>=4&&distance(r[0],r.at(-1))<.2;
function join(members){const lines=members.filter(m=>m.geometry?.length>1).map(m=>m.geometry.map(project)),rings=[];while(lines.length){let r=lines.pop(),changed=true;while(!closed(r)&&changed){changed=false;for(let i=0;i<lines.length;i++){const l=lines[i];if(distance(r.at(-1),l[0])<.2){r.push(...l.slice(1));lines.splice(i,1);changed=true;break;}if(distance(r.at(-1),l.at(-1))<.2){r.push(...l.slice(0,-1).reverse());lines.splice(i,1);changed=true;break;}if(distance(r[0],l.at(-1))<.2){r.unshift(...l.slice(0,-1));lines.splice(i,1);changed=true;break;}if(distance(r[0],l[0])<.2){r.unshift(...l.slice(1).reverse());lines.splice(i,1);changed=true;break;}}}if(closed(r))rings.push(r.slice(0,-1));}return rings;}
function inside(p,r){let b=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a[1]>p[1])!==(c[1]>p[1])&&p[0]<(c[0]-a[0])*(p[1]-a[1])/(c[1]-a[1])+a[0])b=!b;}return b;}
function bounds(r){return[Math.min(...r.map(p=>p[0])),Math.min(...r.map(p=>p[1])),Math.max(...r.map(p=>p[0])),Math.max(...r.map(p=>p[1]))];}
function clip(r,b){let pts=r;for(let axis=0;axis<2;axis++)for(const high of [false,true]){const edge=b[axis+(high?2:0)],input=pts;pts=[];if(!input.length)break;for(let i=0;i<input.length;i++){const a=input[i],c=input[(i+1)%input.length],ina=high?a[axis]<=edge:a[axis]>=edge,inc=high?c[axis]<=edge:c[axis]>=edge;if(ina)pts.push(a);if(ina!==inc){const t=(edge-a[axis])/(c[axis]-a[axis]);pts.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);}}}return pts.map(p=>p.map(x=>Math.round(x*100)/100));}
function clipLine(a,b,box){let lo=0,hi=1;for(let axis=0;axis<2;axis++){const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<box[axis]||a[axis]>box[axis+2])return null;}else{let u=(box[axis]-a[axis])/d,v=(box[axis+2]-a[axis])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}}return[lo,hi].map(t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t].map(v=>Math.round(v*100)/100));}
const region=bounds([project({lat:34.661,lon:135.491}),project({lat:34.708,lon:135.510})]);
const stats={buildings:0,heightTag:0,levelsEstimate:0,defaultEstimate:0,roads:0,rail:0,water:0,park:0,skippedOpenRings:0};
const handled=new Set();
function polygons(e){if(e.type==='way'){const r=e.geometry?.map(project)||[];if(!closed(r)){stats.skippedOpenRings++;return [];}return[{outer:r.slice(0,-1),holes:[]}];}const outer=join(e.members.filter(m=>m.role==='outer'||!m.role)),inner=join(e.members.filter(m=>m.role==='inner'));return outer.map(r=>({outer:r,holes:inner.filter(h=>inside(h[0],r))}));}
function processPolygon(e){const t=e.tags||{},kind=t.building&&t.building!=='no'?'building':t.natural==='water'||t.waterway==='riverbank'?'water':t.leisure==='park'||['grass','forest','recreation_ground','village_green'].includes(t.landuse)?'park':null;if(!kind)return;
 for(const rings of polygons(e)){
 const b=bounds(rings.outer),mid=[(b[0]+b[2])/2,(b[1]+b[3])/2];if(b[2]<region[0]||b[0]>region[2]||b[3]<region[1]||b[1]>region[3])continue;
 if(kind==='building'){
  if(mid[0]<region[0]||mid[0]>region[2]||mid[1]<region[1]||mid[1]>region[3])continue;
  let h=parseFloat(t.height),hs='height';if(!Number.isFinite(h)||h<=0){const levels=parseFloat(t['building:levels']);h=levels>0?levels*3.2:12;hs=levels>0?'levels':'default';}h=Math.max(2,Math.min(350,h));
  stats.buildings++;stats[hs==='height'?'heightTag':hs==='levels'?'levelsEstimate':'defaultEstimate']++;
  tile(Math.floor(mid[0]/size),Math.floor(mid[1]/size)).buildings.push({id:`${e.type}/${e.id}`,name:t.name||'',h:Math.round(h*100)/100,hs,rings:[rings.outer,...rings.holes]});
 }else{
  stats[kind]++;for(let x=Math.floor(Math.max(b[0],region[0])/size);x<=Math.floor(Math.min(b[2],region[2])/size);x++)for(let z=Math.floor(Math.max(b[1],region[1])/size);z<=Math.floor(Math.min(b[3],region[3])/size);z++){const box=[x*size,z*size,(x+1)*size,(z+1)*size],r=clip(rings.outer,box);if(r.length>2)tile(x,z).areas.push({id:`${e.type}/${e.id}`,kind,rings:[r,...rings.holes.map(h=>clip(h,box)).filter(h=>h.length>2)]});}
 }
 }
}
for(const e of relations){processPolygon(e);if(e.tags?.building||e.tags?.natural==='water'||e.tags?.leisure==='park')for(const m of e.members||[])handled.add(m.ref);}
for(const e of ways){if(!handled.has(e.id))processPolygon(e);const t=e.tags||{};if(t.tunnel==='yes'||t.location==='underground'||Number(t.layer)<0||!e.geometry)continue;
 const kind=t.highway?'road':t.railway==='rail'?'rail':t.waterway==='river'||t.waterway==='canal'?'waterline':null;if(!kind)continue;
 if(kind==='road'&&['steps','proposed','construction','elevator'].includes(t.highway))continue;
 stats[kind==='road'?'roads':kind==='rail'?'rail':'water']++;
 const main=['trunk','primary','secondary','tertiary'].includes(t.highway),foot=['footway','path','pedestrian','cycleway'].includes(t.highway);
 const width=Math.min(45,parseFloat(t.width)||((parseFloat(t.lanes)|| (main?2:1))*3.2+(foot?-1.5:1)));
 const points=e.geometry.map(project);for(let i=1;i<points.length;i++){
  const seg=clipLine(points[i-1],points[i],region);if(!seg)continue;const b=bounds(seg);
  for(let x=Math.floor(b[0]/size);x<=Math.floor(b[2]/size);x++)for(let z=Math.floor(b[1]/size);z<=Math.floor(b[3]/size);z++){const part=clipLine(...seg,[x*size,z*size,(x+1)*size,(z+1)*size]);if(part&&distance(...part)>.01)tile(x,z).lines.push({id:e.id,kind,name:t.name||'',w:kind==='rail'?1.4:kind==='waterline'?Math.max(8,parseFloat(t.width)||20):Math.max(1.5,width),main,foot,bridge:t.bridge==='yes',layer:Number(t.layer)||0,p:part});}
 }
}
const attribution='© OpenStreetMap contributors',licence='https://opendatacommons.org/licenses/odbl/1-0/';
const entries=[];for(const [id,t]of tiles){const text=JSON.stringify({...t,attribution,licence});fs.writeFileSync(path.join(out,`${id}.json`),text);entries.push({id,origin:t.origin,bytes:Buffer.byteLength(text),buildings:t.buildings.length});}
const manifest={version:1,attribution,licence,sourceTimestamp:source.osm3s.timestamp_osm_base,acquiredAt:new Date().toISOString(),bbox:[34.661,135.491,34.708,135.510],origin,metres,cos,chunkSize:size,route:{points:route,nodeIds:routeNodes,wayIds:routeWays,length:cumulative.at(-1),checkpoints},stats,tiles:entries,notes:{heights:'height tag; otherwise building:levels × 3.2m; otherwise 12m. Estimates are not measured heights.',roads:'OSM centre lines; widths inferred when absent. The virtual route ignores one-way direction. Flat datum, no surveyed terrain.'}};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(out,'source.json.gz'),zlib.gzipSync(raw));
fs.writeFileSync(path.join(out,'query.txt'),'[out:json][timeout:180][bbox:34.661,135.491,34.708,135.510];(way[building];relation[building][type=multipolygon];way[highway];way[railway];way[waterway];way[natural=water];relation[natural=water][type=multipolygon];way[landuse];way[leisure=park];relation[leisure=park][type=multipolygon];);out body geom;');
console.log(JSON.stringify({stats,tiles:entries.length,bytes:entries.reduce((a,t)=>a+t.bytes,0),maxTile:Math.max(...entries.map(t=>t.bytes)),routeMetres:manifest.route.length,checkpoints,sourceGzip:fs.statSync(path.join(out,'source.json.gz')).size},null,2));
