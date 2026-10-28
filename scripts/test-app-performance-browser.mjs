import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const baseline=process.argv.includes('--baseline');
const {chromium}=await import(pathToFileURL(resolve('C:/Users/mbm/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs')).href);
const entry=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{DashboardViewStateProvider,useDashboardViewState}from'./src/hooks/useDashboardViewState';
import{ElectricityUsageChart}from'./src/components/ElectricityUsageChart';
window.metrics={renders:0,labels:0,costs:0,geometry:0};
window.historyIO={calls:[],active:0,max:0};
const points=Array.from({length:30},(_,i)=>({at:new Date(Date.UTC(2026,8,i+1,12)).toISOString(),kwh:i+1,incomplete:false}));
const usage={from:'2026-01-01',to:'2026-10-01',points,availableYears:[2026]};const supplier={id:'fixture',area:'DK1',name:'Fixture'};const prices=[];
function Screen(){const state=useDashboardViewState();const[agreements,setAgreements]=useState({records:[]}),[from,setFrom]=useState(usage.from);window.fixture={setFrom,enable:()=>setAgreements({records:[{date_from:'2025-01-01',price_type:'spot',markup_ore:0,subscription_dkk:0}]}),disable:()=>setAgreements({records:[]})};window.metrics.renders++;window.viewState=state;return <ElectricityUsageChart usage={{...usage,from}} aggregation="Day" anchor="2026-09-01" loading={false} load={()=>{}} availableYears={usage.availableYears} agreements={agreements} prices={prices} gridSupplier={supplier}/>;}
createRoot(document.getElementById('root')).render(<DashboardViewStateProvider><Screen/></DashboardViewStateProvider>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',format:'iife',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.mjs','.js','.json'],define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'synthetic-and-counters',setup(b){
 b.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));
 b.onResolve({filter:/\/prices$/},()=>({path:'prices',namespace:'fixture'}));
 b.onResolve({filter:/\/energyCost$/},()=>({path:'cost',namespace:'fixture'}));
 b.onResolve({filter:/\/barScrub$/},()=>({path:'haptics',namespace:'fixture'}));
 b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='prices'?`export async function fetchHistoricalPrices(area,id,from,to){const io=window.historyIO;io.calls.push({area,id,from,to});io.active++;io.max=Math.max(io.max,io.active);try{await new Promise(r=>setTimeout(r,80));if(from.startsWith('2026-01-31'))throw Error('Synthetic missing February');return [{startsAt:new Date(from),totalOrePerKwh:100,gridAndTaxOrePerKwh:20}]}finally{io.active--}}`:a.path==='cost'?'export function estimateEnergyCost(){window.metrics.costs++;return {}}':a.path==='haptics'?'export function tickSelection(){}':`export default {getItem:async()=>null,setItem:async()=>{}};`}));
 b.onLoad({filter:/ElectricityUsageChart\.tsx$/},async a=>({loader:'tsx',contents:(await readFile(a.path,'utf8')).replace('labelFormatters[short ? 1 : 0]!.format','(window.metrics.labels++,labelFormatters[short ? 1 : 0]!).format')}));
 b.onLoad({filter:/InteractiveEnergyChart\.tsx$/},async a=>({loader:'tsx',contents:(await readFile(a.path,'utf8')).replace('const values=props.points','window.metrics.geometry++; const values=props.points')}));
}}]});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].text);}res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:16px"><div id="root"></div><script src="/app.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('svg').last().waitFor();await page.waitForTimeout(350);
 const scroll=await page.evaluate(async()=>{const before=metrics.renders;for(let i=1;i<=20;i++){viewState.rememberScroll('electricity',i*10);await new Promise(requestAnimationFrame);}return {renders:metrics.renders-before,saved:viewState.scrollPositions.electricity};});
 const before=await page.evaluate(()=>({...metrics}));const box=await page.locator('svg').last().boundingBox();assert.ok(box);
 for(let i=1;i<=10;i++){await page.mouse.click(box.x+box.width*(i/12),box.y+box.height*.5);await page.waitForTimeout(30);}
 const after=await page.evaluate(()=>({...metrics}));const selection=Object.fromEntries(Object.keys(after).map(k=>[k,after[k]-before[k]]));
 assert.equal(scroll.saved,200);assert.ok(await page.getByText('Vis total',{exact:true}).count());assert.deepEqual(errors,[]);
 if(!baseline){assert.equal(scroll.renders,0,'Scroll offsets must not render consumers');assert.equal(selection.labels,10,'Only selected labels are formatted during ten selections');assert.equal(selection.costs,0,'No unused cost estimates');assert.equal(selection.geometry,0,'Selection reuses unchanged geometry');}
 let history;
 if(!baseline){
  assert.equal(await page.evaluate(()=>historyIO.calls.length),0,'No agreement means no unused historical-price requests');
  await page.evaluate(()=>fixture.enable());await page.waitForFunction(()=>historyIO.calls.length===9&&historyIO.active===0);
  history=await page.evaluate(()=>({months:historyIO.calls.length,maxConcurrent:historyIO.max}));assert.equal(history.maxConcurrent,3);
  await page.evaluate(()=>fixture.setFrom('2025-01-01'));await page.waitForFunction(()=>historyIO.active===3);await page.evaluate(()=>fixture.disable());await page.waitForFunction(()=>historyIO.active===0);await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>historyIO.calls.length),12,'Leaving a range stops subsequent waves');
 }
 const report={mode:baseline?'before':'after',scroll,selection,history,scope:'Production React Native Web; synthetic data; operation counts, not native FPS'};
 await mkdir('.tmp/app-performance',{recursive:true});await writeFile(`.tmp/app-performance/${report.mode}.json`,JSON.stringify(report,null,2));await page.screenshot({path:`.tmp/app-performance/${report.mode}.png`,fullPage:true});console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
