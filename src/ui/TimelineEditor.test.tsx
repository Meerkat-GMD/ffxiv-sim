/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type TimelineEvent } from '../sim/timeline';
import { TimelineEditor } from './TimelineEditor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TimelineEditor', () => {
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

  it('adds a circle AoE event', () => {
    const onChange = vi.fn();
    render(<TimelineEditor events={[]} onChange={onChange} />);

    act(() => {
      button('Add circle AoE')?.click();
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        aoe: { radius: 72, shape: 'circle' },
        telegraphDuration: 5,
        time: 5,
        type: 'spawn_aoe',
      }),
    ]);
  });

  it('adds donut, line, cone, and stack mechanics', () => {
    const onChange = vi.fn();
    render(<TimelineEditor events={[]} onChange={onChange} />);

    act(() => {
      button('Add donut AoE')?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        donut: { innerRadius: 36, outerRadius: 120 },
        type: 'spawn_donut',
      }),
    ]);

    act(() => {
      button('Add line AoE')?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        line: { length: 220, rotation: 0, width: 36 },
        type: 'spawn_line',
      }),
    ]);

    act(() => {
      button('Add cone AoE')?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        cone: { angle: 90, radius: 160, rotation: 0 },
        type: 'spawn_cone',
      }),
    ]);

    act(() => {
      button('Add stack marker')?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        stack: { radius: 48 },
        target: { roleGroup: 'healer', selection: 'random' },
        type: 'spawn_stack',
      }),
    ]);
  });

  it('edits event time and deletes events', () => {
    const onChange = vi.fn();
    render(<TimelineEditor events={[event('sample', 5)]} onChange={onChange} />);

    act(() => {
      input('Event time sample')!.value = '7.5';
      input('Event time sample')?.dispatchEvent(
        new Event('input', { bubbles: true }),
      );
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'sample', time: 7.5 }),
    ]);

    act(() => {
      button('Delete sample event')?.click();
    });

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('labels event fields so their meaning is visible', () => {
    render(<TimelineEditor events={[event('sample', 5)]} onChange={vi.fn()} />);

    expect(container?.textContent).toContain('Type');
    expect(container?.textContent).toContain('Time');
    expect(container?.textContent).toContain('Target');
    expect(container?.textContent).toContain('Radius');
    expect(container?.textContent).toContain('예고 시간');
  });

  it('can target a mechanic at a fixed arena position', () => {
    const onChange = vi.fn();
    render(<TimelineEditor events={[event('sample', 5)]} onChange={onChange} />);

    act(() => {
      select('Target mode sample')!.value = 'fixed_position';
      select('Target mode sample')?.dispatchEvent(
        new Event('change', { bubbles: true }),
      );
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        target: {
          position: { x: 0, y: 0 },
          selection: 'fixed_position',
        },
      }),
    ]);

    const fixedEvent: TimelineEvent = {
      ...event('sample', 5),
      target: {
        position: { x: 0, y: 0 },
        selection: 'fixed_position',
      },
    };
    render(<TimelineEditor events={[fixedEvent]} onChange={onChange} />);

    act(() => {
      input('Fixed X sample')!.value = '40';
      input('Fixed X sample')?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        target: {
          position: { x: 40, y: 0 },
          selection: 'fixed_position',
        },
      }),
    ]);
  });

  it('renders timeline time slots sorted by time', () => {
    render(
      <TimelineEditor
        events={[event('late', 10), event('early', 5)]}
        onChange={vi.fn()}
      />,
    );

    const slots = Array.from(
      container?.querySelectorAll<HTMLButtonElement>('.timeline-time-slot') ?? [],
    );

    expect(slots.map((slot) => slot.textContent)).toEqual(['00:051', '00:101']);
  });

  it('filters editable events by the selected timeline time', () => {
    render(
      <TimelineEditor
        events={[event('three', 3), event('five-a', 5), event('five-b', 5), event('seven', 7)]}
        onChange={vi.fn()}
      />,
    );

    expect(container?.querySelector('[data-event-id="three"]')).toBeTruthy();
    expect(container?.querySelector('[data-event-id="five-a"]')).toBeFalsy();
    expect(container?.querySelector('[data-event-id="seven"]')).toBeFalsy();

    act(() => {
      button('Select 00:05 timeline events')?.click();
    });

    expect(container?.querySelector('[data-event-id="three"]')).toBeFalsy();
    expect(container?.querySelector('[data-event-id="five-a"]')).toBeTruthy();
    expect(container?.querySelector('[data-event-id="five-b"]')).toBeTruthy();
    expect(container?.querySelector('[data-event-id="seven"]')).toBeFalsy();
  });

  it('previews fixed-position mechanics and summarizes role-targeted mechanics for the selected time', () => {
    const fixedEvent: TimelineEvent = {
      ...event('fixed-five', 5),
      target: {
        position: { x: 40, y: 20 },
        selection: 'fixed_position',
      },
    };
    const roleEvent = event('dps-five', 5);

    render(
      <TimelineEditor
        events={[event('three', 3), fixedEvent, roleEvent]}
        onChange={vi.fn()}
      />,
    );

    act(() => {
      button('Select 00:05 timeline events')?.click();
    });

    expect(
      container?.querySelector('[aria-label="Fixed-position mechanic preview"]'),
    ).toBeTruthy();
    expect(container?.textContent).toContain('fixed-five Circle at X 40, Y 20');
    expect(container?.textContent).toContain('dps-five Circle on DPS random');
  });

  function render(element: React.ReactElement) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(element);
    });
  }

  function button(label: string) {
    return container?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  }

  function input(label: string) {
    return container?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  }

  function select(label: string) {
    return container?.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  }
});

function event(id: string, time: number): TimelineEvent {
  return {
    aoe: { radius: 72, shape: 'circle' },
    id,
    target: { roleGroup: 'dps', selection: 'random' },
    telegraphDuration: 5,
    time,
    type: 'spawn_aoe',
  };
}
