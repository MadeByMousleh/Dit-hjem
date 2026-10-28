import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE??'node_modules/playwright/index.mjs')).href);
import {createPublicSiteServer} from './preview-public-site.mjs';
import {publicPricePage} from '../src/services/public-price-page.mjs';
const serverRequests=[];
const servePricePage=(req,res)=>publicPricePage({query:Object.fromEntries(new URL(req.url,'http://localhost').searchParams)},{setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this;},send(body){res.end(body);}},{getPrices:async query=>{const params=new URLSearchParams({operation:'prices',...query});const r=await fetch('https://huslyg.dk/api/grid/lookup?'+params,{signal:AbortSignal.timeout(25000)});serverRequests.push({query:params.toString(),status:r.status});if(!r.ok)throw Error('Live source unavailable');return r.json();}});
const server=await createPublicSiteServer({servePricePage});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??undefined,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/grid/lookup?*',async route=>{const u=new URL(route.request().url());const r=await fetch('https://huslyg.dk'+u.pathname+u.search,{signal:AbortSignal.timeout(25000)});requests.push({query:u.search,status:r.status});return route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});});
 await page.goto(origin+'/elpriser.html');await page.locator('#price-results:visible').waitFor({timeout:35000});assert.ok(await page.locator('#price-table-body tr').count()>=92);assert.match(await page.locator('#price-status').textContent(),/N1/);
 await page.locator('#price-area').selectOption('DK2');await page.waitForFunction(()=>document.querySelector('#price-status').textContent.includes('Radius'),null,{timeout:35000});await page.locator('#price-results:visible').waitFor();
 await page.getByRole('button',{name:'I morgen',exact:true}).click();await page.locator('[data-price-page][aria-busy="false"]').waitFor({timeout:35000});assert.ok(await page.locator('#price-results').isVisible()||/endnu ikke/.test(await page.locator('#price-status').textContent()));
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),fallback=await noJS.newPage();const htmlResponse=await fallback.goto(origin+'/elpriser.html');assert.equal(htmlResponse.status(),200);assert.match(await htmlResponse.text(),/<tr><td>/);assert.ok(await fallback.locator('#price-results').isVisible());assert.ok(await fallback.locator('#price-table-body tr').count()>=92);await noJS.close();
 assert.deepEqual(errors,[]);assert.ok([...requests,...serverRequests].every(r=>r.status===200));console.log(JSON.stringify({status:'passed',scope:'Local SSR handler and enhanced price page with actual production public API responses forwarded unchanged, no synthetic price data; deployed SSR endpoint not exercised',serverRequests,requests,rows:await page.locator('#price-table-body tr').count(),noJavaScript:'initial HTML includes actual current price rows',errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
