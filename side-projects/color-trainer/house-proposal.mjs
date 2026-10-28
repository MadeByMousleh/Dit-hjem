import {createHash} from 'node:crypto';
import jpeg from 'jpeg-js';
import {photoKey} from './sampling.mjs';
import {polygonMask} from './polygon.mjs';

export const HOUSE_PROPOSAL_METHOD='registered-main-outline-v1';
const uuid=seed=>{const h=createHash('sha256').update(seed).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const area=ring=>Math.abs(ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1];},0))/2;
export function projectPhotoPoint(photo,point){
  const c=photo.camera,d=point.map((v,i)=>v-c.center[i]),r=c.rotation;
  const v=[0,1,2].map(i=>r[i*3]*d[0]+r[i*3+1]*d[1]+r[i*3+2]*d[2]);
  if(!v.every(Number.isFinite)||v[2]>=-1)return null;
  return [(c.principal[0]-c.focal[0]*v[0]/v[2]-c.crop[0])/(c.crop[2]-c.crop[0]),(c.principal[1]+c.focal[1]*v[1]/v[2]-c.crop[1])/(c.crop[3]-c.crop[1])];
}
function hull(points){
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}out.pop();return out;};
  return [...half(sorted),...half(sorted.slice().reverse())];
}
function clip(points){
  let result=points;
  for(const [axis,bound,sign] of [[0,0,1],[0,1,-1],[1,0,1],[1,1,-1]]){
    const out=[],inside=p=>(p[axis]-bound)*sign>=0;
    for(let i=0;i<result.length;i++){
      const a=result[i],b=result[(i+1)%result.length],ai=inside(a),bi=inside(b);
      if(ai)out.push(a);
      if(ai!==bi){const t=(bound-a[axis])/(b[axis]-a[axis]);const p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];p[axis]=bound;out.push(p);}
    }
    result=out;
  }
  const clean=result.map(p=>p.map(v=>Math.max(0,Math.min(1,v)))).filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-8);
  if(clean.length>1&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-8)clean.pop();
  return clean;
}

export function houseProposal(task){
  const geometry=task.config.geometry,heights=task.config.heights,photos=task.config.photos.photos;
  const main=geometry.buildings.filter(b=>b.main&&b.rings?.[0]?.length>=3).sort((a,b)=>area(b.rings[0])-area(a.rings[0])||a.id.localeCompare(b.id));
  const signature=createHash('sha256').update(JSON.stringify({method:HOUSE_PROPOSAL_METHOD,geometry,heights,photos:photos.map(p=>({key:photoKey(p),camera:p.camera,image:p.image}))})).digest('hex');
  const result={version:1,method:HOUSE_PROPOSAL_METHOD,signature,objects:[],regions:[],completePhotos:[],sources:[],warnings:['Forslaget bygger på registreret hovedbygning og kamerageometri. Det kan indeholde tilbygninger eller carport; det fastslår ikke husets historiske, oprindelige form.'],selectedBuildingId:main[0]?.id??null};
  if(!main.length){result.warnings.push('Ingen hovedbygning fundet. Tegn hovedhuset manuelt.');return result;}
  if(main.length>1)result.warnings.push('Flere hovedbygninger er registreret. Den største er valgt som første forslag; kontrollér husets identitet.');
  const building=main[0],objectId=uuid(task.id+':main-proposal:'+building.id),ring=building.rings[0];
  if(building.rings.length>1){result.warnings.push('Bygningen har gårdrum/huller. Tegn den manuelt, så de ikke bliver medtaget.');return result;}
  const ground=(x,y)=>{
    if(!heights)return 0;
    const col=Math.max(0,Math.min(heights.width-1,Math.floor((x-heights.bbox[0])/(heights.bbox[2]-heights.bbox[0])*heights.width))),row=Math.max(0,Math.min(heights.height-1,Math.floor((heights.bbox[3]-y)/(heights.bbox[3]-heights.bbox[1])*heights.height)));
    return heights.terrain[row*heights.width+col]??heights.terrain.find(Number.isFinite)??0;
  };
  for(const photo of photos){
    const image=jpeg.decode(Buffer.from(photo.image.split(',')[1],'base64'),{maxMemoryUsageInMB:48,maxResolutionInMP:2});
    const roof=ring.map(([x,y])=>projectPhotoPoint(photo,[x,y,ground(x,y)+(building.height??3)]));
    const base=ring.map(([x,y])=>projectPhotoPoint(photo,[x,y,ground(x,y)]));
    if(roof.some(p=>!p)||base.some(p=>!p)){result.warnings.push(`${photo.direction}: usikker projektion; intet automatisk omrids.`);continue;}
    const points=clip(photo.direction==='nadir'?roof:hull([...roof,...base]));
    try{if(points.length>64||polygonMask(points,image.width,image.height).indices.length<9)throw Error();}
    catch{result.warnings.push(`${photo.direction}: omridset er ikke sikkert nok til et forslag.`);continue;}
    result.regions.push({id:uuid(task.id+':'+photoKey(photo)),objectId,photoKey:photoKey(photo),points});
    result.sources.push({photoKey:photoKey(photo),width:image.width,height:image.height,direction:photo.direction,outlineMethod:photo.direction==='nadir'?'projected-roof-ring':'approximate-building-silhouette'});
  }
  if(result.regions.length)result.objects.push({id:objectId,category:'main-house',includeInModel:true});
  return result;
}

export async function partsStatus(store,readParts){
  const history=[];
  for(const name of await store.tasks()){
    const task=await store.read(name),parts=await readParts(store,task.id);
    history.push({id:task.id,text:task.address.text,status:parts.status,revision:parts.revision,regions:parts.regions.length});
  }
  return {reviewed:history.filter(t=>t.status==='reviewed').length,drafts:history.filter(t=>t.status==='draft'&&t.revision>0).length,pending:history.filter(t=>t.revision===0).length,skipped:history.filter(t=>t.status==='skipped').length,history};
}
export function nextPartsId(history,after){
  const start=history.findIndex(t=>t.id===after);
  for(let step=1;step<=history.length;step++){const item=history[(start+step+history.length)%history.length];if(item.id!==after&&!['reviewed','skipped'].includes(item.status))return item.id;}
  return null;
}
