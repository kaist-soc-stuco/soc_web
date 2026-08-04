import { randomUUID } from 'node:crypto';

import 'reflect-metadata';

import { sql } from 'drizzle-orm';
import { DRIZZLE_DB, type PostgresDatabase } from '../infrastructure/postgres/postgres.provider';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

class InvalidLimitError extends Error {}

type Diagnostic = { name: string; code?: string };
type Output = {
  ok: boolean;
  event: 'survey_response_purge_completed' | 'survey_response_purge_failed';
  error?: string;
  batchSize?: number;
  correlationId: string;
  responsesPurged?: number;
  backlogMayRemain?: boolean;
  backlogAgeSeconds?: number | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
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
  const startedAt = new Date();
  let app: INestApplicationContext | undefined;
  let output: Output;
  let primary: Diagnostic | undefined;
  let close: Diagnostic | undefined;
  let batchSize: number | undefined;

  try {
    batchSize = parseLimit(process.argv.slice(2), process.env);
    const [{ AppModule }, { SurveysService }] = await Promise.all([
      import('../app.module'),
      import('../features/surveys/surveys.service'),
    ]);
    app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const responsesPurged = await app.get(SurveysService).purge(batchSize, correlationId);
    const backlog = await app.get<PostgresDatabase>(DRIZZLE_DB).execute(sql`
      SELECT EXTRACT(EPOCH FROM now() - MIN(response.retention_deadline_at))::integer AS age_seconds
      FROM survey_responses AS response
      JOIN surveys AS survey ON survey.id = response.survey_id
      WHERE response.retention_deadline_at <= now()
        AND (survey.closes_at <= now() OR survey.state IN ('CLOSED', 'ARCHIVED'))
    `);
    const rawAgeSeconds = (backlog.rows[0] as { age_seconds: unknown } | undefined)?.age_seconds;
    const ageSeconds = typeof rawAgeSeconds === 'number' && Number.isSafeInteger(rawAgeSeconds) && rawAgeSeconds >= 0
      ? rawAgeSeconds
      : null;
    output = {
      ok: true,
      event: 'survey_response_purge_completed',
      batchSize,
      correlationId,
      responsesPurged,
      backlogMayRemain: ageSeconds !== null,
      backlogAgeSeconds: ageSeconds,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    };
  } catch (error) {
    process.exitCode = 1;
    const invalidLimit = error instanceof InvalidLimitError;
    if (!invalidLimit) primary = diagnostic(error);
    output = {
      ok: false,
      event: 'survey_response_purge_failed',
      error: invalidLimit ? 'invalid_limit' : 'survey_response_purge_failed',
      batchSize,
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
        event: 'survey_response_purge_failed',
        error: 'survey_response_purge_failed',
        batchSize,
        correlationId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      };
    }
  }

  if (primary || close) {
    process.stderr.write(`${JSON.stringify({ event: 'survey_response_purge_failed', correlationId, primary, close })}\n`);
  } else if (!output!.ok) {
    process.stderr.write(`${JSON.stringify({ event: 'survey_response_purge_failed', correlationId, error: output!.error })}\n`);
  }
  writeOutput(output!);
};

const correlationId = randomUUID();
void main(correlationId).catch(() => {
  process.exitCode = 1;
  const startedAt = new Date();
  try {
    process.stderr.write(`${JSON.stringify({ event: 'survey_response_purge_failed', correlationId, primary: { name: 'UnknownError' } })}\n`);
    writeOutput({
      ok: false,
      event: 'survey_response_purge_failed',
      error: 'survey_response_purge_failed',
      correlationId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    });
  } catch {
    // The nonzero exit code is authoritative when the output stream is unavailable.
  }
});
