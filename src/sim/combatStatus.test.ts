import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_HP,
  createInitialCombatStatuses,
  resetCombatStatuses,
} from './combatStatus';
import { ROLES } from './roles';

describe('combat status', () => {
  it('creates a fixed 10000 HP status and empty buff list for every role', () => {
    const statuses = createInitialCombatStatuses();

    expect(statuses.map((status) => status.role)).toEqual(ROLES);
    expect(statuses.every((status) => status.currentHp === DEFAULT_PLAYER_HP)).toBe(
      true,
    );
    expect(statuses.every((status) => status.maxHp === DEFAULT_PLAYER_HP)).toBe(
      true,
    );
    expect(statuses.every((status) => status.buffs.length === 0)).toBe(true);
  });

  it('resets combat statuses back to fixed HP and no buffs', () => {
    expect(resetCombatStatuses()).toEqual(createInitialCombatStatuses());
  });
});
