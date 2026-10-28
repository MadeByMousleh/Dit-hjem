import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPublicSiteServer} from './preview-public-site.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE??'C:/Users/mbm/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs')).href);
const server=await createPublicSiteServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let browser;
try{
 const files=await readdir('web-build/huslyg-public');assert.ok(!files.includes('_expo'),'Public build contains no application bundle');
 const native=await readFile('App.tsx','utf8');assert.ok(native.includes('./src/screens/AppScreen'),'Native entry is retained');
 const html=await readFile('web-build/huslyg-public/index.html','utf8');assert.ok(!/_expo|AppScreen|supabase|auth\/config/i.test(html));
 const config=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(config.crons.length,5);assert.ok(config.rewrites.some(r=>r.source==='/callback'&&r.destination==='/api/tesla/callback'));
 for(const path of ['/downloads/Stromblik.apk','/family.html','/eloverblik/return.html','/kontakt.html','/slet-konto.html','/.well-known/appspecific/com.tesla.3p.public-key.pem']){const response=await fetch(origin+path,{method:'HEAD'});assert.equal(response.status,200,path);if(path.endsWith('.apk'))assert.equal(Number(response.headers.get('content-length')),86167075);}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],external=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();external.push(r.request().url());return r.abort();});
 await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('input[type=password],input[type=email]').count(),0);assert.equal(await page.getByRole('link',{name:/log ind/i}).count(),0);
 await mkdir('.tmp/huslyg-landing',{recursive:true});
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.tmp/huslyg-landing/site-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal overflow at ${width}`);}
 await page.getByRole('button',{name:'Åbn menu',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Luk menu',exact:true}).getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Åbn menu',exact:true}).getAttribute('aria-expanded'),'false');
 await page.getByRole('button',{name:'Åbn menu',exact:true}).click();await page.getByRole('navigation',{name:'Hovedmenu'}).getByRole('link',{name:'Spørgsmål',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Åbn menu',exact:true}).getAttribute('aria-expanded'),'false');
 const faq=page.locator('details').filter({hasText:'Kan jeg bruge Huslyg her på hjemmesiden?'});await faq.locator('summary').click();await faq.getByText(/Dit personlige overblik findes i appen/).waitFor();
 const downloads=JSON.parse(await readFile('public/landing/downloads.json','utf8'));
 for(const [key,title] of [['appStore','App Store'],['googlePlay','Google Play']]){
  if(downloads[key])assert.equal(await page.getByRole('link',{name:'Hent Huslyg i '+title,exact:true}).getAttribute('href'),new URL(downloads[key]).href);
  else {assert.equal(await page.locator('.store-badge.is-pending').filter({hasText:title}).count(),1);assert.equal(await page.getByRole('link',{name:'Hent Huslyg i '+title,exact:true}).count(),0);}
 }
 assert.equal(await page.locator('a[href$=".apk"]').count(),0,'Landing uses app stores, not direct APK download');
 const anchors=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(link=>link.getAttribute('href').slice(1)));for(const id of anchors)assert.ok(await page.locator(`[id="${id}"]`).count(),`Anchor ${id}`);
 await page.setViewportSize({width:1440,height:1000});for(const route of ['/login','/dashboard','/app','/profile','/onboarding']){await page.goto(origin+route);assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('input[type=password]').count(),0);}
 await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>{document.documentElement.style.fontSize='125%';});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
 const report={status:'passed',widths:[1440,768,390,320],externalRequests:external,consoleErrors:errors,publicAppBundle:false,legacyRoutes:'redirect to landing page',stores:{appStore:downloads.appStore?'configured':'link pending',googlePlay:downloads.googlePlay?'configured':'link pending'},preserved:'legacy APK/family/native callbacks/contact/deletion/Tesla key; production APIs not exercised',scope:'local production static output, not a deployment'};await writeFile('.tmp/huslyg-landing/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
