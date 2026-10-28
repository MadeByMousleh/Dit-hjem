import type {WallColorPatch} from '../services/facade-colors';
import type {HomePhotoColors} from '../services/home-insights';
import {dominantColor} from './photo-materials';
import {learnedFacadeColors} from './learned-facade-colors';
type RGB=[number,number,number];
const chroma=(c:RGB)=>{const sum=c.reduce((a,b)=>a+b,0);return c.map(v=>v/sum);};
const distance=(a:RGB,b:RGB)=>Math.hypot(...chroma(a).map((v,i)=>v-chroma(b)[i]!));
const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]!;
/** Photographic appearance, not brick/mortar segmentation or measured albedo. */
export function combineFacadeViews(views:{faceId:string;viewId:string;rgb:RGB;count:number;year:string}[],preferBright=false){
 const faces:Record<string,string>={},accepted:typeof views=[];
 for(const id of new Set(views.map(v=>v.faceId))){
  const candidates=views.filter(v=>v.faceId===id),group=candidates.map(a=>candidates.filter(b=>distance(a.rgb,b.rgb)<.06)).sort((a,b)=>b.length-a.length)[0]??[];
  if(new Set(group.map(v=>v.viewId)).size<2)continue;
  // Prefer the brighter agreeing observation, not a shadow-darkened average.
  const best=group.slice().sort((a,b)=>b.rgb.reduce((n,v)=>n+v,0)-a.rgb.reduce((n,v)=>n+v,0))[0]!;
  faces[id]='#'+best.rgb.map(v=>v.toString(16).padStart(2,'0')).join('');accepted.push(...group);
 }
 if(!accepted.length)return null;
 // Low-chroma roof edges, mortar and shadow can otherwise bridge unrelated
 // clusters and pull every facade towards grey/brown. Require a tighter colour
 // agreement and prefer a supported chromatic material over neutral contamination.
 const spread=(c:RGB)=>Math.max(...chroma(c))-Math.min(...chroma(c));
 const groups=accepted.map(a=>accepted.filter(b=>distance(a.rgb,b.rgb)<.025)).filter(group=>new Set(group.map(v=>v.viewId)).size>=2);
 const chromatic=groups.filter(group=>group.every(v=>spread(v.rgb)>.065));
 const brightest=accepted.slice().sort((a,b)=>b.rgb.reduce((n,c)=>n+c,0)-a.rgb.reduce((n,c)=>n+c,0))[0]!;
 const strongest=preferBright?accepted.filter(v=>v.faceId===brightest.faceId):(chromatic.length?chromatic:groups).sort((a,b)=>b.length-a.length)[0];if(!strongest)return null;
 const best=strongest.slice().sort((a,b)=>b.rgb.reduce((n,v)=>n+v,0)-a.rgb.reduce((n,v)=>n+v,0))[0]!,rgb=best.rgb;
 const distinct=accepted.filter(v=>spread(v.rgb)>.065&&distance(v.rgb,rgb)>.09);
 const uniform=!distinct.length;
 return {color:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),uniform,faces,samples:accepted.reduce((n,v)=>n+v.count,0),views:new Set(accepted.map(v=>v.viewId)).size,confidence:'low' as const,years:[...new Set(accepted.map(v=>v.year))]};
}
export async function facadePhotoColors(patches:WallColorPatch[],alive:()=>boolean,associatedIds=new Set<string>()):Promise<HomePhotoColors>{
 const decoded=new Map<string,ImageData>(),groups=new Map<string,Parameters<typeof combineFacadeViews>[0]>();
 async function pixels(src:string){if(decoded.has(src))return decoded.get(src)!;const img=new Image();img.src=`data:image/jpeg;base64,${src}`;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const c=canvas.getContext('2d',{willReadFrequently:true})!;c.imageSmoothingEnabled=false;c.drawImage(img,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height);decoded.set(src,data);return data;}
 for(const patch of patches){if(!alive())return {};
  const mask=await pixels(patch.image),source=patch.contextImage?await pixels(patch.contextImage):mask,[left,top]=patch.contextCrop??[0,0],samples:RGB[]=[];
  // Lower/middle wall: avoid the roof strip and the plinth. No resize, sharpen,
  // white-balance adjustment, generated detail or assumed yellow/red hue.
  for(let y=Math.floor(mask.height*.4);y<Math.ceil(mask.height*.9);y++)for(let x=1;x<mask.width-1;x++){
   const i=(y*mask.width+x)*4;if(mask.data[i]!+mask.data[i+1]!+mask.data[i+2]!<45)continue;
   const at=((top+y)*source.width+left+x)*4,c=[source.data[at]!,source.data[at+1]!,source.data[at+2]!] as RGB,l=c.reduce((a,b)=>a+b,0)/3;
   if(l<45||l>225)continue;samples.push(c);
  }
  const result=dominantColor(samples);if(result){const group=groups.get(patch.buildingId)??[];group.push({faceId:patch.faceId,viewId:patch.viewId,rgb:result.rgb,count:samples.length,year:patch.year});groups.set(patch.buildingId,group);}
  await new Promise<void>(r=>setTimeout(r,0));
 }
 const output:HomePhotoColors={};for(const [id,views]of groups){const walls=combineFacadeViews(views,associatedIds.has(id));if(walls)output[id]={walls};}
 const learned=await learnedFacadeColors(patches,alive,pixels);if(!alive())return {};
 for(const [id,color]of Object.entries(learned))output[id]={...output[id],...color};return output;
}
