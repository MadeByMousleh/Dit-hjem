import * as THREE from 'three';
import {calibratedPhotoCamera} from './projected-photos';
import type {ModelPhoto} from '../services/home-insights';
import type {WallColorPatch} from '../services/facade-colors';
import {conservativeInterior,runsFor,photoKey} from '../services/facade-color-sampling.mjs';
export function wallFaceKey(mesh:THREE.Mesh,triangleIndex:number){
 const p=mesh.geometry.getAttribute('position'),ix=mesh.geometry.index;
 const a=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(triangleIndex*3+j):triangleIndex*3+j).applyMatrix4(mesh.matrixWorld));
 const n=new THREE.Triangle(a[0]!,a[1]!,a[2]!).getNormal(new THREE.Vector3());
 return `${mesh.userData.houseSurface.id}:${[n.x,n.y,n.z,n.dot(a[0]!)].map(v=>Math.round(v*100)).join(':')}`;
}
/** GPU face-ID/depth pass at original camera resolution, with all occluders. */
export async function maskedWallPhotos(renderer:THREE.WebGLRenderer,items:{photo:ModelPhoto;image:THREE.Texture}[],walls:THREE.Mesh[],occluders:THREE.Mesh[],cx:number,cy:number,origin:number,alive:()=>boolean,priorityIds=new Set<string>()):Promise<WallColorPatch[]>{
 const eligible=new Set(walls.filter(m=>m.userData.houseSurface?.kind==='walls')),output:WallColorPatch[]=[];
 for(const [viewIndex,{photo,image}]of items.entries()){
  if(photo.direction==='nadir')continue;if(!alive())return [];
  const source=image.image as HTMLImageElement,w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;if(w*h>1500000)continue;
  const camera=calibratedPhotoCamera(photo,cx,cy,origin),scene=new THREE.Scene(),faceMap=new Map<number,{faceId:string;buildingId:string}>(),keyIds=new Map<string,number>();let nextId=1;
  for(const mesh of occluders){
   const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),count=geometry.getAttribute('position').count,rgb=new Float32Array(count*3);let low=-1e9,high=1e9;
   if(eligible.has(mesh)){
    geometry.computeBoundingBox();low=geometry.boundingBox!.min.y+.45;high=geometry.boundingBox!.max.y-.8;const p=geometry.getAttribute('position');
    for(let tri=0;tri<count/3;tri++){
     const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,tri*3+j).applyMatrix4(mesh.matrixWorld)),triangle=new THREE.Triangle(v[0]!,v[1]!,v[2]!),n=triangle.getNormal(new THREE.Vector3()),centre=triangle.getMidpoint(new THREE.Vector3());
     if(Math.abs(n.dot(camera.position.clone().sub(centre).normalize()))<.45)continue;
     const faceId=wallFaceKey(mesh,tri),id=keyIds.get(faceId)??nextId++;keyIds.set(faceId,id);faceMap.set(id,{faceId,buildingId:mesh.userData.houseSurface.id});
     for(let j=0;j<3;j++){const at=(tri*3+j)*3;rgb[at]=(id&255)/255;rgb[at+1]=((id>>8)&255)/255;rgb[at+2]=((id>>16)&255)/255;}
    }
   }
   geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
   const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,toneMapped:false,uniforms:{band:{value:new THREE.Vector2(low,high)}},vertexShader:'attribute vec3 color; varying vec3 faceId; varying float wallY; void main(){faceId=color;wallY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 faceId; varying float wallY; uniform vec2 band; void main(){gl_FragColor=vec4(wallY<band.x||wallY>band.y?vec3(0.0):faceId,1.0);}'});
   const copy=new THREE.Mesh(geometry,material);copy.matrixAutoUpdate=false;copy.matrix.copy(mesh.matrixWorld);scene.add(copy);
  }
  const target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,stencilBuffer:false}),ids=new Uint8Array(w*h*4),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  try{renderer.setRenderTarget(target);renderer.setClearColor(0,1);renderer.clear();renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,w,h,ids);}finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0);const original=ctx.getImageData(0,0,w,h);
  const idAt=(x:number,y:number)=>{const at=((h-1-y)*w+x)*4;return ids[at]!+(ids[at+1]!<<8)+(ids[at+2]!<<16);},buckets=new Map<number,number[]>();
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const id=idAt(x,y);if(!faceMap.has(id)||![-1,0,1].every(dy=>[-1,0,1].every(dx=>idAt(x+dx,y+dy)===id)))continue;const list=buckets.get(id)??[];list.push(y*w+x);buckets.set(id,list);}
  for(const [id,rawRetained]of buckets){const quality=conservativeInterior(rawRetained,w,h),retained=quality.indices;if(!quality.accepted)continue;
   let left=w,top=h,right=0,bottom=0;for(const i of retained){const x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const width=right-left+1,height=bottom-top+1,crop=document.createElement('canvas');crop.width=width;crop.height=height;const c=crop.getContext('2d')!,data=c.createImageData(width,height);
   for(let i=3;i<data.data.length;i+=4)data.data[i]=255;
   for(const i of retained){const dest=((Math.floor(i/w)-top)*width+i%w-left)*4;for(let k=0;k<3;k++)data.data[dest+k]=original.data[i*4+k]!;}
   c.putImageData(data,0,0);output.push({id:`v${viewIndex}-${output.length}`,...faceMap.get(id)!,viewId:`${photo.direction}-${viewIndex}`,year:photo.capturedAt.slice(0,4),samplingVersion:2,quality:{accepted:true,margin:quality.margin},photoKey:photoKey(photo),maskRuns:runsFor(retained.map(i=>(Math.floor(i/w)-top)*width+i%w-left)),pixels:retained.length,width,height,image:crop.toDataURL('image/jpeg',.98).split(',')[1]!,contextImage:photo.image.split(',')[1]!,contextSize:[w,h],contextCrop:[left,top,right+1,bottom+1]});
  }
  await new Promise<void>(r=>setTimeout(r,0));
 }
 const chosen:WallColorPatch[]=[];for(const face of new Set(output.map(p=>p.faceId)))chosen.push(...output.filter(p=>p.faceId===face).sort((a,b)=>b.pixels-a.pixels).slice(0,2));
 return chosen.sort((a,b)=>Number(priorityIds.has(b.buildingId))-Number(priorityIds.has(a.buildingId))||b.pixels-a.pixels).slice(0,96);
}
