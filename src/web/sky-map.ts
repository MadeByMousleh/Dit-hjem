import * as THREE from 'three';
import {nightSkyAssets} from '../generated/night-sky-assets';

export function equatorialDirection(position:readonly number[]){
 const ra=position[0]!*Math.PI/180,dec=position[1]!*Math.PI/180;
 return new THREE.Vector3(Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec));
}
export function skyMap(scene:THREE.Scene,distance:number){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const context=canvas.getContext('2d')!;context.filter='blur(2px)';context.fillStyle='rgba(255,255,255,0.18)';
 for(const layer of nightSkyAssets.milkyWay)for(const polygon of layer){
  for(const shift of [-360,0,360]){
   context.beginPath();
   for(const ring of polygon){
    let previous=ring[0]![0]!;
    ring.forEach(([ra,dec],index)=>{
     let longitude=ra!;while(longitude-previous>180)longitude-=360;while(longitude-previous< -180)longitude+=360;previous=longitude;
     const x=(longitude+shift+180)/360*canvas.width,y=(90-dec!)/180*canvas.height;
     if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
    });context.closePath();
   }
   context.fill('evenodd');
  }
 }
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=THREE.RepeatWrapping;
 const galaxyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{map:{value:texture},visibility:{value:0}},vertexShader:`
 varying vec3 equatorial;varying vec3 direction;
 void main(){equatorial=position;direction=mat3(modelMatrix)*position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`
 uniform sampler2D map;uniform float visibility;varying vec3 equatorial;varying vec3 direction;
 void main(){vec3 d=normalize(direction);if(d.y<=0.0)discard;vec3 p=normalize(equatorial);vec2 uv=vec2(atan(p.y,p.x)/6.28318530718+0.5,asin(p.z)/3.14159265359+0.5);float haze=texture2D(map,uv).a;float extinction=exp(-0.22/max(0.06,d.y));gl_FragColor=vec4(vec3(0.48,0.55,0.68),haze*visibility*extinction);
 #include <colorspace_fragment>
 }`});
 const galaxy=new THREE.Mesh(new THREE.SphereGeometry(distance,48,32),galaxyMaterial);galaxy.name='milky-way';galaxy.frustumCulled=false;galaxy.renderOrder=-96;scene.add(galaxy);
 const vertices:number[]=[],labels=new THREE.Group();labels.name='constellation-labels';scene.add(labels);
 for(const constellation of nightSkyAssets.constellations){
  for(const line of constellation.lines)for(let i=1;i<line.length;i++){
   const a=equatorialDirection(line[i-1]!),b=equatorialDirection(line[i]!),steps=Math.max(1,Math.ceil(a.angleTo(b)/(Math.PI/90)));
   for(let step=0;step<steps;step++)for(const fraction of [step/steps,(step+1)/steps])vertices.push(...a.clone().lerp(b,fraction).normalize().multiplyScalar(distance).toArray());
  }
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=64;const ctx=labelCanvas.getContext('2d')!;
  ctx.fillStyle='#9baec7';ctx.font='32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(constellation.name,256,32,500);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true,depthWrite:false,toneMapped:false}));
  sprite.position.copy(equatorialDirection(constellation.position)).multiplyScalar(distance);sprite.scale.set(distance*.44,distance*.055,1);sprite.name=constellation.id;sprite.renderOrder=-86;labels.add(sprite);
 }
 const lineMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{visibility:{value:0}},vertexShader:`
 varying vec3 direction;void main(){direction=mat3(modelMatrix)*position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform float visibility;varying vec3 direction;void main(){if(direction.y<=0.0)discard;gl_FragColor=vec4(0.28,0.43,0.65,visibility);
 #include <colorspace_fragment>
 }`});
 const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),lineMaterial);lines.name='constellation-lines';lines.frustumCulled=false;lines.renderOrder=-87;scene.add(lines);
 return {update(rotation:THREE.Matrix4,camera:THREE.Camera,visibility:number,show:boolean,galaxyVisibility:number){
  for(const object of [galaxy,lines,labels]){object.position.copy(camera.position);object.quaternion.setFromRotationMatrix(rotation);}
  galaxyMaterial.uniforms.visibility!.value=galaxyVisibility*.22;galaxy.visible=galaxyVisibility>.001;
  lines.visible=labels.visible=show&&visibility>.02;lineMaterial.uniforms.visibility!.value=visibility*.45;
  for(const child of labels.children){const sprite=child as THREE.Sprite;sprite.visible=sprite.position.clone().transformDirection(rotation).y>0;(sprite.material as THREE.SpriteMaterial).opacity=visibility*.8;}
 },dispose(){texture.dispose();}};
}
