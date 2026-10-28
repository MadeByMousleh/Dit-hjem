import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {photoKey} from './sampling.mjs';
import {facadeFeatures,baseline,predict,split} from './model.mjs';
const folder=fileURLToPath(new URL('./',import.meta.url));
export const SEMANTIC_REVISION='999e0328d9e10b484360c477313983f9afdd7050';

export function targetRegion(task,photo,width,height){
  const g=task.config.geometry,h=task.config.heights,c=photo.camera;
  const fallback=(h?.terrain??[]).find(Number.isFinite)??0;
  const ground=(x,y)=>{
    if(!h)return fallback;
    const col=Math.max(0,Math.min(h.width-1,Math.floor((x-h.bbox[0])/(h.bbox[2]-h.bbox[0])*h.width)));
    const row=Math.max(0,Math.min(h.height-1,Math.floor((h.bbox[3]-y)/(h.bbox[3]-h.bbox[1])*h.height)));
    const z=h.terrain[row*h.width+col];return Number.isFinite(z)?z:fallback;
  };
  const points=[];
  for(const b of g.buildings.filter(b=>b.main))for(const ring of b.rings)for(const [x,y] of ring)for(const z of [ground(x,y),ground(x,y)+(b.height??5)]){
    const delta=[x-c.center[0],y-c.center[1],z-c.center[2]],r=c.rotation;
    const v=[0,1,2].map(i=>r[i*3]*delta[0]+r[i*3+1]*delta[1]+r[i*3+2]*delta[2]);
    if(v[2]>=-1)continue;
    points.push([(c.principal[0]-c.focal[0]*v[0]/v[2]-c.crop[0])/(c.crop[2]-c.crop[0])*width,(c.principal[1]+c.focal[1]*v[1]/v[2]-c.crop[1])/(c.crop[3]-c.crop[1])*height]);
  }
  if(!points.length)throw Error('Huset kunne ikke placeres sikkert i originalfotoet.');
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const margin=Math.max(4,.1*Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)));
  const region=[Math.max(0,Math.floor(Math.min(...xs)-margin)),Math.max(0,Math.floor(Math.min(...ys)-margin)),Math.min(width,Math.ceil(Math.max(...xs)+margin)),Math.min(height,Math.ceil(Math.max(...ys)+margin))];
  if(region[2]<=region[0]||region[3]<=region[1])throw Error('Husets billedområde ligger uden for fotoet.');
  return region;
}

export class SemanticWorker{
  constructor({script='semantic-worker.py',timeout=120000}={}){this.script=script;this.timeout=timeout;this.child=null;this.pending=new Map();this.starting=null;this.queue=Promise.resolve();}
  start(){
    if(this.starting)return this.starting;
    this.starting=new Promise((resolve,reject)=>{
      const child=this.child=spawn(folder+'data/semantic-runtime/python.exe',['-u',folder+this.script],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'}});
      let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-3000);});
      const timer=setTimeout(()=>{child.kill();reject(Error('Den lokale billedmodel kunne ikke starte inden for 60 sekunder.'));},60000);
      createInterface({input:child.stdout}).on('line',line=>{
        try{const message=JSON.parse(line);if(message.ready){clearTimeout(timer);resolve();return;}
          const p=this.pending.get(message.id);if(p){this.pending.delete(message.id);message.error?p.reject(Error(message.error)):p.resolve(message.result);}
        }catch{ /* Runtime diagnostics never become image results. */ }
      });
      const failed=error=>{clearTimeout(timer);reject(error);for(const p of this.pending.values())p.reject(error);this.pending.clear();this.child=null;this.starting=null;};
      child.on('error',()=>failed(Error('Lokal billedmodel mangler. Kør setup-semantic.ps1 først.')));
      child.on('exit',code=>failed(Error(`Lokal billedmodel stoppede (${code}). ${stderr.slice(-600)}`)));
    });return this.starting;
  }
  infer(photos){
    const run=this.queue.then(async()=>{
      await this.start();const id=randomUUID();
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{this.pending.delete(id);this.child?.kill();reject(Error('Billedanalysen tog for lang tid.'));},this.timeout);
        this.pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
        this.child.stdin.write(JSON.stringify({id,photos})+'\n',error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
      });
    });this.queue=run.catch(()=>{});return run;
  }
  close(){this.child?.kill();}
}

export async function semanticCandidate(task,worker,{cacheRoot=folder+'data/semantic-cache'}={}){
  const jpeg=(await import('jpeg-js')).default;
  const photos=task.config.photos.photos.filter(p=>p.direction!=='nadir').map(p=>{
    const image=jpeg.decode(Buffer.from(p.image.split(',')[1],'base64'),{maxMemoryUsageInMB:48,maxResolutionInMP:2});
    return {photoKey:photoKey(p),image:p.image,targetRegion:targetRegion(task,p,image.width,image.height)};
  });
  const signature=createHash('sha256').update(JSON.stringify({revision:SEMANTIC_REVISION,method:'whole-house-facade-clipseg-v2',photos})).digest('hex');
  const cache=new Store(cacheRoot);await cache.init();
  const saved=await cache.read(signature+'.json');if(saved)return {...saved,cached:true};
  const result={...(await worker.infer(photos)),signature,model:'CIDAS/clipseg-rd64-refined',revision:SEMANTIC_REVISION,experimental:true,createdAt:new Date().toISOString()};
  await cache.write(signature+'.json',result);return result;
}

export function semanticAnalysis(task,candidate,model){
  const main=task.config.geometry.buildings.find(b=>b.main);if(!main)throw Error('Husets bygning mangler.');
  const patches=candidate.views.filter(v=>v.feature&&!v.abstained).map(v=>{
    const photo=task.config.photos.photos.find(p=>photoKey(p)===v.photoKey);
    if(!photo)throw Error('AI-forslaget matcher ikke originalfotoet.');
    return {faceId:`semantic:${main.id}:${createHash('sha256').update(v.photoKey).digest('hex').slice(0,16)}`,buildingId:main.id,viewId:`ai-${photo.direction}`,year:photo.capturedAt.slice(0,4),photoKey:v.photoKey,selectionMethod:'whole-house-clipseg-v2',samplingVersion:2,width:v.width,height:v.height,image:photo.image.split(',')[1],maskRuns:v.maskRuns,quality:{accepted:true,margin:2},contextCrop:[0,0,v.width,v.height],contextSize:[v.width,v.height]};
  });
  const result=facadeFeatures(patches);
  if(!result.faces.length)throw Error('Billedmodellen fandt ingen sikre facadeområder. Brug automatisk analyse eller tegn selv.');
  return {samplingVersion:2,manualSelections:[],semanticSampling:{model:candidate.model,revision:candidate.revision,signature:candidate.signature,method:'whole-house-clipseg-v2'},faces:result.faces.map(({faceId,views,feature})=>({faceId,buildingId:main.id,feature,patches:views,selectionMethod:'whole-house-clipseg-v2',baseline:baseline(feature),prediction:predict(model,feature),modelVersion:model?.version??'pixel-median-v1',split:split(main.id)})),rejectedFaces:result.rejectedFaces,rejectedViews:result.rejectedViews};
}
