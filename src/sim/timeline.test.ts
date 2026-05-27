import { describe, expect, it } from 'vitest';

import { createInitialPlayers, type Player } from './players';
import {
  advanceTimeline,
  createSampleTimeline,
  selectTargetRole,
  type TimelineState,
  validateTimelineEvents,
} from './timeline';
import { type Role } from './roles';

describe('createInitialPlayers', () => {
  it('returns all eight roles with deterministic player data', () => {
    const players = createInitialPlayers();

    expect(players).toEqual([
      {
        id: 'mt',
        role: 'MT',
        position: { x: 0, y: -120 },
        color: '#2563eb',
        connected: true,
      },
      {
        id: 'st',
        role: 'ST',
        position: { x: 0, y: -80 },
        color: '#38bdf8',
        connected: true,
      },
      {
        id: 'h1',
        role: 'H1',
        position: { x: -80, y: 0 },
        color: '#16a34a',
        connected: true,
      },
      {
        id: 'h2',
        role: 'H2',
        position: { x: 80, y: 0 },
        color: '#84cc16',
        connected: true,
      },
      {
        id: 'd1',
        role: 'D1',
        position: { x: -72, y: 72 },
        color: '#dc2626',
        connected: true,
      },
      {
        id: 'd2',
        role: 'D2',
        position: { x: -24, y: 96 },
        color: '#f97316',
        connected: true,
      },
      {
        id: 'd3',
        role: 'D3',
        position: { x: 24, y: 96 },
        color: '#9333ea',
        connected: true,
      },
      {
        id: 'd4',
        role: 'D4',
        position: { x: 72, y: 72 },
        color: '#db2777',
        connected: true,
      },
    ]);
    expect(players.every((player) => /^#[0-9a-f]{6}$/i.test(player.color))).toBe(
      true,
    );
  });
});

describe('createSampleTimeline', () => {
  it('contains the sample DPS AoE event resolving at 10s', () => {
    const timeline = createSampleTimeline();

    expect(timeline.events).toEqual([
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
    expect(timeline.events[0]).toMatchObject({
      telegraphDuration: 5,
      time: 5,
    });
    expect(timeline.activeTelegraphs).toEqual([]);
    expect(timeline.resolvedEffects).toEqual([]);
  });
});

describe('validateTimelineEvents', () => {
  it('rejects duplicate event ids with a clear error', () => {
    const event = createSampleTimeline().events[0];

    expect(() => validateTimelineEvents([event, { ...event }])).toThrow(
      'Timeline event ids must be unique: sample-dps-aoe',
    );
  });
});

describe('selectTargetRole', () => {
  const players = createInitialPlayers();

  it('selects D1 for random DPS when rng returns 0', () => {
    expect(
      selectTargetRole(
        players,
        { roleGroup: 'dps', selection: 'random' },
        () => 0,
      ),
    ).toBe('D1');
  });

  it('can select a later DPS role with another rng value', () => {
    expect(
      selectTargetRole(
        players,
        { roleGroup: 'dps', selection: 'random' },
        () => 0.74,
      ),
    ).toBe('D3');
  });

  it('selects the last candidate when rng returns 1', () => {
    expect(
      selectTargetRole(
        players,
        { roleGroup: 'dps', selection: 'random' },
        () => 1,
      ),
    ).toBe('D4');
  });

  it('clamps negative rng values to the first candidate', () => {
    expect(
      selectTargetRole(
        players,
        { roleGroup: 'dps', selection: 'random' },
        () => -0.25,
      ),
    ).toBe('D1');
  });

  it('clamps NaN and Infinity rng values to the first candidate', () => {
    expect(
      selectTargetRole(
        players,
        { roleGroup: 'dps', selection: 'random' },
        () => Number.NaN,
      ),
    ).toBe('D1');
    expect(
      selectTargetRole(
        players,
        { roleGroup: 'dps', selection: 'random' },
        () => Number.POSITIVE_INFINITY,
      ),
    ).toBe('D1');
  });

  it('returns undefined when there are no connected candidates for the target group', () => {
    const disconnectedDps = players.map((player) =>
      player.role.startsWith('D') ? { ...player, connected: false } : player,
    );

    expect(
      selectTargetRole(
        disconnectedDps,
        { roleGroup: 'dps', selection: 'random' },
        () => 0,
      ),
    ).toBeUndefined();
  });
});

describe('advanceTimeline', () => {
  it('rejects duplicate event ids at the API boundary before spawning telegraphs', () => {
    const timeline = createSampleTimeline();
    const duplicateTimeline = {
      ...timeline,
      events: [timeline.events[0], { ...timeline.events[0] }],
    };

    expect(() =>
      advanceTimeline(duplicateTimeline, createInitialPlayers(), 0, 5, () => 0),
    ).toThrow('Timeline event ids must be unique: sample-dps-aoe');
  });

  it('spawns one telegraph at the selected player snapshot when advancing to 5s', () => {
    const players = createInitialPlayers();
    const d1 = playerByRole(players, 'D1');
    const result = advanceTimeline(
      createSampleTimeline(),
      players,
      0,
      5,
      () => 0,
    );

    expect(result.activeTelegraphs).toHaveLength(1);
    expect(result.activeTelegraphs[0]).toMatchObject({
      id: 'sample-dps-aoe',
      sourceEventId: 'sample-dps-aoe',
      targetRole: 'D1',
      position: d1.position,
      radius: 72,
      spawnedAt: 5,
      resolvesAt: 10,
    });
  });

  it('spawns telegraphs at fixed arena positions', () => {
    const timeline: TimelineState = {
      activeTelegraphs: [],
      events: [
        {
          aoe: { radius: 60, shape: 'circle' },
          id: 'fixed-circle',
          target: {
            position: { x: 40, y: -30 },
            selection: 'fixed_position',
          },
          telegraphDuration: 5,
          time: 5,
          type: 'spawn_aoe',
        },
      ],
      resolvedEffects: [],
    };
    const result = advanceTimeline(timeline, createInitialPlayers(), 0, 5, () => 0);

    expect(result.activeTelegraphs[0]).toMatchObject({
      position: { x: 40, y: -30 },
      targetRole: 'fixed',
    });
  });

  it('does not move the telegraph snapshot when the target moves after spawn', () => {
    const players = createInitialPlayers();
    const spawned = advanceTimeline(
      createSampleTimeline(),
      players,
      0,
      5,
      () => 0,
    );
    const movedPlayers = players.map((player) =>
      player.role === 'D1'
        ? { ...player, position: { x: player.position.x + 500, y: player.position.y } }
        : player,
    );
    const advanced = advanceTimeline(spawned, movedPlayers, 5, 9, () => 0);

    expect(advanced.activeTelegraphs[0].position).toEqual(
      spawned.activeTelegraphs[0].position,
    );
  });

  it('resolves one effect when advancing from 5s to 10s', () => {
    const spawned = advanceTimeline(
      createSampleTimeline(),
      createInitialPlayers(),
      0,
      5,
      () => 0,
    );
    const resolved = advanceTimeline(
      spawned,
      createInitialPlayers(),
      5,
      10,
      () => 0,
    );

    expect(resolved.activeTelegraphs).toHaveLength(0);
    expect(resolved.resolvedEffects).toHaveLength(1);
    expect(resolved.resolvedEffects[0]).toMatchObject({
      sourceEventId: 'sample-dps-aoe',
      targetRole: 'D1',
      resolvedAt: 10,
    });
  });

  it('includes affected player roles for players inside the AoE', () => {
    const players = placePlayers({
      D1: { x: 0, y: 0 },
      D2: { x: 72, y: 0 },
      D3: { x: 73, y: 0 },
      D4: { x: -10, y: 0 },
    });
    const spawned = advanceTimeline(createSampleTimeline(), players, 0, 5, () => 0);
    const resolved = advanceTimeline(spawned, players, 5, 10, () => 0);

    expect(resolved.resolvedEffects[0].affectedRoles).toEqual(['D1', 'D2', 'D4']);
  });

  it('resolves donut AoEs with an unsafe ring and safe center', () => {
    const timeline: TimelineState = {
      activeTelegraphs: [],
      events: [
        {
          donut: { innerRadius: 20, outerRadius: 80 },
          id: 'donut',
          target: { roleGroup: 'dps', selection: 'random' },
          telegraphDuration: 5,
          time: 5,
          type: 'spawn_donut' as const,
        },
      ],
      resolvedEffects: [],
    };
    const players = placePlayers({
      D1: { x: 0, y: 0 },
      D2: { x: 40, y: 0 },
      D3: { x: 90, y: 0 },
    });
    const spawned = advanceTimeline(timeline, players, 0, 5, () => 0);
    const resolved = advanceTimeline(spawned, players, 5, 10, () => 0);

    expect(resolved.resolvedEffects[0].affectedRoles).toEqual(['D2']);
  });

  it('resolves line AoEs by width and length', () => {
    const timeline: TimelineState = {
      activeTelegraphs: [],
      events: [
        {
          id: 'line',
          line: { length: 100, rotation: 0, width: 20 },
          target: { roleGroup: 'dps', selection: 'random' },
          telegraphDuration: 5,
          time: 5,
          type: 'spawn_line' as const,
        },
      ],
      resolvedEffects: [],
    };
    const players = placePlayers({
      D1: { x: 0, y: 0 },
      D2: { x: 50, y: 0 },
      D3: { x: 50, y: 12 },
      D4: { x: 110, y: 0 },
    });
    const spawned = advanceTimeline(timeline, players, 0, 5, () => 0);
    const resolved = advanceTimeline(spawned, players, 5, 10, () => 0);

    expect(resolved.resolvedEffects[0].affectedRoles).toEqual(['D1', 'D2']);
  });

  it('resolves cone AoEs by radius and angle', () => {
    const timeline: TimelineState = {
      activeTelegraphs: [],
      events: [
        {
          cone: { angle: 90, radius: 100, rotation: 0 },
          id: 'cone',
          target: { roleGroup: 'dps', selection: 'random' },
          telegraphDuration: 5,
          time: 5,
          type: 'spawn_cone' as const,
        },
      ],
      resolvedEffects: [],
    };
    const players = placePlayers({
      D1: { x: 0, y: 0 },
      D2: { x: 50, y: 0 },
      D3: { x: 0, y: 50 },
    });
    const spawned = advanceTimeline(timeline, players, 0, 5, () => 0);
    const resolved = advanceTimeline(spawned, players, 5, 10, () => 0);

    expect(resolved.resolvedEffects[0].affectedRoles).toEqual(['D1', 'D2']);
  });

  it('resolves stack markers as shared circle hits', () => {
    const timeline: TimelineState = {
      activeTelegraphs: [],
      events: [
        {
          id: 'stack',
          stack: { radius: 48 },
          target: { roleGroup: 'healer', selection: 'random' },
          telegraphDuration: 5,
          time: 5,
          type: 'spawn_stack' as const,
        },
      ],
      resolvedEffects: [],
    };
    const players = placePlayers({
      H1: { x: 0, y: 0 },
      MT: { x: 30, y: 0 },
      D1: { x: 49, y: 0 },
    });
    const spawned = advanceTimeline(timeline, players, 0, 5, () => 0);
    const resolved = advanceTimeline(spawned, players, 5, 10, () => 0);

    expect(resolved.resolvedEffects[0].affectedRoles).toEqual(['MT', 'H1']);
  });

  it('does not duplicate telegraphs or resolutions when advancing an already-advanced state', () => {
    const players = createInitialPlayers();
    const spawned = advanceTimeline(createSampleTimeline(), players, 0, 5, () => 0);
    const spawnedAgain = advanceTimeline(spawned, players, 0, 5, () => 0);
    const resolved = advanceTimeline(spawnedAgain, players, 5, 10, () => 0);
    const resolvedAgain = advanceTimeline(resolved, players, 5, 10, () => 0);

    expect(spawnedAgain.activeTelegraphs).toHaveLength(1);
    expect(resolvedAgain.activeTelegraphs).toHaveLength(0);
    expect(resolvedAgain.resolvedEffects).toHaveLength(1);
  });

  it('does not mutate the input timeline or players', () => {
    const timeline = createSampleTimeline();
    const players = createInitialPlayers();
    const timelineBefore = deepClone(timeline);
    const playersBefore = deepClone(players);

    advanceTimeline(timeline, players, 0, 5, () => 0);

    expect(timeline).toEqual(timelineBefore);
    expect(players).toEqual(playersBefore);
  });
});

function playerByRole(players: Player[], role: Role): Player {
  const player = players.find((candidate) => candidate.role === role);

  if (!player) {
    throw new Error(`Missing player ${role}`);
  }

  return player;
}

function placePlayers(positions: Partial<Record<Role, Player['position']>>): Player[] {
  return createInitialPlayers().map((player) => ({
    ...player,
    position: positions[player.role] ?? { x: 500, y: 500 },
  }));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
