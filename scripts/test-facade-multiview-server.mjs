import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {analyzeFacadeMultiview,boxToWall,consensusOpenings,splitByQuality,multiviewOpeningsResponse,detectWallOpenings,tileFused,dedupeOpenings,refineOpening} from '../src/services/facade-multiview-server.mjs';
import {GROUND,EAVES,building,heights,windows,cameraSet} from './lib/synthetic-facade.mjs';

// Pure helpers.
const image={widthMeters:12,heightMeters:3.35,zTop:EAVES+0.25},levels={ground:GROUND,eaves:EAVES};
const w=windows[0],box={kind:'window',confidence:0.9,box:[Math.round((image.zTop-w.z1)/image.heightMeters*1000),Math.round(w.u0/12*1000),Math.round((image.zTop-w.z0)/image.heightMeters*1000),Math.round(w.u1/12*1000)]};
const wall=boxToWall(box,image,levels);assert.ok(Math.abs(wall.u0-w.u0)<0.02&&Math.abs(wall.u1-w.u1)<0.02&&Math.abs(wall.z0-w.z0)<0.02&&Math.abs(wall.z1-w.z1)<0.02,'box maps to wall metres');
assert.equal(boxToWall({...box,box:[0,0,1000,1000]},image,levels),null,'whole-wall box is not a window');
assert.equal(boxToWall({...box,box:[900,100,1000,110]},image,levels),null,'sliver is rejected');
assert.equal(boxToWall({...box,kind:'door'},image,levels),null,'a window-sized box is not a door');
const a={kind:'window',u0:1,u1:2,z0:8,z1:9,confidence:0.8},b={...a,u0:1.1,u1:2.2,z0:8.1,z1:9.1,confidence:0.9};
assert.equal(consensusOpenings([[a],[b]]).length,1);assert.equal(consensusOpenings([[a],[b]])[0].support,2);
assert.equal(consensusOpenings([[a],[{...b,u0:6,u1:7}]]).length,0,'disagreeing groups confirm nothing');
assert.equal(consensusOpenings([[a],[{...b,kind:'door'}]]).length,0,'kind must agree');
assert.equal(consensusOpenings([[{...a,confidence:0.95}],[]]).length,1,'very confident single-group evidence is kept');
assert.equal(consensusOpenings([[a],[]]).length,0,'weak single-group evidence is dropped');
assert.deepEqual(splitByQuality([1,2,3,4,5]),[[1,3,5],[2,4]]);
const strip={width:480,height:134,rgb:new Uint8ClampedArray(480*134*3)};
const tiles=tileFused(strip,0.025);assert.equal(tiles.length,2);assert.ok(tiles.every(t=>t.fused.width*0.025<=6.5+1e-9)&&Math.abs(tiles[1].offset+tiles[1].fused.width*0.025-12)<1e-9,'tiles cover the whole wall');assert.equal(tileFused({...strip,width:200},0.025).length,1);
assert.equal(dedupeOpenings([a,{...a,confidence:0.95,u0:1.05},{...a,u0:6,u1:7}]).length,2,'overlap between tiles keeps one');
const ground=7.4,eaves=10.4,lv={ground,eaves};
const door=refineOpening({kind:'door',u0:1,u1:2,z0:7.9,z1:9.5,confidence:.9},lv);assert.equal(door.z0,ground,'door reaches the threshold');assert.ok(door.z1-door.z0>=2,'door has door height');
assert.ok(refineOpening({kind:'window',u0:1,u1:2,z0:8.5,z1:10.4,confidence:.9},lv).z1<=eaves-0.2+1e-9,'nothing reaches the roof edge');
assert.equal(refineOpening({kind:'window',u0:0,u1:5,z0:8.5,z1:9.4,confidence:.9},lv),null,'merged window band is rejected');

// Provider response handling.
process.env.GEMINI_API_KEY='synthetic-only';
const reply=raw=>async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(raw)}]}}]})});
const input=[{id:'w#A',base64:'x',widthMeters:12,heightMeters:3}];
const good=await detectWallOpenings(input,{fetcher:reply({walls:[{imageId:'w#A',openings:[{kind:'window',box_2d:[100,100,300,300],confidence:0.9},{kind:'window',box_2d:[100,100,300,300],confidence:0.4},{kind:'window',box_2d:[300,100,100,300],confidence:0.9}]}]})});
assert.equal(good.get('w#A').length,1,'low confidence and inverted boxes are dropped');
await assert.rejects(detectWallOpenings(input,{fetcher:reply({walls:[{imageId:'invented',openings:[]}]})}));
await assert.rejects(detectWallOpenings(input,{fetcher:async()=>({ok:false})}));

