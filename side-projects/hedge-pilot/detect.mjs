// Conservative candidates along parcel edges; this is not a trained classifier.
export function hedgeCandidates(source){
 const ground=new Map(),vegetation=[];
 for(const p of source.points){if(p[3]===2){const key=`${Math.floor(p[0])},${Math.floor(p[1])}`;const cell=ground.get(key)??[];cell.push(p);ground.set(key,cell);}else if(p[3]>=3&&p[3]<=5)vegetation.push(p);}
 function base(x,y){const near=[];for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const p of ground.get(`${Math.floor(x)+dx},${Math.floor(y)+dy}`)??[]){const d=Math.hypot(x-p[0],y-p[1]);if(d<=2)near.push({p,d});}near.sort((a,b)=>a.d-b.d);const z=near.slice(0,5).map(q=>q.p[2]).sort((a,b)=>a-b);return z.length?z[Math.floor(z.length/2)]:null;}
 const measured=vegetation.flatMap(p=>{const z=base(p[0],p[1]);return z===null?[]:[{x:p[0],y:p[1],z:p[2],base:z,h:p[2]-z}];});
 const candidates=[];
 for(const polygon of source.polygons){const ring=polygon[0];for(let edge=0;edge<ring.length;edge++){
  const a=ring[edge],b=ring[(edge+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<3)continue;
  const ux=(b[0]-a[0])/length,uy=(b[1]-a[1])/length,bins=new Map();
  for(const p of measured){if(p.h<.5||p.h>4)continue;const along=(p.x-a[0])*ux+(p.y-a[1])*uy,offset=(p.x-a[0])*-uy+(p.y-a[1])*ux;if(along<0||along>length||Math.abs(offset)>1.6)continue;const key=Math.floor(along/.5),list=bins.get(key)??[];list.push({...p,along,offset});bins.set(key,list);}
  const occupied=[...bins.keys()].filter(k=>bins.get(k).length>=2).sort((a,b)=>a-b);let run=[];
  function flush(){if(run.length<5){run=[];return;}const first=run[0]*.5,last=Math.min(length,(run.at(-1)+1)*.5),span=last-first;if(span<3||run.length*.5/span<.65){run=[];return;}const pts=run.flatMap(k=>bins.get(k));const q=(values,f)=>{values.sort((a,b)=>a-b);return values[Math.min(values.length-1,Math.floor(values.length*f))];};const offset=q(pts.map(p=>p.offset),.5),height=q(pts.map(p=>p.h),.9),width=Math.max(.3,q(pts.map(p=>p.offset),.9)-q(pts.map(p=>p.offset),.1)),z=q(pts.map(p=>p.base),.5);const start=[a[0]+ux*first-uy*offset,a[1]+uy*first+ux*offset,z],end=[a[0]+ux*last-uy*offset,a[1]+uy*last+ux*offset,z];candidates.push({id:`edge-${candidates.length}`,start,end,length:span,height,width,pointCount:pts.length,coverage:run.length*.5/span,status:'unknown',method:'parcel-edge-vegetation-v1'});run=[];}
  for(const key of occupied){if(run.length&&key-run.at(-1)>2)flush();run.push(key);}flush();
 }}
 return {candidates,vegetationPoints:vegetation.length,groundSupportedPoints:measured.length};
}
