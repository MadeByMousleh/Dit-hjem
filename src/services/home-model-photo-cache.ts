import * as FileSystem from 'expo-file-system/legacy';
import {Platform} from 'react-native';
import {API_URL} from './supabase';
import {homeInsight,type HomeModelPhotos} from './home-insights';
const directory=Platform.OS!=='web'&&FileSystem.cacheDirectory?`${FileSystem.cacheDirectory}home-model-photos-v2/`:null;
let queue=Promise.resolve();
function filename(id:string){let hash=0;for(const c of API_URL)hash=(Math.imul(31,hash)+c.charCodeAt(0))|0;return `${(hash>>>0).toString(16)}-${id}.json`;}
export async function loadModelPhotos(id:string,refresh=false):Promise<HomeModelPhotos>{
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Ugyldig adresse.');const name=filename(id);
 if(directory&&!refresh)try{const info=await FileSystem.getInfoAsync(directory+name);if(info.exists&&info.size<=3000000){const cached=JSON.parse(await FileSystem.readAsStringAsync(directory+name));if(cached.data?.addressId===id&&Array.isArray(cached.data.photos)&&cached.data.photos.length>0&&cached.data.photos.length<=5&&Date.now()-cached.at<86400000)return cached.data;}}catch{}
 const data=await homeInsight<HomeModelPhotos>('model-photos',{id},refresh);
 if(directory&&data.photos.length){const value=JSON.stringify({at:Date.now(),data});if(value.length<=3000000){queue=queue.then(async()=>{try{await FileSystem.makeDirectoryAsync(directory,{intermediates:true});await FileSystem.writeAsStringAsync(directory+name,value);const names=(await FileSystem.readDirectoryAsync(directory)).filter(n=>/^[a-f0-9]+-[0-9a-f-]{36}\.json$/i.test(n));const entries=await Promise.all(names.map(async file=>{const info=await FileSystem.getInfoAsync(directory+file);return {file,size:info.exists?info.size:0,at:info.exists?info.modificationTime:0};}));let total=entries.reduce((sum,e)=>sum+e.size,0),count=entries.length;for(const entry of entries.sort((a,b)=>a.at-b.at)){if(total<=8*1024*1024&&count<=4)break;if(entry.file===name)continue;await FileSystem.deleteAsync(directory+entry.file,{idempotent:true});total-=entry.size;count--;}}catch{/* Optional image cache must not block the model or touch app data. */}});}}
 return data;
}
