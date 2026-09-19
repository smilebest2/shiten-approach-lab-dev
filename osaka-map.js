// Leaflet renders standard OSM cartography. Only visible tiles, normal HTTP cache.
export class OsakaMap {
 constructor(container,manifest){
  this.manifest=manifest;this.container=container;this.centerTime=-Infinity;this.updates=0;this.failures=0;this.failedTiles=new Set();
  const L=window.L;
  this.map=L.map(container,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false});
  this.map.on('click',()=>document.getElementById('map-expand').click());
  this.goal=document.createElement('span');this.goal.className='map-goal';container.parentElement.append(this.goal);
  this.layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:0,updateWhenIdle:false,updateInterval:500});
  this.layer.on('tileerror',e=>{this.failures++;this.failedTiles.add(e.tile.src);document.getElementById('map-status').textContent='地図取得エラー / タップで再試行';});
  this.layer.on('tileload',e=>this.failedTiles.delete(e.tile.src));
  this.layer.on('load',()=>{document.getElementById('map-status').textContent=this.failedTiles.size?'地図取得エラー / タップで再試行':'北 ↑ / OSM実地図';});
  this.layer.addTo(this.map);
  this.line=L.polyline([],{color:'#2870b9',weight:4,opacity:.85,interactive:false}).addTo(this.map);
  this.destination=L.circleMarker([0,0],{radius:6,color:'#792553',fillColor:'#ffdd73',fillOpacity:1,weight:2,interactive:false}).addTo(this.map);
  this.marker=L.marker([0,0],{interactive:false,icon:L.divIcon({className:'map-position',html:'<span class="map-arrow">▲</span>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(this.map);
 }
 latlng(p){return[this.manifest.origin[1]-p[1]/this.manifest.metres,this.manifest.origin[0]+p[0]/(this.manifest.metres*this.manifest.cos)];}
 setRoute(route,direction){this.line.setLatLngs(route.points.map(p=>this.latlng(p)));this.destination.setLatLng(this.latlng(direction>0?route.points.at(-1):route.points[0]));this.centerTime=-Infinity;if(this.overview)this.resize();}
 update(position,now){
  const ll=[position.lat,position.lon];this.position=position;
  if(!this.overview&&now-this.centerTime>=200){this.map.setView(ll,16,{animate:false});this.centerTime=now;this.updates++;}
  // Move the already-rendered map surface between 5Hz tile/route updates.
  // This follows the SAME current coordinate, with no extrapolated movement clock.
  if(!this.overview){const delta=this.map.project(ll).subtract(this.map.project(this.map.getCenter()));this.container.style.transform=`translate(${-delta.x}px,${-delta.y}px)`;}else this.container.style.transform='';
  this.marker.setLatLng(ll);
  const arrow=this.marker.getElement()?.firstElementChild;if(arrow)arrow.style.transform=`rotate(${-position.yaw*180/Math.PI}deg)`;
 }
 resize(){this.overview=document.getElementById('mini-map').classList.contains('large');this.map.invalidateSize({pan:false});if(this.overview)this.map.fitBounds(this.line.getBounds(),{padding:[24,35],animate:false});this.centerTime=-Infinity;if(this.failedTiles.size){this.failedTiles.clear();this.layer.redraw();}}
}
