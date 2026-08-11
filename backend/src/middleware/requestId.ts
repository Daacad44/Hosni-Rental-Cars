import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext } from '../lib/requestContext.js';

/**
 * Assigns a request id and runs the rest of the request inside its async
 * context. Honours an inbound X-Request-Id (so a trace can span the reverse
 * proxy and multiple services) but bounds its length, and always echoes the id
 * back on the response so a client or proxy can correlate.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  const id =
    typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 200 ? inbound : randomUUID();
  res.setHeader('X-Request-Id', id);
  requestContext.run({ reqId: id }, () => next());
};
