import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context carried implicitly through async calls. It lets the
 * shared logger stamp a request id on EVERY line — including logs written deep
 * in a service that never sees the Express request — without threading the id
 * through every function signature.
 */
export interface RequestContext {
  reqId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentReqId(): string | undefined {
  return requestContext.getStore()?.reqId;
}
