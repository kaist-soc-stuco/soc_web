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
  asset: { domain: "asset", label: "첨부 파일" },
  article_draft: { domain: "board", label: "게시글 초안" },
  audit_log: { domain: "audit", label: "운영 로그" },
  auth: { domain: "security", label: "인증" },
  board: { domain: "board", label: "게시판 설정" },
  bulk_email: { domain: "email", label: "일괄 이메일" },
  bulk_email_draft: { domain: "email", label: "이메일 초안" },
  bulk_email_template: { domain: "email", label: "이메일 양식" },
  calendar: { domain: "calendar", label: "일정" },
  calendar_event: { domain: "calendar", label: "일정" },
  content_block: { domain: "content", label: "콘텐츠" },
  executive_contact: { domain: "contact", label: "집행위" },
  roadmap_course: { domain: "roadmap", label: "로드맵 과목" },
  roadmap_offering: { domain: "roadmap", label: "로드맵 개설 정보" },
  role_group: { domain: "permission", label: "권한" },
  role_group_member: { domain: "permission", label: "권한" },
  site_content: { domain: "content", label: "사이트" },
  student_fee_payment: { domain: "fee", label: "과비" },
  student_fee_status: { domain: "fee", label: "과비" },
  survey_answer_file: { domain: "survey", label: "설문 응답 파일" },
  user: { domain: "user", label: "유저" },
  article: { domain: "board", label: "게시판" },
  comment: { domain: "board", label: "댓글" },
  survey: { domain: "survey", label: "설문" },
  survey_section: { domain: "survey", label: "설문 섹션" },
  survey_question: { domain: "survey", label: "설문 문항" },
  survey_response: { domain: "survey", label: "설문 응답" },
  vote: { domain: "vote", label: "투표" },
};

