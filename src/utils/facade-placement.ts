import type {FacadeModel} from '../services/house-facade';
import type {HousePhotoFace} from './house-photo-guide';
import type {HouseLidarModel} from './homeLidarModel';
export type FacadePlacement={left:number;bottom:number;width:number;height:number;mirror:boolean};
export function validateFacadePlacement(value:unknown):FacadePlacement|undefined{
 if(value===undefined)return undefined;
 const p=value as FacadePlacement;if(!p||typeof p.mirror!=='boolean'||![p.left,p.bottom,p.width,p.height].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||p.width<.05||p.height<.1||p.left+p.width>1.001||p.bottom+p.height>1.001)throw Error('INVALID_PLACEMENT');
 return {left:p.left,bottom:p.bottom,width:p.width,height:p.height,mirror:p.mirror};
}
export function facadePlacement(model:FacadeModel,height:number):FacadePlacement{
 const saved=validateFacadePlacement(model.placement);if(saved)return saved;
 const width=model.analysis.coverage==='partial'?Math.max(.05,Math.min(1,height*(model.analysis.aspect??1)/model.face.length)):1;
 return {left:(1-width)/2,bottom:0,width,height:1,mirror:false};
}
export function openingPlacement(opening:FacadeModel['analysis']['openings'][number],p:FacadePlacement,length:number,height:number){
 return {x:(p.left+(p.mirror?1-opening.x-opening.width:opening.x)*p.width)*length,y:(p.bottom+(1-opening.y-opening.height)*p.height)*height,width:opening.width*p.width*length,height:opening.height*p.height*height};
}
/** Use the reconstructed wall's lower eaves, never the roof ridge or BBR storey guess. */
export function lidarFacadeAnchor(face:HousePhotoFace,model:HouseLidarModel|null){
 if(!model||model.buildingId!==face.buildingId||face.length<.75)return null;
 const dx=(face.b[0]-face.a[0])/face.length,dy=(face.b[1]-face.a[1])/face.length,tops:number[]=[];
 for(let i=0;i<model.walls.length;i+=3){const x=model.walls[i]!-face.a[0],y=model.walls[i+1]!-face.a[1],along=x*dx+y*dy,across=x*dy-y*dx,z=model.walls[i+2]!;
  if(along>=-.2&&along<=face.length+.2&&Math.abs(across)<.35&&z>model.ground+.8)tops.push(z);
 }
 if(tops.length<2)return null;tops.sort((a,b)=>a-b);const height=tops[Math.floor(tops.length*.25)]!-model.ground;
 return Number.isFinite(height)&&height>=1&&height<=20?{base:model.ground,height}:null;
}
