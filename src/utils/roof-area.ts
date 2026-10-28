import type {HomeGeometry,HomeHeights,XY} from '../services/home-insights';
export type RoofEstimate={area:number;method:'lidar'|'height-model';coverage:number;slopeDegrees:number|null};
function inRing(ring:XY[],x:number,y:number){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i]!,b=ring[j]!;if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function footprintArea(rings:XY[][]){return rings.reduce((sum,ring,i)=>{let area=0;for(let j=0;j<ring.length;j++){const a=ring[j]!,b=ring[(j+1)%ring.length]!;area+=a[0]*b[1]-b[0]*a[1];}return sum+(i===0?1:-1)*Math.abs(area)/2;},0);}
/** Interior roof gradients avoid the wall-to-ground jump at the roof edge. */
export function estimateRasterRoof(geometry:HomeGeometry,building:HomeGeometry['buildings'][number],heights:HomeHeights):RoofEstimate|null{
 if(heights.addressId!==geometry.addressId||heights.bbox.some((v,i)=>Math.abs(v-geometry.bbox[i]!)>.1))return null;
 const {width,height,bbox,surface,terrain}=heights,dx=(bbox[2]-bbox[0])/width,dy=(bbox[3]-bbox[1])/height;
 if(dx<=0||dy<=0||dx>1.5||dy>1.5||surface.length!==width*height||terrain.length!==surface.length)return null;
 const inside=(x:number,y:number)=>!!building.rings[0]&&inRing(building.rings[0],x,y)&&!building.rings.slice(1).some(r=>inRing(r,x,y));
 const factors:number[]=[];let eligible=0;
 for(let row=1;row<height-1;row++)for(let col=1;col<width-1;col++){
  const x=bbox[0]+(col+.5)*dx,y=bbox[3]-(row+.5)*dy;
  if(!inside(x,y)||!inside(x-dx,y)||!inside(x+dx,y)||!inside(x,y-dy)||!inside(x,y+dy))continue;eligible++;
  const i=row*width+col,values=[surface[i],surface[i-1],surface[i+1],surface[i-width],surface[i+width],terrain[i]];
  if(values.some(v=>v==null||!Number.isFinite(v)))continue;
  const [z,l,r,t,b,g]=values as number[];if(z!-g!<1||z!-g!>30)continue;
  const gx=(r!-l!)/(2*dx),gy=(b!-t!)/(2*dy),factor=Math.sqrt(1+gx*gx+gy*gy);
  // Unsupported spikes/crowns/chimneys must not inflate the roof estimate.
  if(factor>3||Math.abs(z!-(l!+r!+t!+b!)/4)>.5)continue;
  factors.push(factor);
 }
 if(eligible<20||factors.length/eligible<.7)return null;
 factors.sort((a,b)=>a-b);const kept=factors.slice(0,Math.max(1,Math.ceil(factors.length*.95))),area=footprintArea(building.rings)*kept.reduce((a,b)=>a+b,0)/kept.length;
 const weight=kept.reduce((sum,factor)=>sum+factor,0),slopeDegrees=kept.reduce((sum,factor)=>sum+Math.acos(Math.min(1,1/factor))*180/Math.PI*factor,0)/weight;
 return Number.isFinite(area)&&area>0?{area,method:'height-model',coverage:factors.length/eligible,slopeDegrees}:null;
}
/** Roof coordinates are world XYZ, with Z vertical. Mean pitch is roof-area weighted. */
export function triangleRoofEstimate(vertices:number[]):RoofEstimate|null{
 const area=triangleRoofArea(vertices);if(area===null)return null;
 let weighted=0,weight=0,unsupported=0;
 for(let i=0;i<vertices.length;i+=9){
  const ux=vertices[i+3]!-vertices[i]!,uy=vertices[i+4]!-vertices[i+1]!,uz=vertices[i+5]!-vertices[i+2]!,vx=vertices[i+6]!-vertices[i]!,vy=vertices[i+7]!-vertices[i+1]!,vz=vertices[i+8]!-vertices[i+2]!;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);if(length<1e-8)continue;
  const angle=Math.atan2(Math.hypot(nx,ny),Math.abs(nz))*180/Math.PI;
  if(angle>80){unsupported+=length/2;continue;}weighted+=angle*length/2;weight+=length/2;
 }
 return {area,method:'lidar',coverage:1,slopeDegrees:weight>0&&unsupported/area<.05?weighted/weight:null};
}
export function triangleRoofArea(vertices:number[]){let area=0;if(!vertices.length||vertices.length%9||!vertices.every(Number.isFinite))return null;for(let i=0;i<vertices.length;i+=9){const ux=vertices[i+3]!-vertices[i]!,uy=vertices[i+4]!-vertices[i+1]!,uz=vertices[i+5]!-vertices[i+2]!,vx=vertices[i+6]!-vertices[i]!,vy=vertices[i+7]!-vertices[i+1]!,vz=vertices[i+8]!-vertices[i+2]!;area+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;}return area>0?area:null;}