// End to end with a synthetic scene and an oracle detector: output is in world coordinates.
const photos=cameraSet(1),sources=photos.map(p=>({id:p.id,direction:'south',capturedAt:p.capturedAt,asset:p.asset,camera:p.camera}));
let seen=null;
const detect=async images=>{
 seen=images;const out=new Map();
 for(const im of images){const decoded=jpeg.decode(Buffer.from(im.base64,'base64'));assert.ok(decoded.width>=480&&decoded.height>=100,'wall image has usable size');
  const offset=Number(im.id.split('@')[1])*5.5;
  out.set(im.id,windows.filter(v=>v.u0>=offset&&v.u1<=offset+im.widthMeters).map(v=>({kind:v.kind,confidence:0.9,box:[(EAVES+0.25-v.z1)/im.heightMeters*1000,(v.u0-offset)/im.widthMeters*1000,(EAVES+0.25-v.z0)/im.heightMeters*1000,(v.u1-offset)/im.widthMeters*1000].map(Math.round)})));}
 return out;
};
const deps={getGeometry:async()=>({buildings:[building],longitude:9.8,latitude:54.9}),getHeights:async()=>heights,getSources:async()=>({photos:sources}),readWindow:async photo=>photos.find(p=>p.id===photo.id).window,detect};
const analysis=await analyzeFacadeMultiview({id:'x'},{...deps,apiKey:'k',token:'t'});
assert.equal(analysis.status,'ok');assert.equal(analysis.walls.length,windows.length);assert.equal(seen.length,4,'two independent photo groups, each in two tiles, for the one wall that is photographed');
for(const [i,o] of analysis.walls.entries()){const v=windows[i];
 assert.equal(o.kind,v.kind);assert.equal(o.support,2);
 assert.ok(Math.abs(o.p0[0]-v.u0)<0.03&&Math.abs(o.p1[0]-v.u1)<0.03&&Math.abs(o.p0[1])<0.01&&Math.abs(o.z0-v.z0)<0.03&&Math.abs(o.z1-v.z1)<0.03,`opening ${i} in world coordinates: ${JSON.stringify(o)}`);}
assert.ok(!JSON.stringify(analysis).includes('base64'),'no image data is returned to the client');
assert.equal((await analyzeFacadeMultiview({id:'x'},{...deps,getHeights:async()=>null,apiKey:'k',token:'t'})).status,'height_unavailable');
await assert.rejects(analyzeFacadeMultiview({id:'x'},{...deps,apiKey:'',token:'t'}),/konfigureret/);

// Endpoint: authentication, membership, caching of successes and a per-user rate limit for the rest.
process.env.SUPABASE_URL='https://synthetic.supabase.co';
const req=new Request('https://local/api',{method:'POST',headers:{authorization:'Bearer synthetic'}}),householdId='11111111-1111-1111-1111-111111111111',addressId='22222222-2222-2222-2222-222222222222';
const context=(member)=>async(_req,config)=>{assert.equal(config.auth,'user');return {data:{userClaims:{id:'synthetic-user'},supabase:{from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:member,error:null};}};}}}};};
let calls=0;const ok=async()=>{calls++;return {status:'ok',walls:[]};},empty=async()=>{calls++;return {status:'no_data',walls:[]};};
assert.equal((await multiviewOpeningsResponse(new Request('https://local',{method:'POST'}),{},{contextFactory:context({}),analyzer:ok})).status,401);
assert.equal((await multiviewOpeningsResponse(req,{householdId,addressId},{contextFactory:context(null),analyzer:ok})).status,403);assert.equal(calls,0);
assert.equal((await multiviewOpeningsResponse(req,{householdId,addressId:'bad'},{contextFactory:context({}),analyzer:ok})).status,400);assert.equal(calls,0);
assert.equal((await multiviewOpeningsResponse(req,{householdId,addressId},{contextFactory:context({}),analyzer:empty})).status,200);assert.equal(calls,1);
assert.equal((await multiviewOpeningsResponse(req,{householdId,addressId},{contextFactory:context({}),analyzer:empty})).status,429);assert.equal(calls,1);
const other='33333333-3333-3333-3333-333333333333',cachedAddress='44444444-4444-4444-4444-444444444444';
const reqOther=new Request('https://local/api',{method:'POST',headers:{authorization:'Bearer synthetic'}});
const cacheContext=id=>async()=>({data:{userClaims:{id},supabase:{from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{},error:null};}};}}}});
assert.equal((await multiviewOpeningsResponse(reqOther,{householdId:other,addressId:cachedAddress},{contextFactory:cacheContext('u2'),analyzer:ok})).status,200);assert.equal(calls,2);
assert.equal((await multiviewOpeningsResponse(reqOther,{householdId:other,addressId:cachedAddress},{contextFactory:cacheContext('u2'),analyzer:ok})).status,200);assert.equal(calls,2,'successful analyses are cached per address');
console.log('Multi-view facade server: geometry mapping, consensus, provider validation, end-to-end world coordinates, auth/membership/cache/rate limit pass. Synthetic imagery and oracle detector.');
