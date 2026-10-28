import assert from 'node:assert/strict';
import {build} from 'esbuild';
import jpeg from 'jpeg-js';
import {readFile,readdir} from 'node:fs/promises';
import {features,predict} from '../side-projects/color-trainer/model.mjs';
import {Store} from '../side-projects/color-trainer/store.mjs';
import * as trainerSampling from '../side-projects/color-trainer/sampling.mjs';
import * as appSampling from '../src/services/facade-color-sampling.mjs';
const bundle=await build({entryPoints:['src/web/learned-facade-colors.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {predictFacadeColor,facadePixelChannels,channelFeatures,learnedFacadeColors}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const decode=async src=>jpeg.decode(Buffer.from(src,'base64'));
const patch=(id,color,viewId)=>{
 const width=32,height=32,data=Buffer.alloc(width*height*4);for(let i=0;i<data.length;i+=4){color.forEach((v,c)=>data[i+c]=v);data[i+3]=255;}
 return {id:id+viewId,buildingId:id,faceId:id+'-face',viewId,year:'2025',width,height,pixels:1024,image:jpeg.encode({data,width,height},100).data.toString('base64'),samplingVersion:2,maskRuns:[[0,1024]],quality:{accepted:true}};
};
const a=patch('main',[128,128,128],'one'),b=patch('neighbor',[220,220,220],'one'),model={version:'test-version',featureVersion:1,maxDistance:.15,samples:[{feature:features([a]),hex:'#96533a'},{feature:features([b]),hex:'#f7f7f4'}]};
assert.deepEqual(channelFeatures(facadePixelChannels(a,await decode(a.image))),features([a]),'Browser/trainer exact pixel-feature parity');
const patches=[a,{...a,id:'main-two',viewId:'two'},b,{...b,id:'neighbor-two',viewId:'two'},patch('far-away',[20,160,30],'one')];
const colors=await learnedFacadeColors(patches,()=>true,decode,model);
assert.equal(colors.main.walls.color,'#96533a');assert.equal(colors.neighbor.walls.color,'#f7f7f4');assert.equal(colors['far-away'],undefined);
assert.equal(colors.main.roof,undefined);assert.equal(colors.main.walls.modelVersion,'test-version');assert.equal(colors.main.walls.evidence.length,2);assert.equal(colors.main.walls.uniform,true);
assert.deepEqual(await learnedFacadeColors([a],()=>true,decode,model),{},'One view is insufficient');
assert.deepEqual(await learnedFacadeColors([a,{...a,id:'repeat'}],()=>true,decode,model),{},'Repeated same view is insufficient');
assert.deepEqual(await learnedFacadeColors(patches,()=>false,decode,model),{},'Cancelled analysis never applies colors');
assert.equal(facadePixelChannels({...a,samplingVersion:undefined},await decode(a.image)),null,'Legacy masks cannot silently enter learned inference');
const indices=Array.from({length:28*28},(_,i)=>(Math.floor(i/28)+2)*32+i%28+2);
assert.deepEqual(appSampling.conservativeInterior(indices,32,32),trainerSampling.conservativeInterior(indices,32,32),'Sampling contract stays identical');
// Real model parity, not a mirrored hand-written prediction formula.
let trained=JSON.parse(await readFile(process.argv[2]??'side-projects/auto-color/data/review-model.json','utf8'));
const generated=await build({entryPoints:['src/generated/facade-color-model.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {facadeColorModel:snapshot}=await import(`data:text/javascript;base64,${Buffer.from(generated.outputFiles[0].text).toString('base64')}`);
// Background training may have advanced since this deliberate app snapshot.
if(!process.argv[2]&&trained.version!==snapshot.version){
 for(const name of (await readdir('side-projects/auto-color/data')).filter(n=>/^review-model-[\da-f-]+\.json$/.test(n))){const candidate=JSON.parse(await readFile(`side-projects/auto-color/data/${name}`,'utf8'));if(candidate.version===snapshot.version){trained=candidate;break;}}
}
assert.equal(snapshot.version,trained.version,'App uses the selected completed model version');
assert.equal(snapshot.trainingBuildings,trained.trainingBuildings,'App retains the selected training population');
assert.ok(snapshot.samples.every(s=>Object.keys(s).sort().join(',')==='feature,hex'),'Snapshot excludes building IDs and photos');
for(const sample of trained.samples.slice(0,50)){const actual=predictFacadeColor(sample.feature,snapshot);assert.ok(actual);assert.equal(actual.color,predict(trained,sample.feature));}
const source=new Store('side-projects/color-trainer/data');let compared=0;
for(const name of await source.tasks()){
 const task=await source.read(name);
 for(const face of task.faces??[])for(const p of face.patches??[]){if(p.samplingVersion!==2||!p.maskRuns||p.quality?.accepted===false)continue;const channels=facadePixelChannels(p,await decode(p.image));if(!channels)continue;assert.deepEqual(channelFeatures(channels),features([p]));compared++;if(compared>=12)break;}
 if(compared>=12)break;
}
assert.ok(compared>=1,'Compare actual retained-photo features');
console.log(JSON.stringify({syntheticHouseAndNeighbor:true,unknownFarHouse:true,multiViewRequired:true,roofUntouched:true,sourceVersionRetained:true,trainerPredictionComparisons:50,realPhotoFeatureComparisons:compared}));
