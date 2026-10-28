import {spawn} from 'node:child_process';
import {randomInt} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {edcCandidates,loadEdcSource} from './edc-source.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),workspace=resolve(folder,'../..');
export async function createRandomHouseRunner({existing,register}){
 let state={status:'idle'},writing=Promise.resolve();const attempted=new Set();
 const previous=JSON.parse(await readFile(folder+'/data/random-job.json','utf8').catch(e=>{if(e.code==='ENOENT')return 'null';throw e;}));
 if(previous)state=previous.status==='running'?{...previous,status:'failed',message:'Den tidligere hentning blev afbrudt. Vælg et nyt hus.'}:previous;
 function update(patch){state={...state,...patch,updatedAt:new Date().toISOString()};const snapshot=JSON.stringify(state);writing=writing.catch(()=>{}).then(async()=>{await writeFile(folder+'/data/random-job.tmp',snapshot);await rename(folder+'/data/random-job.tmp',folder+'/data/random-job.json');});return writing;}
 function run(command,args,{timeout=360000,progress=false}={}){return new Promise((done,fail)=>{
  const child=spawn(command,args,{cwd:workspace,windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});let buffer='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
  child.stdout.on('data',chunk=>{if(!progress)return;buffer+=chunk.toString();const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines){try{const row=JSON.parse(line);if(Number.isFinite(row.downloadedMiB))void update({message:`Henter LiDAR: ${row.downloadedMiB} af ${row.totalMiB} MB`});}catch{/* Diagnostics are not exposed to the UI. */}}});child.stderr.on('data',()=>{});
  child.once('error',()=>{clearTimeout(timer);fail(Error('Kunne ikke starte '+(command==='docker'?'den lokale LiDAR-behandling':'databehandlingen')));});
  child.once('close',code=>{clearTimeout(timer);if(code===0&&!timedOut)done();else fail(Error(timedOut?'Hentningen tog for lang tid. Prøv et andet hus.':`Trinnet mislykkedes (kode ${code}). Prøv et andet hus.`));});
 });}
 async function execute(resume){
  const model=JSON.parse(await readFile(folder+'/data/candidate-model.json','utf8'));if(model.method!=='brush-point-logistic-v1')throw Error('Træn først en model på hæk og ikke-hæk');
  const used=existing(),excluded=new Set([...used.ids,...attempted,...model.trainingHouseIds]);
  const candidates=await edcCandidates(excluded,used.buildings);await update({eligibleHouses:candidates.length});
  let candidate=resume;
  if(candidate){const source=await loadEdcSource(candidate.edcId);if(source.geometry.addressId!==candidate.houseId||model.trainingHouseIds.includes(candidate.houseId))throw Error('Huset kan ikke genoptages som nyt testhus');}
  while(!candidate&&candidates.length){const [choice]=candidates.splice(randomInt(candidates.length),1);attempted.add(choice.houseId);try{await loadEdcSource(choice.edcId);candidate=choice;break;}catch{/* Skip unusable local geometry, before requesting external data. */}}
  if(!candidate)throw Error('Ingen nye brugbare EDC-huse med gemt geometri');
  await update({houseId:candidate.houseId,label:candidate.label,edcId:candidate.edcId,stage:'lidar',message:'Henter LiDAR. En ny flise kan tage nogle minutter.'});
  await run(process.execPath,[folder+'/prepare-houses.mjs','--edc-house='+candidate.edcId],{progress:true});
  await update({stage:'crop',message:'Beskærer LiDAR til den valgte grund …'});
  await run('docker',['run','--rm','--pull','never','--network','none','--memory','768m','--memory-swap','768m','--cpus','2','--mount',`type=bind,source=${folder}/data/houses/${candidate.houseId},target=/data`,'dit-hjem-lidar-crop:1'],{timeout:180000});
  await update({stage:'photos',message:'Henter originale havefotos …'});
  try{await run(process.execPath,[folder+'/fetch-photos.mjs','--house='+candidate.houseId],{timeout:180000});}
  catch{await update({message:'Billedtjenesten svarede ikke. Prøver havefotos én gang til …'});await run(process.execPath,[folder+'/fetch-photos.mjs','--house='+candidate.houseId],{timeout:180000});}
  await register(candidate.houseId);
  await update({stage:'predict',message:'Modellen markerer sine forslag. Huset bruges ikke til træning.'});
  await run(process.execPath,[folder+'/predict-house.mjs','--house='+candidate.houseId],{timeout:60000});
  const proposals=JSON.parse(await readFile(folder+'/data/proposals.json','utf8')),proposal=proposals.houses[candidate.houseId];
  if(!proposal||proposal.seenInTraining!==false)throw Error('Forslagene kunne ikke kontrolleres');
  await update({status:'done',stage:'done',message:'Nyt EDC-hus klar. Kun dine godkendelser tæller som hæk.',suggestedPoints:proposal.count,url:'/?house='+candidate.houseId});
 }
 return {status:()=>({...state}),start:async({retry=false}={})=>{
  if(state.status==='running')return {...state};
  const resume=retry&&state.status==='failed'&&state.edcId?{houseId:state.houseId,edcId:state.edcId,label:state.label}:null;
  state={status:'running',stage:'select',message:'Vælger tilfældigt blandt nye EDC-huse …',startedAt:new Date().toISOString()};await update({});
  void execute(resume).catch(error=>update({status:'failed',message:error.message}));return {...state};
 }};
}
