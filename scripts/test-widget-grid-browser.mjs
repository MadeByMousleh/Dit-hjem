// Actual React Native Web cards/drag/editor/hooks, synthetic local preferences only.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { build } = await import(pathToFileURL(resolve(process.argv[2])).href);
const { chromium } = await import(pathToFileURL(resolve(process.argv[3])).href);
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {PinnedElectricityWidgets} from './src/components/ElectricityWidgets';
import {useElectricityWidgets} from './src/hooks/useElectricityWidgets';
const data = {
 priceChart: {value:'1,25 kr./kWh',detail:'Timepriser',now:Date.now(),prices:Array.from({length:96},(_,i)=>({startsAt:new Date(new Date().setHours(0,0,0,0)+i*900000),totalOrePerKwh:50+i%24*8}))},
 latest: {value:'12,4 kWh',detail:'14. oktober',note:'Ca. 24,50 kr.'},
 price: {value:'1,25 kr./kWh',detail:'Kl. 12:00–12:15',note:'Inkl. net og afgifter · ekskl. leverandørtillæg og abonnement'},
 week: {value:'65 kWh',detail:'8. oktober – 14. oktober',note:'Seneste syv komplette dage · ikke liveforbrug'},
 month: {value:'142,8 kWh',detail:'Data til og med 14. oktober',note:'Ca. 250 kr.'},
 cheapest: {value:'14:00–15:00',detail:'15. oktober · ca. 0,75 kr./kWh',note:'Laveste time blandt tilgængelige priser de næste 24 timer · kan indeholde prognose'}
};
function App(){const preferences=useElectricityWidgets('fixture','house'); window.widgetFixture={preferences}; return <div style={{padding:16}}><PinnedElectricityWidgets location={new URLSearchParams(location.search).get('el') ? 'electricity' : 'dashboard'} preferences={preferences} data={data} onManage={()=>{}} onOpen={id=>{window.openedWidget=id}} /></div>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const fixture = `
const ids=['latest','price','week','month','cheapest'];
window.widgetStorage=sessionStorage.getItem('widgetFixture')??JSON.stringify({dashboard:ids,electricity:ids,appearances:{latest:{background:'blue',text:'auto',size:'tiny'},price:{background:'rose',text:'auto',size:'tiny'},week:{background:'default',text:'auto',size:'compact'},cheapest:{background:'navy',text:'white',size:'tiny'}}});
export default {getItem:async()=>window.widgetStorage,setItem:async(_,value)=>{if(window.widgetSaveFails)throw Error('Synthetic storage full');window.widgetStorage=value;sessionStorage.setItem('widgetFixture',value)}};
export const fetchHistoricalPrices=async()=>[];
`;
const bundle = await build({ stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',format:'iife',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'], define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'synthetic-only',setup(b){
  b.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));
  b.onResolve({filter:/^(?:@react-native-async-storage\/async-storage|\.\.\/prices)$/},()=>({path:'fixture',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixture,loader:'js'}));
}}], banner:{js:'var process={env:{NODE_ENV:"production"}};'} });
const html=`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%} @font-face{font-family:Nunito_700Bold;src:url('/bold.ttf')} @font-face{font-family:Nunito_400Regular;src:url('/regular.ttf')}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].contents)}
  if(req.url==='/bold.ttf'||req.url==='/regular.ttf'){res.setHeader('Content-Type','font/ttf');return res.end(await readFile(req.url==='/bold.ttf'?'node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf':'node_modules/@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'))}
  res.setHeader('Content-Type','text/html');res.end(html);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  await mkdir('.tmp/widget-grid-review',{recursive:true});
  for(const width of [320,390,768]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
    await page.goto(origin); await page.getByTestId('electricity-widget-latest').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const card=id=>page.getByTestId('electricity-widget-'+id);
    const a=await card('latest').boundingBox(), b=await card('price').boundingBox(), medium=await card('week').boundingBox(), normal=await card('month').boundingBox(), odd=await card('cheapest').boundingBox();
    assert.ok(Math.abs(a.y-b.y)<1,'Two tiny cards share a row');
    assert.equal(a.height,b.height,'Same-row widgets have exactly equal heights regardless of content');
    assert.ok(b.x>a.x+a.width,'Tiny cards have a column gutter');
    assert.ok(a.width<medium.width*.5 && a.width>medium.width*.45,'Tiny is roughly half width');
    assert.equal(medium.width,normal.width,'Normal/medium remain full-width');
    if(width<712) assert.ok(medium.y>=Math.max(a.y+a.height,b.y+b.height),'Full-width phone row clears both tiny heights');
    else assert.equal(medium.y,a.y,'Wide screens pack additional tiles into the same row');
    assert.equal(odd.width,a.width,'An odd tiny widget does not stretch');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
    await page.getByRole('button',{name:'Rediger widgetlayout',exact:true}).click();
    await page.getByRole('button',{name:'Tilpas Seneste dags forbrug',exact:true}).click();
    await page.getByRole('radio',{name:'Medium widget',exact:true}).click();
    await page.getByRole('button',{name:'Gem tilpasning',exact:true}).click();
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.latest.size==='medium');
    assert.equal((await card('latest').boundingBox()).width,medium.width,'Medium resizes to the same column span as other medium tiles');
    await page.getByRole('button',{name:'Tilpas Seneste dags forbrug',exact:true}).click();
    await page.getByRole('radio',{name:'Mini widget',exact:true}).click();
    await page.getByRole('button',{name:'Gem tilpasning',exact:true}).click();
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.latest.size==='tiny');
    await page.screenshot({path:'.tmp/widget-grid-review/dashboard-'+width+'.png',fullPage:true});
    if(width===390){
      const from=await card('latest').boundingBox(), to=await card('price').boundingBox();
      const y=from.y+from.height*.65;
      await page.mouse.move(from.x+from.width/2,y);await page.mouse.down();await page.waitForTimeout(450);
      await page.mouse.move(to.x+to.width/2,y,{steps:10});await page.mouse.up();
      await page.waitForFunction(()=>window.widgetFixture.preferences.pins.dashboard[0]==='price');
      assert.equal(await page.evaluate(()=>window.openedWidget),undefined,'Long hold does not trigger shortcut');
      await page.screenshot({path:'.tmp/widget-grid-review/reordered-390.png',fullPage:true});
    }
    await page.evaluate(()=>window.widgetFixture.preferences.customize('latest',{background:'blue',text:'auto',size:'tiny',columns:2,rows:8,gridVersion:2}));
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.latest?.rows===8);
    // Restore stable ordering before checking dense multi-row packing.
    await page.evaluate(()=>window.widgetFixture.preferences.reorder('dashboard',['latest','price','week','month','cheapest']));
    await page.waitForFunction(()=>window.widgetFixture.preferences.pins.dashboard[0]==='latest');
    const tall=await card('latest').boundingBox(), upper=await card('price').boundingBox(), lower=await card('cheapest').boundingBox();
    assert.equal(tall.height,upper.height+8+lower.height,'Two short tile heights plus gutter equal one tall tile');
    assert.equal(tall.y,upper.y);
    if(width<712) assert.equal(tall.y+tall.height,lower.y+lower.height);
    await page.screenshot({path:'.tmp/widget-grid-review/spanning-'+width+'.png',fullPage:true});
    await page.reload();await card('latest').waitFor();
    assert.equal((await card('latest').boundingBox()).height,tall.height,'Custom spans survive reload');
    await page.evaluate(()=>window.widgetFixture.preferences.toggle('dashboard','priceChart'));
    await card('priceChart').waitFor();
    assert.equal((await card('priceChart').boundingBox()).height,472,'Large chart spans fine tracks');
    await page.evaluate(()=>window.widgetFixture.preferences.customize('priceChart',{background:'default',text:'auto',size:'medium'}));
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.priceChart?.size==='medium');
    const plotCard=await card('priceChart').boundingBox(), plotButton=await card('priceChart').getByLabel('Vis hele dagen',{exact:true}).boundingBox();
    assert.equal(plotCard.height,392,'Medium chart spans ten fine tracks');
    assert.ok(plotButton.y+plotButton.height<=plotCard.y+plotCard.height,'Chart controls stay inside the fixed tile');
    assert.equal(await page.getByTestId('resize-both-latest').count(),0,'Resize handles hidden in clean viewing mode');
    await page.getByRole('button',{name:'Rediger widgetlayout',exact:true}).click();
    const handle=await page.getByTestId('resize-both-latest').boundingBox();
    await page.mouse.move(handle.x+22,handle.y+22);await page.mouse.down();
    await page.mouse.move(handle.x+122,handle.y+62,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.latest?.columns===3&&window.widgetFixture.preferences.appearances.latest?.rows===9);
    assert.equal(await page.evaluate(()=>window.widgetFixture.preferences.appearances.latest.gridVersion),2);
    assert.equal((await card('latest').boundingBox()).height,352,'Corner resizing snaps one fine row at a time');
    await page.evaluate(()=>{window.widgetSaveFails=true});
    const failHandle=await page.getByTestId('resize-height-latest').boundingBox();
    await page.mouse.move(failHandle.x+22,failHandle.y+22);await page.mouse.down();await page.mouse.move(failHandle.x+22,failHandle.y+102,{steps:6});await page.mouse.up();
    await page.waitForFunction(()=>!!window.widgetFixture.preferences.error);
    assert.equal((await card('latest').boundingBox()).height,352,'Failed save restores the previous size');
    await page.evaluate(()=>{window.widgetSaveFails=false});
    await page.reload();await card('latest').waitFor();
    assert.equal((await card('latest').boundingBox()).height,352,'Dragged size survives reload');
    await page.goto(origin+'/?el=1');await card('latest').waitFor();
    assert.ok(Math.abs((await card('latest').boundingBox()).y-(await card('price').boundingBox()).y)<1,'El also packs two tiny widgets per row');
    await page.evaluate(()=>window.widgetFixture.preferences.toggle('electricity','priceChart'));
    await card('priceChart').waitFor();
    await page.evaluate(()=>window.widgetFixture.preferences.customize('priceChart',{background:'default',text:'auto',size:'normal'}));
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.priceChart?.size==='normal');
    const largeHeight=(await card('priceChart').boundingBox()).height;
    await card('priceChart').getByLabel('Næste dag',{exact:true}).waitFor();
    await page.evaluate(()=>window.widgetFixture.preferences.customize('priceChart',{background:'default',text:'auto',size:'medium'}));
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.priceChart?.size==='medium');
    const mediumHeight=(await card('priceChart').boundingBox()).height;
    assert.ok(mediumHeight<largeHeight,'Medium chart is shorter than large');
    await page.evaluate(()=>window.widgetFixture.preferences.customize('priceChart',{background:'navy',text:'white',size:'tiny'}));
    await page.waitForFunction(()=>window.widgetFixture.preferences.appearances.priceChart?.size==='tiny');
    assert.ok((await card('priceChart').boundingBox()).width<width*.5,'Small chart is half width');
    assert.ok((await card('priceChart').boundingBox()).height<mediumHeight,'Small chart is shorter than medium');
    await card('priceChart').getByRole('button',{name:'Åbn Elprisgraf',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.openedWidget),'priceChart');
    assert.deepEqual(errors,[],'No browser runtime errors');
    await context.close();
  }
  console.log('PASS: real React Native Web grid at 320/390/768px, two-column and mixed/odd rows, size editor/save, horizontal hold/reorder, shortcut suppression, El layout and no runtime errors. Synthetic data/storage; Android touch unverified.');
}finally{await browser?.close();await new Promise(done=>server.close(done))}
