import {lidarModels} from '../generated/lidar-models';
import {lidarParcels} from '../generated/lidar-parcels';
import type {HomeGeometry,XY} from '../services/home-insights';
export type HouseLidarModel={addressId:string;buildingId:string;footprint:XY[][];roof:number[];walls:number[];surfaces:{slope:number;azimuth:number;area:number;maxDeviation:number}[];ground:number;roofPlanes:number;fitRmse:number;validation?:{withheldPoints:number;p95M:number;rmseM:number};crs:string;sourceSha256:string};
export type ParcelTerrain={vertices:number[];indices:number[];fallbackVertices:number[];fallbackIndices:number[];heightRange:[number,number];quality:{vertices:number;triangles:number;maxEdgeM:number;rejectedOutliers:number;supportedAreaM2:number;domainAreaM2:number;holdout:{withheldPoints:number;commonSupportedPoints:number;tin:{rmseM:number};previousGrid:{rmseM:number}}}};
export type ParcelLidarModel={addressId:string;parcelIds:string[];polygons:XY[][][];crs:string;points:number[];pointCount:number;classes:Record<string,number>;terrain?:ParcelTerrain;vegetation?:{vertices:number[];indices:number[];report:{sourceVegetationPoints:number;triangles:number;maxEdgeM:number;alphaRadiusM:number}};ground:{x0:number;y0:number;step:number;width:number;height:number;values:(number|null)[]}};
// A compiled model belongs to this exact building/outline, never another user's address.
export function getHouseLidarModel(geometry:HomeGeometry,building:HomeGeometry['buildings'][number]):HouseLidarModel|null{
 const model=(lidarModels as unknown as Record<string,HouseLidarModel>)[building.id];
 if(!model||model.addressId!==geometry.addressId||model.crs!=='EPSG:7416'||model.footprint.length!==building.rings.length)return null;
 if(model.footprint.some((ring,i)=>ring.length!==building.rings[i]!.length||ring.some((p,j)=>Math.hypot(p[0]-building.rings[i]![j]![0],p[1]-building.rings[i]![j]![1])>0.15)))return null;
 return model;
}
export function getParcelLidarModel(geometry:HomeGeometry):ParcelLidarModel|null{
 const model=(lidarParcels as unknown as Record<string,ParcelLidarModel>)[geometry.addressId];
 if(!model||model.crs!=='EPSG:7416'||JSON.stringify(model.parcelIds)!==JSON.stringify(geometry.parcels.map(p=>p.id)))return null;
 // A changed cadastral boundary requires a fresh crop, not old points from another parcel.
 if(JSON.stringify(model.polygons)!==JSON.stringify(geometry.parcels.flatMap(p=>p.polygons)))return null;
 return model;
}
export function sampleParcelGround(model:ParcelLidarModel,x:number,y:number):number|null{
 const measured=sampleTinGround(model,x,y);if(measured!==null)return measured;
 const g=model.ground,col=Math.round((x-g.x0)/g.step),row=Math.round((y-g.y0)/g.step);
 if(col<0||row<0||col>=g.width||row>=g.height)return null;
 let total=0,weight=0;
 for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
  const c=col+dx,r=row+dy;if(c<0||r<0||c>=g.width||r>=g.height)continue;
  const z=g.values[r*g.width+c];if(z===null||z===undefined)continue;
  const d2=(g.x0+c*g.step-x)**2+(g.y0+r*g.step-y)**2;if(d2>2.25)continue;
  if(d2<0.000001)return z;const w=1/d2;total+=z*w;weight+=w;
 }
 return weight?total/weight:null;
}
const terrainIndices=new WeakMap<ParcelLidarModel,Map<string,number[]>>();
/** Exact barycentric height on a supported TIN triangle, null across gaps. */
export function sampleTinGround(model:ParcelLidarModel,x:number,y:number):number|null{
 const tin=model.terrain;if(!tin)return null;
 let index=terrainIndices.get(model);
 if(!index){index=new Map();for(let i=0;i<tin.indices.length;i+=3){
  const ids=tin.indices.slice(i,i+3),xs=ids.map(id=>tin.vertices[id*3]!),ys=ids.map(id=>tin.vertices[id*3+1]!);
  for(let col=Math.floor(Math.min(...xs));col<=Math.floor(Math.max(...xs));col++)for(let row=Math.floor(Math.min(...ys));row<=Math.floor(Math.max(...ys));row++){const key=`${col},${row}`,values=index.get(key)??[];values.push(i);index.set(key,values);}
 }terrainIndices.set(model,index);}
 for(const i of index.get(`${Math.floor(x)},${Math.floor(y)}`)??[]){
  const a=tin.indices[i]!*3,b=tin.indices[i+1]!*3,c=tin.indices[i+2]!*3,v=tin.vertices;
  const ax=v[a]!-v[c]!,ay=v[a+1]!-v[c+1]!,bx=v[b]!-v[c]!,by=v[b+1]!-v[c+1]!,px=x-v[c]!,py=y-v[c+1]!,d=ax*by-bx*ay;
  if(Math.abs(d)<1e-12)continue;const u=(px*by-bx*py)/d,w=(ax*py-px*ay)/d;
  if(u>=-1e-8&&w>=-1e-8&&u+w<=1+1e-8)return u*v[a+2]!+w*v[b+2]!+(1-u-w)*v[c+2]!;
 }
 return null;
}
