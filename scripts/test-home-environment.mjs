import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {writeArrayBuffer} from 'geotiff';
import proj4 from 'proj4';
import {build} from 'esbuild';

const addressId='11111111-1111-1111-1111-111111111111';
const buildingId='22222222-2222-2222-2222-222222222222';
const point=proj4('EPSG:4326','+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',[9,55]);
const polygon=`POLYGON((${point[0]-10} ${point[1]-10},${point[0]+10} ${point[1]-10},${point[0]+10} ${point[1]+10},${point[0]-10} ${point[1]+10},${point[0]-10} ${point[1]-10}))`;
const hooks=registerHooks({load(url,context,next){
 if(url.endsWith('/bbr-property-server.mjs'))return {format:'module',shortCircuit:true,source:`export const getBbrProperty=async()=>(${JSON.stringify({sections:[{title:'Bygningen',records:[{id:buildingId,fields:[{key:'jordstykke',value:'1'}]}]}]})});`};
 if(url.endsWith('/address-search.mjs'))return {format:'module',shortCircuit:true,source:'export const findAddressSuggestionById=async()=>({x:9,y:55});'};
 return next(url,context);
}});
const {getHomeGeometry}=await import('../src/services/home-geometry-server.mjs');
const {getHomeHeights}=await import('../src/services/home-height-server.mjs');
hooks.deregister();
let spatialCalls=0,rasterCalls=0,truncated=false;
const fetcher=async(input,options)=>{
 const url=new URL(input);
 if(url.hostname==='wcs.datafordeler.dk'){
  rasterCalls++;
  const bounds=url.searchParams.get('BBOX').split(',').map(Number),width=Number(url.searchParams.get('WIDTH')),height=Number(url.searchParams.get('HEIGHT'));
  assert.ok(width<=256&&height<=256);
  const values=new Float32Array(width*height).fill(url.searchParams.get('COVERAGE')==='dhm_terraen'?10:15);
  const bytes=writeArrayBuffer(values,{width,height,BitsPerSample:[32],SampleFormat:[3],ModelPixelScale:[(bounds[2]-bounds[0])/width,(bounds[3]-bounds[1])/height,0],ModelTiepoint:[0,0,0,bounds[0],bounds[3],0],ProjectedCSTypeGeoKey:25832,GTModelTypeGeoKey:1,GTRasterTypeGeoKey:1});
  return new Response(bytes,{headers:{'Content-Type':'image/tiff'}});
 }
 assert.equal(url.hostname,'graphql.datafordeler.dk');
 const query=JSON.parse(options.body).query,root=query.match(/^\{(\w+)\(/)[1];
 let nodes=[];
 if(root==='MAT_Jordstykke')nodes=[{id_lokalId:'1',status:'Gældende',matrikelnummer:'1a',registreretAreal:400}];
 else if(root==='MAT_Lodflade')nodes=[{id_lokalId:'surface',jordstykkeLokalId:'1',status:'Gældende',geometri:{wkt:polygon}}];
 else if(root==='GEODKV_Bygning'){
  if(query.includes('intersects'))spatialCalls++;
  nodes=[{id_lokalId:'outline',BBRUUID:buildingId,status:'Anlagt',geometri:{wkt:polygon}}];
 }else throw Error(`Unexpected provider query ${root}`);
 return Response.json({data:{[root]:{nodes,pageInfo:{hasNextPage:truncated&&query.includes('intersects')}}}});
};
const deps={apiKey:'synthetic-only',fetcher};
const home=await getHomeGeometry({id:addressId},deps);
assert.equal(home.bbox[2]-home.bbox[0],52);
assert.equal(spatialCalls,1);
const wide=await getHomeGeometry({id:addressId,surroundings:'1'},deps);
assert.equal(wide.surroundings,true);
assert.equal(wide.bbox[2]-wide.bbox[0],320);
assert.equal(spatialCalls,5,'Four spatial tiles plus the original home query');
assert.equal(wide.buildings.length,1,'Overlapping tiles deduplicate outlines');
assert.equal(wide.buildings[0].main,true);
assert.deepEqual(wide.warnings,[]);
assert.deepEqual(await getHomeGeometry({id:addressId},deps),home,'Expanded request does not replace home cache');
const heights=await getHomeHeights({id:addressId},deps),expanded=await getHomeHeights({id:addressId,surroundings:'1'},deps);
assert.deepEqual(heights.bbox,home.bbox);
assert.deepEqual(expanded.bbox,wide.bbox);
assert.ok(expanded.terrain.every(value=>value===10)&&expanded.surface.every(value=>value===15));
assert.equal(expanded.width,256);
assert.equal(rasterCalls,4);
await getHomeHeights({id:addressId},deps);
assert.equal(rasterCalls,4,'Height caches remain separate and reusable');
for(const value of ['2',true,['1']]){
 await assert.rejects(getHomeGeometry({id:addressId,surroundings:value},deps),{status:400});
 await assert.rejects(getHomeHeights({id:addressId,surroundings:value},deps),{status:400});
}
truncated=true;
const partial=await getHomeGeometry({id:'33333333-3333-3333-3333-333333333333',surroundings:'1'},deps);
assert.ok(partial.warnings.length,'Truncated neighbourhood coverage is not claimed complete');
console.log('PASS: separate home/neighbourhood geometry and height caches, four bounded tiles, deduplication, unchanged home bounds, real TIFF decoding, invalid extent rejection and partial coverage warning. Synthetic providers only.');
const clientBuild=await build({stdin:{contents:"export * from './src/services/home-insights';export {bundledEnvironment} from './src/generated/home-environment';",loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'synthetic-api',setup(builder){builder.onResolve({filter:/\/supabase$/},()=>({path:'api',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const API_URL="https://synthetic.invalid";',loader:'js'}));}}]});
const {loadHomeEnvironment,homeEnvironmentFallback,bundledEnvironment}=await import(`data:text/javascript;base64,${Buffer.from(clientBuild.outputFiles[0].text).toString('base64')}`);
const previousFetch=globalThis.fetch,previousReader=globalThis.FileReader;
try{
 globalThis.FileReader=class{readAsDataURL(blob){void blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload?.();},error=>this.onerror?.(error));}};
 let imageCalls=0;
 globalThis.fetch=async input=>{const url=new URL(input),mode=url.searchParams.get('mode');if(mode==='geometry')return Response.json(wide);if(mode==='height')return new Response('',{status:503});if(mode==='orthophoto'){imageCalls++;return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});}throw Error('Unexpected image request');};
 const retained=await loadHomeEnvironment(home,new AbortController().signal,true);
 assert.equal(imageCalls,1,'Aerial map is requested even when heights fail');
 assert.equal(retained.heights,null,'Missing elevations are not invented');
 assert.ok(retained.texture.startsWith('data:image/jpeg;base64,'),'Usable imagery survives optional height failure');
 const clientHome={...home,addressId:'map-fallback-fixture'};
 let failGeometry=true,failPrimary=false,failFallback=false,resolveHeights,primaryRequests=0,fallbackRequests=0;
 const image=()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
 globalThis.fetch=async input=>{
  const url=new URL(input),mode=url.searchParams.get('mode'),id=url.searchParams.get('id');
  if(mode==='geometry')return failGeometry?new Response('',{status:503}):Response.json({...wide,addressId:id});
  if(mode==='height')return new Promise(resolve=>{resolveHeights=()=>resolve(Response.json({...expanded,addressId:id}));});
  if(mode==='orthophoto'){primaryRequests++;assert.deepEqual(url.searchParams.get('bbox').split(',').map(Number),wide.bbox,'Base map bounds match the existing server extent without waiting for geometry');return failPrimary?new Response('',{status:503}):image();}
  assert.equal(url.hostname,'services.arcgisonline.com');assert.equal(url.searchParams.get('bboxSR'),'25832');assert.equal(url.searchParams.get('imageSR'),'25832');assert.equal(url.searchParams.get('size'),'600,450');assert.deepEqual(url.searchParams.get('bbox').split(',').map(Number),wide.bbox);fallbackRequests++;return failFallback?new Response('',{status:503}):image();
 };
 let published;
 const earlyMap=new Promise(resolve=>{published=resolve;});
 const loading=loadHomeEnvironment(clientHome,new AbortController().signal,true,published);
 const early=await earlyMap;
 assert.equal(early.heights,null,'Map publishes before pending elevation request completes');
 assert.ok(early.texture);
 assert.deepEqual(early.geometry.buildings,home.buildings,'Geometry outage retains only known local outlines');
 resolveHeights();const withoutBuildings=await loading;
 assert.ok(withoutBuildings.heights);assert.ok(withoutBuildings.geometry.warnings.length);
 assert.equal(fallbackRequests,0,'Secondary provider is not contacted when the primary image succeeds');
 failPrimary=true;failGeometry=false;
 const fallbackReady=new Promise(resolve=>{published=resolve;});
 const fallbackLoading=loadHomeEnvironment(clientHome,new AbortController().signal,true,published);
 const fallbackMap=await fallbackReady;resolveHeights();const lowerDetail=await fallbackLoading;
 assert.ok(fallbackMap.textureSource.startsWith('Esri,'));assert.match(lowerDetail.status,/lavere detaljegrad/);assert.equal(fallbackRequests,1);
 failFallback=true;
 const cachedReady=new Promise(resolve=>{published=resolve;});
 const cachedLoading=loadHomeEnvironment(clientHome,new AbortController().signal,true,published);
 const cachedMap=await cachedReady;resolveHeights();const cachedResult=await cachedLoading;
 assert.equal(cachedMap.texture,lowerDetail.texture);assert.match(cachedResult.status,/senest indlæste/);
 const absent=loadHomeEnvironment({...clientHome,addressId:'different-address'},new AbortController().signal,true);resolveHeights();await assert.rejects(absent,/luftfoto/,'Cached maps never cross address boundaries');
 const cancelled=new AbortController();cancelled.abort();const beforeCancel=primaryRequests;
 await assert.rejects(loadHomeEnvironment(clientHome,cancelled.signal,true),/afbrudt/);assert.equal(primaryRequests,beforeCancel);
 failPrimary=false;failFallback=false;
 const pendingAbort=new AbortController(),abortReady=new Promise(resolve=>{published=resolve;});
 const abortLoading=loadHomeEnvironment(clientHome,pendingAbort.signal,true,published);await abortReady;pendingAbort.abort();resolveHeights();await assert.rejects(abortLoading,/afbrudt/,'Late optional results cannot publish after cancellation');
 console.log('PASS: early base imagery, optional geometry/heights, georeferenced secondary imagery, last-good map reuse, address isolation and cancellation. Synthetic providers only.');
 const bounds=bundledEnvironment.geometry.bbox,centerX=(bounds[0]+bounds[2])/2,centerY=(bounds[1]+bounds[3])/2,width=(bounds[2]-bounds[0])/6;
 const bundledHome={...bundledEnvironment.geometry,bbox:[centerX-width/2,centerY-width*3/8,centerX+width/2,centerY+width*3/8]};
 assert.equal(homeEnvironmentFallback(bundledHome),bundledEnvironment,'Matching map is available synchronously before any request');
 assert.equal(homeEnvironmentFallback({...bundledHome,addressId:'other-home'}),null,'Bundled private model never crosses addresses');
 assert.equal(homeEnvironmentFallback({...bundledHome,bbox:[0,0,1,1]}),null,'Changed location cannot reuse unrelated coverage');
 globalThis.fetch=async()=>{throw Error('Offline');};let immediate;
 const offline=loadHomeEnvironment(bundledHome,new AbortController().signal,true,value=>{immediate=value;});
 assert.equal(immediate,bundledEnvironment,'Offline model is published before waiting for network');
 const offlineResult=await offline;assert.equal(offlineResult.texture,bundledEnvironment.texture);assert.deepEqual(offlineResult.heights,bundledEnvironment.heights);assert.equal(offlineResult.geometry.buildings.length,bundledEnvironment.geometry.buildings.length);
 console.log('PASS: zero-network exact-address terrain/image/building fallback, immediate publication and location isolation.');
}finally{globalThis.fetch=previousFetch;globalThis.FileReader=previousReader;}