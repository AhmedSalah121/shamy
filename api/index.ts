import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const server = express();
let isInitialized = false;

async function bootstrap() {
  if (!isInitialized) {
    const uploadDir = join(process.cwd(), 'uploads');
    try {
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
    } catch {
      // In read-only serverless environment, ignore filesystem error
    }

    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
    );

    // Mirror CORS, global pipes, and configurations from src/main.ts
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
      // Ignore static asset directory errors in serverless environments
    }

    await app.init();
    isInitialized = true;
  }
  return server;
}

export default async function handler(req: any, res: any) {
  const appServer = await bootstrap();
  return appServer(req, res);
}
