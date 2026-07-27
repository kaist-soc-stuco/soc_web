import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { PurgeRepository } from './purge.repository';
import {
  PURGE_DEFAULT_BATCH_SIZE,
  PURGE_MAX_BATCH_SIZE,
  type PlaceLegalHoldCommandInput,
  type PurgeRunOptions,
  type PurgeRunResult,
  type ReleaseLegalHoldCommandInput,
} from './purge.types';

@Injectable()
export class PurgeService {
  constructor(
    @Inject(PurgeRepository) private readonly repository: PurgeRepository,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async run(options: PurgeRunOptions = {}): Promise<PurgeRunResult> {
    const batchSize = this.batchSize(options.batchSize);
    const now = new Date(this.clock.nowMs());
    const correlationId = this.correlationId(options.correlationId);
    const result: PurgeRunResult = { batchSize, correlationId, assetsPurged: 0, commentsPurged: 0, articlesPurged: 0, skipped: 0 };
    let remaining = batchSize;

    for (const candidate of await this.repository.listExpiredAssetIds(now, remaining)) {
      if (await this.repository.purgeAsset(candidate.id, now, correlationId)) {
        result.assetsPurged += 1;
        remaining -= 1;
      } else result.skipped += 1;
    }
    if (remaining > 0) {
      for (const candidate of await this.repository.listExpiredCommentIds(now, remaining)) {
        if (await this.repository.purgeComment(candidate.id, now, correlationId)) {
          result.commentsPurged += 1;
          remaining -= 1;
        } else result.skipped += 1;
      }
    }
    if (remaining > 0) {
      for (const candidate of await this.repository.listExpiredArticleIds(now, remaining)) {
        if (await this.repository.purgeArticle(candidate.id, now, correlationId)) {
          result.articlesPurged += 1;
          remaining -= 1;
        } else result.skipped += 1;
      }
    }
    return result;
  }

  async placeLegalHold(input: PlaceLegalHoldCommandInput) {
    await this.requireBoardManager(input.actorUserId);
    return this.repository.placeLegalHold({
      ...input,
      occurredAt: new Date(this.clock.nowMs()),
      correlationId: this.correlationId(input.correlationId),
    });
  }

  async releaseLegalHold(id: string, input: ReleaseLegalHoldCommandInput) {
    await this.requireBoardManager(input.actorUserId);
    return this.repository.releaseLegalHold(id, {
      ...input,
      occurredAt: new Date(this.clock.nowMs()),
      correlationId: this.correlationId(input.correlationId),
    });
  }

  private async requireBoardManager(actorUserId: string): Promise<void> {
    if (!(await this.permissions.hasPermission(actorUserId, 'BOARD_MANAGE', 'GLOBAL'))) {
      throw new ForbiddenException('insufficient_permission');
    }
  }
  private batchSize(requested: number | undefined): number {
    const configured = this.config.get<number>('BOARD_PURGE_BATCH_SIZE');
    const value = requested ?? configured ?? PURGE_DEFAULT_BATCH_SIZE;
    if (!Number.isInteger(value) || value < 1) throw new Error('invalid purge batch size');
    return Math.min(value, PURGE_MAX_BATCH_SIZE);
  }

  private correlationId(supplied: string | undefined): string {
    const correlationId = supplied?.trim() ?? randomUUID();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(correlationId)) {
      throw new Error('invalid correlationId');
    }
    return correlationId;
  }
}
