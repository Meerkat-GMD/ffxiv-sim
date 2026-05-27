/* @vitest-environment jsdom */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialPlayers } from '../sim/players';
import {
  ArenaCanvas,
  arenaPointToCanvasPercent,
  canvasClientPointToArenaPoint,
  drawArena,
  movementKeyFromEventCode,
  movementVectorFromKeys,
  moveControlledPlayer,
} from './ArenaCanvas';

const WAYMARK_A = {
  alt: 'Waymark A',
  category: 'waymark' as const,
  label: 'A',
  src: '/assets/xivplan/marker/waymark_a.png',
};

const ATTACK_MARKER_1 = {
  alt: 'Attack marker 1',
  category: 'combat' as const,
  label: 'Atk',
  src: '/assets/xivplan/marker/attack1.png',
};

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('keyboard movement helpers', () => {
  it('uses stable event codes so Shift/case changes cannot leave stuck letter keys', () => {
    const pressedKeys = new Set<string>();
    const keyDown = movementKeyFromEventCode('KeyW');
    const keyUp = movementKeyFromEventCode('KeyW');

    if (keyDown) {
      pressedKeys.add(keyDown);
    }

    if (keyUp) {
      pressedKeys.delete(keyUp);
    }

    expect(keyDown).toBe('up');
    expect(keyUp).toBe('up');
    expect(pressedKeys.size).toBe(0);
  });

  it('ignores non-movement event codes', () => {
    expect(movementKeyFromEventCode('ShiftLeft')).toBeUndefined();
    expect(movementKeyFromEventCode('Space')).toBeUndefined();
  });

  it('builds a normalized movement vector from active movement keys', () => {
    const diagonal = movementVectorFromKeys(new Set(['up', 'right']));

    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2);
    expect(movementVectorFromKeys(new Set(['up', 'down']))).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('ArenaCanvas keyboard scope', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;
  let getContextSpy: { mockRestore: () => void } | undefined;
  let requestAnimationFrameSpy: { mockRestore: () => void } | undefined;
  let cancelAnimationFrameSpy: { mockRestore: () => void } | undefined;
  let animationFrameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    animationFrameCallbacks = [];
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        animationFrameCallbacks.push(callback);
        return animationFrameCallbacks.length;
      });
    cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }

    getContextSpy?.mockRestore();
    requestAnimationFrameSpy?.mockRestore();
    cancelAnimationFrameSpy?.mockRestore();
    container?.remove();
    root = undefined;
    container = undefined;
  });

  function renderArenaCanvas(
    setPlayers: Parameters<typeof ArenaCanvas>[0]['setPlayers'] = () => undefined,
    props: Partial<Parameters<typeof ArenaCanvas>[0]> = {},
  ) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ArenaCanvas
          controlledRole="MT"
          players={createInitialPlayers()}
          setPlayers={setPlayers}
          {...props}
        />,
      );
    });

    return container.querySelector<HTMLCanvasElement>('canvas');
  }

  it('tracks simultaneous movement keys from the window', () => {
    const onMoveControlledRole = vi.fn();
    let players = createInitialPlayers();
    const setPlayers = vi.fn((updater: typeof players | ((value: typeof players) => typeof players)) => {
      players = typeof updater === 'function' ? updater(players) : updater;
    });

    renderArenaCanvas(setPlayers, { onMoveControlledRole });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyW',
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyD',
        }),
      );
      animationFrameCallbacks[0]?.(16);
      animationFrameCallbacks[1]?.(66);
    });

    expect(onMoveControlledRole).toHaveBeenCalledWith('MT', {
      x: expect.closeTo(9.192, 3),
      y: expect.closeTo(-129.192, 3),
    });
  });

  it('does not capture movement keys while typing in form fields', () => {
    renderArenaCanvas();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyW',
    });

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    input.remove();
  });

  it('clears pressed movement keys when the canvas loses focus', () => {
    const setPlayers = vi.fn();
    const canvas = renderArenaCanvas(setPlayers);

    expect(canvas).not.toBeNull();

    act(() => {
      canvas?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyW',
        }),
      );
      canvas?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      animationFrameCallbacks[0]?.(16);
    });

    expect(setPlayers).not.toHaveBeenCalled();
  });

  it('clears pressed movement keys when the window loses focus', () => {
    const setPlayers = vi.fn();
    const canvas = renderArenaCanvas(setPlayers);

    expect(canvas).not.toBeNull();

    act(() => {
      canvas?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyW',
        }),
      );
      window.dispatchEvent(new FocusEvent('blur'));
      animationFrameCallbacks[0]?.(16);
    });

    expect(setPlayers).not.toHaveBeenCalled();
  });

  it('reports controlled role movement after keyboard input', () => {
    const onMoveControlledRole = vi.fn();
    let players = createInitialPlayers();
    const setPlayers = vi.fn((updater: typeof players | ((value: typeof players) => typeof players)) => {
      players = typeof updater === 'function' ? updater(players) : updater;
    });
    const canvas = renderArenaCanvas(setPlayers, { onMoveControlledRole });

    expect(canvas).not.toBeNull();

    act(() => {
      canvas?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyD',
        }),
      );
      animationFrameCallbacks[0]?.(16);
      animationFrameCallbacks[1]?.(66);
    });

    expect(onMoveControlledRole).toHaveBeenCalledWith('MT', {
      x: 13,
      y: -120,
    });
  });

  it('blocks controlled role movement while that role is movement locked', () => {
    const onMoveControlledRole = vi.fn();
    const setPlayers = vi.fn();
    const canvas = renderArenaCanvas(setPlayers, {
      movementLockedRoles: new Set(['MT']),
      onMoveControlledRole,
    });

    expect(canvas).not.toBeNull();

    act(() => {
      canvas?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyD',
        }),
      );
      animationFrameCallbacks[0]?.(16);
      animationFrameCallbacks[1]?.(66);
    });

    expect(setPlayers).not.toHaveBeenCalled();
    expect(onMoveControlledRole).not.toHaveBeenCalled();
  });

  it('keeps moving while a key is held across parent rerenders', () => {
    const onMoveControlledRole = vi.fn();

    function Wrapper() {
      const [players, setPlayers] = useState(createInitialPlayers());

      return (
        <ArenaCanvas
          controlledRole="MT"
          onMoveControlledRole={(role, position) =>
            onMoveControlledRole(role, position)
          }
          players={players}
          setPlayers={setPlayers}
        />
      );
    }

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(<Wrapper />);
    });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyD',
        }),
      );
      animationFrameCallbacks[0]?.(16);
      animationFrameCallbacks[1]?.(66);
    });

    act(() => {
      animationFrameCallbacks[2]?.(116);
    });

    expect(onMoveControlledRole).toHaveBeenLastCalledWith('MT', {
      x: 26,
      y: -120,
    });
  });

  it('places the selected marker at the clicked arena point', () => {
    const onPlaceMarker = vi.fn();
    const canvas = renderArenaCanvas(undefined, {
      onPlaceMarker,
      selectedMarker: WAYMARK_A,
    });

    expect(canvas).not.toBeNull();

    vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      width: 720,
      height: 720,
      top: 20,
      right: 730,
      bottom: 740,
      left: 10,
      toJSON: () => undefined,
    });

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 370,
          clientY: 380,
        }),
      );
    });

    expect(onPlaceMarker).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it('places combat markers on the clicked player instead of the floor', () => {
    const onPlaceMarker = vi.fn();
    const onPlaceTargetMarker = vi.fn();
    const canvas = renderArenaCanvas(undefined, {
      onPlaceMarker,
      onPlaceTargetMarker,
      selectedMarker: ATTACK_MARKER_1,
    });

    expect(canvas).not.toBeNull();

    vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 720,
      height: 720,
      top: 0,
      right: 720,
      bottom: 720,
      left: 0,
      toJSON: () => undefined,
    });

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 360,
          clientY: 173,
        }),
      );
    });

    expect(onPlaceMarker).not.toHaveBeenCalled();
    expect(onPlaceTargetMarker).toHaveBeenCalledWith({
      role: 'MT',
      type: 'player',
    });
  });

  it('places combat markers on the enemy token at the arena center', () => {
    const onPlaceTargetMarker = vi.fn();
    const canvas = renderArenaCanvas(undefined, {
      onPlaceTargetMarker,
      selectedMarker: ATTACK_MARKER_1,
    });

    expect(canvas).not.toBeNull();

    vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 720,
      height: 720,
      top: 0,
      right: 720,
      bottom: 720,
      left: 0,
      toJSON: () => undefined,
    });

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 360,
          clientY: 360,
        }),
      );
    });

    expect(onPlaceTargetMarker).toHaveBeenCalledWith({ type: 'enemy' });
  });

  it('does not place a marker when no marker is selected', () => {
    const onPlaceMarker = vi.fn();
    const canvas = renderArenaCanvas(undefined, { onPlaceMarker });

    expect(canvas).not.toBeNull();

    vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 720,
      height: 720,
      top: 0,
      right: 720,
      bottom: 720,
      left: 0,
      toJSON: () => undefined,
    });

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 360,
          clientY: 360,
        }),
      );
    });

    expect(onPlaceMarker).not.toHaveBeenCalled();
  });

  it('drags an already placed marker to a new arena point', () => {
    const onMoveMarker = vi.fn();
    const canvas = renderArenaCanvas(undefined, {
      onMoveMarker,
      placedMarkers: [
        {
          asset: WAYMARK_A,
          id: 'marker-waymark-a',
          position: { x: 0, y: 0 },
        },
      ],
    });

    expect(canvas).not.toBeNull();

    vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 720,
      height: 720,
      top: 0,
      right: 720,
      bottom: 720,
      left: 0,
      toJSON: () => undefined,
    });

    const placedMarker = container?.querySelector<HTMLImageElement>(
      'img[alt="Placed Waymark A"]',
    );

    expect(placedMarker).not.toBeNull();

    act(() => {
      placedMarker?.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 360,
          clientY: 360,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 540,
          clientY: 360,
        }),
      );
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(onMoveMarker).toHaveBeenCalledWith('marker-waymark-a', {
      x: expect.closeTo(115.3846, 4),
      y: 0,
    });
  });

  it('disables native image dragging for placed floor markers', () => {
    renderArenaCanvas(undefined, {
      placedMarkers: [
        {
          asset: WAYMARK_A,
          id: 'marker-waymark-a',
          position: { x: 0, y: 0 },
        },
      ],
    });

    const placedMarker = container?.querySelector<HTMLImageElement>(
      'img[alt="Placed Waymark A"]',
    );

    expect(placedMarker).not.toBeNull();
    expect(placedMarker?.draggable).toBe(false);
  });

  it('renders target markers attached to moving players', () => {
    const players = createInitialPlayers().map((player) =>
      player.role === 'MT'
        ? { ...player, position: { x: 40, y: -80 } }
        : player,
    );

    renderArenaCanvas(undefined, {
      players,
      targetMarkers: [
        {
          asset: ATTACK_MARKER_1,
          id: ATTACK_MARKER_1.src,
          target: { role: 'MT', type: 'player' },
        },
      ],
    });

    const targetMarker = container?.querySelector<HTMLImageElement>(
      'img[alt="Target Attack marker 1"]',
    );

    expect(targetMarker).not.toBeNull();
    expect(Number.parseFloat(targetMarker?.style.left ?? '')).toBeCloseTo(
      58.666,
      1,
    );
    expect(Number.parseFloat(targetMarker?.style.top ?? '')).toBeCloseTo(
      32.666,
      1,
    );
  });
});

