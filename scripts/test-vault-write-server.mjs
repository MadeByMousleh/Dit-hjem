import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { signVaultWrite } from '../src/services/vault-signing.mjs';
import { sealVault } from '../src/services/vault-crypto.mjs';
import { vaultWriteResponse } from '../src/services/vault-write-server.mjs';

const projectUrl='https://aaaaaaaaaaaaaaaaaaaa.supabase.co'; process.env.SUPABASE_URL=projectUrl;
const userId=randomUUID(), householdId=randomUUID(), key=new Uint8Array(randomBytes(32));
const fields={projectUrl,householdId,userId,expectedRevision:0,legacyDigest:'ab'.repeat(16),envelope:sealVault({},key,new Uint8Array(randomBytes(24)),householdId,1)};
const signed=signVaultWrite(fields,key);
let member=true, authError=false, commits=0, pinned, revision=0;
const context=async (_req,options)=>{
  assert.deepEqual(options,{auth:'user',audience:'authenticated',issuer:`${projectUrl}/auth/v1`});
  return {error:authError?new Error('invalid token'):null,data:{userClaims:{id:userId},
    supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:member?{}:null,error:null})})})})})},
    supabaseAdmin:{rpc:async(name,args)=>{
      assert.equal(name,'commit_signed_energy_vault'); commits++;
      if(pinned && args.p_public_key!==pinned)return {error:{message:'writer_key_mismatch'}};
      if(args.p_expected!==revision)return {error:{message:'vault_revision_conflict'}};
      pinned=args.p_public_key; revision++;
      return {data:[{household_id:householdId,revision,envelope:args.p_envelope}]};
    }},
  }};
};
const request = token => new Request('https://app.example.invalid/api/energy/vault',{method:'POST',headers:token?{authorization:'Bearer fixture'}:{}});
assert.equal((await vaultWriteResponse(request(false),signed,context)).status,401);
authError=true; assert.equal((await vaultWriteResponse(request(true),signed,context)).status,401); authError=false;
assert.equal((await vaultWriteResponse(request(true),{...signed,signature:'00'.repeat(64)},context)).status,403);
assert.equal((await vaultWriteResponse(request(true),{...signed,userId:randomUUID()},context)).status,403);
assert.equal((await vaultWriteResponse(request(true),{...signed,projectUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co'},context)).status,403);
member=false; assert.equal((await vaultWriteResponse(request(true),signed,context)).status,403); member=true;
assert.equal(commits,0);
assert.equal((await vaultWriteResponse(request(true),signed,context)).status,200);
assert.equal((await vaultWriteResponse(request(true),signed,context)).status,409); // replay
const attacker=signVaultWrite({...fields,expectedRevision:1,legacyDigest:null},new Uint8Array(randomBytes(32)));
assert.equal((await vaultWriteResponse(request(true),attacker,context)).status,409);
assert.equal(revision,1);
console.log('PASS: auth/issuer/audience boundary, invalid signatures and cross-scope/nonmember writes denied, replay and replacement key rejected.');
