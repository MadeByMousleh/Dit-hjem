import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const {chromium}=await import(pathToFileURL(resolve('C:/Users/mbm/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs')).href);
const entry=`import React from'react';import{createRoot}from'react-dom/client';import{DashboardViewStateProvider}from'./src/hooks/useDashboardViewState';import{HeatingPage}from'./src/components/HeatingPage';window.paths={usage:0,temperature:0};createRoot(document.getElementById('root')).render(<DashboardViewStateProvider><HeatingPage/></DashboardViewStateProvider>);`;
const heat=`const readings=Array.from({length:30},(_,i)=>({from:'2026-09-'+String(i+1).padStart(2,'0'),to:'2026-09-'+String(i+1).padStart(2,'0'),kwh:i+1,expectedKwh:20,flowC:65+i/2,returnC:35+i/3}));const heat={histories:[{supplier:'sonderborg-varme',installation:'synthetic',year:'2026',fetchedAt:'2026-10-28T07:00:00Z',readings,summary:{actualKwh:465,expectedYearKwh:1000}}],loading:false,connected:true,error:'',setPassword(){},refresh:async()=>{}};export function useEforsyning(){return heat;}`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',format:'iife',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));
 b.onResolve({filter:/\/useEforsyning$/},()=>({path:'heat',namespace:'fixture'}));
 b.onResolve({filter:/^expo-haptics$/},()=>({path:'haptics',namespace:'fixture'}));
 b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='heat'?heat:a.path==='haptics'?'export const selectionAsync=async()=>{};':`export default {getItem:async()=>null,setItem:async()=>{}};`}));
 b.onLoad({filter:/HeatingUsageCard\.tsx$/},async a=>({loader:'tsx',contents:(await readFile(a.path,'utf8')).replace('const path = useMemo(() => {','const path = useMemo(() => { window.paths.usage++;')}));
 b.onLoad({filter:/HeatingPage\.tsx$/},async a=>({loader:'tsx',contents:(await readFile(a.path,'utf8')).replace('const paths = useMemo(() => {','const paths = useMemo(() => { window.paths.temperature++;')}));
}}]});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].text);}res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:16px"><div id="root"></div><script src="/app.js"></script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByText('Frem- og returtemperatur',{exact:true}).waitFor();await page.getByRole('button',{name:'Dag',exact:true}).first().click();await page.getByRole('button',{name:'Dag',exact:true}).last().click();await page.waitForTimeout(100);
 const before=await page.evaluate(()=>({...paths}));
 for(const pattern of [/^2026-09-\d{2}: brugt /,/^2026-09-\d{2}: fremløb /]){
  const points=page.getByRole('button',{name:pattern});assert.equal(await points.count(),30);
  for(let i=1;i<=10;i++)await points.nth(i).click();
  await page.getByText(/^11\. september/).first().waitFor();
 }
 await page.getByText('11. september 2026',{exact:true}).waitFor();
 const after=await page.evaluate(()=>({...paths}));assert.deepEqual(after,before,'Selecting points must reuse both static paths');assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('.tmp/app-performance',{recursive:true});await page.screenshot({path:'.tmp/app-performance/heating.png',fullPage:true});
 console.log('PASS: actual heat/temperature charts select ten dates each, retain current selection and fit 390px; both paths reuse geometry during selection. Production RN Web, synthetic readings.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
