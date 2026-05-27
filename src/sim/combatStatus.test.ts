import { describe, expect, it } from 'vitest';
import { createInitialPlayers } from './players';
import {
  DEFAULT_PLAYER_HP,
  applyTimelineStatusEffects,
  createInitialCombatStatuses,
  isRoleMovementLocked,
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

  it('applies sleep from timeline events and removes it after its duration', () => {
    const sleeping = applyTimelineStatusEffects(
      createInitialCombatStatuses(),
      [
        {
          duration: 3,
          id: 'sleep-dps',
          status: 'sleep',
          target: { roleGroup: 'dps', selection: 'random' },
          time: 5,
          type: 'apply_status',
        },
      ],
      createInitialPlayers(),
      4,
      5,
      () => 0,
    );

    const d1Sleeping = sleeping.find((status) => status.role === 'D1');

    expect(d1Sleeping?.buffs).toEqual([
      {
        expiresAt: 8,
        id: 'sleep',
        name: 'Sleep',
      },
    ]);
    expect(isRoleMovementLocked(sleeping, 'D1')).toBe(true);

    const expired = applyTimelineStatusEffects(
      sleeping,
      [],
      createInitialPlayers(),
      7,
      8,
      () => 0,
    );

    expect(expired.find((status) => status.role === 'D1')?.buffs).toEqual([]);
    expect(isRoleMovementLocked(expired, 'D1')).toBe(false);
  });

  it('can apply sleep to a role slot even when no client has claimed that player', () => {
    const unclaimedPlayers = createInitialPlayers().map((player) =>
      player.role.startsWith('D') ? { ...player, connected: false } : player,
    );

    const sleeping = applyTimelineStatusEffects(
      createInitialCombatStatuses(),
      [
        {
          duration: 3,
          id: 'sleep-unclaimed-dps',
          status: 'sleep',
          target: { roleGroup: 'dps', selection: 'random' },
          time: 5,
          type: 'apply_status',
        },
      ],
      unclaimedPlayers,
      4,
      5,
      () => 0,
    );

    expect(sleeping.find((status) => status.role === 'D1')?.buffs).toEqual([
      {
        expiresAt: 8,
        id: 'sleep',
        name: 'Sleep',
      },
    ]);
  });
});
