import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {projectedPhotos} from './projected-photos';
import type {HomeGeometry,HomeHeights,HomeModelPhotos,XY} from '../services/home-insights';
import type {HousePhotoFace} from '../utils/house-photo-guide';
import type {FacadeModel} from '../services/house-facade';
import {buildFacade,disposeFacade} from './facade-model';
import {terrainMesh} from './terrain-mesh';
import {estimatePhotoColors,type HousePhotoColors} from './photo-materials';
import {getHouseLidarModel,getParcelLidarModel,sampleParcelGround} from '../utils/homeLidarModel';

type Config={geometry:HomeGeometry;heights:HomeHeights|null;texture:string|null;sun:SunState;photos:HomeModelPhotos|null};
export type SunState={minute:number;playing:boolean;active:boolean;vectors:[number,number,number][];reset?:boolean;aerial?:boolean;photographic?:boolean;photoColors?:boolean;lidarMode?:'model'|'points'|'both';terrainContours?:boolean;vegetationVisible?:boolean;vegetationShadows?:boolean;captureFace?:HousePhotoFace|null;facades?:FacadeModel[]};
declare global{interface Window{HOME_MODEL:Config;home3d:{update:(state:SunState)=>void;setPhotos:(photos:HomeModelPhotos|null)=>void;dispose:()=>void};ReactNativeWebView?:{postMessage:(value:string)=>void}}}
const send=(value:unknown)=>{const message=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage({home3d:JSON.parse(message)},'*');};
const inside=(rings:XY[][],x:number,y:number)=>{const inRing=(ring:XY[])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i]!,b=ring[j]!;if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};return inRing(rings[0]!)&&!rings.slice(1).some(inRing);};
function start(){
 const config=window.HOME_MODEL,g=config.geometry,h=config.heights;
 const [left,bottom,right,top]=g.bbox,cx=(left+right)/2,cy=(bottom+top)/2,span=Math.max(right-left,top-bottom);
 const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
 function sample(values:(number|null)[],x:number,y:number){
   if(!h||x<h.bbox[0]||x>h.bbox[2]||y<h.bbox[1]||y>h.bbox[3])return null;
   const col=Math.max(0,Math.min(h.width-1,(x-h.bbox[0])/(h.bbox[2]-h.bbox[0])*h.width-0.5)),row=Math.max(0,Math.min(h.height-1,(h.bbox[3]-y)/(h.bbox[3]-h.bbox[1])*h.height-0.5));
   const x0=Math.floor(col),y0=Math.floor(row),x1=Math.min(x0+1,h.width-1),y1=Math.min(y0+1,h.height-1),fx=col-x0,fy=row-y0;
   const points=[[values[y0*h.width+x0],(1-fx)*(1-fy)],[values[y0*h.width+x1],fx*(1-fy)],[values[y1*h.width+x0],(1-fx)*fy],[values[y1*h.width+x1],fx*fy]] as const;
   let sum=0,weight=0;for(const [v,w]of points)if(finite(v)){sum+=v*w;weight+=w;}return weight>0.5?sum/weight:null;
 }
 const parcelLidar=getParcelLidarModel(g);
 const ground=(x:number,y:number)=>(parcelLidar&&parcelLidar.polygons.some(p=>inside(p,x,y))?sampleParcelGround(parcelLidar,x,y):null)??(h?sample(h.terrain,x,y):null);
 const mainLidar=g.buildings.filter(b=>b.main).map(b=>getHouseLidarModel(g,b)).find(Boolean);
 const origin=ground(cx,cy)??h?.terrain.find(finite)??mainLidar?.ground??0;
 const world=(p:XY,z:number)=>new THREE.Vector3(p[0]-cx,z-origin,cy-p[1]);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor('#eaf0f5');document.body.appendChild(renderer.domElement);renderer.domElement.style.touchAction='none';
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,0.1,span*15);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.08;controls.enablePan=false;controls.minDistance=span*0.35;controls.maxDistance=span*2.8;controls.maxPolarAngle=Math.PI*0.47;controls.minPolarAngle=0.15;
 const reset=()=>{camera.position.set(span*0.65,span*(parcelLidar?.terrain?0.48:0.8),span*0.85);controls.target.set(0,2,0);controls.update();};reset();
 const ambient=new THREE.HemisphereLight('#dceaff','#88957e',2);scene.add(ambient);
 const sunLight=new THREE.DirectionalLight('#fff1d2',3);sunLight.castShadow=true;sunLight.shadow.mapSize.set(1536,1536);sunLight.shadow.camera.left=-span;sunLight.shadow.camera.right=span;sunLight.shadow.camera.top=span;sunLight.shadow.camera.bottom=-span;sunLight.shadow.camera.near=1;sunLight.shadow.camera.far=span*6;sunLight.shadow.normalBias=0.06;sunLight.shadow.bias=-0.00015;scene.add(sunLight);scene.add(sunLight.target);
 let floorGeometry:THREE.BufferGeometry;
 if(parcelLidar?.terrain){const tin=parcelLidar.terrain,vertices:number[]=[],uv:number[]=[];for(let i=0;i<tin.fallbackVertices.length;i+=2){const x=tin.fallbackVertices[i]!,y=tin.fallbackVertices[i+1]!;vertices.push(x-cx,0,cy-y);uv.push((x-left)/(right-left),(y-bottom)/(top-bottom));}floorGeometry=new THREE.BufferGeometry();floorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));floorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));floorGeometry.setIndex(tin.fallbackIndices);}
 else{floorGeometry=new THREE.PlaneGeometry(right-left,top-bottom,Math.min(128,parcelLidar?Math.ceil((right-left)/0.5):h?.width??1),Math.min(128,parcelLidar?Math.ceil((top-bottom)/0.5):h?.height??1));floorGeometry.rotateX(-Math.PI/2);}
 const positions=floorGeometry.attributes.position!;for(let i=0;i<positions.count;i++){const x=cx+positions.getX(i),y=cy-positions.getZ(i);positions.setY(i,(ground(x,y)??origin)-origin-0.04);}floorGeometry.computeVertexNormals();
 const fallbackColor=parcelLidar?.terrain?'#d2d8d1':'#d7e1d0';
 const floorMaterial=new THREE.MeshStandardMaterial({color:fallbackColor,roughness:1,side:THREE.DoubleSide});
 let groundTexture:THREE.Texture|null=null;
 if(config.texture)new THREE.TextureLoader().load(config.texture,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());groundTexture=texture;dirty=true;},undefined,()=>send({type:'texture-unavailable'}));
 const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.receiveShadow=true;scene.add(floor);
 const terrain=parcelLidar?.terrain?terrainMesh(parcelLidar.terrain,cx,cy,origin,g.bbox):null;
 if(terrain){scene.add(terrain.mesh);scene.add(terrain.contours);}
 for(const parcel of g.parcels)for(const polygon of parcel.polygons)for(const ring of polygon){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(p=>world(p,(ground(...p)??origin)+0.09))),new THREE.LineDashedMaterial({color:'#ffffff',dashSize:0.7,gapSize:0.45,depthTest:true}));line.computeLineDistances();scene.add(line);}
 let measuredBuildings=0,estimatedBuildings=0,mainMeasured=false,lidarBuildings=0;
 floor.userData.photoGround=true;
 const allMeshes:THREE.Mesh[]=[floor],photoMeshes:THREE.Mesh[]=[floor];
 if(terrain){allMeshes.push(terrain.mesh);photoMeshes.push(terrain.mesh);}
 for(const building of g.buildings){
   const lidar=getHouseLidarModel(g,building);
   if(lidar){
    for(const [vertices,color,kind]of [[lidar.roof,'#858782','roof'],[lidar.walls,'#b9b2a6','walls']] as const){
     const positions=vertices.map((v,i)=>i%3===0?v-cx:i%3===1?vertices[i+1]!-origin:cy-vertices[i-1]!);
     const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
     const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:0.9,side:THREE.DoubleSide}));mesh.userData.houseSurface={id:building.id,kind,neutral:color};mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);allMeshes.push(mesh);if(building.main)photoMeshes.push(mesh);
    }
    measuredBuildings++;lidarBuildings++;if(building.main)mainMeasured=true;continue;
   }
   const rings=building.rings.map((r,i)=>{const ring=r.slice(0,-1);const signed=ring.reduce((sum,p,n)=>{const q=ring[(n+1)%ring.length]!;return sum+p[0]*q[1]-q[0]*p[1];},0);return (i===0?signed<0:signed>0)?ring.reverse():ring;});
   if(!rings[0]?.length)continue;
   const flat=rings.flat(),groundValues=flat.map(p=>ground(...p)).filter(finite).sort((a,b)=>a-b),base=groundValues[Math.floor(groundValues.length/2)]??origin;
   const reference=flat.map(p=>h?sample(h.surface,...p):null);
   const measured=!!h&&reference.filter(finite).length>=flat.length*0.8;
   if(measured){measuredBuildings++;if(building.main)mainMeasured=true;}else estimatedBuildings++;
   // Smooth only nearby roof samples inside the actual footprint; never use
   // absolute survey Z as a height above ground. Overhanging vegetation may
   // still affect DSM values inside a footprint; the UI states this limit.
   function roof(p:XY){
     if(!measured||!h)return base+building.height;
     const col=Math.floor((p[0]-left)/(right-left)*h.width),row=Math.floor((top-p[1])/(top-bottom)*h.height),samples:number[]=[];
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const c=col+dx,r=row+dy;if(c<0||r<0||c>=h.width||r>=h.height)continue;const x=left+(c+0.5)*(right-left)/h.width,y=top-(r+0.5)*(top-bottom)/h.height,v=h.surface[r*h.width+c];if(finite(v)&&inside(building.rings,x,y)&&v>base+0.8&&v<base+80)samples.push(v);}
     samples.sort((a,b)=>a-b);return samples[Math.floor(samples.length/2)]??sample(h.surface,...p)??base+building.height;
   }
   const roofPositions:number[]=[],wallPositions:number[]=[];
   const vector=(p:XY,z:number)=>[p[0]-cx,z-origin,cy-p[1]];
   function triangle(a:XY,b:XY,c:XY,depth=0){
     const longest=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(a[0]-c[0],a[1]-c[1]),Math.hypot(b[0]-c[0],b[1]-c[1]));
     if(measured&&longest>Math.max(0.8,...h!.resolution)*1.5&&depth<6&&roofPositions.length<180000){const mid=(p:XY,q:XY):XY=>[(p[0]+q[0])/2,(p[1]+q[1])/2],ab=mid(a,b),ac=mid(a,c),bc=mid(b,c);triangle(a,ab,ac,depth+1);triangle(ab,b,bc,depth+1);triangle(ac,bc,c,depth+1);triangle(ab,bc,ac,depth+1);return;}
     roofPositions.push(...vector(a,roof(a)),...vector(b,roof(b)),...vector(c,roof(c)));
   }
   const contour=rings[0]!.map(p=>new THREE.Vector2(...p)),holes=rings.slice(1).map(r=>r.map(p=>new THREE.Vector2(...p)));
   for(const [a,b,c]of THREE.ShapeUtils.triangulateShape(contour,holes))triangle(flat[a!]!,flat[b!]!,flat[c!]!);
   for(const ring of rings)for(let i=0;i<ring.length;i++){
     const a=ring[i]!,b=ring[(i+1)%ring.length]!,steps=Math.min(128,Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/0.8)));
     for(let step=0;step<steps;step++){const lerp=(t:number):XY=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],p=lerp(step/steps),q=lerp((step+1)/steps),pb=vector(p,ground(...p)??base),qb=vector(q,ground(...q)??base),pt=vector(p,roof(p)),qt=vector(q,roof(q));wallPositions.push(...pb,...qb,...qt,...pb,...qt,...pt);}
   }
   for(const [vertices,color,kind]of [[roofPositions,building.main?'#858782':'#b0bbc2','roof'],[wallPositions,building.main?'#b9b2a6':'#aebbc4','walls']] as const){const meshGeometry=new THREE.BufferGeometry();meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));meshGeometry.computeVertexNormals();const mesh=new THREE.Mesh(meshGeometry,new THREE.MeshStandardMaterial({color,roughness:0.9,side:THREE.DoubleSide}));if(building.main||building.associated)mesh.userData.houseSurface={id:building.id,kind,neutral:color};mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);allMeshes.push(mesh);if(building.main)photoMeshes.push(mesh);}
 }
 const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(span*0.014,16,12),new THREE.MeshBasicMaterial({color:'#ffd05c'}));scene.add(sunMesh);
 // DSM vegetation is used conservatively for photo visibility, not shown as
 // fabricated trees. Do not cover the building itself with its raster roof.
 const buildingRenderMeshes=allMeshes.filter(mesh=>mesh!==floor&&mesh!==terrain?.mesh);
 let vegetationMesh:THREE.Mesh|null=null;
 if(parcelLidar?.vegetation){const source=parcelLidar.vegetation,positions:number[]=[];
  for(let i=0;i<source.vertices.length;i+=3)positions.push(source.vertices[i]!-cx,source.vertices[i+2]!-origin,cy-source.vertices[i+1]!);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(source.indices);geometry.computeVertexNormals();
  vegetationMesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#4b8153',roughness:1,side:THREE.DoubleSide}));vegetationMesh.receiveShadow=true;scene.add(vegetationMesh);allMeshes.push(vegetationMesh);
 }
 let parcelCloud:THREE.Points|null=null;
 if(parcelLidar){
  const positions:number[]=[],colors:number[]=[];
  for(let i=0;i<parcelLidar.points.length;i+=4){const [x,y,z,c]=parcelLidar.points.slice(i,i+4) as [number,number,number,number];positions.push(x-cx,z-origin,cy-y);const color=new THREE.Color(c===2?'#987450':c===6?'#e57852':c>=3&&c<=5?'#309666':'#577fa4');colors.push(color.r,color.g,color.b);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  parcelCloud=new THREE.Points(geometry,new THREE.PointsMaterial({size:2.5,sizeAttenuation:false,vertexColors:true}));parcelCloud.visible=false;scene.add(parcelCloud);
 }
 let vegetationOcclusion:THREE.Mesh|null=null;
 if(h){const vertices:number[]=[];for(let row=0;row<h.height-1;row++)for(let col=0;col<h.width-1;col++){
   const points:XY[]=[[col,row],[col+1,row],[col+1,row+1],[col,row+1]].map(([c,r])=>[left+(c!+0.5)*(right-left)/h.width,top-(r!+0.5)*(top-bottom)/h.height]);
   if(points.some(p=>g.buildings.some(b=>inside(b.rings,...p))))continue;
   const values=[h.surface[row*h.width+col],h.surface[row*h.width+col+1],h.surface[(row+1)*h.width+col+1],h.surface[(row+1)*h.width+col]];
   if(!values.every(finite))continue;
   for(const i of [0,1,2,0,2,3]){const point=points[i]!;vertices.push(point[0]-cx,values[i]!-origin,cy-point[1]);}
  }const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));vegetationOcclusion=new THREE.Mesh(geometry,new THREE.MeshDepthMaterial({side:THREE.DoubleSide}));allMeshes.push(vegetationOcclusion);
 }
 let path:THREE.Line|null=null;
 function sunPath(vectors:SunState['vectors']){if(path){scene.remove(path);path.geometry.dispose();(path.material as THREE.Material).dispose();}const points=vectors.filter(v=>v[1]>0).map(v=>new THREE.Vector3(...v).multiplyScalar(span*0.68));path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#d4aa52',transparent:true,opacity:0.65,dashSize:0.7,gapSize:0.5}));path.computeLineDistances();scene.add(path);}
 for(const [label,x,z]of [['N',0,-1],['Ø',1,0],['S',0,1],['V',-1,0]] as const){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillStyle='#536176';ctx.fillText(label,32,44);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.position.set(x*span*0.53,0.2,z*span*0.53);sprite.scale.setScalar(span*0.045);scene.add(sprite);}
 let state=config.sun,minute=state.minute,dirty=true,last=0,lastMessage=0,raf=0,disposed=false;sunPath(state.vectors);
 let materialColors:HousePhotoColors={};
 const photoProjection=projectedPhotos(renderer,allMeshes,photoMeshes,cx,cy,origin,()=>{dirty=true;},count=>{if(!count){materialColors={};send({type:'material-colors',colors:{}});}send({type:'photo-ready',count});},async(items,alive)=>{
  let result:HousePhotoColors={};try{scene.updateMatrixWorld(true);result=await estimatePhotoColors(items,buildingRenderMeshes,allMeshes,cx,cy,origin,alive);}catch{/* Keep neutral materials when photo interpretation is unavailable. */}if(!alive())return;materialColors=result;dirty=true;send({type:'material-colors',colors:result});
 });
 const setPhotos=(photos:HomeModelPhotos|null)=>photoProjection.setPhotos(photos?.addressId===g.addressId?photos:null);
 let highlight:THREE.Mesh|null=null,highlightId='';
 function captureHighlight(face:HousePhotoFace|null|undefined){
  if((face?.id??'')===highlightId)return;highlightId=face?.id??'';
  if(highlight){scene.remove(highlight);highlight.geometry.dispose();(highlight.material as THREE.Material).dispose();highlight=null;}
  if(!face)return;
  const baseA=ground(...face.a)??origin,baseB=ground(...face.b)??origin;
  const roofA=h?sample(h.surface,...face.a):null,roofB=h?sample(h.surface,...face.b):null;
  const a=world(face.a,baseA),b=world(face.b,baseB),at=world(face.a,roofA&&roofA>baseA+1?roofA:baseA+face.height),bt=world(face.b,roofB&&roofB>baseB+1?roofB:baseB+face.height);
  const geometry=new THREE.BufferGeometry().setFromPoints([a,b,bt,a,bt,at]);geometry.computeVertexNormals();
  highlight=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#2583ff',transparent:true,opacity:0.65,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));highlight.renderOrder=20;scene.add(highlight);
  const dx=face.b[0]-face.a[0],dy=face.b[1]-face.a[1],length=Math.hypot(dx,dy),mid=a.clone().add(b).multiplyScalar(0.5);mid.y+=(face.height/2);
  controls.target.copy(mid);const distance=Math.max(face.length*1.7,span*0.45);camera.position.copy(mid).add(new THREE.Vector3(dy/length*distance,distance*0.38,dx/length*distance));controls.update();dirty=true;
 }
 const facadeGroups=new Map<string,{key:string;group:THREE.Group}>();
 function updateFacades(models:FacadeModel[]=[]){
  const activeIds=new Set(models.map(m=>m.face.id));
  for(const [id,item]of facadeGroups)if(!activeIds.has(id)){scene.remove(item.group);disposeFacade(item.group);facadeGroups.delete(id);}
  for(const model of models){const face=model.face,key=JSON.stringify(model);if(facadeGroups.get(face.id)?.key===key)continue;
   const prior=facadeGroups.get(face.id);if(prior){scene.remove(prior.group);disposeFacade(prior.group);facadeGroups.delete(face.id);}
   const dx=(face.b[0]-face.a[0])/face.length,dy=(face.b[1]-face.a[1])/face.length;
   const count=Math.max(3,Math.ceil(face.length/0.5));
   const samples=Array.from({length:count},(_,i)=>{const t=i/(count-1),x=face.a[0]+dx*face.length*t,y=face.a[1]+dy*face.length*t;return {ground:ground(x,y)??origin,roof:h?sample(h.surface,x,y):null};});
   const base=Math.max(...samples.map(s=>s.ground)),tops=samples.map(s=>s.roof).filter((v):v is number=>finite(v)&&v>base+1);
   const height=Math.max(0,Math.min(face.height,tops.length?Math.min(...tops)-base:face.height));if(height<1)continue;
   const group=buildFacade(model,height);group.position.copy(world(face.a,base));group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(dx,0,-dy),new THREE.Vector3(0,1,0),new THREE.Vector3(dy,0,dx)));scene.add(group);facadeGroups.set(face.id,{key,group});dirty=true;
  }
 }
 function update(next:SunState){if(next.vectors!==state.vectors&&JSON.stringify(next.vectors)!==JSON.stringify(state.vectors))sunPath(next.vectors);state=next;minute=next.minute;if(next.reset)reset();captureHighlight(next.captureFace);updateFacades(next.facades);if(highlight)highlight.visible=!next.facades?.some(m=>m.face.id===highlightId);dirty=true;if(state.active&&!raf)raf=requestAnimationFrame(loop);}
 function loop(now:number){
   raf=0;if(disposed||document.hidden||!state.active)return;
   const dt=Math.min(0.05,last?(now-last)/1000:0);last=now;
   if(state.playing){minute=(minute+dt*10)%1440;dirty=true;}
   const cameraChanged=controls.update();
   if(dirty||cameraChanged){
     for(const mesh of buildingRenderMeshes){const surface=mesh.userData.houseSurface;if(surface){const estimate=materialColors[surface.id]?.[surface.kind as 'roof'|'walls'];(mesh.material as THREE.MeshStandardMaterial).color.set(state.photoColors!==false&&estimate?estimate.color:surface.neutral);}}
     const pointsOnly=state.lidarMode==='points';if(parcelCloud)parcelCloud.visible=state.lidarMode==='points'||state.lidarMode==='both';
     floor.visible=!pointsOnly;for(const mesh of buildingRenderMeshes)mesh.visible=!pointsOnly;
     if(terrain){terrain.mesh.visible=!pointsOnly;terrain.contours.visible=!pointsOnly&&state.terrainContours!==false;}
     if(vegetationMesh){vegetationMesh.visible=!pointsOnly&&state.vegetationVisible===true;vegetationMesh.castShadow=state.vegetationShadows===true;}
     for(const item of facadeGroups.values())item.group.visible=!pointsOnly;
     photoProjection.setEnabled(state.photographic!==false);
     photoProjection.setGroundEnabled(state.aerial!==false);
     const map=state.aerial===false?null:groundTexture;if(floorMaterial.map!==map){floorMaterial.map=map;floorMaterial.color.set(map?'#ffffff':fallbackColor);floorMaterial.needsUpdate=true;}
     if(terrain&&(terrain.material.map!==map||terrain.material.vertexColors!==!map)){terrain.material.map=map;terrain.material.vertexColors=!map;terrain.material.needsUpdate=true;}
     const index=Math.min(state.vectors.length-2,Math.floor(minute/15)),mix=(minute%15)/15,a=state.vectors[index]!,b=state.vectors[index+1]!;
     const direction=new THREE.Vector3(...a).lerp(new THREE.Vector3(...b),mix).normalize();sunLight.position.copy(direction).multiplyScalar(span*2);sunLight.target.position.set(0,0,0);sunLight.intensity=Math.max(0,direction.y)*3.5;sunLight.castShadow=direction.y>0.02;sunMesh.visible=direction.y>0;sunMesh.position.copy(direction).multiplyScalar(span*0.68);
     const daylight=THREE.MathUtils.smoothstep(direction.y,-0.10,0.15);ambient.intensity=0.22+daylight*(terrain?1.15:1.78);renderer.setClearColor(new THREE.Color('#162236').lerp(new THREE.Color('#eaf0f5'),daylight));
     renderer.render(scene,camera);dirty=false;
     if(state.playing&&now-lastMessage>250){send({type:'time',minute});lastMessage=now;}
   }
   raf=requestAnimationFrame(loop);
 }
 const resize=()=>{const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;};window.addEventListener('resize',resize);resize();controls.addEventListener('change',()=>{dirty=true;});
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();send({type:'error',reason:'context-lost'});});
 document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden&&!raf)raf=requestAnimationFrame(loop);});
 window.home3d={update,setPhotos,dispose:()=>{disposed=true;cancelAnimationFrame(raf);photoProjection.dispose();vegetationOcclusion?.geometry.dispose();(vegetationOcclusion?.material as THREE.Material|undefined)?.dispose();controls.dispose();groundTexture?.dispose();scene.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const material of materials){(material as THREE.MeshStandardMaterial)?.map?.dispose();material?.dispose();}});renderer.dispose();}};
 window.addEventListener('message',event=>{if(event.source!==window.parent)return;if(event.data?.type==='home3d-state')update(event.data.state);if(event.data?.type==='home3d-photos')setPhotos(event.data.photos);});
 setPhotos(config.photos);
 captureHighlight(state.captureFace);
 updateFacades(state.facades);
 send({type:'ready',measuredBuildings,estimatedBuildings,mainMeasured,lidarBuildings,parcelPoints:parcelLidar?.pointCount??0,terrainTriangles:parcelLidar?.terrain?.indices.length?parcelLidar.terrain.indices.length/3:0,vegetationTriangles:parcelLidar?.vegetation?.indices.length?parcelLidar.vegetation.indices.length/3:0});raf=requestAnimationFrame(loop);
}
try{start();}catch(error){console.warn('3D initialization:',error instanceof Error?error.message:'unknown');send({type:'error',reason:'webgl-unavailable'});document.body.innerHTML='<p style="padding:24px;color:#445;font:16px sans-serif">3D-visningen kunne ikke startes på denne enhed.</p>';}
