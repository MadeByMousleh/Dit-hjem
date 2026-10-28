import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createPublicSiteServer} from './preview-public-site.mjs';
import {midnight,nextDate} from '../public/landing/prices.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE??'node_modules/playwright/index.mjs')).href);
const server=await createPublicSiteServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??undefined,headless:true,args:['--no-sandbox']});
const errors=[],failed=[],external=[];let mode='success',fixtureDay='2026-10-28';
const suppliers=[{id:'n1_c',name:'N1 · område 131',area:'DK1'},{id:'radius_c',name:'Radius',area:'DK2'},{id:'cerius_c',name:'Cerius',area:'DK2'}];
const fixture=(supplierId,day)=>({supplier:{id:supplierId},points:Array.from({length:(midnight(nextDate(day))-midnight(day))/900000},(_,i)=>({startsAt:new Date(midnight(day)+i*900000).toISOString(),totalOrePerKwh:(i>=8&&i<12)?-20:120+i}))});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await page.clock.install({time:new Date('2026-10-28T10:00:00Z')});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))failed.push(r.url());});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin){external.push(url.href);return route.abort();}
  if(url.pathname==='/api/grid/lookup'){
   if(url.searchParams.get('operation')==='suppliers')return route.fulfill({json:{suppliers}});
   if(mode==='error')return route.fulfill({status:503,json:{error:'Unavailable'}});
   const id=url.searchParams.get('supplierId');let payload=fixture(id,fixtureDay);if(mode==='tomorrow')payload.points.push(...fixture(id,nextDate(fixtureDay)).points);if(mode==='gap')payload.points.splice(4,1);
   return route.fulfill({json:payload});
  }return route.continue();
 });
 await mkdir('.tmp/huslyg-guides',{recursive:true});
 const paths=['/','/elpriser.html','/app-elpriser-forbrug.html','/elforbrug-eloverblik.html','/varmeforbrug.html'];
 for(const path of paths){
  await page.goto(origin+path,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://huslyg.dk'+path);
  const schemas=[];for(const text of await page.locator('script[type="application/ld+json"]').allTextContents())schemas.push(JSON.parse(text));
  if(path!=='/'){assert.ok(schemas.some(s=>s['@type']==='BreadcrumbList'));assert.equal(await page.locator('.guide-questions details').count(),4);const fragments=await page.locator('.guide-contents a').evaluateAll(nodes=>nodes.map(n=>n.hash));for(const fragment of fragments)assert.equal(await page.locator(fragment).count(),1);await page.locator('.guide-questions summary').first().click();assert.ok(await page.locator('.guide-questions details').first().getAttribute('open')!==null);}
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+' overflow '+width);await page.screenshot({path:'.tmp/huslyg-guides/'+(path==='/'?'home':path.slice(1,-5))+'-'+width+'.png',fullPage:true});}
  await page.getByRole('button',{name:'Åbn menu',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Åbn menu',exact:true}).getAttribute('aria-expanded'),'false');
  const links=await page.locator('a[href^="/"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));for(const href of new Set(links)){const target=new URL(href,origin);const response=await page.request.get(target.href);assert.equal(response.status(),200,href);}
 }
 await page.goto(origin+'/elpriser.html',{waitUntil:'networkidle'});await page.locator('#price-results:visible').waitFor();assert.equal(await page.locator('#price-table-body tr').count(),96);assert.match(await page.locator('#price-cheapest').textContent(),/-0,20/);
 await page.locator('#price-area').selectOption('DK2');await page.waitForFunction(()=>document.querySelector('#price-status').textContent.includes('Radius'));assert.equal(await page.locator('#price-supplier').inputValue(),'radius_c');
 await page.locator('#price-supplier').selectOption('cerius_c');await page.waitForFunction(()=>document.querySelector('#price-status').textContent.includes('Cerius'));
 await page.getByRole('button',{name:'I morgen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#price-status').textContent.includes('endnu ikke'));assert.ok(await page.locator('#price-results').isHidden());
 mode='tomorrow';await page.getByRole('button',{name:'Prøv igen',exact:true}).click();await page.locator('#price-results:visible').waitFor();assert.equal(await page.locator('#price-current').textContent(),'—');assert.equal(await page.locator('#price-table-body tr').count(),96);
 mode='error';await page.getByRole('button',{name:'I dag',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#price-status').textContent.includes('utilgængelige'));assert.ok(await page.locator('#price-results').isHidden());
 mode='gap';await page.getByRole('button',{name:'Prøv igen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#price-status').textContent.includes('ufuldstændige'));assert.ok(await page.locator('#price-results').isHidden());
 mode='success';await page.getByRole('button',{name:'Prøv igen',exact:true}).click();await page.locator('#price-results:visible').waitFor();await page.getByText('Se alle kvarterspriser som tabel',{exact:true}).click();assert.ok(await page.locator('table').isVisible());
 fixtureDay='2026-10-25';await page.clock.setFixedTime(new Date('2026-10-25T10:00:00Z'));await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#price-table-body tr').count(),100);const repeated=await page.locator('#price-table-body').textContent();assert.ok(repeated.includes('GMT+2'));assert.ok(repeated.includes('GMT+1'));
 fixtureDay='2026-03-29';await page.clock.setFixedTime(new Date('2026-03-29T10:00:00Z'));await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#price-table-body tr').count(),92);
 // Headless fixtures use an injected date and mock only public API responses.
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJS.newPage();await fallback.goto(origin+'/elpriser.html');assert.ok(await fallback.locator('noscript').isVisible());assert.ok(await fallback.locator('.guide-article h2').count()>=5);assert.ok(await fallback.locator('#price-results').isHidden());await noJS.close();
 const sitemap=await page.request.get(origin+'/sitemap.xml');assert.equal(sitemap.status(),200);const xml=await sitemap.text();for(const path of paths)assert.ok(xml.includes('https://huslyg.dk'+path));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
 const report={status:'passed',pages:paths,widths:[1440,768,390,320],priceChecks:['DK1/DK2 and supplier changes','today/tomorrow','negative prices','missing tomorrow','upstream failure clears stale data','gap rejection','retry','accessible table','no-JavaScript editorial fallback'],errors,failed,external,scope:'Local static assembly with synthetic public price API; live API and full legacy-APK build not verified'};
 await writeFile('.tmp/huslyg-guides/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
