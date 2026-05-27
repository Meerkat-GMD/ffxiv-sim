import { type Point } from './geometry';
import { ROLES, type Role } from './roles';

export type Player = {
  id: string;
  role: Role;
  position: Point;
  color: string;
  connected: boolean;
};

const INITIAL_PLAYER_DATA: Record<Role, { position: Point; color: string }> = {
  MT: { position: { x: 0, y: -120 }, color: '#2563eb' },
  ST: { position: { x: 0, y: -80 }, color: '#38bdf8' },
  H1: { position: { x: -80, y: 0 }, color: '#16a34a' },
  H2: { position: { x: 80, y: 0 }, color: '#84cc16' },
  D1: { position: { x: -72, y: 72 }, color: '#dc2626' },
  D2: { position: { x: -24, y: 96 }, color: '#f97316' },
  D3: { position: { x: 24, y: 96 }, color: '#9333ea' },
  D4: { position: { x: 72, y: 72 }, color: '#db2777' },
};

export function createInitialPlayers(): Player[] {
  return ROLES.map((role) => ({
    id: role.toLowerCase(),
    role,
    position: { ...INITIAL_PLAYER_DATA[role].position },
    color: INITIAL_PLAYER_DATA[role].color,
    connected: true,
  }));
}
