import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';

const result=await build({entryPoints:['src/web/night-sky.ts'],bundle:true,platform:'node',write:false,format:'esm'});
const {skyEphemeris}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const radians=Math.PI/180,latitude=55.68,longitude=12.57;
for(const iso of ['2024-04-08T18:17:00Z','2020-10-31T14:49:00Z','2026-10-19T21:15:00Z','2026-10-26T20:00:00Z']){
 const date=new Date(iso),sky=skyEphemeris(date,latitude,longitude,20);
 assert.ok(sky.angularRadius*2/radians>.47&&sky.angularRadius*2/radians<.57,'Moon keeps real angular diameter');
 if(iso==='2026-10-26T20:00:00Z'){
  const convergence=Math.atan(Math.tan((longitude-9)*radians)*Math.sin(latitude*radians)),trueDirection=sky.direction.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-convergence);
  const azimuth=(Math.atan2(trueDirection.x,-trueDirection.z)/radians+360)%360;
  assert.ok(Math.abs(sky.altitude-37.621703)<.02,'NASA/JPL Horizons DE441 airless topocentric altitude, 12.57E 55.68N 20m');
  assert.ok(Math.abs(azimuth-112.435943)<.02,'NASA/JPL Horizons azimuth');
  assert.ok(Math.abs(sky.angularRadius*2/radians*3600-1974.708)<1,'NASA/JPL Horizons angular diameter');
  for(const [body,az,alt,mag]of [['Venus',309.047253,-42.006009,-4.239],['Mars',28.196891,-12.884843,.850],['Jupiter',21.958270,-17.738366,-1.976]]){
   const planet=sky.planets.find(p=>p.body===body),direction=planet.direction.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-convergence);
   const bearing=(Math.atan2(direction.x,-direction.z)/radians+360)%360;
   assert.ok(Math.abs(bearing-az)<.03,body+' JPL airless topocentric azimuth');
   assert.ok(Math.abs(Math.asin(direction.y)/radians-alt)<.03,body+' JPL airless altitude');
   assert.ok(Math.abs(planet.magnitude-mag)<.15,body+' apparent magnitude');
  }
 }
 assert.ok(Math.abs(sky.direction.length()-1)<1e-10);assert.ok(Math.abs(sky.equatorialToLocal.determinant()-1)<1e-9);
 assert.equal(sky.planets.length,5);assert.ok(sky.planets.every(p=>Number.isFinite(p.magnitude)&&Math.abs(p.direction.length()-1)<1e-10));
 const observer=sky.direction.clone().negate().applyMatrix4(sky.orientation.clone().invert());
 assert.ok(observer.x>.97,'NASA zero-longitude near side faces the observer');assert.ok(Math.abs(observer.y)<.15,'Lunar pole/libration orientation is plausible');
 if(iso.startsWith('2024-04-08'))assert.ok(sky.fraction<.001,'Known eclipse is a new Moon');
 if(iso.startsWith('2020-10-31'))assert.ok(sky.fraction>.999,'Known Halloween full Moon');
 const polarisRA=37.95*radians,polarisDec=89.2641*radians;
 const polaris=new THREE.Vector3(Math.cos(polarisDec)*Math.cos(polarisRA),Math.cos(polarisDec)*Math.sin(polarisRA),Math.sin(polarisDec)).applyMatrix4(sky.equatorialToLocal);
 assert.ok(Math.abs(Math.asin(polaris.y)/radians-latitude)<1,'Polaris altitude matches observer latitude');assert.ok(polaris.z<0,'Polaris is north, not south');
}
const earlier=skyEphemeris(new Date('2026-10-26T20:00:00Z'),latitude,longitude),later=skyEphemeris(new Date('2026-10-27T02:00:00Z'),latitude,longitude);
assert.ok(earlier.direction.distanceTo(later.direction)>.5,'Moon and sky move with real time');
console.log('PASS: NASA/JPL Horizons Moon and bright-planet positions/magnitudes, known phases, near-side texture orientation, catalogue frame/Polaris and time progression.');