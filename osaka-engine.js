// Metres and seconds throughout. Positions remain on the OSM road polyline.
export class OsakaRouteEngine {
  constructor(route) {
    this.height=1;this.kmh=300;this.direction=1;this.setRoute(route);
  }
  setRoute(route){
    this.route=route; this.lengths=[0];
    for(let i=1;i<route.points.length;i++)this.lengths.push(this.lengths.at(-1)+Math.hypot(route.points[i][0]-route.points[i-1][0],route.points[i][1]-route.points[i-1][1]));
    this.total=this.lengths.at(-1);this.reset(this.direction>0?0:this.total);
  }
  reset(s){this.s=Math.max(0,Math.min(this.total,s));this.state='ready';this.elapsed=0;this.travel=0;this.yaw=this.heading();}
  sample(s=this.s){s=Math.max(0,Math.min(this.total,s));let lo=0,hi=this.lengths.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(this.lengths[m]<=s)lo=m;else hi=m;}const a=this.route.points[lo],b=this.route.points[hi],t=(s-this.lengths[lo])/(this.lengths[hi]-this.lengths[lo]||1);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
  heading(){const look=Math.max(10,Math.min(32,this.kmh/3.6*.38)),a=this.sample(this.s-this.direction*8),b=this.sample(this.s+this.direction*look);return Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]));}
  snapshot(manifest){const p=this.sample();let i=0;while(i<this.lengths.length-2&&this.lengths[i+1]<this.s)i++;return{x:p[0],z:p[1],...geographic(manifest,p),yaw:this.yaw,s:this.s,travel:this.travel,speed:this.state==='running'?this.kmh:0,height:this.height,road:this.route.edges?.[i]?.name||'御堂筋'};}
  start(){if(this.state!=='finished')this.state='running';}
  pause(){if(this.state==='running')this.state='paused';}
  step(dt){if(this.state!=='running')return;dt=Math.max(0,Math.min(.1,dt));this.elapsed+=dt;const old=this.s;this.s=Math.max(0,Math.min(this.total,this.s+this.direction*this.kmh/3.6*dt));this.travel+=Math.abs(this.s-old);const target=this.heading(),diff=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw));this.yaw+=Math.max(-2*dt,Math.min(2*dt,diff*(1-Math.exp(-5*dt))));if(this.direction>0?this.s===this.total:this.s===0)this.state='finished';}
}

// Round only within the intersection's road-width envelope, not across blocks.
export function drivingRoute(route){
 const points=[route.points[0]],edges=[];const add=(p,e)=>{if(Math.hypot(p[0]-points.at(-1)[0],p[1]-points.at(-1)[1])>.0001){points.push(p);edges.push(e);}};
 for(let i=1;i<route.points.length-1;i++){
  const a=route.points[i-1],b=route.points[i],c=route.points[i+1],u=Math.hypot(b[0]-a[0],b[1]-a[1]),v=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const cut=Math.min(u*.2,v*.2,(route.edges[i-1]?.width||4)*.45,(route.edges[i]?.width||4)*.45,12);
  const enter=[b[0]+(a[0]-b[0])*cut/u,b[1]+(a[1]-b[1])*cut/u],leave=[b[0]+(c[0]-b[0])*cut/v,b[1]+(c[1]-b[1])*cut/v];add(enter,route.edges[i-1]);
  for(let j=1;j<=6;j++){const t=j/6;add([0,1].map(k=>(1-t)**2*enter[k]+2*t*(1-t)*b[k]+t*t*leave[k]),route.edges[j<4?i-1:i]);}
 }
 add(route.points.at(-1),route.edges.at(-1));return{...route,points,edges};
}

export function selectRoute(bank,from,to,previousId=null,random=Math.random){
 const a=bank.checkpoints.findIndex(c=>c.id===from),b=bank.checkpoints.findIndex(c=>c.id===to);if(a<0||b<0||a===b)throw Error('Choose two different places');
 const candidates=bank.pairs[a<b?`${from}:${to}`:`${to}:${from}`];let pool=candidates.filter(r=>r.turns>=2);if(pool.length<2)pool=candidates;
 const different=pool.filter(r=>r.id!==previousId);if(different.length)pool=different;
 return{route:pool[Math.min(pool.length-1,Math.floor(random()*pool.length))],direction:a<b?1:-1};
}

// The look-ahead is distance-based: 1,050m gives 12.6 seconds at 300km/h.
export function planChunks(manifest,engine){
  const p=engine.sample(),dir=engine.direction,anchors=[0,250,500,750,1050].map(d=>engine.sample(engine.s+dir*d));
  const wanted=[];
  for(const tile of manifest.tiles){const c=[tile.origin[0]+125,tile.origin[1]+125],d=Math.hypot(c[0]-p[0],c[1]-p[1]);let ahead=Infinity;for(let i=1;i<anchors.length;i++)ahead=Math.min(ahead,Math.hypot(c[0]-anchors[i][0],c[1]-anchors[i][1]));if(d<470||ahead<370)wanted.push({...tile,d,priority:d<300?d:d<470?d+300:800+ahead+Math.hypot(c[0]-p[0],c[1]-p[1])*.25});}
  return wanted.sort((a,b)=>a.priority-b.priority).slice(0,48);
}

export function geographic(manifest,p){return{lon:manifest.origin[0]+p[0]/(manifest.metres*manifest.cos),lat:manifest.origin[1]-p[1]/manifest.metres};}
