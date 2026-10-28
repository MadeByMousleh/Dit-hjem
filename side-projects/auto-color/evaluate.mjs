import {Store} from './store.mjs';
import {predict,rgb,hex,split} from '../color-trainer/model.mjs';
const mean=values=>values.reduce((n,v)=>n+v,0)/values.length;
const quantile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*q)];};
const mae=(a,b)=>mean(rgb(a).map((v,i)=>Math.abs(v-rgb(b)[i])));
export function evaluateHoldout(model,previous,rows){
 if(!rows.length)return null;
 const trained=new Set([...model.samples,...previous.samples].map(s=>s.buildingId));
 if(rows.some(r=>split(r.buildingId)!=='test'||trained.has(r.buildingId)))throw Error('Testbygning overlapper træning.');
 const predictions=rows.map(row=>({...row,prediction:predict(model,row.feature),previous:predict(previous,row.feature)})).map(r=>({...r,error:mae(r.prediction,r.hex),previousError:mae(r.previous,r.hex)}));
 const houses=[...new Set(rows.map(r=>r.buildingId))].map(buildingId=>{
  const faces=predictions.filter(r=>r.buildingId===buildingId);
  const averageColor=key=>hex([0,1,2].map(channel=>mean(faces.map(r=>rgb(r[key])[channel]))));
  return {buildingId,address:faces[0].address,source:faces[0].source,faces:faces.length,error:mean(faces.map(r=>r.error)),previousError:mean(faces.map(r=>r.previousError)),target:averageColor('hex'),prediction:averageColor('prediction'),previous:averageColor('previous'),targetIsUniform:new Set(faces.map(r=>r.hex.toLowerCase())).size===1};
 });
 const differences=houses.map(h=>h.error-h.previousError),resampled=[];let seed=72203;
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<5000;i++){let sum=0;for(let j=0;j<houses.length;j++)sum+=differences[Math.floor(random()*houses.length)];resampled.push(sum/houses.length);}
 return {houseCount:houses.length,faceCount:predictions.length,faceMAE:mean(predictions.map(r=>r.error)),previousFaceMAE:mean(predictions.map(r=>r.previousError)),houseMAE:mean(houses.map(r=>r.error)),previousHouseMAE:mean(houses.map(r=>r.previousError)),medianHouseMAE:quantile(houses.map(r=>r.error),.5),p90HouseMAE:quantile(houses.map(r=>r.error),.9),improved:houses.filter(r=>r.error<r.previousError-1e-8).length,worsened:houses.filter(r=>r.error>r.previousError+1e-8).length,unchanged:houses.filter(r=>Math.abs(r.error-r.previousError)<=1e-8).length,within:[15,30,60].map(threshold=>({maximumHouseRGBError:threshold,count:houses.filter(h=>h.error<=threshold).length,total:houses.length})),pairedHouseDelta95Bootstrap:[quantile(resampled,.025),quantile(resampled,.975)],houses:houses.sort((a,b)=>b.error-a.error)};
}
export async function evaluateCurrent({autoRoot='side-projects/auto-color/data',manualRoot='side-projects/color-trainer/data',previousModel,holdoutBuildingIds,outputFile='accuracy-report.json'}={}){
 const files=new Store(autoRoot),manual=new Store(manualRoot),model=await files.read('review-model.json'),previous=previousModel??await manual.read('model.json'),state=await files.read('review-training.json');
 if(!model?.samples?.length)throw Error('Der er ingen færdigtrænet model at teste.');
 const manualRows=await manual.rows(),original=[];
 for(const row of manualRows.filter(r=>split(r.buildingId)==='test')){const task=await manual.read(`task-${row.taskId}.json`);original.push({...row,address:task.address.text,source:'original-manual'});}
 const reviewed=[],excluded=[];
 for(const item of (await files.read('review-list.json')).items){
  const house=new Store(`${autoRoot}/houses/${item.id}`),review=await house.read('review.json');if(review?.status!=='accepted'||review.origin==='gemini-auto')continue;
  const task=await house.read('pilot.json');if(!task.buildingId||split(task.buildingId)!=='test')continue;
  if(review.scope!=='whole-house'||!task.teacher.result.uniformFacade){excluded.push({id:item.id,reason:'Mixed facade'});continue;}
  const features=await house.read('training-features.json');if(!features){excluded.push({id:item.id,reason:'No accepted facade features'});continue;}
  for(const face of features.faces)reviewed.push({...face,buildingId:task.buildingId,hex:review.hex,address:task.address?.text??task.listing.address.text,source:'human-reviewed-gemini'});
 }
 const eligible=row=>!holdoutBuildingIds||holdoutBuildingIds.includes(row.buildingId);
 const originalSet=original.filter(eligible),reviewedSet=reviewed.filter(eligible);
 const combined=new Map();for(const row of [...reviewedSet,...originalSet])combined.set(`${row.buildingId}:${row.faceId}`,row);
 const report={testedAt:new Date().toISOString(),modelVersion:model.version,trainingInProgress:state.status!=='trained'||state.modelVersion!==model.version,previousModelVersion:previous.version,trainingBuildings:model.trainingBuildings,previousTrainingBuildings:previous.trainingBuildings,original:evaluateHoldout(model,previous,originalSet),reviewed:evaluateHoldout(model,previous,reviewedSet),combined:evaluateHoldout(model,previous,[...combined.values()]),excluded,scope:'Snapshot of the latest completed model. Predictions from calibrated oblique facade pixels against human-approved HEX. Gemini itself was not retested. No new API calls or model training.',notice:'RGB error is not an accuracy percentage or physical paint-code measurement. Bootstrap uses houses as sampling units; swatches average face colors when a house has multiple targets.'};
 await files.write(outputFile,report);return report;
}
