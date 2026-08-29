import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminRoadmapOfferingListResponse,
  CreateRoadmapCourseRequest,
  CreateRoadmapOfferingRequest,
  RoadmapImportCommitRequest,
  RoadmapImportPreviewResponse,
  RoadmapOfferingImportResponse,
  RoadmapOfferingListResponse,
  UpdateRoadmapCourseRequest,
  UpdateRoadmapOfferingRequest,
} from "@soc/contracts";

import { AuditLogService } from "../audit/audit-log.service";
import { parseRoadmapWorkbook, type RoadmapImportResult } from "./roadmap-importer";
import { RoadmapRepository, type RoadmapImportDecision } from "./roadmap.repository";

const IMPORT_ERRORS = new Set([
  "roadmap_workbook_unreadable",
  "roadmap_workbook_empty",
  "roadmap_workbook_headers_invalid",
  "roadmap_import_no_eligible_rows",
  "roadmap_import_too_many_rows",
]);

@Injectable()
export class RoadmapService {
  constructor(
    private readonly roadmapRepository: RoadmapRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listPublic(): Promise<RoadmapOfferingListResponse> {
    const data = await this.roadmapRepository.findAdminData();
    return data;
  }

  async listAdmin(): Promise<AdminRoadmapOfferingListResponse> {
    return this.roadmapRepository.findAdminData();
  }

  async previewWorkbook(
    file: { buffer: Buffer; originalname: string },
  ): Promise<RoadmapImportPreviewResponse> {
    const fileName = normalizeFileName(file.originalname);
    const parsed = this.parse(file.buffer, fileName);
    const catalog = await this.roadmapRepository.findCatalog();
    const knownCodes = new Set(catalog.map((course) => course.courseCode));
    const courseMap = new Map<string, RoadmapImportPreviewResponse["newCourses"][number]>();

    for (const row of parsed.rows) {
      const current = courseMap.get(row.courseCode);
      if (current) {
        current.offeringCount += 1;
        continue;
      }
      courseMap.set(row.courseCode, {
        courseCode: row.courseCode,
        currentCode: row.currentCode,
        existingCourse: knownCodes.has(row.courseCode),
        legacyCourseCode: row.legacyCourseCode,
        nameKo: row.nameKo,
        offeringCount: 1,
        term: row.term,
      });
    }

    return {
      fileName,
      importedCount: parsed.rows.length,
      newCourses: [...courseMap.values()].filter((course) => !course.existingCourse),
      skippedCount: parsed.skippedCount,
      terms: [...new Set(parsed.rows.map((row) => row.term))].sort(),
      warnings: parsed.warnings,
    };
  }

  async importWorkbook(
    file: { buffer: Buffer; originalname: string },
    actorUserId: string,
    decisions: RoadmapImportCommitRequest["decisions"] = {},
  ): Promise<RoadmapOfferingImportResponse> {
    const fileName = normalizeFileName(file.originalname);
    const parsed = this.parse(file.buffer, fileName);
    const normalizedDecisions: Record<string, RoadmapImportDecision> = {};
    for (const [code, decision] of Object.entries(decisions)) {
      normalizedDecisions[code] = decision;
    }

    const items = await this.roadmapRepository.replaceTerms(
      parsed.rows,
      fileName,
      actorUserId,
      normalizedDecisions,
    );
    const terms = await this.roadmapRepository.findTermSummaries();

    await this.auditLogService.record({
      action: "roadmap_offerings.import",
      actorUserId,
      payload: {
        fileName,
        importedCount: parsed.rows.length,
        skippedCount: parsed.skippedCount,
        terms: terms.map((term) => term.term),
      },
      targetType: "roadmap_offering",
    });

    return {
      fileName,
      importedCount: items.length,
      skippedCount: parsed.skippedCount,
      terms,
      warnings: parsed.warnings,
    };
  }

  async createCourse(input: CreateRoadmapCourseRequest, actorUserId: string) {
    const course = await this.roadmapRepository.createCourse(input);
    await this.auditLogService.record({
      action: "roadmap_course.create",
      actorUserId,
      payload: { courseCode: course.courseCode },
      targetId: course.courseId,
      targetType: "roadmap_course",
    });
    return course;
  }

  async updateCourse(
    courseCode: string,
    input: UpdateRoadmapCourseRequest,
    actorUserId: string,
  ) {
    const course = await this.roadmapRepository.updateCourse(courseCode, input);
    if (!course) throw new NotFoundException("roadmap_course_not_found");
    await this.auditLogService.record({
      action: "roadmap_course.update",
      actorUserId,
      payload: { courseCode: course.courseCode },
      targetId: course.courseId,
      targetType: "roadmap_course",
    });
    return course;
  }

  async createOffering(input: CreateRoadmapOfferingRequest, actorUserId: string) {
    const offering = await this.roadmapRepository.createOffering(input, actorUserId);
    await this.auditLogService.record({
      action: "roadmap_offering.create",
      actorUserId,
      payload: { courseCode: offering.courseCode, term: offering.term },
      targetId: offering.offeringId,
      targetType: "roadmap_offering",
    });
    return offering;
  }

  async updateOffering(
    offeringId: string,
    input: UpdateRoadmapOfferingRequest,
    actorUserId: string,
  ) {
    const offering = await this.roadmapRepository.updateOffering(offeringId, input);
    if (!offering) throw new NotFoundException("roadmap_offering_not_found");
    await this.auditLogService.record({
      action: "roadmap_offering.update",
      actorUserId,
      payload: { courseCode: offering.courseCode, term: offering.term },
      targetId: offering.offeringId,
      targetType: "roadmap_offering",
    });
    return offering;
  }

  async deleteOffering(offeringId: string, actorUserId: string): Promise<void> {
    const deleted = await this.roadmapRepository.deleteOffering(offeringId);
    if (!deleted) throw new NotFoundException("roadmap_offering_not_found");
    await this.auditLogService.record({
      action: "roadmap_offering.delete",
      actorUserId,
      payload: { offeringId },
      targetId: offeringId,
      targetType: "roadmap_offering",
    });
  }

  private parse(buffer: Buffer, fileName: string): RoadmapImportResult {
    try {
      return parseRoadmapWorkbook(buffer, fileName);
    } catch (error) {
      const code = error instanceof Error ? error.message : "roadmap_workbook_unreadable";
      if (IMPORT_ERRORS.has(code)) throw new BadRequestException(code);
      throw error;
    }
  }
}

function normalizeFileName(value: string): string {
  return value.trim().slice(0, 255) || "roadmap.xlsx";
}
