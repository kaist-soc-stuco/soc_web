import { Injectable, Logger } from "@nestjs/common";
import type { AuditLogListResponse } from "@soc/contracts";

import {
  AuditLogRepository,
  type AuditLogCreateInput,
} from "./audit-log.repository";

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(input: AuditLogCreateInput): Promise<void> {
    try {
      await this.auditLogRepository.create(input);
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log for ${input.action}/${input.targetType}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
    return this.auditLogRepository.list(input);
  }

  async export(input: Parameters<AuditLogService["list"]>[0]): Promise<AuditLogListResponse["items"]> {
    const pageSize = 100;
    const first = await this.auditLogRepository.list({ ...input, page: 1, pageSize });
    const items = [...first.items];
    const pages = Math.ceil(first.total / first.pageSize);
    for (let page = 2; page <= pages; page += 1) {
      const next = await this.auditLogRepository.list({ ...input, page, pageSize });
      items.push(...next.items);
    }
    return items;
  }
}
