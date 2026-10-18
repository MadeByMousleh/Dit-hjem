import { API_URL } from './supabase';
export type XY=[number,number];
export type ModelPhoto={direction:string;capturedAt:string;width:number;height:number;image:string;camera:{rotation:number[];center:[number,number,number];sensor:[number,number];focal:[number,number];principal:[number,number];crop:[number,number,number,number]}};
export type HomeModelPhotos={addressId:string;photos:ModelPhoto[];status:string;source:string;notice?:string};
export type HomeMaterialColor={color:string;samples:number;views:number;confidence:'medium'|'low';years:string[]};
export type HomePhotoColors=Record<string,Partial<Record<'roof'|'walls',HomeMaterialColor>>>;
export type HomeHeights={addressId:string;bbox:[number,number,number,number];width:number;height:number;terrain:(number|null)[];surface:(number|null)[];resolution:[number,number];source:string;notice:string};
export type HomeGeometry={addressId:string;point:XY;bbox:[number,number,number,number];longitude:number;latitude:number;parcels:{id:string;number:string;registeredArea:number|null;polygons:XY[][][]}[];buildings:{id:string;bbrId:string|null;main:boolean;associated:boolean;rings:XY[][];height:number;heightSource:string;outlineSource:string}[];source:string;notice:string;warnings:string[]};
export type AirQuality={readings:{pollutant:string;status:string;value?:number;year?:number;unit?:string;datasetId:string}[];source:string;notice:string};
export type EnergyLabel={status:string;source:string;labels:{id:string;grade:string;validFrom:string|null;validUntil:string|null;providerStatus:string;buildingNumber:string;heating:string;company:string}[]};
const memory=new Map<string,{at:number;data:unknown}>();
const pending=new Map<string,Promise<unknown>>();
export function homeInsight<T>(mode:string,params:Record<string,string>,refresh=false):Promise<T>{
  const query=new URLSearchParams({mode,...params}).toString(),saved=memory.get(query);
  if(!refresh&&saved&&Date.now()-saved.at<15*60000)return Promise.resolve(saved.data as T);
  const current=pending.get(query);if(current)return current as Promise<T>;
  const work=(async()=>{
    // React Native's abort-controller has no static AbortSignal.timeout.
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),mode==='model-photos'?55000:mode==='height'?45000:30000);
    try{
      const r=await fetch(`${API_URL}/api/address/search?${query}`,{headers:{Accept:'application/json'},signal:controller.signal});
      if(!r.ok)throw Error('Oplysningerne kunne ikke hentes. Prøv igen.');
      const data=await r.json();
      const valid=mode==='model-photos'?data?.addressId===params.id&&Array.isArray(data.photos)&&data.photos.length<=5&&data.photos.every((p:ModelPhoto)=>['south','east','north','west','nadir'].includes(p.direction)&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image)&&p.image.length<=1000000&&p.camera?.rotation?.length===9&&p.camera?.center?.length===3&&p.camera?.crop?.length===4&&[...p.camera.rotation,...p.camera.center,...p.camera.crop,...p.camera.focal,...p.camera.principal].every(Number.isFinite)):mode==='height'?data?.addressId===params.id&&Number.isInteger(data.width)&&data.width>=32&&data.width<=256&&Number.isInteger(data.height)&&data.height>=32&&data.height<=256&&Array.isArray(data.bbox)&&data.bbox.length===4&&Array.isArray(data.terrain)&&Array.isArray(data.surface)&&data.terrain.length===data.width*data.height&&data.surface.length===data.width*data.height:mode==='geometry'?data?.addressId===params.id&&Array.isArray(data.parcels)&&Array.isArray(data.buildings)&&Array.isArray(data.bbox)&&data.bbox.length===4:mode==='air'?Array.isArray(data?.readings):mode==='energy-label'?typeof data?.status==='string'&&Array.isArray(data.labels):false;
      if(!valid)throw Error('Serveren returnerede ikke de forventede boligoplysninger.');
      if(mode==='model-photos'){const keys=[...memory.keys()].filter(k=>k.startsWith('mode=model-photos'));while(keys.length>=2)memory.delete(keys.shift()!);}
      if(memory.size>=40)memory.delete(memory.keys().next().value!);memory.set(query,{at:Date.now(),data});return data as T;
    }finally{clearTimeout(timer);}
  })();
  pending.set(query,work);void work.finally(()=>pending.delete(query)).catch(()=>{});return work;
}
