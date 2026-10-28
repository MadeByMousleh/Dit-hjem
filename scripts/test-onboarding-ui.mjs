// Isolated UI test: real onboarding, icons, Lottie and hooks; synthetic accounts/providers only.
// Pass paths to installed esbuild and playwright modules as arguments (no app dependency needed).
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { build } = await import(pathToFileURL(resolve(process.argv[2])).href);
const { chromium } = await import(pathToFileURL(resolve(process.argv[3])).href);
const fixture = `
window.fixture ??= { pending: false, approved: false, beginCalls: 0, statusCalls: 0, heatStatusCalls: 0, profile: null, metadata: {}, finished: false };
const f = window.fixture;
const session = { user: { id: 'synthetic-user', email: 'test@example.invalid', user_metadata: f.metadata } };
export const API_URL = location.origin;
export const useHouseholdSession = () => ({ session });
const vault = { householdId: 'synthetic-household' };
export const useEnergyVault = () => vault;
export const privateMeterStatus = async () => { f.statusCalls++; return { connected: f.approved, pending: f.pending }; };
export const beginThirdPartyMeterConnection = async () => { f.beginCalls++; f.pending = true; return f.approved ? {connected:true} : { authorizationUrl: 'https://eloverblik.dk/synthetic-test' }; };
export const finishThirdPartyMeterConnection = async () => ({ connected: f.approved, pending: !f.approved });
export const privateImportStatus=()=>({running:true,error:'',initialComplete:false,totalDays:365,processedDays:31,percent:8,missingDays:0,lastFrom:'2026-10-01',lastTo:'2026-10-14'});
export const subscribePrivateElectricity=()=>()=>{};
export const hasPrivateHeatingConnection = async () => { f.heatStatusCalls++; return false; };
export const syncHeating = async (_, credentials) => { if (!credentials.username || !credentials.password) throw Error('Missing credentials'); f.heat = true; };
export const getSupabase = async () => ({ auth: { getSession: async () => ({ data: { session } }), updateUser: async ({data}) => { Object.assign(f.metadata, data); return {error:null}; } } });
export const loadProfile = async () => f.profile;
export const saveProfile = async profile => { f.profile = profile; };
export const GRID_SUPPLIERS = [{ id:'radius_c', name:'Radius', area:'DK2' }];
export const fetchGridSuppliers = async () => GRID_SUPPLIERS;
export const searchAddresses = async text => text.length < 3 ? [] : [{ id:'road', text:'Testvej', searchText:'Testvej' }, { id:'unit', kind:'address', text:'Testvej 1, 2. th., 1550 Testby' }];
export const resolveAddress = async id => ({ id, kind:'address', text:'Testvej 1, 2. th., 1550 Testby', x:12.5, y:55.6, municipalityCode:'0101', postcode:'1550' });
`;
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {SafeAreaProvider} from 'react-native-safe-area-context'; import {AccountSetup} from './src/screens/AccountSetup'; createRoot(document.getElementById('root')).render(<SafeAreaProvider><AccountSetup previewMode onFinish={()=>{window.fixture.finished=true}} /></SafeAreaProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', jsx: 'automatic', format: 'iife', mainFields: ['browser','module','main'], resolveExtensions: ['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', global: 'globalThis' }, loader: { '.png':'dataurl' },
  plugins: [{ name:'synthetic-only', setup(b) {
    b.onResolve({filter:/^(react-native)$/}, () => ({ path: resolve('node_modules/react-native-web/dist/index.js') }));
    b.onResolve({filter:/(EnergyVaultGate|useHouseholdSession|private-electricity|private-heating|services\/supabase|\.\/supabase|services\/storage|\.\/storage|\/prices|\/addresses)$/}, () => ({ path:'fixture', namespace:'fixture' }));
    b.onLoad({filter:/.*/,namespace:'fixture'}, () => ({contents:fixture,loader:'js'}));
  } }],
});
const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%} @font-face{font-family:Nunito_700Bold;src:url('/bold.ttf')} @font-face{font-family:Nunito_600SemiBold;src:url('/bold.ttf')} @font-face{font-family:Nunito_500Medium;src:url('/regular.ttf')} @font-face{font-family:Nunito_400Regular;src:url('/regular.ttf')}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const server = createServer(async (req,res) => {
  if (req.url.startsWith('/api/grid/lookup')) { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({name:'Radius',cvr:'3100'})); }
  if (req.url === '/app.js') { res.setHeader('Content-Type','text/javascript'); return res.end(bundle.outputFiles[0].contents); }
  if (req.url === '/bold.ttf' || req.url === '/regular.ttf') { res.setHeader('Content-Type','font/ttf'); return res.end(await readFile(req.url === '/bold.ttf' ? 'node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf' : 'node_modules/@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf')); }
  res.setHeader('Content-Type','text/html'); res.end(html);
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel:'chrome', headless:true });
const errors = [];
await mkdir('.tmp/onboarding-review',{recursive:true});
try {
  const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  for (let i=0;i<3;i++) {
    const name=i===2?'Lad os komme i gang':'Næste';
    await page.getByRole('button',{name,exact:true}).waitFor();
    assert.equal(await page.locator('input').count(),0,'Introduction has no forms');
    assert.equal(await page.getByText('Forbind med MitID',{exact:true}).count(),0,'No provider prompt during introduction');
    assert.equal(await page.evaluate(()=>window.fixture.statusCalls+window.fixture.heatStatusCalls),0,'Provider checks wait until setup');
    const skip=await page.getByRole('button',{name:'Spring introduktion over'}).boundingBox();
    assert.ok(skip && skip.x>195 && skip.y<100,'Skip is at the top right');
    await page.screenshot({path:`.tmp/onboarding-review/intro-feature-${i+1}.png`});
    await page.getByRole('button',{name,exact:true}).click();
  }
  await page.getByRole('button',{name:'Fortsæt',exact:true}).click();
  await page.getByText('Udfyld både fornavn og efternavn.').waitFor();
  await page.getByLabel('Fornavn',{exact:true}).fill('Test'); await page.getByLabel('Efternavn',{exact:true}).fill('Bruger');
  await page.getByRole('button',{name:'Fortsæt',exact:true}).click();
  await page.getByLabel('Søg efter din fulde adresse').fill('Testvej');
  await page.getByText('Testvej 1, 2. th., 1550 Testby',{exact:true}).click();
  await page.getByText('Netselskab: Radius',{exact:false}).waitFor();
  await page.screenshot({path:'.tmp/onboarding-review/02-address-mobile.png'});
  await page.getByRole('button',{name:'Gem mit hjem',exact:true}).click();
  await page.getByText('Forbind med MitID',{exact:true}).waitFor();
  const connectionSkip = page.getByRole('button',{name:'Spring forbindelsen over'});
  assert.equal(await connectionSkip.count(),1,'Only one skip action is rendered');
  assert.ok((await connectionSkip.boundingBox()).y<100,'Connection skip stays in header');
  await page.screenshot({path:'.tmp/onboarding-review/06-electricity-simple.png'});
  const saved = await page.evaluate(()=>window.fixture.profile);
  assert.equal(saved.firstName,'Test'); assert.equal(saved.lastName,'Bruger'); assert.equal(saved.addressId,'unit'); assert.equal(saved.gridSupplierId,'radius_c');
  await page.getByText('Forbind med MitID',{exact:true}).click();
  await page.getByText('Kontrollér godkendelse',{exact:true}).waitFor();
  await page.evaluate(()=>{ window.fixture.approved = true; window.dispatchEvent(new Event('focus')); });
  await page.getByText('Eloverblik er forbundet',{exact:true}).waitFor();
  await page.screenshot({path:'.tmp/onboarding-review/03-electricity-mobile.png'});
  await page.getByRole('button',{name:'Fortsæt',exact:true}).click();
  await page.screenshot({path:'.tmp/onboarding-review/07-heat-simple.png'});
  await page.getByLabel('Kundenummer til Sønderborg Varme').fill('12345'); await page.getByLabel('Kode fra varmeregningen').fill('synthetic');
  await page.getByText('Forbind varme',{exact:true}).click();
  await page.getByText('Sønderborg Varme er forbundet',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Fortsæt',exact:true}).click();
  await page.getByRole('checkbox').click(); await page.getByRole('button',{name:'Åbn mit overblik',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.finished);
  assert.equal(await page.evaluate(()=>window.fixture.metadata.onboarding_do_not_show_again),true);
  for (const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:1000}]) {
    await page.setViewportSize(viewport); await page.reload(); await page.getByRole('button',{name:'Næste',exact:true}).waitFor();
    const box = await page.getByRole('button',{name:'Næste',exact:true}).boundingBox();
    assert.ok(box && box.y+box.height <= viewport.height+1, 'Next button remains within viewport');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await page.screenshot({path:`.tmp/onboarding-review/intro-${viewport.width}x${viewport.height}.png`});
  }
  // Exercise the moving illustration as well as the reduced-motion form flow.
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.bringToFront();
  await page.reload();
  await page.getByRole('button',{name:'Næste',exact:true}).waitFor();
  const artwork = page.locator('img').first();
  const transforms = node => {
    const values = [];
    for(let i=0;node && i<5;i++,node=node.parentElement) values.push(getComputedStyle(node).transform);
    return values.join('|');
  };
  await page.waitForTimeout(650);
  const firstTransform = await artwork.evaluate(transforms);
  await page.waitForTimeout(650);
  assert.notEqual(await artwork.evaluate(transforms),firstTransform,'Hero floats when motion is enabled');
  await page.waitForFunction(()=>{
    // RN Web hides its img and paints the asset on the enclosing image view.
    let node=document.querySelector('img')?.parentElement;
    for(let i=0;node && i<4;i++,node=node.parentElement) if(Number(getComputedStyle(node).opacity)<0.99) return false;
    return true;
  }, null, {timeout:5000});
  await page.screenshot({path:'.tmp/onboarding-review/04-animated-intro.png'});
  await page.getByRole('button',{name:'Spring introduktion over'}).click();
  await page.waitForTimeout(700);
  await page.screenshot({path:'.tmp/onboarding-review/05-animated-name.png'});
  await page.getByLabel('Fornavn',{exact:true}).waitFor();
  await page.waitForTimeout(650);
  assert.ok(await page.getByLabel('Fornavn',{exact:true}).isVisible(),'Form remains accessible after animated transition');
  assert.deepEqual(errors,[]);
  console.log('PASS: three visual intro pages without forms/provider checks, top-right skip, responsive arrow navigation, required profile/address, provider return, heat, completion and reduced/full motion. Synthetic providers only.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
