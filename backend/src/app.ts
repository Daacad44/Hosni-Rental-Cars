import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { currentReqId } from './lib/requestContext.js';
import { requestId } from './middleware/requestId.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy: trust a bounded number of hops so rate limiting
  // counts the real client, not the proxy.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // Establish the request id (and X-Request-Id header) before logging, so every
  // line — including the HTTP completion log — carries the same id.
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: () => currentReqId() ?? randomUUID() }));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
