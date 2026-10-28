import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import jpeg from 'jpeg-js';

const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
let geometry={addressId:'weather-fixture',point:[500020,6100020],bbox:[500000,6100000,500040,6100040],latitude:55.68,longitude:12.57,parcels:[{id:'parcel',number:'1',registeredArea:1024,polygons:[[[[500004,6100004],[500036,6100004],[500036,6100036],[500004,6100036],[500004,6100004]]]]}],buildings:[{id:'house',bbrId:null,main:true,associated:false,rings:[[[500014,6100014],[500026,6100014],[500026,6100026],[500014,6100026],[500014,6100014]]],height:5,heightSource:'fixture',outlineSource:'fixture'}],source:'Synthetic',notice:'',warnings:[]};
const pixels=Buffer.alloc(256*256*4);
for(let row=0;row<256;row++)for(let col=0;col<256;col++){
 const offset=(row*256+col)*4,path=Math.abs(col-128)<12,checker=(Math.floor(row/16)+Math.floor(col/16))%2;
 pixels[offset]=path?175:65+checker*15;pixels[offset+1]=path?175:120+checker*15;pixels[offset+2]=path?170:65;pixels[offset+3]=255;
}
let texture=jpeg.encode({data:pixels,width:256,height:256},90).data;
const terrainMode=process.argv.includes('--terrain');
const actualHome=process.argv.includes('--actual-home');
const skyMode=process.argv.includes('--night-sky');
const lowMoon=process.argv.includes('--low-moon');
const snapshotTime=skyMode?(lowMoon?'2026-10-19T20:51:13Z':'2026-10-26T20:00:00Z'):'2026-10-19T21:15:00Z';
const offlineMap=process.argv.includes('--offline-map');
let actualHeights=null;
const neighbourhood={...geometry,bbox:[499860,6099860,500180,6100180],buildings:[...geometry.buildings,{...geometry.buildings[0],id:'neighbour',main:false,rings:[[[500050,6100000],[500064,6100000],[500064,6100012],[500050,6100012],[500050,6100000]]]}]};
const heightsFor=area=>{const terrain=Array.from({length:32*32},(_,index)=>10+(area.bbox[0]+(index%32+.5)/32*(area.bbox[2]-area.bbox[0])-500020)*.025);return {addressId:geometry.addressId,bbox:area.bbox,width:32,height:32,terrain,surface:terrain.map(value=>value+5),resolution:[(area.bbox[2]-area.bbox[0])/32,(area.bbox[3]-area.bbox[1])/32],source:'Synthetic slope',notice:''};};
let environment={geometry:neighbourhood,heights:heightsFor(neighbourhood),texture:'data:image/jpeg;base64,'+texture.toString('base64')};
if(actualHome){
 const modelsBuild=await build({entryPoints:['src/generated/lidar-models.ts'],bundle:true,write:false,format:'esm'});
 const {lidarModels}=await import('data:text/javascript;base64,'+Buffer.from(modelsBuild.outputFiles[0].text).toString('base64'));
 const addresses=[...new Set(Object.values(lidarModels).map(model=>model.addressId))];assert.equal(addresses.length,1,'One model-bound address is required');
 const request=async params=>{const response=await fetch('https://dit-hjem-five.vercel.app/api/address/search?'+new URLSearchParams(params),{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200,params.mode+' response');return response;};
 geometry=await(await request({mode:'geometry',id:addresses[0]})).json();
 actualHeights=await(await request({mode:'height',id:addresses[0]})).json();
 const surrounding=await(await request({mode:'geometry',id:addresses[0],surroundings:'1'})).json();
 const wideHeights=await(await request({mode:'height',id:addresses[0],surroundings:'1'})).json();
 texture=Buffer.from(await(await request({mode:'orthophoto',bbox:geometry.bbox.join(',')})).arrayBuffer());
 const wideImage=Buffer.from(await(await request({mode:'orthophoto',bbox:surrounding.bbox.join(',')})).arrayBuffer());
 environment={geometry:surrounding,heights:wideHeights,texture:'data:image/jpeg;base64,'+wideImage.toString('base64')};
 console.log('Actual model-bound map loaded: '+surrounding.buildings.length+' buildings; '+wideHeights.terrain.length+' height samples.');
}
if(offlineMap){
 const offlineBuild=await build({entryPoints:['src/generated/home-environment.ts'],bundle:true,write:false,format:'esm'});
 environment=(await import('data:text/javascript;base64,'+Buffer.from(offlineBuild.outputFiles[0].text).toString('base64'))).bundledEnvironment;
}
const engine=await build({entryPoints:['src/web/home3d.ts'],bundle:true,write:false,format:'iife',plugins:[{name:'scene-inspection',setup(builder){
 builder.onLoad({filter:/[/\\]web[/\\]home3d\.ts$/},async args=>({loader:'ts',contents:(await readFile(args.path,'utf8')).replace('const parcelLidar=getParcelLidarModel(g);',"const parcelLidar=config.environment?.heights===null?{polygons:[],points:[],terrain:{vertices:[500004,6100004,9.6,500036,6100004,10.4,500036,6100036,10.4,500004,6100036,9.6],indices:[0,1,2,0,2,3],heightRange:[9.6,10.4]}}:getParcelLidarModel(g);").replace('renderer.render(scene,camera);',`renderer.render(scene,camera);
 const gl=renderer.getContext(),sample=new Uint8Array(4);
 gl.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,sample);
 const named=(name)=>scene.getObjectByName(name),weatherObject=(name)=>{const object=named(name);return {visible:object.visible,positions:Array.from((object.instanceMatrix??object.geometry.attributes.position).array.slice(0,36))}};
 window.environmentCheck=()=>({mapped:!!environmentFloor?.material.map,centralMapped:!!floorMaterial.map,terrainMapped:!!terrain?.material.map,terrainUsesSameMap:!!terrain&&terrain.material.map===floorMaterial.map,terrainColors:terrain?.material.vertexColors,fallback:!!groundFallbackTexture&&floorMaterial.map===groundFallbackTexture,repeat:floorMaterial.map?.repeat.toArray(),offset:floorMaterial.map?.offset.toArray(),buildings:buildings.length,roofs:scene.children.filter(mesh=>mesh.userData.neighbourRoof).map(mesh=>({mapped:!!mesh.material.map,uv:Array.from(mesh.geometry.attributes.uv.array)})),range:environmentFloor?new THREE.Box3().setFromObject(environmentFloor).getSize(new THREE.Vector3()).toArray():null});
 window.checkGroundCoverage=()=>{const previous=camera.position.clone(),results=[],ray=new THREE.Raycaster(),targets=[floor,...(environmentFloor?[environmentFloor]:[])];for(let angle=0;angle<8;angle++){camera.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(controls.maxDistance,controls.maxPolarAngle,angle*Math.PI/4));camera.lookAt(controls.target);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);for(const horizontal of [-.99,0,.99])for(const vertical of [-.99,0,.99]){ray.setFromCamera(new THREE.Vector2(horizontal,vertical),camera);if(!ray.intersectObjects(targets,false).length)results.push({angle,horizontal,vertical});}}camera.position.copy(previous);camera.lookAt(controls.target);camera.updateMatrixWorld(true);return results};
 window.sceneCheck={minute,playing:state.playing,live:state.live,reducedMotion:state.reducedMotion,background:Array.from(sample),direction:direction.toArray(),sunVisible:sunMesh.visible,sunPosition:sunMesh.position.clone().project(camera).toArray(),floorY:Array.from(floorGeometry.attributes.position.array).filter((_,index)=>index%3===1),textured:!!floorMaterial.map,terrain:!!terrain,cloud:!!parcelCloud,vegetation:!!vegetationMesh,sceneSize:scene.children.length,rain:weatherObject('weather-rain'),snow:weatherObject('weather-snow'),wind:weatherObject('weather-wind')};
 window.celestialCheck=()=>{const moon=named('astronomical-moon'),stars=named('catalogue-stars'),point=moon.position.clone().project(camera),disc=new Uint8Array(7*7*4);renderer.render(scene,camera);gl.readPixels(Math.max(0,Math.min(gl.drawingBufferWidth-7,Math.floor((point.x+1)*gl.drawingBufferWidth/2)-3)),Math.max(0,Math.min(gl.drawingBufferHeight-7,Math.floor((point.y+1)*gl.drawingBufferHeight/2)-3)),7,7,gl.RGBA,gl.UNSIGNED_BYTE,disc);let brightest=0;for(let offset=0;offset<disc.length;offset+=4)if(disc[offset]+disc[offset+1]+disc[offset+2]>disc[brightest]+disc[brightest+1]+disc[brightest+2])brightest=offset;return {cameraMode:state.cameraMode,moonVisible:moon.visible,texture:!!moon.userData.textureReady,diameter:moon.userData.angularDiameter,phase:moon.userData.fraction,moonPixel:Array.from(disc.slice(brightest,brightest+4)),moonOpacity:moon.material.uniforms.visibility.value,moonPosition:point.toArray(),starsVisible:stars.visible,starOpacity:stars.material.uniforms.visibility.value,count:stars.geometry.attributes.position.count,cloud:weather?.cloud};};
 window.placementPoint=(u,v,roof=false)=>world([left+(right-left)*u,bottom+(top-bottom)*v],(ground(left+(right-left)*u,bottom+(top-bottom)*v)??origin)+(roof?5:0)).project(camera).toArray();
 window.lookDelta=(target)=>{const wanted=target==='moon'?named('astronomical-moon').position.clone().sub(camera.position).normalize():new THREE.Vector3(...target).normalize(),current=camera.getWorldDirection(new THREE.Vector3()),yaw=Math.atan2(wanted.x,-wanted.z)-Math.atan2(current.x,-current.z),delta=THREE.MathUtils.euclideanModulo(yaw+Math.PI,Math.PI*2)-Math.PI,scale=renderer.domElement.clientHeight/THREE.MathUtils.degToRad(camera.fov);return [-delta*scale,(Math.asin(wanted.y)-Math.asin(current.y))*scale];};
 window.groundCheck=()=>{const ray=new THREE.Raycaster(camera.position,new THREE.Vector3(0,-1,0)),hit=ray.intersectObjects([floor,...(terrain?[terrain.mesh]:[]),...(environmentFloor?[environmentFloor]:[])],false)[0];return {mode:state.cameraMode,eye:camera.position.toArray(),direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),clearance:hit?.distance,ground:floor.visible,house:buildingRenderMeshes.every(mesh=>mesh.visible),lines:named('constellation-lines').visible,labels:named('constellation-labels').visible,galaxy:named('milky-way').material.uniforms.visibility.value,planets:named('visible-planets').geometry.attributes.position.count};};
 window.groundVisual=()=>{camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hit=ray.intersectObjects(buildingRenderMeshes,false)[0];const pixel=()=>{renderer.render(scene,camera);const p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};const shown=pixel(),visibility=buildingRenderMeshes.map(m=>m.visible);buildingRenderMeshes.forEach(m=>m.visible=false);const hidden=pixel();buildingRenderMeshes.forEach((m,i)=>m.visible=visibility[i]);renderer.render(scene,camera);return {hit:hit?.object.userData.houseSurface,shown,hidden,error:gl.getError()};};
 window.scenePixels=(threshold=30)=>{renderer.render(scene,camera);const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let different=0;for(let index=0;index<pixels.length;index+=4)if(Math.abs(pixels[index]-pixels[0])+Math.abs(pixels[index+1]-pixels[1])+Math.abs(pixels[index+2]-pixels[2])>threshold)different++;return different/(pixels.length/4)};`) }));
}}]});
const fixtures=`
export const useHouseholdSession=()=>({session:{user:{id:'fixture'}},householdId:'fixture'});
export const useOrthophoto=()=>'/parcel.jpg';
export const homeInsight=async()=>(${terrainMode&&!offlineMap?JSON.stringify(actualHeights??heightsFor(geometry)):'null'});
export const homeEnvironmentFallback=()=>(${offlineMap?JSON.stringify(environment):'null'});
export const loadHomeEnvironment=async()=>{${terrainMode?"const response=await fetch('/environment');if(!response.ok)throw Error('Environment unavailable');return response.json();":"return null;"}};
export const loadModelPhotos=async()=>null;
export const loadAerialOpenings=async()=>({walls:[]});
export const loadFacades=async()=>[];
export const saveFacades=async()=>{};
export const analyzeHouseFacade=async()=>{throw Error('Analysis not part of this fixture')};
export const readHouseCaptures=async()=>[];
export const addHouseCapture=async()=>[];
export const removeHouseCapture=async()=>[];
export const launchImageLibraryAsync=async()=>({canceled:true});
export const launchCameraAsync=async()=>({canceled:true});
export const requestCameraPermissionsAsync=async()=>({granted:true});
export const manipulateAsync=async()=>({});export const SaveFormat={JPEG:'jpeg'};
export default {getItem:async()=>null,setItem:async()=>{}};
`;
const app=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {HomeSunSimulation} from './src/components/HomeSunSimulation3D';createRoot(document.getElementById('root')).render(<HomeSunSimulation data={${JSON.stringify(geometry)}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'synthetic-services',setup(builder){
 builder.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));
 builder.onResolve({filter:/(?:home-insights|home-model-photo-cache|aerial-openings|useHouseholdSession|house-capture-store|house-facade|HomeParcelMap)$|^@react-native-async-storage\/async-storage$|^expo-image-(?:picker|manipulator)$/},()=>({path:'fixture',namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixtures,loader:'js'}));
 builder.onLoad({filter:/generated[/\\]home3d-bundle\.ts$/},()=>({contents:`export const home3dBundle=${JSON.stringify(engine.outputFiles[0].text)};`,loader:'js'}));
}}],banner:{js:'var process={env:{NODE_ENV:"production"}};'}});
const html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;background:#fff}#root{max-width:1100px;margin:auto}@font-face{font-family:Nunito_700Bold;src:url(/bold.ttf)}@font-face{font-family:Nunito_400Regular;src:url(/regular.ttf)}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const server=createServer(async(request,response)=>{
 if(request.url==='/app.js'){response.setHeader('Content-Type','text/javascript');return response.end(app.outputFiles[0].contents);}
 if(request.url==='/parcel.jpg'){response.setHeader('Content-Type','image/jpeg');return response.end(texture);}
 if(request.url==='/environment'){response.setHeader('Content-Type','application/json');return response.end(JSON.stringify(environment));}
 if(['/bold.ttf','/regular.ttf'].includes(request.url)){response.setHeader('Content-Type','font/ttf');return response.end(await readFile(`node_modules/@expo-google-fonts/nunito/${request.url==='/bold.ttf'?'700Bold/Nunito_700Bold':'400Regular/Nunito_400Regular'}.ttf`));}
 response.setHeader('Content-Type','text/html');response.end(html);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const forecast=(date)=>{const at=Math.floor(Date.parse(date)/3600000)*3600,row={time:at,temperature_2m:8,precipitation:2,snowfall:0,weather_code:63,wind_speed_10m:5,wind_direction_10m:270,cloud_cover:95};return {current:row,hourly:Object.fromEntries(Object.keys(row).map(key=>[key,Array.from({length:72},(_,index)=>key==='time'?at-86400+index*3600:row[key])]))};};
