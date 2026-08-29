import { Inject, Injectable } from "@nestjs/common";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type {
  AdminRoadmapOfferingListResponse,
  CreateRoadmapCourseRequest,
  CreateRoadmapOfferingRequest,
  RoadmapCourseRecord,
  RoadmapCourseRelationRecord,
  RoadmapOfferingRecord,
  RoadmapOfferingTermSummary,
  UpdateRoadmapCourseRequest,
  UpdateRoadmapOfferingRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  type PostgresDatabase,
  type PostgresTransaction,
} from "../../infrastructure/postgres/postgres.provider";
import {
  roadmapCourseRelations,
  roadmapCourses,
  roadmapOfferings,
  roadmapTerms,
} from "../../infrastructure/postgres/postgres.schema";
import {
  getRoadmapLegacyCourseCode,
  normalizeRoadmapCourseCode,
} from "@soc/contracts";
import type { RoadmapImportRow } from "./roadmap-importer";

export type RoadmapImportDecision = {
  action: "ADD_TO_ROADMAP" | "SKIP";
  category?: CreateRoadmapCourseRequest["category"];
  trackIds?: string[];
  nameEn?: string;
  semesters?: string;
  credits?: string;
};

@Injectable()
export class RoadmapRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async findAll(): Promise<RoadmapOfferingRecord[]> {
    const rows = await this.db
      .select()
      .from(roadmapOfferings)
      .orderBy(
        desc(roadmapOfferings.term),
        asc(roadmapOfferings.courseCode),
        asc(roadmapOfferings.section),
      );

