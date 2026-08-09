import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { StorageAdapter } from './types.js';
import { LocalStorageAdapter } from './localAdapter.js';
import { S3StorageAdapter } from './s3Adapter.js';

let adapter: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (!adapter) {
    adapter = env.STORAGE_DRIVER === 's3' ? new S3StorageAdapter() : new LocalStorageAdapter();
  }
  return adapter;
}

/** Allowed upload MIME types: images and PDFs for scans and photos. */
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Build a random, non-guessable object key scoped to org and purpose. */
export function makeKey(organizationId: string, purpose: string, contentType: string): string {
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] || 'bin';
  return `${organizationId}/${purpose}/${crypto.randomUUID()}.${ext}`;
}

export type { StorageAdapter };