if(process.argv.includes('--serve')){console.log(`Synthetic home weather preview: ${origin}`);}else{
 let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.argv.includes('--android-stack')?['--js-flags=--stack-size=512']:[])]});
  await mkdir('.tmp/home-weather-review',{recursive:true});
    for(const width of process.argv.includes('--sky-smoke')?[390,1280]:[320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(/THREE.WebGLProgram|3D initialization/.test(message.text()))errors.push(message.text());});
  await page.clock.setFixedTime(new Date(snapshotTime));
    let failTexture=offlineMap,failWeather=false,failEnvironment=offlineMap,missingHeights=false;
    await context.route('**/*',route=>(failTexture&&route.request().url()===origin+'/parcel.jpg')||(failEnvironment&&route.request().url()===origin+'/environment')?route.fulfill({status:503,body:''}):missingHeights&&route.request().url()===origin+'/environment'?route.fulfill({json:{...environment,heights:null,status:'Omgivende højder mangler · terræn er tilnærmet'}}):route.request().url().startsWith(origin)?route.continue():route.request().url().startsWith('https://api.open-meteo.com/')?route.fulfill(failWeather?{status:503,body:''}:{json:forecast(snapshotTime)}):route.abort());
   await page.goto(origin);
   await page.getByRole('button',{name:'Afspil dagen'}).waitFor();
   const frame=page.frames().find(item=>item!==page.mainFrame());
   await frame.waitForFunction(()=>window.sceneCheck?.textured&&window.sceneCheck.rain.visible);
   const inspect=()=>frame.evaluate(()=>window.sceneCheck);
   const initial=await inspect();
  if(skyMode){
   const touch=width===390?await context.newCDPSession(page):null;
   const tap=async(u,v,roof=false)=>{await frame.locator('canvas').scrollIntoViewIfNeeded();const point=await frame.evaluate(([u,v,roof])=>window.placementPoint(u,v,roof),[u,v,roof]),rect=await frame.locator('canvas').boundingBox(),x=rect.x+(point[0]+1)*rect.width/2,y=rect.y+(1-point[1])*rect.height/2;if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);};
   const aim=async target=>{
    for(let step=0;step<30;step++){
     const delta=await frame.evaluate(target=>window.lookDelta(target),target);if(Math.hypot(...delta)<2)return;
     await frame.locator('canvas').scrollIntoViewIfNeeded();const rect=await frame.locator('canvas').boundingBox(),dx=Math.max(-rect.width*.3,Math.min(rect.width*.3,delta[0])),dy=Math.max(-rect.height*.3,Math.min(rect.height*.3,delta[1]));
     const x=rect.x+rect.width*.5,y=rect.y+rect.height*.5;
     if(touch){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=5;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5,id:1}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
     else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:5});await page.mouse.up();}
    }
    assert.fail('Look controls did not reach target');
   };
   await page.getByRole('radio',{name:'Sol',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Vis himmel',exact:true}).count(),0,'Old Moon camera control removed');
   await page.getByRole('button',{name:'Vælg ståsted på grunden',exact:true}).click();
   await frame.waitForFunction(()=>window.groundCheck?.().mode==='place');
   await tap(.5,.5,true);await page.getByText('Vælg et frit sted på grunden, væk fra huset og tagene.',{exact:true}).waitFor();
   assert.equal((await frame.evaluate(()=>window.groundCheck())).mode,'place','Roof cannot be a standing position');
   await tap(.8,.2);await frame.waitForFunction(()=>window.groundCheck().mode==='ground');
   const standing=await frame.evaluate(()=>window.groundCheck());assert.ok(Math.abs(standing.clearance-1.7)<.001,'Camera is exactly 1.7 m above rendered sloping terrain');assert.ok(standing.ground&&standing.house,'Ground view retains house and terrain');assert.equal(standing.planets,5);
   await aim('moon');await frame.waitForFunction(()=>window.celestialCheck().moonVisible&&window.celestialCheck().texture&&window.celestialCheck().starsVisible);
   const sky=await frame.evaluate(()=>window.celestialCheck());assert.equal(sky.count,5044);assert.ok(sky.diameter>.47&&sky.diameter<.57);assert.ok(lowMoon?sky.phase>.5&&sky.phase<.75:sky.phase>.98);assert.ok(Math.abs(sky.moonPosition[0])<.05&&Math.abs(sky.moonPosition[1])<.05,'Moon can be viewed at its actual altitude from the chosen ground position');assert.ok(Math.max(...sky.moonPixel.slice(0,3))>40,'Moon disc has visible pixels');
   assert.deepEqual((await frame.evaluate(()=>window.groundCheck())).eye,standing.eye,'Looking at the Moon never moves the observer');
   await page.screenshot({path:`.tmp/home-weather-review/${lowMoon?'low-':''}ground-moon-${width}.png`,fullPage:true});
   await aim([0,1,-.02]);assert.ok((await frame.evaluate(()=>window.groundCheck())).direction[1]>.99,'Can look straight up');
   assert.ok(await frame.evaluate(()=>window.scenePixels(3))>.001,'Night sky renders nonuniform pixels');
   await page.getByRole('switch',{name:'Stjernebilleder og navne'}).click();await frame.waitForFunction(()=>window.groundCheck().lines&&window.groundCheck().labels);
   assert.ok((await frame.evaluate(()=>window.groundCheck())).galaxy>0,'Milky Way is present at night');
   await page.screenshot({path:`.tmp/home-weather-review/ground-constellations-${width}.png`,fullPage:true});
   await page.setViewportSize({width:width+80,height:820});await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.deepEqual((await frame.evaluate(()=>window.groundCheck())).eye,standing.eye,'Resize keeps standing point');
   await page.setViewportSize({width,height:900});
   await aim([0,-.5,1]);assert.equal((await frame.evaluate(()=>window.groundCheck())).mode,'ground','Looking down no longer exits ground mode');
   await page.mouse.wheel(0,-200);assert.deepEqual((await frame.evaluate(()=>window.groundCheck())).eye,standing.eye,'Wheel cannot move the observer');
   await page.getByRole('radio',{name:'Regn',exact:true}).click();await frame.waitForFunction(()=>window.celestialCheck().starOpacity<.01&&window.celestialCheck().moonOpacity<.01);
   await page.getByRole('radio',{name:'Sol',exact:true}).click();const slider=await page.getByLabel('Tidspunkt for solvisning').boundingBox();await page.mouse.click(slider.x+slider.width*.5,slider.y+slider.height*.5);await frame.waitForFunction(()=>window.sceneCheck.sunVisible&&!window.celestialCheck().starsVisible&&!window.groundCheck().lines);
   assert.deepEqual((await frame.evaluate(()=>window.groundCheck())).eye,standing.eye,'Time and weather changes retain standing position');
   await aim([-1,.1,-1]);const groundVisual=await frame.evaluate(()=>window.groundVisual());assert.equal(groundVisual.hit?.id,'house');assert.equal(groundVisual.error,0,'No WebGL error when changing shadow lights');assert.ok(groundVisual.shown.slice(0,3).some((v,i)=>Math.abs(v-groundVisual.hidden[i])>20),'House contributes actual pixels from eye height');await page.screenshot({path:`.tmp/home-weather-review/ground-house-day-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Flyt ståsted',exact:true}).click();await frame.waitForFunction(()=>window.groundCheck().mode==='place');await tap(.05,.2);assert.equal((await frame.evaluate(()=>window.groundCheck())).mode,'place','Cannot stand outside the property');
   await tap(.8,.8);await frame.waitForFunction(()=>window.groundCheck().mode==='ground');assert.notDeepEqual((await frame.evaluate(()=>window.groundCheck())).eye,standing.eye,'Can choose a different standing position');
   await page.getByRole('button',{name:'Tilbage til husoverblik',exact:true}).click();await frame.waitForFunction(()=>window.groundCheck().mode==='orbit');assert.deepEqual(await frame.evaluate(()=>window.checkGroundCoverage()),[],'Returning restores covered orbit view');
   assert.deepEqual(errors,[],'No sky shader/runtime errors');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await frame.evaluate(()=>window.home3d.dispose());await touch?.detach();await context.close();console.log(`PASS ground sky ${width}px (${touch?'touch':'mouse'}): property/roof validation, 1.7 m fixed eye, Moon pixels, 5044 stars, planets, Milky Way/constellation toggle, resize/weather/time, reposition and orbit return.`);continue;
  }
  if(actualHome){
   await frame.waitForFunction(()=>window.environmentCheck().mapped);
   assert.deepEqual(await frame.evaluate(()=>window.checkGroundCoverage()),[],'Actual map fills all orbit/zoom corners');
  assert.ok(await frame.evaluate(()=>window.scenePixels(3))>.02,'Actual night scene is nonblank');
   const slider=await page.getByLabel('Tidspunkt for solvisning').boundingBox();await page.mouse.click(slider.x+slider.width*.5,slider.y+slider.height*.5);await page.getByRole('radio',{name:'Sol',exact:true}).click();await frame.waitForFunction(()=>window.sceneCheck.sunVisible);
  await page.screenshot({path:`.tmp/home-weather-review/actual-${offlineMap?'offline-':''}day-${width}.png`,fullPage:true});
   assert.deepEqual(errors,[],'No actual-property renderer errors');await frame.evaluate(()=>window.home3d.dispose());await context.close();console.log(`PASS actual property ${width}px: imagery, ground coverage, nonblank canvas.`);continue;
  }
   assert.equal(initial.minute,1395,'Initial clock uses Copenhagen local time');
   assert.equal(initial.sunVisible,false,'Sun below horizon at night');
  if(!terrainMode)assert.ok(initial.background[0]<30,'Night sky is dark');
  if(terrainMode){await frame.waitForFunction(()=>window.environmentCheck().mapped);assert.ok(Math.max(...initial.floorY)-Math.min(...initial.floorY)>.5,'Measured ground slope is retained');const surrounding=await frame.evaluate(()=>window.environmentCheck());assert.equal(surrounding.buildings,2,'Neighbour beyond original view is rendered');assert.equal(surrounding.range[0],320);assert.deepEqual(await frame.evaluate(()=>window.checkGroundCoverage()),[],'Mapped terrain fills every corner at maximum orbit/zoom');}else assert.ok(initial.floorY.every(value=>Math.abs(value+.04)<.001),'Parcel is flat');
  if(terrainMode){const roofs=(await frame.evaluate(()=>window.environmentCheck())).roofs;assert.equal(roofs.length,1);assert.ok(roofs[0].mapped,'Neighbour roof receives aerial imagery');assert.ok(roofs[0].uv.every(value=>value>=0&&value<=1),'Roof imagery stays inside real map coverage');}
  assert.equal(initial.terrain||initial.cloud||initial.vegetation,false,'No terrain, point cloud or vegetation geometry');
  assert.ok(await frame.evaluate(()=>window.scenePixels(3))>.02,'Night model has non-background pixels');
   await frame.waitForFunction(before=>JSON.stringify(window.sceneCheck.rain.positions)!==before,JSON.stringify(initial.rain.positions));
   await page.screenshot({path:`.tmp/home-weather-review/night-${width}.png`,fullPage:true});
   const slider=page.getByLabel('Tidspunkt for solvisning'),bounds=await slider.boundingBox();
   await page.mouse.click(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
   await page.getByRole('radio',{name:'Sol',exact:true}).click();
  await frame.waitForFunction(()=>window.sceneCheck.sunVisible&&!window.sceneCheck.live&&!window.sceneCheck.rain.visible).catch(async error=>{console.log('Transition diagnostics',JSON.stringify({errors,state:await frame.evaluate(()=>({minute:window.sceneCheck?.minute,live:window.sceneCheck?.live,sun:window.sceneCheck?.sunVisible,rain:window.sceneCheck?.rain.visible}))}));throw error;});
    const daylight=await inspect();if(!terrainMode)assert.ok(daylight.background[2]>daylight.background[0]&&daylight.background[2]>100,'Clear daytime sky is blue');
   assert.ok(await frame.evaluate(()=>window.scenePixels())>.02);
   await page.screenshot({path:`.tmp/home-weather-review/day-${width}.png`,fullPage:true});
   for(const [label,kind]of [['Regn','rain'],['Sne','snow'],['Vind','wind']]){
    await page.getByRole('radio',{name:label,exact:true}).click();
    await frame.waitForFunction(kind=>window.sceneCheck[kind].visible,kind);
    const before=await inspect();
    await frame.waitForFunction(({kind,positions})=>JSON.stringify(window.sceneCheck[kind].positions)!==positions,{kind,positions:JSON.stringify(before[kind].positions)});
    if(width===390)await page.screenshot({path:`.tmp/home-weather-review/${kind}.png`,fullPage:true});
   }
   await page.getByRole('button',{name:'Afspil dagen'}).click();
   const beforePlay=(await inspect()).minute;
   await frame.waitForFunction(minute=>window.sceneCheck.minute>minute+2,beforePlay);
   await page.getByRole('button',{name:'Pause',exact:true}).click();
   await frame.waitForFunction(()=>!window.sceneCheck.playing);
   await page.getByRole('button',{name:'Nu',exact:true}).click();
   await frame.waitForFunction(()=>window.sceneCheck.live&&window.sceneCheck.minute===1395&&window.sceneCheck.rain.visible);
   await page.emulateMedia({reducedMotion:'reduce'});
   await frame.waitForFunction(()=>window.sceneCheck.reducedMotion);
   const reduced=await inspect();
   await frame.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   assert.deepEqual((await inspect()).rain.positions,reduced.rain.positions,'Reduced motion stops particles');
   await page.getByRole('button',{name:'Forbedr huset med ét foto',exact:true}).click();
   await page.getByText('Vælg foto',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Luk billedguide',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
    if(width===390){
    failTexture=true;failWeather=true;failEnvironment=terrainMode;await page.reload();
     await page.getByText('Luftfoto utilgængeligt',{exact:true}).waitFor();
     await page.getByText('Vejrdata mangler',{exact:true}).waitFor();
    if(terrainMode){
    await page.getByText('Omgivelser utilgængelige · viser det nære kortudsnit',{exact:true}).waitFor();failEnvironment=false;missingHeights=true;
    const recoveredFrame=page.waitForEvent('framenavigated',frame=>frame.parentFrame()===page.mainFrame()&&frame.url()==='about:srcdoc');await page.getByRole('button',{name:'Hent omgivelser igen'}).click();
    const recovered=await recoveredFrame;await recovered.waitForFunction(()=>window.environmentCheck?.().mapped&&window.environmentCheck().centralMapped);
     const coverage=await recovered.evaluate(()=>window.environmentCheck());assert.equal(coverage.fallback,true,'Central ground uses wider imagery when close image fails');assert.deepEqual(coverage.repeat,[.125,.125]);assert.deepEqual(coverage.offset,[.4375,.4375],'Fallback UVs retain real geographic position');
     assert.ok(coverage.terrainMapped&&coverage.terrainUsesSameMap,'Detailed parcel TIN uses the same correctly placed fallback');assert.equal(coverage.terrainColors,false,'Vertex colours do not obscure fallback imagery');assert.deepEqual(await recovered.evaluate(()=>window.checkGroundCoverage()),[],'Imagery-only terrain covers all camera corners');
     const fallbackSlider=await page.getByLabel('Tidspunkt for solvisning').boundingBox();await page.mouse.click(fallbackSlider.x+fallbackSlider.width*.5,fallbackSlider.y+fallbackSlider.height*.5);await page.getByRole('radio',{name:'Sol',exact:true}).click();await recovered.waitForFunction(()=>window.sceneCheck.sunVisible);await page.screenshot({path:'.tmp/home-weather-review/imagery-fallback-390.png',fullPage:true});
     failEnvironment=true;await page.getByRole('button',{name:'Hent omgivelser igen'}).click();await page.getByText('Omgivelser kunne ikke opdateres · viser senest indlæste kort',{exact:true}).waitFor();assert.ok((await recovered.evaluate(()=>window.environmentCheck())).centralMapped,'Failed refresh keeps existing textured scene');
    }
     const missingFrame=page.frames().find(item=>item!==page.mainFrame());
     await missingFrame.waitForFunction(()=>window.sceneCheck&&!window.sceneCheck.rain.visible&&!window.sceneCheck.snow.visible&&!window.sceneCheck.wind.visible);
     await page.getByRole('radio',{name:'Sne',exact:true}).click();
     await missingFrame.waitForFunction(()=>window.sceneCheck.snow.visible);
     await missingFrame.evaluate(()=>window.home3d.dispose());
    }else await frame.evaluate(()=>window.home3d.dispose());
   assert.deepEqual(errors,[],'No browser runtime errors');
   await context.close();
  console.log(`PASS ${width}px: live night/rain, daylight, ${terrainMode?'sloped textured neighbourhood, neighbour building, full ground coverage':'local textured ground'}, weather motion, playback, return to live, reduced motion, photo guide and canvas pixels.`);
  }
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
}