    return rows.map(mapOffering);
  }

  async findCatalog(): Promise<RoadmapCourseRecord[]> {
    const [courseRows, relationRows] = await Promise.all([
      this.db
        .select()
        .from(roadmapCourses)
        .orderBy(asc(roadmapCourses.courseCode)),
      this.db.select().from(roadmapCourseRelations),
    ]);

    const codeById = new Map(courseRows.map((row) => [row.courseId, row.courseCode]));
    return courseRows.map((row) => mapCourse(row, relationRows, codeById));
  }

  async findRelations(): Promise<RoadmapCourseRelationRecord[]> {
    const [rows, courseRows] = await Promise.all([
      this.db.select().from(roadmapCourseRelations),
      this.db
        .select({ courseId: roadmapCourses.courseId, courseCode: roadmapCourses.courseCode })
        .from(roadmapCourses),
    ]);
    const codeById = new Map(courseRows.map((row) => [row.courseId, row.courseCode]));

    return rows.flatMap((row) => {
      const prerequisiteCourseCode = codeById.get(row.prerequisiteCourseId);
      const postrequisiteCourseCode = codeById.get(row.postrequisiteCourseId);
      return prerequisiteCourseCode && postrequisiteCourseCode
        ? [{ prerequisiteCourseCode, postrequisiteCourseCode }]
        : [];
    });
  }

  async findTermSummaries(): Promise<RoadmapOfferingTermSummary[]> {
    const [items, termRows] = await Promise.all([
      this.findAll(),
      this.db.select().from(roadmapTerms).orderBy(desc(roadmapTerms.term)),
    ]);
    const summaries = new Map(
      summarizeRoadmapOfferings(items).map((summary) => [summary.term, summary]),
    );

    for (const row of termRows) {
      const current = summaries.get(row.term);
      summaries.set(row.term, {
        courseCount: current?.courseCount ?? 0,
        importedAt: msToIso(row.importedAt.valueOf()),
        offeringCount: current?.offeringCount ?? 0,
        sourceFileName: row.sourceFileName ?? null,
        term: row.term,
      });
    }

    return [...summaries.values()].sort((left, right) => right.term.localeCompare(left.term));
  }

  async findAdminData(): Promise<AdminRoadmapOfferingListResponse> {
    const [items, courses, relations, terms] = await Promise.all([
      this.findAll(),
      this.findCatalog(),
      this.findRelations(),
      this.findTermSummaries(),
    ]);
    return { courses, items, relations, terms };
  }

  async findCourseByCode(courseCode: string): Promise<RoadmapCourseRecord | null> {
    const normalizedCode = normalizeRoadmapCourseCode(courseCode);
    const [row] = await this.db
      .select()
      .from(roadmapCourses)
      .where(eq(roadmapCourses.courseCode, normalizedCode));
    if (!row) return null;
    const relations = await this.db.select().from(roadmapCourseRelations);
    const courseRows = await this.db
      .select({ courseId: roadmapCourses.courseId, courseCode: roadmapCourses.courseCode })
      .from(roadmapCourses);
    return mapCourse(row, relations, new Map(courseRows.map((item) => [item.courseId, item.courseCode])));
  }

  async createCourse(input: CreateRoadmapCourseRequest): Promise<RoadmapCourseRecord> {
    const courseCode = normalizeRoadmapCourseCode(input.courseCode);
    const [row] = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(roadmapCourses)
        .values({
          ai: input.ai,
          category: input.category,
          courseCode,
          credits: input.credits,
          legacyCourseCode:
            input.legacyCourseCode ?? getRoadmapLegacyCourseCode(courseCode),
          nameEn: input.nameEn,
          nameKo: input.nameKo,
          semesters: input.semesters,
          source: "MANUAL",
          trackIds: input.trackIds,
          updatedAt: nowDate(),
          isVisible: input.isVisible,
        })
        .returning();
      await replacePrerequisites(tx, created.courseId, input.prerequisiteCourseCodes);
      return [created];
    });
    const result = await this.findCourseByCode(row.courseCode);
    if (!result) throw new Error("roadmap_course_create_failed");
    return result;
  }

  async updateCourse(
    courseCode: string,
    input: UpdateRoadmapCourseRequest,
  ): Promise<RoadmapCourseRecord | null> {
    const normalizedCode = normalizeRoadmapCourseCode(courseCode);
    const updatedCode = input.courseCode
      ? normalizeRoadmapCourseCode(input.courseCode)
      : normalizedCode;
    const result = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(roadmapCourses)
        .where(eq(roadmapCourses.courseCode, normalizedCode));
      if (!current) return null;

      const values: Partial<typeof roadmapCourses.$inferInsert> = { updatedAt: nowDate() };
      if (input.courseCode !== undefined) values.courseCode = updatedCode;
      if (input.legacyCourseCode !== undefined) {
        values.legacyCourseCode =
          input.legacyCourseCode ?? getRoadmapLegacyCourseCode(updatedCode);
      }
      if (input.nameKo !== undefined) values.nameKo = input.nameKo;
      if (input.nameEn !== undefined) values.nameEn = input.nameEn;
      if (input.category !== undefined) values.category = input.category;
      if (input.credits !== undefined) values.credits = input.credits;
      if (input.semesters !== undefined) values.semesters = input.semesters;
      if (input.trackIds !== undefined) values.trackIds = input.trackIds;
      if (input.ai !== undefined) values.ai = input.ai;
      if (input.isVisible !== undefined) values.isVisible = input.isVisible;

      const [updated] = await tx
        .update(roadmapCourses)
        .set(values)
        .where(eq(roadmapCourses.courseId, current.courseId))
        .returning();
      if (input.prerequisiteCourseCodes !== undefined) {
        await replacePrerequisites(tx, current.courseId, input.prerequisiteCourseCodes);
      }
      return updated ?? null;
    });
    if (!result) return null;
    return this.findCourseByCode(result.courseCode);
  }

  async createOffering(
    input: CreateRoadmapOfferingRequest,
    importedBy: string,
  ): Promise<RoadmapOfferingRecord> {
    const importedAt = nowDate();
    const [row] = await this.db
      .insert(roadmapOfferings)
      .values({
        capacity: input.capacity ?? null,
        courseCode: normalizeRoadmapCourseCode(input.courseCode),
        credits: input.credits ?? null,
        currentCode: input.currentCode,
        delivery: input.delivery ?? null,
        enrolled: input.enrolled ?? null,
        importedAt,
        importedBy,
        inEnglish: input.inEnglish,
        instructor: input.instructor ?? null,
        nameKo: input.nameKo,
        room: input.room ?? null,
        section: input.section ?? null,
        sourceData: { source: "manual" },
        sourceFileName: null,
        term: input.term,
        time: input.time ?? null,
      })
      .returning();
    return mapOffering(row);
  }

  async updateOffering(
    offeringId: string,
    input: UpdateRoadmapOfferingRequest,
  ): Promise<RoadmapOfferingRecord | null> {
    const values: Partial<typeof roadmapOfferings.$inferInsert> = {};
    if (input.term !== undefined) values.term = input.term;
    if (input.courseCode !== undefined) values.courseCode = normalizeRoadmapCourseCode(input.courseCode);
    if (input.currentCode !== undefined) values.currentCode = input.currentCode;
    if (input.nameKo !== undefined) values.nameKo = input.nameKo;
    if (input.section !== undefined) values.section = input.section;
    if (input.instructor !== undefined) values.instructor = input.instructor;
    if (input.credits !== undefined) values.credits = input.credits;
    if (input.time !== undefined) values.time = input.time;
    if (input.room !== undefined) values.room = input.room;
    if (input.capacity !== undefined) values.capacity = input.capacity;
    if (input.enrolled !== undefined) values.enrolled = input.enrolled;
    if (input.delivery !== undefined) values.delivery = input.delivery;
    if (input.inEnglish !== undefined) values.inEnglish = input.inEnglish;
    if (Object.keys(values).length === 0) return null;

    const [row] = await this.db
      .update(roadmapOfferings)
      .set(values)
      .where(eq(roadmapOfferings.offeringId, offeringId))
      .returning();
    return row ? mapOffering(row) : null;
  }

  async deleteOffering(offeringId: string): Promise<boolean> {
    const rows = await this.db
      .delete(roadmapOfferings)
      .where(eq(roadmapOfferings.offeringId, offeringId))
      .returning({ offeringId: roadmapOfferings.offeringId });
    return rows.length > 0;
  }

  async replaceTerms(
    rows: RoadmapImportRow[],
    sourceFileName: string,
    importedBy: string,
    decisions: Record<string, RoadmapImportDecision> = {},
  ): Promise<RoadmapOfferingRecord[]> {
    const importedAt = nowDate();
    const terms = [...new Set(rows.map((row) => row.term))];

    return this.db.transaction(async (tx) => {
      await tx
        .insert(roadmapTerms)
        .values(
          terms.map((term) => ({
            importedAt,
            importedBy,
            sourceFileName,
            term,
            updatedAt: importedAt,
          })),
        )
        .onConflictDoUpdate({
          target: roadmapTerms.term,
          set: { importedAt, importedBy, sourceFileName, updatedAt: importedAt },
        });

      const courseRows = new Map<string, RoadmapImportRow>();
      for (const row of rows) {
        if (!courseRows.has(row.courseCode)) courseRows.set(row.courseCode, row);
      }
      const codes = [...courseRows.keys()];
      const existingRows = codes.length
        ? await tx
            .select({ courseCode: roadmapCourses.courseCode })
            .from(roadmapCourses)
            .where(inArray(roadmapCourses.courseCode, codes))
        : [];
      const existingCodes = new Set(existingRows.map((row) => row.courseCode));

      for (const [courseCode, row] of courseRows) {
        if (existingCodes.has(courseCode)) continue;
        const decision = decisions[courseCode];
        if (decision?.action === "SKIP") continue;
        await tx.insert(roadmapCourses).values({
          ai: false,
          category: decision?.category ?? "major-elective",
          courseCode,
          credits: decision?.credits ?? row.credits ?? "",
          legacyCourseCode:
            row.legacyCourseCode ?? getRoadmapLegacyCourseCode(courseCode),
          nameEn: decision?.nameEn ?? "",
          nameKo: row.nameKo,
          semesters: decision?.semesters ?? "S/F",
          source: "IMPORT",
          trackIds: decision?.trackIds ?? [],
          updatedAt: importedAt,
          isVisible: true,
        });
      }

      for (const term of terms) {
        await tx.delete(roadmapOfferings).where(eq(roadmapOfferings.term, term));
      }

      await tx.insert(roadmapOfferings).values(
        rows.map((row) => ({
          capacity: row.capacity,
          courseCode: row.courseCode,
          credits: row.credits,
          currentCode: row.currentCode,
          delivery: row.delivery,
          enrolled: row.enrolled,
          importedAt,
          importedBy,
          inEnglish: row.inEnglish,
          instructor: row.instructor,
          nameKo: row.nameKo,
          room: row.room,
          section: row.section,
          sourceData: row.sourceData,
          sourceFileName,
          term: row.term,
          time: row.time,
        })),
      );

      const inserted = await tx
        .select()
        .from(roadmapOfferings)
        .where(eq(roadmapOfferings.importedAt, importedAt))
        .orderBy(
          desc(roadmapOfferings.term),
          asc(roadmapOfferings.courseCode),
          asc(roadmapOfferings.section),
        );

      return inserted.map(mapOffering);
    });
  }
}

