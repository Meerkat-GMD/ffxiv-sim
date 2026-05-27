import { type PlayerCombatStatus } from '../sim/combatStatus';

type PlayerStatusPanelProps = {
  statuses: PlayerCombatStatus[];
};

export function PlayerStatusPanel({ statuses }: PlayerStatusPanelProps) {
  return (
    <aside className="panel player-status-panel" aria-label="Player status panel">
      <h2>Player Status</h2>
      <ul className="player-status-list">
        {statuses.map((status) => (
          <li className="player-status-row" key={status.role}>
            <div className="player-status-header">
              <strong>{status.role}</strong>
              <span>
                HP {status.currentHp.toLocaleString()} /{' '}
                {status.maxHp.toLocaleString()}
              </span>
            </div>
            <div className="player-buff-list" aria-label={`${status.role} buffs`}>
              {status.buffs.length === 0 ? (
                <span className="player-buff-empty">Buffs: None</span>
              ) : (
                status.buffs.map((buff) => (
                  <span className="player-buff" key={buff.id}>
                    {buff.name}
                    {buff.stacks ? ` x${buff.stacks}` : ''}
                  </span>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
