import {homeInsight,type HomeGeometry,type RoofMaterial} from './home-insights';
import {roofMaterial} from './roof-materials.mjs';
export function geometryRoofMaterials(...geometries:(HomeGeometry|null|undefined)[]){
 const items:Record<string,RoofMaterial>={};
 for(const geometry of geometries)for(const building of geometry?.buildings??[]){const value=building.roofMaterial;
  if(value?.source==='BBR'&&roofMaterial(value.code)?.kind===value.kind)items[building.id]=value;
 }
 return items;
}
export async function loadRoofMaterials(id:string){
 // A separate cache key prevents pre-material geometry responses being reused.
 const geometry=await homeInsight<HomeGeometry>('geometry',{id,surroundings:'1',materials:'1'});
 if(geometry.roofMaterialVersion!==1)throw Error('BBR-tagmaterialer er endnu ikke tilgængelige.');
 return geometryRoofMaterials(geometry);
}
