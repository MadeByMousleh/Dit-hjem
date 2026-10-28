import jpeg from 'jpeg-js';
import {createHash} from 'node:crypto';
import {polygonMask} from './polygon.mjs';
import {photoKey,assessMask} from './sampling.mjs';
import {facadeFeatures,baseline,predict,split} from './model.mjs';

export const evidenceSnapshot=t=>({faces:t.faces,rejectedFaces:t.rejectedFaces??[],rejectedViews:t.rejectedViews??[],samplingVersion:t.samplingVersion??1,manualSelections:t.manualSelections??[],semanticSampling:t.semanticSampling??null});

export function manualAnalysis(task,selections,model){
  if(!Array.isArray(selections)||selections.length>8)throw Error('Ugyldige tegnede områder.');
  if(!selections.length){
    if(!task.automaticAnalysis) return {...evidenceSnapshot(task),manualSelections:[]};
    return {...task.automaticAnalysis,manualSelections:[]};
  }
  const main=task.config.geometry.buildings.find(b=>b.main);
  if(!main)throw Error('Husets bygning mangler.');
  const photos=new Map(task.config.photos.photos.filter(p=>p.direction!=='nadir').map(p=>[photoKey(p),p]));
  const keys=new Set(),patches=[],clean=[];
  for(const selection of selections){
    if(!selection||typeof selection.photoKey!=='string'||keys.has(selection.photoKey)||!photos.has(selection.photoKey))throw Error('Området matcher ikke et originalfoto, eller fotoet er valgt flere gange.');
    keys.add(selection.photoKey);const photo=photos.get(selection.photoKey);
    if(!photo.image.startsWith('data:image/jpeg;base64,'))throw Error('Originalfotoet skal være JPEG.');
    const source=jpeg.decode(Buffer.from(photo.image.split(',')[1],'base64'),{maxMemoryUsageInMB:48,maxResolutionInMP:2});
    const polygon=polygonMask(selection.points,source.width,source.height),quality=assessMask(polygon.indices,polygon.width);
    if(!quality.accepted)throw Error(quality.reason);
    const data=Buffer.alloc(polygon.width*polygon.height*4);for(let i=3;i<data.length;i+=4)data[i]=255;
    for(const i of polygon.indices){const x=i%polygon.width+polygon.contextCrop[0],y=Math.floor(i/polygon.width)+polygon.contextCrop[1];data.set(source.data.subarray((y*source.width+x)*4,(y*source.width+x)*4+3),i*4);}
    const faceId=`manual:${main.id}:${createHash('sha256').update(selection.photoKey).digest('hex').slice(0,16)}`;
    patches.push({faceId,buildingId:main.id,viewId:`manual-${photo.direction}`,year:photo.capturedAt.slice(0,4),photoKey:selection.photoKey,samplingVersion:2,selectionMethod:'human-polygon',polygon:selection.points.map(p=>[...p]),width:polygon.width,height:polygon.height,contextCrop:polygon.contextCrop,contextSize:[source.width,source.height],maskRuns:polygon.maskRuns,quality:{accepted:true,margin:0},image:jpeg.encode({data,width:polygon.width,height:polygon.height},100).data.toString('base64')});
    clean.push({photoKey:selection.photoKey,points:selection.points.map(p=>[...p])});
  }
  const result=facadeFeatures(patches);
  if(result.rejectedViews.length||result.faces.length!==selections.length)throw Error('Et tegnet område har for få brugbare farvepixels. Tegn et større, tydeligt vægområde.');
  return {samplingVersion:2,manualSelections:clean,semanticSampling:null,rejectedFaces:[],rejectedViews:[],faces:result.faces.map(({faceId,views,feature})=>({faceId,buildingId:main.id,feature,baseline:baseline(feature),prediction:predict(model,feature),modelVersion:model?.version??'pixel-median-v1',split:split(main.id),patches:views,selectionMethod:'human-polygon',photoReferences:views.map(p=>({photoKey:p.photoKey}))}))};
}
