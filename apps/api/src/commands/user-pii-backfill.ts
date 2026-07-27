import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../app.module';
import { UsersRepository, type UserCursor } from '../features/users/repositories/users.repository';

const main = async () => {
  let app: INestApplicationContext | undefined;
  try {
    const limit = Number(process.argv[2] ?? process.env.USER_PII_BACKFILL_BATCH_SIZE ?? 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('invalid_limit');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const repository = app.get(UsersRepository);
    let cursor: UserCursor | undefined;
    let processed = 0;
    for (;;) {
      const batch = await repository.backfillLegacyPii({ cursor, limit });
      processed += batch.processed;
      if (!batch.cursor || batch.processed < limit) break;
      cursor = batch.cursor;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, processed })}\n`);
  } catch {
    process.exitCode = 1;
    process.stderr.write('user_pii_backfill_failed\n');
  } finally {
    await app?.close();
  }
};
void main();
