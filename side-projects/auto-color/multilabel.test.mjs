import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateAppearance,datasetVersion} from './multilabel.mjs';
import {collectPilot} from './pilot.mjs';
import {Store} from './store.mjs';
import {ReviewBatch,reviewable,appearanceBatch,addressKey} from './review.mjs';
import {exportAppearanceDataset} from './appearance-export.mjs';
const sales=[{id:'sale-1'}],aerial=[{id:'east',direction:'east'},{id:'west',direction:'west'}];
const label=(target,value,extra={})=>({target,value,regionId:'wall-brick',visibility:'visible',confidence:.95,evidence:[{imageId:'sale-1',box:[100,100,600,600]}],reason:'clear',...extra});
const answer=()=>({model:'synthetic',result:{sameBuilding:true,appearanceCompatible:true,uniformFacade:false,facadeHex:'#96533a',colorFamily:'red',confidence:.95,reason:'mixed',uncertainties:[],obliqueVisibility:aerial.map(p=>({imageId:p.id,mainHouseVisible:true,confidence:.9,box:[100,100,800,800],reason:'house visible'})),labels:[label('facade.material','brick'),label('facade.material','wood',{regionId:'wall-wood'}),label('facade.finish','thin_render_vandskuret'),label('roof.profile','standing_seam',{confidence:.6}),label('ground.edge','tumbled_herregaardssten_like',{visibility:'not_visible',evidence:[]})]}});
test('Mixed materials retain separate regions; uncertain profiles and unseen pavers cannot train',()=>{
 const result=validateAppearance(answer(),sales,aerial);assert.equal(result.visibilityAccepted,true);assert.equal(result.accepted,false);assert.equal(result.result.labels.filter(l=>l.accepted).length,3);assert.equal(result.result.labels[3].trainingValue,null);assert.equal(result.result.labels[4].trainingValue,null);
 const bad=answer();bad.result.labels[0].evidence[0].imageId='invented';assert.equal(validateAppearance(bad,sales,aerial).result.labels[0].accepted,false);
});
test('Aerial availability alone cannot admit a house: actual main-house visibility and matching are required',()=>{
 const hidden=answer();hidden.result.obliqueVisibility[1].mainHouseVisible=false;const result=validateAppearance(hidden,sales,aerial);assert.equal(result.visibilityAccepted,false);assert.ok(result.result.labels.every(l=>!l.accepted));
 const mismatch=answer();mismatch.result.sameBuilding=false;assert.equal(validateAppearance(mismatch,sales,aerial).visibilityAccepted,false);
 assert.equal(reviewable({datasetVersion,appearance:{visibilityAccepted:false},images:sales,teacher:answer()}),false);
});
test('Missing aerial photos and duplicate houses stop before Gemini, without EDC-only fallback',async()=>{
 const root=await mkdtemp(join(tmpdir(),'appearance-preflight-'));try{
  const files=new Store(root);await files.init();let paidCalls=0;
  const services={fetchListing:async()=>({address:{street:'Vej 1',postcode:'1234',text:'Vej 1, 1234 By'},images:sales}),findAddressSuggestions:async()=>[{kind:'address',id:'address-1',text:'Vej 1, 1234 By',postcode:'1234'}],getHomeGeometry:async()=>({buildings:[{main:true,id:'building-1'}]}),getHomeHeights:async()=>({}),getHomeModelPhotos:async()=>({photos:[]}),selectExteriors:async()=>{paidCalls++;throw Error('Should not call');},labelFacade:async()=>{paidCalls++;throw Error('Should not fall back');}};
  const noPhotos=await collectPilot(files,{url:'synthetic',reviewMode:true,multilabel:true,services});assert.equal(noPhotos.status,'failed');assert.match(noPhotos.error,/lacks two/);assert.equal(paidCalls,0);assert.equal(noPhotos.teacher,undefined);
  const duplicate=await collectPilot(files,{url:'synthetic',reviewMode:true,multilabel:true,services,claimHouse:async()=>{throw Error('Duplicate house');}});assert.match(duplicate.error,/Duplicate/);assert.equal(paidCalls,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('New 300 authorization is idempotent, and removing a house disables every exported task label',async()=>{
 const root=await mkdtemp(join(tmpdir(),'appearance-export-'));try{
  const files=new Store(root);await files.init();const batch=new ReviewBatch(files),id=randomUUID();await files.write('review-list.json',{target:430,items:[{id,multilabel:true,autoTrain:true}]});assert.equal((await batch.extend(300,appearanceBatch)).target,730);assert.equal((await batch.extend(300,appearanceBatch)).target,730);assert.equal((await batch.init()).authorizations.length,1);
  const store=batch.house(id);await store.init();const teacher=validateAppearance(answer(),sales,aerial);await store.write('pilot.json',{datasetVersion,appearance:{visibilityAccepted:true},images:sales,teacher});await store.write('appearance-dataset.json',{schemaVersion:datasetVersion,buildingId:'b1',teacher});
  assert.equal(await batch.autoInclude({id,multilabel:true,autoTrain:true}),true);assert.equal((await exportAppearanceDataset(batch)).houses[0].labels.filter(l=>l.enabled).length,3);
  await batch.saveReview(id,{revision:1,status:'excluded'});assert.equal(await batch.autoInclude({id,autoTrain:true}),false);assert.ok((await exportAppearanceDataset(batch)).houses[0].labels.every(l=>!l.enabled));assert.equal((await store.read('appearance-dataset.json')).teacher.result.labels.length,5);
  assert.equal(addressKey({street:'Vej 1',postcode:'1234'}),addressKey({street:'VEJ  1, Bydel',postcode:'1234'}));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('A complete collection preserves calibrated photos, regional labels and BBR independently',async()=>{
 const root=await mkdtemp(join(tmpdir(),'appearance-complete-'));try{
  const files=new Store(root);await files.init();const image='data:image/jpeg;base64,AA==';
  const photos={photos:['east','west','nadir'].map(direction=>({direction,camera:{synthetic:true},image,width:1000,height:1000}))};
  const listing={url:'synthetic',galleryVersion:2,caseNumber:'test',address:{street:'Vej 1',postcode:'1234',text:'Vej 1, 1234 By'},images:[{id:'sale-1',url:'large',thumbnailUrl:'small'},{id:'sale-2',url:'roof-large',thumbnailUrl:'roof-small'}],floorPlans:[{id:'plan-0',sourceIndex:0,url:'plan-only'}]};
  const selection={model:'synthetic',result:{exteriors:[{id:'sale-1',confidence:.9,facadeBox:[.1,.1,.9,.9]}]},selected:[{id:'sale-1',confidence:.9,facadeBox:[.1,.1,.9,.9]}]};
  const task=await collectPilot(files,{url:'synthetic',reviewMode:true,multilabel:true,services:{fetchListing:async()=>listing,findAddressSuggestions:async()=>[{kind:'address',id:'a1',postcode:'1234',text:'Vej 1, 1234 By'}],getHomeGeometry:async()=>({buildings:[{main:true,id:'b1',roofMaterial:{code:'6'}}],source:'synthetic register'}),getHomeHeights:async()=>({}),getHomeModelPhotos:async()=>photos,fetchPhoto:async url=>({image,sha256:url}),classifyExteriorThumbnails:async images=>({result:{checks:images.map(p=>({id:p.id,kind:'exterior',confidence:.95}))}}),auditExteriorImages:async images=>({result:{checks:images.map(p=>({id:p.id,kind:'exterior',subject:'main_house',confidence:.95,usableForFacadeColor:p.id==='sale-1',facadeBox:p.id==='sale-1'?[100,100,900,900]:[],details:['roof']}))}}),selectExteriors:async()=>selection,verifyExteriors:async()=>({model:'synthetic',accepted:true,checks:[{id:'sale-1',accepted:true}]}),labelAppearance:async(s,a)=>{assert.ok(a.length>=2 && a.length<=3);assert.ok(s.length>=1 && s.length<=2);assert.ok(s.some(p=>p.id==='sale-1'));const raw=answer();raw.result.obliqueVisibility=a.filter(p=>p.direction!=='nadir').map(p=>({imageId:p.id,mainHouseVisible:true,confidence:.9,box:[100,100,800,800]}));return validateAppearance(raw,s,a);}}});
  assert.equal(task.status,'awaiting-review');assert.equal(task.appearance.visibilityAccepted,true);assert.equal(reviewable(task),true);
  const record=await files.read('appearance-dataset.json');assert.ok(record.teacher.result.labels.length>=5);assert.equal(record.images.length,5);assert.ok(record.images.every(p=>!p.id.startsWith('plan-')));assert.equal((await files.read('floor-plans.json')).plans.length,1);assert.equal(record.bbr.roofMaterial.code,'6');assert.equal(record.humanVerified,false);assert.equal((await files.read(task.inputFile)).photos.photos.length,3);
 }finally{await rm(root,{recursive:true,force:true});}
});
