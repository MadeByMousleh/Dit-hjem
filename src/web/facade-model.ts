import * as THREE from 'three';
import type {FacadeModel} from '../services/house-facade';

// Coordinates are a rectified visual estimate. Survey footprint/roof stay authoritative.
export function buildFacade(model:FacadeModel,height:number){
 if(model.analysis.coverage==='partial')height=Math.min(height,model.face.length/model.analysis.aspect!);
 const group=new THREE.Group(),{analysis,face}=model,width=analysis.coverage==='partial'?Math.min(face.length,height*analysis.aspect!):face.length;
 const patch=new THREE.Group();patch.position.x=(face.length-width)/2;group.add(patch);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle=analysis.material==='brick'?'#b8afa2':analysis.wallColor;ctx.fillRect(0,0,512,256);
 if(analysis.material==='brick'){
  for(let row=0;row<6;row++)for(let col=-1;col<6;col++){
   const tint=new THREE.Color(analysis.wallColor).multiplyScalar(0.92+((row*13+col*7+42)%11)/70);
   ctx.fillStyle=`#${tint.getHexString()}`;ctx.fillRect(col*102.4+(row%2)*51.2+2,row*256/6+2,98.4,256/6-4);
  }
 }else if(analysis.material==='wood'){
  ctx.strokeStyle=new THREE.Color(analysis.wallColor).multiplyScalar(0.72).getStyle();ctx.lineWidth=3;
  for(let x=0;x<512;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(width/1.2,height/0.4);texture.anisotropy=8;
 const wallMaterial=new THREE.MeshStandardMaterial({map:texture,bumpMap:analysis.material==='brick'?texture:null,bumpScale:0.008,roughness:0.9,side:THREE.DoubleSide});
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(width,height),wallMaterial);wall.position.set(width/2,height/2,0.022);wall.receiveShadow=true;patch.add(wall);
 const box=(x:number,y:number,w:number,h:number,z:number,d:number,material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;patch.add(mesh);};
 for(const opening of analysis.openings){
  const frame=new THREE.MeshStandardMaterial({color:opening.frameColor??analysis.frameColor,roughness:0.65});
  const panel=new THREE.MeshStandardMaterial({color:opening.panelColor??(opening.kind==='window'?'#344e60':analysis.frameColor),metalness:opening.kind==='window'?0.25:0,roughness:opening.kind==='window'?0.22:0.75});
  const w=opening.width*width,h=opening.height*height,x=(opening.x+opening.width/2)*width,y=(1-opening.y-opening.height/2)*height;
  const border=Math.min(0.055,w/10,h/10);
  box(x,y,w,h,0.045,0.035,panel);
  for(const side of [-1,1]){box(x+side*(w-border)/2,y,border,h,0.07,0.08,frame);box(x,y+side*(h-border)/2,w,border,0.07,0.08,frame);}
  if(opening.kind==='window'){
   const vertical=opening.verticalBars??Array.from({length:opening.columns-1},(_,i)=>(i+1)/opening.columns);
   for(const fraction of vertical)box(x-w/2+w*fraction,y,border,h,0.07,0.075,frame);
   for(const fraction of opening.horizontalBars??[])box(x,y+h/2-h*fraction,w,border,0.07,0.075,frame);
   box(x,y-h/2,w+0.06,0.04,0.095,0.16,frame);
  }else if(opening.kind==='garage')for(let row=1;row<7;row++)box(x,y-h/2+h*row/7,w,0.012,0.07,0.015,frame);
 }
 group.userData.facadeTexture=texture;
 return group;
}
export function disposeFacade(group:THREE.Group){
 const materials=new Set<THREE.Material>();group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
 for(const material of materials)material.dispose();(group.userData.facadeTexture as THREE.Texture).dispose();
}
