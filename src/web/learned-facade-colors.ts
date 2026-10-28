import {facadeColorModel} from '../generated/facade-color-model';
import type {HomePhotoColors} from '../services/home-insights';
import type {WallColorPatch} from '../services/facade-colors';
import {maskFromRuns,assessMask} from '../services/facade-color-sampling.mjs';
export type FacadeColorModel={version:string;featureVersion:number;maxDistance:number;samples:{feature:number[];hex:string}[]};
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=(values:number[])=>'#'+values.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export function predictFacadeColor(feature:number[],model:FacadeColorModel=facadeColorModel){
 if(model.featureVersion!==1||feature.length!==9||feature.some(v=>!Number.isFinite(v)||v<0||v>1))return null;
 const nearest=model.samples.map(s=>({...s,d:Math.hypot(...feature.map((v,i)=>v-s.feature[i]!))})).sort((a,b)=>a.d-b.d).slice(0,5);
 if(!nearest.length||nearest[0]!.d>model.maxDistance)return null;
 const weight=(s:typeof nearest[number])=>1/(s.d+.025)**2,total=nearest.reduce((n,s)=>n+weight(s),0);
 return {color:hex([0,1,2].map(i=>nearest.reduce((n,s)=>n+rgb(s.hex)[i]!*weight(s),0)/total)),distance:nearest[0]!.d};
}
export function facadePixelChannels(patch:WallColorPatch,image:Pick<ImageData,'width'|'height'|'data'>){
 if(patch.samplingVersion!==2||patch.quality?.accepted===false||!patch.maskRuns||image.width!==patch.width||image.height!==patch.height)return null;
 const mask=maskFromRuns(patch.maskRuns,patch.width,patch.height),indices=[];
 for(let i=0;i<mask.length;i++)if(mask[i])indices.push(i);
 if(!assessMask(indices,patch.width).accepted)return null;
 const channels:number[][]=[[],[],[]];
 for(let pixel=0;pixel<mask.length;pixel+=4){if(!mask[pixel])continue;const at=pixel*4,c=[image.data[at]!,image.data[at+1]!,image.data[at+2]!];if(c.reduce((a,b)=>a+b,0)<60||Math.max(...c)>248)continue;c.forEach((v,i)=>channels[i]!.push(v));}
 return channels[0]!.length>=32?channels:null;
}
export const channelFeatures=(channels:number[][])=>channels.flatMap(values=>{const sorted=values.slice().sort((a,b)=>a-b);return [.25,.5,.75].map(q=>sorted[Math.floor((sorted.length-1)*q)]!/255);});
export async function learnedFacadeColors(patches:WallColorPatch[],alive:()=>boolean,decode:(image:string)=>Promise<ImageData>,model:FacadeColorModel=facadeColorModel):Promise<HomePhotoColors>{
 const groups=new Map<string,{patch:WallColorPatch;channels:number[][]}[]>();
 for(const patch of patches){if(!alive())return {};let channels;try{channels=facadePixelChannels(patch,await decode(patch.image));}catch{continue;}if(!channels)continue;const group=groups.get(patch.buildingId)??[];group.push({patch,channels});groups.set(patch.buildingId,group);}
 const output:HomePhotoColors={};
 for(const [id,views]of groups){
  const predictions:{color:string;views:typeof views}[]=[];
  for(const face of new Set(views.map(v=>v.patch.faceId))){const same=views.filter(v=>v.patch.faceId===face),channels=[0,1,2].map(c=>same.flatMap(v=>v.channels[c]!)),prediction=predictFacadeColor(channelFeatures(channels),model);if(prediction)predictions.push({color:prediction.color,views:same});}
  const accepted=predictions.flatMap(p=>p.views),viewIds=new Set(accepted.map(v=>v.patch.viewId));
  if(viewIds.size<2||!predictions.length)continue;
  // Training labels are one HEX per whole house. Give one robust house-level
  // proposal; do not copy one building's prediction to a different building.
  const color=hex([0,1,2].map(c=>{const values=predictions.map(p=>rgb(p.color)[c]!).sort((a,b)=>a-b);return values[Math.floor(values.length/2)]!;}));
  output[id]={walls:{color,uniform:true,samples:accepted.reduce((n,v)=>n+v.channels[0]!.length,0),views:viewIds.size,confidence:'low',years:[...new Set(accepted.map(v=>v.patch.year))],method:'trained-facade-knn-v1',modelVersion:model.version,evidence:accepted.map(v=>({viewId:v.patch.viewId,faceId:v.patch.faceId,year:v.patch.year,pixels:v.channels[0]!.length}))}};
 }
 return alive()?output:{};
}
