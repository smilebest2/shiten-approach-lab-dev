// Rendering-independent trajectory. All lengths are normalized world units.
export const defaults = Object.freeze({speed:3, acceleration:0, distance:24, size:1, fov:68, height:1, angle:0, gap:0.08, mode:'stop', context:true, shake:false, scale:1});
export function sanitize(input={}) {
  const p={...defaults,...input};
  for(const [k,lo,hi] of [['speed',0.1,20],['acceleration',0,6],['distance',5,100],['size',0.25,3],['fov',40,100],['height',0.02,8],['angle',-35,35],['gap',0.02,2],['scale',1e-6,1e10]]) p[k]=Math.min(hi,Math.max(lo,Number.isFinite(+p[k])?+p[k]:defaults[k]));
  if(!['stop','hit','miss','cross'].includes(p.mode))p.mode='stop';
  return p;
}
export function sphereClearance(pos,center,radius){return Math.hypot(...pos.map((v,i)=>v-center[i]))-radius;}
export function raySphere(pos,dir,center,radius){
  const q=pos.map((v,i)=>v-center[i]), b=q.reduce((s,v,i)=>s+v*dir[i],0), c=q.reduce((s,v)=>s+v*v,0)-radius*radius;
  if(c<=0)return 0; const disc=b*b-c;if(disc<0)return Infinity;
  const near=-b-Math.sqrt(disc);return near>=0?near:Infinity;
}
export function rayBox(pos,dir,bounds){
  let near=0,far=Infinity;for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-10){if(pos[i]<bounds[0][i]||pos[i]>bounds[1][i])return Infinity;continue;}let a=(bounds[0][i]-pos[i])/dir[i],b=(bounds[1][i]-pos[i])/dir[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}return far>=0?near:Infinity;
}
export function clearance(pos,c){return c.bounds?Math.hypot(...pos.map((v,i)=>Math.max(c.bounds[0][i]-v,0,v-c.bounds[1][i]))):sphereClearance(pos,c.center,c.radius);}
export function rayCollision(pos,dir,c){return c.bounds?rayBox(pos,dir,c.bounds):raySphere(pos,dir,c.center,c.radius);}
export class ApproachEngine {
  constructor(config={}, collider){this.reset(config,collider);}
  reset(config={},collider){
    this.p=sanitize(config);this.collider=collider||{center:[0,this.p.size,0],radius:this.p.size};
    this.t=0;this.travel=0;this.speed=this.p.speed;this.state='ready';this.reason='';this.pos=this.position(0);this.minimum=Infinity;this.previousAngle=null;this.metrics=this.measure(0);
  }
  start(){if(this.state==='ready'||this.state==='paused')this.state='running';}
  pause(){if(this.state==='running')this.state='paused';}
  position(s){
    const p=this.p, a=p.angle*Math.PI/180, z=p.distance-s;
    let x=0;
    if(p.mode==='miss'){
      const reach=(this.collider.footprint??this.collider.radius)+p.gap, start=Math.max(0,p.distance-6*p.size), end=Math.max(start+.1,p.distance-2*p.size),u=Math.max(0,Math.min(1,(s-start)/(end-start)));
      x=reach*u*u*u*(10+u*(-15+6*u));
    }
    if(p.mode==='cross')return [-p.distance+s,p.height,(this.collider.front??this.collider.radius)+p.gap];
    return [x*Math.cos(a)+z*Math.sin(a),p.height,z*Math.cos(a)-x*Math.sin(a)];
  }
  get yaw(){return this.p.mode==='cross'?-Math.PI/2:this.p.angle*Math.PI/180;}
  step(dt){
    if(this.state!=='running')return this.metrics;
    // Fixed maximum simulation step protects close passes from frame-rate-dependent tunnelling.
    let remaining=Math.min(Math.max(dt,0),0.1);
    while(remaining>1e-8&&this.state==='running'){
      const h=Math.min(remaining,1/240);remaining-=h;this.t+=h;
      const p=this.p, dir=[-Math.sin(this.yaw),0,-Math.cos(this.yaw)];
      const surface=rayCollision(this.pos,dir,this.collider);
      if(p.mode==='stop'&&surface<Infinity){
        const remainingGap=Math.max(0,surface-p.gap), brake=p.speed*p.speed/(2*Math.max(p.size*0.6,0.1));
        this.speed=Math.min(this.speed+p.acceleration*h,Math.sqrt(2*brake*remainingGap));
      } else this.speed+=p.acceleration*h;
      let ds=this.speed*h;
      if((p.mode==='stop'||p.mode==='hit')&&surface<Infinity){
        const limit=Math.max(0,surface-(p.mode==='stop'?p.gap:0.002));
        ds=Math.min(ds,limit);
        if(limit<0.001||ds>=limit){this.state='finished';this.reason=p.mode==='hit'?'contact':'stopped';this.speed=0;}
      }
      const next=this.position(this.travel+ds);
      // Conservative swept sphere collision, also during lateral trajectories.
      const delta=next.map((v,i)=>v-this.pos[i]), length=Math.hypot(...delta);
      const touch=length>0?rayCollision(this.pos,delta.map(v=>v/length),this.collider):Infinity;
      if(touch<=length&&touch<Infinity){
        const fraction=Math.max(0,(touch-0.002)/Math.max(length,1e-9));
        this.pos=this.pos.map((v,i)=>v+delta[i]*fraction);this.travel+=ds*fraction;this.state='finished';this.reason='contact';this.speed=0;
      }else{this.travel+=ds;this.pos=next;}
      this.minimum=Math.min(this.minimum,clearance(this.pos,this.collider));
      if(this.travel>p.distance+Math.max(5,3*p.size)){this.state='finished';this.reason='passed';this.speed=0;}
      if(this.t>180){this.state='finished';this.reason='timeout';this.speed=0;}
    }
    this.metrics=this.measure(dt);return this.metrics;
  }
  measure(dt){
    const d=Math.hypot(...this.pos.map((v,i)=>v-this.collider.center[i])),r=this.collider.radius;
    const theta=2*Math.asin(Math.min(1,r/Math.max(d,r)));
    const expansion=this.previousAngle!==null&&dt>0?(theta-this.previousAngle)/dt:0;
    this.previousAngle=theta;
    const ray=rayCollision(this.pos,[-Math.sin(this.yaw),0,-Math.cos(this.yaw)],this.collider);
    return {distance:Math.max(0,clearance(this.pos,this.collider)),theta,expansion,tau:expansion>1e-6?theta/expansion:null,ttc:['hit','stop'].includes(this.p.mode)&&this.speed>0&&Number.isFinite(ray)?ray/this.speed:null,minimum:this.minimum};
  }
}
