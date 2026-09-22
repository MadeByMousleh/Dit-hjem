export type Envelope = { format: string; nonce: string; ciphertext: string };
export const VAULT_FORMAT: string;
export function recoveryKey(bytes: Uint8Array): string;
export function parseRecoveryKey(text: string): Uint8Array;
export function sealVault(payload: unknown, key: Uint8Array, nonce: Uint8Array, householdId: string, revision: number): Envelope;
export function openVault(envelope: Envelope, key: Uint8Array, householdId: string, revision: number): any;
