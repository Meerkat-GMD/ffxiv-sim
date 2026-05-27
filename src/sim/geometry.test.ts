import { describe, expect, it } from 'vitest';
import {
  Point,
  add,
  clampPointToCircle,
  length,
  normalize,
  scale,
} from './geometry';

describe('geometry', () => {
  it('measures vector length', () => {
    expect(length({ x: 3, y: 4 })).toBe(5);
  });

  it('normalizes non-zero vectors and safely handles zero-length vectors', () => {
    expect(normalize({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('adds and scales points as vectors', () => {
    const point: Point = { x: 2, y: -3 };

    expect(add(point, { x: -5, y: 7 })).toEqual({ x: -3, y: 4 });
    expect(scale(point, 2.5)).toEqual({ x: 5, y: -7.5 });
  });

  it('leaves points inside the playable circle unchanged', () => {
    const point = { x: 3, y: 4 };

    expect(clampPointToCircle(point, { x: 0, y: 0 }, 10, 1)).toEqual(point);
  });

  it('clamps outside points to the playable radius from the center', () => {
    expect(clampPointToCircle({ x: 20, y: 0 }, { x: 0, y: 0 }, 10, 2)).toEqual({
      x: 8,
      y: 0,
    });
  });

  it('keeps boundary and center points stable without NaN', () => {
    expect(clampPointToCircle({ x: 8, y: 0 }, { x: 0, y: 0 }, 10, 2)).toEqual({
      x: 8,
      y: 0,
    });
    expect(clampPointToCircle({ x: 5, y: -2 }, { x: 5, y: -2 }, 10, 2)).toEqual({
      x: 5,
      y: -2,
    });
  });

  it('clamps to center when token radius is greater than arena radius', () => {
    expect(clampPointToCircle({ x: 20, y: 0 }, { x: 5, y: -2 }, 10, 12)).toEqual({
      x: 5,
      y: -2,
    });
  });

  it('treats negative token radius as zero instead of expanding the arena', () => {
    expect(clampPointToCircle({ x: 12, y: 0 }, { x: 0, y: 0 }, 10, -5)).toEqual({
      x: 10,
      y: 0,
    });
  });

  it('returns center for non-finite radius or token radius', () => {
    const center = { x: 5, y: -2 };

    expect(clampPointToCircle({ x: 6, y: -2 }, center, Number.POSITIVE_INFINITY, 1)).toEqual(
      center,
    );
    expect(clampPointToCircle({ x: 6, y: -2 }, center, 10, Number.NaN)).toEqual(center);
  });

  it('returns center for non-finite point coordinates without NaN or Infinity', () => {
    const result = clampPointToCircle(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      { x: 5, y: -2 },
      10,
      1,
    );

    expect(result).toEqual({ x: 5, y: -2 });
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  it('returns origin for non-finite center coordinates without NaN or Infinity', () => {
    const result = clampPointToCircle(
      { x: 6, y: -2 },
      { x: Number.NEGATIVE_INFINITY, y: Number.NaN },
      10,
      1,
    );

    expect(result).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });
});
