import * as THREE from 'three';
import type {HomeModelPhotos,ModelPhoto} from '../services/home-insights';

export function calibratedPhotoCamera(photo:ModelPhoto,cx:number,cy:number,origin:number){
  const c=photo.camera,r=c.rotation,[l,t,right,bottom]=c.crop,w=right-l,h=bottom-t;
  const position=new THREE.Vector3(c.center[0]-cx,c.center[2]-origin,cy-c.center[1]);
  const view=new THREE.Matrix4().set(r[0]!,r[2]!,-r[1]!,0,r[3]!,r[5]!,-r[4]!,0,r[6]!,r[8]!,-r[7]!,0,0,0,0,1);
  const translation=position.clone().applyMatrix4(view);view.elements[12]=-translation.x;view.elements[13]=-translation.y;view.elements[14]=-translation.z;
  const camera=new THREE.PerspectiveCamera();camera.matrixAutoUpdate=false;camera.matrix.copy(view.clone().invert());camera.matrixWorld.copy(camera.matrix);camera.matrixWorldInverse.copy(view);camera.position.copy(position);
  const near=50,far=5000,px=c.principal[0]-l,py=c.principal[1]-t;
  camera.projectionMatrix.set(2*c.focal[0]/w,0,1-2*px/w,0,0,2*c.focal[1]/h,2*py/h-1,0,0,0,-(far+near)/(far-near),-2*far*near/(far-near),0,0,-1,0);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();return camera;
}
export function projectedPhotos(renderer:THREE.WebGLRenderer,occluders:THREE.Mesh[],targets:THREE.Mesh[],cx:number,cy:number,origin:number,changed:()=>void,report:(count:number)=>void,analyze?:(items:{photo:ModelPhoto;image:THREE.Texture}[],alive:()=>boolean)=>Promise<void>,projection=true){
 let signature='',generation=0,disposed=false;
 const enabled={value:1},groundEnabled={value:0},resources:{image:THREE.Texture;target:THREE.WebGLRenderTarget;matrix:THREE.Matrix4;camera:THREE.Vector3;nadir:boolean}[]=[];
 const resetMaterials=()=>{for(const target of targets){const material=target.material as THREE.MeshStandardMaterial;material.onBeforeCompile=material.userData.baseOnBeforeCompile??(()=>{});material.customProgramCacheKey=material.userData.baseProgramCacheKey??(()=>'');material.needsUpdate=true;}};
 async function setPhotos(data:HomeModelPhotos|null){
  const key=data?.photos.map(p=>`${p.direction}:${p.capturedAt}:${p.camera.crop}`).join('|')??'';if(key===signature||disposed)return;signature=key;const version=++generation;
  resetMaterials();for(const resource of resources){resource.image.dispose();resource.target.dispose();}resources.length=0;
  const photos=data?.photos??[];if(!photos.length){report(0);changed();return;}
  const loaded=await Promise.all(photos.map(async photo=>{try{return {photo,image:await new THREE.TextureLoader().loadAsync(photo.image)};}catch{return null;}}));
  if(disposed||version!==generation){for(const item of loaded)item?.image.dispose();return;}
  if(!projection){const usable=loaded.filter((item):item is NonNullable<typeof item>=>!!item);try{await analyze?.(usable,()=>!disposed&&version===generation);}finally{for(const item of usable)item.image.dispose();}report(usable.length);changed();return;}
  const depthScene=new THREE.Scene(),depthMaterial=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});
  for(const mesh of occluders){const copy=new THREE.Mesh(mesh.geometry,depthMaterial);copy.matrixAutoUpdate=false;copy.matrix.copy(mesh.matrixWorld);depthScene.add(copy);}
  const previous=renderer.getRenderTarget(),shadowAuto=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
  try{
   const renderedDirections=new Set<string>();
   for(const item of loaded){if(!item||renderedDirections.has(item.photo.direction))continue;renderedDirections.add(item.photo.direction);const camera=calibratedPhotoCamera(item.photo,cx,cy,origin),target=new THREE.WebGLRenderTarget(768,768,{depthBuffer:true,stencilBuffer:false});target.depthTexture=new THREE.DepthTexture(768,768,THREE.UnsignedIntType);target.depthTexture.format=THREE.DepthFormat;
    renderer.setRenderTarget(target);renderer.clear();renderer.render(depthScene,camera);item.image.colorSpace=THREE.SRGBColorSpace;item.image.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    resources.push({image:item.image,target,matrix:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera:camera.position.clone(),nadir:item.photo.direction==='nadir'});
   }
  }finally{renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadowAuto;depthMaterial.dispose();}
  if(!resources.length){report(0);return;}
  if(analyze){const usable=loaded.filter((item):item is NonNullable<typeof item>=>item!==null);void analyze(usable,()=>!disposed&&version===generation).catch(()=>{/* Analysis is optional; projection and neutral materials remain usable. */}).finally(()=>{for(const item of usable)if(!resources.some(r=>r.image===item.image))item.image.dispose();});}
  const declarations=resources.map((_,i)=>`uniform sampler2D photoImage${i};uniform sampler2D photoDepth${i};uniform mat4 photoMatrix${i};uniform vec3 photoCamera${i};`).join('\n');
  // Only front-facing, in-frame and model-visible source pixels are eligible.
  // Calibrated projective UVs are evaluated per fragment, not stretched UVs.
  const samples=(ground:boolean)=>resources.map((resource,i)=>ground&&!resource.nadir?'':`{
   vec4 clip=photoMatrix${i}*vec4(vPhotoWorld,1.0);
   if(clip.w>1.0){vec3 projected=clip.xyz/clip.w*0.5+0.5;
    float facing=dot(normalize(vPhotoNormal),normalize(photoCamera${i}-vPhotoWorld));
    if(facing>0.12&&projected.x>0.005&&projected.x<0.995&&projected.y>0.005&&projected.y<0.995&&projected.z>0.0&&projected.z<1.0){
     float depth=texture2D(photoDepth${i},projected.xy).r;
     float tolerance=0.6*50.505/(clip.w*clip.w);
     float edge=min(min(projected.x,1.0-projected.x),min(projected.y,1.0-projected.y));
     float score=facing*facing*smoothstep(0.0,0.05,edge);
     if(projected.z<=depth+tolerance&&score>bestScore){bestScore=score;bestPhoto=texture2D(photoImage${i},projected.xy).rgb;}
    }
   }
  }`).join('\n');
  for(const target of targets){const material=target.material as THREE.MeshStandardMaterial;
   material.onBeforeCompile=(shader,renderer)=>{
    material.userData.baseOnBeforeCompile?.(shader,renderer);
    shader.uniforms.photoEnabled=target.userData.photoGround?groundEnabled:enabled;
    resources.forEach((resource,i)=>{shader.uniforms[`photoImage${i}`]={value:resource.image};shader.uniforms[`photoDepth${i}`]={value:resource.target.depthTexture};shader.uniforms[`photoMatrix${i}`]={value:resource.matrix};shader.uniforms[`photoCamera${i}`]={value:resource.camera};});
    shader.vertexShader='varying vec3 vPhotoWorld;varying vec3 vPhotoNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvPhotoWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vPhotoNormal=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader=`varying vec3 vPhotoWorld;varying vec3 vPhotoNormal;uniform float photoEnabled;${declarations}\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nif(photoEnabled>0.5){float bestScore=0.0;vec3 bestPhoto=diffuseColor.rgb;${samples(!!target.userData.photoGround)}\nif(bestScore>0.0)diffuseColor.rgb=bestPhoto;}`);
   };
   material.customProgramCacheKey=()=>`calibrated-photos-v2-${resources.length}-${version}-${!!target.userData.photoGround}-${material.userData.baseProgramCacheKey?.()??''}`;material.needsUpdate=true;
  }
  report(resources.length);changed();
 }
 return {setPhotos:(data:HomeModelPhotos|null)=>{void setPhotos(data).catch(()=>{resetMaterials();report(0);changed();});},setEnabled:(value:boolean)=>{enabled.value=value?1:0;},setGroundEnabled:(value:boolean)=>{groundEnabled.value=value?1:0;},dispose:()=>{disposed=true;generation++;for(const resource of resources){resource.image.dispose();resource.target.dispose();}resources.length=0;}};
}
