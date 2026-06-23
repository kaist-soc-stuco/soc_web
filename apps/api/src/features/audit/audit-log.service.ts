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
  }): Promise<AuditLogListResponse> {
    return this.auditLogRepository.list(input);
  }
}
