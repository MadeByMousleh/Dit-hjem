import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {parseListing} from './edc.mjs';
import {collectExteriorViews,loadExteriorImages,labelAllExteriorViews,imageBatches,exteriorVersion} from './exterior-views.mjs';
import {ReviewBatch} from './review.mjs';
const image='data:image/jpeg;base64,AA==';
const aerial=['east','west'].map(direction=>({id:`oblique-${direction}`,direction,image}));
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'exterior-views-test-'));try{const files=new Store(root);await files.init();await fn(files);}finally{await rm(root,{recursive:true,force:true});}}
const labelAnswer=(hex='#96533a')=>({model:'synthetic',result:{sameBuilding:true,appearanceCompatible:true,uniformFacade:true,facadeHex:hex,confidence:.95,uncertainties:[],labels:[{target:'roof.profile',regionId:'roof',value:'curved_tile',accepted:true,trainingValue:'curved_tile'}]},visibilityAccepted:true,visibleObliqueCount:2});
test('EDC gallery is not truncated after 32 photographs',()=>{
 const url='https://www.edc.dk/alle-boliger/villa/1234-by/vej-1/12345678/';
 const data={estateTypeName:'Villa',caseNumber:'12345678',address:'Vej 1',zipCode:'1234',city:'By',images:Array.from({length:75},(_,i)=>({sources:[300,1080].map(width=>({width,src:`https://billeder.edc.dk/edcmedia/${i}-${width}.jpg`}))}))};
 const parsed=parseListing(`<script type="application/json">${JSON.stringify(data)}</script>`,url);assert.equal(parsed.images.length,75);assert.equal(parsed.images[74].id,'sale-74');
});
test('Every gallery frame is classified; late roof details survive, interiors cannot enter labeling, and retries reuse images',async()=>fixture(async files=>{
 const gallery=Array.from({length:70},(_,i)=>({id:`sale-${i}`,url:`full-${i}`,thumbnailUrl:`thumb-${i}`}));const task={listing:{galleryVersion:2,url:'synthetic',caseNumber:'1',address:{street:'Vej 1',postcode:'1234'},images:gallery}};
 const classified=[],audited=[],downloads=[];
 const services={fetchPhoto:async url=>{downloads.push(url);return {image,sha256:url,bytes:1};},classifyExteriorThumbnails:async images=>{classified.push(...images.map(p=>p.id));return {result:{checks:images.map(p=>({id:p.id,kind:p.id==='sale-1'?'interior':'exterior',confidence:.95}))}};},auditExteriorImages:async images=>{audited.push(...images.map(p=>p.id));return {result:{checks:images.map(p=>({id:p.id,kind:p.id==='sale-2'?'interior':'exterior',subject:'main_house',confidence:.95,usableForFacadeColor:['sale-0','sale-3'].includes(p.id),facadeBox:[100,100,800,800],details:[p.id==='sale-69'?'roof_closeup':'exterior'],reason:'synthetic'}))}};}};
 const record=await collectExteriorViews(files,task,{services});assert.equal(record.status,'completed');assert.equal(classified.length,70);assert.equal(audited.length,69);assert.ok(!downloads.includes('full-1'));assert.equal(record.views.find(v=>v.id==='sale-2').accepted,false);assert.equal(record.views.find(v=>v.id==='sale-69').accepted,true);
 const images=await loadExteriorImages(files,record,{mainHouseOnly:true});assert.equal(images.length,68);assert.ok(!images.some(p=>['sale-1','sale-2'].includes(p.id)));
 const seen=new Set(),sizes=[];const labeled=await labelAllExteriorViews(files,images,aerial,{labeler:async photos=>{photos.forEach(p=>seen.add(p.id));sizes.push(photos.length);return labelAnswer();}});
 assert.equal(seen.size,68);assert.ok(seen.has('sale-69'));assert.ok(sizes.length>=3&&sizes.every(n=>n<=32));assert.equal(labeled.processedExteriorIds.length,68);
 const before=downloads.length;await collectExteriorViews(files,task,{services});assert.equal(downloads.length,before);
}));
test('Image batches obey both byte and count limits without losing views; colour disagreement blocks automatic labels',async()=>fixture(async files=>{
 const images=Array.from({length:7},(_,i)=>({id:`sale-${i}`,image:'x'.repeat(80),sha256:String(i),audit:{facadeAccepted:i<2}}));const context=[{image:'x'.repeat(30)}];
 const batches=imageBatches(images,{maxImages:4,maxBytes:200,context});assert.equal(batches.flat().length,7);assert.ok(batches.every(b=>b.length<=3&&b.reduce((n,p)=>n+p.image.length,30)<=200));
 const many=Array.from({length:40},(_,i)=>({...images[i%7],id:`sale-${i}`,sha256:`${i}`,audit:{facadeAccepted:i<2}}));let call=0;
 const result=await labelAllExteriorViews(files,many,aerial,{labeler:async()=>labelAnswer(call++?'#EEEEEE':'#111111')});assert.equal(result.accepted,false);assert.equal(result.visibilityAccepted,false);assert.ok(result.result.labels.every(l=>!l.accepted&&l.trainingValue===null));
}));
test('New evidence updates automatic reviews with history but never overwrites a user exclusion or manual acceptance',async()=>fixture(async files=>{
 const batch=new ReviewBatch(files),id=randomUUID(),store=batch.house(id);await store.init();
 const task={datasetVersion:'building-appearance-v1',appearance:{visibilityAccepted:true},teacher:labelAnswer(),images:[{id:'sale-0'}],labelProvenance:{sourceImageHashes:['more-images']}};
 const automatic={revision:1,status:'accepted',origin:'gemini-auto',actor:'automatic',hex:'#111111',history:[{revision:1,status:'accepted'}]};await store.write('review.json',automatic);
 await batch.updateAutomaticEvidence({id},task);let review=await store.read('review.json');assert.equal(review.hex,'#96533a');assert.equal(review.revision,2);assert.equal(review.history.length,2);assert.equal(review.exteriorVersion,exteriorVersion);
 for(const status of ['excluded','accepted']){const user={revision:3,status,origin:'gemini-auto',actor:'user',hex:'#FFFFFF'};await store.write('review.json',user);await batch.updateAutomaticEvidence({id},task);assert.deepEqual(await store.read('review.json'),user);}
}));
