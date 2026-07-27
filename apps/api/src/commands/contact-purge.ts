import { randomUUID } from 'node:crypto';
import 'reflect-metadata';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

const parseLimit = (): number => { const args = process.argv.slice(2).filter((arg) => arg !== '--'); const value = args[0] ?? process.env.CONTACT_PURGE_BATCH_SIZE ?? '100'; if (args.length > 1 || !/^[1-9]\d*$/.test(value) || Number(value) > 1000) throw new Error('invalid_limit'); return Number(value); };
const correlationId = randomUUID();
const main = async () => { let app: INestApplicationContext | undefined; try { const limit = parseLimit(); const [{ AppModule }, { ContactsService }] = await Promise.all([import('../app.module'), import('../features/contacts/contacts.service')]); app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false }); const purged = await app.get(ContactsService).purge(limit, correlationId); process.stdout.write(`${JSON.stringify({ ok: true, batchSize: limit, correlationId, contactsPurged: purged })}\n`); } catch { process.exitCode = 1; process.stderr.write(`contact_purge_failed correlationId=${correlationId}\n`); process.stdout.write(`${JSON.stringify({ ok: false, error: 'contact_purge_failed', correlationId })}\n`); } finally { try { await app?.close(); } catch { process.exitCode = 1; } } };
void main().catch(() => { process.exitCode = 1; });
