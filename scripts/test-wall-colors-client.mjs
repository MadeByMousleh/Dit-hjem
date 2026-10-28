import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/facade-colors.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'synthetic-client',setup(b){b.onResolve({filter:/^@react-native-async-storage\/async-storage$|^\.\/supabase$/},args=>({path:args.path,namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},args=>({contents:args.path.includes('async-storage')?`export default {async getItem(){return null},async setItem(){}};`:`export const API_URL='https://synthetic.invalid';export async function getSupabase(){return {auth:{async getSession(){return {data:{session:{user:{id:'synthetic'},access_token:'synthetic'}}}}}}}` }));}}]});
const {analyzeWallColors}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const originalFetch=globalThis.fetch,originalTimeout=AbortSignal.timeout;let calls=0;
try{
 AbortSignal.timeout=undefined;
 globalThis.fetch=async(_url,options)=>{calls++;assert.ok(options.signal instanceof AbortSignal);return {ok:true,json:async()=>({analysis:{version:1,method:'original-pixels-v2',buildings:[],note:''}})};};
 const result=await analyzeWallColors([],'household','address');assert.equal(result.method,'original-pixels-v2');assert.equal(calls,1);
 globalThis.fetch=async()=>({ok:true,json:async()=>({analysis:{version:1,buildings:[],note:''}})});
 await assert.rejects(analyzeWallColors([],'household','address'),/serveren/);
 console.log('Native-style client without AbortSignal.timeout completes; old server method is rejected.');
}finally{globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
