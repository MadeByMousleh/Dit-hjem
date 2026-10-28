import type {HomeGeometry} from './home-insights';
export type VegetationKind='tree'|'shrub'|'hedge'|'unknown';
export type VegetationCandidate={id:string;center:[number,number];base:number;height:number;width:number;depth:number;pointCount:number;bounds:[number,number,number,number,number,number];samples:[number,number,number][]};
export type VegetationObject=VegetationCandidate&{kind:VegetationKind;form:'broadleaf'|'conifer'|'unknown';confidence:number;viewIds:string[]};
export type HomeVegetation={version:1;addressId:string;sourceHash:string;method:'lidar-photo-fusion-v1';analyzedAt:number;objects:VegetationObject[];unknownCount:number;appearance:'representative';notice:string};
/** Connected measured returns are candidates, NEVER tree/shrub predictions. */
export function vegetationCandidates(points:number[],ground:(x:number,y:number)=>number|null):VegetationCandidate[]{
 if(points.length%4||points.length>2000000)throw Error('Invalid point cloud');
 const cell=1,bins=new Map<string,number[]>(),rows:{x:number;y:number;z:number;base:number}[]=[];
 for(let i=0;i<points.length;i+=4){const [x,y,z,classification]=points.slice(i,i+4) as [number,number,number,number];if(![x,y,z,classification].every(Number.isFinite))throw Error('Invalid point');if(classification<3||classification>5)continue;const base=ground(x,y);if(base===null||z-base<.25||z-base>60)continue;const row=rows.push({x,y,z,base})-1,key=`${Math.floor(x/cell)},${Math.floor(y/cell)}`;const indices=bins.get(key)??[];indices.push(row);bins.set(key,indices);}
 const seen=new Set<number>(),result:VegetationCandidate[]=[];
 for(let seed=0;seed<rows.length;seed++){if(seen.has(seed))continue;const queue=[seed],group:number[]=[];seen.add(seed);
  for(let next=0;next<queue.length;next++){const index=queue[next]!,p=rows[index]!;group.push(index);const bx=Math.floor(p.x/cell),by=Math.floor(p.y/cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of bins.get(`${bx+dx},${by+dy}`)??[]){if(seen.has(other))continue;const q=rows[other]!;if(Math.hypot(q.x-p.x,q.y-p.y)<=.85&&Math.abs(q.z-p.z)<=2){seen.add(other);queue.push(other);}}}
  if(group.length<18)continue;
  let left=Infinity,bottom=Infinity,right=-Infinity,top=-Infinity,low=Infinity,high=-Infinity;const bases:number[]=[];
  for(const index of group){const p=rows[index]!;left=Math.min(left,p.x);bottom=Math.min(bottom,p.y);right=Math.max(right,p.x);top=Math.max(top,p.y);low=Math.min(low,p.z);high=Math.max(high,p.z);bases.push(p.base);}
  bases.sort((a,b)=>a-b);const base=bases[Math.floor(bases.length/2)]!;if(high-base<.5||right-left<.2||top-bottom<.2)continue;
  const samples:[number,number,number][]=[];for(let i=0;i<Math.min(48,group.length);i++){const p=rows[group[Math.floor(i*group.length/Math.min(48,group.length))]!]!;samples.push([p.x,p.y,p.z]);}
  result.push({id:`v-${result.length}`,center:[(left+right)/2,(bottom+top)/2],base,height:high-base,width:right-left,depth:top-bottom,pointCount:group.length,bounds:[left,bottom,low,right,top,high],samples});
  if(result.length>=64)break;
 }
 return result;
}
export function vegetationFitsGeometry(analysis:HomeVegetation,g:HomeGeometry){return analysis.addressId===g.addressId&&analysis.objects.every(o=>o.bounds[0]>=g.bbox[0]&&o.bounds[1]>=g.bbox[1]&&o.bounds[3]<=g.bbox[2]&&o.bounds[4]<=g.bbox[3]);}
