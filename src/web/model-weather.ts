import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import type {ModelWeather} from '../services/home-weather';
import {weatherLabel} from '../services/home-weather';

export function atmosphericSky(scene:THREE.Scene,span:number){
 const sky=new Sky();sky.name='weather-sky';sky.scale.setScalar(span*12);sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);
 const uniforms=sky.material.uniforms;
 uniforms.rayleigh!.value=2.2;uniforms.turbidity!.value=2.2;uniforms.mieCoefficient!.value=.004;uniforms.mieDirectionalG!.value=.82;uniforms.showSunDisc!.value=0;uniforms.cloudScale!.value=.0014;uniforms.cloudElevation!.value=.25;uniforms.cloudSpeed!.value=0;
 uniforms.cloudOffset={value:new THREE.Vector2()};
 uniforms.lunarDirection={value:new THREE.Vector3(0,1,0)};uniforms.lunarStrength={value:0};
 sky.material.fragmentShader=sky.material.fragmentShader
  .replace('uniform float time;','uniform float time;\nuniform vec2 cloudOffset;\nuniform vec3 lunarDirection;\nuniform float lunarStrength;')
  .replace('cloudUV += time * cloudSpeed;','cloudUV += cloudOffset;')
  .replace('gl_FragColor = vec4( texColor, 1.0 );','texColor = vec3(1.0) - exp(-max(texColor, vec3(0.0)) * 0.8);\nvec3 nightDirection = normalize(vWorldPosition - cameraPosition);\nfloat horizonGlow = exp(-abs(nightDirection.y) * 8.0);\nfloat moonGlow = pow(max(0.0, dot(nightDirection, lunarDirection)), 256.0) * lunarStrength;\nvec3 nightColor = vec3(0.0003, 0.0005, 0.0008) * (1.0 + horizonGlow * 1.8) + vec3(0.003, 0.004, 0.006) * moonGlow;\ntexColor = mix(nightColor, texColor, smoothstep(-0.16, 0.08, vSunDirection.y));\ngl_FragColor = vec4(texColor, 1.0);');
 let elapsed=0;
 return {update(direction:THREE.Vector3,weather:ModelWeather|null,camera:THREE.Camera,dt:number,reducedMotion:boolean,night?:{direction:THREE.Vector3;strength:number}){
  sky.position.copy(camera.position);uniforms.sunPosition!.value.copy(direction).multiplyScalar(450000);
  if(night){uniforms.lunarDirection!.value.copy(night.direction);uniforms.lunarStrength!.value=night.strength;}
  const coverage=(weather?.cloud??0)/100;uniforms.cloudCoverage!.value=coverage;uniforms.cloudDensity!.value=.45+coverage*1.5;uniforms.turbidity!.value=2.2+coverage*5;
  if(!reducedMotion&&coverage>0){elapsed+=dt;const bearing=(weather?.windDirection??0)*Math.PI/180,speed=weather?.wind??0;uniforms.cloudOffset!.value.x-=Math.sin(bearing)*speed*dt*.00000035;uniforms.cloudOffset!.value.y+=Math.cos(bearing)*speed*dt*.00000035;}
  uniforms.time!.value=elapsed;
 }};
}

