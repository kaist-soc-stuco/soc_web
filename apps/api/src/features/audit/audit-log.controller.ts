import { Controller, Get, Query } from "@nestjs/common";
import { Permissions } from "@soc/contracts";

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
    });
  }
}
