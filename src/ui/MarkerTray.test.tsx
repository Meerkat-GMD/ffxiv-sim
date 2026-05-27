/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkerTray } from './MarkerTray';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('MarkerTray', () => {
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

  it('renders waymarks from public xivplan marker asset URLs', () => {
    renderMarkerTray();

    for (const marker of ['A', 'B', 'C', 'D', '1', '2', '3', '4']) {
      const image = imageByAlt(`Waymark ${marker}`);

      expect(image).not.toBeNull();
      expect(image?.getAttribute('src')).toBe(
        `/assets/xivplan/marker/waymark_${marker.toLowerCase()}.png`,
      );
    }
  });

  it('renders combat marker samples with accessible labels', () => {
    renderMarkerTray();

    expect(imageByAlt('Attack marker 1')?.getAttribute('src')).toBe(
      '/assets/xivplan/marker/attack1.png',
    );
    expect(imageByAlt('Bind marker 1')?.getAttribute('src')).toBe(
      '/assets/xivplan/marker/bind1.png',
    );
    expect(imageByAlt('Ignore marker 1')?.getAttribute('src')).toBe(
      '/assets/xivplan/marker/ignore1.png',
    );
    expect(imageByAlt('Red target marker')?.getAttribute('src')).toBe(
      '/assets/xivplan/marker/target_red.png',
    );
    expect(imageByAlt('Shape triangle marker')?.getAttribute('src')).toBe(
      '/assets/xivplan/marker/shape_triangle.png',
    );
  });

  it('selects a marker for arena placement', () => {
    const onSelectMarker = vi.fn();

    renderMarkerTray({ onSelectMarker });

    const waymarkAButton = container?.querySelector<HTMLButtonElement>(
      'button[data-marker-src="/assets/xivplan/marker/waymark_a.png"]',
    );

    expect(waymarkAButton).not.toBeNull();
    expect(waymarkAButton?.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      waymarkAButton?.click();
    });

    expect(onSelectMarker).toHaveBeenCalledWith({
      alt: 'Waymark A',
      label: 'A',
      src: '/assets/xivplan/marker/waymark_a.png',
    });
  });

  function imageByAlt(alt: string) {
    return container?.querySelector<HTMLImageElement>(`img[alt="${alt}"]`);
  }

  function renderMarkerTray(props: Parameters<typeof MarkerTray>[0] = {}) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(<MarkerTray {...props} />);
    });

    return container;
  }
});
