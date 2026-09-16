import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import express, { type Express } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/**
 * Vercel serverless entry point. `vercel.json` rewrites every request to this
 * one function; Express/Nest's own router does the real path routing from
 * there — same app, same routes as main.ts's persistent-server entry.
 *
 * An Express app is natively callable as `(req, res)` — the exact shape
 * Vercel's Node runtime invokes this handler with — so it's used directly as
 * the handler with no adapter in between. (`serverless-http` was here
 * originally; it translates to/from AWS Lambda's event/context calling
 * convention, which is not what Vercel uses, and silently swallowed every
 * response — the request would process correctly internally but nothing
 * ever got written back to the real `res`, hanging every single request
 * until Vercel's own function timeout killed it.)
 *
 * The Nest app is built once per warm container and cached across invocations
 * (cold start pays the ~1-2s Nest bootstrap cost; warm invocations don't).
 */
let cachedAppPromise: Promise<Express> | undefined;

async function bootstrap(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  configureApp(app);
  await app.init();
  return expressApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!cachedAppPromise) {
      cachedAppPromise = bootstrap();
    }
    const expressApp = await cachedAppPromise;
    expressApp(req, res);
  } catch (err) {
    // A failed cold start (bad env var, DB unreachable, wrong Prisma binary
    // target, ...) must not leave the container permanently wedged on a
    // rejected promise — clear it so the next invocation gets a clean retry.
    cachedAppPromise = undefined;
    // eslint-disable-next-line no-console
    console.error('[api/index] request failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
