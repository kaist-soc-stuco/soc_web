import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

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

  // app.useGlobalPipes(
  //   new ZodValidationPipe()
  // );

  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const port = configService.getOrThrow<number>('API_PORT');
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap();
