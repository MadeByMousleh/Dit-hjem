import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {parseListing} from './edc.mjs';
import {archiveFloorPlans,floorPlanSummary} from './floor-plans.mjs';
const url='https://www.edc.dk/alle-boliger/villa/1234-by/vej-1/12345678/';
const address={street:'Vej 1',postcode:'1234',text:'Vej 1, 1234 By'};
const plan=n=>({id:`plan-${n}`,sourceIndex:n,url:`https://billeder.edc.dk/edcmedia/plan-${n}.jpg`});
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'floor-plan-test-'));try{const files=new Store(root);await files.init();await fn(files);}finally{await rm(root,{recursive:true,force:true});}}
test('Parser keeps all supported plans outside the facade gallery and selects highest resolution',()=>{
 const photo=(id,width)=>({src:`https://billeder.edc.dk/edcmedia/${id}-${width}.jpg`,width,height:width});
 const item={estateTypeName:'Villa',caseNumber:'12345678',address:'Vej 1',zipCode:'1234',city:'By',images:[1,2,3].map(n=>({sources:[photo(n,300),photo(n,1080)]})),bluePrints:[{sources:[photo('plan',620),photo('plan',1920)]},{sources:[photo('plan-upstairs',1920)]},{sources:[{src:'https://untrusted.invalid/secret.jpg',width:1920}]}]};
 const result=parseListing(`<script type="application/json">${JSON.stringify(item)}</script>`,url);assert.equal(result.images.length,3);assert.equal(result.floorPlans.length,2);assert.equal(result.floorPlanSourceCount,3);assert.match(result.floorPlans[0].url,/1920/);assert.ok(result.images.every(p=>!p.url.includes('plan')));
});
test('Archive persists every floor plan with the same building outline and leaves colour labels/models untouched',async()=>fixture(async files=>{
 const listing={url,caseNumber:'12345678',address,floorPlans:[plan(0),plan(1)],floorPlanSourceCount:2};
 const task={listing,buildingId:'main',address:{id:'a1'},inputFile:'input.json'};
 await files.write('input.json',{geometry:{addressId:'a1',source:'synthetic-register',buildings:[{id:'neighbour',main:false,rings:[[9,9]]},{id:'main',main:true,rings:[[[0,0],[10,0],[10,5],[0,0]]],height:3}]}});
 await files.write('review.json',{status:'excluded',revision:4});await files.write('model.json',{version:'untouched'});let calls=0;
 const options={photoFetcher:async()=>{calls++;return {image:'data:image/jpeg;base64,AA==',sha256:'synthetic',bytes:1};}};
 const record=await archiveFloorPlans(files,task,options);assert.equal(record.status,'saved');assert.equal(record.plans.length,2);assert.equal(record.shape.buildingId,'main');assert.equal(record.shape.addressId,'a1');assert.equal(record.shape.rings[0][1][0],10);assert.equal(record.association.mainHouseAlignmentVerified,false);assert.equal(record.usedForColorTraining,false);assert.equal((await files.read('floor-plan-1.json')).image,'data:image/jpeg;base64,AA==');
 await archiveFloorPlans(files,task,options);assert.equal(calls,2);assert.deepEqual(await files.read('review.json'),{status:'excluded',revision:4});assert.deepEqual(await files.read('model.json'),{version:'untouched'});
}));
test('Missing plans and identity mismatches are recorded without inventing a plan',async()=>fixture(async files=>{
 const task={listing:{url,caseNumber:'12345678',address}};let photos=0;
 const mismatch=await archiveFloorPlans(files,task,{listingFetcher:async()=>({caseNumber:'other',address,floorPlans:[plan(0)]}),photoFetcher:async()=>{photos++;}});assert.equal(mismatch.status,'failed');assert.equal(photos,0);
 const missing=await archiveFloorPlans(files,task,{retryFailed:true,listingFetcher:async()=>({...task.listing,floorPlans:[],floorPlanSourceCount:0})});assert.equal(missing.status,'unavailable');assert.equal(floorPlanSummary(missing).count,0);
}));
test('A failed image keeps other plans and a retry downloads only the missing plan',async()=>fixture(async files=>{
 const task={listing:{url,caseNumber:'12345678',address,floorPlans:[plan(0),plan(1)],floorPlanSourceCount:2}};let calls=0;
 const result=await archiveFloorPlans(files,task,{photoFetcher:async u=>{calls++;if(u.endsWith('1.jpg'))throw Error('temporary source failure');return {image:'data:image/jpeg;base64,AA==',sha256:'one',bytes:1};}});assert.equal(result.status,'partial');assert.equal(floorPlanSummary(result).count,1);
 const retry=await archiveFloorPlans(files,task,{retryFailed:true,photoFetcher:async()=>{calls++;return {image:'data:image/jpeg;base64,AA==',sha256:'two',bytes:1};}});assert.equal(retry.status,'saved');assert.equal(calls,3);assert.equal(retry.plans[0].sha256,'one');
}));
