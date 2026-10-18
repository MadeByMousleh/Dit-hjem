import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { build } = await import(pathToFileURL(process.argv[2]).href);
const { chromium } = await import(pathToFileURL(process.argv[3]).href);
const entry = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SmartThingsPage} from './src/components/SmartThingsPage';
const p='signalahead13665.ovenprogramsv2',o='signalahead13665.applianceoperationstatesv2';
const programs=['Cooking_Oven_Program_HeatingMode_HotAir','Cooking_Oven_Program_HeatingMode_KeepWarm'];
const oven={id:'oven',label:'Ovn',model:'HBG9742B1S',manufacturer:'Bosch',health:'ONLINE',components:[{id:'main',label:'main',capabilities:['switch',p,'signalahead13665.startstopprogramv2']}],status:{main:{switch:{switch:{value:'off'}},[p]:{program:{value:programs[0]},availablePrograms:{value:programs}},[o]:{operationState:{value:'Ready'}}}}};
window.fixtureCommands=[];
function App(){const[devices,setDevices]=useState([oven]);const connection={user:'synthetic',connected:true,devices,loading:false,connecting:false,pending:'',error:'',notice:'',truncated:false,connect:async()=>{},disconnect:async()=>{},refresh:async()=>{},setProgram:async(id,c,cap,program)=>{window.fixtureCommands.push(['program',program]);setDevices(prior=>prior.map(d=>({...d,status:{main:{...d.status.main,[p]:{...d.status.main[p],program:{value:program}}}}})));},setSwitch:async(id,c,command)=>{window.fixtureCommands.push(['switch',command]);setDevices(prior=>prior.map(d=>({...d,status:{main:{...d.status.main,switch:{switch:{value:command}}}}})));},startProgram:async()=>{window.fixtureCommands.push(['start']);}};return <div style={{padding:16,maxWidth:640,margin:'auto'}}><SmartThingsPage connection={connection}/></div>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const result = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', mainFields: ['browser','module','main'], resolveExtensions: ['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'], define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', global: 'globalThis' }, plugins: [{ name: 'native-web', setup(b) { b.onResolve({ filter: /^react-native$/ }, () => ({ path: resolve('node_modules/react-native-web/dist/index.js') })); } }] });
const server = createServer(async (req,res) => {
  if (req.url === '/regular.ttf' || req.url === '/bold.ttf' || req.url === '/semibold.ttf') {
    const font = req.url === '/regular.ttf' ? '400Regular/Nunito_400Regular' : req.url === '/bold.ttf' ? '700Bold/Nunito_700Bold' : '600SemiBold/Nunito_600SemiBold';
    res.setHeader('Content-Type','font/ttf'); return res.end(await readFile(`node_modules/@expo-google-fonts/nunito/${font}.ttf`));
  }
  if(req.url === '/app.js') {res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);} else {res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Nunito_400Regular;src:url(/regular.ttf)}@font-face{font-family:Nunito_700Bold;src:url(/bold.ttf)}@font-face{font-family:Nunito_600SemiBold;src:url(/semibold.ttf)}</style></head><body style="margin:0;background:#F5F5F2"><div id="root"></div><script src="/app.js"></script></body></html>');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin);
  await page.getByRole('button',{name:'Åbn Ovn',exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.getByRole('button',{name:'Åbn Ovn',exact:true}).innerText(),/Est\. 0,6–1,5 kWh/);
  assert.equal(await page.getByRole('button',{name:'Start program',exact:true}).count(),0);
  await mkdir('.tmp/smartthings-ui-review',{recursive:true});
  await page.screenshot({path:'.tmp/smartthings-ui-review/cards.png',fullPage:true});
  await page.getByRole('button',{name:'Åbn Ovn',exact:true}).click();
  await page.getByRole('radio',{name:'Varmholdning',exact:true}).click();
  assert.match(await page.locator('body').innerText(),/0,1–0,4 kWh/);
  assert.equal(await page.getByRole('button',{name:'Start program',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Vælg program',exact:true}).click();
  await page.getByRole('button',{name:'Tænd Ovn',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Start program',exact:true}).isDisabled(),false);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Start program',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.fixtureCommands),[['program','Cooking_Oven_Program_HeatingMode_KeepWarm'],['switch','on'],['start']]);
  await page.screenshot({path:'.tmp/smartthings-ui-review/detail.png',fullPage:true});
  await page.getByRole('button',{name:'Luk apparat',exact:true}).click();
  await page.getByRole('button',{name:'Åbn Ovn',exact:true}).waitFor();
  for(const width of [320,768]) {await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.deepEqual(errors,[]);
  console.log('PASS: real JSX/mobile browser cards, detail modal, program selection, estimate/period updates, provider-confirmed selection, switch/start sequencing, dialog, close, 320/390/768 widths. Synthetic API only; no physical commands.');
} finally {await browser?.close();await new Promise(done=>server.close(done));}
