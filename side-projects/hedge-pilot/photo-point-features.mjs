import jpeg from 'jpeg-js';
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectPhoto} from '../../src/services/home-photo-projection.mjs';
import {pointFeatures,pointFeatureNames} from './point-model.mjs';

export const fusionFeatureNames=[...pointFeatureNames,'photoVisibleFraction','photoGreenExcess','photoBrightness','photoTexture','photoViewDisagreement'];
const folder=dirname(fileURLToPath(import.meta.url));
export async function houseFeatures(house,{fusion=false}={}){
 const features=pointFeatures(house.points);if(!fusion)return features;
 let bytes;
 try{bytes=await readFile(folder+'/data/houses/'+house.addressId+'/photos.json','utf8');}
 catch(error){if(error.code!=='ENOENT')throw error;bytes=await readFile(folder+'/data/photos.json','utf8');}
 const photos=JSON.parse(bytes);if(photos.addressId!==house.addressId)throw Error('Photo feature address mismatch');
 return fusePhotoFeatures(house.points,features,photos.photos);
}

// Conservative sampled-LiDAR depth screen, not proof that a surface is visible.
// Photo features are absent when nearer measured geometry covers the projection.
export function fusePhotoFeatures(points,features,photos){
 const samples=new Map([...features.keys()].map(i=>[i,[]]));let usable=0;
 for(const photo of photos){
  if(photo.direction==='nadir'||!photo.camera?.crop)continue;
  const image=jpeg.decode(Buffer.from(photo.image.split(',')[1],'base64'),{useTArray:true,maxMemoryUsageInMB:128});
  if(image.width!==photo.width||image.height!==photo.height)throw Error('Photo feature dimensions mismatch');
  usable++;
  const [left,top,right,bottom]=photo.camera.crop,projected=[],depth=new Map();
  for(let i=0;i<points.length;i++){
   const p=points[i],uv=projectPhoto(photo.camera,p);if(!uv)continue;
   const x=(uv[0]-left)*image.width/(right-left),y=(uv[1]-top)*image.height/(bottom-top);
   if(x<2||y<2||x>=image.width-2||y>=image.height-2)continue;
   const d=Math.hypot(...p.slice(0,3).map((v,j)=>v-photo.camera.center[j])),gx=Math.floor(x/3),gy=Math.floor(y/3);
   projected.push({i,x:Math.min(image.width-3,Math.round(x)),y:Math.min(image.height-3,Math.round(y)),d,gx,gy});
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const key=`${gx+dx},${gy+dy}`;depth.set(key,Math.min(depth.get(key)??Infinity,d));}
  }
  for(const p of projected){
   if(!samples.has(p.i)||p.d>(depth.get(`${p.gx},${p.gy}`)??0)+.65)continue;
   let green=0,light=0,squared=0;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const offset=((p.y+dy)*image.width+p.x+dx)*4,r=image.data[offset]/255,g=image.data[offset+1]/255,b=image.data[offset+2]/255,l=(r+g+b)/3;
    green+=2*g-r-b;light+=l;squared+=l*l;
   }
   samples.get(p.i).push([green/25,light/25,Math.sqrt(Math.max(0,squared/25-(light/25)**2))]);
  }
 }
 const result=new Map();
 for(const [i,x]of features){
  const rows=samples.get(i),mean=j=>rows.length?rows.reduce((s,r)=>s+r[j],0)/rows.length:0,g=mean(0);
  result.set(i,[...x,usable?rows.length/usable:0,g,mean(1),mean(2),rows.length?Math.sqrt(rows.reduce((s,r)=>s+(r[0]-g)**2,0)/rows.length):0]);
 }
 return result;
}
