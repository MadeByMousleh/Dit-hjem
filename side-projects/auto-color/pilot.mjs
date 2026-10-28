import {errorInfo} from './gemini-queue.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {Store} from './store.mjs';
import {discover,fetchListing,fetchPhoto} from './edc.mjs';
import {selectExteriors,selectedExteriors,verifiedExteriors,verifyExteriors,labelFacade} from './teacher.mjs';
import {findAddressSuggestions} from '../../src/services/address-search.mjs';
import {getHomeGeometry} from '../../src/services/home-geometry-server.mjs';
import {getHomeHeights} from '../../src/services/home-height-server.mjs';
import {getHomeModelPhotos} from '../../src/services/home-model-photos-server.mjs';
import {labelAppearance,datasetVersion} from './multilabel.mjs';
import {archiveFloorPlans} from './floor-plans.mjs';
import {collectExteriorViews,loadExteriorImages,labelAllExteriorViews,exteriorVersion} from './exterior-views.mjs';
const normal=value=>String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export async function collectPilot(files,{url,progress=async()=>{},reviewMode=false,compact=false,multilabel=false,claimHouse=async()=>{},services={}}={}){
 const api={discover,fetchListing,fetchPhoto,findAddressSuggestions,getHomeGeometry,getHomeHeights,getHomeModelPhotos,selectExteriors,verifyExteriors,labelAppearance,labelFacade,...services};
 const existing=reviewMode?await files.read('pilot.json'):null;
 const id=existing?.id??randomUUID(),startedAt=existing?.startedAt??new Date().toISOString(),usage=existing?.usage??[];
 let task={...existing,id,status:'running',stage:'discovery',startedAt,scope:reviewMode?'human-review-list':'one-house-pilot',usage,images:existing?.images??[],sourcePermission:'User confirmed EDC agreement on 2026-10-21',batchAuthorization:reviewMode?'30-house-review':'pilot-only',maximumEstimatedUsd:.25,error:null};
 const save=async(stage,extra={})=>{task={...task,...extra,stage,updatedAt:new Date().toISOString()};await files.write('pilot.json',task);await progress(task);};
 const context={houseId:id,address:existing?.listing?.address?.text};
 const onUsage=async entry=>{usage.push(entry);await save(task.stage,{usage,estimatedUsd:usage.reduce((n,u)=>n+u.estimatedUsd,0)});};
 try{
  await save('discovery');const links=url?[url]:await api.discover();if(!links.length)throw Error('Ingen offentlige villaannoncer fundet.');
  const listing=existing?.listing??await api.fetchListing(links[0]);await save('exterior-selection',{listing});
  context.address=listing.address.text;
  if(multilabel){
   await save('address-resolution',{datasetVersion});
   const cached=task.inputFile?await files.read(task.inputFile):null;
   const matches=cached?[task.address]:(await api.findAddressSuggestions(listing.address.text)).filter(a=>a.kind==='address'&&a.postcode===listing.address.postcode&&normal(a.text.split(',')[0])===normal(listing.address.street.split(',')[0]));
   if(matches.length!==1)throw Error('EDC address could not be linked to its aerial photos.');
   const address=matches[0],geometry=cached?.geometry??await api.getHomeGeometry({id:address.id}),main=geometry.buildings.filter(b=>b.main);
   if(main.length!==1)throw Error('No unambiguous main house for EDC address.');
   await claimHouse({address,buildingId:main[0].id,listing});
   await save('oblique-photos',{address,buildingId:main[0].id});
   const [heights,photos]=cached?[cached.heights,cached.photos]:await Promise.all([api.getHomeHeights({id:address.id}),api.getHomeModelPhotos({id:address.id})]);
   if((photos.photos??[]).filter(p=>p.direction!=='nadir'&&p.image&&p.camera).length<2)throw Error('House lacks two calibrated aerial views.');
   const config={geometry,heights,texture:null,photos,sun:{minute:720,active:true,playing:false,live:false,vectors:Array.from({length:97},()=>[0,1,0]),photographic:false,photoColors:true}};
   await files.write(`input-${id}.json`,config);await save('exterior-selection',{inputFile:`input-${id}.json`});
  }
  let images,imageReview,verification,expandedImages;
  if(multilabel){
   const exterior=await collectExteriorViews(files,task,{onUsage,context,services});
   expandedImages=await loadExteriorImages(files,exterior,{mainHouseOnly:true});
   const facadeImages=expandedImages.filter(p=>p.audit.facadeAccepted);
   images=facadeImages.slice(0,3).map(p=>({...p,selection:{reason:p.audit.reason,facadeBox:p.audit.facadeBox}}));
   verification={accepted:facadeImages.length>0,model:'all-exterior-full-resolution-audit'};
   imageReview={reviewer:exteriorVersion,usableExteriors:facadeImages.length,rejectedImageIds:[],reason:'All exterior views archived separately; only wall photos appear as colour previews.',checks:facadeImages.map(p=>({id:p.id,accepted:true,facadeBox:p.audit.facadeBox,reason:p.audit.reason}))};
   await save('exterior-verification',{images,verification,imageReview,exteriorEvidence:{version:exteriorVersion,images:expandedImages.length,facadeImages:facadeImages.length,status:exterior.status}});
   if(exterior.status==='failed')throw Error('Exterior collection failed.');
   if(!verification.accepted)throw Error('No verified main-house facade photos in the exterior gallery.');
  }else{
  const cached=await files.read(`selection-${id}.json`),thumbnails=[];
  if(!cached)for(const image of listing.images){thumbnails.push({...image,...await api.fetchPhoto(image.thumbnailUrl)});}
  const selection=cached?selectedExteriors(cached,listing.images):await api.selectExteriors(thumbnails,{onUsage,context:{...context,stage:task.stage}});await files.write(`selection-${id}.json`,selection);
  if(reviewMode?selection.selected.length<1:selection.selected.length!==3)throw Error('Gemini fandt ikke tilstrækkelige tydelige facadefotos.');
  images=[];for(const selected of selection.selected){const source=listing.images.find(p=>p.id===selected.id),saved=existing?.images?.find(p=>p.id===selected.id&&p.url===source.url);images.push({...source,...(saved??await api.fetchPhoto(source.url)),selection:selected});}
  await save('exterior-verification',{images,selection:selection.selected});
  const savedVerification=await files.read(`verification-${id}.json`);
  verification=savedVerification?verifiedExteriors(savedVerification,images,reviewMode?1:3,reviewMode?.005:.08):await api.verifyExteriors(images,{onUsage,context:{...context,stage:task.stage},minimumImages:reviewMode?1:3,minimumArea:reviewMode?.005:.08});
  await files.write(`verification-${id}.json`,verification);
  const rejected=verification.checks.filter(c=>!c.accepted);
  imageReview={reviewer:'gemini-full-resolution-audit',usableExteriors:verification.checks.filter(c=>c.accepted).length,rejectedImageIds:rejected.map(c=>c.id),reason:rejected.map(c=>c.reason).join(' '),checks:verification.checks};
  await save(verification.accepted?'address-resolution':'needs-review',{verification:{accepted:verification.accepted,model:verification.model},imageReview,status:verification.accepted?'running':'needs-review'});
  if(!verification.accepted)return task;
  }
  const cachedInput=task.inputFile?await files.read(task.inputFile):null;
  const matches=cachedInput?[task.address]:(await findAddressSuggestions(listing.address.text)).filter(a=>a.kind==='address'&&a.postcode===listing.address.postcode&&normal(a.text.split(',')[0])===normal(listing.address.street.split(',')[0]));
  if(matches.length!==1)throw Error('EDC-adressen kunne ikke matches entydigt til adresseregisteret.');
  const address=matches[0],geometry=cachedInput?.geometry??await getHomeGeometry({id:address.id}),main=geometry.buildings.filter(b=>b.main);
  if(main.length!==1)throw Error('Adressen har ikke én entydig hovedbygning.');
  await save('oblique-photos',{address,buildingId:main[0].id});
  const [heights,photos]=cachedInput?[cachedInput.heights,cachedInput.photos]:await Promise.all([getHomeHeights({id:address.id}),getHomeModelPhotos({id:address.id})]);
  const oblique=photos.photos.filter(p=>p.direction!=='nadir');if(oblique.length<2)throw Error('For få kalibrerede skråfotos.');
  const config={geometry,heights,texture:null,photos,sun:{minute:720,active:true,playing:false,live:false,vectors:Array.from({length:97},()=>[0,1,0]),photographic:false,photoColors:true}};
  await files.write(`input-${id}.json`,config);
  await save('teacher-label',{oblique:oblique.map(p=>({direction:p.direction,capturedAt:p.capturedAt,image:p.image,width:p.width,height:p.height})),inputFile:`input-${id}.json`});
  // Archive separately; these images are never supplied to Gemini or colour feature extraction.
  try{await archiveFloorPlans(files,task,{listingFetcher:api.fetchListing,photoFetcher:api.fetchPhoto});}catch(error){await files.write('floor-plan-archive-error.json',{message:error.message,at:new Date().toISOString()});}
  const labelImages=multilabel?expandedImages:images.filter(p=>!imageReview.rejectedImageIds.includes(p.id)).slice(0,compact?1:3);
  const aerial=(multilabel?photos.photos:oblique).map((p,i)=>({...p,id:`oblique-${p.direction}-${i}`}));
  const label=existing?.teacher??await (multilabel?labelAllExteriorViews(files,labelImages,aerial,{onUsage,context,labeler:api.labelAppearance}):api.labelFacade(labelImages,aerial,{onUsage,context:{...context,stage:'teacher-label'}}));
  if(multilabel){
   const dataset={schemaVersion:datasetVersion,createdAt:new Date().toISOString(),address,buildingId:main[0].id,listingUrl:listing.url,teacher:label,automatic:true,humanVerified:false,coordinates:'ymin,xmin,ymax,xmax; 0..1000',images:[...labelImages,...aerial].map(({image,...p})=>({...p,sha256:p.sha256??createHash('sha256').update(image).digest('hex')})),inputFile:`input-${id}.json`,bbr:{roofMaterial:main[0].roofMaterial??null,source:geometry.source,fetchedAt:geometry.fetchedAt},vocabularyVersion:datasetVersion,promptVersion:datasetVersion,reviewFile:'review.json',notice:'Image evidence is retained in pilot/input files. The latest review.json controls exclusion, not this immutable proposal.'};
   await files.write('appearance-dataset.json',dataset);
   await save('teacher-label',{appearance:{schemaVersion:datasetVersion,visibilityAccepted:label.visibilityAccepted,visibleObliqueCount:label.visibleObliqueCount,labels:label.result.labels,exteriorVersion:label.exteriorVersion,processedExteriorIds:label.processedExteriorIds,batchCount:label.batchCount}});
  }
  await files.write(`teacher-${id}.json`,label);
  await save(label.accepted?'sampling':'needs-review',{teacher:label,resultFile:`teacher-${id}.json`,labelProvenance:{origin:'gemini-pseudo-label',model:label.model,sourceImageHashes:labelImages.map(p=>p.sha256),obliqueImageHashes:oblique.map(p=>createHash('sha256').update(p.image).digest('hex')),humanApproved:false},status:label.accepted?'running':'needs-review'});
  if(reviewMode)await save('review',{status:'awaiting-review'});
  return task;
 }catch(error){
  if(reviewMode&&!multilabel&&['address-resolution','oblique-photos'].includes(task.stage)&&task.imageReview?.usableExteriors){
   const warning=error.message;try{
    const label=await labelFacade(task.images.filter(p=>!task.imageReview.rejectedImageIds.includes(p.id)),[],{onUsage});
    await files.write(`teacher-${id}.json`,label);await save('review',{status:'awaiting-review',teacher:label,obliqueWarning:warning,sourceMatch:'EDC-only',labelProvenance:{origin:'gemini-pseudo-label',model:label.model,sourceImageHashes:task.images.map(p=>p.sha256),humanApproved:false}});return task;
   }catch(labelError){error=labelError;}
  }
  await save('error',{status:'failed',error:error instanceof Error?error.message:'Piloten fejlede.',errorInfo:errorInfo(error)});return task;
 }
}
export async function loadPilotRoot(root){const files=new Store(root);await files.init();return files;}
export async function resumeTeacher(files){
 let task=await files.read('pilot.json');if(!task?.images?.length||!task.inputFile)throw Error('Piloten mangler gemte billeder.');
 if(task.teacher)return task;
 if((task.teacherAttempts??1)>=3||task.estimatedUsd>=.20)throw Error('Pilotens forsøg eller forbrugsloft er nået.');
 const input=await files.read(task.inputFile),usage=task.usage??[];
 task={...task,status:'running',stage:'teacher-label',error:null,teacherAttempts:(task.teacherAttempts??1)+1};await files.write('pilot.json',task);
 try{
  const label=await labelFacade(task.images,input.photos.photos.filter(p=>p.direction!=='nadir').map((p,i)=>({...p,id:`oblique-${p.direction}-${i}`})),{onUsage:async entry=>{usage.push(entry);task={...task,usage,estimatedUsd:usage.reduce((n,u)=>n+u.estimatedUsd,0)};await files.write('pilot.json',task);}});
  task={...task,teacher:label,status:label.accepted?'running':'needs-review',stage:label.accepted?'sampling':'needs-review',labelProvenance:{origin:'gemini-pseudo-label',model:label.model,sourceImageHashes:task.images.map(p=>p.sha256),obliqueImageHashes:input.photos.photos.filter(p=>p.direction!=='nadir').map(p=>createHash('sha256').update(p.image).digest('hex')),humanApproved:false}};
  await files.write(`teacher-${task.id}.json`,label);await files.write('pilot.json',task);return task;
 }catch(error){task={...task,status:'failed',stage:'error',error:error.message};await files.write('pilot.json',task);return task;}
}
