import * as THREE from 'three';
import {Body,Equator,GeoVector,Illumination,Observer,RotateVector,RotationAxis,Rotation_EQJ_HOR,Vector,MakeTime} from 'astronomy-engine';
import {nightSkyAssets} from '../generated/night-sky-assets';
import {equatorialDirection,skyMap} from './sky-map';

const radians=Math.PI/180;
const planetBodies=[Body.Mercury,Body.Venus,Body.Mars,Body.Jupiter,Body.Saturn] as const;
export function skyEphemeris(date:Date,latitude:number,longitude:number,height=0){
 const observer=new Observer(latitude,longitude,height),time=MakeTime(date),rotation=Rotation_EQJ_HOR(time,observer);
 const convergence=Math.atan(Math.tan((longitude-9)*radians)*Math.sin(latitude*radians));
 const local=(vector:Vector)=>{const horizon=RotateVector(rotation,vector);return new THREE.Vector3(-horizon.y,horizon.z,-horizon.x).applyAxisAngle(new THREE.Vector3(0,1,0),convergence);};
 const equatorial=Equator(Body.Moon,time,observer,false,true),direction=local(equatorial.vec).normalize();
 const moonGeo=GeoVector(Body.Moon,time,true),sunGeo=GeoVector(Body.Sun,time,true);
 const sunlight=local(new Vector(sunGeo.x-moonGeo.x,sunGeo.y-moonGeo.y,sunGeo.z-moonGeo.z,time)).normalize();
 const axis=RotationAxis(Body.Moon,time),north=new THREE.Vector3(axis.north.x,axis.north.y,axis.north.z),node=new THREE.Vector3(-Math.sin(axis.ra*15*radians),Math.cos(axis.ra*15*radians),0);
 const prime=node.clone().applyAxisAngle(north,axis.spin*radians),east=new THREE.Vector3().crossVectors(north,prime);
 const convert=(vector:THREE.Vector3)=>local(new Vector(vector.x,vector.y,vector.z,time));
 const orientation=new THREE.Matrix4().makeBasis(convert(prime),convert(north),convert(east).negate());
 const equatorialToLocal=new THREE.Matrix4().makeBasis(local(new Vector(1,0,0,time)),local(new Vector(0,1,0,time)),local(new Vector(0,0,1,time)));
 const fraction=Illumination(Body.Moon,time).phase_fraction;
 const planets=planetBodies.map(body=>({body,direction:local(Equator(body,time,observer,false,true).vec).normalize(),magnitude:Illumination(body,time).mag}));
 return {direction,sunlight,orientation,equatorialToLocal,fraction,planets,angularRadius:Math.asin(1737.4/(equatorial.dist*149597870.7)),altitude:Math.asin(direction.y)/radians};
}

