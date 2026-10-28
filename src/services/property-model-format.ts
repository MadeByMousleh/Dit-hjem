import {gzipSync,gunzipSync,strToU8,strFromU8} from 'fflate';
import type {HomeEnvironment,HomeGeometry,HomeHeights,HomePhotoColors,RoofMaterial} from './home-insights';
import type {FacadeModel} from './house-facade';
import type {SceneEdits} from '../utils/scene-opening-edits';

export type PreparedGeometry={attributes:Record<string,{size:number;values:number[]}>;index:number[]|null;normalDerived?:boolean};
export type PreparedBuilding={geometry:PreparedGeometry;roofBuildingId?:string;brickwork?:boolean;color:string;surface?:{id:string;kind:'roof'|'walls';neutral:string;associated:boolean};neighbour?:boolean;wide?:boolean};
export type PreparedScene={roofMaterials?:Record<string,RoofMaterial>;origin:number;floor:PreparedGeometry;environment?:PreparedGeometry;terrain?:{geometry:PreparedGeometry;contours:PreparedGeometry};buildings:PreparedBuilding[];weatherCeiling:number[];colors:HomePhotoColors;automatic:FacadeModel[];neighborColorCoverage?:{version:1;totalTiles:number;completedTiles:number;failedTiles:number}};
export type PropertyModel={version:1;addressId:string;createdAt:number;geometry:HomeGeometry;heights:HomeHeights|null;environment:HomeEnvironment|null;texture:string|null;scene:PreparedScene;sceneEdits:SceneEdits;facades:FacadeModel[]};
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=3){const a=bytes[i]!,b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b??0)<<8)|(c??0);out+=alphabet[n>>>18]!+alphabet[(n>>>12)&63]!+(b===undefined?'=':alphabet[(n>>>6)&63]!)+(c===undefined?'=':alphabet[n&63]!);}return out;}
export function unbase64(text:string){if(text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Invalid model encoding');const out=new Uint8Array(text.length/4*3-(text.endsWith('==')?2:text.endsWith('=')?1:0));let at=0;for(let i=0;i<text.length;i+=4){const n=(alphabet.indexOf(text[i]!)<<18)|(alphabet.indexOf(text[i+1]!)<<12)|((alphabet.indexOf(text[i+2]!)&63)<<6)|(alphabet.indexOf(text[i+3]!)&63);for(const shift of [16,8,0])if(at<out.length)out[at++]=(n>>>shift)&255;}return out;}
export const MAX_MODEL_RAW=32*1024*1024,MAX_MODEL_ENCODED=3900000;
export function geometryNormals(geometry:PreparedGeometry){
 const p=new Float32Array(geometry.attributes.position!.values),n=new Float32Array(p.length),indices=geometry.index,count=indices?.length??p.length/3;
 for(let i=0;i<count;i+=3){const a=(indices?.[i]??i)*3,b=(indices?.[i+1]??i+1)*3,c=(indices?.[i+2]??i+2)*3;
  const x=p[c]!-p[b]!,y=p[c+1]!-p[b+1]!,z=p[c+2]!-p[b+2]!,u=p[a]!-p[b]!,v=p[a+1]!-p[b+1]!,w=p[a+2]!-p[b+2]!,nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u;
  const old=[a,b,c].map(j=>[n[j]!,n[j+1]!,n[j+2]!]);for(const [k,j]of [a,b,c].entries()){n[j]=(indices?old[k]![0]!:0)+nx;n[j+1]=(indices?old[k]![1]!:0)+ny;n[j+2]=(indices?old[k]![2]!:0)+nz;}
 }
 for(let i=0;i<n.length;i+=3){const x=n[i]!,y=n[i+1]!,z=n[i+2]!,scale=1/(Math.sqrt(x*x+y*y+z*z)||1);n[i]=x*scale;n[i+1]=y*scale;n[i+2]=z*scale;}
 return n;
}
// BufferGeometry attributes are Float32. JSON's default 17-digit spelling is
// needlessly large (e.g. 0.07500000298023224). Use the shortest decimal that
// restores EXACTLY the same Float32 bits, not a fixed lossy rounding precision.
export function compactGeometry(geometry:PreparedGeometry):PreparedGeometry{
 const attributes:PreparedGeometry['attributes']={};
 for(const [name,attribute]of Object.entries(geometry.attributes))attributes[name]={...attribute,values:attribute.values.map(value=>{
  if(!Number.isFinite(value)||Math.fround(value)!==value)return value;
  for(let digits=1;digits<=9;digits++){const candidate=Number(value.toPrecision(digits));if(Math.fround(candidate)===value)return candidate;}
  return value;
 })};
 const normal=geometry.attributes.normal;
 // Omit only normals that can be reconstructed bit-for-bit. Artist-supplied
 // or previously smoothed normals remain stored, preserving their shading.
 if(normal){const derived=geometryNormals(geometry);if(derived.length===normal.values.length&&derived.every((value,i)=>value===normal.values[i])){delete attributes.normal;return {...geometry,attributes,normalDerived:true};}}
 return {...geometry,attributes};
}
export function compactPropertyModel(model:PropertyModel):PropertyModel{
 const scene=model.scene;
 return {...model,scene:{...scene,floor:compactGeometry(scene.floor),environment:scene.environment?compactGeometry(scene.environment):undefined,terrain:scene.terrain?{geometry:compactGeometry(scene.terrain.geometry),contours:compactGeometry(scene.terrain.contours)}:undefined,buildings:scene.buildings.map(building=>({...building,geometry:compactGeometry(building.geometry)}))}};
}
export function encodePropertyModel(model:PropertyModel){const raw=strToU8(JSON.stringify(compactPropertyModel(model)));if(raw.length>MAX_MODEL_RAW)throw Error('Husmodellen er for stor.');const encoded=base64(gzipSync(raw,{level:9}));if(encoded.length>MAX_MODEL_ENCODED)throw Error(`Husmodellen er for stor til at gemme (${Math.ceil(encoded.length/1024)} KB).`);return encoded;}
export function decodePropertyModel(payload:string,addressId:string):PropertyModel{
 if(payload.length>MAX_MODEL_ENCODED)throw Error('Invalid model size');const bytes=unbase64(payload);
 // Reject oversized gzip ISIZE before allocating the decoded client buffer.
 if(bytes.length<18)throw Error('Invalid model');const size=new DataView(bytes.buffer,bytes.byteOffset+bytes.length-4,4).getUint32(0,true);if(size>MAX_MODEL_RAW)throw Error('Invalid model size');
 const raw=gunzipSync(bytes);if(raw.length>MAX_MODEL_RAW)throw Error('Invalid model size');const model=JSON.parse(strFromU8(raw));
 if(model.version!==1||model.addressId!==addressId||model.geometry?.addressId!==addressId||!model.scene?.floor||!Array.isArray(model.scene.buildings))throw Error('Ugyldig gemt husmodel.');
 const restore=(geometry:PreparedGeometry)=>{if(geometry.normalDerived){geometry.attributes.normal={size:3,values:Array.from(geometryNormals(geometry))};delete geometry.normalDerived;}};
 restore(model.scene.floor);if(model.scene.environment)restore(model.scene.environment);if(model.scene.terrain){restore(model.scene.terrain.geometry);restore(model.scene.terrain.contours);}for(const building of model.scene.buildings)restore(building.geometry);
 return model;
}
