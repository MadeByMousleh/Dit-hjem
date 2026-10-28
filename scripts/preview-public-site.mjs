import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=resolve(root,'web-build','huslyg-public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.png':'image/png','.apk':'application/vnd.android.package-archive','.json':'application/json'};
export async function createPublicSiteServer({servePricePage}={}){
 const config=JSON.parse(await readFile(resolve(root,'vercel.json'),'utf8'));
 return createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const redirect=config.redirects?.find(rule=>rule.source===path);
   if(redirect){res.writeHead(307,{Location:redirect.destination});res.end();return;}
   if(path.startsWith('/api/')||path==='/callback'){res.writeHead(404,{'Content-Type':'text/plain'});res.end('API/callback handled by Vercel, not the public preview');return;}
   if(path==='/elpriser.html'){
    if(servePricePage)return await servePricePage(req,res);
    // Static interaction preview; SSR integration tests provide servePricePage.
    const body=await readFile(resolve(root,'public','elpriser.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);return;
   }
   const file=resolve(site,'.'+(path==='/'?'/index.html':path));
   if(!file.startsWith(site+sep)){res.writeHead(403);res.end();return;}
   const info=await stat(file);if(!info.isFile())throw Object.assign(Error('Not a file'),{code:'ENOENT'});
   res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});
   if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Siden findes ikke');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await createPublicSiteServer();server.listen(8796,'127.0.0.1',()=>console.log('Huslyg landing page: http://127.0.0.1:8796'));
}

