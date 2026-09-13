export type Point = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";
export type Card = Point & { id: string };
const W = 184;
const H = 108;
const CLEAR = 7;
const DESIRED_STUB = 16;
const CORNER_RADIUS = 9;
const TURN_PENALTY = 150;

type Direction = 0 | 1 | 2 | 3;

function directionForSide(side: Side): Direction {
  if (side === "right") return 0;
  if (side === "left") return 1;
  if (side === "bottom") return 2;
  return 3;
}

function directionAwayFromSide(side: Side): Direction {
  if (side === "left") return 0;
  if (side === "right") return 1;
  if (side === "top") return 2;
  return 3;
}

function stubDistance(point: Point, side: Side, card: Card, cards: Card[]) {
  let distance = DESIRED_STUB;
  for (const other of cards) {
    if (other.id === card.id) continue;
    if (side === "left" || side === "right") {
      const overlaps = point.y > other.y - CLEAR && point.y < other.y + H + CLEAR;
      if (!overlaps) continue;
      if (side === "right" && other.x >= point.x) distance = Math.min(distance, other.x - point.x - CLEAR);
      if (side === "left" && other.x + W <= point.x) distance = Math.min(distance, point.x - (other.x + W) - CLEAR);
    } else {
      const overlaps = point.x > other.x - CLEAR && point.x < other.x + W + CLEAR;
      if (!overlaps) continue;
      if (side === "bottom" && other.y >= point.y) distance = Math.min(distance, other.y - point.y - CLEAR);
      if (side === "top" && other.y + H <= point.y) distance = Math.min(distance, point.y - (other.y + H) - CLEAR);
    }
  }
  return Math.max(2, distance);
}

function movePoint(point: Point, side: Side, distance: number): Point {
  return {
    x: point.x + (side === "left" ? -distance : side === "right" ? distance : 0),
    y: point.y + (side === "top" ? -distance : side === "bottom" ? distance : 0),
  };
}

type QueueItem = { cost: number; state: number };

function pushQueue(queue: QueueItem[], item: QueueItem) {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].cost <= item.cost) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = item;
}

function popQueue(queue: QueueItem[]): QueueItem {
  const first = queue[0]!;
  const last = queue.pop();
  if (!last || queue.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let child = left;
    if (right < queue.length && queue[right].cost < queue[left].cost) child = right;
    if (child >= queue.length || queue[child].cost >= last.cost) break;
    queue[index] = queue[child];
    index = child;
  }
  queue[index] = last;
  return first;
}

