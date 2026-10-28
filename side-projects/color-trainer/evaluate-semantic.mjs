import {Store} from './store.mjs';
import {SemanticWorker,semanticCandidate} from './semantic.mjs';
import {split,predict,rgb} from './model.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {polygonMask} from './polygon.mjs';
import {maskFromRuns} from './sampling.mjs';
import {fileURLToPath} from 'node:url';

export function buildingGroups(tasks){
  const parents=new Map(),find=x=>{if(!parents.has(x))parents.set(x,x);const p=parents.get(x);if(p!==x)parents.set(x,find(p));return parents.get(x);};
  for(const t of tasks){const ids=t.config.geometry.buildings.filter(b=>b.main).map(b=>b.id).sort();for(const id of ids){const a=find(ids[0]),b=find(id);if(a!==b)parents.set([a,b].sort()[1],[a,b].sort()[0]);}}
  return new Map(tasks.map(t=>{const id=t.config.geometry.buildings.find(b=>b.main)?.id;return [t.id,id?find(id):null];}));
}
const mean=features=>features.length?features[0].map((_,i)=>features.reduce((n,f)=>n+f[i],0)/features.length):null;
export function compareRows(rows){
  const train=rows.filter(r=>r.split==='train'&&r.baseline&&r.semantic),test=rows.filter(r=>r.split==='test');
  const score=(key,subset)=>{
    if(!train.length||!subset.length)return null;
    const model={samples:train.map(r=>({feature:r[key],hex:r.hex}))};
    return subset.reduce((sum,r)=>sum+rgb(predict(model,r[key])).reduce((n,v,i)=>n+Math.abs(v-rgb(r.hex)[i]),0)/3,0)/subset.length;
  };
  const paired=test.filter(r=>r.baseline&&r.semantic);
  return {trainingGroups:new Set(train.map(r=>r.group)).size,testGroups:new Set(test.map(r=>r.group)).size,testHouses:test.length,pairedTestHouses:paired.length,semanticCoverage:test.length?test.filter(r=>r.semantic).length/test.length:null,baselineRgbMAE:score('baseline',paired),semanticRgbMAE:score('semantic',paired),notice:'Preliminary house-balanced comparison on matched houses. Same training houses, building-connected split; labels and active model unchanged.'};
}

if(process.argv[1]?.endsWith('evaluate-semantic.mjs')){
  const store=new Store(fileURLToPath(new URL('./data/',import.meta.url)));
  const worker=new SemanticWorker(),tasks=[];
  for(const n of await store.tasks()){const t=await store.read(n);if(t.status==='approved'&&(t.houseColor?.visibility==='known'||t.labels.length&&t.labels.every(l=>l.visibility==='known'&&l.hex===t.labels[0].hex)))tasks.push(t);}
  const groups=buildingGroups(tasks),limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]??tasks.length);
  // Freeze a reproducible task selection before inference, independent of labels/scores.
  const selected=tasks.sort((a,b)=>createHash('sha256').update(a.id).digest('hex').localeCompare(createHash('sha256').update(b.id).digest('hex'))).slice(0,limit);
  const rows=[],positiveCoverage=[];const started=Date.now();
  try{
    for(const [i,t] of selected.entries()){
      const group=groups.get(t.id);if(!group)continue;
      const candidate=await semanticCandidate(t,worker);
      for(const s of t.manualSelections??[]){const v=candidate.views.find(v=>v.photoKey===s.photoKey);if(!v)continue;const p=polygonMask(s.points,v.width,v.height),mask=maskFromRuns(v.maskRuns,v.width,v.height);let hit=0;for(const index of p.indices){const x=index%p.width+p.contextCrop[0],y=Math.floor(index/p.width)+p.contextCrop[1];if(mask[y*v.width+x])hit++;}positiveCoverage.push(hit/Math.max(1,p.indices.length));}
      rows.push({taskId:t.id,group,split:split(group),hex:t.houseColor?.hex??t.labels[0].hex,baseline:mean(t.faces.map(f=>f.feature).filter(Boolean)),semantic:mean(candidate.views.filter(v=>v.feature).map(v=>v.feature)),signature:candidate.signature});
      if((i+1)%10===0)console.log(JSON.stringify({processed:i+1,total:selected.length,seconds:Math.round((Date.now()-started)/1000)}));
    }
    // One observation per connected physical-building group for both learners.
    const unique=[...new Map(rows.map(r=>[r.group,r])).values()];
    const result={at:new Date().toISOString(),...compareRows(unique),manualPositiveRegions:positiveCoverage.length,meanManualPositiveCoverage:positiveCoverage.length?positiveCoverage.reduce((a,b)=>a+b,0)/positiveCoverage.length:null,positiveCoverageNotice:'Manual polygons mark only positive wall areas; this is recall within those regions, not whole-image precision or IoU.',taskSelection:selected.map(t=>({id:t.id,revision:t.revision})),rows};
    await mkdir('side-projects/color-trainer/data/semantic-evaluation',{recursive:true});
    await writeFile('side-projects/color-trainer/data/semantic-evaluation/latest.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify({...result,rows:undefined,taskSelection:undefined},null,2));
  }finally{worker.close();}
}
