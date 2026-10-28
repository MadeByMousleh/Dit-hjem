import {split} from '../color-trainer/model.mjs';
import {datasetVersion} from './multilabel.mjs';

// Export fresh review state each time: removing a house excludes ALL its labels.
export async function exportAppearanceDataset(batch){
 const list=await batch.init(),houses=[];
 for(const item of list.items){
  if(!item.multilabel)continue;
  const files=batch.house(item.id),record=await files.read('appearance-dataset.json');if(!record)continue;
  const review=await files.read('review.json');
  const exterior=await files.read('exterior-views.json');
  houses.push({id:item.id,...record,exteriorViews:exterior?{version:exterior.version,status:exterior.status,galleryImages:exterior.galleryImages,classifiedImages:exterior.classifiedImages,images:exterior.views.filter(v=>v.accepted&&!v.duplicateOf)}:null,floorPlans:await files.read('floor-plans.json'),enabled:review?.status==='accepted',review:review?{status:review.status,revision:review.revision,origin:review.origin}:null,buildingSplit:split(record.buildingId),labels:record.teacher.result.labels.map(l=>({...l,enabled:review?.status==='accepted'&&l.accepted}))});
 }
 return {schemaVersion:datasetVersion,exportedAt:new Date().toISOString(),labelSource:'Gemini pseudo-labels, not independent ground truth',notice:'Building splits are shared across tasks. Existing human evaluation buildings must remain protected in downstream training.',houses};
}
