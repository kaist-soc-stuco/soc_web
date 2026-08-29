import type { z } from "zod";

import type {
  CreateRoadmapCourseSchema,
  CreateRoadmapOfferingSchema,
  RoadmapImportCommitSchema,
  UpdateRoadmapCourseSchema,
  UpdateRoadmapOfferingSchema,
} from "../schemas.js";

/**
 * KAIST's current course number is a five-digit number. Keep the previous
 * number as an alias so old links and imported workbooks remain searchable.
 */
export const ROADMAP_LEGACY_COURSE_CODE_MAP: Record<string, string> = {
  CS101: "CS10001",
  CS109: "CS10009",
  CS202: "CS20002",
  CS204: "CS20004",
  CS206: "CS20006",
  CS211: "CS20101",
  CS220: "CS20200",
  CS230: "CS20300",
  CS270: "CS20700",
  CS300: "CS30000",
  CS310: "CS30100",
  CS311: "CS30101",
  CS320: "CS30200",
  CS322: "CS30202",
  CS330: "CS30300",
  CS341: "CS30401",
  CS348: "CS30408",
  CS350: "CS30500",
  CS360: "CS30600",
  CS361: "CS30601",
  CS370: "CS30700",
  CS371: "CS30701",
  CS372: "CS30702",
  CS374: "CS30704",
  CS376: "CS30706",
  CS377: "CS30707",
  CS380: "CS30800",
  CS402: "CS40002",
  CS408: "CS40008",
  CS411: "CS40101",
  CS420: "CS40200",
  CS422: "CS40202",
  CS423: "CS40203",
  CS424: "CS40204",
  CS431: "CS40301",
  CS442: "CS40402",
  CS443: "CS40403",
  CS447: "CS40407",
  CS453: "CS40503",
  CS454: "CS40504",
  CS457: "CS40507",
  CS458: "CS40508",
  CS459: "CS40509",
  // CS470 was temporarily published as CS.40700 in spring 2026 and moved
  // to CS.30703 from fall 2026. Keep both legacy forms resolving to the
  // current roadmap master course.
  CS470: "CS30703",
  CS40700: "CS30703",
  CS40804: "CS30705",
  CS471: "CS40701",
  CS473: "CS40703",
  CS474: "CS40704",
  CS475: "CS40705",
  CS477: "CS40707",
  CS479: "CS40709",
  CS481: "CS40801",
  CS482: "CS40802",
  CS484: "CS30705",
  CS485: "CS40805",
  CS486: "CS40806",
  CS489: "CS40809",
  CS492: "CS49900",
  CS494: "CS49902",
  CS496: "CS93000",
};

export function normalizeRoadmapCourseCode(value: string): string {
  const normalized = value.trim().replace(/[.\s]/g, "").toUpperCase();
  return ROADMAP_LEGACY_COURSE_CODE_MAP[normalized] ?? normalized;
}

export type RoadmapCourseCategory =
  | "basic-required"
  | "basic-elective"
  | "major-required"
  | "major-elective";

export interface RoadmapCourseRecord {
  courseId: string;
  courseCode: string;
  legacyCourseCode: string | null;
  nameKo: string;
  nameEn: string;
  category: RoadmapCourseCategory;
  credits: string;
  semesters: string;
  trackIds: string[];
  ai: boolean;
  positionX: number;
  positionY: number;
  isVisible: boolean;
  source: string;
  prerequisiteCourseCodes: string[];
  postrequisiteCourseCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapCourseRelationRecord {
  prerequisiteCourseCode: string;
  postrequisiteCourseCode: string;
}

export interface RoadmapOfferingRecord {
  offeringId: string;
  term: string;
  courseCode: string;
  currentCode: string;
  nameKo: string;
  section: string | null;
  instructor: string | null;
  credits: string | null;
  time: string | null;
  room: string | null;
  capacity: number | null;
  enrolled: number | null;
  delivery: string | null;
  inEnglish: boolean;
  sourceFileName: string | null;
  importedAt: string;
}

export interface RoadmapOfferingTermSummary {
  term: string;
  offeringCount: number;
  courseCount: number;
  sourceFileName: string | null;
  importedAt: string;
}

export interface RoadmapImportPreviewCourse {
  courseCode: string;
  legacyCourseCode: string | null;
  currentCode: string;
  nameKo: string;
  term: string;
  offeringCount: number;
  existingCourse: boolean;
}

export interface RoadmapOfferingListResponse {
  items: RoadmapOfferingRecord[];
  courses?: RoadmapCourseRecord[];
  relations?: RoadmapCourseRelationRecord[];
  terms?: RoadmapOfferingTermSummary[];
}

export interface AdminRoadmapOfferingListResponse extends RoadmapOfferingListResponse {
  courses: RoadmapCourseRecord[];
  relations: RoadmapCourseRelationRecord[];
  terms: RoadmapOfferingTermSummary[];
}

export interface RoadmapOfferingImportResponse {
  fileName: string;
  importedCount: number;
  skippedCount: number;
  terms: RoadmapOfferingTermSummary[];
  warnings: string[];
}

export interface RoadmapImportPreviewResponse {
  fileName: string;
  terms: string[];
  importedCount: number;
  skippedCount: number;
  warnings: string[];
  newCourses: RoadmapImportPreviewCourse[];
}

export type CreateRoadmapCourseRequest = z.infer<typeof CreateRoadmapCourseSchema>;
export type UpdateRoadmapCourseRequest = z.infer<typeof UpdateRoadmapCourseSchema>;
export type CreateRoadmapOfferingRequest = z.infer<typeof CreateRoadmapOfferingSchema>;
export type UpdateRoadmapOfferingRequest = z.infer<typeof UpdateRoadmapOfferingSchema>;
export type RoadmapImportCommitRequest = z.infer<typeof RoadmapImportCommitSchema>;
