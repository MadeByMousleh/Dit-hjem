import {Store} from './store.mjs';
import {labelAppearance} from './multilabel.mjs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

process.loadEnvFile('.env');
const files=new Store(fileURLToPath(new URL('./data/',import.meta.url)));
const previous=await files.read('thinking-comparison.json');
const report={startedAt:new Date().toISOString(),model:'deepseek-flash',scope:'Three human-confirmed houses; identical one-sale/two-oblique inputs per mode. Diagnostic only; no reviews or training labels changed.',houses:[]};
const list=await files.read('review-list.json');
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const error=(a,b)=>rgb(a).reduce((sum,v,i)=>sum+Math.abs(v-rgb(b)[i]),0)/3;
for(const entry of list.items){
 if(report.houses.length===3)break;
 const house=new Store(`${files.root}/houses/${entry.id}`),task=await house.read('pilot.json'),review=await house.read('review.json');
 if(review?.actor!=='user'||review.status!=='accepted'||!task?.inputFile||!task.images?.length||!/^#[\da-f]{6}$/i.test(review.hex??''))continue;
 const input=await house.read(task.inputFile);
 const aerial=(input?.photos?.photos??[]).map((p,i)=>({...p,id:`oblique-${p.direction}-${i}`})).filter(p=>p.direction!=='nadir').slice(0,2);
 const sale=task.images.find(p=>p.image&&!task.imageReview?.rejectedImageIds?.includes(p.id));
 if(!sale||aerial.length!==2)continue;
 const row={id:entry.id,confirmedHex:review.hex,inputHash:createHash('sha256').update(JSON.stringify([sale,...aerial])).digest('hex'),results:[]};
 report.houses.push(row);
 for(const thinking of [false,true]){
  const cached=!thinking&&previous?.houses?.find(h=>h.id===row.id&&h.inputHash===row.inputHash)?.results?.find(r=>r.thinking===false&&!r.error);
  if(cached){row.results.push({...cached,reused:true});continue;}
  const start=Date.now();let usage;
  try{
   const answer=await labelAppearance([sale],aerial,{thinking,maxAttempts:1,onUsage:async u=>{usage=u;}});
   row.results.push({thinking,seconds:(Date.now()-start)/1000,usage,hex:answer.result.facadeHex,rgbMAE:error(answer.result.facadeHex,review.hex),visibilityAccepted:answer.visibilityAccepted,labels:answer.result.labels,result:answer.result});
  }catch(e){row.results.push({thinking,seconds:(Date.now()-start)/1000,usage,error:e.message});}
  await files.write('thinking-comparison.json',report);
  const last=row.results.at(-1);console.log(JSON.stringify({house:report.houses.length,thinking,seconds:last.seconds,hex:last.hex,rgbMAE:last.rgbMAE,visibilityAccepted:last.visibilityAccepted,error:last.error}));
 }
}
report.finishedAt=new Date().toISOString();
report.summary=[false,true].map(thinking=>{
 const rows=report.houses.flatMap(h=>h.results).filter(r=>r.thinking===thinking),valid=rows.filter(r=>!r.error);
 return {thinking,completed:valid.length,total:rows.length,rgbMAE:valid.length?valid.reduce((n,r)=>n+r.rgbMAE,0)/valid.length:null,visibilityPassed:valid.filter(r=>r.visibilityAccepted).length,totalSeconds:rows.reduce((n,r)=>n+r.seconds,0),estimatedUsd:rows.reduce((n,r)=>n+(r.usage?.estimatedUsd??0),0)};
});
await files.write('thinking-comparison.json',report);console.log(JSON.stringify({summary:report.summary}));
