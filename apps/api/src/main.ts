import 'reflect-metadata';

import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';

import { AppModule } from './app.module';
import { createOriginMiddleware } from './shared/middleware/origin.middleware';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  const publicOrigin = configService.getOrThrow<string>('PUBLIC_ORIGIN');
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.enableCors(
    isProduction
      ? { credentials: false, origin: false }
      : { credentials: true, origin: publicOrigin },
  );

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  app.use(createOriginMiddleware(publicOrigin));
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });

  const port = configService.get<number>('API_PORT') ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap();
