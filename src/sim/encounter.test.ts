import { describe, expect, it } from 'vitest';
import {
  createDefaultEncounter,
  parseEncounterDocument,
} from '../shared/encounter';

describe('encounter documents', () => {
  it('accepts a valid default encounter', () => {
    const encounter = createDefaultEncounter();

    expect(parseEncounterDocument(encounter)).toEqual(encounter);
  });

  it('rejects documents without schemaVersion 1', () => {
    expect(() => parseEncounterDocument({ schemaVersion: 999 })).toThrow(
      /schemaVersion/,
    );
  });
});
