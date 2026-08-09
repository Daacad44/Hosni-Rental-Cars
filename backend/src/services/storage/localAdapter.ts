import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { StorageAdapter, StoredObject } from './types.js';

/**
 * Development storage: files on local disk, downloads gated by an HMAC-signed,
 * expiring token — the same "private, signed URL only" contract the S3 adapter
 * provides, so application code behaves identically in both environments.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root = path.resolve(env.UPLOAD_DIR);

  private full(key: string): string {
    // Keys are server-generated; still refuse anything that escapes the root.
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) throw new Error('Invalid storage key');
    return resolved;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const target = this.full(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = signKey(key, expires);
    const params = new URLSearchParams({ key, expires: String(expires), sig });
    return `/api/v1/files?${params.toString()}`;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }
}

export function signKey(key: string, expires: number): string {
  return crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${key}:${expires}`)
    .digest('hex');
}

export function verifyKeySignature(key: string, expires: number, sig: string): boolean {
  if (expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signKey(key, expires);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
