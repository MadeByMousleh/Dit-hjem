import type {HomeGeometry,XY} from '../services/home-insights';
export type HousePhotoFace={id:string;buildingId:string;label:string;bearing:number;a:XY;b:XY;height:number;length:number};
const directions=['nord','nordøst','øst','sydøst','syd','sydvest','vest','nordvest'];
// Registered exterior rings, not hard-coded four sides: L-shaped houses and
// multiple main-building footprints each get their own real exterior edges.
export function housePhotoFaces(data:HomeGeometry):HousePhotoFace[]{
 const faces:HousePhotoFace[]=[];
 for(const building of data.buildings.filter(b=>b.main)){
  const ring=building.rings[0]?.filter((p,i,r)=>i===0||p[0]!==r[i-1]![0]||p[1]!==r[i-1]![1]).slice()??[];
  if(ring.length>1&&ring[0]![0]===ring.at(-1)![0]&&ring[0]![1]===ring.at(-1)![1])ring.pop();
  if(ring.length<3)continue;
  const signed=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length]!;return sum+a[0]*b[1]-b[0]*a[1];},0);
  if(signed<0)ring.reverse();
  // Collapse redundant collinear survey vertices, keeping real corners.
  let changed=true;
  while(changed&&ring.length>3){changed=false;for(let i=0;i<ring.length;i++){
   const a=ring[(i+ring.length-1)%ring.length]!,p=ring[i]!,b=ring[(i+1)%ring.length]!,ux=p[0]-a[0],uy=p[1]-a[1],vx=b[0]-p[0],vy=b[1]-p[1];
   if(ux*vx+uy*vy>0&&Math.abs(ux*vy-uy*vx)<=0.015*Math.hypot(ux,uy)*Math.hypot(vx,vy)){ring.splice(i,1);changed=true;break;}
  }}
  for(let i=0;i<ring.length;i++){
   const a=ring[i]!,b=ring[(i+1)%ring.length]!,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<0.75)continue;
   const bearing=(Math.atan2(dy,-dx)*180/Math.PI+360)%360;
   const coordinates=[a,b].map(p=>p.map(v=>v.toFixed(2)).join(',')).sort().join('|');let hash=0;for(const c of coordinates)hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
   faces.push({id:`${building.id}-${(hash>>>0).toString(16)}`,buildingId:building.id,label:`Facade ${faces.length+1} · ${directions[Math.round(bearing/45)%8]}`,bearing,a,b,height:building.height,length});
  }
 }
 return faces;
}