export function modelWeather(scene:THREE.Scene,span:number,buildings:THREE.Mesh[],savedCeiling?:number[]){
 const count=650,positions=new Float32Array(count*3),rainVertices=new Float32Array(count*6),radius=span*.65,height=Math.max(18,span*.45);
 const ray=new THREE.Raycaster(),ceiling=new Float32Array(25*25);
 scene.updateMatrixWorld(true);
 if(savedCeiling?.length===625)ceiling.set(savedCeiling);
 else for(let row=0;row<25;row++)for(let col=0;col<25;col++){
  ray.set(new THREE.Vector3((col/24*2-1)*radius,height*3,(row/24*2-1)*radius),new THREE.Vector3(0,-1,0));
  ceiling[row*25+col]=Math.max(0,ray.intersectObjects(buildings,false)[0]?.point.y??0);
 }
 const reset=(index:number,randomHeight=false)=>{positions[index*3]=(Math.random()*2-1)*radius;positions[index*3+1]=randomHeight?Math.random()*height:height;positions[index*3+2]=(Math.random()*2-1)*radius;};
 for(let index=0;index<count;index++)reset(index,true);
 const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainVertices,3).setUsage(THREE.DynamicDrawUsage));
 const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#bed8e6',transparent:true,opacity:.55,depthWrite:false}));rain.frustumCulled=false;rain.name='weather-rain';scene.add(rain);
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const context=canvas.getContext('2d')!;const gradient=context.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.5,'rgba(255,255,255,.9)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,32,32);
 const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:'#ffffff',map:new THREE.CanvasTexture(canvas),size:.15,transparent:true,opacity:.9,depthWrite:false}));snow.frustumCulled=false;snow.name='weather-snow';scene.add(snow);
 const windGeometry=new THREE.BufferGeometry();windGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.5,-.22,.06,-.12,0,.12,.12,.22,.06,-.12,0,0,.5,-.17,.05,.25,.17,.05,.25],3));windGeometry.setIndex([0,1,2,0,2,3,1,5,2,5,4,2,2,4,6,2,6,3]);windGeometry.computeVertexNormals();
 const wind=new THREE.InstancedMesh(windGeometry,new THREE.MeshStandardMaterial({roughness:.9,side:THREE.DoubleSide}),100);wind.instanceMatrix.setUsage(THREE.DynamicDrawUsage);wind.frustumCulled=false;wind.name='weather-wind';scene.add(wind);
 const air=Array.from({length:100},(_,index)=>{wind.setColorAt(index,new THREE.Color(['#7e994f','#b6a76a','#889d71','#c5bb91'][index%4]));return {point:new THREE.Vector3((Math.random()*2-1)*radius,0,(Math.random()*2-1)*radius),base:.5+Math.random()*height*.32,seed:Math.random()*Math.PI*2,size:.22+Math.random()*.22};});
 const leaf=new THREE.Object3D();
 let phase=0;
 function update(dt:number,weather:ModelWeather|null,reducedMotion:boolean){
  const label=weatherLabel(weather),snowing=label==='Sne',raining=label==='Regn',speed=weather?.wind??0;
    rain.visible=!!weather&&raining;snow.visible=!!weather&&snowing;wind.visible=!!weather&&speed>0;
  const radians=(weather?.windDirection??0)*Math.PI/180,east=-Math.sin(radians),south=Math.cos(radians);
  const step=reducedMotion?0:dt;phase+=step;
  const amount=snowing?weather?.snow??0:weather?.rain??0,visibleCount=Math.min(count,Math.round(180+Math.max(0,amount)*90));rainGeometry.setDrawRange(0,visibleCount*2);snowGeometry.setDrawRange(0,visibleCount);
  if(rain.visible||snow.visible)for(let index=0;index<visibleCount;index++){
    const offset=index*3;positions[offset]!+=step*(east*speed+(snowing?Math.sin(phase+index)*.45:0));positions[offset+1]!-=step*(snowing?1.1:14);positions[offset+2]!+=step*south*speed;
   const col=Math.max(0,Math.min(24,Math.round((positions[offset]!/radius+1)*12))),row=Math.max(0,Math.min(24,Math.round((positions[offset+2]!/radius+1)*12)));
   if(positions[offset+1]!<ceiling[row*25+col]!+.2||Math.abs(positions[offset]!)>radius||Math.abs(positions[offset+2]!)>radius)reset(index);
   rainVertices[index*6]=positions[offset]!;rainVertices[index*6+1]=positions[offset+1]!;rainVertices[index*6+2]=positions[offset+2]!;
   rainVertices[index*6+3]=positions[offset]!-east*speed*.025;rainVertices[index*6+4]=positions[offset+1]!+.8;rainVertices[index*6+5]=positions[offset+2]!-south*speed*.025;
  }
    wind.count=Math.min(air.length,Math.round(20+speed*5));
    if(wind.visible)for(let index=0;index<wind.count;index++){
     const particle=air[index]!,point=particle.point;point.x+=east*speed*step;point.z+=south*speed*step;
     point.x=THREE.MathUtils.euclideanModulo(point.x+radius,radius*2)-radius;point.z=THREE.MathUtils.euclideanModulo(point.z+radius,radius*2)-radius;
     const col=Math.max(0,Math.min(24,Math.round((point.x/radius+1)*12))),row=Math.max(0,Math.min(24,Math.round((point.z/radius+1)*12))),flutter=phase*(.7+speed*.12)+particle.seed;
     point.y=Math.max(ceiling[row*25+col]!+.35,particle.base+Math.sin(flutter)*Math.min(1.2,speed*.08));
     // The leaf's long axis is local +Z. Match the actual downwind vector,
     // not the incoming bearing (which mirrors diagonal directions).
     // Keep flutter small enough that it cannot disguise the travel direction.
     leaf.position.copy(point);leaf.rotation.set(Math.sin(flutter*1.7)*.22,Math.atan2(east,south)+Math.sin(flutter*.8)*.12,Math.sin(flutter*.9)*.3);
     // Hide the wrap at the boundary instead of showing a leaf jump upwind.
     const edge=Math.min(radius-Math.abs(point.x),radius-Math.abs(point.z)),fade=THREE.MathUtils.smoothstep(edge,0,Math.max(1,speed*.4));
     leaf.scale.setScalar(particle.size*fade);leaf.updateMatrix();wind.setMatrixAt(index,leaf.matrix);
  }
    rainGeometry.attributes.position!.needsUpdate=true;snowGeometry.attributes.position!.needsUpdate=true;wind.instanceMatrix.needsUpdate=true;
  return !reducedMotion&&(rain.visible||snow.visible||wind.visible);
 }
 return {update,ceiling:Array.from(ceiling)};
}

export function solarDisc(span:number){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const context=canvas.getContext('2d')!;
 const gradient=context.createRadialGradient(128,128,0,128,128,128);gradient.addColorStop(0,'rgba(255,255,250,1)');gradient.addColorStop(.15,'rgba(255,255,244,1)');gradient.addColorStop(.18,'rgba(255,248,215,.9)');gradient.addColorStop(.28,'rgba(255,235,178,.25)');gradient.addColorStop(.6,'rgba(255,226,155,.06)');gradient.addColorStop(1,'rgba(255,226,155,0)');context.fillStyle=gradient;context.fillRect(0,0,256,256);
 for(let index=0;index<10;index++){const angle=index*Math.PI/5+.12*Math.sin(index*7),length=65+22*Math.sin(index*3.7);context.save();context.translate(128,128);context.rotate(angle);const ray=context.createLinearGradient(15,0,length,0);ray.addColorStop(0,'rgba(255,246,222,.09)');ray.addColorStop(1,'rgba(255,246,222,0)');context.fillStyle=ray;context.beginPath();context.moveTo(15,-2);context.lineTo(length,-.5);context.lineTo(length,.5);context.lineTo(15,2);context.fill();context.restore();}
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false}));sprite.scale.setScalar(span*.09);sprite.name='solar-disc';return sprite;
}
