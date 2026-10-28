import {API_URL} from './supabase';
import type {ModelPhoto} from './home-insights';
export type NeighborhoodPhotoBatch={addressId:string;requestId:string;photos:ModelPhoto[];buildingIds:string[];complete?:boolean;coverage?:{version:1;totalTiles:number;completedTiles:number;failedTiles:number}};
export type NeighborhoodPhotoPlan={version:1;bbox:number[];tiles:{id:string;buildingIds:string[]}[]};
async function request(id:string,tile:string|undefined,signal:AbortSignal){
 const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
 const timer=setTimeout(abort,55000);
 try{
  const query=new URLSearchParams({mode:'model-photos',id,neighbors:'1',...(tile?{tile}:{})});
  const response=await fetch(`${API_URL}/api/address/search?${query}`,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Nabofacader kunne ikke hentes.');
  const data=await response.json();if(data.addressId!==id||data.neighborhood?.version!==1||!Array.isArray(data.photos)||data.photos.length>4)throw Error('Nabobilleder er endnu ikke klar på serveren.');return data;
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
export async function loadNeighborhoodPhotoPlan(id:string,signal:AbortSignal):Promise<NeighborhoodPhotoPlan>{
 const data=await request(id,undefined,signal),plan=data.neighborhood;
 if(!Array.isArray(plan.tiles)||plan.tiles.length>64||!Array.isArray(plan.bbox)||plan.bbox.length!==4||!plan.bbox.every(Number.isFinite)||plan.tiles.some((t:{id:string;buildingIds:string[]})=>!/^\d-\d$/.test(t.id)||!Array.isArray(t.buildingIds)||t.buildingIds.some(b=>typeof b!=='string'||b.length>100)))throw Error('Ugyldig nabobilledplan.');return plan;
}
export async function loadNeighborhoodPhotoTile(id:string,tile:string,signal:AbortSignal):Promise<ModelPhoto[]>{
 const data=await request(id,tile,signal);if(data.neighborhood.tile!==tile||data.photos.some((p:ModelPhoto)=>!['south','east','north','west'].includes(p.direction)||typeof p.image!=='string'||p.image.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image)||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width*p.height>1500000||p.camera?.rotation?.length!==9||p.camera.center?.length!==3||p.camera.crop?.length!==4||p.camera.focal?.length!==2||p.camera.principal?.length!==2||![...p.camera.rotation,...p.camera.center,...p.camera.crop,...p.camera.focal,...p.camera.principal].every(Number.isFinite)))throw Error('Ugyldige nabofotos.');return data.photos;
}
