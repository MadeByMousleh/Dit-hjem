import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
declare global {interface Window {LIDAR_TRIAL:any;lidarPreview:any}}
const data=window.LIDAR_TRIAL,header=data.lines.find((l:any)=>l.type==='CityJSON'),transform=header?.transform??{scale:[1,1,1],translate:[0,0,0]};
const scene=new THREE.Scene();scene.background=new THREE.Color('#edf2f6');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,1,0.1,500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const meshGroup=new THREE.Group(),pointGroup=new THREE.Group();scene.add(meshGroup,pointGroup);
const allPoints:THREE.Vector3[]=[],roofFaces:number[][]=[];
for(const feature of data.lines.filter((l:any)=>l.type==='CityJSONFeature')){
 const verts=feature.vertices.map((v:number[])=>v.map((n,i)=>n*transform.scale[i]+transform.translate[i]));
 for(const object of Object.values(feature.CityObjects) as any[])for(const g of object.geometry??[]){if(String(g.lod)!=='2.2')continue;
  const faces=g.type==='Solid'?g.boundaries[0]:g.boundaries;
  const semanticValues=g.type==='Solid'?g.semantics?.values?.[0]:g.semantics?.values;
  for(let index=0;index<faces.length;index++){
   const rings=faces[index].map((ring:number[])=>ring.map(i=>new THREE.Vector3(...verts[i] as [number,number,number])));
   const ring=rings[0];if(ring.length<3)continue;
   const normal=ring[1].clone().sub(ring[0]).cross(ring[2].clone().sub(ring[0])).normalize(),drop=Math.abs(normal.z)>Math.abs(normal.y)&&Math.abs(normal.z)>Math.abs(normal.x)?2:Math.abs(normal.y)>Math.abs(normal.x)?1:0;
   const project=(v:THREE.Vector3)=>drop===2?new THREE.Vector2(v.x,v.y):drop===1?new THREE.Vector2(v.x,v.z):new THREE.Vector2(v.y,v.z);
   const flat=rings.flat(),triangles=THREE.ShapeUtils.triangulateShape(rings[0].map(project),rings.slice(1).map((r:THREE.Vector3[])=>r.map(project)));
   const positions=triangles.flatMap(t=>t.flatMap(i=>{const v=flat[i]!;allPoints.push(v);return [v.x,v.z,-v.y];}));
   const roof=g.semantics?.surfaces?.[semanticValues?.[index]]?.type==='RoofSurface';
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:roof?'#596879':'#d1ad85',roughness:0.88,side:THREE.DoubleSide}));mesh.castShadow=true;mesh.receiveShadow=true;meshGroup.add(mesh);if(roof)roofFaces.push(positions);
  }
 }
}
if(!allPoints.length)throw Error('No reconstructed LoD2.2 surfaces');
const box=new THREE.Box3().setFromObject(meshGroup),center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()),size=Math.max(extent.x,extent.z),origin=new THREE.Vector3(center.x,box.min.y,center.z);meshGroup.position.sub(origin);
if(data.points?.length){const positions=data.points.flatMap((p:[number,number,number])=>[p[0]-origin.x,p[2]-origin.y,-p[1]-origin.z]);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));pointGroup.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:'#e65342',size:0.07})));}pointGroup.visible=false;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(size*2.2,size*2.2),new THREE.MeshStandardMaterial({color:'#dbe3d3',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.035;ground.receiveShadow=true;scene.add(ground);
scene.add(new THREE.HemisphereLight('#f1f6ff','#a5ac9c',2));const sun=new THREE.DirectionalLight('#fff4dd',3);sun.position.set(size,30,size/2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-size;sun.shadow.camera.right=size;sun.shadow.camera.top=size;sun.shadow.camera.bottom=-size;sun.shadow.camera.far=150;sun.shadow.normalBias=0.025;scene.add(sun);
camera.position.set(size*1.05,size*0.85,size*1.1);controls.target.set(0,extent.y/2,0);controls.update();
const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
document.getElementById('points')!.onclick=()=>{pointGroup.visible=!pointGroup.visible;};document.getElementById('model')!.onclick=()=>{meshGroup.visible=!meshGroup.visible;};
window.lidarPreview={roofSurfaceCount:roofFaces.length,faceCount:meshGroup.children.length,height:extent.y,width:extent.x,depth:extent.z,pointCount:data.points?.length??0};
document.getElementById('stats')!.textContent=`${roofFaces.length} tagflader · ${extent.y.toFixed(2)} m høj · rå LiDAR / Roofer · prototype uden fototeksturer`;
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
