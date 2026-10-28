import {buildTrainingOverview} from './overview.mjs';
import {exportAppearanceDataset} from './appearance-export.mjs';
import {geminiQueue} from './gemini-queue.mjs';
import {defaultModel,setTeacherModel,teacherSettings} from './teacher.mjs';
import {ReviewedTraining} from './review-training.mjs';
import {ReviewBatch} from './review.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {buildRenderer} from '../color-trainer/renderer.mjs';
import {collectPilot,resumeTeacher} from './pilot.mjs';
import {trainCandidate} from './training.mjs';
import {renderPatches} from './render-worker.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),root=resolve(folder,'../..');process.chdir(root);
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.AUTO_COLOR_PORT||8792),origin=`http://127.0.0.1:${port}`,files=new Store(resolve(folder,'data'));await files.init();
const savedTeacher=await files.read('teacher-settings.json');if(savedTeacher)setTeacherModel(savedTeacher.model);
geminiQueue.restore(await files.read('gemini-queue.json'),{model:defaultModel});geminiQueue.onState=state=>files.serial(()=>files.write('gemini-queue.json',state));
const manual=new Store(resolve(folder,'../color-trainer/data'));
const batch=new ReviewBatch(files);await batch.init();
await batch.recoverSmallPackets();
const reviewedTraining=new ReviewedTraining(files,batch,origin);
const previousTraining=await files.read('review-training.json');
if(previousTraining?.status==='trained')await files.write('review-training-completed.json',previousTraining);
batch.onAutoInclude=()=>reviewedTraining.schedule();
let engine=null,busy=false;
const withoutImages=t=>t?{...t,images:(t.images??[]).map(({image,...p})=>p),oblique:(t.oblique??[]).map(({image,...p})=>p)}:null;
async function run(){
 if(busy)throw Error('Piloten kører allerede.');busy=true;
 try{
  let task=await files.read('pilot.json');
  if(['completed','needs-review'].includes(task?.status)||task?.teacher&&!task.teacher.accepted)return;
  if(!task)task=await collectPilot(files);
  else if(!task.teacher?.accepted)task=await resumeTeacher(files);
  if(!task.teacher?.accepted)return;
  task={...task,status:'running',stage:'sampling',error:null};await files.write('pilot.json',task);
  const patches=await renderPatches(origin);task={...task,stage:'training',sampledViews:patches.length};await files.write('pilot.json',task);
  const candidate=await trainCandidate(files,task,patches);task={...task,status:'completed',stage:'completed',candidate,finishedAt:new Date().toISOString()};await files.write('pilot.json',task);
 }catch(error){const task=await files.read('pilot.json');if(task)await files.write('pilot.json',{...task,status:'failed',stage:'error',error:error.message});}
 finally{busy=false;}
}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 try{
  if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==origin)return json({error:'Fremmed oprindelse afvist.'},403);
  const url=new URL(req.url,origin);
  if(req.method==='GET'&&['/','/app.js','/overview.js','/style.css','/detail.js','/house'].includes(url.pathname)){const name=url.pathname==='/'?'index.html':url.pathname==='/house'?'detail.html':url.pathname.slice(1);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(await readFile(resolve(folder,name)));}
  if(req.method==='GET'&&url.pathname==='/api/dataset')return json(await exportAppearanceDataset(batch));
  if(req.method==='GET'&&url.pathname==='/api/list'){
   const status=await batch.status();const [savedTraining,model,floorPlanBackfill,completedTraining]=await Promise.all([files.read('review-training.json'),files.read('review-model.json'),files.read('floor-plan-backfill.json'),files.read('review-training-completed.json')]);
   const training=savedTraining?{...savedTraining,busy:reviewedTraining.busy,queued:reviewedTraining.queued}:null;
   const {houseStates,...overview}=buildTrainingOverview({...status,model,training,completedTraining,queue:geminiQueue.state});
   return json({...status,items:status.items.map(item=>({...item,...houseStates[item.id]})),teacher:teacherSettings(),floorPlanBackfill,training,geminiQueue:geminiQueue.state,overview});
  }
  if(req.method==='GET'&&url.pathname==='/api/status'){const model=await manual.read('model.json');return json({pilot:withoutImages(await (url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files).read('pilot.json')),floorPlans:await (url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files).read('floor-plans.json'),exteriorViews:await (url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files).read('exterior-views.json'),busy,currentModel:model?{version:model.version,trainingBuildings:model.trainingBuildings,evaluation:model.evaluation}:null,authorization:{maxHouses:730,batchTarget:(await batch.init()).target,batchEnabled:true,automaticTraining:true,rights:'EDC agreement confirmed by user',spending:'300 additional houses with automatic training authorized by user'},teacherConfigured:!!(defaultModel==='deepseek-flash'?process.env.DEEP_SEEK:process.env.GEMINI_API_KEY)});}
  if(req.method==='POST'){
   if(req.headers['x-auto-color']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json({error:'Ugyldig lokal forespørgsel.'},403);
   let length=0,text='';for await(const chunk of req){length+=chunk.length;if(length>1024)throw Error('For stor forespørgsel.');text+=chunk;}const body=JSON.parse(text||'{}');
   if(url.pathname==='/api/teacher'){
    return json(await files.serial(async()=>{
     const choice=teacherSettings().options.find(option=>option.model===body.model&&option.configured);if(!choice)throw Error('Vælg en konfigureret AI-model.');
     await files.write('teacher-settings.json',{model:choice.model});setTeacherModel(choice.model);return teacherSettings();
    }));
   }
   if(url.pathname==='/api/review'){const result=await batch.saveReview(body.id,body);reviewedTraining.schedule();return json(result);}
   if(url.pathname==='/api/retry-failed'){if(batch.busy)return json({error:'Indsamlingen kører allerede.'},409);if(geminiQueue.blocked)return json({error:geminiQueue.blocked.message},409);const recovery=await batch.recoverFailed();void batch.run();return json(recovery);}
   if(url.pathname==='/api/train-reviewed'){void reviewedTraining.run();return json({started:true});}
   if(url.pathname==='/api/batch'){const list=await batch.init();if(body.count!==list.target)return json({error:'Uautoriseret antal huse'},403);void batch.run();return json({started:true,maxHouses:list.target});}
   if(body.count!==undefined&&body.count!==1)return json({error:'Kun ét pilot-hus er autoriseret. Batch på 1.000 er deaktiveret.'},403);
   if(url.pathname==='/api/pilot'){if(busy)return json({error:'Piloten kører allerede.'},409);void run();return json({started:true,maxHouses:1});}
  }
  const exteriorPhoto=url.pathname.match(/^\/photo\/exterior\/(sale-\d+)$/);if(req.method==='GET'&&exteriorPhoto){const selected=url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files,manifest=await selected.read('exterior-views.json'),view=manifest?.views?.find(v=>v.id===exteriorPhoto[1]&&v.accepted);if(!view||!/^exterior-sale-\d+-[a-f0-9]{16}\.json$/.test(view.file??''))return json({error:'Intet kontrolleret udvendigt foto.'},404);const saved=await selected.read(view.file);if(!saved?.image||saved.sha256!==view.sha256)return json({error:'Billedet mangler eller er ændret.'},404);res.setHeader('Content-Type','image/jpeg');return res.end(Buffer.from(saved.image.split(',')[1],'base64'));}
  const planPhoto=url.pathname.match(/^\/photo\/plan\/(\d+)$/);if(req.method==='GET'&&planPhoto){const selected=url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files,manifest=await selected.read('floor-plans.json'),plan=manifest?.plans?.[Number(planPhoto[1])];if(plan?.status!=='saved'||!Number.isSafeInteger(plan.sourceIndex)||plan.sourceIndex<0)return json({error:'Ingen gemt plantegning.'},404);const saved=await selected.read('floor-plan-'+plan.sourceIndex+'.json');if(!saved?.image)return json({error:'Plantegningen mangler.'},404);res.setHeader('Content-Type','image/jpeg');return res.end(Buffer.from(saved.image.split(',')[1],'base64'));}
  const photo=url.pathname.match(/^\/photo\/(sale|oblique)\/(\d+)$/);if(req.method==='GET'&&photo){const task=await (url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files).read('pilot.json'),image=(photo[1]==='sale'?task?.images:task?.oblique)?.[Number(photo[2])]?.image;if(!image)return json({error:'Billedet findes ikke.'},404);res.setHeader('Content-Type','image/jpeg');return res.end(Buffer.from(image.split(',')[1],'base64'));}
  if(req.method==='GET'&&url.pathname==='/render'){
   const selectedStore=url.searchParams.has('house')?batch.house(url.searchParams.get('house')):files;
   const task=await selectedStore.read('pilot.json'),review=await selectedStore.read('review.json');
   if(url.searchParams.has('house')?review?.status!=='accepted'||review.scope!=='whole-house':!task?.teacher?.accepted)return json({error:'Ingen accepteret husfarve.'},409);
   if(!task?.inputFile)return json({error:'Ingen kalibrering til dette hus.'},409);
   const config=await selectedStore.read(task.inputFile);engine??=await buildRenderer();res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html><body style="margin:0"><script>window.messages=[];window.ReactNativeWebView={postMessage:r=>window.messages.push(JSON.parse(r))};window.HOME_MODEL=${JSON.stringify(config).replaceAll('<','\\u003c')};${engine.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
  }
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}json({error:'Ikke fundet.'},404);
 }catch(error){json({error:error.message},400);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Automatisk farvepilot: ${origin}`));
