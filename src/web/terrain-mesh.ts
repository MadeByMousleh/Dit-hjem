import * as THREE from 'three';
import type {ParcelTerrain} from '../utils/homeLidarModel';
/** Uses actual source Z. Colour and contours clarify relief without amplifying it. */
export function terrainMesh(tin:ParcelTerrain,cx:number,cy:number,origin:number,bbox:number[]){
 const vertices:number[]=[],uv:number[]=[],colors:number[]=[],lines:number[]=[];
 const [low,high]=tin.heightRange,lowColor=new THREE.Color('#a9b89c'),highColor=new THREE.Color('#d4c3a0');
 for(let i=0;i<tin.vertices.length;i+=3){const x=tin.vertices[i]!,y=tin.vertices[i+1]!,z=tin.vertices[i+2]!;vertices.push(x-cx,z-origin,cy-y);uv.push((x-bbox[0]!)/(bbox[2]!-bbox[0]!),(y-bbox[1]!)/(bbox[3]!-bbox[1]!));const color=lowColor.clone().lerp(highColor,Math.max(0,Math.min(1,(z-low)/Math.max(.01,high-low))));colors.push(color.r,color.g,color.b);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(tin.indices);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.photoGround=true;
 // 25 cm contour intervals, independently switchable; no fabricated elevations.
 for(let i=0;i<tin.indices.length;i+=3){const ids=tin.indices.slice(i,i+3).map(id=>id*3),z=ids.map(id=>tin.vertices[id+2]!);
  for(let level=Math.ceil(Math.min(...z)/.25)*.25;level<=Math.max(...z);level+=.25){const points:THREE.Vector3[]=[];
   for(let edge=0;edge<3;edge++){const a=ids[edge]!,b=ids[(edge+1)%3]!,za=tin.vertices[a+2]!,zb=tin.vertices[b+2]!;if((za<level)===(zb<level)||za===zb)continue;const t=(level-za)/(zb-za);points.push(new THREE.Vector3(tin.vertices[a]!+(tin.vertices[b]!-tin.vertices[a]!)*t-cx,level-origin+.012,cy-(tin.vertices[a+1]!+(tin.vertices[b+1]!-tin.vertices[a+1]!)*t)));}
   if(points.length===2)lines.push(...points[0]!.toArray(),...points[1]!.toArray());
  }
 }
 const contours=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),new THREE.LineBasicMaterial({color:'#68765e',transparent:true,opacity:.5,depthWrite:false}));
 return {mesh,material,contours};
}
