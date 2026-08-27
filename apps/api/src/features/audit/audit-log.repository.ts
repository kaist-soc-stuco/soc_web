import { Inject, Injectable } from "@nestjs/common";
import type { AuditLogEventKind, AuditLogListResponse } from "@soc/contracts";
import { isoToDate, msToIso } from "@soc/shared";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  auditLogs,
  users,
} from "../../infrastructure/postgres/postgres.schema";

export interface AuditLogCreateInput {
  action: string;
  actorUserId?: string | null;
  ipAddress?: string | null;
  payload?: unknown;
  targetId?: string | number | null;
  targetType: string;
}

type AuditPayload = Record<string, unknown>;

const DOMAIN_DEFINITIONS: Record<string, { domain: string; label: string }> = {
  content_block: { domain: "content", label: "콘텐츠" },
  executive_contact: { domain: "contact", label: "집행위" },
  role_group: { domain: "permission", label: "권한" },
  role_group_member: { domain: "permission", label: "권한" },
  site_content: { domain: "content", label: "사이트" },
  student_fee_payment: { domain: "fee", label: "과비" },
  student_fee_status: { domain: "fee", label: "과비" },
  survey_answer_file: { domain: "survey", label: "설문 응답 파일" },
  user: { domain: "user", label: "유저" },
  article: { domain: "board", label: "게시판" },
};

const ACTION_DEFINITIONS: Record<string, { label: string; kind: AuditLogEventKind }> = {
  "content_block.archive": { label: "콘텐츠 보관", kind: "EXECUTE" },
  "content_block.create": { label: "콘텐츠 생성", kind: "CREATE" },
  "content_block.delete": { label: "콘텐츠 삭제", kind: "DELETE" },
  "content_block.publish": { label: "콘텐츠 게시", kind: "EXECUTE" },
  "content_block.schedule": { label: "콘텐츠 게시 예약", kind: "EXECUTE" },
  "content_block.update": { label: "콘텐츠 수정", kind: "UPDATE" },
  "role_group.create": { label: "역할 그룹 생성", kind: "CREATE" },
  "role_group.delete": { label: "역할 그룹 삭제", kind: "DELETE" },
  "role_group.update": { label: "역할 그룹 수정", kind: "UPDATE" },
  "role_group_member.add": { label: "구성원 추가", kind: "EXECUTE" },
  "role_group_member.remove": { label: "구성원 제외", kind: "EXECUTE" },
  "role_group_member.replace": { label: "구성원 일괄 변경", kind: "BATCH" },
  "site_content.create": { label: "공개 문구 생성", kind: "CREATE" },
  "site_content.delete": { label: "공개 문구 삭제", kind: "DELETE" },
  "site_content.update": { label: "공개 문구 수정", kind: "UPDATE" },
  "student_fee_payment.process": { label: "일괄 수납 처리", kind: "BATCH" },
  "student_fee_status.update": { label: "수납 상태 변경", kind: "UPDATE" },
  "user.account.activate": { label: "계정 활성화", kind: "UPDATE" },
  "user.account.expire": { label: "계정 만료", kind: "UPDATE" },
  "user.posting_suspend": { label: "게시 작성 제한", kind: "EXECUTE" },
  "user.posting_resume": { label: "게시 작성 제한 해제", kind: "EXECUTE" },
  "article.anonymous_identity_reveal": { label: "익명 작성자 확인", kind: "EXECUTE" },
  "survey.answer_file.download": { label: "설문 응답 파일 다운로드", kind: "EXECUTE" },
  CONTACT_PRIVACY_PURGE: { label: "개인정보 파기", kind: "EXECUTE" },
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  article: "게시글",
  content_block: "콘텐츠",
  executive_contact: "집행위 연락망",
  role_group: "역할 그룹",
  role_group_member: "역할 구성원",
  site_content: "공개 문구",
  student_fee_payment: "학생회비 납부",
  student_fee_status: "학생회비 상태",
  survey_answer_file: "설문 응답 파일",
  user: "사용자",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parsePayload = (value: string | null): AuditPayload => {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as AuditPayload
      : {};
  } catch {
    return {};
  }
};

