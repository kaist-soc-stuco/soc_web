import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  ContentBlockRecord,
  CreateContentBlockRequest,
  PublicSiteContentRecord,
  SiteContentKey,
  SiteContentRecord,
  UpdateContentBlockRequest,
  UpsertSiteContentRequest,
} from "@soc/contracts";
import { nowMs } from "@soc/shared";

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

  async listContentBlocksAdmin(): Promise<ContentBlockRecord[]> {
    return this.siteContentRepository.listContentBlocks();
  }

  async listContentBlocksPublic(): Promise<ContentBlockRecord[]> {
    const now = nowMs();
    const blocks = await this.siteContentRepository.listContentBlocks();
    return blocks.filter((block) =>
      block.isEnabled &&
      (block.status === "PUBLISHED" || block.status === "SCHEDULED") &&
      (!block.startsAt || Date.parse(block.startsAt) <= now) &&
      (!block.endsAt || Date.parse(block.endsAt) > now),
    );
  }

  async createContentBlock(input: CreateContentBlockRequest, audit: AuditMetadata): Promise<ContentBlockRecord> {
    const after = await this.siteContentRepository.createContentBlock(input, audit.actorUserId);
    await this.auditLogService.record({
      action: "content_block.create",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { after },
      targetId: after.contentBlockId,
      targetType: "content_block",
    });
    return after;
  }

  async updateContentBlock(
    contentBlockId: string,
    input: UpdateContentBlockRequest,
    audit: AuditMetadata,
  ): Promise<ContentBlockRecord> {
    const before = await this.siteContentRepository.findContentBlockById(contentBlockId);
    if (!before) throw new NotFoundException("content_block_not_found");
    const after = await this.siteContentRepository.updateContentBlock(contentBlockId, input, audit.actorUserId);
    if (!after) throw new NotFoundException("content_block_not_found");
    await this.auditLogService.record({
      action: "content_block.update",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { after, before },
      targetId: contentBlockId,
      targetType: "content_block",
    });
    return after;
  }

  async setContentBlockStatus(
    contentBlockId: string,
    status: "PUBLISHED" | "ARCHIVED",
    audit: AuditMetadata,
  ): Promise<ContentBlockRecord> {
    const before = await this.siteContentRepository.findContentBlockById(contentBlockId);
    if (!before) throw new NotFoundException("content_block_not_found");
    const effectiveStatus =
      status === "PUBLISHED" && before.startsAt && Date.parse(before.startsAt) > nowMs()
        ? "SCHEDULED"
        : status;
    const after = await this.siteContentRepository.setContentBlockStatus(contentBlockId, effectiveStatus, audit.actorUserId);
    if (!after) throw new NotFoundException("content_block_not_found");
    await this.auditLogService.record({
      action:
        effectiveStatus === "SCHEDULED"
          ? "content_block.schedule"
          : status === "PUBLISHED"
            ? "content_block.publish"
            : "content_block.archive",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { after, before },
      targetId: contentBlockId,
      targetType: "content_block",
    });
    return after;
  }

  async deleteContentBlock(contentBlockId: string, audit: AuditMetadata): Promise<void> {
    const deleted = await this.siteContentRepository.deleteContentBlock(contentBlockId);
    if (!deleted) throw new NotFoundException("content_block_not_found");
    await this.auditLogService.record({
      action: "content_block.delete",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { deleted },
      targetId: contentBlockId,
      targetType: "content_block",
    });
  }
}
