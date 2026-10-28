import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2]??'C:/Users/mbm/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs')).href);
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{ElectricityDailyCurve}from'./src/components/ElectricityDailyCurve';const hours=Array.from({length:24},(_,index)=>({index,totalKwh:0,samples:30,averageKwh:index>=17&&index<=19?4:1}));createRoot(document.getElementById('root')).render(<div style={{padding:18,background:'white'}}><ElectricityDailyCurve hours={hours}/></div>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',format:'iife',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));b.onResolve({filter:/barScrub$/},()=>({path:'haptics',namespace:'fixture'}));b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='haptics'?'export function tickSelection(){window.haptics=(window.haptics??0)+1;}':`export default {getItem:async k=>sessionStorage.getItem(k),setItem:async(k,v)=>sessionStorage.setItem(k,v)};`,loader:'js'}));}}]});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].text);}res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByText(/17.*20/).waitFor();assert.equal(await page.getByRole('button').count(),0,'No graph switching controls');
 const circle=page.locator('circle').last();const bounds=await circle.boundingBox();assert.ok(bounds);await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(80,bounds.y+bounds.height/2,{steps:12});await page.mouse.up();assert.ok((await page.evaluate(()=>window.haptics))>=2,'drag produces selection haptics');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await mkdir('.tmp/chart-interactions',{recursive:true});await page.screenshot({path:'.tmp/chart-interactions/fixed-line.png',fullPage:true});console.log('PASS: fixed curve, no graph controls, 3-hour peak, pointer drag, haptic triggers and mobile width');

}finally{await browser?.close();await new Promise(r=>server.close(r));}
