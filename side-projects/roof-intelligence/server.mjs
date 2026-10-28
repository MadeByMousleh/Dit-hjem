import {createServer} from 'node:http';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {read,trainingInput} from './dataset.mjs';
import {categories,roofProfile} from './policy.mjs';
import {createHash} from 'node:crypto';
import {reviewKey,scopedReviews} from './review-scope.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),port=8793,host=`127.0.0.1:${port}`;
let training=false,writing=Promise.resolve();
async function status(){
 const report=await read('observations.json')??{houses:[]},reviews=await read('reviews.json')??{},input=await trainingInput();
 const houses=report.houses.map(h=>{const scoped=scopedReviews(report,reviews,h);return {...h,profile:roofProfile(h,scoped),objects:h.objects.filter(o=>o.category==='chimney'||scoped[o.id]?.category==='chimney').map(({feature,...o})=>({...o,review:scoped[o.id]??null}))};}).filter(h=>h.objects.length);
 return {progress:await read('progress.json'),training:await read('training.json'),trainingBusy:training,eligibleObjects:input.rows.filter(r=>r.kind==='aerial').length,eligibleHouses:new Set(input.rows.map(r=>r.buildingId)).size,humanReviews:houses.reduce((n,h)=>n+h.objects.filter(o=>o.review).length,0),houses};
}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'");
 const json=(value,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 try{
  if(req.headers.host!==host||req.headers.origin&&req.headers.origin!==`http://${host}`)return json({error:'Fremmed oprindelse afvist'},403);
  const url=new URL(req.url,`http://${host}`);
  if(req.method==='GET'&&['/','/app.js'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');return res.end(await readFile(folder+(url.pathname==='/'?'/index.html':'/app.js')));}
  if(req.method==='GET'&&url.pathname==='/api/status')return json(await status());
  if(req.method==='GET'&&url.pathname==='/source'){
   const manifest=await read('manifest.json'),house=manifest?.houses.find(h=>h.id===url.searchParams.get('house')),view=house?.views.find(v=>v.id===url.searchParams.get('view'));
   if(!view)return json({error:'Ukendt foto'},404);
   const saved=JSON.parse(await readFile(view.path,'utf8'));
   const image=view.kind==='aerial'?saved.photos.photos[view.index].image:view.index!=null?saved.images[view.index].image:saved.image;
   if(createHash('sha256').update(image).digest('hex')!==view.sha256)throw Error('Kildefotoet er ændret');
   res.setHeader('Content-Type','image/jpeg');return res.end(Buffer.from(image.split(',')[1],'base64'));
  }
  if(req.method==='GET'&&url.pathname==='/crop'){
   const id=url.searchParams.get('id');if(!/^[a-f0-9]{32}$/.test(id??''))return json({error:'Ugyldigt billede'},400);
   const report=await read('observations.json');if(!report?.houses.some(h=>h.objects.some(o=>o.id===id)))return json({error:'Ukendt billede'},404);
   res.setHeader('Content-Type','image/jpeg');return res.end(await readFile(`${folder}/data/crops/${id}.jpg`));
  }
  if(req.method!=='POST')return json({error:'Ikke fundet'},404);
  if(req.headers['x-roof-pilot']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json({error:'Ugyldig forespørgsel'},403);
  let body='',length=0;for await(const chunk of req){length+=chunk.length;if(length>1024)throw Error('For stor forespørgsel');body+=chunk;}const value=JSON.parse(body||'{}');
  if(url.pathname==='/api/review'){
   const box=value.boxNormalized;
   if(box!==undefined&&(!Array.isArray(box)||box.length!==4||!box.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||box[2]<=box[0]||box[3]<=box[1]))throw Error('Ugyldig ramme');
   if(training)return json({error:'Vent til træningen er færdig'},409);
   const report=await read('observations.json'),house=report?.houses.find(h=>h.id===value.houseId),object=house?.objects.find(o=>o.id===value.id&&o.viewId===value.viewId);
   if(!object||![...categories,'unknown','not_object'].includes(value.category))throw Error('Ugyldig vurdering for dette hus og foto');
   const key=reviewKey(house.id,object.viewId,object.id),review={category:value.category,boxNormalized:box,houseId:house.id,viewId:object.viewId,at:new Date().toISOString(),actor:'user'};
   writing=writing.catch(()=>{}).then(async()=>{const reviews=await read('reviews.json')??{};reviews[key]=review;await writeFile(folder+'/data/reviews.tmp',JSON.stringify(reviews));await rename(folder+'/data/reviews.tmp',folder+'/data/reviews.json');});await writing;return json({saved:true,review});
  }
  if(url.pathname==='/api/train'){
   if(training)return json({error:'Træningen kører allerede'},409);training=true;
   try{await writing;await trainingInput();const child=spawn(resolve(folder,'../color-trainer/data/semantic-runtime/python.exe'),['-u',folder+'/worker.py','--train'],{windowsHide:true,stdio:'ignore'});child.once('error',()=>{training=false;});child.once('close',()=>{training=false;});}catch(error){training=false;throw error;}
   return json({started:true});
  }
  return json({error:'Ikke fundet'},404);
 }catch(error){json({error:error.message},400);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Tagpilot: http://${host}`));
