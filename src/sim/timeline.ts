import { length, type Point } from './geometry';
import { type Player } from './players';
import { roleGroupOf, type Role, type RoleGroup } from './roles';

export type Rng = () => number;

export type RoleGroupTargetSpec = {
  roleGroup: RoleGroup;
  selection: 'random';
};

export type FixedPositionTargetSpec = {
  position: Point;
  selection: 'fixed_position';
};

export type TargetSpec = RoleGroupTargetSpec | FixedPositionTargetSpec;
export type TelegraphTargetRole = Role | 'fixed';

export type SpawnAoeEvent = {
  id: string;
  time: number;
  type: 'spawn_aoe';
  target: TargetSpec;
  telegraphDuration: number;
  aoe: {
    shape: 'circle';
    radius: number;
  };
};

export type SpawnDonutEvent = {
  id: string;
  time: number;
  type: 'spawn_donut';
  target: TargetSpec;
  telegraphDuration: number;
  donut: {
    innerRadius: number;
    outerRadius: number;
  };
};

export type SpawnLineEvent = {
  id: string;
  time: number;
  type: 'spawn_line';
  target: TargetSpec;
  telegraphDuration: number;
  line: {
    length: number;
    rotation: number;
    width: number;
  };
};

export type SpawnConeEvent = {
  id: string;
  time: number;
  type: 'spawn_cone';
  target: TargetSpec;
  telegraphDuration: number;
  cone: {
    angle: number;
    radius: number;
    rotation: number;
  };
};

export type SpawnStackEvent = {
  id: string;
  time: number;
  type: 'spawn_stack';
  target: TargetSpec;
  telegraphDuration: number;
  stack: {
    radius: number;
  };
};

export type TimelineEvent =
  | SpawnAoeEvent
  | SpawnDonutEvent
  | SpawnLineEvent
  | SpawnConeEvent
  | SpawnStackEvent;

export type TelegraphShape =
  | { shape: 'circle'; radius: number }
  | { shape: 'donut'; innerRadius: number; outerRadius: number }
  | { shape: 'line'; length: number; rotation: number; width: number }
  | { shape: 'cone'; angle: number; radius: number; rotation: number }
  | { shape: 'stack'; radius: number };

export type ActiveTelegraph = {
  id: string;
  sourceEventId: string;
  targetRole: TelegraphTargetRole;
  position: Point;
  radius: number;
  shape?: TelegraphShape;
  spawnedAt: number;
  resolvesAt: number;
};

export type ResolvedEffect = {
  id: string;
  sourceEventId: string;
  targetRole: TelegraphTargetRole;
  position: Point;
  radius: number;
  shape?: TelegraphShape;
  resolvedAt: number;
  affectedRoles: Role[];
};

export type TimelineState = {
  events: TimelineEvent[];
  activeTelegraphs: ActiveTelegraph[];
  resolvedEffects: ResolvedEffect[];
};

export function selectTargetRole(
  players: Player[],
  target: TargetSpec,
  rng: Rng,
): Role | undefined {
  if (target.selection === 'fixed_position') {
    return undefined;
  }

  const candidates = players.filter(
    (player) => player.connected && roleGroupOf(player.role) === target.roleGroup,
  );

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

export function validateTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  const seenIds = new Set<string>();

  for (const event of events) {
    if (seenIds.has(event.id)) {
      throw new Error(`Timeline event ids must be unique: ${event.id}`);
    }

    seenIds.add(event.id);
  }

  return events.map(copyEvent);
}

export function createSampleTimeline(): TimelineState {
  const events = validateTimelineEvents([
    {
      id: 'sample-dps-aoe',
      time: 5,
      type: 'spawn_aoe',
      target: { roleGroup: 'dps', selection: 'random' },
      telegraphDuration: 5,
      aoe: {
        shape: 'circle',
        radius: 72,
      },
    },
  ]);

  return {
    events,
    activeTelegraphs: [],
    resolvedEffects: [],
  };
}

export function advanceTimeline(
  timeline: TimelineState,
  players: Player[],
  fromTime: number,
  toTime: number,
  rng: Rng,
): TimelineState {
  const events = validateTimelineEvents(timeline.events);
  const validatedTimeline = { ...timeline, events };
  const spawnedTelegraphs = events.flatMap((event) => {
    if (
      event.time <= fromTime ||
      event.time > toTime ||
      hasSpawned(validatedTimeline, event.id)
    ) {
      return [];
    }

    const target = resolveEventTarget(players, event, rng);
    if (!target) {
      return [];
    }

    return [
      {
        id: event.id,
        sourceEventId: event.id,
        targetRole: target.targetRole,
        position: { ...target.position },
        radius: eventRadius(event),
        shape: eventShape(event),
        spawnedAt: event.time,
        resolvesAt: event.time + event.telegraphDuration,
      },
    ];
  });

  const activeTelegraphs = [
    ...timeline.activeTelegraphs.map(copyTelegraph),
    ...spawnedTelegraphs,
  ];
  const resolvingTelegraphs = activeTelegraphs.filter(
    (telegraph) =>
      telegraph.resolvesAt > fromTime &&
      telegraph.resolvesAt <= toTime &&
      !hasResolved(validatedTimeline, telegraph.sourceEventId),
  );
  const resolvedEffects = resolvingTelegraphs.map((telegraph) =>
    resolveTelegraph(telegraph, players),
  );
  const resolvingIds = new Set(resolvingTelegraphs.map((telegraph) => telegraph.id));

  return {
    events: events.map(copyEvent),
    activeTelegraphs: activeTelegraphs
      .filter((telegraph) => !resolvingIds.has(telegraph.id))
      .map(copyTelegraph),
    resolvedEffects: [
      ...timeline.resolvedEffects.map(copyResolvedEffect),
      ...resolvedEffects,
    ],
  };
}

