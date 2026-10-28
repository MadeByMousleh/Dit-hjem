export const pointFeatureNames=['heightAboveGround','localHeightSpan','horizontalLinearity','logLocalDensity','mediumVegetationFraction'];
const q=(a,f)=>{const b=[...a].sort((a,b)=>a-b);return b[Math.min(b.length-1,Math.floor(f*b.length))];};
export function pointFeatures(points){
 const ground=new Map(),vegetation=new Map(),rows=[];
 for(const [index,p]of points.entries()){const key=`${Math.floor(p[0])},${Math.floor(p[1])}`;if(p[3]===2){const cell=ground.get(key)??[];cell.push(p);ground.set(key,cell);}if([3,4,5].includes(p[3])){const cell=vegetation.get(key)??[];cell.push(p);vegetation.set(key,cell);rows.push({index,p});}}
 const result=new Map();
 for(const {index,p}of rows){let base=null,distance=4;const near=[];for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const key=`${Math.floor(p[0])+dx},${Math.floor(p[1])+dy}`;for(const g of ground.get(key)??[]){const d=(p[0]-g[0])**2+(p[1]-g[1])**2;if(d<distance){distance=d;base=g[2];}}for(const v of vegetation.get(key)??[])if((p[0]-v[0])**2+(p[1]-v[1])**2<=1.44)near.push(v);}
  if(base===null||near.length<5)continue;
  const mx=near.reduce((s,v)=>s+v[0],0)/near.length,my=near.reduce((s,v)=>s+v[1],0)/near.length;let xx=0,yy=0,xy=0;for(const v of near){xx+=(v[0]-mx)**2;yy+=(v[1]-my)**2;xy+=(v[0]-mx)*(v[1]-my);}const trace=xx+yy,delta=Math.sqrt((xx-yy)**2+4*xy*xy);
  result.set(index,[p[2]-base,q(near.map(v=>v[2]),.9)-q(near.map(v=>v[2]),.1),trace?delta/trace:0,Math.log1p(near.length),near.filter(v=>v[3]===4).length/near.length]);
 }
 return result;
}
export function fitSimilarity(samples){
 const byHouse=new Map();for(const sample of samples){const rows=byHouse.get(sample.house)??[];rows.push(sample.x);byHouse.set(sample.house,rows);}
 const floor=[.3,.3,.1,.3,.15];
 return [...byHouse].map(([house,rows])=>({house,center:rows[0].map((_,j)=>q(rows.map(r=>r[j]),.5)),scale:rows[0].map((_,j)=>Math.max(floor[j]??.1,(q(rows.map(r=>r[j]),.9)-q(rows.map(r=>r[j]),.1))/2.56))}));
}
export function similarity(prototypes,x){return Math.max(...prototypes.map(p=>Math.exp(-x.reduce((s,v,j)=>s+((v-p.center[j])/p.scale[j])**2,0)/x.length/2)));}
export function fitPointClassifier(samples){
 const size=samples[0].x.length,mean=Array.from({length:size},(_,j)=>samples.reduce((s,r)=>s+r.x[j],0)/samples.length),scale=mean.map((m,j)=>Math.max(.05,Math.sqrt(samples.reduce((s,r)=>s+(r.x[j]-m)**2,0)/samples.length)));
 const groups=new Map();for(const r of samples){const key=r.house+':'+r.y;groups.set(key,(groups.get(key)??0)+1);}const housesByClass=[0,1].map(y=>new Set(samples.filter(r=>r.y===y).map(r=>r.house)).size);
 const rows=samples.map(r=>({x:r.x.map((v,j)=>(v-mean[j])/scale[j]),y:r.y,weight:.5/(housesByClass[r.y]*groups.get(r.house+':'+r.y))})),weights=Array(size).fill(0);let bias=0;
 for(let step=0;step<350;step++){
  const gradient=Array(size).fill(0);let gb=0;
  for(const r of rows){const z=bias+r.x.reduce((s,v,j)=>s+v*weights[j],0),error=(1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))-r.y)*r.weight;gb+=error;for(let j=0;j<size;j++)gradient[j]+=error*r.x[j];}
  bias-=.15*gb;for(let j=0;j<size;j++)weights[j]-=.15*(gradient[j]+.03*weights[j]);
 }
 return {mean,scale,weights,bias};
}
export function pointScore(model,x){const z=model.bias+x.reduce((s,v,j)=>s+(v-model.mean[j])/model.scale[j]*model.weights[j],0);return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));}
