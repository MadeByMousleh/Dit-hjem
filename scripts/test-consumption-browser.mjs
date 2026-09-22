// Run after expo export. Uses a disposable account and mocked chart responses;
// real database/API isolation is covered by test-consumption-live.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@supabase/server/core';
import { danishDate, expectedIntervals } from '../src/services/consumption-data.mjs';

const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
process.env.VERCEL='1';
const {handler}=await import('../server.mjs');
const root=resolve('dist');
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')) return handler(req,res);
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root && !file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try {
    const path=file===root?resolve(root,'index.html'):file;
    const types={'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.css':'text/css'};
    res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
assert.equal((await fetch(origin+'/api/eloverblik/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
const db=createAdminClient();
const checked=async p=>{const {data,error}=await p;if(error)throw new Error('Browser fixture database failure');return data;};
let userId,householdId,browser,page;
try {
  const email=`dit-hjem-browser-${randomUUID()}@example.invalid`;
  const user=await db.auth.admin.createUser({email,email_confirm:true});
  assert.equal(user.error,null);userId=user.data.user.id;
  const house=await checked(db.from('households').insert({name:'Browser test'}).select('id').single());householdId=house.id;
  await checked(db.from('household_invitations').insert({household_id:householdId,email}));
  browser=await chromium.launch({channel:'msedge',headless:true});
  page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/auth/config')console.log('Auth config request origin: '+url.origin);});
  let requests=0;
  await page.route('**/api/**',async route=>{
    const req=route.request();
    if(req.url().endsWith('/api/eloverblik/usage')) {
      const body=req.postDataJSON();
      assert.equal(body.householdId,householdId);
      assert.ok(req.headers().authorization?.startsWith('Bearer '));
      requests++;
      if(body.view==='background')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({algorithm:'overnight-p05-v1',status:'ready',from:'2026-09-14',to:'2026-09-21',watts:100,dailyKwh:2.4,monthlyKwh:72,validIntervals:56,expectedIntervals:56,nights:7,coverage:1,syncFailed:false})});
      const points=expectedIntervals(body.from,body.to,body.aggregation.toLowerCase()).map(interval=>({at:interval.starts_at,kwh:1,incomplete:false}));
      const year=Number(danishDate().slice(0,4));
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...body,points,totalKwh:points.length,meterCount:1,incomplete:false,availableYears:Array.from({length:6},(_,i)=>year-5+i)})});
    }
    const source=new URL(req.url());
    if(source.pathname!=='/api/auth/config')return route.continue();
    const response=await route.fetch({url:origin+source.pathname});
    return route.fulfill({response});
  });
  await page.goto(origin);
  await page.getByText('Mit hjem',{exact:true}).last().click();
  await page.getByLabel('E-mail',{exact:true}).waitFor();
  assert.equal(await page.getByText('Vis mit elforbrug',{exact:true}).count(),0);
  // generateLink does not send email. Exercise the actual Supabase redirect/session flow.
  const link=await db.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:'http://localhost:8081'}});
  assert.equal(link.error,null);
  const verified=await fetch(link.data.properties.action_link,{redirect:'manual'});
  const location=new URL(verified.headers.get('location'));
  assert.equal(location.origin,'http://localhost:8081');
  assert.ok(location.hash.includes('access_token'));
  // Remap the allowed callback onto this test's ephemeral local port.
  await page.goto('about:blank');
  await page.goto(origin+'/'+location.hash);
  await page.getByText('Mit hjem',{exact:true}).last().click();
  await page.getByText('Ca. 100 W',{exact:true}).waitFor();
  await page.getByLabel('Samlet elpris i kroner pr. kWh',{exact:true}).fill('2,5');
  await page.getByText('Prisoverslag: 6 kr. pr. døgn · 180 kr. på 30 dage',{exact:true}).waitFor();
  await page.getByText('Vis mit elforbrug',{exact:true}).click();
  await page.getByLabel('Vælg periode',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Time',exact:true}).click();
  await page.getByLabel('Vælg periode',{exact:true}).click();
  await page.getByRole('button',{name:'2026',exact:true}).click();
  await page.getByRole('button',{name:'mar.',exact:true}).click();
  await page.getByLabel('2026-03-29',{exact:true}).click();
  await page.getByText('23 kWh',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Dag',exact:true}).click();
  await page.getByLabel('Vælg periode',{exact:true}).click();
  await page.getByRole('button',{name:'feb.',exact:true}).click();
  await page.getByText('28 kWh',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Måned',exact:true}).click();
  await page.getByLabel('Vælg periode',{exact:true}).click();
  await page.getByRole('button',{name:'2025',exact:true}).click();
  await page.getByText('12 kWh',{exact:true}).waitFor();
  await page.getByRole('button',{name:'År',exact:true}).click();
  await page.getByText('6 kWh',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Time',exact:true}).click();
  await page.getByLabel('Vælg periode',{exact:true}).click();
  await page.getByText('Vælg dato',{exact:true}).waitFor();
  await page.getByLabel('Luk datovælger',{exact:true}).click();
  await page.getByText('Log ud',{exact:true}).click();
  await page.getByLabel('E-mail',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Vælg periode',{exact:true}).count(),0);
  assert.equal(await page.getByText('Ca. 100 W',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  assert.ok(requests>=7);
  console.log('PASS: login link/session, invitation claim, authenticated usage requests, calendar, month/year pickers, six-year overview, mobile layout and sign-out clearing.');
} catch(error) {
  if(page) {
    await page.screenshot({path:'.vercel/browser-failure.png',fullPage:true});
    console.log(await page.evaluate(()=>({origin:location.origin,hasAuthFragment:location.hash.includes('access_token'),storedSession:Object.keys(localStorage).some(k=>k.includes('auth-token')),loginText:document.body.innerText.slice(-3000)})));
  }
  throw error;
} finally {
  await browser?.close();
  if(householdId)await checked(db.from('households').delete().eq('id',householdId));
  if(userId)await db.auth.admin.deleteUser(userId);
  await new Promise(r=>server.close(r));
}
