import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {advance,expectedIntervals} from '../src/services/consumption-data.mjs';
import {daysBetween} from '../src/services/electricity-periods.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',hour:'2-digit',hourCycle:'h23'});
const records=Object.fromEntries(daysBetween('2026-09-01','2026-10-09').map(day=>['hour/'+day,{v:1,day,points:expectedIntervals(day,advance(day,'day'),'hour').map(i=>[(Number(hour.format(new Date(i.starts_at)))===18?4:1)*(new Date(day+'T12:00:00Z').getUTCDay()===4?2:1),false])}]));
records['state/import']={meters:[{id:'synthetic-meter',from:'2026-09-01'}]};
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ElectricityPatternsCard}from'./src/components/ElectricityPatternsCard';function App(){const[key,setKey]=useState(0);window.switchHousehold=()=>{window.patternRecords={};setKey(k=>k+1);};return <div style={{maxWidth:700,margin:'auto'}}><ElectricityPatternsCard key={key} now={Date.UTC(2026,9,9,16)}/></div>}createRoot(document.getElementById('root')).render(<App/>);`;
const fixture=`const vault={loadElectricityRecords:async keys=>{window.recordReads=(window.recordReads??0)+1;return Object.fromEntries(keys.map(k=>[k,window.patternRecords[k]]));},cachedElectricityRecord:k=>window.patternRecords[k]};export const useEnergyVault=()=>vault;export const subscribePrivateElectricity=(_,fn)=>{window.patternListener=fn;return()=>{window.patternListener=null;};};`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',format:'iife',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'saved-record-fixture',setup(b){b.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));b.onResolve({filter:/(?:EnergyVaultGate|private-electricity)$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixture,loader:'js',resolveDir:process.cwd()}));}}],banner:{js:'var process={env:{NODE_ENV:"production"}};'}});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].text);}res.setHeader('Content-Type','text/html');res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#eee"><div id="root"></div><script>window.patternRecords='+JSON.stringify(records)+'</script><script src="/app.js"></script></body></html>');});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});await mkdir('.tmp/electricity-patterns',{recursive:true});
 for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText('Højest dagsforbrug: torsdag.',{exact:true}).waitFor();await page.getByText('Mest strøm kl. 18–19.',{exact:true}).waitFor();
  assert.equal(await page.locator('[aria-label^="Klokken "]').count(),24);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
  await page.screenshot({path:`.tmp/electricity-patterns/profile-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.switchHousehold());await page.getByText('Der er endnu ikke komplette timedata til et forbrugsmønster. Profilen kommer automatisk, når historikken er gemt.',{exact:true}).waitFor();assert.equal(await page.getByText('Højest dagsforbrug: torsdag.',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS actual card + hook at 320/390px: saved-history reads, hour/day peaks, 24 accessible bars, no overflow and household-switch cleanup. Synthetic encrypted-store boundary.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
