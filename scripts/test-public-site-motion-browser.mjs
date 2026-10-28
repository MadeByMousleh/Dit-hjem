import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPublicSiteServer} from './preview-public-site.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE??'C:/Users/mbm/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs')).href);
const live=process.argv.includes('--live');let server;
if(!live){server=await createPublicSiteServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const origin=live?'https://huslyg.dk':`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),errors=[],external=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();external.push(r.request().url());return r.abort();});
 await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.querySelector('.hero-art').dataset.inView==='true');
 assert.equal(await page.locator('svg.house-illustration .scene-tree').count(),2,'Both trees animate within the actual SVG');
 assert.equal(await page.locator('.scene-turbine').count(),2);assert.equal(await page.locator('.scene-solar-panels rect').count(),8);assert.equal(await page.locator('.scene-electric-car').count(),1);assert.equal(await page.locator('.scene-electric-grid').count(),1);assert.equal(await page.locator('.scene-district-heating').count(),1);
 const rotor=page.locator('.turbine-rotor-one'),flow=page.locator('.heat-supply-flow');
 const rotorStart=await rotor.evaluate(e=>getComputedStyle(e).transform),flowStart=await flow.evaluate(e=>getComputedStyle(e).strokeDashoffset);await page.waitForTimeout(200);
 assert.notEqual(await rotor.evaluate(e=>getComputedStyle(e).transform),rotorStart,'Wind turbine actually rotates');assert.notEqual(await flow.evaluate(e=>getComputedStyle(e).strokeDashoffset),flowStart,'District heating has visible flow animation');
 assert.equal(await page.locator('.heat-return-flow').evaluate(e=>getComputedStyle(e).animationDirection),'reverse','Return water runs opposite to supply');
 const tree=page.locator('.scene-tree-left'),treeTransform=()=>tree.evaluate(e=>getComputedStyle(e).transform);
 const first=await treeTransform();await page.waitForTimeout(300);assert.notEqual(await treeTransform(),first,'Tree actually moves');
 const sun=await page.locator('.art-sun').evaluate(e=>getComputedStyle(e).translate);await page.waitForTimeout(200);assert.notEqual(await page.locator('.art-sun').evaluate(e=>getComputedStyle(e).translate),sun,'Sun actually moves');
 assert.equal(await page.locator('.art-sun').evaluate(e=>getComputedStyle(e,'::before').animationPlayState),'running');
 await page.getByRole('button',{name:'Pause bevægelse',exact:true}).click();assert.equal(await tree.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 assert.equal(await rotor.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');assert.equal(await flow.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 const stopped=await treeTransform();await page.waitForTimeout(200);assert.equal(await treeTransform(),stopped,'Pause freezes scene');
 await page.getByRole('button',{name:'Start bevægelse',exact:true}).click();assert.equal(await tree.evaluate(e=>getComputedStyle(e).animationPlayState),'running');
 // Emulate document visibility notifications without relying on headless-tab policy.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await tree.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await tree.evaluate(e=>getComputedStyle(e).animationPlayState),'running');
 await page.reload({waitUntil:'networkidle'});
 const target=page.locator('.steps article').first();assert.ok(await target.evaluate(e=>e.classList.contains('reveal-pending')),'Below-fold elements wait for visibility');
 await target.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.steps article').classList.contains('is-revealed'));
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.steps article')).opacity==='1');
 await page.waitForFunction(()=>document.querySelector('.hero-art').dataset.inView==='false');assert.equal(await tree.evaluate(e=>getComputedStyle(e).animationPlayState),'paused','Offscreen scene is paused');
 assert.equal(await rotor.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');assert.equal(await flow.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.hero-art').dataset.inView==='true');
 await mkdir('.tmp/huslyg-motion',{recursive:true});await page.screenshot({path:`.tmp/huslyg-motion/${live?'live':'local'}-desktop.png`});
 for(const width of [390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);await page.locator('.hero-art').scrollIntoViewIfNeeded();await page.screenshot({path:`.tmp/huslyg-motion/${live?'live':'local'}-${width}.png`});}
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.documentElement.dataset.motion==='paused');assert.equal(await page.locator('.motion-toggle').isVisible(),false);assert.equal(await tree.evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.reveal-pending').count(),0,'Reduced motion reveals all content');
 assert.equal(await rotor.evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await flow.evaluate(e=>getComputedStyle(e).display),'none');
 const fallback=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:900},reducedMotion:'no-preference'});await fallback.goto(origin,{waitUntil:'networkidle'});assert.equal(await fallback.locator('.reveal-pending').count(),0);assert.equal(await fallback.locator('.steps article').first().evaluate(e=>getComputedStyle(e).opacity),'1');assert.equal(await fallback.locator('.motion-toggle').isVisible(),false);await fallback.close();
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
 const report={origin,scope:live?'live public website':'local static production build',treeAndSunMove:true,windTurbinesRotate:true,solarPanelsAndElectricCar:true,incomingPowerAndDistrictHeating:true,oppositeHeatingFlows:true,pauseAndResume:true,offscreenPause:true,simulatedHiddenTabPause:true,scrollReveals:true,reducedMotion:true,noJavaScriptFallback:true,mobileWidths:[390,320],errors,failed,external};await writeFile(`.tmp/huslyg-motion/${live?'live':'local'}-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
