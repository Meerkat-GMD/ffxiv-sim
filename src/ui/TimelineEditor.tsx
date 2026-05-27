import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { type RoleGroup } from '../sim/roles';
import { type TargetSpec, type TimelineEvent } from '../sim/timeline';

type TimelineEditorProps = {
  events: TimelineEvent[];
  onChange: (events: TimelineEvent[]) => void;
};

export function TimelineEditor({ events, onChange }: TimelineEditorProps) {
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.time - b.time),
    [events],
  );
  const timeGroups = useMemo(() => groupEventsByTime(sortedEvents), [sortedEvents]);
  const [selectedTime, setSelectedTime] = useState(() => timeGroups[0]?.time ?? 5);
  const activeTime = timeGroups.some((group) => group.time === selectedTime)
    ? selectedTime
    : timeGroups[0]?.time;
  const selectedEvents =
    activeTime === undefined
      ? []
      : timeGroups.find((group) => group.time === activeTime)?.events ?? [];

  useEffect(() => {
    if (timeGroups.length === 0) {
      return;
    }

    if (!timeGroups.some((group) => group.time === selectedTime)) {
      setSelectedTime(timeGroups[0].time);
    }
  }, [selectedTime, timeGroups]);

  function addEvent(event: TimelineEvent) {
    onChange([...events, event]);
  }

  function baseEvent(type: TimelineEvent['type']) {
    return {
      id: nextEventId(events),
      target: roleGroupTarget('dps'),
      telegraphDuration: 5,
      time: 5,
      type,
    };
  }

  function addCircleAoe() {
    addEvent({
      aoe: { radius: 72, shape: 'circle' },
      ...baseEvent('spawn_aoe'),
      type: 'spawn_aoe',
    });
  }

  function addDonutAoe() {
    addEvent({
      donut: { innerRadius: 36, outerRadius: 120 },
      ...baseEvent('spawn_donut'),
      type: 'spawn_donut',
    });
  }

  function addLineAoe() {
    addEvent({
      line: { length: 220, rotation: 0, width: 36 },
      ...baseEvent('spawn_line'),
      type: 'spawn_line',
    });
  }

  function addConeAoe() {
    addEvent({
      cone: { angle: 90, radius: 160, rotation: 0 },
      ...baseEvent('spawn_cone'),
      type: 'spawn_cone',
    });
  }

  function addStackMarker() {
    addEvent({
      stack: { radius: 48 },
      ...baseEvent('spawn_stack'),
      target: roleGroupTarget('healer'),
      type: 'spawn_stack',
    });
  }

  function addSleepDebuff() {
    addEvent({
      duration: 5,
      id: nextEventId(events),
      status: 'sleep',
      target: roleGroupTarget('dps'),
      time: 5,
      type: 'apply_status',
    });
  }

  function updateEvent(eventId: string, nextEvent: TimelineEvent) {
    onChange(events.map((event) => (event.id === eventId ? nextEvent : event)));
  }

  return (
    <aside className="panel timeline-editor" aria-label="Timeline editor">
      <div className="timeline-header">
        <h2>Editor</h2>
      </div>

      <div className="mechanic-button-grid" aria-label="Mechanic add controls">
        <button
          aria-label="Add circle AoE"
          className="timeline-button"
          onClick={addCircleAoe}
          type="button"
        >
          Circle
        </button>
        <button
          aria-label="Add donut AoE"
          className="timeline-button"
          onClick={addDonutAoe}
          type="button"
        >
          Donut
        </button>
        <button
          aria-label="Add line AoE"
          className="timeline-button"
          onClick={addLineAoe}
          type="button"
        >
          Line
        </button>
        <button
          aria-label="Add cone AoE"
          className="timeline-button"
          onClick={addConeAoe}
          type="button"
        >
          Cone
        </button>
        <button
          aria-label="Add stack marker"
          className="timeline-button"
          onClick={addStackMarker}
          type="button"
        >
          Stack
        </button>
        <button
          aria-label="Add sleep debuff"
          className="timeline-button"
          onClick={addSleepDebuff}
          type="button"
        >
          Sleep
        </button>
      </div>

      {timeGroups.length === 0 ? (
        <p className="timeline-empty">No timeline events</p>
      ) : (
        <>
          <div className="timeline-time-browser">
            <div className="timeline-time-slots" aria-label="Timeline time groups">
              {timeGroups.map((group) => (
                <button
                  aria-label={`Select ${formatTimelineListTime(group.time)} timeline events`}
                  aria-pressed={group.time === activeTime}
                  className="timeline-time-slot"
                  key={group.time}
                  onClick={() => setSelectedTime(group.time)}
                  type="button"
                >
                  <span>{formatTimelineListTime(group.time)}</span>
                  <strong>{group.events.length}</strong>
                </button>
              ))}
            </div>

            <TimelineTimePreview events={selectedEvents} time={activeTime ?? 0} />
          </div>

          <ol className="timeline-editor-list">
            {selectedEvents.map((event) => (
              <li data-event-id={event.id} key={event.id}>
                <EventRow
                  event={event}
                  onDelete={() =>
                    onChange(events.filter((candidate) => candidate.id !== event.id))
                  }
                  onUpdate={(nextEvent) => updateEvent(event.id, nextEvent)}
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}

type TimelineTimePreviewProps = {
  events: TimelineEvent[];
  time: number;
};

function TimelineTimePreview({ events, time }: TimelineTimePreviewProps) {
  const fixedEvents = events.filter(
    (event) => event.target.selection === 'fixed_position',
  );
  const roleEvents = events.filter((event) => event.target.selection === 'random');

  return (
    <section className="timeline-time-preview" aria-label="Selected time mechanics">
      <div className="timeline-time-preview-header">
        <h3>{formatTimelineListTime(time)} mechanics</h3>
        <span>{events.length} total</span>
      </div>

      <svg
        aria-label="Fixed-position mechanic preview"
        className="timeline-preview-map"
        viewBox="0 0 360 360"
        role="img"
      >
        <circle className="timeline-preview-arena" cx="180" cy="180" r="144" />
        <line className="timeline-preview-axis" x1="36" x2="324" y1="180" y2="180" />
        <line className="timeline-preview-axis" x1="180" x2="180" y1="36" y2="324" />
        {fixedEvents.map((event) => (
          <PreviewMechanic event={event} key={event.id} />
        ))}
      </svg>

      <div className="timeline-preview-summary">
        <h3>Fixed position</h3>
        {fixedEvents.length === 0 ? (
          <p className="timeline-empty">No fixed-position mechanics at this time</p>
        ) : (
          <ul>
            {fixedEvents.map((event) => (
              <li key={event.id}>{formatFixedEventSummary(event)}</li>
            ))}
          </ul>
        )}

        <h3>Role targeted</h3>
        {roleEvents.length === 0 ? (
          <p className="timeline-empty">No role-targeted mechanics at this time</p>
        ) : (
          <ul>
            {roleEvents.map((event) => (
              <li key={event.id}>{formatRoleEventSummary(event)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type PreviewMechanicProps = {
  event: TimelineEvent;
};

function PreviewMechanic({ event }: PreviewMechanicProps) {
  if (event.target.selection !== 'fixed_position') {
    return null;
  }

  const origin = arenaToPreviewPoint(event.target.position);

  switch (event.type) {
    case 'spawn_aoe':
      return (
        <circle
          className="timeline-preview-danger"
          cx={origin.x}
          cy={origin.y}
          r={arenaLengthToPreview(event.aoe.radius)}
        />
      );
    case 'spawn_donut':
      return (
        <g className="timeline-preview-danger timeline-preview-donut">
          <circle
            cx={origin.x}
            cy={origin.y}
            r={arenaLengthToPreview(event.donut.outerRadius)}
          />
          <circle
            cx={origin.x}
            cy={origin.y}
            r={arenaLengthToPreview(event.donut.innerRadius)}
          />
        </g>
      );
    case 'spawn_line':
      return (
        <rect
          className="timeline-preview-danger"
          height={arenaLengthToPreview(event.line.width)}
          transform={`rotate(${event.line.rotation} ${origin.x} ${origin.y})`}
          width={arenaLengthToPreview(event.line.length)}
          x={origin.x}
          y={origin.y - arenaLengthToPreview(event.line.width) / 2}
        />
      );
    case 'spawn_cone':
      return (
        <path
          className="timeline-preview-danger"
          d={conePath(origin, event.cone.radius, event.cone.angle, event.cone.rotation)}
        />
      );
    case 'spawn_stack':
      return (
        <circle
          className="timeline-preview-stack"
          cx={origin.x}
          cy={origin.y}
          r={arenaLengthToPreview(event.stack.radius)}
        />
      );
    case 'apply_status':
      return null;
  }
}

type EventRowProps = {
  event: TimelineEvent;
  onDelete: () => void;
  onUpdate: (event: TimelineEvent) => void;
};

function EventRow({ event, onDelete, onUpdate }: EventRowProps) {
  return (
    <div className="timeline-event-row">
      <LabeledField label="Type">
        <span className="timeline-event-kind">{eventLabel(event)}</span>
      </LabeledField>
      <LabeledField label="Time">
        <input
          aria-label={`Event time ${event.id}`}
          min="0"
          onInput={(inputEvent) =>
            onUpdate({
              ...event,
              time: readNumber(inputEvent, event.time),
            })
          }
          step="0.5"
          type="number"
          value={event.time}
        />
      </LabeledField>
      <TargetFields
        allowFixedPosition={event.type !== 'apply_status'}
        eventId={event.id}
        onChange={(target) => onUpdate({ ...event, target })}
        target={event.target}
      />
      {mechanicFields(event, onUpdate)}
      {event.type === 'apply_status' ? null : (
      <LabeledField label="예고 시간">
        <input
          aria-label={`Telegraph duration ${event.id}`}
          min="0"
          onInput={(inputEvent) =>
            onUpdate({
              ...event,
              telegraphDuration: readNumber(inputEvent, event.telegraphDuration),
            })
          }
          step="0.5"
          type="number"
          value={event.telegraphDuration}
        />
      </LabeledField>
      )}
      <LabeledField label="Action">
        <button
          aria-label={`Delete ${event.id} event`}
          className="timeline-button"
          onClick={onDelete}
          type="button"
        >
          Del
        </button>
      </LabeledField>
    </div>
  );
}

type TargetFieldsProps = {
  allowFixedPosition?: boolean;
  eventId: string;
  onChange: (target: TargetSpec) => void;
  target: TargetSpec;
};

function TargetFields({
  allowFixedPosition = true,
  eventId,
  onChange,
  target,
}: TargetFieldsProps) {
  const mode = target.selection === 'fixed_position' ? 'fixed_position' : 'random';

  return (
    <>
      <LabeledField label="Target">
        <select
          aria-label={`Target mode ${eventId}`}
          onChange={(changeEvent: ChangeEvent<HTMLSelectElement>) => {
            if (changeEvent.currentTarget.value === 'fixed_position') {
              onChange({
                position: { x: 0, y: 0 },
                selection: 'fixed_position',
              });
              return;
            }

            onChange(roleGroupTarget('dps'));
          }}
          value={mode}
        >
          <option value="random">Role random</option>
          {allowFixedPosition ? (
            <option value="fixed_position">Fixed position</option>
          ) : null}
        </select>
      </LabeledField>

      {target.selection === 'fixed_position' ? (
        <>
          <NumberField
            label="Fixed X"
            inputLabel={`Fixed X ${eventId}`}
            onChange={(x) =>
              onChange({
                ...target,
                position: { ...target.position, x },
              })
            }
            value={target.position.x}
          />
          <NumberField
            label="Fixed Y"
            inputLabel={`Fixed Y ${eventId}`}
            onChange={(y) =>
              onChange({
                ...target,
                position: { ...target.position, y },
              })
            }
            value={target.position.y}
          />
        </>
      ) : (
        <LabeledField label="Role group">
          <select
            aria-label={`Target role group ${eventId}`}
            onChange={(changeEvent: ChangeEvent<HTMLSelectElement>) =>
              onChange(roleGroupTarget(changeEvent.currentTarget.value as RoleGroup))
            }
            value={target.roleGroup}
          >
            <option value="tank">Tank</option>
            <option value="healer">Healer</option>
            <option value="dps">DPS</option>
          </select>
        </LabeledField>
      )}
    </>
  );
}

function mechanicFields(
  event: TimelineEvent,
  onUpdate: (event: TimelineEvent) => void,
): ReactNode {
  switch (event.type) {
    case 'spawn_aoe':
      return (
        <NumberField
          inputLabel={`Radius ${event.id}`}
          label="Radius"
          onChange={(radius) =>
            onUpdate({ ...event, aoe: { ...event.aoe, radius } })
          }
          value={event.aoe.radius}
        />
      );
    case 'spawn_donut':
      return (
        <>
          <NumberField
            inputLabel={`Inner radius ${event.id}`}
            label="Inner radius"
            onChange={(innerRadius) =>
              onUpdate({ ...event, donut: { ...event.donut, innerRadius } })
            }
            value={event.donut.innerRadius}
          />
          <NumberField
            inputLabel={`Outer radius ${event.id}`}
            label="Outer radius"
            onChange={(outerRadius) =>
              onUpdate({ ...event, donut: { ...event.donut, outerRadius } })
            }
            value={event.donut.outerRadius}
          />
        </>
      );
    case 'spawn_line':
      return (
        <>
          <NumberField
            inputLabel={`Width ${event.id}`}
            label="Width"
            onChange={(width) =>
              onUpdate({ ...event, line: { ...event.line, width } })
            }
            value={event.line.width}
          />
          <NumberField
            inputLabel={`Length ${event.id}`}
            label="Length"
            onChange={(length) =>
              onUpdate({ ...event, line: { ...event.line, length } })
            }
            value={event.line.length}
          />
          <NumberField
            inputLabel={`Rotation ${event.id}`}
            label="Rotation"
            onChange={(rotation) =>
              onUpdate({ ...event, line: { ...event.line, rotation } })
            }
            step="5"
            value={event.line.rotation}
          />
        </>
      );
    case 'spawn_cone':
      return (
        <>
          <NumberField
            inputLabel={`Angle ${event.id}`}
            label="Angle"
            onChange={(angle) =>
              onUpdate({ ...event, cone: { ...event.cone, angle } })
            }
            value={event.cone.angle}
          />
          <NumberField
            inputLabel={`Radius ${event.id}`}
            label="Radius"
            onChange={(radius) =>
              onUpdate({ ...event, cone: { ...event.cone, radius } })
            }
            value={event.cone.radius}
          />
          <NumberField
            inputLabel={`Rotation ${event.id}`}
            label="Rotation"
            onChange={(rotation) =>
              onUpdate({ ...event, cone: { ...event.cone, rotation } })
            }
            step="5"
            value={event.cone.rotation}
          />
        </>
      );
    case 'spawn_stack':
      return (
        <NumberField
          inputLabel={`Radius ${event.id}`}
          label="Radius"
          onChange={(radius) =>
            onUpdate({ ...event, stack: { ...event.stack, radius } })
          }
          value={event.stack.radius}
        />
      );
    case 'apply_status':
      return (
        <NumberField
          inputLabel={`Sleep duration ${event.id}`}
          label="Duration"
          onChange={(duration) => onUpdate({ ...event, duration })}
          step="0.5"
          value={event.duration}
        />
      );
  }
}

type NumberFieldProps = {
  inputLabel: string;
  label: string;
  onChange: (value: number) => void;
  step?: string;
  value: number;
};

function NumberField({
  inputLabel,
  label,
  onChange,
  step = '1',
  value,
}: NumberFieldProps) {
  return (
    <LabeledField label={label}>
      <input
        aria-label={inputLabel}
        min="0"
        onInput={(inputEvent) => onChange(readNumber(inputEvent, value))}
        step={step}
        type="number"
        value={value}
      />
    </LabeledField>
  );
}

type LabeledFieldProps = {
  children: ReactNode;
  label: string;
};

function LabeledField({ children, label }: LabeledFieldProps) {
  return (
    <label className="timeline-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function eventLabel(event: TimelineEvent): string {
  switch (event.type) {
    case 'spawn_aoe':
      return 'Circle';
    case 'spawn_donut':
      return 'Donut';
    case 'spawn_line':
      return 'Line';
    case 'spawn_cone':
      return 'Cone';
    case 'spawn_stack':
      return 'Stack';
    case 'apply_status':
      return 'Sleep';
  }
}

function formatFixedEventSummary(event: TimelineEvent): string {
  if (event.target.selection !== 'fixed_position') {
    return formatRoleEventSummary(event);
  }

  return `${event.id} ${eventLabel(event)} at X ${event.target.position.x}, Y ${event.target.position.y}`;
}

function formatRoleEventSummary(event: TimelineEvent): string {
  if (event.target.selection !== 'random') {
    return formatFixedEventSummary(event);
  }

  return `${event.id} ${eventLabel(event)} on ${event.target.roleGroup.toUpperCase()} random`;
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

function groupEventsByTime(events: TimelineEvent[]) {
  return events.reduce<Array<{ time: number; events: TimelineEvent[] }>>(
    (groups, event) => {
      const existingGroup = groups.find((group) => group.time === event.time);

      if (existingGroup) {
        existingGroup.events.push(event);
        return groups;
      }

      return [...groups, { time: event.time, events: [event] }];
    },
    [],
  );
}

function arenaToPreviewPoint(point: { x: number; y: number }) {
  const center = 180;
  const scale = 144 / 180;

  return {
    x: center + point.x * scale,
    y: center + point.y * scale,
  };
}

function arenaLengthToPreview(length: number): number {
  return Math.max(0, length * (144 / 180));
}

function conePath(
  origin: { x: number; y: number },
  radius: number,
  angle: number,
  rotation: number,
): string {
  const previewRadius = arenaLengthToPreview(radius);
  const start = pointFromAngle(origin, rotation - angle / 2, previewRadius);
  const end = pointFromAngle(origin, rotation + angle / 2, previewRadius);
  const largeArc = angle > 180 ? 1 : 0;

  return [
    `M ${origin.x} ${origin.y}`,
    `L ${start.x} ${start.y}`,
    `A ${previewRadius} ${previewRadius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function pointFromAngle(
  origin: { x: number; y: number },
  angle: number,
  radius: number,
) {
  const radians = (angle * Math.PI) / 180;

  return {
    x: origin.x + Math.cos(radians) * radius,
    y: origin.y + Math.sin(radians) * radius,
  };
}

function readNumber(
  event: FormEvent<HTMLInputElement>,
  fallback: number,
) {
  const value = Number(event.currentTarget.value);

  return Number.isFinite(value) ? value : fallback;
}

function nextEventId(events: TimelineEvent[]) {
  let index = events.length + 1;
  let id = `event-${index}`;

  while (events.some((event) => event.id === id)) {
    index += 1;
    id = `event-${index}`;
  }

  return id;
}

function roleGroupTarget(roleGroup: RoleGroup): TargetSpec {
  return {
    roleGroup,
    selection: 'random',
  };
}
