import * as THREE from 'three';
import {calibratedPhotoCamera} from './projected-photos';
import type {ModelPhoto,HomePhotoColors} from '../services/home-insights';
export type HousePhotoColors=HomePhotoColors;
type RGB=[number,number,number];
/** Dominant photographed colour, not an albedo measurement or material classifier. */
export function dominantColor(values:RGB[]):{rgb:RGB;support:number}|null{
 if(values.length<40)return null;
 const bins=new Map<string,RGB[]>();
 for(const rgb of values){const light=(rgb[0]+rgb[1]+rgb[2])/3;if(light<12||light>243)continue;const key=rgb.map(v=>Math.floor(v/32)).join(',');const bin=bins.get(key)??[];bin.push(rgb);bins.set(key,bin);}
 let selected:RGB[]=[];
 for(const key of bins.keys()){const p=key.split(',').map(Number),near:RGB[]=[];for(const [other,values]of bins){const q=other.split(',').map(Number);if(q.every((v,i)=>Math.abs(v-p[i]!)<=1))near.push(...values);}if(near.length>selected.length)selected=near;}
 const support=selected.length/values.length;if(selected.length<40||support<.6)return null;
 const median=(i:number)=>selected.map(v=>v[i]!).sort((a,b)=>a-b)[Math.floor(selected.length/2)]!;
 return {rgb:[median(0),median(1),median(2)],support};
}
export async function estimatePhotoColors(items:{photo:ModelPhoto;image:THREE.Texture}[],targets:THREE.Mesh[],occluders:THREE.Mesh[],cx:number,cy:number,origin:number,alive:()=>boolean):Promise<HousePhotoColors>{
 const images=items.map(({photo,image})=>{const source=image.image as HTMLImageElement,canvas=document.createElement('canvas');canvas.width=source.naturalWidth||source.width;canvas.height=source.naturalHeight||source.height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Image analysis unavailable');context.drawImage(source,0,0);return {photo,width:canvas.width,height:canvas.height,pixels:context.getImageData(0,0,canvas.width,canvas.height).data,camera:calibratedPhotoCamera(photo,cx,cy,origin)};});
 const buckets=new Map<string,{id:string;kind:'roof'|'walls';views:{rgb:RGB;support:number;count:number;year:string}[]}>();
 const ray=new THREE.Raycaster(),point=new THREE.Vector3(),normal=new THREE.Vector3(),towards=new THREE.Vector3();
 const visibleOccluders=occluders.filter(mesh=>!mesh.userData.photoGround);
 let lastYield=performance.now();
 for(const mesh of visibleOccluders){mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
 for(const mesh of targets){const surface=mesh.userData.houseSurface as {id:string;kind:'roof'|'walls'}|undefined;if(!surface)continue;
  const positions=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index,key=`${surface.id}:${surface.kind}`,bucket=buckets.get(key)??{...surface,views:[]};
  mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox!;
  const triangles=indices?indices.count:positions.count;
  for(const image of images){if(surface.kind==='walls'&&image.photo.direction==='nadir')continue;const samples:RGB[]=[],pixels=new Set<number>();
   for(let i=0;i<triangles;i+=3){if(!alive())return {};const ids=[0,1,2].map(j=>indices?indices.getX(i+j):i+j),v=ids.map(id=>new THREE.Vector3().fromBufferAttribute(positions,id).applyMatrix4(mesh.matrixWorld));const triangle=new THREE.Triangle(v[0]!,v[1]!,v[2]!);triangle.getNormal(normal);
    const count=Math.min(48,Math.max(3,Math.ceil(triangle.getArea()*6)));
    for(let j=0;j<count;j++){// Deterministic interior samples avoid shared edges and window/roof boundaries.
     if(j%8===0&&performance.now()-lastYield>12){await new Promise<void>(resolve=>setTimeout(resolve,0));lastYield=performance.now();if(!alive())return {};}
     const u=(j+.5)/count,s=Math.sqrt(u),t=((j*.61803398875)%1)*.8+.1;
     point.copy(v[0]!).multiplyScalar(.15+.55*(1-s)).addScaledVector(v[1]!,.15+.55*s*(1-t)).addScaledVector(v[2]!,.15+.55*s*t);
     // Airborne roofs/overhangs can contaminate the upper facade projection.
     // Sample the supported lower/middle wall band; never stretch roof colours down.
     if(surface.kind==='walls'&&(point.y<bounds.min.y+.15*(bounds.max.y-bounds.min.y)||point.y>bounds.min.y+Math.min(2,(bounds.max.y-bounds.min.y)*.6)))continue;
     towards.subVectors(image.camera.position,point);const distance=towards.length();towards.normalize();if(normal.dot(towards)<.22)continue;
     const projected=point.clone().project(image.camera);if(Math.abs(projected.x)>.96||Math.abs(projected.y)>.96||projected.z<0||projected.z>1)continue;
     const x=Math.floor((projected.x*.5+.5)*image.width),y=Math.floor((.5-projected.y*.5)*image.height),pixel=y*image.width+x;if(pixels.has(pixel))continue;
     ray.set(image.camera.position,towards.clone().negate());ray.near=0;ray.far=distance+.08;
     const hits=ray.intersectObjects(visibleOccluders,false);if(hits[0]&&hits[0].distance<distance-.12)continue;
     pixels.add(pixel);const at=pixel*4;samples.push([image.pixels[at]!,image.pixels[at+1]!,image.pixels[at+2]!]);
    }
    if(i%24===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
   }
   const result=dominantColor(samples);if(result)bucket.views.push({...result,count:samples.length,year:image.photo.capturedAt.slice(0,4)});
  }
  buckets.set(key,bucket);
 }
 const output:HousePhotoColors={};
 for(const bucket of buckets.values()){
  if(!bucket.views.length)continue;
  // Demand agreement between views; illumination can change brightness, but
  // strongly conflicting chromaticities are evidence to abstain, not invent.
  const chroma=(rgb:RGB)=>{const sum=rgb.reduce((a,b)=>a+b,0);return rgb.map(v=>v/sum);};
  const candidates=bucket.views.map(a=>bucket.views.filter(b=>Math.hypot(...chroma(a.rgb).map((v,i)=>v-chroma(b.rgb)[i]!))<.12)).sort((a,b)=>b.length-a.length)[0]!;
  if(candidates.length<2||candidates.length<Math.ceil(bucket.views.length*.6))continue;
  const median=(i:number)=>candidates.map(v=>v.rgb[i]!).sort((a,b)=>a-b)[Math.floor(candidates.length/2)]!;
  const rgb=[median(0),median(1),median(2)],color='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
  (output[bucket.id]??={})[bucket.kind]={color,samples:candidates.reduce((sum,v)=>sum+v.count,0),views:candidates.length,confidence:candidates.length>=2?'medium':'low',years:[...new Set(candidates.map(v=>v.year))]};
 }
 return output;
}
