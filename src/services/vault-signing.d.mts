import type { Envelope } from './vault-crypto.mjs';
export const WRITE_PROTOCOL: string;
export const MAX_WRITE_BYTES: number;
export type WriteFields = { projectUrl: string; householdId: string; userId: string; expectedRevision: number; legacyDigest: string | null; envelope: Envelope };
export type SignedWrite = WriteFields & { publicKey: string; signature: string };
export function vaultWriterPublicKey(key: Uint8Array, projectUrl: string, householdId: string): string;
export function writeMessage(write: WriteFields & { publicKey: string }): Uint8Array;
export function signVaultWrite(fields: WriteFields, key: Uint8Array): SignedWrite;
export function verifyVaultWrite(write: unknown): boolean;
