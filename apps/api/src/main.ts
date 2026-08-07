import 'reflect-metadata';

import { PayloadTooLargeException, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';

import { AppModule } from './app.module';
import { createOriginMiddleware } from './shared/middleware/origin.middleware';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';
import { securityResponseLogMiddleware } from './shared/middleware/security-response-log.middleware';
const definitionPath = /^\/api\/admin\/surveys\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/definition\/?$/i;
const voterRollPath = /^\/api\/admin\/votes\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/voter-roll\/?$/i;

const isDefinitionRequest = (request: express.Request): boolean =>
  request.method === 'PUT' && definitionPath.test(request.path);
const isVoterRollRequest = (request: express.Request): boolean =>
  request.method === 'POST' && voterRollPath.test(request.path);

const boundedParser = (parser: express.RequestHandler): express.RequestHandler =>
  (request, response, next) => {
    parser(request, response, (error?: unknown) => {
      if (error && typeof error === 'object' && (error as { type?: unknown }).type === 'entity.too.large') {
        next(new PayloadTooLargeException('payload_too_large'));
        return;
      }
      next(error);
    });
  };

export const configureSurveyBodyParsers = (
  app: { use: (...handlers: express.RequestHandler[]) => unknown },
  definitionParserLimit: number,
): void => {
  const definitionJson = boundedParser(express.json({ limit: definitionParserLimit }));
  const voterRollJson = boundedParser(express.json({ limit: '2mb' }));
  const defaultJson = boundedParser(express.json({ limit: '32kb' }));
  const defaultUrlencoded = boundedParser(express.urlencoded({ extended: false, limit: '32kb' }));

  app.use((request, response, next) => isDefinitionRequest(request)
    ? definitionJson(request, response, next)
    : isVoterRollRequest(request)
      ? voterRollJson(request, response, next)
      : next());
  app.use((request, response, next) => isDefinitionRequest(request) || isVoterRollRequest(request)
    ? next()
    : defaultJson(request, response, next));
  app.use((request, response, next) => isDefinitionRequest(request) || isVoterRollRequest(request)
    ? next()
    : defaultUrlencoded(request, response, next));
};
export async function bootstrap(): Promise<void> {
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
  app.use(securityResponseLogMiddleware);

  app.use(createOriginMiddleware(publicOrigin));
  const definitionParserLimit = configService.get<number>('SURVEY_DEFINITION_PARSER_MAX_BYTES') ?? 32 * 1024;
  configureSurveyBodyParsers(app, definitionParserLimit);
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

if (require.main === module) void bootstrap();
