export const categories=['chimney'];
export function eligibleObjects(house,reviews={}){
 const result=[];
 for(const object of house.objects??[]){
  const review=reviews[object.id];
  if(review){if(categories.includes(review.category))result.push({...object,category:review.category,boxNormalized:review.boxNormalized,humanVerified:true});continue;}
  // Chimney pilot: only explicit human reviews are training labels.
 }
 return result;
}
export function roofProfile(house,reviews={}){
 const eligible=eligibleObjects(house,reviews);
 return Object.fromEntries(categories.map(category=>{
  const objects=eligible.filter(object=>object.category===category);
  return [category,{status:objects.some(object=>object.humanVerified)?'human-confirmed-image':objects.length?'cross-view-candidate':'unknown',evidence:objects.map(({id,viewId,humanVerified})=>({id,viewId,humanVerified})),currentConditionVerified:false}];
 }));
}
