import {createHash} from 'node:crypto';
const agent='DitHjemColorPilot/0.1 (user-authorized EDC image research)';
export function listingUrl(value){const url=new URL(value,'https://www.edc.dk');if(url.origin!=='https://www.edc.dk'||!/^\/alle-boliger\/villa\/[a-z0-9-]+\/[a-z0-9-]+\/\d+\/$/i.test(url.pathname)||url.search||url.hash)throw Error('Vælg en offentlig EDC-villaannonce.');return url.href;}
export async function boundedFetch(url,{fetcher=fetch,max=4000000,...options}={}){
 const response=await fetcher(url,{...options,headers:{'User-Agent':agent,...options.headers},redirect:'error',signal:options.signal??AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Datakilden svarede ${response.status}.`);
 let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Datakilden returnerede for meget data.');chunks.push(chunk);}return {bytes:Buffer.concat(chunks),mime:response.headers.get('content-type')?.split(';')[0]};
}
export function parseListing(html,url){
 const records=[];for(const match of html.matchAll(/<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g))try{records.push(JSON.parse(match[1]));}catch{}
 const item=records.find(r=>r.estateTypeName==='Villa'&&r.caseNumber&&r.address&&/^\d{4}$/.test(r.zipCode)&&Array.isArray(r.images));
 if(!item)throw Error('EDC-annoncen har ikke de forventede villaoplysninger.');
 const images=[];for(const [index,image]of item.images.entries()){
  const sources=(image.sources??[]).filter(s=>{try{const u=new URL(s.src);return u.protocol==='https:'&&u.hostname==='billeder.edc.dk'&&u.pathname.startsWith('/edcmedia/')&&/\.jpe?g$/i.test(u.pathname)&&s.width>=200&&s.width<=1920;}catch{return false;}}).sort((a,b)=>a.width-b.width);
  const small=sources.find(s=>s.width>=300),large=sources.find(s=>s.width>=1000)??sources.at(-1);if(!small||!large)continue;
  images.push({id:`sale-${index}`,thumbnailUrl:small.src,url:large.src});
 }
 if(images.length<3)throw Error('Annoncen har færre end tre understøttede EDC-fotos.');
 const seenPlans=new Set(),floorPlans=[];
 for(const [index,plan]of (Array.isArray(item.bluePrints)?item.bluePrints:[]).entries()){
  const sources=(plan.sources??[]).filter(s=>{try{const u=new URL(s.src);return u.protocol==='https:'&&u.hostname==='billeder.edc.dk'&&u.pathname.startsWith('/edcmedia/')&&/\.jpe?g$/i.test(u.pathname)&&s.width>=200&&s.width<=1920;}catch{return false;}}).sort((a,b)=>b.width-a.width);
  const source=sources[0];if(!source||seenPlans.has(source.src))continue;seenPlans.add(source.src);
  floorPlans.push({id:`plan-${index}`,url:source.src,width:source.width,height:source.height,sourceIndex:index,caption:String(plan.caption??plan.title??'').slice(0,256)});
 }
 return {source:'EDC',galleryVersion:2,url:listingUrl(url),caseNumber:String(item.caseNumber),address:{street:item.address,postcode:item.zipCode,city:item.city,text:`${item.address}, ${item.zipCode} ${item.city}`},images,floorPlans,floorPlanSourceCount:Array.isArray(item.bluePrints)?item.bluePrints.length:0,fetchedAt:new Date().toISOString(),rights:{status:'user-confirmed',confirmedAt:'2026-10-21',scope:'EDC photos for AI training, confirmed in conversation'},notice:'Alle understøttede gallerifotos gennemgås i batches. Plantegninger arkiveres separat og indgår ikke i facadefarvetræningen.'};
}
export async function discover({fetcher=fetch,page=0}={}){
 const {bytes}=await boundedFetch('https://www.edc.dk/bolig/villa/'+(page?`?side=${page}`:''),{fetcher});
 return [...new Set([...bytes.toString('utf8').matchAll(/href="(\/alle-boliger\/villa\/[^"?#]+)"/g)].map(m=>listingUrl(m[1])))];
}
export async function fetchListing(url,options){const normalized=listingUrl(url),{bytes}=await boundedFetch(normalized,options);return parseListing(bytes.toString('utf8'),normalized);}
export async function fetchPhoto(url,{fetcher=fetch}={}){
 const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='billeder.edc.dk'||!u.pathname.startsWith('/edcmedia/'))throw Error('Ukendt billedkilde.');
 const {bytes,mime}=await boundedFetch(u.href,{fetcher,max:3000000});if(mime!=='image/jpeg'||bytes[0]!==255||bytes[1]!==216)throw Error('EDC returnerede ikke et JPEG-foto.');
 return {image:`data:image/jpeg;base64,${bytes.toString('base64')}`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}
