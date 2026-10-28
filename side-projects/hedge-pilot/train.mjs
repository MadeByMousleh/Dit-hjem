import {fitSimilarity,fitPointClassifier} from './point-model.mjs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolvePointSelections} from './point-labels.mjs';
import {connectedSuggestions} from './connected-points.mjs';
import {houseFeatures,fusionFeatureNames} from './photo-point-features.mjs';
const folder=dirname(fileURLToPath(import.meta.url));
export async function trainPilot({onProgress=()=>{}}={}){
 const progress=async(percent,message)=>{onProgress({percent,message});await new Promise(resolve=>setImmediate(resolve));};
 await progress(2,'Henter gemte punkter …');
 const catalog=await fetch('http://127.0.0.1:8794/api/houses').then(r=>r.json()),datasets=[],samples=[];
 const houses=catalog.houses.filter(h=>h.ready);
 for(const house of houses){
  await progress(5+Math.round(45*datasets.length/houses.length),'Læser punkter fra '+house.label);
  const data=await fetch('http://127.0.0.1:8794/api/data?house='+house.id).then(r=>r.json()),features=await houseFeatures(data,{fusion:true}),labels=resolvePointSelections(data.pointSelections),painted=new Set(labels.flatMap(r=>r.indices));
  for(const row of labels)for(const index of row.indices)if(features.has(index))samples.push({house:house.id,index,y:row.kind==='hedge'?1:0,x:features.get(index)});
  datasets.push({house:house.id,sourceHash:data.sourceHash,points:data.points,features,painted,labels});
 }
 const snapshotHash=createHash('sha256').update(JSON.stringify(datasets.map(d=>({house:d.house,sourceHash:d.sourceHash,labels:d.labels})))).digest('hex');
 const positives=samples.filter(s=>s.y===1),negatives=samples.filter(s=>s.y===0),binary=positives.length>=8&&negatives.length>=8;
 const summary={status:binary?'trained-classifier':positives.length>=8?'trained-similarity':'insufficient-data',labelPolicy:'brush-only-v1',method:binary?'brush-point-logistic-v1':'brush-point-similarity-v1',createdAt:new Date().toISOString(),snapshotHash,trainingPoints:positives.length,trainingHouses:new Set(samples.map(s=>s.house)).size,trainingHouseIds:[...new Set(samples.map(s=>s.house))],negativePoints:negatives.length,totalTrainingPoints:samples.length,evaluation:null,automaticPromotion:false,notice:binary?'Local classifier fitted only to explicit positive and negative brush points. Scores are uncalibrated. New unlabeled houses are excluded from training; no independent accuracy measured. Suggestions only.':'Positive-only local LiDAR similarity model. Similarity is not a probability of hedge. No independent accuracy measured; unknown points remain unlabeled. Predictions are suggestions only.'};
 const proposals={snapshotHash,createdAt:summary.createdAt,houses:{}};
 summary.featurePipeline='lidar-photo-v1';
 summary.photoTrainingPoints=samples.filter(s=>s.x[5]>0).length;
 if(['trained-similarity','trained-classifier'].includes(summary.status)){
  await progress(55,'Træner modellen på hæk og ikke-hæk …');
  const learned=binary?fitPointClassifier(samples):{prototypes:fitSimilarity(positives)},model={...summary,featurePipeline:'lidar-photo-v1',featureNames:fusionFeatureNames,...learned,threshold:binary?.7:.65};
  model.connectedSuggestions={version:1,seedThreshold:binary?.45:.55,supportThreshold:binary?.15:.2,radius:.9,verticalStep:.8,verticalSpan:1.5};
  await progress(80,'Beregner nye hækforslag …');
  for(const d of datasets){const indices=connectedSuggestions(d.points,d.features,model,d.painted);proposals.houses[d.house]={sourceHash:d.sourceHash,indices,count:indices.length,seenInTraining:summary.trainingHouseIds.includes(d.house)};}
  const previous=await readFile(folder+'/data/candidate-model.json','utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(previous&&(JSON.parse(previous).method!==model.method||JSON.parse(previous).featurePipeline!==model.featurePipeline))await rename(folder+'/data/candidate-model.json',folder+'/data/candidate-model-legacy-'+Date.now()+'.json');
  await writeFile(folder+'/data/candidate-model.tmp',JSON.stringify(model));await rename(folder+'/data/candidate-model.tmp',folder+'/data/candidate-model.json');
 }
 await progress(95,'Gemmer modellen og forslagene …');
 summary.suggestions=Object.fromEntries(Object.entries(proposals.houses).map(([id,h])=>[id,h.count]));
 await writeFile(folder+'/data/proposals.tmp',JSON.stringify(proposals));await rename(folder+'/data/proposals.tmp',folder+'/data/proposals.json');
 await writeFile(folder+'/data/training.tmp',JSON.stringify(summary));await rename(folder+'/data/training.tmp',folder+'/data/training.json');return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await trainPilot()));
