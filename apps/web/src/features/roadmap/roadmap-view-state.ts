import type { RoadmapViewport, RoadmapViewportSize } from "./roadmap-camera";

const STORAGE_KEY = "soc.roadmap.view.v1";
export type SavedRoadmapViewport = RoadmapViewport & RoadmapViewportSize & { courseCode: string | null };
export interface RoadmapViewState {
  selectedTerm: string;
  offeredOnly: boolean;
  selectedTrackIds: string[];
  searchText: string;
  selectedCourseCode: string | null;
  selectedInstanceId: string | null;
  viewport: SavedRoadmapViewport | null;
}

let rememberedView: RoadmapViewState | null = null;

export function parseRoadmapViewState(raw: string | null): RoadmapViewState | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object" || typeof state.selectedTerm !== "string" || !state.selectedTerm.trim()
      || typeof state.offeredOnly !== "boolean" || typeof state.searchText !== "string"
      || !Array.isArray(state.selectedTrackIds) || !state.selectedTrackIds.every((id: unknown) => typeof id === "string")
      || !(state.selectedCourseCode === null || typeof state.selectedCourseCode === "string")
      || !(state.selectedInstanceId === null || typeof state.selectedInstanceId === "string")) return null;
    const view = state.viewport;
    if (view !== null && (!view || ![view.x, view.y, view.zoom, view.width, view.height].every(Number.isFinite)
      || view.zoom < 0.1 || view.zoom > 1.7 || view.width <= 0 || view.height <= 0
      || !(view.courseCode === null || typeof view.courseCode === "string"))) return null;
    return state as RoadmapViewState;
  } catch { return null; }
}

export function readRoadmapViewState(): RoadmapViewState | null {
  try { return parseRoadmapViewState(window.sessionStorage.getItem(STORAGE_KEY)) ?? rememberedView; }
  catch { return rememberedView; }
}

export function saveRoadmapViewState(state: RoadmapViewState) {
  rememberedView = state;
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* Keep same-tab navigation working when browser storage is unavailable. */ }
}

export function restoreRoadmapViewport(saved: SavedRoadmapViewport, size: RoadmapViewportSize): RoadmapViewport {
  return { x: saved.x + (size.width - saved.width) / 2, y: saved.y + (size.height - saved.height) / 2, zoom: saved.zoom };
}
