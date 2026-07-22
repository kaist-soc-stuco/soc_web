import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  PublicSiteContentRecord,
  SiteContentKey,
  SiteContentRecord,
  UpsertSiteContentRequest,
} from "@soc/contracts";

import { AuditLogService } from "../audit/audit-log.service";
import { SiteContentRepository } from "./site-content.repository";

interface AuditMetadata {
  actorUserId: string;
  ipAddress?: string | null;
}

const toPublicRecord = ({
  key,
  updatedAt,
  valueEn,
  valueKo,
}: SiteContentRecord): PublicSiteContentRecord => ({
  key,
  updatedAt,
  valueEn,
  valueKo,
});

@Injectable()
export class SiteContentService {
  constructor(
    private readonly siteContentRepository: SiteContentRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listPublic(): Promise<PublicSiteContentRecord[]> {
    const records = await this.siteContentRepository.findAll();
    return records.map(toPublicRecord);
  }

  async listAdmin(): Promise<SiteContentRecord[]> {
    return this.siteContentRepository.findAll();
  }

  async upsert(
    key: SiteContentKey,
    input: UpsertSiteContentRequest,
    audit: AuditMetadata,
  ): Promise<SiteContentRecord> {
    const before = await this.siteContentRepository.findByKey(key);
    const after = await this.siteContentRepository.upsert(
      key,
      input,
      audit.actorUserId,
    );

    await this.auditLogService.record({
      action: before ? "site_content.update" : "site_content.create",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { after, before },
      targetId: key,
      targetType: "site_content",
    });

    return after;
  }

  async delete(key: SiteContentKey, audit: AuditMetadata): Promise<void> {
    const deleted = await this.siteContentRepository.delete(key);

    if (!deleted) {
      throw new NotFoundException("site_content_not_found");
    }

    await this.auditLogService.record({
      action: "site_content.delete",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { deleted },
      targetId: key,
      targetType: "site_content",
    });
  }
}
