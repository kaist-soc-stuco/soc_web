import { Controller, Get, Header, Query } from "@nestjs/common";
import * as XLSX from "xlsx";
import { Permissions } from "@soc/contracts";
import { isoToDate } from "@soc/shared";

import { RequirePermissions } from "../auth/guards";
import { AuditLogService } from "./audit-log.service";

@Controller("audit-logs")
@RequirePermissions(Permissions.ADMIN)
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
  ): Promise<Buffer> {
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
    const worksheet = XLSX.utils.json_to_sheet(items.map((item) => ({
      로그번호: item.auditLogId,
      발생시각: item.createdAt,
      도메인: item.domainLabel,
      이벤트유형: item.eventKind,
      액션: item.actionLabel,
      대상: item.targetLabel,
      담당자: item.actorNameKo ?? "시스템",
      대상유형: item.targetType,
      기술액션코드: item.action,
      접속IP: item.ipAddress ?? "",
      기술페이로드: item.payload ?? "",
    })));
    worksheet["!cols"] = [
      { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 24 },
      { wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 34 }, { wch: 18 }, { wch: 72 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "운영 로그");
    return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
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
