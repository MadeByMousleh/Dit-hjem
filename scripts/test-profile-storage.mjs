import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const values = new Map();
const storage = {
  getItem: async key => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); },
  mergeItem: async (key, value) => { values.set(key, JSON.stringify({ ...JSON.parse(values.get(key) ?? '{}'), ...JSON.parse(value) })); },
};
const source = readFileSync(new URL('../src/services/storage.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(name => {
  if (name === '@react-native-async-storage/async-storage') return storage;
  throw new Error(`Unexpected import ${name}`);
}, module, module.exports);
const { PROFILE_STORAGE_KEY, loadProfile, saveProfile } = module.exports;

await saveProfile({ name: 'First user', email: 'first@example.test', address: 'First Street 1' }, 'user-a');
await saveProfile({ name: 'Second user', email: 'second@example.test', address: 'Second Street 2' }, 'user-b');
assert.equal((await loadProfile('user-a', 'first@example.test')).address, 'First Street 1');
assert.equal((await loadProfile('user-b', 'second@example.test')).address, 'Second Street 2');
assert.equal(await loadProfile('user-c', 'third@example.test'), undefined);

values.set(PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Legacy user', email: 'legacy@example.test', address: 'Old Street 3' }));
assert.equal((await loadProfile('legacy-user', 'legacy@example.test')).address, 'Old Street 3');
assert.equal(await loadProfile('different-user', 'different@example.test'), undefined);
assert.equal(await loadProfile('no-email-user', ''), undefined);
console.log('PASS: account-scoped profile storage, separate addresses, safe matching of legacy profile.');