function resolveEventTarget(
  players: Player[],
  event: TimelineEvent,
  rng: Rng,
): { position: Point; targetRole: TelegraphTargetRole } | undefined {
  if (event.target.selection === 'fixed_position') {
    return {
      position: event.target.position,
      targetRole: 'fixed',
    };
  }

  const targetRole = selectTargetRole(players, event.target, rng);
  if (!targetRole) {
    return undefined;
  }

  const targetPlayer = players.find((player) => player.role === targetRole);

  if (!targetPlayer) {
    throw new Error(`Missing player for selected role ${targetRole}`);
  }

  return {
    position: targetPlayer.position,
    targetRole,
  };
}

function hasSpawned(timeline: TimelineState, eventId: string): boolean {
  return (
    timeline.activeTelegraphs.some((telegraph) => telegraph.sourceEventId === eventId) ||
    timeline.resolvedEffects.some((effect) => effect.sourceEventId === eventId)
  );
}

function hasResolved(timeline: TimelineState, eventId: string): boolean {
  return timeline.resolvedEffects.some((effect) => effect.sourceEventId === eventId);
}

function resolveTelegraph(
  telegraph: ActiveTelegraph,
  players: Player[],
): ResolvedEffect {
  return {
    id: `${telegraph.id}-resolved`,
    sourceEventId: telegraph.sourceEventId,
    targetRole: telegraph.targetRole,
    position: { ...telegraph.position },
    radius: telegraph.radius,
    resolvedAt: telegraph.resolvesAt,
    affectedRoles: players
      .filter((player) => pointHitsTelegraph(player.position, telegraph))
      .map((player) => player.role),
  };
}

function eventShape(event: TimelineEvent): TelegraphShape {
  switch (event.type) {
    case 'spawn_aoe':
      return { radius: event.aoe.radius, shape: 'circle' };
    case 'spawn_donut':
      return { ...event.donut, shape: 'donut' };
    case 'spawn_line':
      return { ...event.line, shape: 'line' };
    case 'spawn_cone':
      return { ...event.cone, shape: 'cone' };
    case 'spawn_stack':
      return { radius: event.stack.radius, shape: 'stack' };
  }
}

function eventRadius(event: TimelineEvent): number {
  const shape = eventShape(event);

  switch (shape.shape) {
    case 'circle':
    case 'cone':
    case 'stack':
      return shape.radius;
    case 'donut':
      return shape.outerRadius;
    case 'line':
      return shape.length;
  }
}

function pointHitsTelegraph(point: Point, telegraph: ActiveTelegraph): boolean {
  const shape = telegraph.shape ?? {
    radius: telegraph.radius,
    shape: 'circle' as const,
  };

  switch (shape.shape) {
    case 'circle':
    case 'stack':
      return distance(point, telegraph.position) <= shape.radius;
    case 'donut': {
      const pointDistance = distance(point, telegraph.position);

      return (
        pointDistance >= shape.innerRadius && pointDistance <= shape.outerRadius
      );
    }
    case 'line':
      return pointHitsLine(point, telegraph.position, shape);
    case 'cone':
      return pointHitsCone(point, telegraph.position, shape);
  }
}

function pointHitsLine(
  point: Point,
  origin: Point,
  shape: Extract<TelegraphShape, { shape: 'line' }>,
): boolean {
  const relative = { x: point.x - origin.x, y: point.y - origin.y };
  const rotation = degreesToRadians(shape.rotation);
  const localX = relative.x * Math.cos(rotation) + relative.y * Math.sin(rotation);
  const localY = -relative.x * Math.sin(rotation) + relative.y * Math.cos(rotation);

  return localX >= 0 && localX <= shape.length && Math.abs(localY) <= shape.width / 2;
}

function pointHitsCone(
  point: Point,
  origin: Point,
  shape: Extract<TelegraphShape, { shape: 'cone' }>,
): boolean {
  const relative = { x: point.x - origin.x, y: point.y - origin.y };
  const pointDistance = length(relative);

  if (pointDistance > shape.radius) {
    return false;
  }

  if (pointDistance === 0) {
    return true;
  }

  const angle = normalizeDegrees((Math.atan2(relative.y, relative.x) * 180) / Math.PI);
  const rotation = normalizeDegrees(shape.rotation);
  const difference = Math.abs(shortestAngleDifference(angle, rotation));

  return difference <= shape.angle / 2;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function shortestAngleDifference(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

function distance(a: Point, b: Point): number {
  return length({ x: a.x - b.x, y: a.y - b.y });
}

function copyEvent(event: TimelineEvent): TimelineEvent {
  return structuredClone(event);
}

function copyTelegraph(telegraph: ActiveTelegraph): ActiveTelegraph {
  return {
    ...telegraph,
    position: { ...telegraph.position },
    shape: telegraph.shape ? structuredClone(telegraph.shape) : undefined,
  };
}

function copyResolvedEffect(effect: ResolvedEffect): ResolvedEffect {
  return {
    ...effect,
    position: { ...effect.position },
    shape: effect.shape ? structuredClone(effect.shape) : undefined,
    affectedRoles: [...effect.affectedRoles],
  };
}
