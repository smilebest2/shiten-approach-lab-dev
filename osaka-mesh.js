import {ShapeUtils,Vector2} from './three.core.min.js';
class BufferBuilder {
 constructor(){this.p=[];this.n=[];this.c=[];}
 tri(a,b,c,color){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-9)return;n=n.map(x=>x/l);for(const q of [a,b,c]){this.p.push(...q);this.n.push(...n);this.c.push(...color);}}
 finish(){return{position:new Float32Array(this.p),normal:new Float32Array(this.n),color:new Float32Array(this.c)};}
}
const signed=r=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0);
function polygon(buf,rings,y,color,base=null){
 const clean=rings.map((r,i)=>{const a=r.filter((p,j)=>!j||Math.hypot(p[0]-r[j-1][0],p[1]-r[j-1][1])>.001);if((signed(a)>0)!==(i===0))a.reverse();return a;}).filter(r=>r.length>=3);if(!clean.length)return;
 const vectors=clean.map(r=>r.map(p=>new Vector2(...p))),flat=clean.flat(),faces=ShapeUtils.triangulateShape(vectors[0],vectors.slice(1));
 for(const f of faces){let [a,b,c]=f.map(i=>[flat[i][0],y,flat[i][1]]);if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)[b,c]=[c,b];buf.tri(a,b,c,color);}
 if(base!==null)for(const r of clean)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];buf.tri([a[0],base,a[1]],[b[0],y,b[1]],[b[0],base,b[1]],color);buf.tri([a[0],base,a[1]],[a[0],y,a[1]],[b[0],y,b[1]],color);}
}
function ribbon(buf,a,b,width,y,color){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.001)return;const x=-dz/len*width/2,z=dx/len*width/2;const v=[[a[0]+x,y,a[1]+z],[b[0]+x,y,b[1]+z],[b[0]-x,y,b[1]-z],[a[0]-x,y,a[1]-z]];buf.tri(v[0],v[1],v[2],color);buf.tri(v[0],v[2],v[3],color);}
export function buildChunk(data){
 const near=new BufferBuilder(),far=new BufferBuilder(),ground=new BufferBuilder(),detail=new BufferBuilder();
 // Float32 values are local to each 250m chunk to retain sub-metre precision.
 const local=p=>[p[0]-data.origin[0],p[1]-data.origin[1]];
 for(const b of data.buildings){const rings=b.rings.map(r=>r.map(local)),col=b.hs==='default'?[.52,.50,.44]:b.h>70?[.46,.55,.59]:[.66,.69,.67];polygon(near,rings,b.h,col,0);const area=Math.abs(signed(rings[0]))/2;if(b.h>=35||area>=650)polygon(far,rings,b.h,col,0);}
 for(const a of data.areas)polygon(ground,a.rings.map(r=>r.map(local)),a.kind==='water'?.012:.02,a.kind==='water'?[.12,.37,.45]:[.22,.37,.22]);
 for(const line of data.lines){const [a,b]=line.p.map(local),elev=line.layer>0&&!line.bridge&&line.name!=='御堂筋'?Math.min(15,line.layer*5):0,y=elev+.055;
  if(line.kind==='road'){
   ribbon(ground,a,b,line.w+(line.main?6:.6),y-.008,line.foot?[.42,.43,.40]:[.38,.39,.36]);
   ribbon(ground,a,b,line.w,y,line.foot?[.45,.45,.40]:[.12,.16,.18]);
   if(line.main){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let s=0;s<len;s+=12){const t=s/len,u=Math.min(len,s+4)/len;ribbon(detail,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],.15,y+.005,[.78,.76,.61]);}}
  }else ribbon(ground,a,b,line.w,line.kind==='rail'?y+.03:.013,line.kind==='rail'?[.29,.25,.22]:[.12,.37,.45]);
 }
 return{near:near.finish(),far:far.finish(),ground:ground.finish(),detail:detail.finish(),buildingCount:data.buildings.length};
}
