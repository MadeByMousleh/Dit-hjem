type Storage = {getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void>};
export function protectedSessionStorage(options: {
  storage: Storage; secrets: Storage; keyId(key: string): string;
  randomBytes(size: number): string;
  seal(secret: string, nonce: string, value: string, context: string): string;
  open(secret: string, value: string, context: string): string;
}): Storage;
