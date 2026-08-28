import { Controller, Get, Header, Query, StreamableFile } from "@nestjs/common";
import * as XLSX from "xlsx";
import { Permissions } from "@soc/contracts";
import { isoToDate } from "@soc/shared";

import { RequirePermissions } from "../auth/guards";
import { AuditLogService } from "./audit-log.service";

@Controller("audit-logs")
@RequirePermissions(Permissions.VIEW_AUDIT_LOG)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async listAuditLogs(
    @Query("action") action?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("q") query?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("targetType") targetType?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.auditLogService.list({
      action,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      query,
      sortBy:
        sortBy === "actor" || sortBy === "action" || sortBy === "createdAt"
          ? sortBy
          : "createdAt",
      sortDirection: sortDirection === "asc" ? "asc" : "desc",
      targetType,
      dateFrom: normalizeDateStart(dateFrom),
      dateTo: normalizeDateEnd(dateTo),
    });
  }

  @Get("export.xlsx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="audit-logs.xlsx"')
  async exportAuditLogs(
    @Query("action") action?: string,
    @Query("q") query?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
    @Query("targetType") targetType?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ): Promise<StreamableFile> {
    const items = await this.auditLogService.export({
      action,
      query,
      sortBy:
        sortBy === "actor" || sortBy === "action" || sortBy === "createdAt"
          ? sortBy
          : "createdAt",
      sortDirection: sortDirection === "asc" ? "asc" : "desc",
      targetType,
      dateFrom: normalizeDateStart(dateFrom),
      dateTo: normalizeDateEnd(dateTo),
    });
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["로그번호", "발생시각", "도메인", "이벤트유형", "액션", "대상", "담당자", "대상유형", "기술액션코드", "접속IP", "기술페이로드"],
      ...items.map((item) => [
        item.auditLogId,
        item.createdAt,
        item.domainLabel,
        item.eventKind,
        item.actionLabel,
        item.targetLabel,
        item.actorNameKo ?? "시스템",
        item.targetType,
        item.action,
        item.ipAddress ?? "",
        item.payload ?? "",
      ]),
    ]);
    worksheet["!cols"] = [
      { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 24 },
      { wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 34 }, { wch: 18 }, { wch: 72 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "운영 로그");
    const buffer = Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
    return new StreamableFile(buffer);
  }
}

function normalizeDateStart(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? isoToDate(`${value}T00:00:00.000Z`).toISOString()
    : undefined;
}

function normalizeDateEnd(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? isoToDate(`${value}T23:59:59.999Z`).toISOString()
    : undefined;
}
