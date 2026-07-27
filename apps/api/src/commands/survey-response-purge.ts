import { randomUUID } from 'node:crypto';

import 'reflect-metadata';

import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

class InvalidLimitError extends Error {}

type Diagnostic = { name: string; code?: string };
type Output = {
  ok: boolean;
  error?: string;
  batchSize?: number;
  correlationId: string;
  responsesPurged?: number;
};

const parseLimit = (args: string[], env: NodeJS.ProcessEnv): number => {
  const values = args[0] === '--' ? args.slice(1) : args;
  if (values.length > 1) throw new InvalidLimitError();
  const value = values[0] ?? env.SURVEY_RESPONSE_PURGE_BATCH_SIZE ?? '100';
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 1000) {
    throw new InvalidLimitError();
  }
  return Number(value);
};

const diagnostic = (error: unknown): Diagnostic => {
  try {
    const rawName = error instanceof Error ? error.name : 'UnknownError';
    const name = typeof rawName === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(rawName)
      ? rawName
      : 'UnknownError';
    const rawCode = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    const code = typeof rawCode === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(rawCode)
      ? rawCode
      : undefined;
    return code ? { name, code } : { name };
  } catch {
    return { name: 'UnknownError' };
  }
};

const writeOutput = (output: Output): void => {
  process.stdout.write(`${JSON.stringify(output)}\n`);
};

const main = async (correlationId: string): Promise<void> => {
  let app: INestApplicationContext | undefined;
  let output: Output;
  let primary: Diagnostic | undefined;
  let close: Diagnostic | undefined;

  try {
    const limit = parseLimit(process.argv.slice(2), process.env);
    const [{ AppModule }, { SurveysService }] = await Promise.all([
      import('../app.module'),
      import('../features/surveys/surveys.service'),
    ]);
    app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const responsesPurged = await app.get(SurveysService).purge(limit, correlationId);
    output = { ok: true, batchSize: limit, correlationId, responsesPurged };
  } catch (error) {
    process.exitCode = 1;
    const invalidLimit = error instanceof InvalidLimitError;
    if (!invalidLimit) primary = diagnostic(error);
    output = { ok: false, error: invalidLimit ? 'invalid_limit' : 'survey_response_purge_failed', correlationId };
  } finally {
    try {
      await app?.close();
    } catch (error) {
      process.exitCode = 1;
      close = diagnostic(error);
      output = { ok: false, error: 'survey_response_purge_failed', correlationId };
    }
  }

  if (primary || close) {
    process.stderr.write(`${JSON.stringify({ event: 'survey_response_purge_failed', correlationId, primary, close })}\n`);
  } else if (!output!.ok) {
    process.stderr.write(`${String(output!.error)} correlationId=${correlationId}\n`);
  }
  writeOutput(output!);
};

const correlationId = randomUUID();
void main(correlationId).catch(() => {
  process.exitCode = 1;
  try {
    process.stderr.write(`${JSON.stringify({ event: 'survey_response_purge_failed', correlationId, primary: { name: 'UnknownError' } })}\n`);
    writeOutput({ ok: false, error: 'survey_response_purge_failed', correlationId });
  } catch {
    // The nonzero exit code is authoritative when the output stream is unavailable.
  }
});
