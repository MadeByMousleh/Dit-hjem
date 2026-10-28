import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import {validateFloorPlan} from '../src/services/property-documents-server.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const addressId='33333333-3333-3333-3333-333333333333',householdId='22222222-2222-2222-2222-222222222222';
const fixture=`
import React from 'react';
export const API_URL='';
export const getSupabase=async()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}});
export const useHouseholdSession=()=>({householdId:'${householdId}',session:{user:{id:'fixture',email:'fixture@example.invalid'}}});
export const loadProfile=async()=>({address:'Testvej 1',addressId:'${addressId}',addressX:10,addressY:55});
export const AppIcon=()=>null;
export const HomePhotoGallery=()=>React.createElement('div',null,'Boligens billeder');
export const getHouseLidarModel=()=>null;
export const getCachedPhoto=async()=>'';export const photoCacheKey=()=>'';
export const geometry={addressId:'${addressId}',bbox:[500000,6100000,500024,6100024],point:[500012,6100012],parcels:[{id:'secret-parcel-id',number:'12a',registeredArea:700,polygons:[[[[500001,6100001],[500023,6100001],[500023,6100023],[500001,6100023],[500001,6100001]]]]}],buildings:[{id:'building',main:true,rings:[[[500004,6100004],[500020,6100004],[500020,6100020],[500004,6100020],[500004,6100004]]],roofMaterial:{label:'Tegl'}}],source:'Synthetic',notice:'Synthetic',warnings:[]};
export const homeInsight=async(mode)=>mode==='geometry'?geometry:{addressId:'${addressId}',bbox:geometry.bbox,width:60,height:60,terrain:Array(3600).fill(0),surface:Array.from({length:3600},(_,i)=>6+((i%60+.5)*.4)*.5)};
export const randomUUID=()=>crypto.randomUUID();
export const getDocumentAsync=()=>new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.onchange=()=>{const file=input.files[0];resolve({canceled:false,assets:[{file,name:file.name,mimeType:file.type,size:file.size,uri:URL.createObjectURL(file)}]});input.remove();};document.body.append(input);input.click();});
export const isAvailableAsync=async()=>false;
export const shareAsync=async()=>{};
export const cacheDirectory=null;export const EncodingType={Base64:'base64'};
export const readAsStringAsync=async()=>{throw Error('Native-only fixture');};
export const writeAsStringAsync=readAsStringAsync;export const deleteAsync=async()=>{};export const getInfoAsync=async()=>({exists:false});
`;
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{SafeAreaProvider}from'react-native-safe-area-context';import{HomePropertyPage}from'./src/components/HomePropertyPage';createRoot(document.getElementById('root')).render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:850},insets:{top:0,left:0,right:0,bottom:0}}}><HomePropertyPage address="Testvej 1" selected onBack={()=>{}} navigation={null}/></SafeAreaProvider>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',format:'iife',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.web.js','.tsx','.ts','.js','.json'],define:{'process.env.NODE_ENV':'"production"',__DEV__:'false',global:'globalThis'},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^react-native$/},()=>({path:resolve('node_modules/react-native-web/dist/index.js')}));
 b.onResolve({filter:/^(?:expo-crypto|expo-document-picker|expo-sharing|expo-file-system\/legacy|.*\/(?:useHouseholdSession|storage|supabase|home-insights|homeLidarModel|home-photo-cache|AppIcon|HomePhotoGallery))$/},()=>({path:'fixture',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixture,loader:'js',resolveDir:process.cwd()}));
}}],banner:{js:'var process={env:{NODE_ENV:"production"}};'}});
const fields=(values)=>Object.entries(values).map(([key,value])=>({key,value,label:key}));
const property={addressId,fetchedAt:new Date().toISOString(),sections:[{title:'Din bolig / enhed',records:[{id:'unit',fields:fields({enh027:'140',enh031:'5',enh066:'2',enh065:'2'})}]},{title:'Bygningen',records:[{id:'building',fields:fields({byg026:'1987',byg054:'1',byg032:'1',byg056:'1'})}]}]};
const documents=new Map();let uploads=0;
const server=createServer(async(req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url.startsWith('/api/address/search')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(property));}
 if(req.url==='/api/energy/vault'){
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.householdId,householdId);assert.equal(body.addressId,addressId);assert.equal(req.headers.authorization,'Bearer synthetic');
  let result={};
  if(body.action==='list')result={documents:[...documents.values()].map(({payload,...meta})=>meta)};
  if(body.action==='save'){validateFloorPlan(body);uploads++;documents.set(body.id,{id:body.id,name:body.name,mime:body.mime,payload:body.payload,revision:1,updated_at:new Date().toISOString()});result={revision:1};}
  if(body.action==='read')result={document:documents.get(body.id)};
  if(body.action==='delete'){documents.delete(body.id);result={revision:2};}
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
 }
 res.setHeader('Content-Type','text/html');res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:390,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://127.0.0.1:${server.address().port}`);await p.getByText('140 m²',{exact:true}).waitFor();
 assert.deepEqual(await p.getByRole('tab').allTextContents(),['Overblik','Boligen','Tag','Matrikel','Plantegning']);assert.equal(await p.getByText('Koordinater',{exact:false}).count(),0);
 await p.getByRole('tab',{name:'Boligen',exact:true}).click();await p.getByText('Mursten',{exact:true}).waitFor();
 await p.getByRole('tab',{name:'Tag',exact:true}).click();await p.getByText('Ca. 285 m²',{exact:true}).waitFor();
 await p.getByRole('tab',{name:'Matrikel',exact:true}).click();await p.getByText('Matrikel 12a',{exact:true}).waitFor();assert.equal(await p.getByText('secret-parcel-id',{exact:false}).count(),0);
 await p.getByRole('tab',{name:'Plantegning',exact:true}).click();await p.getByText('Du har endnu ikke gemt en plantegning.',{exact:true}).waitFor();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Upload plantegning',exact:true}).click();await(await chooser).setFiles({name:'Stueplan.png',mimeType:'image/png',buffer:png});await p.getByText('Stueplan.png',{exact:true}).waitFor();assert.equal(uploads,1);
 await p.getByRole('button',{name:'Stueplan.png',exact:false}).click();await p.getByText('Luk visning',{exact:true}).waitFor();
 await p.reload();await p.getByRole('tab',{name:'Plantegning',exact:true}).click();await p.getByText('Stueplan.png',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Slet',exact:true}).click();await p.getByText('Ja, slet',{exact:true}).click();await p.getByText('Du har endnu ikke gemt en plantegning.',{exact:true}).waitFor();
 await mkdir('.tmp/home-simple-review',{recursive:true});await p.screenshot({path:'.tmp/home-simple-review/floorplan-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS actual page: five simple tabs, overview, roof area, parcel without IDs, upload/preview/reload/delete. Synthetic API and browser file picker; native dialogs not tested.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
