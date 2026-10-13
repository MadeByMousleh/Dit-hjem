import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decryptHeatingCredentials, encryptHeatingCredentials, HeatingConnectionError } from '../src/services/heating-connection-server.mjs';

const householdId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const env = { EFORSYNING_CREDENTIALS_KEK: randomBytes(32).toString('base64url') };
const credentials = { username: '123456', password: 'ikke-i-klartekst' };

const envelope = encryptHeatingCredentials(credentials, householdId, userId, env);
assert.equal(envelope.version, 1);
assert.equal(JSON.stringify(envelope).includes(credentials.password), false, 'password must not be stored as plaintext');
assert.deepEqual(decryptHeatingCredentials(envelope, householdId, userId, env), credentials);
assert.throws(() => decryptHeatingCredentials(envelope, householdId, '33333333-3333-4333-8333-333333333333', env), HeatingConnectionError, 'envelope must be bound to the user');
assert.throws(() => encryptHeatingCredentials({ username: 'not-a-customer-number', password: 'x' }, householdId, userId, env), HeatingConnectionError);

console.log('Heating credential encryption checks passed.');
