import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/heatingCost.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(name => { throw new Error(name); }, module, module.exports);
const { SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH, estimateHeatingVariableCost, estimateHeatingVariableCostFromGj } = module.exports;

assert.equal(SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH, 580);
assert.equal(estimateHeatingVariableCost(1000), 580);
assert.equal(estimateHeatingVariableCostFromGj(3.6), 580);
assert.equal(estimateHeatingVariableCost(125), 72.5);
assert.equal(estimateHeatingVariableCost(null), null);
assert.equal(estimateHeatingVariableCostFromGj(-1), null);
console.log('PASS: heating variable-price estimates convert kWh/GJ to DKK.');