export function nightSky(scene:THREE.Scene,span:number,onTexture:()=>void){
 const distance=span*8,moonGeometry=new THREE.SphereGeometry(1,64,32);
 const moonMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{surface:{value:null},sunlight:{value:new THREE.Vector3()},observer:{value:new THREE.Vector3()},visibility:{value:0},earthshine:{value:0}},vertexShader:`
 varying vec2 surfaceUV; varying vec3 surfaceNormal;
 void main(){surfaceUV=uv;surfaceNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`
 uniform sampler2D surface;uniform vec3 sunlight;uniform vec3 observer;uniform float visibility;uniform float earthshine;
 varying vec2 surfaceUV;varying vec3 surfaceNormal;
 void main(){vec3 normal=normalize(surfaceNormal);float incidence=max(0.0,dot(normal,sunlight));float emission=max(0.0,dot(normal,observer));float reflected=incidence/max(0.001,incidence+emission);vec3 albedo=texture2D(surface,surfaceUV).rgb;gl_FragColor=vec4(albedo*(reflected*1.8+earthshine),visibility);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const moon=new THREE.Mesh(moonGeometry,moonMaterial);moon.name='astronomical-moon';moon.frustumCulled=false;moon.renderOrder=-80;moon.userData.source=nightSkyAssets.credits;scene.add(moon);
 new THREE.TextureLoader().load(nightSkyAssets.moonTexture,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;moonMaterial.uniforms.surface!.value=texture;moon.userData.textureReady=true;onTexture();});
 const positions:number[]=[],magnitudes:number[]=[],colors:number[]=[];
 for(const [ra,dec,magnitude,bv]of nightSkyAssets.stars){
  positions.push(...equatorialDirection([ra!,dec!]).multiplyScalar(distance).toArray());magnitudes.push(magnitude!);
  const color=new THREE.Color('#fff9ee');if(bv!<.3)color.lerp(new THREE.Color('#c6d9ff'),THREE.MathUtils.clamp((.3-bv!)/.6,0,1));else color.lerp(new THREE.Color('#ffc48a'),THREE.MathUtils.clamp((bv!-.3)/1.5,0,1));colors.push(color.r,color.g,color.b);
 }
 const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));starGeometry.setAttribute('magnitude',new THREE.Float32BufferAttribute(magnitudes,1));starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const starMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{visibility:{value:0},pixelRatio:{value:Math.min(devicePixelRatio||1,1.75)},moonDirection:{value:new THREE.Vector3()},moonBrightness:{value:0}},vertexShader:`
 attribute float magnitude;attribute vec3 color;uniform float pixelRatio;varying vec3 tint;varying vec3 direction;varying float flux;
 void main(){direction=normalize(mat3(modelMatrix)*position);tint=color;flux=pow(10.0,-0.4*(magnitude-1.0));gl_PointSize=clamp(1.8+pow(flux,0.22)*2.6,2.1,8.0)*pixelRatio;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`
 uniform float visibility;uniform vec3 moonDirection;uniform float moonBrightness;varying vec3 tint;varying vec3 direction;varying float flux;
 void main(){if(direction.y<=0.0)discard;float radius=length(gl_PointCoord-vec2(0.5))*2.0;if(radius>1.0)discard;float extinction=exp(-0.18/max(0.06,direction.y));float glare=1.0-moonBrightness*exp((dot(direction,moonDirection)-1.0)*12.0);gl_FragColor=vec4(tint,exp(-radius*radius*3.0)*min(1.0,pow(flux,0.38)*2.0)*visibility*extinction*glare);
 #include <colorspace_fragment>
 }`});
 const stars=new THREE.Points(starGeometry,starMaterial);stars.name='catalogue-stars';stars.frustumCulled=false;stars.renderOrder=-90;stars.userData.source=nightSkyAssets.credits;stars.userData.licence=nightSkyAssets.licence;scene.add(stars);
 const planetGeometry=new THREE.BufferGeometry();planetGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(15),3));planetGeometry.setAttribute('magnitude',new THREE.Float32BufferAttribute(new Float32Array(5),1));planetGeometry.setAttribute('color',new THREE.Float32BufferAttribute(['#e2d6c4','#fff5df','#ffb18c','#fff0d8','#efdfad'].flatMap(c=>new THREE.Color(c).toArray()),3));
 const planetMaterial=starMaterial.clone(),planets=new THREE.Points(planetGeometry,planetMaterial);planets.name='visible-planets';planets.frustumCulled=false;planets.renderOrder=-89;scene.add(planets);
 const map=skyMap(scene,distance);
 const moonLight=new THREE.DirectionalLight('#d9e4f0',0);moonLight.name='moonlight';moonLight.shadow.mapSize.set(1024,1024);moonLight.shadow.camera.left=-span;moonLight.shadow.camera.right=span;moonLight.shadow.camera.top=span;moonLight.shadow.camera.bottom=-span;moonLight.shadow.camera.far=span*6;moonLight.shadow.normalBias=.06;scene.add(moonLight);scene.add(moonLight.target);
 let computed:ReturnType<typeof skyEphemeris>|null=null,lastTime=NaN,lastObserver='';
 return {moon,stars,dispose(){map.dispose();moonMaterial.uniforms.surface!.value?.dispose();},update(date:Date,latitude:number,longitude:number,height:number,cloud:number,sunHeight:number,camera:THREE.Camera,constellations=false){
  const observerKey=`${latitude}:${longitude}:${Math.round(height)}`;
  if(!computed||Math.abs(date.getTime()-lastTime)>=15000||lastObserver!==observerKey){computed=skyEphemeris(date,latitude,longitude,height);lastTime=date.getTime();lastObserver=observerKey;}
  const sky=computed,night=1-THREE.MathUtils.smoothstep(sunHeight,Math.sin(-18*radians),Math.sin(-6*radians)),clear=Math.pow(1-cloud,3),strength=Math.pow(sky.fraction,2)*Math.max(0,sky.direction.y)*clear;
  moon.position.copy(camera.position).addScaledVector(sky.direction,distance);moon.quaternion.setFromRotationMatrix(sky.orientation);moon.scale.setScalar(Math.tan(sky.angularRadius)*distance);moon.visible=sky.altitude>-sky.angularRadius/radians&&!!moon.userData.textureReady&&cloud<.99;
  moonMaterial.uniforms.sunlight!.value.copy(sky.sunlight);moonMaterial.uniforms.observer!.value.copy(sky.direction).negate();moonMaterial.uniforms.visibility!.value=clear*(.25+.75*night);moonMaterial.uniforms.earthshine!.value=.004*(1-sky.fraction)*night;
  moon.userData.altitude=sky.altitude;moon.userData.fraction=sky.fraction;moon.userData.angularDiameter=sky.angularRadius*2/radians;
  const starClear=clear;
  stars.position.copy(camera.position);stars.quaternion.setFromRotationMatrix(sky.equatorialToLocal);starMaterial.uniforms.visibility!.value=night*starClear*(1-strength*.65);starMaterial.uniforms.moonDirection!.value.copy(sky.direction);starMaterial.uniforms.moonBrightness!.value=strength;stars.visible=night>.001;
  sky.planets.forEach((planet,index)=>{planetGeometry.attributes.position!.setXYZ(index,planet.direction.x*distance,planet.direction.y*distance,planet.direction.z*distance);planetGeometry.attributes.magnitude!.setX(index,planet.magnitude);});
  planetGeometry.attributes.position!.needsUpdate=true;planetGeometry.attributes.magnitude!.needsUpdate=true;planets.position.copy(camera.position);planets.visible=night>.001;planets.userData.ephemeris=sky.planets;
  planetMaterial.uniforms.visibility!.value=night*clear;planetMaterial.uniforms.moonDirection!.value.copy(sky.direction);planetMaterial.uniforms.moonBrightness!.value=strength;
  map.update(sky.equatorialToLocal,camera,night*clear,constellations,night*clear*(1-strength)*.9);
  const previousShadow=moonLight.castShadow;
  moonLight.position.copy(sky.direction).multiplyScalar(span*2);moonLight.intensity=strength*.075*night;moonLight.castShadow=sky.direction.y>.02&&night>.9&&clear>.25;
  return {direction:sky.direction,strength,night,shadowChanged:previousShadow!==moonLight.castShadow};
 }};
}
