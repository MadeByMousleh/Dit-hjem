import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
let config=JSON.parse(await readFile('.tmp/neighborhood-color/config.json','utf8'));
const generated=await readFile('src/generated/home3d-bundle.ts','utf8'),engine=JSON.parse(generated.slice(generated.indexOf('export const home3dBundle=')+'export const home3dBundle='.length).trim().replace(/;$/,''));
const tiles=(await Promise.all((await readdir('.tmp/neighborhood-color')).filter(n=>/^tile-.*json$/.test(n)).map(async n=>JSON.parse(await readFile('.tmp/neighborhood-color/'+n,'utf8'))))).filter(tile=>tile.addressId===config.geometry.addressId);
const wanted=new Set(tiles.flatMap(tile=>tile.neighborhood.tiles.find(t=>t.id===tile.neighborhood.tile).buildingIds));
// Keep actual occluding buildings; decimate height grids for software-renderer verification.
function reduceGrid(grid){if(!grid)return null;const width=64,height=64,sample=values=>Array.from({length:width*height},(_,i)=>values[Math.min(grid.height-1,Math.floor(Math.floor(i/width)*grid.height/height))*grid.width+Math.min(grid.width-1,Math.floor((i%width)*grid.width/width))]);return {...grid,width,height,terrain:sample(grid.terrain),surface:sample(grid.surface),resolution:[(grid.bbox[2]-grid.bbox[0])/width,(grid.bbox[3]-grid.bbox[1])/height]};}
config.sun.active=true;config.sun.vectors=Array.from({length:97},()=>[0,1,0]);config.sun.vegetationVisible=false;config.sun.vegetationShadows=false;config.heights=reduceGrid(config.heights);config.environment.heights=reduceGrid(config.environment.heights);
console.log('Starting actual-image neighbor test with decimated height grids.');
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/engine.js'){res.setHeader('Content-Type','text/javascript');return res.end(engine);}res.setHeader('Content-Type','text/html');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><script>window.messages=[];window.ReactNativeWebView={postMessage:r=>window.messages.push(JSON.parse(r))};window.HOME_MODEL=${JSON.stringify(config).replaceAll('<','\\u003c')};</script><script src="/engine.js"></script></body></html>`);});await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);console.log('Renderer loaded.');await page.waitForFunction(()=>window.messages.some(m=>m.type==='prepared-model'),null,{timeout:120000});
 console.log('Main analysis ready.');
 const mainIds=new Set(config.geometry.buildings.filter(b=>b.main).map(b=>b.id));
 const before=await page.evaluate(()=>window.messages.filter(m=>m.type==='material-colors').at(-1)?.colors??{});
 for(const [i,tile]of tiles.entries()){
  const batch={addressId:config.geometry.addressId,requestId:'fixture-'+i,photos:tile.photos,buildingIds:tile.neighborhood.tiles.find(t=>t.id===tile.neighborhood.tile).buildingIds};
  await page.evaluate(b=>window.home3d.analyzeNeighborhood(b),batch);await page.waitForFunction(id=>window.messages.some(m=>m.type==='neighbor-colors-ready'&&m.requestId===id),batch.requestId,{timeout:90000});
  console.log('Neighbor tile ready',i);
  const ack=await page.evaluate(id=>window.messages.find(m=>m.requestId===id),batch.requestId);assert.ok(!ack.error,ack.error);
 }
 const after=await page.evaluate(()=>window.messages.filter(m=>m.type==='material-colors').at(-1)?.colors??{}),neighbors=Object.entries(after).filter(([id,c])=>!mainIds.has(id)&&c.walls?.method==='trained-facade-knn-v1');
 console.log(JSON.stringify({beforeLearned:Object.values(before).filter(c=>c.walls?.method==='trained-facade-knn-v1').length,afterLearned:Object.values(after).filter(c=>c.walls?.method==='trained-facade-knn-v1').length,learnedNeighbors:neighbors.length,errors}));
 assert.ok(neighbors.length>0,'Actual calibrated neighbor images produce learned neighbor colors');
 await page.evaluate(id=>window.home3d.analyzeNeighborhood({addressId:id,requestId:'complete',photos:[],buildingIds:[],complete:true,coverage:{version:1,totalTiles:2,completedTiles:2,failedTiles:0}}),config.geometry.addressId);
 await page.waitForFunction(()=>window.messages.some(m=>m.requestId==='complete'));
 const saved=await page.evaluate(()=>window.messages.filter(m=>m.type==='prepared-model').at(-1).model);
 for(const [id,c]of neighbors){assert.deepEqual(saved.scene.colors[id],c);assert.ok(saved.scene.buildings.some(b=>b.surface?.id===id&&b.surface.kind==='walls'));}
 await page.screenshot({path:'.tmp/neighborhood-color/colored-neighbors.png'});
 config={...config,prepared:saved.scene,photos:null};await page.reload();await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
 assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='prepared-model').length),0);assert.deepEqual(errors,[]);
 await writeFile('.tmp/neighborhood-color/browser-verification.json',JSON.stringify({learnedNeighbors:neighbors.length,colors:neighbors.map(([id,c])=>({id,...c.walls})),savedAndRestored:true,pageErrors:errors},null,2));
 console.log('PASS actual neighbor crops -> learned colors -> saved identity/evidence; reopening performs no new analysis');
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
