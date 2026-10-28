import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
const map=JSON.parse(await readFile(process.argv[2]??'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const paths=Object.keys(lock.packages).filter(Boolean).sort((a,b)=>b.length-a.length),used=new Set();
for(const source of map.sources){const path=source.replaceAll('\\','/');for(const candidate of paths)if(path.includes('/'+candidate+'/')||path.startsWith(candidate+'/')){used.add(candidate);break;}}
const notices=[],missing=[];
for(const path of [...used].sort()){
 const pkg=JSON.parse(await readFile(path+'/package.json','utf8'));
 const files=(await readdir(path)).filter(name=>/^(licen[cs]e|copying|notice|copyright)([._-].*)?$/i.test(name));
 const texts=[];for(const file of files){try{texts.push({file,text:await readFile(path+'/'+file,'utf8')});}catch{}}
 if(!texts.length&&typeof pkg.license==='string'&&pkg.license==='MIT'){
  const fallback=/^(expo($|-)|@expo\/)/.test(pkg.name)?'docs/licenses/expo-sdk-54.LICENSE':pkg.name.startsWith('@react-native/')?'docs/licenses/react-native-0.81.5.LICENSE':null;
  if(fallback)texts.push({file:fallback,text:await readFile(fallback,'utf8')});
 }
 if(!texts.length)missing.push({name:pkg.name,version:pkg.version,declaredLicense:pkg.license??pkg.licenses??null});
 notices.push({name:pkg.name,version:pkg.version,license:pkg.license??pkg.licenses??'See included notice',notices:texts});
}
const sky=JSON.parse((await readFile('src/generated/night-sky-assets.ts','utf8')).trim().replace(/^export const nightSkyAssets=/,'').replace(/;$/,''));
notices.push({name:'Sky assets',version:'bundled',license:'See included notice',notices:[{file:'attribution',text:sky.attribution??sky.credit??'Sky catalogue / d3-celestial / NASA; see source provenance.'},{file:'licence',text:sky.licence}]});
// Font packages may not have a JS module source path for their binary assets.
for(const name of ['nunito','dm-sans','fraunces']){
 const path='node_modules/@expo-google-fonts/'+name;
 try{const text=await readFile(path+'/LICENSE_FONT','utf8');notices.push({name:'Font: '+name,version:'bundled',license:'SIL Open Font License',notices:[{file:'LICENSE_FONT',text}]});}catch{}
}
await mkdir('src/generated',{recursive:true});await mkdir('public',{recursive:true});await mkdir('.tmp/legal-all',{recursive:true});
await writeFile('src/generated/open-source-notices.json',JSON.stringify(notices));
const plain=notices.map(item=>`${item.name} ${item.version}\nDeclared licence: ${typeof item.license==='string'?item.license:JSON.stringify(item.license)}\n${item.notices.map(n=>n.file+'\n'+n.text).join('\n\n')}`).join('\n\n--------------------\n\n');
await writeFile('public/open-source.txt','Huslyg – third-party notices\nGenerated from bundled module paths and font/sky provenance.\n\n'+plain);
await writeFile('.tmp/legal-all/license-inventory.json',JSON.stringify({basedOnSourceMap:process.argv[2]??'previous verified Android source map',packages:used.size,missing,notices:notices.length},null,2));
console.log(JSON.stringify({packages:used.size,notices:notices.length,missing:missing.map(p=>p.name),bytes:Buffer.byteLength(plain)}));
