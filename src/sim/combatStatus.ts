import { ROLES, roleGroupOf, type Role } from './roles';
import { type Player } from './players';
import { type Rng, type TimelineEvent } from './timeline';

export const DEFAULT_PLAYER_HP = 10000;
export const SLEEP_BUFF_ID = 'sleep';

export type PlayerBuff = {
  expiresAt?: number;
  id: string;
  name: string;
  stacks?: number;
};

export type PlayerCombatStatus = {
  buffs: PlayerBuff[];
  currentHp: number;
  maxHp: number;
  role: Role;
};

export function createInitialCombatStatuses(): PlayerCombatStatus[] {
  return ROLES.map((role) => ({
    buffs: [],
    currentHp: DEFAULT_PLAYER_HP,
    maxHp: DEFAULT_PLAYER_HP,
    role,
  }));
}

export function resetCombatStatuses(): PlayerCombatStatus[] {
  return createInitialCombatStatuses();
}

export function applyTimelineStatusEffects(
  statuses: PlayerCombatStatus[],
  events: TimelineEvent[],
  players: Player[],
  fromTime: number,
  toTime: number,
  rng: Rng,
): PlayerCombatStatus[] {
  void players;

  const nextStatuses = statuses.map((status) => ({
    ...status,
    buffs: status.buffs
      .filter((buff) => buff.expiresAt === undefined || buff.expiresAt > toTime)
      .map((buff) => ({ ...buff })),
  }));

  for (const event of events) {
    if (
      event.type !== 'apply_status' ||
      event.time <= fromTime ||
      event.time > toTime ||
      event.target.selection === 'fixed_position'
    ) {
      continue;
    }

    const targetRole = selectStatusTargetRole(nextStatuses, event.target.roleGroup, rng);

    if (!targetRole) {
      continue;
    }

    const statusIndex = nextStatuses.findIndex(
      (status) => status.role === targetRole,
    );

    if (statusIndex === -1) {
      continue;
    }

    const existingBuffs = nextStatuses[statusIndex].buffs.filter(
      (buff) => buff.id !== SLEEP_BUFF_ID,
    );

    nextStatuses[statusIndex] = {
      ...nextStatuses[statusIndex],
      buffs: [
        ...existingBuffs,
        {
          expiresAt: event.time + event.duration,
          id: SLEEP_BUFF_ID,
          name: 'Sleep',
        },
      ],
    };
  }

  return nextStatuses;
}

function selectStatusTargetRole(
  statuses: PlayerCombatStatus[],
  roleGroup: ReturnType<typeof roleGroupOf>,
  rng: Rng,
): Role | undefined {
  const candidates = statuses.filter((status) => roleGroupOf(status.role) === roleGroup);

  if (candidates.length === 0) {
    return undefined;
  }

  const roll = rng();
  const normalizedRoll = Number.isFinite(roll) ? Math.max(0, Math.min(roll, 1)) : 0;
  const index = Math.min(
    Math.floor(normalizedRoll * candidates.length),
    candidates.length - 1,
  );

  return candidates[index].role;
}

export function isRoleMovementLocked(
  statuses: PlayerCombatStatus[],
  role: Role,
): boolean {
  return (
    statuses
      .find((status) => status.role === role)
      ?.buffs.some((buff) => buff.id === SLEEP_BUFF_ID) ?? false
  );
}
