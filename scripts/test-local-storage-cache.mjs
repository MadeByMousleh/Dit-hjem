import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as localStorageCache from '../src/services/local-storage-cache.mjs';
import { localStoragePolicy, isStorageFull } from '../src/services/local-storage-cache.mjs';

const disk = new Map(), removed = [], writes = [];
let capacity = Infinity, writeError = null;
const size = (key, value) => (key.length + value.length) * 2 + 256;
const storage = {
  getItem: async key => disk.get(key) ?? null,
  getAllKeys: async () => [...disk.keys()],
  removeItem: async key => { removed.push(key); disk.delete(key); },
  setItem: async (key, value) => {
    if (writeError) throw writeError;
    const total = [...disk].filter(([name]) => name !== key).reduce((sum, [name, item]) => sum + size(name, item), 0) + size(key, value);
    if (total > capacity) throw Error('database or disk is full (code 13 SQLITE_FULL)');
    disk.set(key, value); writes.push(key);
  },
};
const publicA = 'stromblik.public-history.v1.old', publicB = 'stromblik.public-prices.v1.new';
const old = JSON.stringify({ fetchedAt: 1, points: 'a'.repeat(100) });
const fresh = JSON.stringify({ fetchedAt: 2, points: 'b'.repeat(100) });
const auth = 'sb-synthetic-auth-token', profile = 'stromblik.profile.v1.alice';
const root = 'stromblik.vault.alice.home.encrypted', record = 'stromblik.vault.alice.home.period.hour/2026-10-13';
disk.set(auth, 'session'); disk.set(profile, 'profile'); disk.set(root, 'encrypted-root'); disk.set(record, 'encrypted-record-revision-pin');
const protectedBefore = new Map(disk);
let policy = localStoragePolicy(storage, { publicBudget: size(publicA, old) + 20, periodBudget: 1024 });
assert.equal(await policy.optional(publicA, old), true);
assert.equal(await policy.optional(publicB, fresh), true);
assert.equal(disk.has(publicA), false, 'Only old, replaceable public prices are evicted');
assert.equal(disk.has(publicB), true);
for (const [key, value] of protectedBefore) assert.equal(disk.get(key), value);
assert.equal(await policy.optional(record, 'x'.repeat(2000)), false);
assert.equal(disk.get(record), protectedBefore.get(record), 'Oversized writes retain the prior encrypted record/revision pin');
const record2 = 'stromblik.vault.alice.home.period.hour/2026-10-14';
assert.equal(await policy.optional(record2, 'encrypted-second'), true);
assert.equal(await policy.optional('stromblik.vault.alice.home.period.hour/2026-10-15', 'x'.repeat(300)), false);
assert.equal(disk.has(record), true, 'Encrypted cache is not pruned at the quota');
await assert.rejects(policy.optional(auth, 'not-an-optional-cache'), /not an optional/);
capacity = [...disk].reduce((sum, [key, value]) => sum + size(key, value), 0);
await policy.critical.setItem(profile, 'saved-address-and-name'.repeat(5));
assert.equal(disk.get(profile), 'saved-address-and-name'.repeat(5));
assert.ok(!disk.has(publicB));
assert.ok(removed.every(key => key.startsWith('stromblik.public-')), 'Never clear app storage, login, profile, vault or records');
assert.equal(disk.get(auth), 'session'); assert.equal(disk.get(root), 'encrypted-root');
capacity = 0;
await assert.rejects(policy.critical.setItem(profile, 'next'), /Frigør lidt plads/);
assert.equal(disk.get(auth), 'session');
writeError = new Error('unrelated storage error');
await assert.rejects(policy.critical.setItem(auth, 'session'), /unrelated/);
assert.equal(await policy.optional(publicA, old), false, 'Optional cache failure does not undo cloud/network results');
assert.equal(isStorageFull(new Error('database or disk is full (code 13)')), true);
assert.equal(isStorageFull(new Error('QuotaExceededError')), true);
assert.equal(isStorageFull(new Error('offline')), false);
writeError = null; capacity = Infinity;
disk.clear();
policy = localStoragePolicy(storage, { publicBudget: 800, periodBudget: 800 });
await Promise.all(Array.from({ length: 12 }, (_, i) => policy.optional(`stromblik.public-history.v1.${i}`, 'v'.repeat(100))));
assert.ok([...disk].reduce((sum, [key, value]) => sum + size(key, value), 0) <= 800, 'Concurrent optional writes respect a shared budget');
assert.match(readFileSync(new URL('../android/gradle.properties', import.meta.url), 'utf8'), /^AsyncStorage_db_size_in_MB=64$/m);

// Reproduce the actual "Find dit hjem" save path: updating Auth metadata
// persists a bigger session, followed by the account-scoped profile write.
disk.clear();
disk.set(root, 'ciphertext-preserve');
disk.set(auth, JSON.stringify({ user: { id: 'alice' } }));
disk.set(publicA, JSON.stringify({ fetchedAt: 1, points: 'p'.repeat(3000) }));
capacity = [...disk].reduce((sum, [key, value]) => sum + size(key, value), 0);
let sessionStorage = storage;
const session = { user: { id: 'alice', email: 'alice@example.test', user_metadata: {} } };
const client = { auth: {
  getSession: async () => ({ data: { session } }),
  updateUser: async ({ data }) => { Object.assign(session.user.user_metadata, data); await sessionStorage.setItem(auth, JSON.stringify(session)); return { error: null }; },
} };
const deps = {
  '@react-native-async-storage/async-storage': { default: storage },
  './local-storage-cache.mjs': localStorageCache,
  './supabase': { getSupabase: async () => client, API_URL: 'https://synthetic.invalid' },
  '../prices': {},
};
function load(file) {
  const js = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(name => { assert.ok(name in deps, name); return deps[name]; }, module, module.exports);
  return module.exports;
}
deps['./storage'] = load('../src/services/storage.ts');
const { saveSetupProfile } = load('../src/services/onboarding-profile.ts');
const address = { kind: 'address', id: 'synthetic-address', text: 'Synthetic Street 1', x: 12, y: 55, municipalityCode: '0101', postcode: '1550' };
await assert.rejects(saveSetupProfile('alice', 'Alice', 'Example', address), /database or disk is full/, 'Previous direct Auth storage reproduces the reported onboarding failure');
sessionStorage = localStorageCache.resilientStorage(storage);
await saveSetupProfile('alice', 'Alice', 'Example', address);
assert.equal(JSON.parse(disk.get('stromblik.profile.v1.alice')).address, address.text);
assert.equal(JSON.parse(disk.get(auth)).user.id, 'alice');
assert.equal(disk.get(root), 'ciphertext-preserve');
assert.equal(disk.has(publicA), false);
console.log('PASS: actual onboarding save reproduces SQLITE_FULL with direct Auth storage, then completes with resilient Auth/profile storage while preserving session and vault.');
console.log('PASS: bounded concurrent public/period cache writes, public-only eviction, preservation of login/profile/root/record revision pins, SQLITE_FULL critical-write recovery, genuine disk-full messaging and native quota configuration. Synthetic storage; no phone data deleted.');
