import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
const dir='.tmp/lidar-reference',files=await readdir(`${dir}/output`,{recursive:true}),name=files.find(f=>f.endsWith('.city.jsonl'));
const modelBytes=await readFile(`${dir}/output/${name}`),lines=modelBytes.toString('utf8').trim().split('\n').map(JSON.parse),t=lines[0].transform,triangles=[];
const feature=lines.find(l=>l.type==='CityJSONFeature'),building=Object.values(feature.CityObjects).find(o=>o.type==='Building'),origin=new THREE.Vector3(...t.translate);
for(const object of Object.values(feature.CityObjects))for(const g of object.geometry??[]){if(String(g.lod)!=='2.2'||g.type!=='Solid')continue;const vertices=feature.vertices.map(v=>new THREE.Vector3(...v.map((n,i)=>n*t.scale[i]+t.translate[i])).sub(origin));
 for(const [i,rings]of g.boundaries[0].entries()){if(g.semantics.surfaces[g.semantics.values[0][i]].type!=='RoofSurface')continue;
  const positions=rings.map(r=>r.map(j=>vertices[j])),flat=positions.flat(),project=v=>new THREE.Vector2(v.x,v.y);
  for(const [a,b,c]of THREE.ShapeUtils.triangulateShape(positions[0].map(project),positions.slice(1).map(r=>r.map(project))))triangles.push(new THREE.Triangle(flat[a],flat[b],flat[c]));
 }
}
const cloud=await readFile(`${dir}/output/${files.find(f=>f.endsWith('.las'))}`),offset=cloud.readUInt32LE(96),len=cloud.readUInt16LE(105),format=cloud[104]&63,count=cloud.readUInt32LE(107),scale=[131,139,147].map(p=>cloud.readDoubleLE(p)),translation=[155,163,171].map(p=>cloud.readDoubleLE(p)),classes={},errors=[];
for(let i=0;i<count;i++){const at=offset+i*len,classification=format>=6?cloud[at+16]:cloud[at+15]&31;classes[classification]=(classes[classification]??0)+1;if(classification!==6)continue;
 const point=new THREE.Vector3(...[0,4,8].map((p,j)=>cloud.readInt32LE(at+p)*scale[j]+translation[j])).sub(origin),closest=new THREE.Vector3();let distance=Infinity;for(const tri of triangles)distance=Math.min(distance,tri.closestPointToPoint(point,closest).distanceTo(point));errors.push(distance);
}
errors.sort((a,b)=>a-b);const quantile=q=>errors[Math.min(errors.length-1,Math.floor(q*errors.length))];
const report={model:`${dir}/output/${name}`,modelBytes:modelBytes.length,modelSha256:createHash('sha256').update(modelBytes).digest('hex'),rooferAttributes:building.attributes,pointClasses:classes,roofTriangles:triangles.length,buildingPointFit:{count:errors.length,medianM:quantile(0.5),p95M:quantile(0.95),rmseM:Math.sqrt(errors.reduce((sum,v)=>sum+v*v,0)/errors.length),within20cm:errors.filter(v=>v<=0.2).length/errors.length},notice:'Fit to the same input points, not independent held-out validation. Airborne data does not establish facade/window detail or exact wall/roof-overhang placement.'};
await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
