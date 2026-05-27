import { type ResolvedEffect, type TimelineEvent } from '../sim/timeline';

const MAX_RESOLVED_LOG_ENTRIES = 10;

type TimelineControlsProps = {
  currentTime: number;
  isPlaying: boolean;
  onPause: () => void;
  onPlay: () => void;
  onReset: () => void;
  events?: TimelineEvent[];
  resolvedEffects: ResolvedEffect[];
};

export function TimelineControls({
  currentTime,
  isPlaying,
  events = [],
  onPause,
  onPlay,
  onReset,
  resolvedEffects,
}: TimelineControlsProps) {
  const visibleResolvedEffects = resolvedEffects.slice(-MAX_RESOLVED_LOG_ENTRIES);

  return (
    <aside className="panel timeline-panel" aria-label="Timeline controls">
      <div className="timeline-header">
        <h2>Timeline</h2>
        <output className="timeline-time" aria-label="Current timeline time">
          {formatTimelineTime(currentTime)}
        </output>
      </div>

      <div className="timeline-controls" aria-label="Timeline playback controls">
        <button
          aria-label="Play timeline"
          className="timeline-button"
          disabled={isPlaying}
          onClick={onPlay}
          type="button"
        >
          Play
        </button>
        <button
          aria-label="Pause timeline"
          className="timeline-button"
          disabled={!isPlaying}
          onClick={onPause}
          type="button"
        >
          Pause
        </button>
        <button
          aria-label="Reset timeline"
          className="timeline-button"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      </div>

      <ol className="timeline-list">
        <li>00:00 Pull</li>
        {events.length === 0 ? (
          <li>No timeline events</li>
        ) : (
          [...events]
            .sort((a, b) => a.time - b.time)
            .map((event) => <li key={event.id}>{formatTimelineEvent(event)}</li>)
        )}
      </ol>

      <div className="timeline-log" aria-label="Timeline resolution log">
        <h2>Log</h2>
        {visibleResolvedEffects.length === 0 ? (
          <p className="timeline-empty">No resolved effects</p>
        ) : (
          <ol className="timeline-list">
            {visibleResolvedEffects.map((effect) => (
              <li key={effect.id}>
                {effect.targetRole} resolved at {formatTimelineTime(effect.resolvedAt)}
                <span>Hits: {formatAffectedRoles(effect.affectedRoles)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

export function formatTimelineTime(time: number): string {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  const totalCentiseconds = Math.round(safeTime * 100);
  const seconds = Math.floor(totalCentiseconds / 100)
    .toString()
    .padStart(2, '0');
  const centiseconds = (totalCentiseconds % 100)
    .toString()
    .padStart(2, '0');

  return `${seconds}.${centiseconds}s`;
}

function formatAffectedRoles(roles: ResolvedEffect['affectedRoles']): string {
  return roles.length > 0 ? roles.join(', ') : 'none';
}

function formatTimelineEvent(event: TimelineEvent): string {
  const target = formatTarget(event);

  switch (event.type) {
    case 'spawn_aoe':
      return `${formatTimelineListTime(event.time)} ${target} circle telegraph`;
    case 'spawn_donut':
      return `${formatTimelineListTime(event.time)} ${target} donut telegraph`;
    case 'spawn_line':
      return `${formatTimelineListTime(event.time)} ${target} line telegraph`;
    case 'spawn_cone':
      return `${formatTimelineListTime(event.time)} ${target} cone telegraph`;
    case 'spawn_stack':
      return `${formatTimelineListTime(event.time)} ${target} stack marker`;
    case 'apply_status':
      return `${formatTimelineListTime(event.time)} ${target} sleep debuff`;
  }
}

function formatTarget(event: TimelineEvent): string {
  if (event.target.selection === 'fixed_position') {
    return `FIXED (${event.target.position.x}, ${event.target.position.y})`;
  }

  return event.target.roleGroup.toUpperCase();
}

function formatTimelineListTime(time: number): string {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  const minutes = Math.floor(safeTime / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safeTime % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
}
