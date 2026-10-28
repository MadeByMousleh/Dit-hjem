export const reviewKey=(houseId,viewId,id)=>`${houseId}:${viewId}:${id}`;
export function scopedReviews(report,reviews,house){
 const result={};
 for(const object of house.objects??[]){
  const key=reviewKey(house.id,object.viewId,object.id);
  const legacy=reviews[object.id];
  const unique=legacy&&report.houses.reduce((n,h)=>n+h.objects.filter(o=>o.id===object.id).length,0)===1;
  const review=reviews[key]??(unique?legacy:null);
  if(review)result[object.id]=review;
 }
 return result;
}
