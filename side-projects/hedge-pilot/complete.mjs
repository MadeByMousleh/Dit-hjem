import {resolvePointSelections} from './point-labels.mjs';
export function completeGarden(points,rows,{houseId,sourceHash,id,at=new Date().toISOString()}){
 const positives=new Set(resolvePointSelections(rows).filter(r=>r.kind==='hedge').flatMap(r=>r.indices));
 const indices=[];for(let i=0;i<points.length;i++)if([3,4,5].includes(points[i][3])&&!positives.has(i))indices.push(i);
 const existing=rows.findIndex(r=>r.origin==='garden-completion'),record={id:existing<0?id:rows[existing].id,houseId,sourceHash,kind:'not_hedge',indices,at,actor:'user',origin:'garden-completion',declaration:'All vegetation points except my saved hedge points are non-hedge'};
 const result=[...rows];if(existing<0)result.push(record);else result[existing]=record;
 return result;
}
