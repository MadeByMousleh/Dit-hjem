import {applyRoofAppearance,matchSavedRoof} from './roof-appearance';
import {applyBrickwork,isWallGeometry} from './brickwork';
import type {NeighborhoodPhotoBatch} from '../services/neighborhood-photos';
import * as THREE from 'three';
import {gunzipSync,strFromU8} from 'fflate';
import {unbase64} from '../services/property-model-format';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {projectedPhotos} from './projected-photos';
import type {HomeEnvironment,HomeGeometry,HomeHeights,HomeModelPhotos,XY} from '../services/home-insights';
import type {HousePhotoFace} from '../utils/house-photo-guide';
import type {FacadeModel} from '../services/house-facade';
import {buildFacade,disposeFacade} from './facade-model';
import {aerialFacades} from './aerial-facades';
import {openingEditor} from './opening-editor';
import {housePhotoFaces} from '../utils/house-photo-guide';
import {defaultSceneEdits} from '../utils/scene-opening-edits';
import type {PhotoPixels} from './opening-photo-colors';
import {terrainMesh} from './terrain-mesh';
import {atmosphericSky,modelWeather,solarDisc} from './model-weather';
import {nightSky} from './night-sky';
import {groundCamera} from './ground-camera';
import {configureOrbitCamera,clampOrbitTarget,fitOrbitFootprint,closeOrbitDistance} from './orbit-camera';
import {estimatePhotoColors,type HousePhotoColors} from './photo-materials';
import {maskedWallPhotos,wallFaceKey} from './facade-wall-masks';
import {facadePhotoColors} from './facade-photo-colors';
import {lidarFacadeAnchor} from '../utils/facade-placement';
import type {HomeSunState} from '../services/home-3d-document';
import type {WallColorPatch} from '../services/facade-colors';
import {getHouseLidarModel,getParcelLidarModel,sampleParcelGround} from '../utils/homeLidarModel';
import type {PreparedScene} from '../services/property-model-format';
import {packGeometry,unpackGeometry} from './prepared-scene';
import {weatherAt,previewWeather,localClock} from '../services/home-weather';

