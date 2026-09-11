export type Point = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";
export type Card = Point & { id: string };
const W = 184, H = 108, CLEAR = 7;

// Route through card gutters, never through a course rectangle. Group backgrounds
// remain traversable so long connections resemble the original poster's buses.
export function routeConnection(source: Card, target: Card, cards: Card[]) {
  const dx = target.x - source.x, dy = target.y - source.y;
  const horizontal = Math.abs(dx) >= W;
  const sourceSide: Side = horizontal ? (dx > 0 ? "right" : "left") : (dy > 0 ? "bottom" : "top");
  const targetSide: Side = horizontal ? (dx > 0 ? "left" : "right") : (dy > 0 ? "top" : "bottom");
  const port = (c: Card, side: Side): Point => ({ x: c.x + (side === "left" ? 0 : side === "right" ? W : W / 2), y: c.y + (side === "top" ? 0 : side === "bottom" ? H : H / 2) });
  const stub = (p: Point, side: Side): Point => ({ x: p.x + (side === "left" ? -CLEAR : side === "right" ? CLEAR : 0), y: p.y + (side === "top" ? -CLEAR : side === "bottom" ? CLEAR : 0) });
  const start = port(source, sourceSide), end = port(target, targetSide);
  const a = stub(start, sourceSide), b = stub(end, targetSide);
  const xs = [...new Set([a.x, b.x, ...cards.flatMap(c => [c.x - CLEAR, c.x + W + CLEAR])])].sort((a,b)=>a-b);
  const ys = [...new Set([a.y, b.y, ...cards.flatMap(c => [c.y - CLEAR, c.y + H + CLEAR])])].sort((a,b)=>a-b);
  const blocked = (p: Point, q: Point) => cards.some(c => p.x === q.x
    ? p.x > c.x - CLEAR + .1 && p.x < c.x + W + CLEAR - .1 && Math.max(p.y,q.y) > c.y - CLEAR + .1 && Math.min(p.y,q.y) < c.y + H + CLEAR - .1
    : p.y > c.y - CLEAR + .1 && p.y < c.y + H + CLEAR - .1 && Math.max(p.x,q.x) > c.x - CLEAR + .1 && Math.min(p.x,q.x) < c.x + W + CLEAR - .1);
  const index = (p: Point) => ys.indexOf(p.y) * xs.length + xs.indexOf(p.x);
  const point = (i: number) => ({ x: xs[i % xs.length], y: ys[Math.floor(i / xs.length)] });
  const first = index(a), last = index(b), queue = [first], previous = new Map<number, number>([[first, -1]]);
  for (let k = 0; k < queue.length && !previous.has(last); k++) {
    const i = queue[k], x = i % xs.length, y = Math.floor(i / xs.length);
    const neighbors = [x + 1 < xs.length ? i + 1 : -1, x > 0 ? i - 1 : -1, y + 1 < ys.length ? i + xs.length : -1, y > 0 ? i - xs.length : -1];
    neighbors.sort((i,j) => i < 0 ? 1 : j < 0 ? -1 : Math.abs(point(i).x-b.x)+Math.abs(point(i).y-b.y)-Math.abs(point(j).x-b.x)-Math.abs(point(j).y-b.y));
    for (const next of neighbors) if (next >= 0 && !previous.has(next) && !blocked(point(i), point(next))) { previous.set(next, i); queue.push(next); }
  }
  if (!previous.has(last)) return null;
  const middle: Point[] = [];
  for (let i = last; i !== -1; i = previous.get(i)!) middle.push(point(i));
  const raw = [start, ...middle.reverse(), end];
  const points = raw.filter((p,i) => i === 0 || i === raw.length-1 || !((raw[i-1].x === p.x && p.x === raw[i+1].x) || (raw[i-1].y === p.y && p.y === raw[i+1].y)));
  return { sourceSide, targetSide, points };
}

export function roundedPath(points: Point[]) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i-1], b = points[i], c = points[i+1];
    const before = Math.hypot(b.x-a.x,b.y-a.y), after = Math.hypot(c.x-b.x,c.y-b.y);
    const r = Math.min(6, before/2, after/2);
    const p = {x:b.x+(a.x-b.x)*r/before,y:b.y+(a.y-b.y)*r/before};
    const q = {x:b.x+(c.x-b.x)*r/after,y:b.y+(c.y-b.y)*r/after};
    path += ` L ${p.x} ${p.y} Q ${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  const end = points[points.length-1];
  return `${path} L ${end.x} ${end.y}`;
}
