import {createHash} from 'node:crypto';
import {fetchListing,fetchPhoto} from './edc.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const normalized=a=>[a?.street?.split(',')[0],a?.postcode].join('|').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const floorPlanSummary=r=>r?{status:r.status,count:r.plans?.filter(p=>p.status==='saved').length??0,available:r.sourceCount??0,failed:r.plans?.filter(p=>p.status==='failed').length??0,archivedOnly:true,usedForColorTraining:false,association:r.association}:null;

// Separate files avoid changing a running collector's pilot.json or human reviews.
export async function archiveFloorPlans(files,task,{listingFetcher=fetchListing,photoFetcher=fetchPhoto,retryFailed=false}={}){
 const previous=await files.read('floor-plans.json');
 if(previous&&['saved','unavailable'].includes(previous.status))return previous;
 if(previous?.status==='failed'&&!retryFailed)return previous;
 if(!task?.listing)return null;
 let record={...previous,schemaVersion:'floor-plan-archive-v1',listingUrl:task.listing.url,caseNumber:task.listing.caseNumber,listingAddress:task.listing.address,archivedOnly:true,usedForColorTraining:false,plans:previous?.plans??[],updatedAt:new Date().toISOString(),association:{scope:'listing-property',mainHouseAlignmentVerified:false,floorLevelsVerified:false,orientationVerified:false,scaleVerified:false},notice:'Raw listing plans may include multiple floors, variants or outbuildings. Pairing to the property is not a verified floor-plan-to-footprint alignment.'};
 try{
  const listing=Array.isArray(task.listing.floorPlans)?task.listing:await listingFetcher(task.listing.url);
  if(String(listing.caseNumber)!==String(task.listing.caseNumber)||normalized(listing.address)!==normalized(task.listing.address))throw Error('Floor-plan listing identity does not match the saved house.');
  const input=task.inputFile?await files.read(task.inputFile):null,geometry=input?.geometry,main=geometry?.buildings?.find(b=>b.id===task.buildingId&&b.main);
  record={...record,listingFetchedAt:listing.fetchedAt,rights:listing.rights,sourceCount:listing.floorPlanSourceCount??listing.floorPlans?.length??0,candidates:listing.floorPlans??[],shape:main?{addressId:geometry.addressId??task.address?.id,buildingId:main.id,bbrId:main.bbrId??null,rings:main.rings,height:main.height,source:geometry.source,fetchedAt:geometry.fetchedAt,geometryHash:digest({buildingId:main.id,rings:main.rings,height:main.height}),inputFile:task.inputFile}:null,error:null};
  const plans=[];
  for(const plan of listing.floorPlans??[]){
   const cached=record.plans.find(p=>p.url===plan.url&&p.status==='saved');if(cached){plans.push(cached);continue;}
   try{const file=`floor-plan-${plan.sourceIndex}.json`,image=await photoFetcher(plan.url);await files.write(file,{...plan,...image});plans.push({...plan,file,sha256:image.sha256,bytes:image.bytes,status:'saved',savedAt:new Date().toISOString()});}
   catch(error){plans.push({...plan,status:'failed',error:error.message});}
  }
  record={...record,plans,status:plans.some(p=>p.status==='failed')?'partial':plans.length?'saved':record.sourceCount?'unsupported':'unavailable'};
 }catch(error){record={...record,status:'failed',error:error.message};}
 await files.write('floor-plans.json',record);return record;
}
