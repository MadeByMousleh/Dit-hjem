type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet?(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
};
export const PUBLIC_CACHE_BUDGET: number;
export const PERIOD_CACHE_BUDGET: number;
export function isStorageFull(error: unknown): boolean;
export function localStoragePolicy(storage: Storage, options?: { publicBudget?: number; periodBudget?: number }): {
  optional(key: string, value: string): Promise<boolean>;
  critical: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
};
export function writeOptionalCache(storage: Storage, key: string, value: string): Promise<boolean>;
export function resilientStorage(storage: Storage): ReturnType<typeof localStoragePolicy>['critical'];
