export const PURGE_DEFAULT_BATCH_SIZE = 50;
export const PURGE_MAX_BATCH_SIZE = 200;

export type PurgeSubjectType = 'ARTICLE' | 'COMMENT' | 'ASSET';
export type LegalHoldSubject =
  | { subjectType: 'ARTICLE'; subjectId: string }
  | { subjectType: 'COMMENT'; subjectId: string }
  | { subjectType: 'ASSET'; subjectId: string };

export type PlaceLegalHoldInput = LegalHoldSubject & {
  actorUserId: string;
  reasonCode: string;
  occurredAt: Date;
  correlationId: string;
};
export type PlaceLegalHoldCommandInput = LegalHoldSubject & {
  actorUserId: string;
  reasonCode: string;
  correlationId?: string;
};

export interface ReleaseLegalHoldInput {
  actorUserId: string;
  occurredAt: Date;
  correlationId: string;
}
export interface ReleaseLegalHoldCommandInput {
  actorUserId: string;
  correlationId?: string;
}

export interface PurgeRunOptions {
  batchSize?: number;
  correlationId?: string;
}

export interface PurgeRunResult {
  batchSize: number;
  correlationId: string;
  assetsPurged: number;
  commentsPurged: number;
  articlesPurged: number;
  skipped: number;
}
