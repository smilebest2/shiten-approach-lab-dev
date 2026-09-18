import * as T from './three.module.min.js';
export const presets={
 lab:{name:'球体へ接近',en:'01 / BASIC',tag:'まずは、接近そのものを。',title:'接近の実験',description:'大きさを変えずに、カメラだけが前進します。',ready:'遠くの球体へ。',hint:'地面の流れと、大きさの変化を感じてください。',scale:1,height:1,speed:3,distance:24,size:1},
 dog:{name:'犬の高さから',en:'02 / GROUND',tag:'人の足元が、大きく迫る。',title:'地上40 cmの世界',description:'低い視点から、人の足元へ。草と木が横を流れていきます。',ready:'人の足元へ、走る。',hint:'低い視点では、地面の動きも速く感じられます。',scale:.5,height:.8,speed:5,distance:32,size:1},
 insect:{name:'虫の高さから',en:'03 / MICRO',tag:'一枚の葉が、巨大な壁に。',title:'地上5 mmの世界',description:'小さな草や石を抜けて、一枚の葉に近づきます。',ready:'一枚の葉が、壁になる。',hint:'葉脈が見えてきたら、もうすぐ目の前です。',scale:.025,height:.2,speed:2.5,distance:18,size:1},
 space:{name:'宇宙船から',en:'04 / COSMOS',tag:'小さな点が、視界を覆う。',title:'惑星との距離',description:'遠方の赤い惑星へ。近づくほど、表面の模様が広がります。',ready:'点のような、惑星へ。',hint:'惑星の大きさは一定。動くのは観測者です。',scale:3390000,height:.02,speed:4,distance:32,size:1}
};
function random(seed=17){let s=seed;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
export function makeScene(kind,p){
 const scene=new T.Scene(),context=new T.Group(),target=new T.Group();scene.add(context,target);const space=kind==='space',insect=kind==='insect',dog=kind==='dog';
 const sky=space?'#030812':insect?'#627958':dog?'#97b2ba':'#728f9c';scene.background=new T.Color(sky);if(!space)scene.fog=new T.Fog(sky,insect?14:45,insect?45:120);
 scene.add(new T.HemisphereLight(space?0x8496bb:0xe8f4ff,space?0x160807:0x34432b,space?.75:2.2));const sun=new T.DirectionalLight(space?0xffd7b3:0xffeed2,space?3.3:2.5);sun.position.set(-12,18,16);scene.add(sun);
 const materials=new Map();const mat=(color)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));return materials.get(color);};
 const mesh=(g,m,x,y,z,parent=context)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const rand=random();let collider;
 if(!space){
   mesh(new T.PlaneGeometry(220,220),mat(insect?'#334123':dog?'#46633b':'#243b40'),0,-.014,0).rotation.x=-Math.PI/2;
   if(kind==='lab')context.add(new T.GridHelper(200,200,0x68877f,0x3c5759));
   if(dog)mesh(new T.PlaneGeometry(2.7,180),mat('#7c7962'),0,-.006,0).rotation.x=-Math.PI/2;
   const count=insect?600:dog?1800:160,geo=kind==='lab'?new T.BoxGeometry(.13,.5,.13):new T.ConeGeometry(insect?.12:.025,insect?1.7:.28,3),inst=new T.InstancedMesh(geo,mat(insect?'#698746':dog?'#729150':'#e1d7a5'),count),dummy=new T.Object3D();
   for(let i=0;i<count;i++){
     if(kind==='lab')dummy.position.set((i%2?1:-1)*(2.8+Math.floor(i/80)*3),.25,Math.floor(i/2)*1.5-35);
     else{dummy.position.set((rand()>.5?1:-1)*(insect?.9:1.45)+(rand()-.5)*(insect?8:35),insect?.8:.12,rand()*(insect?55:110)-20);if(dog&&Math.abs(dummy.position.x)<1.4)dummy.position.x+=2.8;dummy.rotation.z=(rand()-.5)*.5;dummy.scale.setScalar(.65+rand()*.8);}
     dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
   }context.add(inst);
   const stones=new T.InstancedMesh(new T.IcosahedronGeometry(insect?.13:.06,0),mat(insect?'#a79873':'#9b987e'),250);
   for(let i=0;i<250;i++){dummy.position.set((rand()-.5)*(insect?12:25),.02,rand()*70-15);dummy.scale.set(1+rand(),.45+rand()*.4,.7+rand());dummy.rotation.set(rand(),rand(),rand());dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);}context.add(stones);
 }
 if(kind==='lab'||space){
   const geo=new T.SphereGeometry(p.size,space?96:64,space?64:40),positions=geo.attributes.position,colors=[];
   const craters=Array.from({length:38},()=>{const z=rand()*2-1,a=rand()*Math.PI*2;return{x:Math.sqrt(1-z*z)*Math.cos(a),y:z,z:Math.sqrt(1-z*z)*Math.sin(a),r:.025+rand()*.15};});
   for(let i=0;i<positions.count;i++){
     const x=positions.getX(i)/p.size,y=positions.getY(i)/p.size,z=positions.getZ(i)/p.size;let color;
     if(space){let detail=.10*Math.sin(x*19+y*10)*Math.cos(z*23-y*11)+.07*Math.sin(x*53+z*31)*Math.cos(y*41);for(const c of craters){const d=Math.hypot(x-c.x,y-c.y,z-c.z)/c.r;if(d<1)detail-=.16*(1-d);else if(d<1.17)detail+=.06;}color=new T.Color().setRGB(.55+detail,.21+detail*.65,.105+detail*.4);}
     else{const stripe=(Math.floor(Math.atan2(z,x)*5/Math.PI)+Math.floor(Math.asin(y)*8/Math.PI))%2===0;color=new T.Color(stripe?'#dc7749':'#c3643f');}
     colors.push(color.r,color.g,color.b);
   }
   geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1}),0,space?0:p.size,0,target);collider={center:[0,space?0:p.size,0],radius:p.size};
   if(!space)mesh(new T.CircleGeometry(p.size*1.03,48),new T.MeshBasicMaterial({color:0x061a1f,transparent:true,opacity:.5}),0,.005,0).rotation.x=-Math.PI/2;
   else{const stars=[];for(let i=0;i<1400;i++){const a=rand()*Math.PI*2,z=rand()*2-1,r=130;stars.push(r*Math.sqrt(1-z*z)*Math.cos(a),r*z,r*Math.sqrt(1-z*z)*Math.sin(a));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(stars,3));context.add(new T.Points(g,new T.PointsMaterial({color:0xc9d8f0,size:1.1,sizeAttenuation:false})));}
 }
 if(dog){
   const human=new T.Group();human.scale.setScalar(p.size);target.add(human);
   const cylinder=(r1,r2,h,color,x,y,z)=>mesh(new T.CylinderGeometry(r1,r2,h,10),mat(color),x,y,z,human);
   for(const x of [0,.5]){cylinder(.14,.12,1.5,'#304353',x,.95,0);mesh(new T.BoxGeometry(.3,.2,.55),mat('#252c32'),x,.12,.13,human);}
   cylinder(.47,.36,1.1,'#dbb97b',.25,2.25,0);mesh(new T.SphereGeometry(.32,16,12),mat('#c48d6a'),.25,3.16,0,human);
   for(const x of [-.36,.86]){cylinder(.12,.1,.9,'#dbb97b',x,2.2,0);mesh(new T.SphereGeometry(.11,10,8),mat('#c48d6a'),x,1.72,0,human);}
   collider={center:[.25*p.size,1.72*p.size,0],radius:1.85*p.size,bounds:[[-.5*p.size,0,-.36*p.size],[1*p.size,3.5*p.size,.42*p.size]],footprint:1.09*p.size,front:.42*p.size};
   for(let i=0;i<28;i++){const side=i%2?1:-1,x=side*(5+rand()*13),z=i*4-35,h=4+rand()*4;mesh(new T.CylinderGeometry(.18,.32,h,7),mat('#564d39'),x,h/2,z);const crown=mesh(new T.IcosahedronGeometry(2+rand()*1.8,1),mat(i%3?'#496b39':'#739253'),x,h+.7,z);crown.scale.y=.8;}
   mesh(new T.CircleGeometry(1.2*p.size,32),new T.MeshBasicMaterial({color:0x23351d,transparent:true,opacity:.45}),.25*p.size,.006,0).rotation.x=-Math.PI/2;
 }
 if(insect){
   const positions=[],colors=[],indices=[],rows=48,cols=30,s=p.size;
   for(let j=0;j<=rows;j++){const t=j/rows,width=1.22*Math.pow(Math.sin(Math.PI*t),.72);for(let i=0;i<=cols;i++){const u=i/cols*2-1,x=u*width,y=t*1.6,z=.065*u*u+.018*Math.sin(t*Math.PI*2);positions.push(x*s,y*s,z*s);const rib=Math.exp(-Math.abs(u)*65),vein=Math.pow(Math.max(0,Math.cos((t-Math.abs(u)*.085)*Math.PI*24)),22);const c=new T.Color().setRGB(.11+.14*rib+.10*vein,.29+.22*rib+.10*vein+.05*Math.sin(t*8),.038+.025*vein);colors.push(c.r,c.g,c.b);if(i<cols&&j<rows){const a=j*(cols+1)+i;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.7}),0,0,0,target);
   collider={center:[0,.8*s,.04*s],radius:1.46*s,bounds:[[-1.23*s,0,-.025*s],[1.23*s,1.6*s,.09*s]],footprint:1.24*s,front:.09*s};
 }
 context.visible=p.context;
 return {scene,context,target,collider,dispose(){const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