const recordFromPayload = (payload: AuditPayload, key: "before" | "after" | "deleted" | "created") => {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as AuditPayload
    : undefined;
};

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const actionDefinition = (action: string, targetType: string) => {
  const known = ACTION_DEFINITIONS[action];
  if (known) return known;

  const verb = action.split(".").at(-1) ?? action;
  const verbLabels: Record<string, string> = {
    activate: "활성화",
    add: "추가",
    archive: "보관",
    create: "생성",
    delete: "삭제",
    expire: "만료",
    publish: "게시",
    remove: "제외",
    send: "발송",
    update: "수정",
  };
  const domainLabel = DOMAIN_DEFINITIONS[targetType]?.label ?? TARGET_TYPE_LABELS[targetType] ?? "시스템";
  const kind: AuditLogEventKind = verb === "create"
    ? "CREATE"
    : verb === "delete"
      ? "DELETE"
      : verb === "update"
        ? "UPDATE"
        : verb === "send" || verb === "batch"
          ? "BATCH"
          : "OTHER";
  return { label: `${domainLabel} ${verbLabels[verb] ?? "작업"}`, kind };
};

const userLabel = (user?: { nameKo: string; stdNo: string | null }) =>
  user ? `${user.nameKo}${user.stdNo ? ` (${user.stdNo})` : ""}` : undefined;

