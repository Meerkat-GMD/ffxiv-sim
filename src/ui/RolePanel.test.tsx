/* @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ROLES, type Role } from '../sim/roles';
import { RolePanel } from './RolePanel';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('RolePanel', () => {
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

  function renderRolePanel({
    claimedRoles = new Set<Role>(),
    currentRole = 'MT',
  }: {
    claimedRoles?: ReadonlySet<Role>;
    currentRole?: Role;
  } = {}) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <RolePanel
          claimedRoles={claimedRoles}
          currentRole={currentRole}
          onSelectRole={() => undefined}
        />,
      );
    });

    return container;
  }

  function roleButton(role: Role) {
    return container?.querySelector<HTMLButtonElement>(
      `button[data-role="${role}"]`,
    );
  }

  it('renders every role as a button', () => {
    renderRolePanel();

    for (const role of ROLES) {
      expect(roleButton(role)?.textContent).toBe(role);
    }
  });

  it('marks the current role without disabling it', () => {
    renderRolePanel({
      claimedRoles: new Set<Role>(['MT', 'D2']),
      currentRole: 'D2',
    });

    const d2Button = roleButton('D2');

    expect(d2Button?.disabled).toBe(false);
    expect(d2Button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables roles claimed by others while leaving open roles enabled', () => {
    renderRolePanel({
      claimedRoles: new Set<Role>(['MT', 'D2']),
      currentRole: 'D2',
    });

    expect(roleButton('MT')?.disabled).toBe(true);
    expect(roleButton('ST')?.disabled).toBe(false);
  });
});
