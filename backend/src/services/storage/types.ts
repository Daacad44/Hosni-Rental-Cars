/** A stored object's key in the private bucket. */
export interface StoredObject {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Storage abstraction. Files live in a private bucket and are only ever exposed
 * through short-lived signed URLs — a licence scan reachable by guessing a URL
 * is the worst privacy failure available here (§10).
 */
export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  /** A URL valid for a few minutes, after which the object is unreachable. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
