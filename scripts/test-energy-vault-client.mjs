import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from '../src/services/vault-crypto.mjs';
import * as signing from '../src/services/vault-signing.mjs';
import { vaultWriteResponse } from '../src/services/vault-write-server.mjs';

// Exercise the actual TypeScript service with only its platform/I/O boundaries mocked.
const clone = value => JSON.parse(JSON.stringify(value));
const cache = new Map(), secure = new Map(), clouds = new Map(), uploads = [], versions = new Map();
const writers = new Map(), signedRequests = [];
const projectUrl = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
process.env.SUPABASE_URL = projectUrl; // isolated process fixture, never .ENV
let offline = false;
let beforeSave;
const db = {
  auth: {getSession:async()=>({data:{session:{user:{id:user},access_token:'fixture-session'}},error:null})},
  from: table => {
    const filters = [];
    let columns;
    const rows = () => {
      if (offline) throw new Error('offline');
      const source = table === 'household_members' ? [{household_id:home,user_id:user}] : [...(table === 'energy_vault_versions' ? versions : clouds).values()];
      return source.filter(row => filters.every(fn => fn(row))).map(clone);
    };
    const query = {
      select: value => { columns = value; return query; },
      eq: (field, value) => { filters.push(row => row[field] === value); return query; },
      lt: (field, value) => { filters.push(row => row[field] < value); return query; },
      order: () => query,
      limit: async n => ({ data: rows().sort((a,b) => b.revision-a.revision).slice(0,n).map(row => {
        assert.equal(columns,'revision,saved_at');
        return {revision:row.revision,saved_at:row.saved_at};
      }), error:null }),
      maybeSingle: async () => ({data: rows()[0] ?? null,error:null}),
    };
    return query;
  },
  rpc: async (name, args) => {
    if (offline) throw new Error('offline');
    if (name === 'export_energy_for_encryption') return { data: { payload: { version: 1, agreements: [], meters: [], readings: [] }, digest: 'ab'.repeat(16) } };
    assert.equal(name,'commit_signed_energy_vault');
    uploads.push(clone(args));
    if (beforeSave) { const callback = beforeSave; beforeSave = undefined; await callback(); }
    const previous = clouds.get(args.p_household);
    if (previous && !writers.has(args.p_household)) return {error:{message:'legacy_write_locked'}};
    if (writers.has(args.p_household) && writers.get(args.p_household)!==args.p_public_key) return {error:{message:'writer_key_mismatch'}};
    if ((previous?.revision ?? 0) !== args.p_expected) return { error: { message: 'vault_revision_conflict' } };
    writers.set(args.p_household,args.p_public_key);
    const row = { household_id: args.p_household, revision: args.p_expected+1, envelope: clone(args.p_envelope) };
    clouds.set(args.p_household,row);
    versions.set(`${args.p_household}:${row.revision}`, {...clone(row),saved_at:new Date().toISOString()});
    return { data: [clone(row)] };
  },
};
const storage = { getItem: async name => cache.get(name) ?? null, setItem: async (name,value) => cache.set(name,value) };
const deps = {
  '@react-native-async-storage/async-storage': { default: storage },
  'expo-crypto': { getRandomBytesAsync: async n => new Uint8Array(randomBytes(n)) },
  'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device-only', getItemAsync: async name => secure.get(name) ?? null, setItemAsync: async (name,value,options) => { assert.equal(options.requireAuthentication,true); assert.equal(options.keychainAccessible,'device-only'); secure.set(name,value); } },
  'react-native': { Platform: { OS:'ios' } },
  './supabase': { getSupabase: async () => db, getSupabaseProjectUrl:async()=>projectUrl,API_URL:'https://app.example.invalid' },
  './vault-crypto.mjs': crypto,
  './vault-signing.mjs': signing,
};
const mockFetch = async (url,options) => {
  assert.equal(url,'https://app.example.invalid/api/energy/vault');
  assert.equal(options.headers.Authorization,'Bearer fixture-session');
  const body = JSON.parse(options.body); signedRequests.push(clone(body));
  const result = await vaultWriteResponse(new Request(url,{method:'POST',headers:options.headers}),body,async()=>({data:{userClaims:{id:user},supabase:db,supabaseAdmin:db},error:null}));
  return {ok:result.status===200,json:async()=>result.body};
};
const output = ts.transpileModule(readFileSync(new URL('../src/services/energy-vault.ts',import.meta.url),'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports:{} };
vm.runInThisContext(`(function(require,module,exports,fetch){${output}\n})`)(name => { assert.ok(deps[name],name); return deps[name]; },mod,mod.exports,mockFetch);
const { EnergyVault } = mod.exports;
const home = randomUUID(), user = randomUUID(), text = crypto.recoveryKey(new Uint8Array(randomBytes(32)));
const phone1 = new EnergyVault(home,user);
await phone1.enroll(text);
const original = clone(clouds.get(home));
await phone1.mutate(data => { data.meters.push({id:'m',metering_point_id:'123456789012345678'}); return data; });
const phone2 = new EnergyVault(home,user);
await phone2.unlock(text);
assert.deepEqual(phone2.data,phone1.data);
assert.equal(phone2.data.meters.length,1);
await phone2.remember();
const phone3 = new EnergyVault(home,user);
assert.equal(await phone3.unlockRemembered(),true);
const stranger = new EnergyVault(home,randomUUID());
assert.equal(await stranger.unlockRemembered(),false);
// Browser keys survive a closed session and are isolated by account/household.
const browserKeys = new Map();
globalThis.localStorage = {
  getItem: name => browserKeys.get(name) ?? null,
  setItem: (name, value) => browserKeys.set(name, value),
};
deps['react-native'].Platform.OS = 'web';
const browser = new EnergyVault(home,user);
await browser.unlock(text, true);
browser.close();
const reloadedBrowser = new EnergyVault(home,user);
assert.equal(await reloadedBrowser.unlockRemembered(),true);
assert.deepEqual(reloadedBrowser.data,phone2.data);
assert.equal(await new EnergyVault(home,randomUUID()).unlockRemembered(),false);
assert.equal(await new EnergyVault(randomUUID(),user).unlockRemembered(),false);
const browserKeyName = `stromblik.vault.${user}.${home}`;
browserKeys.set(browserKeyName, 'invalid');
await assert.rejects(new EnergyVault(home,user).unlockRemembered());
await reloadedBrowser.remember();
globalThis.localStorage.setItem = () => { throw new Error('storage blocked'); };
await assert.rejects(reloadedBrowser.remember(), /storage blocked/);
assert.deepEqual(reloadedBrowser.data,phone2.data,'Storage failure must not lock valid data');
reloadedBrowser.close();
delete globalThis.localStorage;
deps['react-native'].Platform.OS = 'ios';
await assert.rejects(stranger.unlock(crypto.recoveryKey(new Uint8Array(randomBytes(32)))));
const wrongHome = new EnergyVault(randomUUID(),user);
await assert.rejects(wrongHome.unlock(text));
const race = await Promise.allSettled([
  phone1.mutate(data => { data.meters.push({id:'a',metering_point_id:'111111111111111111'}); return data; }),
  phone2.mutate(data => { data.meters.push({id:'b',metering_point_id:'222222222222222222'}); return data; }),
]);
assert.equal(race.filter(result => result.status === 'fulfilled').length,1);
assert.equal(race.filter(result => result.status === 'rejected').length,1);
await phone1.refresh();
await phone2.refresh();
assert.deepEqual(phone1.data,phone2.data);
for (const upload of uploads) {
  assert.deepEqual(Object.keys(upload.p_envelope).sort(),['ciphertext','format','nonce']);
  assert.ok(!JSON.stringify(upload).includes('metering_point_id'));
  assert.ok(!JSON.stringify(upload).includes(text));
}
for (const item of cache.values()) assert.ok(!item.includes('metering_point_id'));
offline = true;
const offlinePhone = new EnergyVault(home,user);
assert.equal(await offlinePhone.exists(),true);
await offlinePhone.unlock(text);
assert.deepEqual(offlinePhone.data,phone1.data);
await assert.rejects(offlinePhone.mutate(data => data));
offline = false;
const latest = clone(clouds.get(home));
clouds.set(home,original);
await assert.rejects(new EnergyVault(home,user).unlock(text), /ældre/);
clouds.set(home,latest);

// Recovery from a corrupt head uses immutable ciphertext history, not a copy of
// the old envelope under a new revision (which would fail AAD authentication).
const previousHistory = clone([...versions.values()]);
// Model privileged corruption, not a login-only write (now rejected).
const corruptRow = {household_id:home,revision:latest.revision+1,envelope:{format:crypto.VAULT_FORMAT,nonce:'ab'.repeat(24),ciphertext:'cd'.repeat(32)}};
clouds.set(home,corruptRow); versions.set(`${home}:${corruptRow.revision}`,{...clone(corruptRow),saved_at:new Date().toISOString()});
const recoveryPhone = new EnergyVault(home,user);
const listed = await recoveryPhone.history();
assert.equal(listed.currentRevision,latest.revision+1);
assert.ok(listed.versions.some(row => row.revision===1));
assert.ok(listed.versions.every(row => !('envelope' in row)));
await assert.rejects(recoveryPhone.unlock(text));
const beforeRecovery = clone(clouds.get(home));
const writeCount = uploads.length;
await assert.rejects(recoveryPhone.restoreVersion(crypto.recoveryKey(new Uint8Array(randomBytes(32))),1,listed.currentRevision));
await assert.rejects(recoveryPhone.restoreVersion(text,listed.currentRevision,listed.currentRevision));
await assert.rejects(recoveryPhone.restoreVersion(text,99999,listed.currentRevision));
assert.equal(uploads.length,writeCount,'Invalid recovery attempted a write');
assert.deepEqual(clouds.get(home),beforeRecovery);
await recoveryPhone.restoreVersion(text,1,listed.currentRevision);
assert.equal(clouds.get(home).revision,listed.currentRevision+1);
assert.notEqual(clouds.get(home).envelope.nonce,original.envelope.nonce);
assert.deepEqual(recoveryPhone.data,crypto.openVault(original.envelope,crypto.parseRecoveryKey(text),home,1));
for (const row of previousHistory) assert.deepEqual(versions.get(`${home}:${row.revision}`),row);
assert.deepEqual(versions.get(`${home}:${beforeRecovery.revision}`).envelope,beforeRecovery.envelope);

// A truly fresh local store can recover the restored snapshot.
cache.clear();
const freshPhone = new EnergyVault(home,user);
await freshPhone.unlock(text);
assert.deepEqual(freshPhone.data,recoveryPhone.data);
const staleList = await recoveryPhone.history();
await freshPhone.mutate(data => data);
await assert.rejects(recoveryPhone.restoreVersion(text,1,staleList.currentRevision),/anden enhed/);
const raceHead = clouds.get(home).revision;
beforeSave = async () => { await freshPhone.mutate(data => {data.meters.push({id:'concurrent',metering_point_id:'333333333333333333'});return data;}); };
await assert.rejects(recoveryPhone.restoreVersion(text,1,raceHead),/anden enhed/);
assert.equal(clouds.get(home).revision,raceHead+1);
assert.equal(freshPhone.data.meters[0].id,'concurrent');

for (let n=0;n<22;n++) await freshPhone.mutate(data=>data);
const firstPage = await freshPhone.history();
assert.equal(firstPage.versions.length,20); assert.equal(firstPage.hasMore,true);
const nextPage = await freshPhone.history(firstPage.versions.at(-1).revision);
assert.ok(nextPage.versions.every(row=>row.revision<firstPage.versions.at(-1).revision));
assert.ok(nextPage.versions.some(row=>row.revision===1));
offline=true;
await assert.rejects(freshPhone.restoreVersion(text,1,clouds.get(home).revision));
offline=false;
recoveryPhone.close();
await assert.rejects(recoveryPhone.restoreVersion(text,1,clouds.get(home).revision),/låst/);
for (const upload of uploads) {
  assert.ok(!JSON.stringify(upload).includes(text));
  assert.ok(!JSON.stringify(upload).includes('metering_point_id'));
}
assert.ok(signedRequests.every(signing.verifyVaultWrite));
assert.ok(signedRequests.every(row=>!JSON.stringify(row).includes(text)));
const pinned = writers.get(home); writers.delete(home);
const beforeLocked = clone(clouds.get(home));
await assert.rejects(freshPhone.mutate(data=>data),/skrivebeskyttet/);
assert.deepEqual(clouds.get(home),beforeLocked); writers.set(home,pinned);
phone1.close();
assert.throws(() => phone1.data);
await assert.rejects(phone1.mutate(data => data));
console.log('PASS: actual vault service, cross-device recovery, secure-store isolation, concurrent saves, encrypted-only cache/uploads, offline reads, replay rejection, lock.');
console.log('PASS: corrupt-head recovery, wrong-key/corrupt-version rejection before writes, immutable old versions, fresh-device restore, stale confirmation and save conflicts, history pagination.');
