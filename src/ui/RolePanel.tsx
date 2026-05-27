import { ROLES, type Role } from '../sim/roles';

type RolePanelProps = {
  claimedRoles: ReadonlySet<Role>;
  currentRole: Role | undefined;
  onSelectRole: (role: Role) => void;
};

export function RolePanel({
  claimedRoles,
  currentRole,
  onSelectRole,
}: RolePanelProps) {
  return (
    <aside className="panel role-panel" aria-label="Role panel">
      <h2>Roles</h2>
      <div className="role-list">
        {ROLES.map((role) => {
          const isSelected = role === currentRole;
          const isClaimed = claimedRoles.has(role);
          const isClaimedByOther = isClaimed && !isSelected;

          return (
            <button
              aria-pressed={isSelected}
              className="role-chip"
              data-selected={isSelected ? 'true' : undefined}
              data-role={role}
              disabled={isClaimedByOther}
              key={role}
              onClick={() => onSelectRole(role)}
              type="button"
            >
              {role}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
