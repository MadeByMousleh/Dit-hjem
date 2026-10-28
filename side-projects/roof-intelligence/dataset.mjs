import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {eligibleObjects} from './policy.mjs';
import {scopedReviews} from './review-scope.mjs';
import {Store} from '../auto-color/store.mjs';
const folder=dirname(fileURLToPath(import.meta.url));
export const read=async name=>JSON.parse(await readFile(resolve(folder,'data',name),'utf8').catch(e=>{if(e.code==='ENOENT')return 'null';throw e;}));
export async function trainingInput(){
 const observations=await read('observations.json'),reviews=await read('reviews.json')??{},rows=[];
 for(const house of observations?.houses??[]){
  const latest=JSON.parse(await readFile(resolve(folder,'../auto-color/data/houses',house.id,'review.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return 'null';throw e;}));
  if(['excluded','skipped'].includes(latest?.status))continue;
  for(const object of eligibleObjects(house,scopedReviews(observations,reviews,house)))rows.push({...object,buildingId:house.buildingId,split:house.split});
 }
 const result={createdAt:new Date().toISOString(),rows};
 await new Store(folder+'/data').write('training-input.json',result);return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await trainingInput();console.log(JSON.stringify({eligibleAerialObjects:result.rows.filter(r=>r.kind==='aerial').length,houses:new Set(result.rows.map(r=>r.buildingId)).size}));}
