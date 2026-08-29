import type {
  AdminRoadmapOfferingListResponse,
  CreateRoadmapCourseRequest,
  CreateRoadmapOfferingRequest,
  RoadmapImportCommitRequest,
  RoadmapImportPreviewResponse,
  RoadmapOfferingImportResponse,
  RoadmapOfferingListResponse,
  RoadmapCourseRecord,
  RoadmapOfferingRecord,
  UpdateRoadmapCourseRequest,
  UpdateRoadmapOfferingRequest,
} from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export const createRoadmapApi = ({
  requestJson,
  roadmapBaseUrl,
}: ApiClientContext) => ({
  getRoadmapOfferings: async (): Promise<RoadmapOfferingListResponse> => {
    return requestJson<RoadmapOfferingListResponse>(
      `${roadmapBaseUrl}/offerings`,
      { method: "GET" },
    );
  },

  getAdminRoadmapOfferings: async (): Promise<AdminRoadmapOfferingListResponse> => {
    return requestJson<AdminRoadmapOfferingListResponse>(
      `${roadmapBaseUrl}/admin`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  importRoadmapOfferings: async (
    file: File,
    decisions?: RoadmapImportCommitRequest["decisions"],
  ): Promise<RoadmapOfferingImportResponse> => {
    const body = new FormData();
    body.append("file", file);
    if (decisions && Object.keys(decisions).length > 0) {
      body.append("decisions", JSON.stringify({ decisions }));
    }
    return requestJson<RoadmapOfferingImportResponse>(
      decisions ? `${roadmapBaseUrl}/admin/import/commit` : `${roadmapBaseUrl}/admin/import`,
      {
        body,
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  previewRoadmapImport: async (file: File): Promise<RoadmapImportPreviewResponse> => {
    const body = new FormData();
    body.append("file", file);
    return requestJson<RoadmapImportPreviewResponse>(
      `${roadmapBaseUrl}/admin/import/preview`,
      { body, method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  createRoadmapCourse: async (input: CreateRoadmapCourseRequest): Promise<RoadmapCourseRecord> =>
    requestJson<RoadmapCourseRecord>(
      `${roadmapBaseUrl}/admin/courses`,
      { body: JSON.stringify(input), headers: { "Content-Type": "application/json" }, method: "POST" },
      { retryOnUnauthorized: true },
    ),

  updateRoadmapCourse: async (
    courseCode: string,
    input: UpdateRoadmapCourseRequest,
  ): Promise<RoadmapCourseRecord> =>
    requestJson<RoadmapCourseRecord>(
      `${roadmapBaseUrl}/admin/courses/${encodeURIComponent(courseCode)}`,
      { body: JSON.stringify(input), headers: { "Content-Type": "application/json" }, method: "PATCH" },
      { retryOnUnauthorized: true },
    ),

  createRoadmapOffering: async (input: CreateRoadmapOfferingRequest): Promise<RoadmapOfferingRecord> =>
    requestJson<RoadmapOfferingRecord>(
      `${roadmapBaseUrl}/admin/offerings`,
      { body: JSON.stringify(input), headers: { "Content-Type": "application/json" }, method: "POST" },
      { retryOnUnauthorized: true },
    ),

  updateRoadmapOffering: async (
    offeringId: string,
    input: UpdateRoadmapOfferingRequest,
  ): Promise<RoadmapOfferingRecord> =>
    requestJson<RoadmapOfferingRecord>(
      `${roadmapBaseUrl}/admin/offerings/${encodeURIComponent(offeringId)}`,
      { body: JSON.stringify(input), headers: { "Content-Type": "application/json" }, method: "PATCH" },
      { retryOnUnauthorized: true },
    ),

  deleteRoadmapOffering: async (offeringId: string): Promise<{ success: boolean }> =>
    requestJson<{ success: boolean }>(
      `${roadmapBaseUrl}/admin/offerings/${encodeURIComponent(offeringId)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    ),
});
