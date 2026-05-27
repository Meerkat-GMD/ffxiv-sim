export const ROLES = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;

export type Role = (typeof ROLES)[number];
export type RoleGroup = 'tank' | 'healer' | 'dps';

type ClaimRoleResult =
  | { ok: true; claimed: Set<Role> }
  | { ok: false; reason: 'role_taken' };

export function roleGroupOf(role: Role): RoleGroup {
  if (role === 'MT' || role === 'ST') {
    return 'tank';
  }

  if (role === 'H1' || role === 'H2') {
    return 'healer';
  }

  return 'dps';
}

export function getAvailableRoles(claimed: ReadonlySet<Role>): Role[] {
  return ROLES.filter((role) => !claimed.has(role));
}

export function claimRole(
  claimed: ReadonlySet<Role>,
  role: Role,
): ClaimRoleResult {
  if (claimed.has(role)) {
    return { ok: false, reason: 'role_taken' };
  }

  return { ok: true, claimed: new Set([...claimed, role]) };
}
