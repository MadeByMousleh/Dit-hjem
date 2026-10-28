import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {ReviewBatch} from './review.mjs';
import {archiveFloorPlans} from './floor-plans.mjs';

export async function backfillFloorPlans(files,{archive=archiveFloorPlans}={}){
 const batch=new ReviewBatch(files),list=await batch.init();
 const state={status:'running',startedAt:new Date().toISOString(),total:0,completed:0,savedHouses:0,savedPlans:0,unavailable:0,failed:0};
 const items=[];
 // Already collected/trained houses only; the running collector handles future houses.
 for(const item of [...list.items].sort((a,b)=>Number(!!b.multilabel)-Number(!!a.multilabel))){const task=await batch.house(item.id).read('pilot.json');if(task?.teacher)items.push(item);}
 state.total=items.length;await files.write('floor-plan-backfill.json',state);
 for(const item of items){
  const store=batch.house(item.id),task=await store.read('pilot.json');
  try{const record=await archive(store,task,{retryFailed:true});const count=record?.plans?.filter(p=>p.status==='saved').length??0;state.savedPlans+=count;if(count)state.savedHouses++;if(record?.status==='unavailable')state.unavailable++;if(['failed','partial','unsupported'].includes(record?.status))state.failed++;}
  catch{state.failed++;}
  state.completed++;state.updatedAt=new Date().toISOString();await files.write('floor-plan-backfill.json',state);
 }
 state.status='completed';state.finishedAt=new Date().toISOString();await files.write('floor-plan-backfill.json',state);return state;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const files=new Store(resolve('side-projects/auto-color/data'));await files.init();console.log(JSON.stringify(await backfillFloorPlans(files)));
}
