import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/utils/homeLidarModel.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {getHouseLidarModel,getParcelLidarModel,sampleParcelGround,sampleTinGround}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const geometry=JSON.parse(await readFile('.tmp/lidar-parcel/geometry.json','utf8')),raw=JSON.parse(await readFile('.tmp/lidar-parcel/parcel-points.json','utf8')),parcel=getParcelLidarModel(geometry);
assert.ok(parcel);assert.equal(parcel.pointCount,raw.points.length);assert.deepEqual(parcel.points,raw.points.flat());
assert.equal(Object.values(parcel.classes).reduce((a,b)=>a+b,0),parcel.pointCount);
const insideRing=(x,y,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const inside=(x,y)=>parcel.polygons.some(p=>insideRing(x,y,p[0])&&!p.slice(1).some(r=>insideRing(x,y,r)));
for(const [x,y,z]of raw.points){assert.ok(Number.isFinite(z));assert.ok(inside(x,y),'Point outside registered parcel');}
const buildings=geometry.buildings.filter(b=>b.main||b.associated);
for(const b of buildings){const model=getHouseLidarModel(geometry,b);assert.ok(model);assert.ok(model.surfaces.length>0);assert.ok(model.surfaces.every(s=>s.area>0&&s.slope>=0&&s.slope<=90&&s.maxDeviation<0.15));}
assert.equal(getParcelLidarModel({...geometry,addressId:'unrelated'}),null);
const changed=structuredClone(geometry);changed.parcels[0].polygons[0][0][0][0]+=1;assert.equal(getParcelLidarModel(changed),null);
assert.equal(sampleParcelGround(parcel,0,0),null);assert.ok(Number.isFinite(sampleParcelGround(parcel,552856,6086860)));
assert.ok(parcel.terrain.indices.length/3>20000);
assert.equal(sampleTinGround(parcel,0,0),null);
assert.equal(sampleTinGround(parcel,552870,6086863),null,'No invented TIN under main building');
const tin=parcel.terrain;
for(let i=0;i<tin.indices.length;i+=3){const ids=tin.indices.slice(i,i+3),p=ids.map(id=>tin.vertices.slice(id*3,id*3+3));for(let j=0;j<3;j++)assert.ok(Math.hypot(p[j][0]-p[(j+1)%3][0],p[j][1]-p[(j+1)%3][1])<=1.500001);if(i%30===0){const x=p.reduce((s,v)=>s+v[0],0)/3,y=p.reduce((s,v)=>s+v[1],0)/3,z=p.reduce((s,v)=>s+v[2],0)/3;assert.ok(Math.abs(sampleTinGround(parcel,x,y)-z)<1e-6);}}
assert.ok(tin.quality.holdout.tin.rmseM<tin.quality.holdout.previousGrid.rmseM);
const veg=parcel.vegetation;assert.ok(veg.indices.length>0);
const vegetationReturns=new Set(raw.points.filter(p=>p[3]>=3&&p[3]<=5).map(p=>p.slice(0,3).join(',')));
for(let i=0;i<veg.vertices.length;i+=3)assert.ok(vegetationReturns.has(veg.vertices.slice(i,i+3).join(',')),'Vegetation vertex must be a measured source return');
for(let i=0;i<veg.indices.length;i+=3){const p=veg.indices.slice(i,i+3).map(id=>veg.vertices.slice(id*3,id*3+3));for(let j=0;j<3;j++)assert.ok(Math.hypot(...p[j].map((v,k)=>v-p[(j+1)%3][k]))<=1.500001,'No large-gap canopy bridge');}
console.log(JSON.stringify({rawPoints:parcel.pointCount,allPointsInsideParcel:true,groundOnlyTerrain:true,buildings:buildings.map(b=>b.id),unrelatedAddressRejected:true,changedBoundaryRejected:true}));
