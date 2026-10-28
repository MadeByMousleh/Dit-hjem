import {readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function playwrightModule(){
 if(process.env.COLOR_AUTOTRAIN_PLAYWRIGHT)return import(pathToFileURL(resolve(process.env.COLOR_AUTOTRAIN_PLAYWRIGHT)).href);
 try{return await import('playwright');}catch{}
 const cache=resolve(process.env.LOCALAPPDATA??'.','npm-cache/_npx');
 for(const name of await readdir(cache)){const file=resolve(cache,name,'node_modules/playwright/index.mjs');try{await access(file);return await import(pathToFileURL(file).href);}catch{}}
 throw Error('Den lokale Playwright-browser kunne ikke findes.');
}
export async function renderPatches(origin,{houseId}={}){
 const {chromium}=await playwrightModule(),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:900,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/render'+(houseId?'?house='+encodeURIComponent(houseId):''));
  await page.waitForFunction(()=>window.messages?.some(m=>m.type==='trainer-patches'||m.type==='error'),null,{timeout:120000});
  const result=await page.evaluate(()=>window.messages.find(m=>m.type==='trainer-patches'||m.type==='error'));
  if(errors.length||result.type==='error')throw Error('Facadeanalysen i browseren fejlede.');
  return result.patches;
 }finally{await browser.close();}
}
