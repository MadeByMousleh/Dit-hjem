import * as THREE from 'three';

const key='facade-brickwork-v3-relief-scale-2';
// NF reference in meters. Display scale is deliberately exaggerated at the
// user's request; building geometry and color-training pixels keep their scale.
const brick={length:.228,height:.054,joint:.012,displayScale:2};
// Compatibility for older saved neighbor walls whose surface identity was
// omitted for batching. Area weighting avoids mistaking roof-edge slivers for walls.
export function isWallGeometry(geometry:THREE.BufferGeometry){
 const p=geometry.getAttribute('position'),index=geometry.index;if(!p)return false;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();let area=0,vertical=0;
 for(let i=0;i<(index?.count??p.count);i+=3){
  a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);
  n.crossVectors(b.sub(a),c.sub(a));const weight=n.length();area+=weight;if(weight>0&&Math.abs(n.y)/weight<.15)vertical+=weight;
 }
 return area>0&&vertical/area>.95;
}

/** NF proportions with both bricks and joints displayed at 2x size. */
export function applyBrickwork(material:THREE.MeshStandardMaterial){
 if(material.userData.brickwork)return;
 material.userData.brickwork=true;
 const compile:THREE.Material['onBeforeCompile']=(shader)=>{
  shader.uniforms.brickMortar={value:new THREE.Color('#969696')};
  shader.uniforms.brickPitch={value:new THREE.Vector2((brick.length+brick.joint)*brick.displayScale,(brick.height+brick.joint)*brick.displayScale)};
  shader.uniforms.brickJointRatio={value:new THREE.Vector2(brick.joint/(brick.length+brick.joint),brick.joint/(brick.height+brick.joint))};
  shader.vertexShader='varying vec3 vBrickPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBrickPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=`varying vec3 vBrickPosition;
uniform vec3 brickMortar;
uniform vec2 brickPitch;
uniform vec2 brickJointRatio;
float brickIntegral(float x,float duty){return floor(x)*duty+min(fract(x),duty);}
float brickJoint(float x,float duty){
 float footprint=max(fwidth(x),0.0001);
 return clamp((brickIntegral(x+footprint*0.5+duty*0.5,duty)-brickIntegral(x-footprint*0.5+duty*0.5,duty))/footprint,0.0,1.0);
}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 brickNormal=normalize(cross(dFdx(vBrickPosition),dFdy(vBrickPosition)));
brickNormal*=abs(brickNormal.x)>abs(brickNormal.z)?sign(brickNormal.x):sign(brickNormal.z);
vec2 brickTangent=normalize(vec2(brickNormal.z,-brickNormal.x)+vec2(0.000001));
vec2 brickUV=vec2(dot(vBrickPosition.xz,brickTangent),vBrickPosition.y)/brickPitch;
brickUV.x+=mod(floor(brickUV.y),2.0)*0.5;
float brickMortarMask=1.0-(1.0-brickJoint(brickUV.x,brickJointRatio.x))*(1.0-brickJoint(brickUV.y,brickJointRatio.y));
float brickRandom=fract(sin(dot(floor(brickUV),vec2(127.1,311.7)))*43758.5453);
float brickDetail=1.0-smoothstep(0.25,1.0,max(fwidth(brickUV.x),fwidth(brickUV.y)));
// Rounded brick shoulders above a 6 mm recessed mortar bed. Height is in
// world meters, independent of the deliberately enlarged display pattern.
vec2 brickEdge=(min(fract(brickUV),1.0-fract(brickUV))-brickJointRatio*0.5)*brickPitch;
float brickFace=smoothstep(0.0,0.004,min(brickEdge.x,brickEdge.y));
float brickHeight=0.006*brickFace*brickDetail;
vec3 brickColor=diffuseColor.rgb*(1.0+(brickRandom-0.5)*0.06*brickDetail);
diffuseColor.rgb=mix(brickColor,brickMortar,brickMortarMask);
`);
  // Surface-gradient bump mapping: recesses catch directional light without
  // changing calibrated wall positions, silhouettes or training pixels.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 brickDx=dFdx(-vViewPosition),brickDy=dFdy(-vViewPosition);
vec3 brickR1=cross(brickDy,normal),brickR2=cross(normal,brickDx);
float brickDet=dot(brickDx,brickR1);
normal=normalize(abs(brickDet)*normal-sign(brickDet)*(dFdx(brickHeight)*brickR1+dFdy(brickHeight)*brickR2));
`);
 };
 material.userData.baseOnBeforeCompile=compile;
 material.userData.baseProgramCacheKey=()=>key;
 material.onBeforeCompile=compile;material.customProgramCacheKey=()=>key;material.needsUpdate=true;
}
