import {readHomeDetail,saveHomeDetail} from './home-overview-cache';
import { API_URL } from './supabase';
import {bundledEnvironment} from '../generated/home-environment';
export type XY=[number,number];
export type ModelPhoto={direction:string;capturedAt:string;width:number;height:number;image:string;camera:{rotation:number[];center:[number,number,number];sensor:[number,number];focal:[number,number];principal:[number,number];crop:[number,number,number,number]}};
export type HomeModelPhotos={addressId:string;photos:ModelPhoto[];status:string;source:string;notice?:string};
export type HomeMaterialColor={color:string;samples:number;views:number;confidence:'medium'|'low';years:string[];faces?:Record<string,string>;uniform?:boolean;method?:'trained-facade-knn-v1';modelVersion?:string;evidence?:{viewId:string;faceId:string;year:string;pixels:number}[]};
export type HomePhotoColors=Record<string,Partial<Record<'roof'|'walls',HomeMaterialColor>>>;
export type HomeHeights={addressId:string;bbox:[number,number,number,number];width:number;height:number;terrain:(number|null)[];surface:(number|null)[];resolution:[number,number];source:string;notice:string};
export type RoofMaterial={code:string;label:string;kind:'felt'|'fiber-cement'|'concrete-tile'|'clay-tile'|'metal'|'thatch'|'plastic'|'glass'|'none'|'unknown';source:'BBR';supplementaryCode?:string};
export type HomeGeometry={roofMaterialVersion?:1;addressId:string;point:XY;bbox:[number,number,number,number];longitude:number;latitude:number;parcels:{id:string;number:string;registeredArea:number|null;polygons:XY[][][]}[];buildings:{roofMaterial?:RoofMaterial|null;id:string;bbrId:string|null;main:boolean;associated:boolean;rings:XY[][];height:number;heightSource:string;outlineSource:string}[];source:string;notice:string;warnings:string[]};
export type HomeEnvironment={geometry:HomeGeometry;heights:HomeHeights|null;texture:string;textureSource?:string;status?:string};
export function homeEnvironmentFallback(home:HomeGeometry):HomeEnvironment|null{
 const saved=bundledEnvironment as unknown as HomeEnvironment,bounds=saved.geometry.bbox;
 return saved.geometry.addressId===home.addressId&&home.bbox[0]>=bounds[0]&&home.bbox[1]>=bounds[1]&&home.bbox[2]<=bounds[2]&&home.bbox[3]<=bounds[3]?saved:null;
}
const environmentMaps=new Map<string,{texture:string;textureSource:string}>();
async function environmentImage(url:string,signal:AbortSignal):Promise<string>{
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal.aborted)throw Error('Kortindlæsning afbrudt.');
 signal.addEventListener('abort',abort);
 const timer=setTimeout(abort,12000);
 try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error('Luftfoto kunne ikke hentes.');
  const blob=await response.blob();if(!blob.size||blob.size>3000000||!blob.type.startsWith('image/'))throw Error('Ugyldigt luftfoto.');
  const texture=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Luftfoto kunne ikke læses.'));reader.readAsDataURL(blob);});
  if(controller.signal.aborted)throw Error('Kortindlæsning afbrudt.');
  return texture;
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
export async function loadHomeEnvironment(home:HomeGeometry,signal:AbortSignal,refresh=false,onUpdate?:(environment:HomeEnvironment)=>void):Promise<HomeEnvironment>{
 if(signal.aborted)throw Error('Kortindlæsning afbrudt.');
 const centerX=(home.bbox[0]+home.bbox[2])/2,centerY=(home.bbox[1]+home.bbox[3])/2,width=Math.min(500,Math.max(320,(home.bbox[2]-home.bbox[0])*6));
 const bbox:HomeGeometry['bbox']=[centerX-width/2,centerY-width*3/8,centerX+width/2,centerY+width*3/8];
 const matches=(bounds:number[])=>bounds.length===4&&bounds.every((value,index)=>Number.isFinite(value)&&Math.abs(value-bbox[index]!)<.1);
 const params={id:home.addressId,surroundings:'1'},mapKey=`${home.addressId}:${bbox.join(',')}`;
 const saved=homeEnvironmentFallback(home);
 if(saved&&matches(saved.geometry.bbox))onUpdate?.(saved);
 const baseGeometry:HomeGeometry={...home,bbox,warnings:['Nabobygninger er ikke indlæst.']};
 let geometry=saved&&matches(saved.geometry.bbox)?saved.geometry:baseGeometry,heights:HomeHeights|null=saved&&matches(saved.geometry.bbox)?saved.heights:null;
 const details=Promise.all([
  homeInsight<HomeGeometry&{surroundings?:boolean}>('geometry',params,refresh).then(value=>{if(value.surroundings===true&&matches(value.bbox))geometry=value;}).catch(()=>{}),
  homeInsight<HomeHeights>('height',params,refresh).then(value=>{if(matches(value.bbox))heights=value;}).catch(()=>{})
 ]);
 const sources=[
  {url:`${API_URL}/api/address/search?${new URLSearchParams({mode:'orthophoto',bbox:bbox.join(',')})}`,textureSource:'KDS / GeoDanmark'},
  {url:`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${new URLSearchParams({bbox:bbox.join(','),bboxSR:'25832',imageSR:'25832',size:'600,450',format:'jpg',f:'image'})}`,textureSource:'Esri, Vantor, Earthstar Geographics, GIS User Community'}
 ];
 let map:{texture:string;textureSource:string}|undefined;
 let fallback=false,cached=false;
 for(const [index,source]of sources.entries()){
  try{map={texture:await environmentImage(source.url,signal),textureSource:source.textureSource};fallback=index>0;break;}catch{if(signal.aborted)throw Error('Kortindlæsning afbrudt.');}
 }
 if(!map){map=environmentMaps.get(mapKey)??(saved&&matches(saved.geometry.bbox)?{texture:saved.texture,textureSource:saved.textureSource??'KDS / GeoDanmark'}:undefined);cached=!!map;}
 if(!map)throw Error('Omgivelsernes luftfoto kunne ikke hentes.');
 environmentMaps.delete(mapKey);environmentMaps.set(mapKey,map);while(environmentMaps.size>2)environmentMaps.delete(environmentMaps.keys().next().value!);
 onUpdate?.({geometry,heights,...map,status:'Kort indlæst · henter terræn og nabobygninger'});
 await details;
 if(signal.aborted)throw Error('Kortindlæsning afbrudt.');
 const status=[cached?'Viser senest indlæste luftfoto':fallback?'Luftfoto med lavere detaljegrad':'',!heights?'Omgivende højder mangler · terræn er tilnærmet':'',geometry.warnings.length?'Nogle nabobygninger kunne ikke hentes':''].filter(Boolean).join(' · ');
 return {geometry,heights,...map,status};
}
export type AirQuality={readings:{pollutant:string;status:string;value?:number;year?:number;unit?:string;datasetId:string}[];source:string;notice:string};
export type EnergyLabel={status:string;source:string;labels:{id:string;grade:string;validFrom:string|null;validUntil:string|null;providerStatus:string;buildingNumber:string;heating:string;company:string}[]};
const memory=new Map<string,{at:number;data:unknown}>();
const pending=new Map<string,Promise<unknown>>();
export function homeInsight<T>(mode:string,params:Record<string,string>,refresh=false):Promise<T>{
  const query=new URLSearchParams({mode,...params}).toString(),saved=memory.get(query);
  if(!refresh&&saved&&Date.now()-saved.at<15*60000)return Promise.resolve(saved.data as T);
  const current=pending.get(query);if(current)return current as Promise<T>;
  const work=(async()=>{
    if(!refresh&&mode==='geometry'){const cached=await readHomeDetail<T>('geometry-v1:'+query);if(cached)return cached;}
    // React Native's abort-controller has no static AbortSignal.timeout.
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),mode==='model-photos'?55000:mode==='height'?45000:30000);
    try{
      const r=await fetch(`${API_URL}/api/address/search?${query}`,{headers:{Accept:'application/json'},signal:controller.signal});
      if(!r.ok)throw Error('Oplysningerne kunne ikke hentes. Prøv igen.');
      const data=await r.json();
      const valid=mode==='model-photos'?data?.addressId===params.id&&Array.isArray(data.photos)&&data.photos.length<=5&&data.photos.every((p:ModelPhoto)=>['south','east','north','west','nadir'].includes(p.direction)&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image)&&p.image.length<=1000000&&p.camera?.rotation?.length===9&&p.camera?.center?.length===3&&p.camera?.crop?.length===4&&[...p.camera.rotation,...p.camera.center,...p.camera.crop,...p.camera.focal,...p.camera.principal].every(Number.isFinite)):mode==='height'?data?.addressId===params.id&&Number.isInteger(data.width)&&data.width>=32&&data.width<=256&&Number.isInteger(data.height)&&data.height>=32&&data.height<=256&&Array.isArray(data.bbox)&&data.bbox.length===4&&Array.isArray(data.terrain)&&Array.isArray(data.surface)&&data.terrain.length===data.width*data.height&&data.surface.length===data.width*data.height:mode==='geometry'?data?.addressId===params.id&&Array.isArray(data.parcels)&&Array.isArray(data.buildings)&&Array.isArray(data.bbox)&&data.bbox.length===4:mode==='air'?Array.isArray(data?.readings):mode==='energy-label'?typeof data?.status==='string'&&Array.isArray(data.labels):false;
      if(!valid)throw Error('Serveren returnerede ikke de forventede boligoplysninger.');
      if(mode==='geometry')void saveHomeDetail('geometry-v1:'+query,data);
      if(mode==='model-photos'){const keys=[...memory.keys()].filter(k=>k.startsWith('mode=model-photos'));while(keys.length>=2)memory.delete(keys.shift()!);}
      if(memory.size>=40)memory.delete(memory.keys().next().value!);memory.set(query,{at:Date.now(),data});return data as T;
    }finally{clearTimeout(timer);}
  })();
  pending.set(query,work);void work.finally(()=>pending.delete(query)).catch(()=>{});return work;
}