@Injectable()
export class AuditLogRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async create(input: AuditLogCreateInput): Promise<void> {
    await this.db.insert(auditLogs).values({
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      payload: input.payload === undefined ? null : JSON.stringify(input.payload),
      targetId: input.targetId === undefined || input.targetId === null ? null : String(input.targetId),
      targetType: input.targetType,
      ipAddress: input.ipAddress ?? null,
    });
  }

  async list(input: {
    action?: string;
    page?: number;
    pageSize?: number;
    query?: string;
    sortBy?: "createdAt" | "actor" | "action";
    sortDirection?: "asc" | "desc";
    targetType?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AuditLogListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const normalizedQuery = input.query?.trim() ?? "";
    const normalizedAction = input.action?.trim() ?? "";
    const normalizedTargetType = input.targetType?.trim() ?? "";
    const queryPattern = `%${normalizedQuery}%`;
    const conditions: Array<SQL | undefined> = [
      normalizedQuery
        ? or(
            ilike(auditLogs.action, queryPattern),
            ilike(auditLogs.targetType, queryPattern),
            ilike(auditLogs.targetId, queryPattern),
            ilike(auditLogs.payload, queryPattern),
            ilike(users.nameKo, queryPattern),
            ilike(users.email, queryPattern),
            sql`EXISTS (
              SELECT 1 FROM users AS target_user
              WHERE target_user.user_id::text = ${auditLogs.targetId}
                AND (target_user.name_ko ILIKE ${queryPattern}
                  OR target_user.std_no ILIKE ${queryPattern}
                  OR target_user.email ILIKE ${queryPattern})
            )`,
          )
        : undefined,
      normalizedAction ? eq(auditLogs.action, normalizedAction) : undefined,
      normalizedTargetType ? eq(auditLogs.targetType, normalizedTargetType) : undefined,
      input.dateFrom ? gte(auditLogs.createdAt, isoToDate(input.dateFrom)) : undefined,
      input.dateTo ? lte(auditLogs.createdAt, isoToDate(input.dateTo)) : undefined,
    ].filter(Boolean);
    const whereClause = conditions.length === 0 ? undefined : and(...conditions);
    const direction = input.sortDirection === "asc" ? asc : desc;
    const sortBy = input.sortBy ?? "createdAt";
    const primarySort = sortBy === "actor"
      ? direction(users.nameKo)
      : sortBy === "action"
        ? direction(auditLogs.action)
        : direction(auditLogs.createdAt);

    const rows = await this.db
      .select({
        action: auditLogs.action,
        actorNameKo: users.nameKo,
        actorUserId: auditLogs.actorUserId,
        auditLogId: auditLogs.auditLogId,
        createdAt: auditLogs.createdAt,
        ipAddress: auditLogs.ipAddress,
        payload: auditLogs.payload,
        targetId: auditLogs.targetId,
        targetType: auditLogs.targetType,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.userId))
      .where(whereClause)
      .orderBy(primarySort, desc(auditLogs.createdAt), desc(auditLogs.auditLogId))
      .limit(pageSize)
      .offset(offset);

    const targetUserIds = [...new Set(rows.flatMap((row) => {
      const ids: string[] = [];
      if ((row.targetType === "user" || row.targetType === "student_fee_status") && row.targetId && UUID_PATTERN.test(row.targetId)) {
        ids.push(row.targetId);
      }
      if (row.targetType === "role_group_member" && row.targetId) {
        const candidate = row.targetId.split(":")[1];
        if (candidate && UUID_PATTERN.test(candidate)) ids.push(candidate);
      }
      return ids;
    }))];
    const targetUsers = targetUserIds.length === 0
      ? []
      : await this.db
        .select({ userId: users.userId, nameKo: users.nameKo, stdNo: users.stdNo })
        .from(users)
        .where(inArray(users.userId, targetUserIds));
    const targetUserMap = new Map(targetUsers.map((user) => [user.userId, user]));

    const items = rows.map((row) => {
      const definition = actionDefinition(row.action, row.targetType);
      const domain = DOMAIN_DEFINITIONS[row.targetType] ?? {
        domain: row.targetType,
        label: TARGET_TYPE_LABELS[row.targetType] ?? "시스템",
      };
      const payload = parsePayload(row.payload);
      const after = recordFromPayload(payload, "after") ?? recordFromPayload(payload, "created");
      const deleted = recordFromPayload(payload, "deleted");
      const snapshot = after ?? deleted;
      let targetLabel = TARGET_TYPE_LABELS[row.targetType] ?? "시스템 대상";

      if (row.targetType === "user" || row.targetType === "student_fee_status") {
        targetLabel = userLabel(row.targetId ? targetUserMap.get(row.targetId) : undefined) ?? `${domain.label} 대상`;
      } else if (row.targetType === "student_fee_payment") {
        const count = typeof payload.count === "number" ? payload.count : Array.isArray(payload.paymentIds) ? payload.paymentIds.length : 0;
        targetLabel = count > 0 ? `${count}명 학생회비 수납 대상` : "학생회비 수납 대상";
      } else if (row.targetType === "role_group_member") {
        const memberId = row.targetId?.split(":")[1];
        targetLabel = userLabel(memberId ? targetUserMap.get(memberId) : undefined) ?? "역할 구성원";
      } else if (row.targetType === "role_group") {
        targetLabel = stringValue(snapshot?.nameKo) ?? "역할 그룹";
      } else if (row.targetType === "content_block") {
        targetLabel = stringValue(snapshot?.titleKo) ?? stringValue(snapshot?.titleEn) ?? "콘텐츠 블록";
      } else if (row.targetType === "site_content") {
        targetLabel = row.targetId ? `공개 문구 · ${row.targetId}` : "공개 문구";
      } else if (row.targetType === "executive_contact") {
        targetLabel = stringValue(snapshot?.nameKo) ?? (typeof payload.removedCount === "number" ? `${payload.removedCount}명 연락망` : "집행위 연락망");
      } else if (row.targetType === "article") {
        targetLabel = stringValue(snapshot?.titleKo) ?? "게시글";
      }

      return {
        action: row.action,
        actionLabel: definition.label,
        actorNameKo: row.actorNameKo ?? null,
        actorUserId: row.actorUserId ?? null,
        auditLogId: row.auditLogId,
        createdAt: msToIso(row.createdAt.valueOf()),
        domain: domain.domain,
        domainLabel: domain.label,
        eventKind: definition.kind,
        ipAddress: row.ipAddress ?? null,
        payload: row.payload ?? null,
        targetId: row.targetId ?? null,
        targetLabel,
        targetType: row.targetType,
      };
    });

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.userId))
      .where(whereClause);

    return { items, page, pageSize, total: Number(countResult[0]?.count ?? 0) };
  }
}
