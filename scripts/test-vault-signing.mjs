import assert from 'node:assert/strict';
import { randomBytes, randomUUID, hkdfSync, createPublicKey, verify } from 'node:crypto';
import { signVaultWrite, verifyVaultWrite, writeMessage, vaultWriterPublicKey, WRITE_PROTOCOL, MAX_WRITE_BYTES } from '../src/services/vault-signing.mjs';
import { sealVault } from '../src/services/vault-crypto.mjs';

const key = new Uint8Array(randomBytes(32));
const projectUrl = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
const householdId = randomUUID(), userId = randomUUID();
const fields = {projectUrl,householdId,userId,expectedRevision:0,legacyDigest:'ab'.repeat(16),envelope:sealVault({version:1},key,new Uint8Array(randomBytes(24)),householdId,1)};
const signed = signVaultWrite(fields,key);
assert.ok(verifyVaultWrite(signed));
assert.equal(signed.publicKey,vaultWriterPublicKey(key,projectUrl,householdId));
// Independent Node/OpenSSL verifier and HKDF implementation.
const seed = Buffer.from(hkdfSync('sha256',key,Buffer.from(`${projectUrl}\n${householdId}`),Buffer.from(`${WRITE_PROTOCOL}:ed25519`),32));
const {createPrivateKey} = await import('node:crypto');
const privateKey = createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed]),format:'der',type:'pkcs8'});
assert.equal(createPublicKey(privateKey).export({format:'der',type:'spki'}).subarray(-32).toString('hex'),signed.publicKey);
const pub = createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(signed.publicKey,'hex')]),format:'der',type:'spki'});
assert.ok(verify(null,writeMessage(signed),pub,Buffer.from(signed.signature,'hex')));
seed.fill(0);
for (const change of [
  {userId:randomUUID()}, {householdId:randomUUID()}, {projectUrl:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co'},
  {expectedRevision:1,legacyDigest:null}, {legacyDigest:'cd'.repeat(16)}, {publicKey:'00'.repeat(32)},
  {signature:'00'.repeat(64)}, {envelope:{...signed.envelope,nonce:'00'.repeat(24)}},
  {envelope:{...signed.envelope,ciphertext:'00'.repeat(32)}}, {extra:'unsigned'},
  {envelope:{...signed.envelope,extra:'unsigned'}},
]) assert.equal(verifyVaultWrite({...signed,...change}),false);
assert.equal(verifyVaultWrite(null),false);
assert.equal(verifyVaultWrite({...signed,envelope:{...signed.envelope,ciphertext:'00'.repeat(MAX_WRITE_BYTES/2)}}),false);
assert.notEqual(vaultWriterPublicKey(key,projectUrl,randomUUID()),signed.publicKey);
assert.notEqual(vaultWriterPublicKey(key,'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',householdId),signed.publicKey);
console.log('PASS: Ed25519/HKDF matches Node crypto; signatures bind user, project, household, revision, migration digest and ciphertext; malformed/oversized requests rejected.');
