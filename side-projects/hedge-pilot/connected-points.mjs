import {pointScore,similarity} from './point-model.mjs';

// Suggestion-only region growth. Manual labels are never created here.
export function connectedSuggestions(points,features,model,excluded=new Set()){
 const config=model.connectedSuggestions;
 const threshold=config?.seedThreshold??model.threshold;
 const scores=new Map([...features].map(([i,x])=>[i,model.method==='brush-point-logistic-v1'?pointScore(model,x):similarity(model.prototypes,x)]));
 const seeds=[...scores].filter(([i,s])=>!excluded.has(i)&&s>=threshold).sort((a,b)=>b[1]-a[1]).map(([i])=>i);
 if(!config)return seeds;
 const radius=config.radius,grid=new Map(),selected=new Set(seeds),queue=seeds.map(i=>[i,points[i][2]]);
 for(let i=0;i<points.length;i++){
  const p=points[i];if(![3,4,5].includes(p[3])||excluded.has(i))continue;
  const key=`${Math.floor(p[0]/radius)},${Math.floor(p[1]/radius)}`;
  const cell=grid.get(key)??[];cell.push(i);grid.set(key,cell);
 }
 for(let head=0;head<queue.length;head++){
  const [index,seedZ]=queue[head],p=points[index],gx=Math.floor(p[0]/radius),gy=Math.floor(p[1]/radius);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const i of grid.get(`${gx+dx},${gy+dy}`)??[]){
   if(selected.has(i))continue;const q=points[i];
   if((p[0]-q[0])**2+(p[1]-q[1])**2>radius**2||Math.abs(p[2]-q[2])>config.verticalStep||Math.abs(q[2]-seedZ)>config.verticalSpan)continue;
   if(scores.has(i)&&scores.get(i)<config.supportThreshold)continue;
   selected.add(i);queue.push([i,seedZ]);
  }
 }
 return [...selected];
}
