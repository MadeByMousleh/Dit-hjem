import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/barScrub.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(name => {
  if (name === 'expo-haptics') return { selectionAsync: async () => {} };
  throw new Error(`Unexpected import ${name}`);
}, module, module.exports);
const { barIndexAt } = module.exports;

assert.equal(barIndexAt(108, 100, 0, 8, 21, 24), 0);
assert.equal(barIndexAt(128, 100, 0, 8, 21, 24), 0);
assert.equal(barIndexAt(129, 100, 0, 8, 21, 24), 1);
assert.equal(barIndexAt(108, 100, 42, 8, 21, 24), 2);
assert.equal(barIndexAt(-50, 100, 0, 8, 21, 24), 0);
assert.equal(barIndexAt(999, 100, 0, 8, 21, 24), 23);
assert.equal(barIndexAt(108, 100, 0, 8, 21, 0), -1);
console.log('PASS: chart scrubbing maps finger position to bars, including scroll offset and edges.');
