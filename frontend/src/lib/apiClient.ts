import type { ApiErrorBody, ApiSuccess, ErrorCode, PaginationMeta } from '@hosni/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * Absolute URL for a file endpoint (e.g. a PDF) to open in a new tab. Auth is
 * carried by the session cookie on the top-level GET navigation, so no header
 * plumbing is needed — the one case a browser navigation, not fetch, is right.
 */
export function apiFileUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/** Error thrown by the client, carrying the server's typed code. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  /** When true, a 401 will not trigger the refresh-and-retry flow. */
  skipRefresh?: boolean;
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  refreshPromise ??= (async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * The single fetch entry point for the whole app. Components call hooks, which
 * call a feature api.ts, which calls this. Nothing else touches `fetch`.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const url = new URL(`${BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const doFetch = () =>
    fetch(url.toString(), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  // Transparent one-shot refresh on an expired access token.
  if (res.status === 401 && !options.skipRefresh && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      res = await doFetch();
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
    }
  }

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = json as ApiErrorBody | null;
    throw new ApiError(
      err?.error?.code ?? 'INTERNAL_ERROR',
      err?.error?.message ?? 'Request failed',
      res.status,
    );
  }

  return json as ApiSuccess<T>;
}

/**
 * Multipart upload — the one exception to JSON bodies, still routed through the
 * single client so components never touch `fetch` directly. Refresh-on-401 is
 * applied the same way.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<ApiSuccess<T>> {
  const url = `${BASE_URL}${path}`;
  const doFetch = () => fetch(url, { method: 'POST', credentials: 'include', body: formData });

  let res = await doFetch();
  if (res.status === 401) {
    try {
      await refreshSession();
      res = await doFetch();
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
    }
  }

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = json as ApiErrorBody | null;
    throw new ApiError(
      err?.error?.code ?? 'INTERNAL_ERROR',
      err?.error?.message ?? 'Upload failed',
      res.status,
    );
  }
  return json as ApiSuccess<T>;
}

export type { PaginationMeta };
