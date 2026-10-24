import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const server = express();
let isInitialized = false;

async function bootstrap() {
  if (!isInitialized) {
    // Vercel's /var/task is read-only; /tmp is the only writable directory
    const uploadDir = process.env.VERCEL
      ? join('/tmp', 'uploads')
      : join(process.cwd(), 'uploads');

    try {
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
    } catch {
      // Ignore filesystem error if read-only
    }

    // Load AppModule inside bootstrap so import-time errors are caught by handler's try/catch
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../src/app.module');

    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
    );

    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );

    try {
      app.useStaticAssets(uploadDir, {
        prefix: '/uploads/',
      });
    } catch {
      // Ignore static asset errors in serverless
    }

    await app.init();
    isInitialized = true;
  }
  return server;
}

export default async function handler(req: any, res: any) {
  try {
    const appServer = await bootstrap();
    return appServer(req, res);
  } catch (err: any) {
    console.error('Vercel NestJS Bootstrap Crash:', err);
    return res.status(500).json({
      statusCode: 500,
      error: 'BOOTSTRAP_FAILED',
      message: err?.message || String(err),
      stack: err?.stack?.split('\n'),
    });
  }
}