const ACTION_DEFINITIONS: Record<string, { label: string; kind: AuditLogEventKind }> = {
  "article_draft.create": { label: "게시글 초안 저장", kind: "CREATE" },
  "article_draft.delete": { label: "게시글 초안 삭제", kind: "DELETE" },
  "article_draft.update": { label: "게시글 초안 수정", kind: "UPDATE" },
  "asset.cleanup": { label: "첨부 파일 정리", kind: "EXECUTE" },
  "asset.migrate": { label: "첨부 파일 저장소 이전", kind: "BATCH" },
  "asset.upload": { label: "첨부 파일 업로드", kind: "CREATE" },
  "asset.upload.complete": { label: "첨부 파일 업로드 완료", kind: "EXECUTE" },
  "asset.upload.prepare": { label: "첨부 파일 업로드 준비", kind: "EXECUTE" },
  "audit.export": { label: "운영 로그 내보내기", kind: "EXECUTE" },
  "auth.login.consent": { label: "로그인 개인정보 동의", kind: "EXECUTE" },
  "auth.login.success": { label: "로그인 성공", kind: "EXECUTE" },
  "auth.logout": { label: "로그아웃", kind: "EXECUTE" },
  "auth.sso.callback": { label: "SSO 로그인 처리", kind: "EXECUTE" },
  "board.archive": { label: "게시판 보관", kind: "EXECUTE" },
  "board.create": { label: "게시판 생성", kind: "CREATE" },
  "board.delete": { label: "게시판 영구 삭제", kind: "DELETE" },
  "board.reorder": { label: "게시판 순서 변경", kind: "EXECUTE" },
  "board.update": { label: "게시판 설정 수정", kind: "UPDATE" },
  "bulk_email.cancel": { label: "일괄 이메일 예약 취소", kind: "EXECUTE" },
  "bulk_email.draft.create": { label: "이메일 초안 저장", kind: "CREATE" },
  "bulk_email.draft.delete": { label: "이메일 초안 삭제", kind: "DELETE" },
  "bulk_email.draft.update": { label: "이메일 초안 수정", kind: "UPDATE" },
  "bulk_email.retry": { label: "일괄 이메일 재발송", kind: "EXECUTE" },
  "bulk_email.schedule": { label: "일괄 이메일 발송 예약", kind: "EXECUTE" },
  "bulk_email.send": { label: "일괄 이메일 발송", kind: "BATCH" },
  "bulk_email.send_failed": { label: "일괄 이메일 발송 실패", kind: "EXECUTE" },
  "bulk_email.template.create": { label: "이메일 양식 생성", kind: "CREATE" },
  "bulk_email.template.delete": { label: "이메일 양식 삭제", kind: "DELETE" },
  "bulk_email.template.update": { label: "이메일 양식 수정", kind: "UPDATE" },
  "bulk_email.test_send": { label: "테스트 이메일 발송", kind: "EXECUTE" },
  "calendar.archive": { label: "일정 숨김", kind: "EXECUTE" },
  "calendar.export": { label: "일정 내보내기", kind: "EXECUTE" },
  "calendar.presentation.update": { label: "일정 표시 설정 수정", kind: "UPDATE" },
  "calendar.sync.external": { label: "외부 일정 동기화", kind: "EXECUTE" },
  "calendar.sync.google": { label: "Google 일정 동기화", kind: "EXECUTE" },
  "calendar.sync.kaist": { label: "KAIST 학사 일정 동기화", kind: "EXECUTE" },
  "calendar_event.create": { label: "일정 생성", kind: "CREATE" },
  "calendar_event.import": { label: "일정 가져오기", kind: "BATCH" },
  "calendar_event.update": { label: "일정 수정", kind: "UPDATE" },
  "content_block.archive": { label: "콘텐츠 보관", kind: "EXECUTE" },
  "content_block.create": { label: "콘텐츠 생성", kind: "CREATE" },
  "content_block.delete": { label: "콘텐츠 삭제", kind: "DELETE" },
  "content_block.publish": { label: "콘텐츠 게시", kind: "EXECUTE" },
  "content_block.reorder": { label: "콘텐츠 순서 변경", kind: "EXECUTE" },
  "content_block.schedule": { label: "콘텐츠 게시 예약", kind: "EXECUTE" },
  "content_block.update": { label: "콘텐츠 수정", kind: "UPDATE" },
  "roadmap_course.create": { label: "로드맵 과목 생성", kind: "CREATE" },
  "roadmap_course.update": { label: "로드맵 과목 수정", kind: "UPDATE" },
  "roadmap_offering.create": { label: "로드맵 개설 정보 생성", kind: "CREATE" },
  "roadmap_offering.delete": { label: "로드맵 개설 정보 삭제", kind: "DELETE" },
  "roadmap_offering.update": { label: "로드맵 개설 정보 수정", kind: "UPDATE" },
  "roadmap_offerings.import": { label: "로드맵 개설 정보 불러오기", kind: "BATCH" },
  "role_group.create": { label: "역할 그룹 생성", kind: "CREATE" },
  "role_group.delete": { label: "역할 그룹 삭제", kind: "DELETE" },
  "role_group.update": { label: "역할 그룹 수정", kind: "UPDATE" },
  "role_group_member.add": { label: "구성원 추가", kind: "EXECUTE" },
  "role_group_member.remove": { label: "구성원 제외", kind: "EXECUTE" },
  "role_group_member.replace": { label: "구성원 일괄 변경", kind: "BATCH" },
  "executive_contact.create": { label: "연락망 구성원 생성", kind: "CREATE" },
  "executive_contact.delete": { label: "연락망 구성원 삭제", kind: "DELETE" },
  "executive_contact.department.create": { label: "연락망 부서 생성", kind: "CREATE" },
  "executive_contact.department.delete": { label: "연락망 부서 삭제", kind: "DELETE" },
  "executive_contact.department.update": { label: "연락망 부서 수정", kind: "UPDATE" },
  "executive_contact.export": { label: "연락망 내보내기", kind: "EXECUTE" },
  "executive_contact.import": { label: "연락망 불러오기", kind: "BATCH" },
  "executive_contact.reorder": { label: "연락망 순서 변경", kind: "EXECUTE" },
  "executive_contact.spreadsheet.connect": { label: "연락망 시트 연결", kind: "EXECUTE" },
  "executive_contact.spreadsheet.sync": { label: "연락망 시트 동기화", kind: "EXECUTE" },
  "executive_contact.update": { label: "연락망 구성원 수정", kind: "UPDATE" },
  "student_fee.export": { label: "과비 내보내기", kind: "EXECUTE" },
  "student_fee.spreadsheet.connect": { label: "과비 시트 연결", kind: "EXECUTE" },
  "student_fee.spreadsheet.sync": { label: "과비 시트 동기화", kind: "EXECUTE" },
  "site_content.create": { label: "공개 문구 생성", kind: "CREATE" },
  "site_content.delete": { label: "공개 문구 삭제", kind: "DELETE" },
  "site_content.update": { label: "공개 문구 수정", kind: "UPDATE" },
  "student_fee_payment.process": { label: "일괄 수납 처리", kind: "BATCH" },
  "student_fee_status.update": { label: "수납 상태 변경", kind: "UPDATE" },
  "survey.create": { label: "설문 생성", kind: "CREATE" },
  "survey.update": { label: "설문 수정", kind: "UPDATE" },
  "survey.delete": { label: "설문 삭제", kind: "DELETE" },
  "survey.publish": { label: "설문 게시", kind: "EXECUTE" },
  "survey.unpublish": { label: "설문 게시 취소", kind: "EXECUTE" },
  "survey.duplicate": { label: "설문 복제", kind: "CREATE" },
  "survey.spreadsheet.connect": { label: "설문 응답 시트 연결", kind: "EXECUTE" },
  "survey.spreadsheet.sync": { label: "설문 응답 시트 동기화", kind: "EXECUTE" },
  "survey.section.create": { label: "설문 섹션 생성", kind: "CREATE" },
  "survey.section.update": { label: "설문 섹션 수정", kind: "UPDATE" },
  "survey.section.delete": { label: "설문 섹션 삭제", kind: "DELETE" },
  "survey.section.reorder": { label: "설문 섹션 순서 변경", kind: "EXECUTE" },
  "survey.question.create": { label: "설문 문항 생성", kind: "CREATE" },
  "survey.question.update": { label: "설문 문항 수정", kind: "UPDATE" },
  "survey.question.delete": { label: "설문 문항 삭제", kind: "DELETE" },
  "survey.question.reorder": { label: "설문 문항 순서 변경", kind: "EXECUTE" },
  "survey_response.submit": { label: "설문 응답 제출", kind: "CREATE" },
  "survey_response.update": { label: "설문 응답 수정", kind: "UPDATE" },
  "article.create": { label: "게시글 등록", kind: "CREATE" },
  "article.update": { label: "게시글 수정", kind: "UPDATE" },
  "article.delete": { label: "게시글 삭제", kind: "DELETE" },
  "article.reorder": { label: "게시글 순서 변경", kind: "EXECUTE" },
  "article.engagement.like": { label: "게시글 좋아요 변경", kind: "EXECUTE" },
  "article.engagement.scrap": { label: "게시글 스크랩 변경", kind: "EXECUTE" },
  "article.hide": { label: "게시글 숨김", kind: "EXECUTE" },
  "article.restore": { label: "게시글 숨김 해제", kind: "EXECUTE" },
  "comment.create": { label: "댓글 게시", kind: "CREATE" },
  "comment.update": { label: "댓글 수정", kind: "UPDATE" },
  "comment.delete": { label: "댓글 삭제", kind: "DELETE" },
  "comment.engagement.like": { label: "댓글 좋아요 변경", kind: "EXECUTE" },
  "comment.hide": { label: "댓글 숨김", kind: "EXECUTE" },
  "comment.restore": { label: "댓글 숨김 해제", kind: "EXECUTE" },
  "user.account.activate": { label: "계정 활성화", kind: "UPDATE" },
  "user.account.expire": { label: "계정 만료", kind: "UPDATE" },
  "user.posting_suspend": { label: "게시 작성 제한", kind: "EXECUTE" },
  "user.posting_resume": { label: "게시 작성 제한 해제", kind: "EXECUTE" },
  "article.anonymous_identity_reveal": { label: "익명 작성자 확인", kind: "EXECUTE" },
  "survey.answer_file.download": { label: "설문 응답 파일 다운로드", kind: "EXECUTE" },
  CONTACT_PRIVACY_PURGE: { label: "개인정보 파기", kind: "EXECUTE" },
  "vote.close": { label: "투표 마감", kind: "EXECUTE" },
  "vote.create": { label: "투표 생성", kind: "CREATE" },
  "vote.delete": { label: "투표 삭제", kind: "DELETE" },
  "vote.publish": { label: "투표 게시", kind: "EXECUTE" },
  "vote.results.publish": { label: "투표 결과 공개", kind: "EXECUTE" },
  "vote.submit": { label: "투표 참여", kind: "CREATE" },
  "vote.tally": { label: "투표 집계", kind: "EXECUTE" },
  "vote.update": { label: "투표 수정", kind: "UPDATE" },
  "vote.voter.add": { label: "투표인 명부 추가", kind: "BATCH" },
  "vote.voter.exclude": { label: "투표인 명부 제외", kind: "BATCH" },
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  asset: "첨부 파일",
  article: "게시글",
  article_draft: "게시글 초안",
  audit_log: "운영 로그",
  auth: "인증",
  board: "게시판 설정",
  bulk_email: "일괄 이메일",
  bulk_email_draft: "이메일 초안",
  bulk_email_template: "이메일 양식",
  calendar: "일정 작업",
  calendar_event: "일정",
  comment: "댓글",
  content_block: "콘텐츠",
  executive_contact: "집행위 연락망",
  roadmap_course: "로드맵 과목",
  roadmap_offering: "로드맵 개설 정보",
  role_group: "역할 그룹",
  role_group_member: "역할 구성원",
  site_content: "공개 문구",
  student_fee_payment: "학생회비 납부",
  student_fee_status: "학생회비 상태",
  survey: "설문",
  survey_section: "설문 섹션",
  survey_question: "설문 문항",
  survey_response: "설문 응답",
  survey_answer_file: "설문 응답 파일",
  user: "사용자",
  vote: "투표",
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
      } else if (row.targetType === "asset") {
        targetLabel = "첨부 파일";
      } else if (row.targetType === "article_draft") {
        targetLabel = `게시글 초안${stringValue(snapshot?.boardCode) ? ` · ${stringValue(snapshot?.boardCode)}` : ""}`;
      } else if (row.targetType === "audit_log") {
        targetLabel = "운영 로그 XLSX";
      } else if (row.targetType === "auth") {
        targetLabel = "인증/세션";
      } else if (row.targetType === "board") {
        targetLabel = stringValue(snapshot?.nameKo) ?? stringValue(snapshot?.code) ?? "게시판 설정";
      } else if (row.targetType === "bulk_email") {
        const count = typeof payload.recipientCount === "number" ? payload.recipientCount : 0;
        targetLabel = count > 0 ? `일괄 이메일 · ${count}명` : "일괄 이메일";
      } else if (row.targetType === "bulk_email_draft") {
        targetLabel = "이메일 초안";
      } else if (row.targetType === "bulk_email_template") {
        targetLabel = stringValue(snapshot?.name) ?? "이메일 양식";
      } else if (row.targetType === "calendar" || row.targetType === "calendar_event") {
        targetLabel = stringValue(snapshot?.titleKo) ?? "일정 작업";
      } else if (row.targetType === "roadmap_course" || row.targetType === "roadmap_offering") {
        const courseCode = stringValue(snapshot?.courseCode) ?? stringValue(payload.courseCode);
        targetLabel = courseCode ? `${domain.label} · ${courseCode}` : domain.label;
      } else if (row.targetType === "site_content") {
        targetLabel = row.targetId ? `공개 문구 · ${row.targetId}` : "공개 문구";
      } else if (row.targetType === "executive_contact") {
        targetLabel = stringValue(snapshot?.nameKo) ?? (typeof payload.removedCount === "number" ? `${payload.removedCount}명 연락망` : "집행위 연락망");
      } else if (row.targetType === "article") {
        targetLabel = stringValue(snapshot?.titleKo) ?? stringValue(payload.titleKo) ?? "게시글";
      } else if (row.targetType === "survey") {
        targetLabel = stringValue(snapshot?.titleKo) ?? stringValue(payload.surveyTitleKo) ?? "설문";
      } else if (row.targetType === "survey_section") {
        targetLabel = stringValue(snapshot?.titleKo) ?? "설문 섹션";
      } else if (row.targetType === "survey_question") {
        targetLabel = stringValue(snapshot?.titleKo) ?? "설문 문항";
      } else if (row.targetType === "survey_response") {
        const responseLabel = (payload.isAnonymous ?? snapshot?.isAnonymous)
          ? "익명 설문 응답"
          : "설문 응답";
        targetLabel = `${responseLabel} · ${stringValue(payload.surveyTitleKo) ?? stringValue(snapshot?.surveyTitleKo) ?? "설문"}`;
      } else if (row.targetType === "comment") {
        targetLabel = `${(payload.isReply ?? snapshot?.isReply) ? "대댓글" : "댓글"} · 게시글 ${stringValue(payload.articleId) ?? stringValue(snapshot?.articleId) ?? ""}`;
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
