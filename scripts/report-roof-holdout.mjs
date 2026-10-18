import {readFile,readdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
const dir='.tmp/lidar-parcel',held=JSON.parse(await readFile(`${dir}/roof-validation-heldout.json`,'utf8')),files=await readdir(`${dir}/roof-validation-output`),name=files.find(f=>f.endsWith('.city.jsonl'));
if(!name)throw Error('No roof holdout reconstruction');
const lines=(await readFile(`${dir}/roof-validation-output/${name}`,'utf8')).trim().split('\n').map(JSON.parse),transform=lines[0].transform,origin=new THREE.Vector3(...transform.translate),results=[];
for(const feature of lines.filter(l=>l.type==='CityJSONFeature')){
 const vertices=feature.vertices.map(v=>new THREE.Vector3(...v.map((n,i)=>n*transform.scale[i]+transform.translate[i])).sub(origin)),triangles=[];
 const attrs=Object.values(feature.CityObjects).find(o=>o.type==='Building')?.attributes;
 if(!attrs?.rf_success)throw Error(`Holdout reconstruction failed: ${feature.id}`);
 for(const object of Object.values(feature.CityObjects))for(const g of object.geometry??[]){if(String(g.lod)!=='2.2')continue;
  for(const [i,rings]of g.boundaries[0].entries()){
   if(g.semantics.surfaces[g.semantics.values[0][i]].type!=='RoofSurface')continue;
   const positions=rings.map(r=>r.map(j=>vertices[j])),flat=positions.flat(),project=v=>new THREE.Vector2(v.x,v.y);
   for(const [a,b,c]of THREE.ShapeUtils.triangulateShape(positions[0].map(project),positions.slice(1).map(r=>r.map(project))))triangles.push(new THREE.Triangle(flat[a],flat[b],flat[c]));
  }
 }
 if(!triangles.length)throw Error('Missing roof triangles');
 const closest=new THREE.Vector3(),errors=(held.withheld[feature.id]??[]).map(p=>{const v=new THREE.Vector3(...p).sub(origin);return Math.min(...triangles.map(t=>t.closestPointToPoint(v,closest).distanceTo(v)));}).sort((a,b)=>a-b);
 if(!errors.length)throw Error('No withheld building points');
 results.push({buildingId:feature.id,withheldPoints:errors.length,roofPlanes:attrs.rf_roof_planes,medianM:errors[Math.floor(errors.length*.5)],p95M:errors[Math.floor(errors.length*.95)],rmseM:Math.sqrt(errors.reduce((sum,v)=>sum+v*v,0)/errors.length),within20cm:errors.filter(v=>v<=.2).length/errors.length});
}
const report={split:held.split,results,notice:'Separate test models reconstructed without withheld class-6 spatial blocks. Distances include building returns such as wall/edge points, not independently labelled roof-only truth. Internal same-survey validation, not certified roof accuracy. Full-data models in the app remain unchanged.'};
await writeFile(`${dir}/roof-holdout-quality.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
