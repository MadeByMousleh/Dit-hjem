import * as THREE from 'three';
import type {HomeGeometry,RoofMaterial} from '../services/home-insights';
const styles={'concrete-tile':1,'clay-tile':2,'fiber-cement':3,metal:4,felt:5,thatch:6,plastic:7,glass:8};
export function matchSavedRoof(geometry:THREE.BufferGeometry,buildings:HomeGeometry['buildings'],cx:number,cy:number){
 geometry.computeBoundingBox();const box=geometry.boundingBox;if(!box)return undefined;
 const matches=buildings.filter(b=>{const points=b.rings.flat(),xs=points.map(p=>p[0]-cx),zs=points.map(p=>cy-p[1]);return [Math.min(...xs)-box.min.x,Math.max(...xs)-box.max.x,Math.min(...zs)-box.min.z,Math.max(...zs)-box.max.z].every(v=>Math.abs(v)<.25);});
 return matches.length===1?matches[0]!.id:undefined;
}
/** Material-family illustration, with existing image-derived roof color/map. */
export function applyRoofAppearance(material:THREE.MeshStandardMaterial,roof:RoofMaterial|undefined){
 const style=roof?styles[roof.kind as keyof typeof styles]:undefined;
 if(!style||material.userData.roofStyle===style)return;
 material.userData.roofStyle=style;
 const compile:THREE.Material['onBeforeCompile']=(shader)=>{
  shader.uniforms.roofStyle={value:style};
  shader.vertexShader='varying vec3 vRoofPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoofPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=`varying vec3 vRoofPosition;
uniform float roofStyle;
float roofLine(float x,float duty){float w=max(fwidth(x),0.0001);float a=x-w*0.5+duty*0.5,b=x+w*0.5+duty*0.5;return clamp(((floor(b)-floor(a))*duty+min(fract(b),duty)-min(fract(a),duty))/w,0.0,1.0);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 roofN=normalize(cross(dFdx(vRoofPosition),dFdy(vRoofPosition)));
if(roofN.y<0.0)roofN=-roofN;
vec3 roofAcross=length(roofN.xz)>0.12?normalize(vec3(roofN.z,0.0,-roofN.x)):vec3(1.0,0.0,0.0);
vec3 roofDown=normalize(cross(roofN,roofAcross));
vec2 roofUV=vec2(dot(vRoofPosition,roofAcross),dot(vRoofPosition,roofDown));
float roofShade=1.0,roofHeight=0.0,roofSeam=0.0;
if(roofStyle<2.5){
 vec2 cell=roofUV/vec2(0.30,0.33);
 float detail=1.0-smoothstep(0.25,1.0,max(fwidth(cell.x),fwidth(cell.y)));
 roofSeam=max(roofLine(cell.x,0.025),roofLine(cell.y,0.045));
 float curve=sin(6.2831853*cell.x);
 roofShade=1.0-0.28*roofSeam+detail*0.10*curve;
 roofHeight=detail*(0.012*cos(6.2831853*cell.x)+0.008*(1.0-fract(cell.y)));
}else if(roofStyle<4.5){
 float spacing=roofStyle<3.5?0.95:0.55;
 roofSeam=max(roofLine(roofUV.x/spacing,0.018),roofLine(roofUV.y/2.0,0.012));
 roofShade=1.0-0.25*roofSeam;roofHeight=0.007*roofSeam;
}else if(roofStyle<5.5){
 roofSeam=max(roofLine(roofUV.x,0.018),roofLine(roofUV.y/5.0,0.006));
 roofShade=1.0-0.18*roofSeam;roofHeight=0.003*roofSeam;
}else if(roofStyle<6.5){
 float strand=roofLine(roofUV.x/0.014,0.2);float tie=roofLine(roofUV.y/0.65,0.025);
 roofShade=1.0-0.18*strand-0.13*tie;roofHeight=0.003*strand;
}else{
 roofSeam=max(roofLine(roofUV.x/0.8,0.018),roofLine(roofUV.y/1.6,0.018));roofShade=1.0-0.2*roofSeam;roofHeight=0.003*roofSeam;
}
diffuseColor.rgb*=roofShade;
`);
  // Shading relief only: measured geometry/silhouette and shadow meshes remain intact.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 roofDx=dFdx(-vViewPosition),roofDy=dFdy(-vViewPosition);
vec3 roofR1=cross(roofDy,normal),roofR2=cross(normal,roofDx);
float roofDet=dot(roofDx,roofR1);
normal=normalize(abs(roofDet)*normal-sign(roofDet)*(dFdx(roofHeight)*roofR1+dFdy(roofHeight)*roofR2));
`);
 };
 const cacheKey=()=>`bbr-roof-surface-v1-${style}`;
 material.userData.baseOnBeforeCompile=compile;material.userData.baseProgramCacheKey=cacheKey;
 material.onBeforeCompile=compile;material.customProgramCacheKey=cacheKey;material.needsUpdate=true;
}
