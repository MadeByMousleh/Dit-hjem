import AsyncStorage from '@react-native-async-storage/async-storage';
import {writeOptionalCache} from './local-storage-cache.mjs';
export type HomeOverviewSnapshot={v:1;address:string;property:any;location:{x:number;y:number}|null;supplierName?:string;supplierSource?:string;fetchedAt:number};
const memory=new Map<string,HomeOverviewSnapshot>();
const details=new Map<string,{at:number;data:unknown}>();
export async function readHomeDetail<T>(id:string):Promise<T|null>{
 const key='stromblik.public-history.v1.home-detail.'+encodeURIComponent(id);
 try{const saved=details.get(key)??JSON.parse(await AsyncStorage.getItem(key)??'null');if(saved&&Number.isFinite(saved.at)&&Date.now()-saved.at<86400000){details.set(key,saved);return saved.data as T;}}catch{}
 return null;
}
export async function saveHomeDetail(id:string,data:unknown){
 const key='stromblik.public-history.v1.home-detail.'+encodeURIComponent(id),value={at:Date.now(),data};
 if(details.size>=20)details.delete(details.keys().next().value!);details.set(key,value);
 try{await writeOptionalCache(AsyncStorage,key,JSON.stringify(value));}catch{}
}
export const homeOverviewKey=(user:string,household:string,address:string)=>'stromblik.public-history.v1.home.'+encodeURIComponent(JSON.stringify([user,household,address]));
export const peekHomeOverview=(key:string)=>memory.get(key);
export async function readHomeOverview(key:string,address:string){
 const cached=memory.get(key);if(cached?.address===address)return cached;
 try{const raw=await AsyncStorage.getItem(key),v=raw?JSON.parse(raw):null;if(v?.v===1&&v.address===address&&Array.isArray(v.property?.sections)&&v.property?.addressId&&Number.isFinite(v.fetchedAt)){memory.set(key,v);return v as HomeOverviewSnapshot;}}catch{}
 return null;
}
export async function saveHomeOverview(key:string,snapshot:HomeOverviewSnapshot){
 if(memory.size>=12)memory.delete(memory.keys().next().value!);memory.set(key,snapshot);
 try{await writeOptionalCache(AsyncStorage,key,JSON.stringify(snapshot));}catch{}
}
export function gridCompanyName(id:string|undefined,name:string|undefined){
 const known:Record<string,string>={n1_c:'N1 A/S',n1_344:'N1 A/S',radius_c:'Radius Elnet A/S',cerius_c:'Cerius A/S','trefor_el-net_c':'TREFOR El-net A/S','trefor_el-net_oest_c':'TREFOR El-net Øst A/S'};
 if(!name||name===id||/^[a-z0-9]+(?:_[a-z0-9-]+)+$/.test(name))return known[id??''];
 return known[name]??name;
}