type Config={geometry:HomeGeometry;heights:HomeHeights|null;texture:string|null;sun:SunState;photos:HomeModelPhotos|null;environment?:HomeEnvironment|null;prepared?:PreparedScene|null};
export type SunState=HomeSunState;
declare global{interface Window{HOME_MODEL:Config;HOME_MODEL_GZIP?:string;home3d:{update:(state:SunState)=>void;setPhotos:(photos:HomeModelPhotos|null)=>void;analyzeNeighborhood:(batch:NeighborhoodPhotoBatch|string)=>void;dispose:()=>void};ReactNativeWebView?:{postMessage:(value:string)=>void}}}
const send=(value:unknown)=>{const message=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage({home3d:JSON.parse(message)},'*');};
const inside=(rings:XY[][],x:number,y:number)=>{const inRing=(ring:XY[])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i]!,b=ring[j]!;if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};return inRing(rings[0]!)&&!rings.slice(1).some(inRing);};
function start(){
 const config=window.HOME_MODEL,g=config.geometry,h=config.heights;
 const environment=config.environment?.geometry.addressId===g.addressId?config.environment:null;
 const [left,bottom,right,top]=g.bbox,cx=(left+right)/2,cy=(bottom+top)/2,span=Math.max(right-left,top-bottom);
 const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
 function sample(values:(number|null)[],x:number,y:number,grid:HomeHeights|null=h){
   const h=grid;
   if(!h||x<h.bbox[0]||x>h.bbox[2]||y<h.bbox[1]||y>h.bbox[3])return null;
   const col=Math.max(0,Math.min(h.width-1,(x-h.bbox[0])/(h.bbox[2]-h.bbox[0])*h.width-0.5)),row=Math.max(0,Math.min(h.height-1,(h.bbox[3]-y)/(h.bbox[3]-h.bbox[1])*h.height-0.5));
   const x0=Math.floor(col),y0=Math.floor(row),x1=Math.min(x0+1,h.width-1),y1=Math.min(y0+1,h.height-1),fx=col-x0,fy=row-y0;
   const points=[[values[y0*h.width+x0],(1-fx)*(1-fy)],[values[y0*h.width+x1],fx*(1-fy)],[values[y1*h.width+x0],(1-fx)*fy],[values[y1*h.width+x1],fx*fy]] as const;
   let sum=0,weight=0;for(const [v,w]of points)if(finite(v)){sum+=v*w;weight+=w;}return weight>0.5?sum/weight:null;
 }
 const parcelLidar=getParcelLidarModel(g);
 const ground=(x:number,y:number)=>(parcelLidar&&parcelLidar.polygons.some(p=>inside(p,x,y))?sampleParcelGround(parcelLidar,x,y):null)??(h?sample(h.terrain,x,y):null)??(environment?.heights?sample(environment.heights.terrain,x,y,environment.heights):null);
 const mainLidar=g.buildings.filter(b=>b.main).map(b=>getHouseLidarModel(g,b)).find(Boolean);
 const origin=config.prepared?.origin??ground(cx,cy)??h?.terrain.find(finite)??mainLidar?.ground??0;
 const minimumTerrain=(environment?.heights?.terrain??[]).reduce<number>((minimum,value)=>finite(value)?Math.min(minimum,value):minimum,origin);
 const world=(p:XY,z:number)=>new THREE.Vector3(p[0]-cx,z-origin,cy-p[1]);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor('#eaf0f5');document.body.appendChild(renderer.domElement);renderer.domElement.style.touchAction='none';
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,0.1,span*15);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.08;const disposeOrbitTouch=configureOrbitCamera(controls);controls.maxDistance=span*2.8;controls.maxPolarAngle=Math.PI*0.47;controls.minPolarAngle=0.15;
 const constrainEnvironment=()=>{
  const mappedBounds=environment?.geometry.bbox??g.bbox;
  clampOrbitTarget(camera,controls,[mappedBounds[0]-cx,cy-mappedBounds[3],mappedBounds[2]-cx,cy-mappedBounds[1]]);
  if(!environment)return;
  const bounds=environment.geometry.bbox,halfFov=THREE.MathUtils.degToRad(camera.fov/2),diagonal=Math.atan(Math.tan(halfFov)*Math.hypot(1,camera.aspect));
  controls.maxPolarAngle=Math.min(Math.PI*.32,Math.PI/2-diagonal-.2);
  const radius=Math.min(bounds[2]-bounds[0],bounds[3]-bounds[1])*.45;
  const slack=Math.max(0,controls.target.y+origin-minimumTerrain+.1);
  const probe=new THREE.PerspectiveCamera(camera.fov,camera.aspect,.1,1000),offset=new THREE.Vector3(0,Math.cos(controls.maxPolarAngle),Math.sin(controls.maxPolarAngle));
  probe.position.copy(offset);probe.lookAt(0,0,0);probe.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();let distance=span*2.8;
  for(const horizontal of [-1,1])for(const vertical of [-1,1]){
   ray.setFromCamera(new THREE.Vector2(horizontal,vertical),probe);
   const direction=ray.ray.direction,ratio=new THREE.Vector2(direction.x,direction.z).divideScalar(-direction.y),extent=ratio.clone().multiplyScalar(offset.y).add(new THREE.Vector2(offset.x,offset.z));
   distance=Math.min(distance,(radius-slack*ratio.length())/extent.length());
  }
  controls.maxDistance=Math.max(1,distance);controls.minDistance=Math.min(closeOrbitDistance,controls.maxDistance*.7);
 };
 const lastOrbitTarget=new THREE.Vector3(Infinity,Infinity,Infinity);
 const framing=()=>Math.max(1,1.25/camera.aspect);
 const reset=()=>{controls.target.set(0,2,0);constrainEnvironment();camera.position.set(span*0.65,span*(parcelLidar?.terrain?0.48:0.8),span*0.85).sub(controls.target).multiplyScalar(framing()).add(controls.target);controls.update();};reset();
 // Neutral illumination: do not add a yellow/green cast to analysed wall colours.
 const ambient=new THREE.HemisphereLight('#ffffff','#b3b3b3',2);scene.add(ambient);
 const sunLight=new THREE.DirectionalLight('#ffffff',3);sunLight.castShadow=true;sunLight.shadow.mapSize.set(1536,1536);sunLight.shadow.camera.left=-span;sunLight.shadow.camera.right=span;sunLight.shadow.camera.top=span;sunLight.shadow.camera.bottom=-span;sunLight.shadow.camera.near=1;sunLight.shadow.camera.far=span*6;sunLight.shadow.normalBias=0.06;sunLight.shadow.bias=-0.00015;scene.add(sunLight);scene.add(sunLight.target);
 let floorGeometry:THREE.BufferGeometry;
 if(config.prepared)floorGeometry=unpackGeometry(config.prepared.floor);
 else if(config.sun.flatParcel){
  const vertices:number[]=[],uv:number[]=[];
  for(const parcel of g.parcels)for(const polygon of parcel.polygons){
  const rings=polygon.map(ring=>{const points=ring.map(point=>new THREE.Vector2(...point));if(points[0]?.equals(points[points.length-1]!))points.pop();return points;}),flat=rings.flat();
   for(const triangle of THREE.ShapeUtils.triangulateShape(rings[0]!,rings.slice(1)))for(const index of triangle){const point=flat[index]!;vertices.push(point.x-cx,-.04,cy-point.y);uv.push((point.x-left)/(right-left),(point.y-bottom)/(top-bottom));}
  }
  floorGeometry=new THREE.BufferGeometry();floorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));floorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 }
 else{floorGeometry=new THREE.PlaneGeometry(right-left,top-bottom,Math.min(128,parcelLidar?Math.ceil((right-left)/0.5):h?.width??1),Math.min(128,parcelLidar?Math.ceil((top-bottom)/0.5):h?.height??1));floorGeometry.rotateX(-Math.PI/2);}
 const positions=floorGeometry.attributes.position!;if(!config.prepared){if(!config.sun.flatParcel)for(let i=0;i<positions.count;i++){const x=cx+positions.getX(i),y=cy-positions.getZ(i);positions.setY(i,(ground(x,y)??origin)-origin-0.04);}floorGeometry.computeVertexNormals();}
 const fallbackColor=parcelLidar?.terrain?'#d2d8d1':'#d7e1d0';
 const floorMaterial=new THREE.MeshStandardMaterial({color:fallbackColor,roughness:1,side:THREE.DoubleSide});
 let groundTexture:THREE.Texture|null=null,environmentTexture:THREE.Texture|null=null,groundFallbackTexture:THREE.Texture|null=null;
 const neighbourRoofs:{material:THREE.MeshStandardMaterial;wide:boolean}[]=[];
 const applyNeighbourTextures=()=>{for(const roof of neighbourRoofs){const map=roof.wide?environmentTexture:groundTexture??groundFallbackTexture;if(map){roof.material.map=map;roof.material.color.set('#ffffff');roof.material.needsUpdate=true;}}};
 if(config.texture)new THREE.TextureLoader().load(config.texture,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());groundTexture=texture;applyNeighbourTextures();dirty=true;},undefined,()=>send({type:'texture-unavailable'}));
 else if(config.sun.aerial!==false)send({type:'texture-unavailable'});
 const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.name='parcel-aerial';floor.receiveShadow=true;scene.add(floor);
 let environmentFloor:THREE.Mesh|null=null;
 if(environment){
  let geometry:THREE.BufferGeometry;
  if(config.prepared?.environment)geometry=unpackGeometry(config.prepared.environment);
  else{
  const bounds=environment.geometry.bbox,grid=environment.heights;
  const localX=new Set<number>([left,right]),localY=new Set<number>([bottom,top]);
  for(let index=0;index<positions.count;index++){localX.add(cx+positions.getX(index));localY.add(cy-positions.getZ(index));}
  const columns=Math.min(128,grid?.width??32),rows=Math.min(128,grid?.height??32);
  const xs=[...new Set([...Array.from({length:columns+1},(_,index)=>bounds[0]+index/columns*(bounds[2]-bounds[0])),...localX])].sort((first,second)=>first-second);
  const ys=[...new Set([...Array.from({length:rows+1},(_,index)=>bounds[1]+index/rows*(bounds[3]-bounds[1])),...localY])].sort((first,second)=>first-second);
  const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
  for(const north of ys)for(const east of xs){vertices.push(east-cx,(ground(east,north)??origin)-origin-.04,cy-north);uv.push((east-bounds[0])/(bounds[2]-bounds[0]),(north-bounds[1])/(bounds[3]-bounds[1]));}
  for(let row=0;row<ys.length-1;row++)for(let col=0;col<xs.length-1;col++){
   const east=(xs[col]!+xs[col+1]!)/2,north=(ys[row]!+ys[row+1]!)/2;
   if(east>left&&east<right&&north>bottom&&north<top)continue;
   const base=row*xs.length+col;indices.push(base,base+1,base+xs.length,base+1,base+xs.length+1,base+xs.length);
  }
  geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  }
  const bounds=environment.geometry.bbox;
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,side:THREE.DoubleSide});
  new THREE.TextureLoader().load(environment.texture,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());environmentTexture=texture;material.map=texture;material.needsUpdate=true;if(left>=bounds[0]&&right<=bounds[2]&&bottom>=bounds[1]&&top<=bounds[3]){groundFallbackTexture=texture.clone();groundFallbackTexture.repeat.set((right-left)/(bounds[2]-bounds[0]),(top-bottom)/(bounds[3]-bounds[1]));groundFallbackTexture.offset.set((left-bounds[0])/(bounds[2]-bounds[0]),(bottom-bounds[1])/(bounds[3]-bounds[1]));groundFallbackTexture.needsUpdate=true;}applyNeighbourTextures();dirty=true;},undefined,()=>send({type:'environment-unavailable'}));
  environmentFloor=new THREE.Mesh(geometry,material);environmentFloor.name='neighbourhood-ground';environmentFloor.receiveShadow=true;scene.add(environmentFloor);
 }
 const terrain=config.prepared?.terrain?(()=>{const material=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,side:THREE.DoubleSide}),mesh=new THREE.Mesh(unpackGeometry(config.prepared.terrain.geometry),material),contours=new THREE.LineSegments(unpackGeometry(config.prepared.terrain.contours),new THREE.LineBasicMaterial({color:'#68765e',transparent:true,opacity:.5,depthWrite:false}));mesh.receiveShadow=true;mesh.userData.photoGround=true;return {mesh,material,contours};})():!config.sun.flatParcel&&parcelLidar?.terrain?terrainMesh(parcelLidar.terrain,cx,cy,origin,g.bbox):null;
 if(terrain){scene.add(terrain.mesh);scene.add(terrain.contours);}
 for(const parcel of g.parcels)for(const polygon of parcel.polygons)for(const ring of polygon){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(p=>world(p,(config.sun.flatParcel?origin:ground(...p)??origin)+0.03))),new THREE.LineDashedMaterial({color:'#ffffff',dashSize:0.7,gapSize:0.45,depthTest:true}));line.computeLineDistances();scene.add(line);}
 let measuredBuildings=0,estimatedBuildings=0,mainMeasured=false,lidarBuildings=0;
 floor.userData.photoGround=true;
 const allMeshes:THREE.Mesh[]=[floor],photoMeshes:THREE.Mesh[]=[floor];
 if(environmentFloor)allMeshes.push(environmentFloor);
 if(terrain){allMeshes.push(terrain.mesh);photoMeshes.push(terrain.mesh);}
 const buildings=[...g.buildings,...(environment?.geometry.buildings??[]).filter(building=>!g.buildings.some(existing=>existing.id===building.id))];
 if(config.prepared)for(const saved of config.prepared.buildings){const mesh=new THREE.Mesh(unpackGeometry(saved.geometry),new THREE.MeshStandardMaterial({color:saved.color,roughness:.9,side:THREE.DoubleSide}));if(saved.surface)mesh.userData.houseSurface=saved.surface;if(saved.roofBuildingId||saved.surface?.kind==='roof'||saved.neighbour||!saved.surface&&!saved.brickwork&&!isWallGeometry(mesh.geometry))mesh.userData.roofBuildingId=saved.roofBuildingId??(saved.surface?.kind==='roof'?saved.surface.id:matchSavedRoof(mesh.geometry,buildings,cx,cy));if(saved.brickwork||saved.surface?.kind==='walls'||!saved.surface&&!saved.neighbour&&isWallGeometry(mesh.geometry))applyBrickwork(mesh.material);if(saved.neighbour){mesh.userData.neighbourRoof=true;neighbourRoofs.push({material:mesh.material,wide:!!saved.wide});}mesh.castShadow=!!saved.surface;mesh.receiveShadow=true;scene.add(mesh);allMeshes.push(mesh);if(saved.surface)photoMeshes.push(mesh);}
 else for(const building of buildings){
   if(config.sun.flatParcel&&!building.main&&!building.associated)continue;
   const lidar=getHouseLidarModel(g,building);
   if(lidar){
    for(const [vertices,color,kind]of [[lidar.roof,'#858782','roof'],[lidar.walls,'#c2c6ca','walls']] as const){
     const positions=vertices.map((v,i)=>i%3===0?v-cx:i%3===1?vertices[i+1]!-origin:cy-vertices[i-1]!);
     const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
     const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:0.9,side:THREE.DoubleSide}));mesh.userData.houseSurface={id:building.id,kind,neutral:color,associated:!building.main&&building.associated};if(kind==='roof')mesh.userData.roofBuildingId=building.id;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);allMeshes.push(mesh);if(building.main||building.associated)photoMeshes.push(mesh);
    }
    measuredBuildings++;lidarBuildings++;if(building.main)mainMeasured=true;continue;
   }
   const rings=building.rings.map((r,i)=>{const ring=r.slice(0,-1);const signed=ring.reduce((sum,p,n)=>{const q=ring[(n+1)%ring.length]!;return sum+p[0]*q[1]-q[0]*p[1];},0);return (i===0?signed<0:signed>0)?ring.reverse():ring;});
   if(!rings[0]?.length)continue;
   const flat=rings.flat(),groundValues=flat.map(p=>ground(...p)).filter(finite).sort((a,b)=>a-b),base=groundValues[Math.floor(groundValues.length/2)]??origin;
  const raster=h&&flat.every(point=>point[0]>=h.bbox[0]&&point[0]<=h.bbox[2]&&point[1]>=h.bbox[1]&&point[1]<=h.bbox[3])?h:environment?.heights??h;
  const reference=flat.map(p=>raster?sample(raster.surface,...p,raster):null);
  const measured=!!raster&&reference.filter(finite).length>=flat.length*0.8;
   if(measured){measuredBuildings++;if(building.main)mainMeasured=true;}else estimatedBuildings++;
   // Smooth only nearby roof samples inside the actual footprint; never use
   // absolute survey Z as a height above ground. Overhanging vegetation may
   // still affect DSM values inside a footprint; the UI states this limit.
   function roof(p:XY){
    if(!measured||!raster)return base+building.height;
    const [west,south,east,north]=raster.bbox,col=Math.floor((p[0]-west)/(east-west)*raster.width),row=Math.floor((north-p[1])/(north-south)*raster.height),samples:number[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const c=col+dx,r=row+dy;if(c<0||r<0||c>=raster.width||r>=raster.height)continue;const x=west+(c+0.5)*(east-west)/raster.width,y=north-(r+0.5)*(north-south)/raster.height,v=raster.surface[r*raster.width+c];if(finite(v)&&inside(building.rings,x,y)&&v>base+0.8&&v<base+80)samples.push(v);}
    samples.sort((a,b)=>a-b);return samples[Math.floor(samples.length/2)]??sample(raster.surface,...p,raster)??base+building.height;
   }
   const roofPositions:number[]=[],wallPositions:number[]=[];
   const vector=(p:XY,z:number)=>[p[0]-cx,z-origin,cy-p[1]];
   function triangle(a:XY,b:XY,c:XY,depth=0){
     const longest=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(a[0]-c[0],a[1]-c[1]),Math.hypot(b[0]-c[0],b[1]-c[1]));
    if(measured&&longest>Math.max(0.8,...raster!.resolution)*1.5&&depth<6&&roofPositions.length<180000){const mid=(p:XY,q:XY):XY=>[(p[0]+q[0])/2,(p[1]+q[1])/2],ab=mid(a,b),ac=mid(a,c),bc=mid(b,c);triangle(a,ab,ac,depth+1);triangle(ab,b,bc,depth+1);triangle(ac,bc,c,depth+1);triangle(ab,bc,ac,depth+1);return;}
     roofPositions.push(...vector(a,roof(a)),...vector(b,roof(b)),...vector(c,roof(c)));
   }
   const contour=rings[0]!.map(p=>new THREE.Vector2(...p)),holes=rings.slice(1).map(r=>r.map(p=>new THREE.Vector2(...p)));
   for(const [a,b,c]of THREE.ShapeUtils.triangulateShape(contour,holes))triangle(flat[a!]!,flat[b!]!,flat[c!]!);
   for(const ring of rings)for(let i=0;i<ring.length;i++){
     const a=ring[i]!,b=ring[(i+1)%ring.length]!,steps=Math.min(128,Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/0.8)));
     for(let step=0;step<steps;step++){const lerp=(t:number):XY=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],p=lerp(step/steps),q=lerp((step+1)/steps),pb=vector(p,ground(...p)??base),qb=vector(q,ground(...q)??base),pt=vector(p,roof(p)),qt=vector(q,roof(q));wallPositions.push(...pb,...qb,...qt,...pb,...qt,...pt);}
   }
   for(const [vertices,color,kind]of [[roofPositions,building.main?'#858782':'#b0bbc2','roof'],[wallPositions,'#c2c6ca','walls']] as const){const meshGeometry=new THREE.BufferGeometry();meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));meshGeometry.computeVertexNormals();const mesh=new THREE.Mesh(meshGeometry,new THREE.MeshStandardMaterial({color,roughness:0.9,side:THREE.DoubleSide}));
    if(!building.main&&!building.associated&&kind==='roof'){
     const contained=(bounds:number[])=>flat.every(point=>point[0]>=bounds[0]!&&point[0]<=bounds[2]!&&point[1]>=bounds[1]!&&point[1]<=bounds[3]!);
     const wide=!contained(g.bbox),bounds=wide?environment?.geometry.bbox:g.bbox;
     if(bounds&&contained(bounds)){
      const uv:number[]=[];for(let index=0;index<vertices.length;index+=3)uv.push((vertices[index]!+cx-bounds[0])/(bounds[2]-bounds[0]),(cy-vertices[index+2]!-bounds[1])/(bounds[3]-bounds[1]));
      meshGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh.userData.neighbourRoof=true;neighbourRoofs.push({material:mesh.material,wide});
     }
    }
    if(kind==='roof')mesh.userData.roofBuildingId=building.id;
    if(kind==='walls'||building.main||building.associated)mesh.userData.houseSurface={id:building.id,kind,neutral:color,associated:!building.main&&building.associated};mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);allMeshes.push(mesh);if(building.main||building.associated)photoMeshes.push(mesh);}
 }
 applyNeighbourTextures();
 const sunMesh=solarDisc(span);scene.add(sunMesh);
 const sky=atmosphericSky(scene,span);
 const celestial=nightSky(scene,span,()=>{dirty=true;});
 // DSM vegetation is used conservatively for photo visibility, not shown as
 // fabricated trees. Do not cover the building itself with its raster roof.
 for(const mesh of allMeshes)if(mesh.userData.houseSurface?.kind==='walls')applyBrickwork(mesh.material as THREE.MeshStandardMaterial);
 let roofMaterials={...(config.prepared?.roofMaterials??{}),...Object.fromEntries(buildings.filter(b=>b.roofMaterial).map(b=>[b.id,b.roofMaterial!]))};
 function updateRoofMaterials(next:HomeSunState['roofMaterials']){if(next)roofMaterials={...roofMaterials,...next};for(const mesh of allMeshes){const id=mesh.userData.roofBuildingId;if(id)applyRoofAppearance(mesh.material as THREE.MeshStandardMaterial,roofMaterials[id]);}}
 updateRoofMaterials(config.sun.roofMaterials);
 const buildingRenderMeshes=allMeshes.filter(mesh=>mesh!==floor&&mesh!==terrain?.mesh&&mesh!==environmentFloor);
 // Batch static neighbours on the saved viewing path; preparation retains
 // separate meshes for exact photo visibility and facade identification.
 if(config.prepared){const batches=new Map<string,THREE.Mesh[]>();for(const mesh of buildingRenderMeshes){if(mesh.userData.houseSurface||mesh.userData.roofBuildingId)continue;const material=mesh.material as THREE.MeshStandardMaterial,key=(material.userData.brickwork?'brick:':'plain:')+material.color.getHexString()+':'+Object.keys(mesh.geometry.attributes).sort().join(',')+':'+(neighbourRoofs.find(r=>r.material===material)?.wide??false);const batch=batches.get(key)??[];batch.push(mesh);batches.set(key,batch);}for(const batch of batches.values()){if(batch.length<2)continue;const geometries=batch.map(mesh=>mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()),merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!merged)continue;const first=batch[0]!,mesh=new THREE.Mesh(merged,first.material);mesh.receiveShadow=true;for(const old of batch){scene.remove(old);allMeshes.splice(allMeshes.indexOf(old),1);buildingRenderMeshes.splice(buildingRenderMeshes.indexOf(old),1);old.geometry.dispose();}scene.add(mesh);allMeshes.push(mesh);buildingRenderMeshes.push(mesh);}}
 const weatherEffects=modelWeather(scene,span,buildingRenderMeshes,config.prepared?.weatherCeiling);
 let vegetationMesh:THREE.Mesh|null=null;
 if(!config.sun.flatParcel&&parcelLidar?.vegetation&&config.sun.vegetationVisible){const source=parcelLidar.vegetation,positions:number[]=[];
  for(let i=0;i<source.vertices.length;i+=3)positions.push(source.vertices[i]!-cx,source.vertices[i+2]!-origin,cy-source.vertices[i+1]!);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(source.indices);geometry.computeVertexNormals();
  vegetationMesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#4b8153',roughness:1,side:THREE.DoubleSide}));vegetationMesh.receiveShadow=true;scene.add(vegetationMesh);allMeshes.push(vegetationMesh);
 }
 let parcelCloud:THREE.Points|null=null;
 if(!config.sun.flatParcel&&parcelLidar&&config.sun.lidarMode!=='model'&&config.sun.lidarMode!==undefined){
  const positions:number[]=[],colors:number[]=[];
  for(let i=0;i<parcelLidar.points.length;i+=4){const [x,y,z,c]=parcelLidar.points.slice(i,i+4) as [number,number,number,number];positions.push(x-cx,z-origin,cy-y);const color=new THREE.Color(c===2?'#987450':c===6?'#e57852':c>=3&&c<=5?'#309666':'#577fa4');colors.push(color.r,color.g,color.b);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  parcelCloud=new THREE.Points(geometry,new THREE.PointsMaterial({size:2.5,sizeAttenuation:false,vertexColors:true}));parcelCloud.visible=false;scene.add(parcelCloud);
 }
 let vegetationOcclusion:THREE.Mesh|null=null;
 if(h&&!config.prepared){const vertices:number[]=[];for(let row=0;row<h.height-1;row++)for(let col=0;col<h.width-1;col++){
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
 let materialColors:HousePhotoColors=config.prepared?.colors??{},maskRequestId='',wallPatches:WallColorPatch[]=[],appliedPalette:HomeSunState['wallPalette'];
 let analysisFinished=!!config.prepared;
 let neighborColorCoverage:PreparedScene['neighborColorCoverage'];
 function exportPrepared(){if(!analysisFinished)return;const prepared=config.prepared?{...config.prepared,roofMaterials}:{roofMaterials,origin,floor:packGeometry(floor.geometry),environment:environmentFloor?packGeometry(environmentFloor.geometry):undefined,terrain:terrain?{geometry:packGeometry(terrain.mesh.geometry),contours:packGeometry(terrain.contours.geometry)}:undefined,buildings:buildingRenderMeshes.map(mesh=>({geometry:packGeometry(mesh.geometry),roofBuildingId:mesh.userData.roofBuildingId,brickwork:(mesh.material as THREE.MeshStandardMaterial).userData.brickwork||undefined,color:'#'+(mesh.material as THREE.MeshStandardMaterial).color.getHexString(),surface:mesh.userData.houseSurface?.kind==='walls'&&!g.buildings.some(b=>b.id===mesh.userData.houseSurface.id&&(b.main||b.associated))&&!materialColors[mesh.userData.houseSurface.id]?.walls?undefined:mesh.userData.houseSurface,neighbour:!!mesh.userData.neighbourRoof,wide:neighbourRoofs.find(r=>r.material===mesh.material)?.wide})),weatherCeiling:weatherEffects.ceiling,colors:materialColors,automatic,neighborColorCoverage} satisfies PreparedScene;send({type:'prepared-model',addressId:g.addressId,model:{version:1,addressId:g.addressId,createdAt:Date.now(),geometry:g,heights:h,environment,texture:config.texture,scene:prepared,sceneEdits:state.sceneEdits??defaultSceneEdits(),facades:state.facades??[]}});}
 function applyWallPalette(){
  const palette=state.wallPalette;if(!palette||palette===appliedPalette||palette.requestId!==maskRequestId)return;appliedPalette=palette;
  for(const building of palette.analysis.buildings){if(!building.regions.length)continue;
   const patches=wallPatches.filter(p=>p.buildingId===building.id),evidence=patches.filter(p=>building.regions.some(r=>r.patchIds.includes(p.id)));
   if(new Set(evidence.map(p=>p.viewId)).size<2)continue;
   const faces:Record<string,string>={};for(const region of building.regions)for(const id of region.faceIds)if(patches.some(p=>p.faceId===id))faces[id]=region.color;
   (materialColors[building.id]??={}).walls={color:building.regions[0]!.color,uniform:building.uniform,faces,samples:evidence.reduce((n,p)=>n+p.pixels,0),views:new Set(evidence.map(p=>p.viewId)).size,confidence:building.regions.some(r=>r.confidence==='low')?'low':'medium',years:[...new Set(evidence.map(p=>p.year))]};
  }
  dirty=true;send({type:'material-colors',colors:materialColors});
 }
 const openingPixels=new Map<string,PhotoPixels>();let pixelRevision=0;
 const photoProjection=projectedPhotos(renderer,allMeshes,photoMeshes,cx,cy,origin,()=>{dirty=true;},count=>{if(!count){materialColors={};send({type:'material-colors',colors:{}});}send({type:'photo-ready',count});},async(items,alive)=>{
  openingPixels.clear();for(const item of items){try{const image=item.image.image as HTMLImageElement,canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true})!;context.imageSmoothingEnabled=false;context.drawImage(image,0,0);openingPixels.set(item.photo.image,context.getImageData(0,0,canvas.width,canvas.height));}catch{/* Neutral frame until original pixels are available. */}}
  if(alive()){pixelRevision++;refreshFacades();}
  maskRequestId='';wallPatches=[];appliedPalette=undefined;
  let result:HousePhotoColors={};try{scene.updateMatrixWorld(true);result=await estimatePhotoColors(items,buildingRenderMeshes,allMeshes,cx,cy,origin,alive);}catch{/* Keep neutral materials when photo interpretation is unavailable. */}if(!alive())return;materialColors=result;dirty=true;send({type:'material-colors',colors:result});
  wallPatches=await maskedWallPhotos(renderer,items,buildingRenderMeshes,allMeshes,cx,cy,origin,alive,new Set(g.buildings.filter(b=>b.main).map(b=>b.id)));if(!alive())return;
  const wallColors=await facadePhotoColors(wallPatches,alive,new Set(g.buildings.filter(b=>!b.main&&b.associated).map(b=>b.id)));if(!alive())return;
  for(const [id,colors]of Object.entries(wallColors))materialColors[id]={...materialColors[id],...colors};
  dirty=true;send({type:'material-colors',colors:materialColors});
  analysisFinished=true;exportPrepared();
 },config.sun.photographic!==false);

 let neighborQueue=Promise.resolve();const neighborRequests=new Set<string>();
 function analyzeNeighborhood(encoded:NeighborhoodPhotoBatch|string){
  let batch:NeighborhoodPhotoBatch;try{batch=typeof encoded==='string'?JSON.parse(strFromU8(gunzipSync(unbase64(encoded)))):encoded;}catch{return;}
  if(!batch||batch.addressId!==g.addressId||typeof batch.requestId!=='string'||batch.requestId.length>100||neighborRequests.has(batch.requestId)||neighborRequests.size>128||!Array.isArray(batch.photos)||batch.photos.length>4||!Array.isArray(batch.buildingIds)||batch.buildingIds.length>1000)return;
  neighborRequests.add(batch.requestId);
  neighborQueue=neighborQueue.then(async()=>{
   const textures:THREE.Texture[]=[];
   try{
    if(config.prepared||disposed)throw Error('Husmodellen skal opdateres først.');
    if(batch.complete){neighborColorCoverage=batch.coverage;exportPrepared();}
    else{
     const items=[];for(const photo of batch.photos){if(!aliveNeighbor())return;const image=await new THREE.TextureLoader().loadAsync(photo.image);textures.push(image);items.push({photo,image});}
     const wanted=new Set(batch.buildingIds),targets=buildingRenderMeshes.filter(m=>m.userData.houseSurface?.kind==='walls'&&wanted.has(m.userData.houseSurface.id)&&!g.buildings.some(b=>b.main&&b.id===m.userData.houseSurface.id));
     scene.updateMatrixWorld(true);const patches=await maskedWallPhotos(renderer,items,targets,allMeshes,cx,cy,origin,aliveNeighbor);
     const colors=await facadePhotoColors(patches,aliveNeighbor);if(!aliveNeighbor())return;
     for(const [id,value]of Object.entries(colors))if(wanted.has(id))materialColors[id]={...materialColors[id],...value};
     dirty=true;send({type:'material-colors',colors:materialColors});
    }
    send({type:'neighbor-colors-ready',requestId:batch.requestId});
   }catch(error){send({type:'neighbor-colors-ready',requestId:batch.requestId,error:error instanceof Error?error.message:'Naboanalyse fejlede.'});}
   finally{for(const texture of textures)texture.dispose();}
  });
 }
 const aliveNeighbor=()=>!disposed;
 let currentPhotos:HomeModelPhotos|null=null,openingPhotoSignature='';
 const setPhotos=(photos:HomeModelPhotos|null)=>{if(config.prepared)return;currentPhotos=photos?.addressId===g.addressId?photos:null;const signature=JSON.stringify(currentPhotos);if(signature===openingPhotoSignature)return;openingPhotoSignature=signature;openingPixels.clear();pixelRevision++;photoProjection.setPhotos(currentPhotos);refreshFacades();};
 let highlight:THREE.Mesh|null=null,highlightId='';
 function captureHighlight(face:HousePhotoFace|null|undefined){
  if((face?.id??'')===highlightId)return;highlightId=face?.id??'';
  if(highlight){scene.remove(highlight);highlight.geometry.dispose();(highlight.material as THREE.Material).dispose();highlight=null;}
  if(!face)return;
  const building=g.buildings.find(b=>b.id===face.buildingId),anchor=building?lidarFacadeAnchor(face,getHouseLidarModel(g,building)):null;
  const baseA=anchor?.base??ground(...face.a)??origin,baseB=anchor?.base??ground(...face.b)??origin;
  const roofA=anchor?anchor.base+anchor.height:h?sample(h.surface,...face.a):null,roofB=anchor?anchor.base+anchor.height:h?sample(h.surface,...face.b):null;
  const a=world(face.a,baseA),b=world(face.b,baseB),at=world(face.a,roofA&&roofA>baseA+1?roofA:baseA+face.height),bt=world(face.b,roofB&&roofB>baseB+1?roofB:baseB+face.height);
  const geometry=new THREE.BufferGeometry().setFromPoints([a,b,bt,a,bt,at]);geometry.computeVertexNormals();
  highlight=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#2583ff',transparent:true,opacity:0.65,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));highlight.renderOrder=20;scene.add(highlight);
  const dx=face.b[0]-face.a[0],dy=face.b[1]-face.a[1],length=Math.hypot(dx,dy),mid=a.clone().add(b).multiplyScalar(0.5);mid.y+=(face.height/2);
  controls.target.copy(mid);constrainEnvironment();const distance=Math.max(face.length*1.7,span*0.45);camera.position.copy(mid).add(new THREE.Vector3(dy/length*distance,distance*0.38,dx/length*distance));controls.update();dirty=true;
 }
 const facadeGroups=new Map<string,{key:string;group:THREE.Group}>();
 function updateFacades(models:FacadeModel[]=[]){
  const activeIds=new Set(models.map(m=>m.face.id));
  for(const [id,item]of facadeGroups)if(!activeIds.has(id)){scene.remove(item.group);disposeFacade(item.group);facadeGroups.delete(id);}
  for(const model of models){const face=model.face,key=JSON.stringify([model,state.sceneEdits]);if(facadeGroups.get(face.id)?.key===key)continue;
   const prior=facadeGroups.get(face.id);if(prior){scene.remove(prior.group);disposeFacade(prior.group);facadeGroups.delete(face.id);}
   const dx=(face.b[0]-face.a[0])/face.length,dy=(face.b[1]-face.a[1])/face.length;
   const count=Math.max(3,Math.ceil(face.length/0.5));
   const samples=Array.from({length:count},(_,i)=>{const t=i/(count-1),x=face.a[0]+dx*face.length*t,y=face.a[1]+dy*face.length*t;return {ground:ground(x,y)??origin,roof:h?sample(h.surface,x,y):null};});
   const building=g.buildings.find(b=>b.id===face.buildingId),anchor=building?lidarFacadeAnchor(face,getHouseLidarModel(g,building)):null;
   const base=model.anchor?.base??anchor?.base??Math.max(...samples.map(s=>s.ground)),tops=samples.map(s=>s.roof).filter((v):v is number=>finite(v)&&v>base+1);
   const height=model.anchor?.height??anchor?.height??Math.max(0,Math.min(face.height,tops.length?Math.min(...tops)-base:face.height));if(height<1)continue;
   const group=buildFacade(model,height,state.sceneEdits);group.position.copy(world(face.a,base));group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(dx,0,-dy),new THREE.Vector3(0,1,0),new THREE.Vector3(dy,0,dx)));scene.add(group);facadeGroups.set(face.id,{key,group});dirty=true;
  }
 }
 let automatic:FacadeModel[]=config.prepared?.automatic??[],lastDetections:SunState['aerialOpenings'],lastPhotos:HomeModelPhotos|null=null,lastPixelRevision=-1,plinthKey='';
 const plinth=new THREE.Group();scene.add(plinth);
 function faceAnchor(face:HousePhotoFace){const building=g.buildings.find(b=>b.id===face.buildingId),measured=building?lidarFacadeAnchor(face,getHouseLidarModel(g,building)):null;if(measured)return measured;const count=Math.max(3,Math.ceil(face.length/.5)),samples=Array.from({length:count},(_,i)=>{const t=i/(count-1),x=face.a[0]+(face.b[0]-face.a[0])*t,y=face.a[1]+(face.b[1]-face.a[1])*t;return {ground:ground(x,y)??origin,roof:h?sample(h.surface,x,y):null};}),base=Math.max(...samples.map(s=>s.ground)),tops=samples.map(s=>s.roof).filter((v):v is number=>finite(v)&&v>base+1);return {base,height:Math.max(0,Math.min(face.height,tops.length?Math.min(...tops)-base:face.height))};}
 function refreshFacades(){
  if(!config.prepared&&(lastDetections!==state.aerialOpenings||lastPhotos!==currentPhotos||lastPixelRevision!==pixelRevision)){scene.updateMatrixWorld(true);automatic=aerialFacades(g,currentPhotos,state.aerialOpenings,buildingRenderMeshes,cx,cy,origin,faceAnchor,openingPixels);lastDetections=state.aerialOpenings;lastPhotos=currentPhotos;lastPixelRevision=pixelRevision;send({type:'openings-ready',count:automatic.reduce((n,m)=>n+m.analysis.openings.length,0)});}
  const manual=state.facades??[],manualIds=new Set(manual.map(m=>m.face.id));updateFacades([...automatic.filter(m=>!manualIds.has(m.face.id)),...manual]);
  const settings=state.sceneEdits?.plinth??defaultSceneEdits().plinth,key=JSON.stringify(settings);if(key!==plinthKey){plinthKey=key;disposeFacade(plinth);plinth.clear();
   if(settings.height>0)for(const f of housePhotoFaces(g)){const a=faceAnchor(f),dx=(f.b[0]-f.a[0])/f.length,dy=(f.b[1]-f.a[1])/f.length,mesh=new THREE.Mesh(new THREE.BoxGeometry(f.length,settings.height,.035),new THREE.MeshStandardMaterial({color:settings.color,roughness:1}));mesh.position.copy(world([(f.a[0]+f.b[0])/2+dy*.02,(f.a[1]+f.b[1])/2-dx*.02],a.base+settings.height/2));mesh.rotation.y=Math.atan2(dy,dx);mesh.receiveShadow=true;plinth.add(mesh);}
  }
  dirty=true;
 }
 const editor=openingEditor(renderer.domElement,camera,controls,()=>!state.cameraMode||state.cameraMode==='orbit'?[...facadeGroups.values()].map(v=>v.group):[],()=>state.sceneEdits??defaultSceneEdits(),value=>{state={...state,sceneEdits:value};send({type:'scene-edits',sceneEdits:value,addressId:g.addressId});},refreshFacades);
 const sceneDate=()=>{const index=Math.min(95,Math.floor(minute/15)),fraction=minute/15-index;return new Date(state.live?Date.now():state.timestamps?state.timestamps[index]!+(state.timestamps[index+1]!-state.timestamps[index]!)*fraction:Date.now());};
 const observerCamera=groundCamera(camera,controls,renderer.domElement,point=>{
  camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();ray.setFromCamera(point,camera);
  const surfaces=[floor,...(terrain?[terrain.mesh]:[]),...(environmentFloor?[environmentFloor]:[])];
  const hit=ray.intersectObjects([...surfaces,...buildingRenderMeshes],false)[0];
  if(!hit||!surfaces.includes(hit.object as THREE.Mesh))return null;
  const x=cx+hit.point.x,y=cy-hit.point.z;
  if(!g.parcels.some(parcel=>parcel.polygons.some(polygon=>inside(polygon,x,y))))return null;
  for(const building of buildings){
   if(inside(building.rings,x,y))return null;
   for(const ring of building.rings)for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!,dx=b[0]-a[0],dy=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
    if(Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<.5)return null;
   }
  }
  return hit.point;
 },(cameraMode,message)=>{state={...state,cameraMode};dirty=true;send({type:'camera-mode',cameraMode,message});});
 observerCamera.setMode(state.cameraMode??'orbit');
 let editSignature=JSON.stringify(state.sceneEdits),openingSignature=JSON.stringify(state.aerialOpenings);
 function update(next:SunState){updateRoofMaterials(next.roofMaterials);const cameraChanged=next.cameraMode!==state.cameraMode;if(next.vectors!==state.vectors&&JSON.stringify(next.vectors)!==JSON.stringify(state.vectors))sunPath(next.vectors);if(next.minute!==state.minute||!next.playing||!state.playing)minute=next.minute;const edits=JSON.stringify(next.sceneEdits),openings=JSON.stringify(next.aerialOpenings),save=edits!==editSignature||openings!==openingSignature;editSignature=edits;openingSignature=openings;state=next;if(cameraChanged){editor.cancel();observerCamera.setMode(next.cameraMode??'orbit');if(next.cameraMode!=='ground')constrainEnvironment();}if(next.reset)reset();captureHighlight(next.captureFace);refreshFacades();if(save){renderer.shadowMap.needsUpdate=true;exportPrepared();}if(highlight)highlight.visible=!next.facades?.some(m=>m.face.id===highlightId);dirty=true;if(state.active&&!raf){last=0;raf=requestAnimationFrame(loop);}}
 let visualAt=0,liveSecond=-1,weatherStamp='',shadowAt=-Infinity;
 function loop(now:number){
   raf=0;if(disposed||document.hidden||!state.active)return;
  if(now-visualAt<1000/30){raf=requestAnimationFrame(loop);return;}visualAt=now;
  const elapsed=last?Math.max(0,(now-last)/1000):0,dt=Math.min(0.05,elapsed);last=now;
  if(state.live){const second=Math.floor(Date.now()/1000);if(second!==liveSecond){liveSecond=second;minute=localClock(new Date()).minute;dirty=true;}}
   if(state.playing){minute=(minute+dt*10)%1440;dirty=true;}
  const weather=state.live?(state.forecast?previewWeather(state.weatherMode??'live',weatherAt(state.forecast,Date.now(),true)):state.weather??null):state.weatherTimeline?state.weatherTimeline[Math.min(95,Math.floor(minute/15))]??null:state.weather??null;
  const stamp=JSON.stringify(weather);if(stamp!==weatherStamp){weatherStamp=stamp;dirty=true;}
  if(weatherEffects.update(elapsed,weather,state.reducedMotion===true))dirty=true;
  if(!state.reducedMotion&&(weather?.cloud??0)>0)dirty=true;
   if(state.cameraMode!=='ground'&&!controls.target.equals(lastOrbitTarget)){constrainEnvironment();lastOrbitTarget.copy(controls.target);}
   const cameraChanged=observerCamera.update();
  if(environment&&state.cameraMode!=='ground'){
  const bounds=environment.geometry.bbox,minimum=minimumTerrain-origin-2;
   camera.updateMatrixWorld(true);const hits:THREE.Vector3[]=[];
   for(const horizontal of [-1,1])for(const vertical of [-1,1]){const ray=new THREE.Vector3(horizontal,vertical,.5).unproject(camera).sub(camera.position).normalize();if(ray.y>=0)continue;hits.push(camera.position.clone().addScaledVector(ray,(minimum-camera.position.y)/ray.y));}
   if(fitOrbitFootprint(camera,controls,hits,[bounds[0]-cx+5,cy-bounds[3]+5,bounds[2]-cx-5,cy-bounds[1]-5])){camera.updateMatrixWorld(true);dirty=true;}
  }
   if(dirty||cameraChanged){
     for(const mesh of buildingRenderMeshes){const surface=mesh.userData.houseSurface;if(surface){const estimate=state.photoColors!==false?materialColors[surface.id]?.[surface.kind as 'roof'|'walls']:undefined,material=mesh.material as THREE.MeshStandardMaterial;
      if(surface.kind==='walls'&&estimate){
       if(mesh.userData.wallColorEstimate!==estimate){
        if(mesh.geometry.index){const old=mesh.geometry;mesh.geometry=old.toNonIndexed();old.dispose();}
        const count=mesh.geometry.getAttribute('position').count,rgb=new Float32Array(count*3);
        for(let triangle=0;triangle<count/3;triangle++){const color=new THREE.Color(estimate.uniform?estimate.color:estimate.faces?.[wallFaceKey(mesh,triangle)]??surface.neutral);for(let v=0;v<3;v++)color.toArray(rgb,(triangle*3+v)*3);}
        mesh.geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));mesh.userData.wallColorEstimate=estimate;
       }
       if(!material.vertexColors){material.vertexColors=true;material.needsUpdate=true;}material.color.set('#ffffff');
      }else{if(material.vertexColors){material.vertexColors=false;material.needsUpdate=true;}material.color.set(estimate?.color??surface.neutral);}
     }}
    const pointsOnly=state.lidarMode==='points'&&state.cameraMode!=='ground';if(parcelCloud)parcelCloud.visible=state.cameraMode!=='ground'&&(state.lidarMode==='points'||state.lidarMode==='both');
     floor.visible=!pointsOnly;for(const mesh of buildingRenderMeshes)mesh.visible=!pointsOnly;
    if(environmentFloor)environmentFloor.visible=!pointsOnly;
    for(const object of scene.children)if((object instanceof THREE.Line&&!(object instanceof THREE.LineSegments))||object instanceof THREE.Sprite)object.visible=state.cameraMode!=='ground';
     if(terrain){terrain.mesh.visible=!pointsOnly;terrain.contours.visible=!pointsOnly&&state.terrainContours!==false;}
     if(vegetationMesh){vegetationMesh.visible=!pointsOnly&&state.vegetationVisible===true;vegetationMesh.castShadow=state.vegetationShadows===true;}
      for(const item of facadeGroups.values())item.group.visible=!pointsOnly;
      plinth.visible=!pointsOnly;
     photoProjection.setEnabled(state.photographic!==false);
    photoProjection.setGroundEnabled(!state.flatParcel&&state.aerial!==false);
    const map=state.aerial===false?null:groundTexture??groundFallbackTexture;if(floorMaterial.map!==map){floorMaterial.map=map;floorMaterial.color.set(map?'#ffffff':fallbackColor);floorMaterial.needsUpdate=true;}
     if(terrain&&(terrain.material.map!==map||terrain.material.vertexColors!==!map)){terrain.material.map=map;terrain.material.vertexColors=!map;terrain.material.needsUpdate=true;}
     const index=Math.min(state.vectors.length-2,Math.floor(minute/15)),mix=(minute%15)/15,a=state.vectors[index]!,b=state.vectors[index+1]!;
    const direction=new THREE.Vector3(...a).lerp(new THREE.Vector3(...b),mix).normalize(),cloud=(weather?.cloud??0)/100;
    const night=celestial.update(sceneDate(),g.latitude,g.longitude,origin+camera.position.y,cloud,direction.y,camera,state.cameraMode==='ground'&&state.constellations===true);
    sky.update(direction,weather,camera,elapsed,state.reducedMotion===true,night);
    const previousSunShadow=sunLight.castShadow;
    sunLight.position.copy(direction).multiplyScalar(span*2);sunLight.target.position.set(0,0,0);sunLight.intensity=Math.max(0,direction.y)*3.5*(1-cloud*.85);sunLight.castShadow=direction.y>0.02&&cloud<.9;sunMesh.visible=direction.y>0;sunMesh.position.copy(direction).multiplyScalar(span*.82);sunMesh.material.opacity=1-cloud*.94;sunMesh.material.color.set(direction.y<.15?'#ffd4a3':'#ffffff');
    // A newly enabled light needs its shadow texture before lit materials draw.
    if(previousSunShadow!==sunLight.castShadow||night.shadowChanged||state.playing||now-shadowAt>30000){renderer.shadowMap.needsUpdate=true;shadowAt=now;}
    if(state.cameraMode==='ground')sunMesh.position.add(camera.position);
    if(path)path.visible=state.playing&&state.cameraMode!=='ground';
    const daylight=THREE.MathUtils.smoothstep(direction.y,-0.10,0.15);ambient.intensity=.012+night.strength*.025+daylight*(1.93-cloud*.55);renderer.setClearColor(new THREE.Color('#0d1525').lerp(new THREE.Color('#dcecf4').lerp(new THREE.Color('#a1afb7'),cloud),daylight));
     renderer.render(scene,camera);dirty=false;
     if(state.playing&&now-lastMessage>250){send({type:'time',minute});lastMessage=now;}
   }
   raf=requestAnimationFrame(loop);
 }
 const resize=()=>{const w=window.innerWidth,h=window.innerHeight;if(w<2||h<2)return;const previousFraming=framing();renderer.setSize(w,h);camera.aspect=w/h;if(state.cameraMode!=='ground')camera.position.sub(controls.target).multiplyScalar(framing()/previousFraming).add(controls.target);camera.updateProjectionMatrix();if(state.cameraMode==='ground')observerCamera.resize();else{constrainEnvironment();controls.update();}dirty=true;};window.addEventListener('resize',resize);resize();controls.addEventListener('change',()=>{dirty=true;});
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();send({type:'error',reason:'context-lost'});});
 document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden&&!raf)raf=requestAnimationFrame(loop);});
 window.home3d={update,setPhotos,analyzeNeighborhood,dispose:()=>{disposed=true;observerCamera.dispose();celestial.dispose();editor.dispose();cancelAnimationFrame(raf);photoProjection.dispose();vegetationOcclusion?.geometry.dispose();(vegetationOcclusion?.material as THREE.Material|undefined)?.dispose();disposeOrbitTouch();controls.dispose();groundTexture?.dispose();groundFallbackTexture?.dispose();environmentTexture?.dispose();scene.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const material of materials){(material as THREE.MeshStandardMaterial)?.map?.dispose();material?.dispose();}});renderer.dispose();}};
 window.addEventListener('message',event=>{if(event.source!==window.parent)return;if(event.data?.type==='home3d-state')update(event.data.state);if(event.data?.type==='home3d-photos')setPhotos(event.data.photos);if(event.data?.type==='home3d-neighborhood')analyzeNeighborhood(event.data.batch);});
 setPhotos(config.photos);
 captureHighlight(state.captureFace);
 refreshFacades();
 send({type:'ready',measuredBuildings,estimatedBuildings,mainMeasured,lidarBuildings,parcelPoints:parcelLidar?.pointCount??0,terrainTriangles:parcelLidar?.terrain?.indices.length?parcelLidar.terrain.indices.length/3:0,vegetationTriangles:parcelLidar?.vegetation?.indices.length?parcelLidar.vegetation.indices.length/3:0});raf=requestAnimationFrame(loop);
}
try{if(window.HOME_MODEL_GZIP){window.HOME_MODEL=JSON.parse(strFromU8(gunzipSync(unbase64(window.HOME_MODEL_GZIP))));delete window.HOME_MODEL_GZIP;}start();}catch(error){console.warn('3D initialization:',error instanceof Error?error.message:'unknown');send({type:'error',reason:'webgl-unavailable'});document.body.innerHTML='<p style="padding:24px;color:#445;font:16px sans-serif">3D-visningen kunne ikke startes på denne enhed.</p>';}
