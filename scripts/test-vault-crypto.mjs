import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { openVault, sealVault, recoveryKey, parseRecoveryKey } from '../src/services/vault-crypto.mjs';

const key = new Uint8Array(randomBytes(32));
const household = randomUUID();
const data = { version: 1, agreements: [{ supplier_name: 'Ø-strøm', price: 12.34 }], readings: [{ kwh: 3.2 }], meters: [] };
const one = sealVault(data,key,new Uint8Array(randomBytes(24)),household,1);
assert.deepEqual(openVault(one,parseRecoveryKey(recoveryKey(key)),household,1),data);
assert.deepEqual(openVault(one,parseRecoveryKey(recoveryKey(key).toUpperCase().replaceAll('-',' ')),household,1),data);
assert.throws(() => openVault(one,new Uint8Array(randomBytes(32)),household,1));
assert.throws(() => openVault(one,key,randomUUID(),1));
assert.throws(() => openVault(one,key,household,2));
assert.throws(() => openVault({...one,ciphertext: (one.ciphertext[0] === '0' ? '1' : '0') + one.ciphertext.slice(1)},key,household,1));
assert.throws(() => openVault({...one,nonce:'00'.repeat(24)},key,household,1));
assert.throws(() => openVault({...one,format:'unsupported'},key,household,1));
assert.throws(() => parseRecoveryKey('password'));
const two = sealVault(data,key,new Uint8Array(randomBytes(24)),household,1);
assert.notEqual(one.ciphertext,two.ciphertext);
assert.ok(!JSON.stringify(one).includes('supplier_name'));
// Exercise realistic backup sizes without regular-expression stack overflow.
const large = { text:'x'.repeat(2*1024*1024) };
assert.deepEqual(openVault(sealVault(large,key,new Uint8Array(randomBytes(24)),household,3),key,household,3),large);
console.log('PASS: recovery on a second device, key/context separation, tamper rejection, unique nonces, large backups.');
