export type RoadmapViewport = { x: number; y: number; zoom: number };
export type RoadmapViewportSize = { width: number; height: number };
type Point = { x: number; y: number };

// Zero velocity and acceleration at both ends, without an intermediate zoom-out.
export const easeRoadmapCamera = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function isCourseComfortablyVisible(current: RoadmapViewport, size: RoadmapViewportSize, card: Point & { width: number; height: number }) {
  if (current.zoom < 1) return false;
  const left = current.x + card.x * current.zoom, top = current.y + card.y * current.zoom;
  return left >= 24 && top >= 24 && left + card.width * current.zoom <= size.width - 24 && top + card.height * current.zoom <= size.height - 24;
}

export function getCourseFocusViewport(current: RoadmapViewport, size: RoadmapViewportSize, center: Point, reducedMotion = false) {
  const zoom = current.zoom >= 1 ? current.zoom : 1.1;
  const viewport = { x: size.width / 2 - center.x * zoom, y: size.height / 2 - center.y * zoom, zoom };
  const distance = Math.hypot(viewport.x - current.x, viewport.y - current.y);
  const zoomDistance = Math.abs(Math.log(zoom / current.zoom));
  const diagonal = Math.max(1, Math.hypot(size.width, size.height));
  const duration = reducedMotion || (distance < 1 && zoomDistance < 0.001)
    ? 0
    : Math.round(Math.min(750, 500 + distance / diagonal * 160 + zoomDistance * 120));
  return { viewport, duration };
}
