import {Store} from './store.mjs';
import {HouseTraining} from './house-training.mjs';
import {houseAIInput} from './house-ai.mjs';
import {fileURLToPath} from 'node:url';
const store=new Store(fileURLToPath(new URL('./data/',import.meta.url))),trainer=new HouseTraining(store,{makeInput:houseAIInput});
console.log(JSON.stringify(await trainer.start()));
let previous='';
while(trainer.job.status==='running'){
  await new Promise(done=>setTimeout(done,2000));
  const current=JSON.stringify({status:trainer.job.status,stage:trainer.job.stage,processed:trainer.job.processed,total:trainer.job.total,epoch:trainer.job.epoch,loss:trainer.job.loss});
  if(current!==previous){console.log(current);previous=current;}
}
if(trainer.job.status==='failed')throw Error(trainer.job.error);
const latest=(await trainer.status()).latest;console.log(JSON.stringify({version:latest.version,promote:latest.promote,validation:latest.validation,test:{before:latest.test.before,after:latest.test.after,completeHouses:latest.test.completeHouses},counts:latest.counts}));
