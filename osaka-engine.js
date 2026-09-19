// Metres and seconds throughout. Positions remain on the OSM road polyline.
export class OsakaRouteEngine {
  constructor(route) {
    this.route=route; this.lengths=[0];
    for(let i=1;i<route.points.length;i++)this.lengths.push(this.lengths.at(-1)+Math.hypot(route.points[i][0]-route.points[i-1][0],route.points[i][1]-route.points[i-1][1]));
    this.total=this.lengths.at(-1);this.height=1;this.kmh=300;this.direction=1;this.reset(0);
  }
  reset(s){this.s=Math.max(0,Math.min(this.total,s));this.state='ready';this.elapsed=0;this.travel=0;this.yaw=this.heading();}
  sample(s=this.s){s=Math.max(0,Math.min(this.total,s));let lo=0,hi=this.lengths.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(this.lengths[m]<=s)lo=m;else hi=m;}const a=this.route.points[lo],b=this.route.points[hi],t=(s-this.lengths[lo])/(this.lengths[hi]-this.lengths[lo]||1);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
  heading(){const a=this.sample(this.s-this.direction*2),b=this.sample(this.s+this.direction*18);return Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]));}
  start(){if(this.state!=='finished')this.state='running';}
  pause(){if(this.state==='running')this.state='paused';}
  step(dt){if(this.state!=='running')return;dt=Math.max(0,Math.min(.1,dt));this.elapsed+=dt;const old=this.s;this.s=Math.max(0,Math.min(this.total,this.s+this.direction*this.kmh/3.6*dt));this.travel+=Math.abs(this.s-old);const target=this.heading(),diff=Math.atan2(Math.sin(target-this.yaw),Math.cos(target-this.yaw));this.yaw+=diff*(1-Math.exp(-9*dt));if(this.direction>0?this.s===this.total:this.s===0)this.state='finished';}
}

// The look-ahead is distance-based: 1,050m gives 12.6 seconds at 300km/h.
export function planChunks(manifest,engine){
  const p=engine.sample(),dir=engine.direction,anchors=[0,250,500,750,1050].map(d=>engine.sample(engine.s+dir*d));
  const wanted=[];
  for(const tile of manifest.tiles){const c=[tile.origin[0]+125,tile.origin[1]+125],d=Math.hypot(c[0]-p[0],c[1]-p[1]);let ahead=Infinity;for(let i=1;i<anchors.length;i++)ahead=Math.min(ahead,Math.hypot(c[0]-anchors[i][0],c[1]-anchors[i][1]));if(d<470||ahead<370)wanted.push({...tile,d,priority:d<300?d:d<470?d+300:800+ahead+Math.hypot(c[0]-p[0],c[1]-p[1])*.25});}
  return wanted.sort((a,b)=>a.priority-b.priority).slice(0,48);
}

export function geographic(manifest,p){return{lon:manifest.origin[0]+p[0]/(manifest.metres*manifest.cos),lat:manifest.origin[1]-p[1]/manifest.metres};}
