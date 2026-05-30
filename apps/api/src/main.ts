import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'node:path';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : isProd
        ? false
        : true,
    credentials: true,
  });

  app.use(cookieParser());

  const assetUploadDir =
    configService.get<string>('ASSET_UPLOAD_DIR') ??
    path.resolve(process.cwd(), 'uploads', 'assets');
  app.use(
    '/uploads/assets',
    express.static(assetUploadDir, {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }),
  );

  // app.useGlobalPipes(
  //   new ZodValidationPipe()
  // );

  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const port = configService.getOrThrow<number>('API_PORT');
  await app.listen(port);

  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap();
