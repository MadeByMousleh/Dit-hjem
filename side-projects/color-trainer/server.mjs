import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {randomUUID,randomInt} from 'node:crypto';
import {Store} from './store.mjs';
import {train} from './model.mjs';
import {analyzeTaskPatches} from './analysis.mjs';
import {buildRenderer} from './renderer.mjs';
import {SemanticWorker,semanticCandidate,semanticAnalysis} from './semantic.mjs';
import {readParts,saveParts,exportParts} from './parts-store.mjs';
import {houseProposal,partsStatus,nextPartsId} from './house-proposal.mjs';
import {houseAIWorker,houseAICandidate,houseAIInput} from './house-ai.mjs';
import {HouseTraining} from './house-training.mjs';
import {findAddressSuggestions} from '../../src/services/address-search.mjs';
import {getHomeGeometry} from '../../src/services/home-geometry-server.mjs';
import {getHomeHeights} from '../../src/services/home-height-server.mjs';
import {getHomeModelPhotos} from '../../src/services/home-model-photos-server.mjs';

const folder=dirname(fileURLToPath(import.meta.url));
const root=resolve(folder,'../..');
process.chdir(root);
try{process.loadEnvFile(resolve(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.COLOR_TRAINER_PORT||8791),origin=`http://127.0.0.1:${port}`;
const store=new Store(resolve(folder,'data'));await store.init();
const engine=await buildRenderer();
const semanticWorker=new SemanticWorker();
const partsAIWorker=houseAIWorker();
const houseTraining=new HouseTraining(store,{makeInput:houseAIInput});
process.once('exit',()=>partsAIWorker.close());
process.once('exit',()=>semanticWorker.close());
const source={name:'Skråfoto © Klimadatastyrelsen',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',terms:'https://dataforsyningen.dk/asset/PDF/rettigheder_vilkaar/Vilk%C3%A5r%20for%20frie%20geografiske%20data%20og%20CC%20BY%204_0%20licens.pdf',processing:'Originalfoto beskåret; facadeudsnit via kamerakalibrering og geometrimaske. HEX godkendes visuelt.'};
let loading=false;
const publicTask=t=>({...t,photos:t.config.photos.photos,config:undefined});
async function nextTask({reuseDraft=true}={}){
  if(loading)throw Error('Der hentes allerede et hus. Vent et øjeblik.');
  loading=true;
  try{
    const previous=await Promise.all((await store.tasks()).map(n=>store.read(n)));
    const pending=previous.find(t=>t.status==='draft');
    if(reuseDraft&&pending)return publicTask(pending);
    if(!process.env.DATAFORDELER_API_KEY||!(process.env.DATAFORSYNINGEN_TOKEN||process.env.DATAFORSYNING_API_KEY))throw Error('Der mangler DATAFORDELER_API_KEY eller DATAFORSYNINGEN_TOKEN i projektets lokale .env.');
    const seen=new Set(previous.flatMap(t=>t.config.geometry.buildings.filter(b=>b.main).map(b=>b.id)));
    const streets=['Birkevej','Skovvej','Bøgevej','Solvænget','Engvej','Møllevej','Lærkevej','Fasanvej','Egevej','Vibevej','Åvej','Toftevej'];
    const postcodes=['9000','8200','5250','6700','4000','6400','8800','7400','3400','4700','3700','4300','5700','9800','8920','6000','2830','2630','8600','7800','4760','4900','5610','7100','6855','6960','7600','7900','7700','9900','3000','4600'];
    for(let attempt=0;attempt<24;attempt++){
      const postcode=postcodes[randomInt(postcodes.length)];
      const query=`${streets[randomInt(streets.length)]} ${randomInt(1,35)}, ${postcode}`;
      let addresses;
      try{addresses=(await findAddressSuggestions(query)).filter(a=>a.kind==='address'&&a.postcode===postcode);}catch{continue;}
      // The provider search is deliberately bounded. This is random discovery,
      // not a statistically uniform sample of every Danish residential building.
      if(!addresses.length)continue;
      const address=addresses[randomInt(addresses.length)];
      if(previous.some(t=>t.address.id===address.id))continue;
      try{
        const geometry=await getHomeGeometry({id:address.id});
        const main=geometry.buildings.filter(b=>b.main);
        if(!main.length||main.some(b=>seen.has(b.id))||main.some(b=>b.height>10))continue;
        const [heights,photos]=await Promise.all([getHomeHeights({id:address.id}),getHomeModelPhotos({id:address.id})]);
        if(photos.photos.filter(p=>p.direction!=='nadir').length<2)continue;
        const id=randomUUID(),task={id,address,revision:0,status:'draft',faces:[],labels:[],history:[],source,createdAt:new Date().toISOString(),selection:{query,method:'Random street, house number and town; filtered by available geometry/photos'},config:{geometry,heights,texture:null,photos,sun:{minute:720,active:true,playing:false,vectors:Array(97).fill([0,1,0]),photographic:false,photoColors:true}}};
        await store.write(`task-${id}.json`,task);
        return publicTask(task);
      }catch{/* Try another candidate; no invented house or image. */}
    }
    throw Error('Ingen egnede huse fundet i denne runde. Prøv igen; billedadgang eller datakilder kan være midlertidigt utilgængelige.');
  }finally{loading=false;}
}
async function body(req){
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>18*1024*1024)throw Error('For stor forespørgsel.');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString());
}
const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'");
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
    if(req.headers.host!==`127.0.0.1:${port}`)return json({error:'Brug 127.0.0.1.'},403);
    if(req.headers.origin&&req.headers.origin!==origin)return json({error:'Fremmed oprindelse afvist.'},403);
    const url=new URL(req.url,origin);
    if(req.method==='POST'&&(!req.headers['content-type']?.startsWith('application/json')||req.headers['x-trainer']!=='1'))return json({error:'Ugyldig lokal forespørgsel.'},403);
    if(req.method==='GET'&&url.pathname==='/'){res.writeHead(302,{Location:'/facade'});return res.end();}
    if(req.method==='GET'&&['/facade','/hus','/house.js','/app.js','/inspection.js','/polygon-editor.js','/image-workspace.js','/parts-editor.js','/part-labels.mjs','/polygon.mjs','/sampling.mjs','/style.css'].includes(url.pathname)){
      const name=url.pathname==='/facade'?'index.html':url.pathname==='/hus'?'house.html':url.pathname.slice(1);
      res.writeHead(200,{'Content-Type':/\.m?js$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8'});return res.end(await readFile(resolve(folder,name)));
    }
    if(req.method==='GET'&&url.pathname==='/engine.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(engine);}
    if(req.method==='GET'&&url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    if(req.method==='GET'&&url.pathname==='/api/status'){
      const tasks=await Promise.all((await store.tasks()).map(n=>store.read(n)));
      const model=await store.read('model.json');
      return json({approved:tasks.filter(t=>t.status==='approved').length,labels:(await store.rows()).length,model:model?{version:model.version,trainingBuildings:model.trainingBuildings,evaluation:model.evaluation}:null,history:tasks.map(t=>({id:t.id,text:t.address.text,status:t.status}))});
    }
    if(req.method==='GET'&&url.pathname==='/api/parts/status')return json(await partsStatus(store,readParts));
    if(req.method==='GET'&&url.pathname==='/api/parts/training')return json(await houseTraining.status());
    if(req.method==='POST'&&url.pathname==='/api/parts/train')return json(await houseTraining.start());
    if(req.method==='POST'&&url.pathname==='/api/parts/next'){
      const input=await body(req),state=await partsStatus(store,readParts),id=nextPartsId(state.history,input.after);
      return json(id?publicTask(await store.read(`task-${id}.json`)):await nextTask({reuseDraft:false}));
    }
    if(req.method==='POST'&&url.pathname==='/api/next')return json(await nextTask());
    if(req.method==='POST'&&url.pathname==='/api/train'){
      const model=await store.serial(async()=>{const model=train(await store.rows());await store.write(`model-${model.version.replaceAll(':','-')}.json`,model);await store.write('model.json',model);return model;});
      return json({version:model.version,trainingBuildings:model.trainingBuildings,evaluation:model.evaluation});
    }
    if(req.method==='GET'&&url.pathname==='/api/export'){
      res.setHeader('Content-Disposition','attachment; filename="facade-colors.json"');
      return json({version:1,source,rows:await store.rows()});
    }
    if(req.method==='GET'&&url.pathname==='/api/parts/export'){
      res.setHeader('Content-Disposition','attachment; filename="building-parts.json"');return json(await exportParts(store));
    }
    const match=url.pathname.match(/^\/api\/task\/([\da-f-]{36})(\/(?:scene|patches|save|semantic|parts|house-proposal|house-ai))?$/i);
    if(match){
      const task=await store.read(`task-${match[1]}.json`);if(!task)return json({error:'Huset findes ikke.'},404);
      if(req.method==='GET'&&match[2]==='/scene'){
        const points=task.config.geometry.buildings.filter(b=>b.main).flatMap(b=>b.rings.flat());
        const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
        const bbox=[Math.min(...xs)-8,Math.min(...ys)-8,Math.max(...xs)+8,Math.max(...ys)+8];
        const config={...task.config,geometry:{...task.config.geometry,bbox}};
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
        return res.end(`<!doctype html><html><head><style>body{margin:0;overflow:hidden}</style></head><body><script>window.HOME_MODEL=${JSON.stringify(config).replaceAll('<','\\u003c')};</script><script src="/engine.js"></script></body></html>`);
      }
      if(req.method==='GET'&&!match[2])return json(publicTask(task));
      if(req.method==='GET'&&match[2]==='/house-proposal')return json(houseProposal(task));
      if(req.method==='POST'&&match[2]==='/house-ai'){const input=await body(req);return json(await houseAICandidate(task,input.photoKey,partsAIWorker));}
      if(match[2]==='/parts'){
        if(req.method==='GET'){
          const parts=await readParts(store,task.id),confirmation=await houseTraining.confirmation();
          if(confirmation.tasks.some(t=>t.id===task.id&&t.revision===parts.revision))parts.mainCompletePhotos=[...new Set(parts.regions.filter(r=>parts.objects.find(o=>o.id===r.objectId)?.category==='main-house').map(r=>r.photoKey))];
          return json(parts);
        }
        if(req.method==='POST')return json(await saveParts(store,task.id,await body(req)));
      }
      if(req.method==='POST'&&match[2]==='/semantic')return json(await semanticCandidate(task,semanticWorker));
      if(req.method==='POST'&&match[2]==='/save'){
        const b=await body(req);let analysis;
        if(b.semanticSignature!==undefined){
          if(typeof b.semanticSignature!=='string'||!(/^[a-f0-9]{64}$/).test(b.semanticSignature))throw Error('Ugyldigt AI-forslag.');
          const candidate=await semanticCandidate(task,semanticWorker);
          if(candidate.signature!==b.semanticSignature)throw Error('AI-forslaget er forældet. Hent det igen.');
          analysis=semanticAnalysis(task,candidate,await store.read('model.json'));
        }
        return json(publicTask(await store.save(task.id,b.revision,b.labels,b.status,b.houseColor,b.manualSelections,analysis)));
      }
      if(req.method==='POST'&&match[2]==='/patches'){
        const b=await body(req);
        return json(publicTask(await analyzeTaskPatches(store,task.id,b.patches)));
      }
    }
    return json({error:'Ukendt handling.'},404);
  }catch(e){json({error:e.message?.includes('apiKey')?'Datakilden svarede med en fejl.':e.message||'Handlingen fejlede.'},400);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Farvetræner klar: ${origin}`));
