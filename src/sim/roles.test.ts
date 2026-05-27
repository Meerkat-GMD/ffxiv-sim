import { describe, expect, it } from 'vitest';
import {
  ROLES,
  Role,
  claimRole,
  getAvailableRoles,
  roleGroupOf,
} from './roles';

describe('roles', () => {
  it('defines exactly the eight canonical party roles', () => {
    expect(ROLES).toEqual(['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4']);
  });

  it('classifies roles into tank, healer, and dps groups', () => {
    expect(roleGroupOf('MT')).toBe('tank');
    expect(roleGroupOf('ST')).toBe('tank');
    expect(roleGroupOf('H1')).toBe('healer');
    expect(roleGroupOf('H2')).toBe('healer');
    expect(roleGroupOf('D1')).toBe('dps');
    expect(roleGroupOf('D2')).toBe('dps');
    expect(roleGroupOf('D3')).toBe('dps');
    expect(roleGroupOf('D4')).toBe('dps');
  });

  it('returns unclaimed roles in canonical order', () => {
    const claimed = new Set<Role>(['D2', 'MT', 'H1']);

    expect(getAvailableRoles(claimed)).toEqual(['ST', 'H2', 'D1', 'D3', 'D4']);
  });

  it('rejects duplicate role claims', () => {
    const claimed = new Set<Role>(['ST']);

    expect(claimRole(claimed, 'ST')).toEqual({
      ok: false,
      reason: 'role_taken',
    });
  });

  it('accepts open role claims without mutating the input set', () => {
    const claimed = new Set<Role>(['H2']);

    const result = claimRole(claimed, 'D4');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected role claim to succeed');
    }
    expect([...result.claimed]).toEqual(['H2', 'D4']);
    expect([...claimed]).toEqual(['H2']);
    expect(result.claimed).not.toBe(claimed);
  });
});
