import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {bytesToHex, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js';
import {protectedSessionStorage} from '../src/services/auth-session-storage.mjs';
function fixture() {
  const disk=new Map(),keys=new Map();let failDisk=false,failKey=false;
  const storage={getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{if(failDisk)throw Error('disk full');disk.set(k,v);},removeItem:async k=>{disk.delete(k);}};
  const secrets={getItem:async k=>{if(failKey)throw Error('locked');return keys.get(k)??null;},setItem:async(k,v)=>{if(failKey)throw Error('locked');keys.set(k,v);},removeItem:async k=>{keys.delete(k);}};
  const adapter=protectedSessionStorage({storage,secrets,keyId:k=>'protected.'+k,randomBytes:n=>bytesToHex(randomBytes(n)),
    seal:(secret,nonce,value,context)=>nonce+':'+bytesToHex(xchacha20poly1305(hexToBytes(secret),hexToBytes(nonce),utf8ToBytes(context)).encrypt(utf8ToBytes(value))),
    open:(secret,value,context)=>{const[nonce,cipher]=value.split(':');return new TextDecoder().decode(xchacha20poly1305(hexToBytes(secret),hexToBytes(nonce),utf8ToBytes(context)).decrypt(hexToBytes(cipher)));}});
  return{disk,keys,adapter,failDisk:v=>{failDisk=v;},failKey:v=>{failKey=v;}};
}
const session=JSON.stringify({access_token:'synthetic-access',refresh_token:'synthetic-refresh',user:{id:'fixture-user'}});
{
 const f=fixture();f.disk.set('project',session);assert.equal(await f.adapter.getItem('project'),session);assert(!f.disk.get('project').includes('synthetic-access'));assert.equal(await f.adapter.getItem('project'),session);
 const first=f.disk.get('project');await f.adapter.setItem('project',session);assert.notEqual(first,f.disk.get('project'));
 f.disk.set('other',f.disk.get('project'));f.keys.set('protected.other',f.keys.get('protected.project'));await assert.rejects(f.adapter.getItem('other'));
 const cipher=f.disk.get('project');f.disk.set('project',cipher.slice(0,-1)+(cipher.endsWith('0')?'1':'0'));await assert.rejects(f.adapter.getItem('project'));
}
for(const failure of ['failDisk','failKey']){const f=fixture();f.disk.set('project',session);f[failure](true);await assert.rejects(f.adapter.getItem('project'));assert.equal(f.disk.get('project'),session);f[failure](false);assert.equal(await f.adapter.getItem('project'),session);}
{
 const f=fixture();await f.adapter.setItem('project',session);f.keys.clear();const before=f.disk.get('project');await assert.rejects(f.adapter.getItem('project'));await assert.rejects(f.adapter.setItem('project','new'));assert.equal(f.disk.get('project'),before);
 await f.adapter.removeItem('project');assert.equal(await f.adapter.getItem('project'),null);await f.adapter.setItem('project','fresh login');assert.equal(await f.adapter.getItem('project'),'fresh login');
}
{
 const f=fixture();await Promise.all([f.adapter.setItem('project','first'),f.adapter.setItem('project','second'),f.adapter.removeItem('project'),f.adapter.setItem('project','last')]);assert.equal(await f.adapter.getItem('project'),'last');assert.equal(f.keys.size,1);await f.adapter.removeItem('project');assert.equal(f.keys.size,0);
}
console.log('PASS protected auth storage: migration, nonce freshness, context binding, tamper rejection, write/key failure recovery, missing keys, logout and concurrent writes');
