import * as THREE from 'three';
import type {FacadeModel} from '../services/house-facade';
import {facadePlacement,openingPlacement} from '../utils/facade-placement';
import {openingKey,type SceneEdits} from '../utils/scene-opening-edits';

/** Openings only: preserve the measured roof/footprint and existing facade colour. */
export function buildFacade(model:FacadeModel,height:number,edits?:SceneEdits){
 const group=new THREE.Group(),placement=facadePlacement(model,height);
 group.userData.placement=placement;group.userData.openingCount=model.analysis.openings.length;
 group.userData.faceId=model.face.id;group.userData.facadeHeight=height;group.userData.facadeLength=model.face.length;
 model.analysis.openings.forEach((opening,index)=>{
  const id=openingKey(model,index),override=edits?.openings[id];if(override===null)return;
  const original=openingPlacement(opening,placement,model.face.length,height),normalized=override??{x:original.x/model.face.length,y:1-(original.y+original.height)/height,width:original.width/model.face.length,height:original.height/height};
  const rect={x:normalized.x*model.face.length,y:(1-normalized.y-normalized.height)*height,width:normalized.width*model.face.length,height:normalized.height*height},w=rect.width,h=rect.height,x=rect.x+w/2,y=rect.y+h/2;
  if(w<.08||h<.08)return;
  const frame=new THREE.MeshStandardMaterial({color:opening.frameColor??model.analysis.frameColor,roughness:.65});
  const glass=opening.kind==='window',panel=new THREE.MeshStandardMaterial({color:opening.panelColor??(glass?'#344e60':'#65676a'),metalness:glass?0.15:0,roughness:glass?0.25:0.8});
  const reveal=new THREE.MeshStandardMaterial({color:'#34383d',roughness:1});
  const box=(cx:number,cy:number,width:number,tall:number,z:number,depth:number,material:THREE.Material,shadow=false)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,tall,depth),material);mesh.position.set(cx,cy,z);mesh.receiveShadow=true;mesh.castShadow=shadow;mesh.userData.openingIndex=index;mesh.userData.openingId=id;mesh.userData.openingRect=normalized;group.add(mesh);
  };
  // The existing wall is not cut: a shallow dark panel and jamb/frame geometry
  // visually represent the opening without claiming surveyed wall depth.
  box(x,y,w,h,.035,.025,panel);
  const border=Math.min(.055,w/10,h/10),recess=border*.5;
  for(const side of [-1,1]){
   box(x+side*(w-border)/2,y,border,h,.085,.11,frame,true);
   box(x,y+side*(h-border)/2,w,border,.085,.11,frame,true);
   box(x+side*(w-border*2)/2,y,recess,Math.max(.01,h-border*2),.055,.045,reveal);
  }
  const vertical=opening.verticalBars??Array.from({length:Math.max(0,opening.columns-1)},(_,i)=>(i+1)/opening.columns),horizontal=opening.horizontalBars??[];
  for(const fraction of vertical){const u=placement.mirror?1-fraction:fraction;box(rect.x+w*u,y,border,h,.09,.07,frame,true);}
  for(const fraction of horizontal)box(x,rect.y+h*(1-fraction),w,glass?border:.012,.09,.05,frame,true);
  if(glass)box(x,rect.y,w+.06,.04,.12,.16,frame,true);
 });
 return group;
}
export function disposeFacade(group:THREE.Group){
 const materials=new Set<THREE.Material>();group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});for(const material of materials)material.dispose();
}
