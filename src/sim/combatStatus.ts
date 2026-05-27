import { ROLES, type Role } from './roles';

export const DEFAULT_PLAYER_HP = 10000;

export type PlayerBuff = {
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