describe('marker placement helpers', () => {
  it('converts canvas click coordinates into arena coordinates', () => {
    const point = canvasClientPointToArenaPoint(
      { clientX: 360, clientY: 360 },
      { left: 0, top: 0, width: 720, height: 720 },
    );

    expect(point).toEqual({ x: 0, y: 0 });
  });

  it('clamps marker placement inside the circular arena', () => {
    const point = canvasClientPointToArenaPoint(
      { clientX: 720, clientY: 360 },
      { left: 0, top: 0, width: 720, height: 720 },
    );

    expect(point.x).toBeCloseTo(172);
    expect(point.y).toBeCloseTo(0);
  });

  it('converts arena positions to canvas percentages for marker overlays', () => {
    expect(arenaPointToCanvasPercent({ x: 0, y: 0 })).toEqual({
      left: 50,
      top: 50,
    });
  });
});

describe('drawArena telegraphs', () => {
  it('draws active telegraphs and recently resolved effects', () => {
    const context = createMockCanvasContext();

    drawArena(
      context as unknown as CanvasRenderingContext2D,
      createInitialPlayers(),
      'MT',
      [
        {
          id: 'sample-dps-aoe',
          sourceEventId: 'sample-dps-aoe',
          targetRole: 'D1',
          position: { x: -72, y: 72 },
          radius: 72,
          spawnedAt: 5,
          resolvesAt: 10,
        },
      ],
      [
        {
          id: 'sample-dps-aoe-resolved',
          sourceEventId: 'sample-dps-aoe',
          targetRole: 'D1',
          position: { x: -72, y: 72 },
          radius: 72,
          resolvedAt: 10,
          affectedRoles: ['D1'],
        },
      ],
      10.25,
    );

    expect(context.arc).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      112.32000000000001,
      0,
      Math.PI * 2,
    );
    expect(context.fillStyles).toContain('rgba(239, 68, 68, 0.22)');
    expect(context.fillStyles).toContain('rgba(248, 113, 113, 0.42)');
    expect(context.strokeStyles).toContain('rgba(248, 113, 113, 0.86)');
    expect(context.strokeStyles).toContain('rgba(254, 202, 202, 0.95)');
  });

  it('draws line telegraphs with rectangle geometry', () => {
    const context = createMockCanvasContext();

    drawArena(
      context as unknown as CanvasRenderingContext2D,
      createInitialPlayers(),
      'MT',
      [
        {
          id: 'line',
          sourceEventId: 'line',
          targetRole: 'D1',
          position: { x: 0, y: 0 },
          radius: 100,
          shape: { length: 100, rotation: 0, shape: 'line', width: 20 },
          spawnedAt: 5,
          resolvesAt: 10,
        },
      ],
    );

    expect(context.rect).toHaveBeenCalled();
  });
});

describe('moveControlledPlayer', () => {
  it('moves only the controlled role and clamps it inside the arena', () => {
    const players = createInitialPlayers();
    const mtBefore = players.find((player) => player.role === 'MT');
    const stBefore = players.find((player) => player.role === 'ST');

    const moved = moveControlledPlayer(players, 'MT', { x: 0, y: -500 }, 180, 12);
    const mtAfter = moved.find((player) => player.role === 'MT');
    const stAfter = moved.find((player) => player.role === 'ST');

    expect(mtBefore).toBeDefined();
    expect(stBefore).toBeDefined();
    expect(mtAfter?.position).toEqual({ x: 0, y: -168 });
    expect(stAfter?.position).toEqual(stBefore?.position);
  });
});

function createMockCanvasContext() {
  let fillStyle = '';
  let strokeStyle = '';
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];

  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    stroke: vi.fn(),
    strokeText: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      fillStyles.push(value);
    },
    fillStyles,
    set font(_value: string) {},
    set lineWidth(_value: number) {},
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
      strokeStyles.push(value);
    },
    strokeStyles,
    set textAlign(_value: CanvasTextAlign) {},
    set textBaseline(_value: CanvasTextBaseline) {},
  };
}
