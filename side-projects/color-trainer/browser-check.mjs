// Pass the installed Playwright module path; no new dependency needed.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('browser error:',m.text().slice(0,500));});
  page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});
  // Intercept annotation writes: never alter the user's actual labels.
  let saved;
  await page.route('**/api/task/*/save',async route=>{
    const data=route.request().postDataJSON(),url=route.request().url().replace(/\/save$/,'');
    const original=await (await page.request.get(url)).json();
    saved={...original,revision:data.revision+1,status:data.status,houseColor:data.houseColor,labels:data.houseColor?original.faces.map(f=>({faceId:f.faceId,...data.houseColor})):[]};
    await route.fulfill({json:saved});
  });
  await page.route('**/api/next',async route=>saved?route.fulfill({json:saved}):route.continue());
  await page.goto('http://127.0.0.1:8791');
  await page.getByRole('button',{name:'Find et tilfældigt hus'}).click();
  console.log('House requested');
  await page.waitForFunction(()=>!document.querySelector('#hex').disabled,{},{timeout:180000});
  assert.equal(await page.locator('#face').count(),0);
  await page.locator('#hex').fill('#c4a071');
  await page.getByRole('button',{name:'Anvend på hele huset'}).click();
  assert.equal(await page.locator('#approve').isEnabled(),true);
  await page.getByRole('button',{name:'Gem kladde',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Kladde gemt'));
  const approval=page.waitForResponse(r=>r.url().endsWith('/save')&&r.request().postDataJSON()?.status==='approved');
  await page.getByRole('button',{name:'Godkend og næste hus',exact:true}).click();
  await approval;
  assert.equal(saved.status,'approved');
  assert.equal(saved.labels.length,saved.faces.length);
  assert.ok(saved.labels.every(l=>l.hex==='#c4a071'&&!saved.rejectedFaces?.includes(l.faceId)));
  await page.waitForFunction(()=>!document.querySelector('#next').disabled);
  await page.screenshot({path:'.tmp/color-trainer-browser.png',fullPage:true});
  await page.reload();
  await page.getByRole('button',{name:'Find et tilfældigt hus'}).click();
  await page.waitForFunction(()=>document.querySelector('#hex').value==='#c4a071',{},{timeout:180000});
  assert.equal(await page.locator('#hex').inputValue(),'#c4a071');
  // Writes are intercepted; resetting only changes the in-memory test task.
  await page.getByRole('button',{name:'Gendan forslag'}).click();
  await page.getByRole('button',{name:'Gem kladde',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Kladde gemt'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({wholeHouse:true,approveNext:true,saveReload:true,writes:'intercepted',pageErrors:errors}));
}finally{await browser.close();}
