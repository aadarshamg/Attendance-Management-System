import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/**
 * Vercel serverless entry point. `vercel.json` rewrites every request to this
 * one function; Express/Nest's own router does the real path routing from
 * there — same app, same routes as main.ts's persistent-server entry.
 *
 * The Nest app is built once per warm container and cached across invocations
 * (cold start pays the ~1-2s Nest bootstrap cost; warm invocations don't).
 */
type ServerlessHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

let cachedHandlerPromise: Promise<ServerlessHandler> | undefined;

async function bootstrap(): Promise<ServerlessHandler> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  configureApp(app);
  await app.init();
  return serverless(expressApp) as unknown as ServerlessHandler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!cachedHandlerPromise) {
      cachedHandlerPromise = bootstrap();
    }
    const cachedHandler = await cachedHandlerPromise;
    return await cachedHandler(req, res);
  } catch (err) {
    // A failed cold start (bad env var, DB unreachable, wrong Prisma binary
    // target, ...) must not leave the container permanently wedged on a
    // rejected promise — clear it so the next invocation gets a clean retry.
    cachedHandlerPromise = undefined;
    // eslint-disable-next-line no-console
    console.error('[api/index] request failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
