/* @vitest-environment jsdom */
import { StrictMode, type ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { mergeRealtimePlayers } from './App';
import {
  type RealtimeClient,
  type RealtimeClientOptions,
} from './client/realtimeClient';
import { createInitialPlayers } from './sim/players';
import { ROLES } from './sim/roles';
import { createSampleTimeline } from './sim/timeline';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('App', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;
  let getContextSpy: { mockRestore: () => void } | undefined;

  beforeEach(() => {
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    vi.useRealTimers();
    getContextSpy?.mockRestore();
    window.history.pushState({}, '', '/');
    container?.remove();
    root = undefined;
    container = undefined;
    getContextSpy = undefined;
  });

  function renderApp() {
    return renderAppElement(<App />);
  }

  function renderAppElement(element: ReactNode) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(element);
    });

    return container;
  }

  function roleButton(role: string) {
    return container?.querySelector<HTMLButtonElement>(
      `button[data-role="${role}"]`,
    );
  }

  it('renders the simulator shell placeholders', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('FFXIV Sim');
    expect(html).toContain('Roles');
    expect(html).toContain('Arena canvas');
    expect(html).toContain('Timeline');
    expect(html).toContain('Markers');
    expect(html).toContain('Waymarks');
    expect(html).toContain('Combat');
    expect(html).toContain('alt="Waymark A"');
    expect(html).toContain('src="/assets/xivplan/marker/waymark_a.png"');
    expect(html).toContain('00.00s');
    expect(html).toContain('Play');
    expect(html).toContain('Pause');
    expect(html).toContain('Reset');

    for (const role of ROLES) {
      expect(html).toContain(`>${role}</button>`);
    }
  });

  it('selects an open role without leaving the previous local role claimed', () => {
    renderApp();

    const mtButton = roleButton('MT');
    const d2Button = roleButton('D2');

    expect(mtButton).not.toBeNull();
    expect(d2Button).not.toBeNull();
    expect(mtButton?.disabled).toBe(false);
    expect(mtButton?.getAttribute('aria-pressed')).toBe('true');
    expect(d2Button?.disabled).toBe(false);
    expect(d2Button?.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      d2Button?.click();
    });

    expect(mtButton?.disabled).toBe(false);
    expect(mtButton?.getAttribute('aria-pressed')).toBe('false');
    expect(d2Button?.disabled).toBe(false);
    expect(d2Button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('connects to a realtime room and sends role claims through the server', () => {
    let realtimeOptions: RealtimeClientOptions | undefined;
    const realtimeClient: RealtimeClient = {
      claimRole: vi.fn(),
      disconnect: vi.fn(),
      moveRole: vi.fn(),
      setMarkers: vi.fn(),
    };
    const realtimeConnector = vi.fn((options: RealtimeClientOptions) => {
      realtimeOptions = options;
      return realtimeClient;
    });

    window.history.pushState({}, '', '/?room=alpha');
    renderAppElement(
      <App
        realtimeConnector={realtimeConnector}
        realtimeUrl="http://localhost:3001"
      />,
    );

    expect(realtimeConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'alpha',
        url: 'http://localhost:3001',
      }),
    );

    act(() => {
      realtimeOptions?.onState({
        claimedRoles: { D1: 'socket-d1' },
        markers: [],
        players: createInitialPlayers(),
        roomId: 'alpha',
        timeline: createSampleTimeline(),
      });
    });

    expect(roleButton('D1')?.disabled).toBe(true);

    act(() => {
      roleButton('D2')?.click();
    });

    expect(realtimeClient.claimRole).toHaveBeenCalledWith('D2');
  });

  it('moves the timeline editor onto a separate screen', () => {
    renderApp();

    expect(container?.querySelector('[aria-label="Arena canvas"]')).not.toBeNull();
    expect(
      container?.querySelector('[aria-label="Timeline editor"]'),
    ).toBeNull();

    act(() => {
      screenButton('Timeline Editor')?.click();
    });

    expect(container?.querySelector('[aria-label="Arena canvas"]')).toBeNull();
    expect(
      container?.querySelector('[aria-label="Timeline editor"]'),
    ).not.toBeNull();

    act(() => {
      screenButton('Simulator')?.click();
    });

    expect(container?.querySelector('[aria-label="Arena canvas"]')).not.toBeNull();
    expect(
      container?.querySelector('[aria-label="Timeline editor"]'),
    ).toBeNull();
  });

  it('plays, pauses, and resets timeline time', () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.75);
    renderApp();

    const playButton = timelineButton('Play');
    const pauseButton = timelineButton('Pause');
    const resetButton = timelineButton('Reset');

    expect(playButton).not.toBeNull();
    expect(pauseButton).not.toBeNull();
    expect(resetButton).not.toBeNull();
    expect(container?.textContent).toContain('00.00s');

    act(() => {
      playButton?.click();
    });

    act(() => {
      vi.advanceTimersByTime(5250);
    });

    expect(container?.textContent).toContain('05.25s');
    expect(randomSpy).toHaveBeenCalled();

    act(() => {
      pauseButton?.click();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container?.textContent).toContain('05.25s');

    act(() => {
      resetButton?.click();
    });

    expect(container?.textContent).toContain('00.00s');
    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  it('plays and resets timeline under StrictMode', () => {
    vi.useFakeTimers();
    renderAppElement(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    act(() => {
      timelineButton('Play')?.click();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(container?.textContent).toContain('05.00s');

    act(() => {
      timelineButton('Reset')?.click();
    });

    expect(container?.textContent).toContain('00.00s');
  });

  it('keeps the playback interval stable while player movement updates state', () => {
    vi.useFakeTimers();
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        animationFrameCallbacks.push(callback);
        return animationFrameCallbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    renderApp();

    const canvas = container?.querySelector<HTMLCanvasElement>('canvas');
    expect(canvas).not.toBeNull();

    act(() => {
      timelineButton('Play')?.click();
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      canvas?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'KeyW',
        }),
      );
      animationFrameCallbacks[0]?.(16);
      animationFrameCallbacks[1]?.(66);
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('places the selected tray marker on the arena', () => {
    renderApp();

    const markerButton = container?.querySelector<HTMLButtonElement>(
      'button[data-marker-src="/assets/xivplan/marker/waymark_a.png"]',
    );
    const canvas = container?.querySelector<HTMLCanvasElement>('canvas');

    expect(markerButton).not.toBeNull();
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
      markerButton?.click();
    });

    expect(markerButton?.getAttribute('aria-pressed')).toBe('true');

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 360,
          clientY: 360,
        }),
      );
    });

    const placedMarker = container?.querySelector<HTMLImageElement>(
      'img[alt="Placed Waymark A"]',
    );

    expect(placedMarker).not.toBeNull();
    expect(placedMarker?.getAttribute('src')).toBe(
      '/assets/xivplan/marker/waymark_a.png',
    );
  });

  it('clears marker placement mode after placing one marker', () => {
    renderApp();

    const markerButton = container?.querySelector<HTMLButtonElement>(
      'button[data-marker-src="/assets/xivplan/marker/waymark_a.png"]',
    );
    const canvas = container?.querySelector<HTMLCanvasElement>('canvas');

    expect(markerButton).not.toBeNull();
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
      markerButton?.click();
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

    expect(markerButton?.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 540,
          clientY: 360,
        }),
      );
    });

    const placedMarker = container?.querySelector<HTMLImageElement>(
      'img[alt="Placed Waymark A"]',
    );

    expect(placedMarker?.style.left).toBe('50%');
  });

  it('keeps only one copy of the same placed marker', () => {
    renderApp();

    const markerButton = container?.querySelector<HTMLButtonElement>(
      'button[data-marker-src="/assets/xivplan/marker/waymark_a.png"]',
    );
    const canvas = container?.querySelector<HTMLCanvasElement>('canvas');

    expect(markerButton).not.toBeNull();
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
      markerButton?.click();
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

    act(() => {
      markerButton?.click();
    });

    act(() => {
      canvas?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          clientX: 540,
          clientY: 360,
        }),
      );
    });

    const placedMarkers = container?.querySelectorAll<HTMLImageElement>(
      'img[alt="Placed Waymark A"]',
    );

    expect(placedMarkers).toHaveLength(1);
    expect(placedMarkers?.[0]?.style.left).not.toBe('50%');
  });

  it('keeps locally placed room markers through stale realtime movement snapshots', () => {
    let realtimeOptions: RealtimeClientOptions | undefined;
    const realtimeClient = {
      claimRole: vi.fn(),
      disconnect: vi.fn(),
      moveRole: vi.fn(),
      setMarkers: vi.fn(),
    };
    const realtimeConnector = vi.fn((options: RealtimeClientOptions) => {
      realtimeOptions = options;
      return realtimeClient;
    });

    window.history.pushState({}, '', '/?room=alpha');
    renderAppElement(
      <App
        realtimeConnector={realtimeConnector}
        realtimeUrl="http://localhost:3001"
      />,
    );

    act(() => {
      realtimeOptions?.onState({
        claimedRoles: {},
        markers: [],
        players: createInitialPlayers(),
        roomId: 'alpha',
        timeline: createSampleTimeline(),
      });
    });

    const markerButton = container?.querySelector<HTMLButtonElement>(
      'button[data-marker-src="/assets/xivplan/marker/waymark_a.png"]',
    );
    const canvas = container?.querySelector<HTMLCanvasElement>('canvas');

    expect(markerButton).not.toBeNull();
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
      markerButton?.click();
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

    expect(realtimeClient.setMarkers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '/assets/xivplan/marker/waymark_a.png',
      }),
    ]);

    act(() => {
      realtimeOptions?.onState({
        claimedRoles: {},
        markers: [],
        players: createInitialPlayers(),
        roomId: 'alpha',
        timeline: createSampleTimeline(),
      });
    });

    expect(
      container?.querySelector<HTMLImageElement>('img[alt="Placed Waymark A"]'),
    ).not.toBeNull();
  });

  it('keeps recent local movement from being overwritten by delayed realtime snapshots', () => {
    const snapshotPlayers = createInitialPlayers();
    const mergedDuringMove = mergeRealtimePlayers(
      snapshotPlayers,
      'MT',
      {
        movedAt: 1000,
        position: { x: 40, y: -90 },
        role: 'MT',
      },
      1120,
    );
    const mtDuringMove = mergedDuringMove.find((player) => player.role === 'MT');
    const d1DuringMove = mergedDuringMove.find((player) => player.role === 'D1');

    expect(mtDuringMove?.position).toEqual({ x: 40, y: -90 });
    expect(d1DuringMove?.position).toEqual(
      snapshotPlayers.find((player) => player.role === 'D1')?.position,
    );

    const mergedAfterMoveSettles = mergeRealtimePlayers(
      snapshotPlayers,
      'MT',
      {
        movedAt: 1000,
        position: { x: 40, y: -90 },
        role: 'MT',
      },
      1400,
    );

    expect(mergedAfterMoveSettles.find((player) => player.role === 'MT')?.position).toEqual(
      snapshotPlayers.find((player) => player.role === 'MT')?.position,
    );
  });

  function timelineButton(label: string) {
    return container?.querySelector<HTMLButtonElement>(
      `button[aria-label="${label} timeline"]`,
    );
  }

  function screenButton(label: string) {
    return container?.querySelector<HTMLButtonElement>(
      `button[aria-label="Open ${label} screen"]`,
    );
  }
});
