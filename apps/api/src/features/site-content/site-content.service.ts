import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ContentBlockRecord,
  CreateContentBlockRequest,
  PublicSiteContentRecord,
  ReorderContentBlocksRequest,
  SiteContentKey,
  SiteContentRecord,
  UpdateContentBlockRequest,
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

  async listContentBlocksAdmin(): Promise<ContentBlockRecord[]> {
    return this.siteContentRepository.listContentBlocks();
  }

  async listContentBlocksPublic(): Promise<ContentBlockRecord[]> {
    const blocks = await this.siteContentRepository.listContentBlocks();
    return blocks.filter((block) => block.status === "PUBLISHED");
  }

  async createContentBlock(input: CreateContentBlockRequest, audit: AuditMetadata): Promise<ContentBlockRecord> {
    if (input.type === "HERO" && !input.imageUrl) {
      throw new BadRequestException("hero_image_required");
    }
    if (input.type === "ORGANIZATION_CHART") {
      if (!input.imageUrl) throw new BadRequestException("organization_chart_image_required");
      const existing = await this.siteContentRepository.listContentBlocks();
      if (existing.some((block) => block.type === "ORGANIZATION_CHART")) {
        throw new ConflictException("organization_chart_already_exists");
      }
    }
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
    const nextType = input.type ?? before.type;
    const nextImageUrl = input.imageUrl === undefined ? before.imageUrl : input.imageUrl;
    if (nextType === "HERO" && !nextImageUrl) {
      throw new BadRequestException("hero_image_required");
    }
    if (nextType === "ORGANIZATION_CHART") {
      if (!nextImageUrl) throw new BadRequestException("organization_chart_image_required");
      const existing = await this.siteContentRepository.listContentBlocks();
      if (existing.some((block) =>
        block.contentBlockId !== contentBlockId &&
        block.type === "ORGANIZATION_CHART",
      )) {
        throw new ConflictException("organization_chart_already_exists");
      }
    }
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

  async reorderContentBlocks(
    input: ReorderContentBlocksRequest,
    audit: AuditMetadata,
  ): Promise<ContentBlockRecord[]> {
    const after = await this.siteContentRepository.reorderContentBlocks(input.items, audit.actorUserId);
    await this.auditLogService.record({
      action: "content_block.reorder",
      actorUserId: audit.actorUserId,
      ipAddress: audit.ipAddress ?? null,
      payload: { items: input.items },
      targetId: "content-blocks",
      targetType: "content_block",
    });
    return after;
  }

  async publishContentBlock(
    contentBlockId: string,
    audit: AuditMetadata,
  ): Promise<ContentBlockRecord> {
    const before = await this.siteContentRepository.findContentBlockById(contentBlockId);
    if (!before) throw new NotFoundException("content_block_not_found");
    const after = await this.siteContentRepository.setContentBlockStatus(contentBlockId, "PUBLISHED", audit.actorUserId);
    if (!after) throw new NotFoundException("content_block_not_found");
    await this.auditLogService.record({
      action: "content_block.publish",
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
