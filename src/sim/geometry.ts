export type Point = {
  x: number;
  y: number;
};

export function length(point: Point): number {
  return Math.hypot(point.x, point.y);
}

export function normalize(point: Point): Point {
  const distance = length(point);

  if (distance === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: point.x / distance,
    y: point.y / distance,
  };
}

export function add(a: Point, b: Point): Point {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function scale(point: Point, factor: number): Point {
  return {
    x: point.x * factor,
    y: point.y * factor,
  };
}

export function clampPointToCircle(
  point: Point,
  center: Point,
  radius: number,
  tokenRadius: number,
): Point {
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    return { x: 0, y: 0 };
  }

  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(tokenRadius)
  ) {
    return { ...center };
  }

  const playableRadius = radius - Math.max(0, tokenRadius);

  if (playableRadius <= 0) {
    return { ...center };
  }

  const fromCenter = add(point, scale(center, -1));
  const distance = length(fromCenter);

  if (distance <= playableRadius) {
    return { ...point };
  }

  return add(center, scale(normalize(fromCenter), playableRadius));
}
