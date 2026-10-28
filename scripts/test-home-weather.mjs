import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['src/services/home-weather.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {localClock,loadHomeWeather,previewWeather,weatherAt,weatherLabel}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
assert.deepEqual(localClock(new Date('2026-10-19T22:05:00Z')),{day:'2026-10-20',minute:5});
assert.deepEqual(localClock(new Date('2026-01-19T22:05:00Z')),{day:'2026-01-19',minute:1385});
assert.equal(localClock(new Date('2026-10-25T00:30:00Z')).minute,150);
assert.equal(localClock(new Date('2026-10-25T01:30:00Z')).minute,150);
const at=Date.parse('2026-10-19T12:00:00Z');
const row={time:at/1000,temperature_2m:8,precipitation:1,snowfall:0,weather_code:61,wind_speed_10m:4,wind_direction_10m:270,cloud_cover:90};
const body={current:row,hourly:Object.fromEntries(Object.entries(row).map(([key,value])=>[key,[value]]))};
let request;
globalThis.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>body};};
const controller=new AbortController(),weather=await loadHomeWeather(55.6789,12.5678,controller.signal);
assert.equal(new URL(request.url).searchParams.get('latitude'),'55.68');
assert.equal(request.options.signal,controller.signal);
assert.equal(weather.current.wind,4);assert.equal(weatherLabel(weather.current),'Regn');
assert.equal(weatherAt(weather,at+30*60000).rain,1);
assert.equal(weatherAt(weather,at+3600000),null);
assert.equal(weatherAt(weather,at+90*60000,true),null);
assert.equal(weatherAt(null,at),null);
const timeline={...weather,quarters:[{...weather.current,at,rain:0,code:0,wind:2},{...weather.current,at:at+15*60000,rain:3,code:63,wind:8},{...weather.current,at:at+30*60000,rain:0,snow:1,code:73,wind:4}]};
assert.equal(weatherAt(timeline,at+15*60000-1,true).rain,0);
assert.equal(weatherAt(timeline,at+15*60000,true).rain,3,'Rain starts on the forecast timestamp, without another fetch');
assert.equal(weatherAt(timeline,at+15*60000,true).wind,8);
assert.equal(weatherAt(timeline,at+30*60000,true).snow,1,'Snow follows the next forecast timestamp');
assert.equal(previewWeather('live',null),null);
assert.equal(weatherLabel(previewWeather('snow',null)),'Sne');
assert.equal(weatherLabel(previewWeather('clear',null)),'Klart');
assert.ok(previewWeather('wind',null).wind>10);
for(const direction of [0,90,180,270])for(const mode of ['live','clear','rain','snow','wind']){
 const local={...weather.current,wind:6.2,windDirection:direction};
 assert.equal(previewWeather(mode,local).windDirection,direction,'Previews preserve the provider bearing');
 assert.equal(previewWeather(mode,local).wind,6.2,'Previews preserve the provider speed');
}
body.current={...row,wind_speed_10m:null};await assert.rejects(loadHomeWeather(55,12,controller.signal),/Invalid weather/);
globalThis.fetch=async()=>({ok:false});await assert.rejects(loadHomeWeather(55,12,controller.signal),/unavailable/);
console.log('Home weather: Copenhagen midnight/DST, rounded location, units, forecasts, stale/missing data, previews and invalid responses pass.');
const animation=await build({stdin:{contents:"export {Scene,Matrix4,PerspectiveCamera,Vector3} from 'three';export {modelWeather} from './src/web/model-weather';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {Scene,Matrix4,PerspectiveCamera,Vector3,modelWeather}=await import(`data:text/javascript;base64,${Buffer.from(animation.outputFiles[0].text).toString('base64')}`);
const originalRandom=Math.random,originalDocument=globalThis.document;
try{
 Math.random=()=>.5;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 for(const direction of [0,45,90,135,180,225,270,315]){
  const east=-Math.sin(direction*Math.PI/180),south=Math.cos(direction*Math.PI/180);
  const scene=new Scene(),effects=modelWeather(scene,40,[]),wind=scene.getObjectByName('weather-wind'),weather={...previewWeather('wind',null),wind:10,windDirection:direction};
  assert.equal(wind.isInstancedMesh,true,'Wind uses tumbling leaf meshes, not lines');
  effects.update(0,weather,false);const before=new Matrix4();wind.getMatrixAt(0,before);
  effects.update(.1,weather,false);const after=new Matrix4();wind.getMatrixAt(0,after);
  assert.ok(Math.abs(after.elements[12]-before.elements[12]-east)<.00001,'East displacement is 10 m/s times 0.1 seconds');
  assert.ok(Math.abs(after.elements[14]-before.elements[14]-south)<.00001,'North wind travels south, east wind travels west');
  const length=Math.hypot(after.elements[8],after.elements[10]);
  assert.ok((after.elements[8]*east+after.elements[10]*south)/length>.98,'Leaf long axis follows downwind, including diagonal bearings');
  for(const azimuth of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const camera=new PerspectiveCamera(42,1,.1,1000);camera.position.set(Math.sin(azimuth)*60,50,Math.cos(azimuth)*60);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
   const start=new Vector3().setFromMatrixPosition(before),end=new Vector3().setFromMatrixPosition(after),expected=start.clone().add(new Vector3(east,end.y-start.y,south)).project(camera);
   assert.ok(end.project(camera).distanceTo(expected)<.000001,'Camera orbit preserves projected geographic wind travel');
  }
  assert.notDeepEqual(after.elements.slice(0,12),before.elements.slice(0,12),'Leaves tumble');
  effects.update(.1,weather,true);const still=new Matrix4();wind.getMatrixAt(0,still);assert.deepEqual(still.elements,after.elements,'Reduced motion freezes leaves');
  effects.update(.1,{...weather,wind:0},false);assert.equal(wind.visible,false,'Calm has no wind animation');
  effects.update(.1,null,false);assert.equal(wind.visible,false,'Missing weather has no wind animation');
  effects.update(0,weather,false);const turnBefore=new Matrix4();wind.getMatrixAt(0,turnBefore);
  effects.update(.1,{...weather,windDirection:(direction+180)%360},false);const turnAfter=new Matrix4();wind.getMatrixAt(0,turnAfter);
  assert.ok(Math.abs(turnAfter.elements[12]-turnBefore.elements[12]+east)<.00001,'A live bearing change reverses eastward travel without rebuilding');
  assert.ok(Math.abs(turnAfter.elements[14]-turnBefore.elements[14]+south)<.00001,'A live bearing change reverses southward travel without rebuilding');
 }
 const edgeScene=new Scene(),edgeEffects=modelWeather(edgeScene,40,[]),edgeWind=edgeScene.getObjectByName('weather-wind');
 edgeEffects.update(2.59,{...weather.current,wind:10,windDirection:90},false);
 const edgeMatrix=new Matrix4();edgeWind.getMatrixAt(0,edgeMatrix);
 assert.ok(Math.hypot(edgeMatrix.elements[0],edgeMatrix.elements[1],edgeMatrix.elements[2])<.0033,'Leaves fade below one percent before wrapping upwind');
}finally{Math.random=originalRandom;globalThis.document=originalDocument;}
console.log('Wind: metre/second travel and leaf alignment at eight bearings, live direction reversal, calm, unavailable and reduced-motion checks pass.');
