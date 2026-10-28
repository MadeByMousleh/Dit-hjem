import {createHash} from 'node:crypto';
import {collectExteriorViews,loadExteriorImages,labelAllExteriorViews,exteriorVersion} from './exterior-views.mjs';
import {datasetVersion} from './multilabel.mjs';

export async function enrichExteriorTask(files,{services={}}={}){
 let task=await files.read('pilot.json');if(!task?.teacher||!task.inputFile)throw Error('House lacks saved labels or calibrated photos for exterior enrichment.');
 if(task.appearance?.exteriorVersion===exteriorVersion)return task;
 if(!await files.read('pilot-before-all-exterior-v2.json'))await files.write('pilot-before-all-exterior-v2.json',task);
 const oldDataset=await files.read('appearance-dataset.json');if(oldDataset&&!await files.read('appearance-dataset-before-all-exterior-v2.json'))await files.write('appearance-dataset-before-all-exterior-v2.json',oldDataset);
 const onUsage=async entry=>{task={...task,usage:[...(task.usage??[]),entry]};task.estimatedUsd=task.usage.reduce((n,u)=>n+(u.estimatedUsd??0),0);await files.write('pilot.json',task);};
 const context={houseId:task.id,address:task.address?.text??task.listing.address.text};
 try{
  const record=await collectExteriorViews(files,task,{onUsage,context,services});
  const images=await loadExteriorImages(files,record,{mainHouseOnly:true}),facades=images.filter(p=>p.audit.facadeAccepted);
  const input=await files.read(task.inputFile),aerial=input.photos.photos.map((p,i)=>({...p,id:`oblique-${p.direction}-${i}`}));
  const label=await labelAllExteriorViews(files,images,aerial,{onUsage,context,...(services.labelAppearance?{labeler:services.labelAppearance}:{})});
  await files.write('teacher-all-exterior-v2.json',label);
  const dataset={...oldDataset,schemaVersion:datasetVersion,createdAt:new Date().toISOString(),address:task.address,buildingId:task.buildingId,listingUrl:task.listing.url,teacher:label,automatic:true,humanVerified:false,coordinates:'ymin,xmin,ymax,xmax; 0..1000',images:[...images,...aerial].map(({image,...p})=>({...p,sha256:p.sha256??createHash('sha256').update(image).digest('hex')})),inputFile:task.inputFile,exteriorVersion,reviewFile:'review.json',previousDatasetFile:'appearance-dataset-before-all-exterior-v2.json'};
  await files.write('appearance-dataset.json',dataset);
  task={...task,teacher:label,resultFile:'teacher-all-exterior-v2.json',images:facades.slice(0,3).map(p=>({...p,selection:{reason:p.audit.reason,facadeBox:p.audit.facadeBox}})),imageReview:{reviewer:exteriorVersion,usableExteriors:facades.length,rejectedImageIds:[],reason:'All exterior views retained separately',checks:facades.map(p=>({id:p.id,accepted:true,facadeBox:p.audit.facadeBox}))},appearance:{schemaVersion:datasetVersion,visibilityAccepted:label.visibilityAccepted,visibleObliqueCount:label.visibleObliqueCount,labels:label.result.labels,exteriorVersion,processedExteriorIds:label.processedExteriorIds,batchCount:label.batchCount},exteriorEvidence:{version:exteriorVersion,images:images.length,facadeImages:facades.length,status:record.status},labelProvenance:{...task.labelProvenance,sourceImageHashes:images.map(p=>p.sha256),exteriorVersion},exteriorBackfillError:null,updatedAt:new Date().toISOString()};
  await files.write('pilot.json',task);return task;
 }catch(error){await files.write('pilot.json',{...task,exteriorBackfillError:error.message});throw error;}
}
