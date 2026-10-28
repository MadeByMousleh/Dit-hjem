import * as THREE from 'three';
import {calibratedPhotoCamera} from './projected-photos';
import {housePhotoFaces} from '../utils/house-photo-guide';
import type {HomeGeometry,HomeModelPhotos} from '../services/home-insights';
import type {FacadeModel} from '../services/house-facade';
import type {AerialOpenings} from '../services/aerial-openings';
import {photographicOpeningColors,harmonizeFrames,type PhotoPixels} from './opening-photo-colors';
export function aerialFacades(data:HomeGeometry,photos:HomeModelPhotos|null,detections:AerialOpenings|undefined,occluders:THREE.Mesh[],cx:number,cy:number,origin:number,anchor:(face:FacadeModel['face'])=>{base:number;height:number},pixels=new Map<string,PhotoPixels>()):FacadeModel[]{
 if(!detections)return [];const faces=housePhotoFaces(data),models=new Map<string,FacadeModel>(),ray=new THREE.Raycaster();
 for(const view of photos?detections.views:[]){const index=Number(view.viewId.replace('photo-','')),photo=photos!.photos[index];if(!photo)continue;
  const camera=calibratedPhotoCamera(photo,cx,cy,origin),cast=(p:number[])=>{const point=new THREE.Vector3(p[0]!*2-1,1-p[1]!*2,.5).unproject(camera);ray.set(camera.position,point.sub(camera.position).normalize());};
  for(const opening of view.openings){
   cast([opening.quad.reduce((s,p)=>s+p[0]!,0)/4,opening.quad.reduce((s,p)=>s+p[1]!,0)/4]);
   const hit=ray.intersectObjects(occluders,false)[0],surface=hit?.object.userData.houseSurface;if(!hit||surface?.kind!=='walls')continue;
   const east=hit.point.x+cx,north=cy-hit.point.z;
   const hitNormal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
   const face=faces.filter(f=>f.buildingId===surface.id).map(f=>{const dx=(f.b[0]-f.a[0])/f.length,dy=(f.b[1]-f.a[1])/f.length,u=(east-f.a[0])*dx+(north-f.a[1])*dy,alignment=hitNormal?Math.abs(hitNormal.dot(new THREE.Vector3(dy,0,dx))):1;return {f,d:Math.abs((east-f.a[0])*dy-(north-f.a[1])*dx),u,alignment};}).filter(p=>p.u>=0&&p.u<=p.f.length&&p.alignment>.95).sort((a,b)=>a.d-b.d)[0];
   if(!face||face.d>.45)continue;const f=face.f,{base,height}=anchor(f),dx=(f.b[0]-f.a[0])/f.length,dy=(f.b[1]-f.a[1])/f.length;
   const normal=new THREE.Vector3(dy,0,dx),start=new THREE.Vector3(f.a[0]-cx,base-origin,cy-f.a[1]);
   // The photo shader projects onto the actual mesh, not a nearby cadastral
   // line. Anchor openings to that same hit plane, preserving its offset.
   const offset=normal.dot(hit.point.clone().sub(start));start.addScaledVector(normal,offset);
   const placedFace={...f,a:[f.a[0]+dy*offset,f.a[1]-dx*offset] as [number,number],b:[f.b[0]+dy*offset,f.b[1]-dx*offset] as [number,number]};
   const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,start),points:THREE.Vector3[]=[];
   for(const p of opening.quad){cast(p);const at=ray.ray.intersectPlane(plane,new THREE.Vector3());if(at)points.push(at.sub(start));}
   if(points.length!==4||height<1)continue;
   // Fit opposite edges rather than inflating the rectangle with min/max of
   // every noisy corner. Then check its projection in the ORIGINAL image.
   const xs=points.map(p=>(p.x*dx-p.z*dy)/f.length).sort((a,b)=>a-b),ys=points.map(p=>1-p.y/height).sort((a,b)=>a-b),x=(xs[0]!+xs[1]!)/2,y=(ys[0]!+ys[1]!)/2,width=(xs[2]!+xs[3]!)/2-x,tall=(ys[2]!+ys[3]!)/2-y;
   if(![x,y,width,tall].every(Number.isFinite)||x<-.01||y<-.01||x+width>1.01||y+tall>1.01||width*f.length<.25||tall*height<.3)continue;
   let model=models.get(f.id);if(!model){model={id:`aerial-projection-v2:${f.id}`,face:placedFace,anchor:{base,height},analysis:{version:1,confidence:.8,material:'other',wallColor:'#c2c6ca',frameColor:'#dddcd8',openings:[]}};models.set(f.id,model);}
   const corners=[[x,y],[x+width,y],[x+width,y+tall],[x,y+tall]].map(([u,v])=>start.clone().add(new THREE.Vector3(dx*u!*f.length,(1-v!)*height,-dy*u!*f.length)).project(camera)).map(p=>[(p.x+1)/2,(1-p.y)/2]);
   const error=Math.sqrt(corners.reduce((sum,p)=>sum+Math.min(...opening.quad.map(q=>((p[0]!-q[0]!)*photo.width)**2+((p[1]!-q[1]!)*photo.height)**2)),0)/4);
   if(error>Math.max(3,Math.sqrt(width*tall)*Math.min(photo.width,photo.height)*.2))continue;
   const direction=camera.position.clone().sub(hit.point).normalize(),facing=Math.max(0,normal.dot(direction)),area=Math.abs(opening.quad.reduce((s,p,i)=>{const q=opening.quad[(i+1)%4]!;return s+p[0]!*q[1]!-p[1]!*q[0]!;},0))/2*photo.width*photo.height;
   const quality=area*facing*facing/(1+error*error),colors=photographicOpeningColors(opening,pixels.get(photo.image));
   const next={kind:opening.kind,x:Math.max(0,x),y:Math.max(0,y),width:Math.min(width,1-Math.max(0,x)),height:Math.min(tall,1-Math.max(0,y)),confidence:opening.confidence,columns:1,...colors,photoQuality:quality};
   const old=model.analysis.openings.find(o=>{const overlap=Math.max(0,Math.min(o.x+o.width,next.x+next.width)-Math.max(o.x,next.x))*Math.max(0,Math.min(o.y+o.height,next.y+next.height)-Math.max(o.y,next.y));return overlap/Math.min(o.width*o.height,next.width*next.height)>.5;});
   if(!old)model.analysis.openings.push(next);else if(quality>((old as typeof next).photoQuality??0))Object.assign(old,next);
  }
 }
 // Multi-view openings are already in wall coordinates (fused from every survey year); no ray casting is involved.
 for(const o of detections.walls??[]){
  const span=Math.hypot(o.p1[0]-o.p0[0],o.p1[1]-o.p0[1]);if(span<.2)continue;
  const ux=(o.p1[0]-o.p0[0])/span,uy=(o.p1[1]-o.p0[1])/span,mx=(o.p0[0]+o.p1[0])/2,my=(o.p0[1]+o.p1[1])/2;
  const match=faces.map(f=>{const dx=(f.b[0]-f.a[0])/f.length,dy=(f.b[1]-f.a[1])/f.length;return {f,d:Math.abs((mx-f.a[0])*dy-(my-f.a[1])*dx),along:ux*dx+uy*dy,u0:(o.p0[0]-f.a[0])*dx+(o.p0[1]-f.a[1])*dy,u1:(o.p1[0]-f.a[0])*dx+(o.p1[1]-f.a[1])*dy};}).filter(p=>p.along>.98&&p.d<.3&&p.u0>=-.3&&p.u1<=p.f.length+.3).sort((a,b)=>a.d-b.d)[0];
  if(!match)continue;
  const f=match.f,{base,height}=anchor(f);if(height<1)continue;
  const x=Math.max(0,match.u0/f.length),right=Math.min(1,match.u1/f.length),y=Math.max(0,1-(o.z1-base)/height),bottom=Math.min(1,1-(o.z0-base)/height);
  if(right-x<.7*span/f.length||bottom-y<.7*(o.z1-o.z0)/height)continue;
  let model=models.get(f.id);if(!model){model={id:`aerial-multiview-v1:${f.id}`,face:f,anchor:{base,height},analysis:{version:1,confidence:.8,material:'other',wallColor:'#c2c6ca',frameColor:'#dddcd8',openings:[]}};models.set(f.id,model);}
  const next={kind:o.kind,x,y,width:right-x,height:bottom-y,confidence:o.confidence,columns:1,frameColor:'#dddcd8',panelColor:o.kind==='window'?'#526574':'#8a8b88',photoQuality:o.confidence*o.support};
  const old=model.analysis.openings.find(e=>Math.max(0,Math.min(e.x+e.width,next.x+next.width)-Math.max(e.x,next.x))*Math.max(0,Math.min(e.y+e.height,next.y+next.height)-Math.max(e.y,next.y))/Math.min(e.width*e.height,next.width*next.height)>.5);
  if(!old)model.analysis.openings.push(next);else if(next.photoQuality>((old as typeof next).photoQuality??0))Object.assign(old,next);
 }
 for(const id of new Set([...models.values()].map(m=>m.face.buildingId)))harmonizeFrames([...models.values()].filter(m=>m.face.buildingId===id).flatMap(m=>m.analysis.openings));
 return [...models.values()].filter(m=>m.analysis.openings.length);
}
