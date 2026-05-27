import { createInitialPlayers, type Player } from '../sim/players';
import {
  validateTimelineEvents,
  type TimelineEvent,
} from '../sim/timeline';

export type ArenaDocument = {
  radius: number;
  type: 'circle';
};

export type EncounterMarkerDocument = {
  asset: {
    alt: string;
    label: string;
    src: string;
  };
  id: string;
  position: {
    x: number;
    y: number;
  };
};

export type EncounterDocument = {
  arena: ArenaDocument;
  markers: EncounterMarkerDocument[];
  name: string;
  players: Player[];
  schemaVersion: 1;
  timeline: {
    events: TimelineEvent[];
  };
};

export function createDefaultEncounter(): EncounterDocument {
  return {
    arena: { radius: 180, type: 'circle' },
    markers: [],
    name: 'Practice Encounter',
    players: createInitialPlayers(),
    schemaVersion: 1,
    timeline: { events: validateTimelineEvents([]) },
  };
}

export function parseEncounterDocument(value: unknown): EncounterDocument {
  if (!isRecord(value)) {
    throw new Error('Encounter must be an object');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('Encounter schemaVersion must be 1');
  }

  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error('Encounter name is required');
  }

  const arena = parseArena(value.arena);
  const players = parsePlayers(value.players);
  const markers = parseMarkers(value.markers);
  const timeline = parseTimeline(value.timeline);

  return {
    arena,
    markers,
    name: value.name,
    players,
    schemaVersion: 1,
    timeline,
  };
}

function parseArena(value: unknown): ArenaDocument {
  if (!isRecord(value)) {
    throw new Error('Encounter arena must be an object');
  }

  if (value.type !== 'circle') {
    throw new Error('Encounter arena type must be circle');
  }

  if (typeof value.radius !== 'number' || value.radius <= 0) {
    throw new Error('Encounter arena radius must be positive');
  }

  return {
    radius: value.radius,
    type: 'circle',
  };
}

function parsePlayers(value: unknown): Player[] {
  if (!Array.isArray(value)) {
    throw new Error('Encounter players must be an array');
  }

  return structuredClone(value) as Player[];
}

function parseMarkers(value: unknown): EncounterMarkerDocument[] {
  if (!Array.isArray(value)) {
    throw new Error('Encounter markers must be an array');
  }

  return value.map((marker) => {
    if (!isRecord(marker)) {
      throw new Error('Encounter marker must be an object');
    }

    if (typeof marker.id !== 'string' || marker.id.length === 0) {
      throw new Error('Encounter marker id is required');
    }

    if (!isPoint(marker.position)) {
      throw new Error('Encounter marker position is invalid');
    }

    const asset = marker.asset;
    if (
      !isRecord(asset) ||
      typeof asset.alt !== 'string' ||
      typeof asset.label !== 'string' ||
      typeof asset.src !== 'string'
    ) {
      throw new Error('Encounter marker asset is invalid');
    }

    return {
      asset: {
        alt: asset.alt,
        label: asset.label,
        src: asset.src,
      },
      id: marker.id,
      position: {
        x: marker.position.x,
        y: marker.position.y,
      },
    };
  });
}

function parseTimeline(value: unknown): EncounterDocument['timeline'] {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw new Error('Encounter timeline events must be an array');
  }

  return {
    events: validateTimelineEvents(value.events as TimelineEvent[]),
  };
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
