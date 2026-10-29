import {cp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderStoreButtons} from './lib/public-site-downloads.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'web-build','huslyg-public');
// This is an owned output directory, never dist/ (which contains native APKs).
if(!output.startsWith(resolve(root,'web-build')+sep))throw Error('Unsafe public-site output path');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(resolve(root,'public'),output,{recursive:true});
// The canonical price URL is server-rendered by the existing grid function.
// Do not let a static file shadow its Vercel rewrite. The source template stays bundled.
await rm(resolve(output,'elpriser.html'),{force:true});
const downloads=JSON.parse(await readFile(resolve(root,'public','landing','downloads.json'),'utf8'));
const illustration=await readFile(resolve(root,'public','landing','house.svg'),'utf8');
const html=(await readFile(resolve(root,'public','landing.html'),'utf8'))
 .replace(/<!-- HUSLYG_STORE_BUTTONS -->[\s\S]*?<!-- \/HUSLYG_STORE_BUTTONS -->/,renderStoreButtons(downloads))
 .replace(/<img class="house-illustration"[^>]*>/,illustration);
await writeFile(resolve(output,'index.html'),html);
await writeFile(resolve(output,'landing.html'),html);
await writeFile(resolve(output,'404.html'),'<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Siden findes ikke · Huslyg</title><body style="font:18px/1.7 system-ui;background:#FAFAF7;color:#192944;padding:10vw"><h1>Tilbage til overblikket.</h1><p>Denne side findes ikke. Dit personlige Huslyg-overblik finder du i appen.</p><a href="/">Gå til Huslygs forside →</a></body></html>');

// Preserve the already-public download exactly. This does not publish a new
// native version or turn a local test APK into the public download implicitly.
const expected='c3e7008933e81456c4b8854c7d073c61879e728dfa6060225bb8764a33185f8a';
const destination=resolve(output,'downloads','Stromblik.apk');
let apk;
for(const candidate of [resolve(root,'public','downloads','Stromblik.apk'),resolve(root,'dist','Stromblik-1.0.119.apk')]){
 try{if((await stat(candidate)).isFile()){apk=await readFile(candidate);break;}}catch(error){if(error.code!=='ENOENT')throw error;}
}
if(!apk){
 const response=await fetch('https://huslyg.dk/downloads/Stromblik.apk',{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('Existing public Android download is unavailable; refusing to remove it from the site');
 apk=Buffer.from(await response.arrayBuffer());
}
const hash=createHash('sha256').update(apk).digest('hex');
if(hash!==expected)throw Error('Public APK differs from the verified existing release; review the download before building');
await mkdir(dirname(destination),{recursive:true});
await writeFile(destination,apk);
console.log(JSON.stringify({output:'web-build/huslyg-public',website:'static marketing pages and server-rendered public prices; no Expo app bundle',download:{path:'/downloads/Stromblik.apk',version:'1.0.119',bytes:apk.length,sha256:hash},preserved:['public pages','native callback pages','Tesla public key','existing public assets']},null,2));

