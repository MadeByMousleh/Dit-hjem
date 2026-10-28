import {facadeFeatures,baseline,predict,split} from './model.mjs';

export async function analyzeTaskPatches(store,id,input){
  return store.serial(async()=>{
    const fresh=await store.read(`task-${id}.json`);
    if(!fresh)throw Error('Huset findes ikke.');
    // Reopening must never change reviewed evidence, labels or predictions.
    if(fresh.samplingVersion===2||fresh.history.length||fresh.labels.length)return fresh;
    if(!Array.isArray(input)||input.length>18)throw Error('Ugyldige facadeudsnit.');
    const main=new Set(fresh.config.geometry.buildings.filter(b=>b.main).map(b=>b.id));
    const patches=input.filter(p=>main.has(p.buildingId)).map(({contextImage,...p})=>p);
    if(patches.some(p=>p.samplingVersion!==2))throw Error('Genindlæs siden for at hente de nye facadechecks.');
    for(const p of patches)if(typeof p.faceId!=='string'||p.faceId.length>180||typeof p.image!=='string'||p.image.length>2000000)throw Error('Ugyldigt facadeudsnit.');
    const model=await store.read('model.json'),analysis=facadeFeatures(patches);
    const faces=analysis.faces.map(({faceId,views,feature})=>({faceId,buildingId:views[0].buildingId,feature,baseline:baseline(feature),prediction:predict(model,feature),modelVersion:model?.version??'pixel-median-v1',split:split(views[0].buildingId),patches:views,photoReferences:fresh.config.photos.photos.filter(p=>p.direction!=='nadir').map(({direction,capturedAt,camera})=>({direction,capturedAt,camera}))}));
    const next={...fresh,...(fresh.faces.length?{previousAnalysis:{faces:fresh.faces,rejectedFaces:fresh.rejectedFaces??[]}}:{}),faces,samplingVersion:2,rejectedFaces:analysis.rejectedFaces,rejectedViews:analysis.rejectedViews};
    await store.write(`task-${id}.json`,next);return next;
  });
}