async function replacePrerequisites(
  tx: PostgresTransaction,
  courseId: string,
  prerequisiteCourseCodes: string[],
): Promise<void> {
  await tx
    .delete(roadmapCourseRelations)
    .where(eq(roadmapCourseRelations.postrequisiteCourseId, courseId));
  const codes = [...new Set(prerequisiteCourseCodes.map(normalizeRoadmapCourseCode))].filter(
    (code) => code.length > 0,
  );
  if (codes.length === 0) return;
  const rows = await tx
    .select({ courseId: roadmapCourses.courseId, courseCode: roadmapCourses.courseCode })
    .from(roadmapCourses)
    .where(inArray(roadmapCourses.courseCode, codes));
  const values = rows
    .filter((row) => row.courseId !== courseId)
    .map((row) => ({
      postrequisiteCourseId: courseId,
      prerequisiteCourseId: row.courseId,
    }));
  if (values.length > 0) {
    await tx.insert(roadmapCourseRelations).values(values).onConflictDoNothing();
  }
}

function mapCourse(
  row: typeof roadmapCourses.$inferSelect,
  relations: Array<typeof roadmapCourseRelations.$inferSelect>,
  codeById: ReadonlyMap<string, string>,
): RoadmapCourseRecord {
  const prerequisiteCourseCodes: string[] = [];
  const postrequisiteCourseCodes: string[] = [];
  for (const relation of relations) {
    if (relation.postrequisiteCourseId === row.courseId) {
      const code = codeById.get(relation.prerequisiteCourseId);
      if (code) prerequisiteCourseCodes.push(code);
    }
    if (relation.prerequisiteCourseId === row.courseId) {
      const code = codeById.get(relation.postrequisiteCourseId);
      if (code) postrequisiteCourseCodes.push(code);
    }
  }
  return {
    ai: row.ai,
    category: row.category as RoadmapCourseRecord["category"],
    courseCode: row.courseCode,
    courseId: row.courseId,
    credits: row.credits,
    createdAt: msToIso(row.createdAt.valueOf()),
    isVisible: row.isVisible,
    legacyCourseCode: row.legacyCourseCode ?? getRoadmapLegacyCourseCode(row.courseCode),
    nameEn: row.nameEn,
    nameKo: row.nameKo,
    postrequisiteCourseCodes,
    prerequisiteCourseCodes,
    semesters: row.semesters,
    source: row.source,
    trackIds: row.trackIds ?? [],
    updatedAt: msToIso(row.updatedAt.valueOf()),
  };
}

