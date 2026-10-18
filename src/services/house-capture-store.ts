import * as FS from 'expo-file-system/legacy';
import type {ImagePickerAsset} from 'expo-image-picker';
export type HouseCapture={id:string;faceId:string;uri:string;width:number;height:number;bytes:number;createdAt:string};
export type CaptureScope={userId:string;householdId:string;addressId:string};
const MAX_BYTES=120*1024*1024,MAX_FILE=20*1024*1024;
let queue=Promise.resolve();
function location(scope:CaptureScope){
 if(![scope.userId,scope.householdId,scope.addressId].every(id=>/^[a-f0-9-]{36}$/i.test(id)))throw Error('Log ind og vælg dit hjem først.');
 if(!FS.documentDirectory)throw Error('Billeder kan ikke gemmes på denne enhed.');
 return `${FS.documentDirectory}house-captures-v1/${scope.userId}/${scope.householdId}/${scope.addressId}/`;
}
function validRecord(p:HouseCapture){return p&&/^[a-z0-9-]+$/.test(p.id)&&typeof p.faceId==='string'&&p.faceId.length<160&&Number.isFinite(p.bytes)&&p.bytes>0&&p.bytes<=MAX_FILE&&p.width>0&&p.height>0;}
export async function readHouseCaptures(scope:CaptureScope):Promise<HouseCapture[]>{
 const dir=location(scope);const info=await FS.getInfoAsync(dir+'manifest.json');if(!info.exists)return [];
 if(info.size>100000)throw Error('Den gemte billedoversigt kunne ikke læses.');
 const data=JSON.parse(await FS.readAsStringAsync(dir+'manifest.json'));
 if(data.version!==1||!Array.isArray(data.photos)||data.photos.length>60||!data.photos.every(validRecord))throw Error('Den gemte billedoversigt kunne ikke læses.');
 return data.photos.map((p:HouseCapture)=>({...p,uri:`${dir}${p.id}.image`}));
}
const serialized=<T,>(work:()=>Promise<T>)=>{const next=queue.then(work,work);queue=next.then(()=>{},()=>{});return next;};
async function manifest(dir:string,photos:HouseCapture[]){
 await FS.writeAsStringAsync(dir+'manifest-next.json',JSON.stringify({version:1,photos:photos.map(p=>({...p,uri:undefined}))}));
 await FS.moveAsync({from:dir+'manifest-next.json',to:dir+'manifest.json'});
}
export function addHouseCapture(scope:CaptureScope,faceId:string,asset:ImagePickerAsset):Promise<HouseCapture[]>{return serialized(async()=>{
 const dir=location(scope);if(!faceId||faceId.length>160||Math.min(asset.width,asset.height)<600)throw Error('Vælg et skarpere billede på mindst 600 pixels på den korte side.');
 const photos=await readHouseCaptures(scope);if(photos.length>=60||photos.filter(p=>p.faceId===faceId).length>=6)throw Error('Der er plads til 6 billeder pr. facade og 60 pr. hjem.');
 const source=await FS.getInfoAsync(asset.uri);if(!source.exists)throw Error('Det valgte billede kunne ikke læses.');const bytes=source.size;
 if(!bytes||bytes>MAX_FILE)throw Error('Billedet må højst fylde 20 MB.');
 if(photos.reduce((sum,p)=>sum+p.bytes,0)+bytes>MAX_BYTES)throw Error('Billederne fylder 120 MB. Fjern et billede før du tilføjer flere.');
 if(await FS.getFreeDiskStorageAsync()<bytes+32*1024*1024)throw Error('Der mangler ledig plads. Frigør plads før du gemmer billeder.');
 const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
 const capture:HouseCapture={id,faceId,uri:`${dir}${id}.image`,width:asset.width,height:asset.height,bytes,createdAt:new Date().toISOString()};
 await FS.makeDirectoryAsync(dir,{intermediates:true});await FS.copyAsync({from:asset.uri,to:capture.uri});
 try{await manifest(dir,[...photos,capture]);}catch(error){await FS.deleteAsync(capture.uri,{idempotent:true}).catch(()=>{});throw error;}
 return [...photos,capture];
});}
export function removeHouseCapture(scope:CaptureScope,id:string):Promise<HouseCapture[]>{return serialized(async()=>{
 const dir=location(scope),photos=await readHouseCaptures(scope),capture=photos.find(p=>p.id===id);if(!capture)return photos;
 const remaining=photos.filter(p=>p.id!==id);await manifest(dir,remaining);await FS.deleteAsync(`${dir}${capture.id}.image`,{idempotent:true});return remaining;
});}
