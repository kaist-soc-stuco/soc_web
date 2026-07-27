import { randomUUID } from 'node:crypto';

import 'reflect-metadata';

import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { PURGE_DEFAULT_BATCH_SIZE, PURGE_MAX_BATCH_SIZE } from '../features/boards/purge.types';

class InvalidLimitError extends Error {}

const parseLimit = (arguments_: string[], environment: NodeJS.ProcessEnv): number => {
  const values = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
  if (values.length > 1) {
    throw new InvalidLimitError('A purge limit accepts at most one argument');
  }

  const value = values[0] ?? environment.BOARD_PURGE_BATCH_SIZE ?? String(PURGE_DEFAULT_BATCH_SIZE);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new InvalidLimitError('Purge limit must be a positive integer');
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > PURGE_MAX_BATCH_SIZE) {
    throw new InvalidLimitError(`Purge limit must be between 1 and ${PURGE_MAX_BATCH_SIZE}`);
  }

  return limit;
};

const writeResult = (result: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

interface TechnicalDiagnostic {
  name: string;
  code?: string;
}

const technicalDiagnostic = (error: unknown): TechnicalDiagnostic => {
  try {
    const rawName = error instanceof Error ? error.name : 'UnknownError';
    const name = typeof rawName === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(rawName) ? rawName : 'UnknownError';
    const rawCode = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    const code = typeof rawCode === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(rawCode) ? rawCode : undefined;
    return code ? { name, code } : { name };
  } catch {
    return { name: 'UnknownError' };
  }
};

const main = async (correlationId: string): Promise<void> => {
  let app: INestApplicationContext | undefined;
  let output: Record<string, unknown>;
  let primaryDiagnostic: TechnicalDiagnostic | undefined;
  let closeDiagnostic: TechnicalDiagnostic | undefined;

  try {
    const limit = parseLimit(process.argv.slice(2), process.env);
    const [{ AppModule }, { PurgeService }] = await Promise.all([
      import('../app.module'),
      import('../features/boards/purge.service'),
    ]);
    app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const result = await app.get(PurgeService).run({ batchSize: limit, correlationId });
    output = {
      ok: true,
      batchSize: result.batchSize,
      correlationId: result.correlationId,
      assetsPurged: result.assetsPurged,
      commentsPurged: result.commentsPurged,
      articlesPurged: result.articlesPurged,
      skipped: result.skipped,
    };
  } catch (error) {
    process.exitCode = 1;
    const invalidLimit = error instanceof InvalidLimitError;
    if (!invalidLimit) primaryDiagnostic = technicalDiagnostic(error);
    output = {
      ok: false,
      error: invalidLimit ? 'invalid_limit' : 'content_purge_failed',
      correlationId,
    };
  } finally {
    try {
      await app?.close();
    } catch (error) {
      process.exitCode = 1;
      closeDiagnostic = technicalDiagnostic(error);
      output = { ok: false, error: 'content_purge_failed', correlationId };
    }
  }

  if (primaryDiagnostic || closeDiagnostic) {
    process.stderr.write(`${JSON.stringify({ event: 'content_purge_failed', correlationId, primary: primaryDiagnostic, close: closeDiagnostic })}\n`);
  } else if (output!.ok !== true) {
    process.stderr.write(`${String(output!.error)} correlationId=${correlationId}\n`);
  }
  writeResult(output!);
};

const correlationId = randomUUID();
void main(correlationId).catch(() => {
  process.exitCode = 1;
  try {
    process.stderr.write(`${JSON.stringify({ event: 'content_purge_failed', correlationId, primary: { name: 'UnknownError' } })}\n`);
    writeResult({ ok: false, error: 'content_purge_failed', correlationId });
  } catch {
    // The process exit code remains nonzero even if the output stream itself is unavailable.
  }
});
