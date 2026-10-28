import jpeg from 'jpeg-js';
import {createHash} from 'node:crypto';
import {maskFromRuns,runsFor,assessMask} from './sampling.mjs';

export const hexValid = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
export const rgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export const hex = values => '#'+values.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
// Stable split by physical building: every facade and every revision stays together.
export const split = buildingId => parseInt(createHash('sha256').update(buildingId).digest('hex').slice(0,8),16)%5===0?'test':'train';
export class InsufficientFacadePixelsError extends Error {
  constructor(message='For få brugbare facadepixels.'){super(message);this.name='InsufficientFacadePixelsError';}
}
export function sampledPixels(patch){
  const image=jpeg.decode(Buffer.from(patch.image,'base64'),{maxMemoryUsageInMB:48,maxResolutionInMP:2});
  const strict=patch.samplingVersion===2;
  let mask=null;
  if(strict){
    if(image.width!==patch.width||image.height!==patch.height)throw Error('Facadeudsnit og maske har forskellig størrelse.');
    mask=maskFromRuns(patch.maskRuns,patch.width,patch.height);
    const indices=[];for(let i=0;i<mask.length;i++)if(mask[i])indices.push(i);
    const quality=assessMask(indices,patch.width);
    if(patch.quality?.accepted===false||!quality.accepted)throw new InsufficientFacadePixelsError(patch.quality?.reason||quality.reason);
  }
  const indices=[],channels=[[],[],[]];
  for(let pixel=0;pixel<image.width*image.height;pixel+=4){
    if(mask&&!mask[pixel])continue;
    const i=pixel*4,c=[image.data[i],image.data[i+1],image.data[i+2]];
    if(c.reduce((a,b)=>a+b,0)<60||Math.max(...c)>248)continue;
    indices.push(pixel);c.forEach((v,j)=>channels[j].push(v));
  }
  if(strict&&indices.length<32)throw new InsufficientFacadePixelsError('For få farvepixels i dette foto (mindst 32).');
  return {indices,channels};
}
export function features(patches) {
  const channels=[[],[],[]];
  for(const patch of patches){
    const sampled=sampledPixels(patch);
    sampled.channels.forEach((c,j)=>{for(const v of c)channels[j].push(v);});
  }
  if(channels[0].length<20)throw new InsufficientFacadePixelsError();
  return channels.flatMap(c=>{c.sort((a,b)=>a-b);return [.25,.5,.75].map(q=>c[Math.floor((c.length-1)*q)]/255);});
}
export function facadeFeatures(patches){
  const faces=[],rejectedFaces=[],rejectedViews=[];
  for(const faceId of new Set(patches.map(p=>p.faceId))){
    const views=[];
    for(const patch of patches.filter(p=>p.faceId===faceId)){
      if(patch.samplingVersion!==2){views.push(patch);continue;}
      try{const sampled=sampledPixels(patch);views.push({...patch,sampleRuns:runsFor(sampled.indices),sampleCount:sampled.indices.length});}
      catch(e){if(!(e instanceof InsufficientFacadePixelsError))throw e;rejectedViews.push({...patch,rejectionReason:e.message});}
    }
    try{faces.push({faceId,views,feature:features(views)});}
    catch(e){
      if(!(e instanceof InsufficientFacadePixelsError))throw e;
      rejectedFaces.push(faceId);
    }
  }
  return {faces,rejectedFaces,rejectedViews};
}
export function baseline(feature){return hex([feature[1],feature[4],feature[7]].map(v=>v*255));}
export function predict(model,feature){
  if(!model?.samples?.length)return baseline(feature);
  const neighbors=model.samples.map(s=>({...s,d:Math.hypot(...feature.map((x,i)=>x-s.feature[i]))})).sort((a,b)=>a.d-b.d).slice(0,5);
  const weight=s=>1/(s.d+.025)**2,total=neighbors.reduce((n,s)=>n+weight(s),0);
  return hex([0,1,2].map(i=>neighbors.reduce((n,s)=>n+rgb(s.hex)[i]*weight(s),0)/total));
}
export function train(rows) {
  const samples=rows.filter(r=>r.status==='approved'&&r.hex&&r.feature&&split(r.buildingId)==='train');
  const test=rows.filter(r=>r.status==='approved'&&r.hex&&r.feature&&split(r.buildingId)==='test');
  if(new Set(samples.map(r=>r.buildingId)).size<3)throw Error('Godkend mindst tre forskellige træningshuse først. Testhuse holdes udenfor.');
  const model={version:new Date().toISOString(),method:'distance-weighted-knn-v1',featureVersion:1,samples:samples.map(({buildingId,faceId,feature,hex})=>({buildingId,faceId,feature,hex})),trainingBuildings:new Set(samples.map(s=>s.buildingId)).size};
  const mae=fn=>test.length?test.reduce((sum,r)=>sum+rgb(fn(r.feature)).reduce((n,v,i)=>n+Math.abs(v-rgb(r.hex)[i]),0)/3,0)/test.length:null;
  return {...model,evaluation:{testBuildings:new Set(test.map(s=>s.buildingId)).size,testFacades:test.length,rgbMAE:mae(f=>predict(model,f)),baselineRgbMAE:mae(baseline),notice:'RGB-fejl 0–255 mod dine HEX-godkendelser. Lille, husopdelt testgruppe; ingen dokumenteret fysisk farvenøjagtighed.'}};
}
