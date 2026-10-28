import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {publicPricePage} from '../src/services/public-price-page.mjs';
import {midnight,nextDate} from '../public/landing/prices.mjs';
import {createPublicSiteServer} from './preview-public-site.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE??'node_modules/playwright/index.mjs')).href);
let mode='success';const now=Date.parse('2026-10-28T10:00:00Z');
const fixture=(supplierId,day)=>({supplier:{id:supplierId},points:Array.from({length:(midnight(nextDate(day))-midnight(day))/900000},(_,i)=>({startsAt:new Date(midnight(day)+i*900000).toISOString(),totalOrePerKwh:i>=8&&i<12?-20:120+i}))});
const prices=async params=>{if(mode==='error')throw Error('Upstream unavailable');const body=fixture(params.supplierId,'2026-10-28');if(mode!=='missing')body.points.push(...fixture(params.supplierId,'2026-10-29').points);return body;};
const servePricePage=(req,res)=>{const query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);const response={setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this;},send(body){res.end(body);}};return publicPricePage({query},response,{getPrices:prices,now:()=>now});};
const server=await createPublicSiteServer({servePricePage});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??undefined,args:['--no-sandbox'],headless:true});
try{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();
 const response=await page.goto(origin+'/elpriser.html');assert.equal(response.status(),200);const html=await response.text();assert.match(html,/<tr><td>/);assert.equal(await page.locator('#price-table-body tr').count(),96);assert.ok(await page.locator('#price-results').isVisible());assert.match(await page.locator('noscript').textContent(),/Genindlæs/);
 await page.locator('.price-table-wrap summary').click();assert.ok(await page.locator('table').isVisible());
 for(const width of[1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No-JS overflow '+width);}
 await page.locator('#price-area').selectOption('DK2');await page.locator('#price-supplier').selectOption('radius_c');await page.getByRole('button',{name:'I morgen',exact:true}).click();assert.ok(page.url().includes('day=tomorrow'));assert.match(await page.locator('#price-status').textContent(),/Radius/);assert.match(await page.locator('#price-date').textContent(),/29\. oktober/);assert.equal(await page.locator('#price-current').textContent(),'—');
 mode='missing';await page.reload();assert.match(await page.locator('#price-status').textContent(),/endnu ikke/);assert.ok(await page.locator('#price-results').isHidden());
 mode='error';const failure=await page.goto(origin+'/elpriser.html');assert.equal(failure.status(),503);assert.ok(await page.locator('#price-results').isHidden());assert.equal(await page.locator('#price-table-body tr').count(),0);assert.equal(await page.locator('.guide-article').count(),1);
 mode='success';await page.goto(origin+'/elpriser.html');await mkdir('.tmp/huslyg-ssr',{recursive:true});await page.screenshot({path:'.tmp/huslyg-ssr/no-js-320.png',fullPage:true});
 await context.close();
 const enhanced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await enhanced.clock.install({time:new Date(now)});
 await enhanced.route('**/api/grid/lookup?*',async route=>{const url=new URL(route.request().url());if(url.searchParams.get('operation')==='suppliers')return route.fulfill({json:{suppliers:[{id:'n1_c',name:'N1',area:'DK1'},{id:'radius_c',name:'Radius',area:'DK2'},{id:'cerius_c',name:'Cerius',area:'DK2'}]}});return route.fulfill({json:await prices({supplierId:url.searchParams.get('supplierId')})});});
 await enhanced.goto(origin+'/elpriser.html?priceArea=DK2&supplierId=cerius_c&day=tomorrow',{waitUntil:'networkidle'});assert.equal(await enhanced.locator('#price-supplier').inputValue(),'cerius_c');assert.equal(await enhanced.locator('[data-price-day="tomorrow"][aria-pressed=true]').count(),1);assert.match(await enhanced.locator('#price-date').textContent(),/29\. oktober/);assert.equal(await enhanced.locator('#price-table-body tr').count(),96);
 const report={status:'passed',initialHTML:'prices and full accessible table present without JS',noJS:['region/supplier/day GET form','missing tomorrow','503 without stale/sample numbers','320/390/768/1440 layouts'],enhancement:'SSR supplier and day retained during JavaScript refresh',scope:'Local real SSR handler; synthetic price source'};await writeFile('.tmp/huslyg-ssr/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
