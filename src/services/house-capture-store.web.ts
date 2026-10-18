import type {ImagePickerAsset} from 'expo-image-picker';
import type {CaptureScope,HouseCapture} from './house-capture-store';
export type {CaptureScope,HouseCapture} from './house-capture-store';
// Browser stores the original Blob in IndexedDB, never base64 in localStorage.
const key=(s:CaptureScope)=>{if(![s.userId,s.householdId,s.addressId].every(id=>/^[a-f0-9-]{36}$/i.test(id)))throw Error('Log ind og vælg dit hjem først.');return [s.userId,s.householdId,s.addressId].join(':');};
function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('house-captures-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('homes');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Browseren kunne ikke gemme billeder.'));});}
type Stored={photo:HouseCapture;blob:Blob};
async function records(scope:CaptureScope):Promise<Stored[]>{const id=key(scope),database=await db();try{return await new Promise((resolve,reject)=>{const r=database.transaction('homes').objectStore('homes').get(id);r.onsuccess=()=>resolve(r.result??[]);r.onerror=()=>reject(Error('Billederne kunne ikke læses.'));});}finally{database.close();}}
async function write(scope:CaptureScope,items:Stored[]){const id=key(scope),database=await db();try{await new Promise<void>((resolve,reject)=>{const tx=database.transaction('homes','readwrite');tx.objectStore('homes').put(items,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Der er ikke plads til billederne i browseren.'));tx.onabort=()=>reject(Error('Billederne kunne ikke gemmes.'));});}finally{database.close();}}
const urls=new Map<string,string>();
function output(items:Stored[]){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();return items.map(({photo,blob})=>{const uri=URL.createObjectURL(blob);urls.set(photo.id,uri);return {...photo,uri};});}
let queue=Promise.resolve();const serial=<T,>(work:()=>Promise<T>)=>{const next=queue.then(work,work);queue=next.then(()=>{},()=>{});return next;};
export async function readHouseCaptures(scope:CaptureScope){return output(await records(scope));}
export function addHouseCapture(scope:CaptureScope,faceId:string,asset:ImagePickerAsset){return serial(async()=>{
 const items=await records(scope);if(items.length>=60||items.filter(p=>p.photo.faceId===faceId).length>=6)throw Error('Der er plads til 6 billeder pr. facade og 60 pr. hjem.');
 if(Math.min(asset.width,asset.height)<600)throw Error('Vælg et skarpere billede på mindst 600 pixels på den korte side.');
 const blob=asset.file??await(await fetch(asset.uri)).blob();if(!blob.size||blob.size>20*1024*1024||!blob.type.startsWith('image/'))throw Error('Vælg et billede på højst 20 MB.');
 if(items.reduce((sum,p)=>sum+p.blob.size,0)+blob.size>120*1024*1024)throw Error('Fjern et billede før du tilføjer flere. Grænsen er 120 MB pr. hjem.');
 const photo:HouseCapture={id:crypto.randomUUID(),faceId,uri:'',width:asset.width,height:asset.height,bytes:blob.size,createdAt:new Date().toISOString()};
 const next=[...items,{photo,blob}];await write(scope,next);return output(next);
});}
export function removeHouseCapture(scope:CaptureScope,id:string){return serial(async()=>{const next=(await records(scope)).filter(p=>p.photo.id!==id);await write(scope,next);return output(next);});}
