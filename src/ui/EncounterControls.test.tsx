/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultEncounter } from '../shared/encounter';
import { EncounterControls } from './EncounterControls';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('EncounterControls', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }

    vi.restoreAllMocks();
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('exports the current encounter as a JSON blob', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:encounter');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<EncounterControls encounter={createDefaultEncounter()} />);

    act(() => {
      button('Export encounter')?.click();
    });

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
  });

  it('imports a valid encounter JSON file', async () => {
    const onApplyEncounter = vi.fn();
    const encounter = createDefaultEncounter();
    render(
      <EncounterControls
        encounter={encounter}
        onApplyEncounter={onApplyEncounter}
      />,
    );

    await act(async () => {
      await uploadTextFile(JSON.stringify(encounter));
    });

    expect(onApplyEncounter).toHaveBeenCalledWith(encounter);
  });

  it('shows an error for invalid encounter JSON', async () => {
    const onApplyEncounter = vi.fn();
    render(
      <EncounterControls
        encounter={createDefaultEncounter()}
        onApplyEncounter={onApplyEncounter}
      />,
    );

    await act(async () => {
      await uploadTextFile('{ nope');
    });

    expect(onApplyEncounter).not.toHaveBeenCalled();
    expect(container?.textContent).toContain('Import failed');
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

  async function uploadTextFile(text: string) {
    const input = container?.querySelector<HTMLInputElement>(
      'input[aria-label="Import encounter JSON"]',
    );
    const file = new File([text], 'encounter.json', {
      type: 'application/json',
    });

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  }
});
