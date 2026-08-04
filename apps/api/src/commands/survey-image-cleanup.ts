import { randomUUID } from 'node:crypto';

import 'reflect-metadata';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 1_000;
const DEFAULT_GRACE_MS = 3_600_000;
const MIN_GRACE_MS = 60_000;
const MAX_GRACE_MS = 30 * 24 * 3_600_000;

class InvalidCleanupOptionsError extends Error {}

type Diagnostic = { name: string; code?: string };
type CleanupOptions = { batchSize: number; graceMs: number };
type Output = {
  ok: boolean;
  event: 'survey_image_cleanup_completed' | 'survey_image_cleanup_failed';
  error?: string;
  batchSize?: number;
  graceMs?: number;
  correlationId: string;
  claimed?: number;
  deleted?: number;
  retried?: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

const parsePositiveInteger = (value: string, maximum: number): number => {
  if (!/^[1-9]\d*$/.test(value)) throw new InvalidCleanupOptionsError();
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) throw new InvalidCleanupOptionsError();
  return number;
};

export const parseCleanupOptions = (args: string[], env: NodeJS.ProcessEnv): CleanupOptions => {
  const values = args[0] === '--' ? args.slice(1) : args;
  if (values.length > 2) throw new InvalidCleanupOptionsError();

  const batchSize = parsePositiveInteger(values[0] ?? env.SURVEY_IMAGE_CLEANUP_BATCH_SIZE ?? String(DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE);
  const graceMs = parsePositiveInteger(values[1] ?? env.SURVEY_IMAGE_CLEANUP_GRACE_MS ?? String(DEFAULT_GRACE_MS), MAX_GRACE_MS);
  if (graceMs < MIN_GRACE_MS) throw new InvalidCleanupOptionsError();

  return { batchSize, graceMs };
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
  const startedAt = new Date();
  let app: INestApplicationContext | undefined;
  let output: Output;
  let primary: Diagnostic | undefined;
  let close: Diagnostic | undefined;
  let options: CleanupOptions | undefined;

  try {
    options = parseCleanupOptions(process.argv.slice(2), process.env);
    const [{ AppModule }, { SurveysService }] = await Promise.all([
      import('../app.module'),
      import('../features/surveys/surveys.service'),
    ]);
    app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const result = await app.get(SurveysService).cleanupSurveyImages(new Date(), options.graceMs, options.batchSize);
    output = {
      ok: true,
      event: 'survey_image_cleanup_completed',
      ...options,
      correlationId,
      ...result,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    };
  } catch (error) {
    process.exitCode = 1;
    const invalidOptions = error instanceof InvalidCleanupOptionsError;
    if (!invalidOptions) primary = diagnostic(error);
    output = {
      ok: false,
      event: 'survey_image_cleanup_failed',
      error: invalidOptions ? 'invalid_options' : 'survey_image_cleanup_failed',
      ...options,
      correlationId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    };
  } finally {
    try {
      await app?.close();
    } catch (error) {
      process.exitCode = 1;
      close = diagnostic(error);
      output = {
        ok: false,
        event: 'survey_image_cleanup_failed',
        error: 'survey_image_cleanup_failed',
        ...options,
        correlationId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      };
    }
  }

  if (primary || close) {
    process.stderr.write(`${JSON.stringify({ event: 'survey_image_cleanup_failed', correlationId, primary, close })}\n`);
  } else if (!output!.ok) {
    process.stderr.write(`${JSON.stringify({ event: 'survey_image_cleanup_failed', correlationId, error: output!.error })}\n`);
  }
  writeOutput(output!);
};

if (typeof require !== 'undefined' && require.main === module) {
  const correlationId = randomUUID();
  void main(correlationId).catch(() => {
    process.exitCode = 1;
    const startedAt = new Date();
    try {
      process.stderr.write(`${JSON.stringify({ event: 'survey_image_cleanup_failed', correlationId, primary: { name: 'UnknownError' } })}\n`);
      writeOutput({
        ok: false,
        event: 'survey_image_cleanup_failed',
        error: 'survey_image_cleanup_failed',
        correlationId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      });
    } catch {
      // The nonzero exit code is authoritative when the output stream is unavailable.
    }
  });
}
