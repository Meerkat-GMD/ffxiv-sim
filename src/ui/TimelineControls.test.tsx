/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ResolvedEffect } from '../sim/timeline';
import { TimelineControls } from './TimelineControls';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TimelineControls', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }

    container?.remove();
    root = undefined;
    container = undefined;
  });

  function renderControls(
    isPlaying = false,
    resolvedEffects: ResolvedEffect[] = [
      {
        id: 'sample-dps-aoe-resolved',
        sourceEventId: 'sample-dps-aoe',
        targetRole: 'D1',
        position: { x: -72, y: 72 },
        radius: 72,
        resolvedAt: 10,
        affectedRoles: ['D1', 'D2'],
      },
    ],
  ) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    const callbacks = {
      onPause: vi.fn(),
      onPlay: vi.fn(),
      onReset: vi.fn(),
    };

    act(() => {
      root?.render(
        <TimelineControls
          currentTime={5.25}
          isPlaying={isPlaying}
          onPause={callbacks.onPause}
          onPlay={callbacks.onPlay}
          onReset={callbacks.onReset}
          resolvedEffects={resolvedEffects}
        />,
      );
    });

    return callbacks;
  }

  it('shows current time and timeline controls', () => {
    renderControls();

    expect(container?.textContent).toContain('Timeline');
    expect(container?.textContent).toContain('05.25s');
    expect(button('Play')?.disabled).toBe(false);
    expect(button('Pause')?.disabled).toBe(true);
    expect(button('Reset')?.disabled).toBe(false);
    expect(container?.textContent).toContain('D1 resolved at 10.00s');
    expect(container?.textContent).toContain('Hits: D1, D2');
  });

  it('wires play, pause, and reset callbacks', () => {
    const callbacks = renderControls(true);

    act(() => {
      button('Play')?.click();
      button('Pause')?.click();
      button('Reset')?.click();
    });

    expect(callbacks.onPlay).not.toHaveBeenCalled();
    expect(callbacks.onPause).toHaveBeenCalledTimes(1);
    expect(callbacks.onReset).toHaveBeenCalledTimes(1);
  });

  it('renders only the latest 10 resolved effect log entries', () => {
    const manyEffects = Array.from({ length: 12 }, (_, index) =>
      makeResolvedEffect(index + 1),
    );

    renderControls(false, manyEffects);

    const logItems = container?.querySelectorAll(
      '[aria-label="Timeline resolution log"] ol li',
    );

    expect(logItems).toHaveLength(10);
    expect(container?.textContent).not.toContain('D1 resolved at 01.00s');
    expect(container?.textContent).not.toContain('D2 resolved at 02.00s');
    expect(container?.textContent).toContain('D3 resolved at 03.00s');
    expect(container?.textContent).toContain('D4 resolved at 12.00s');
  });

  function button(label: string) {
    return container?.querySelector<HTMLButtonElement>(
      `button[aria-label="${label} timeline"]`,
    );
  }
});

function makeResolvedEffect(index: number): ResolvedEffect {
  const roles: ResolvedEffect['targetRole'][] = ['D1', 'D2', 'D3', 'D4'];

  return {
    id: `resolved-${index}`,
    sourceEventId: `event-${index}`,
    targetRole: roles[(index - 1) % roles.length],
    position: { x: index, y: index },
    radius: 72,
    resolvedAt: index,
    affectedRoles: [],
  };
}