export function summarizeRoadmapOfferings(
  items: RoadmapOfferingRecord[],
): RoadmapOfferingTermSummary[] {
  const summaries = new Map<string, RoadmapOfferingTermSummary & { courseCodes: Set<string> }>();

  for (const item of items) {
    const summary = summaries.get(item.term) ?? {
      courseCodes: new Set<string>(),
      courseCount: 0,
      importedAt: item.importedAt,
      offeringCount: 0,
      sourceFileName: item.sourceFileName,
      term: item.term,
    };
    summary.courseCodes.add(item.courseCode);
    summary.courseCount = summary.courseCodes.size;
    summary.offeringCount += 1;
    if (item.importedAt > summary.importedAt) summary.importedAt = item.importedAt;
    if (!summary.sourceFileName && item.sourceFileName) summary.sourceFileName = item.sourceFileName;
    summaries.set(item.term, summary);
  }

  return [...summaries.values()]
    .map(({ courseCodes: _courseCodes, ...summary }) => summary)
    .sort((left, right) => right.term.localeCompare(left.term));
}

function mapOffering(
  row: typeof roadmapOfferings.$inferSelect,
): RoadmapOfferingRecord {
  return {
    capacity: row.capacity ?? null,
    courseCode: row.courseCode,
    credits: row.credits ?? null,
    currentCode: row.currentCode,
    delivery: row.delivery ?? null,
    enrolled: row.enrolled ?? null,
    importedAt: msToIso(row.importedAt.valueOf()),
    inEnglish: row.inEnglish,
    instructor: row.instructor ?? null,
    nameKo: row.nameKo,
    offeringId: row.offeringId,
    room: row.room ?? null,
    section: row.section ?? null,
    sourceFileName: row.sourceFileName ?? null,
    term: row.term,
    time: row.time ?? null,
  };
}
