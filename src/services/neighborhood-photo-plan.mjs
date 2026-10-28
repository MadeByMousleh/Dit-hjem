// Deterministic bounded windows around actual buildings, not a larger blurry
// image of the whole neighborhood. Coordinates stay EPSG:25832.
export function neighborhoodPhotoPlan(geometry){
 const [left,bottom,right,top]=geometry.bbox;
 if(![left,bottom,right,top].every(Number.isFinite)||right<=left||top<=bottom||right-left>501||top-bottom>501)throw Object.assign(Error('Ugyldigt naboområde.'),{status:400});
 const groups=new Map(),size=70;
 for(const building of geometry.buildings.filter(b=>!b.main&&!b.associated)){
  const points=building.rings?.[0];if(!points?.length)continue;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
  if(x<left||x>right||y<bottom||y>top)continue;
  const id=`${Math.min(7,Math.floor((x-left)/size))}-${Math.min(7,Math.floor((y-bottom)/size))}`;
  const group=groups.get(id)??{id,buildingIds:[]};group.buildingIds.push(building.id);groups.set(id,group);
 }
 return {version:1,bbox:geometry.bbox,tiles:[...groups.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}