// Route through card gutters, never through a course rectangle. Group backgrounds
// remain traversable so long connections resemble the original poster's buses.
export function routeConnection(source: Card, target: Card, cards: Card[]) {
  const dx = target.x - source.x, dy = target.y - source.y;
  const horizontal = Math.abs(dx) >= W;
  const sourceSide: Side = horizontal ? (dx > 0 ? "right" : "left") : (dy > 0 ? "bottom" : "top");
  const targetSide: Side = horizontal ? (dx > 0 ? "left" : "right") : (dy > 0 ? "top" : "bottom");
  const port = (c: Card, side: Side): Point => ({ x: c.x + (side === "left" ? 0 : side === "right" ? W : W / 2), y: c.y + (side === "top" ? 0 : side === "bottom" ? H : H / 2) });
  const start = port(source, sourceSide), end = port(target, targetSide);
  const a = movePoint(start, sourceSide, stubDistance(start, sourceSide, source, cards));
  const b = movePoint(end, targetSide, stubDistance(end, targetSide, target, cards));
  const xs = [...new Set([a.x, b.x, ...cards.flatMap(c => [c.x - CLEAR, c.x + W + CLEAR])])].sort((a,b)=>a-b);
  const ys = [...new Set([a.y, b.y, ...cards.flatMap(c => [c.y - CLEAR, c.y + H + CLEAR])])].sort((a,b)=>a-b);
  const blocked = (p: Point, q: Point) => cards.some(c => p.x === q.x
    ? p.x > c.x - CLEAR + .1 && p.x < c.x + W + CLEAR - .1 && Math.max(p.y,q.y) > c.y - CLEAR + .1 && Math.min(p.y,q.y) < c.y + H + CLEAR - .1
    : p.y > c.y - CLEAR + .1 && p.y < c.y + H + CLEAR - .1 && Math.max(p.x,q.x) > c.x - CLEAR + .1 && Math.min(p.x,q.x) < c.x + W + CLEAR - .1);
  const index = (p: Point) => ys.indexOf(p.y) * xs.length + xs.indexOf(p.x);
  const point = (i: number) => ({ x: xs[i % xs.length], y: ys[Math.floor(i / xs.length)] });
  const first = index(a), last = index(b);
  const startDirection = directionForSide(sourceSide);
  const endDirection = directionAwayFromSide(targetSide);
  const startState = first * 4 + startDirection;
  const distances = new Map<number, number>([[startState, 0]]);
  const previous = new Map<number, number>();
  const queue: QueueItem[] = [];
  pushQueue(queue, { cost: 0, state: startState });
  let goalState: number | undefined;
  let fallbackGoalState: number | undefined;
  let fallbackGoalCost = Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    const current = popQueue(queue);
    if (current.cost !== distances.get(current.state)) continue;
    const currentIndex = Math.floor(current.state / 4);
    const currentDirection = (current.state % 4) as Direction;
    if (currentIndex === last) {
      if (current.cost < fallbackGoalCost) {
        fallbackGoalCost = current.cost;
        fallbackGoalState = current.state;
      }
      if (currentDirection === endDirection) {
        goalState = current.state;
        break;
      }
    }

    const x = currentIndex % xs.length;
    const y = Math.floor(currentIndex / xs.length);
    const currentPoint = point(currentIndex);
    const neighborIndexes = [
      x + 1 < xs.length ? currentIndex + 1 : -1,
      x > 0 ? currentIndex - 1 : -1,
      y + 1 < ys.length ? currentIndex + xs.length : -1,
      y > 0 ? currentIndex - xs.length : -1,
    ];
    for (const nextIndex of neighborIndexes) {
      if (nextIndex < 0 || blocked(currentPoint, point(nextIndex))) continue;
      const nextPoint = point(nextIndex);
      const nextDirection = (nextPoint.x !== currentPoint.x
        ? nextPoint.x > currentPoint.x ? 0 : 1
        : nextPoint.y > currentPoint.y ? 2 : 3) as Direction;
      const nextState = nextIndex * 4 + nextDirection;
      const step = Math.abs(nextPoint.x - currentPoint.x) + Math.abs(nextPoint.y - currentPoint.y);
      const nextCost = current.cost + step + (nextDirection === currentDirection ? 0 : TURN_PENALTY);
      if (nextCost >= (distances.get(nextState) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(nextState, nextCost);
      previous.set(nextState, current.state);
      pushQueue(queue, { cost: nextCost, state: nextState });
    }
  }

  const resolvedGoalState = goalState ?? fallbackGoalState;
  if (resolvedGoalState === undefined) return null;
  const middle: Point[] = [];
  for (let state: number | undefined = resolvedGoalState; state !== undefined; state = previous.get(state)) {
    middle.push(point(Math.floor(state / 4)));
  }
  const raw = [start, ...middle.reverse(), end];
  const points = raw.filter((p, i) => {
    if (i === 0 || i === raw.length - 1) return true;
    const previousPoint = raw[i - 1];
    const nextPoint = raw[i + 1];
    if (p.x === previousPoint.x && p.y === previousPoint.y) return false;
    return !((previousPoint.x === p.x && p.x === nextPoint.x) || (previousPoint.y === p.y && p.y === nextPoint.y));
  });
  return { sourceSide, targetSide, points };
}

export function roundedPath(points: Point[]) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i-1], b = points[i], c = points[i+1];
    const before = Math.hypot(b.x-a.x,b.y-a.y), after = Math.hypot(c.x-b.x,c.y-b.y);
    const r = Math.min(CORNER_RADIUS, before/2, after/2);
    const p = {x:b.x+(a.x-b.x)*r/before,y:b.y+(a.y-b.y)*r/before};
    const q = {x:b.x+(c.x-b.x)*r/after,y:b.y+(c.y-b.y)*r/after};
    path += ` L ${p.x} ${p.y} Q ${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  const end = points[points.length-1];
  return `${path} L ${end.x} ${end.y}`;
}
