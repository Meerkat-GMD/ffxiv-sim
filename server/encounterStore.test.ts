import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultEncounter } from '../src/shared/encounter';
import { createEncounterStore } from './encounterStore';

describe('encounter store', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  it('saves and loads encounter documents by id', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ffxiv-sim-'));
    const store = createEncounterStore(tempDir);
    const encounter = createDefaultEncounter();

    await store.saveEncounter(encounter, 'alpha');

    await expect(store.loadEncounter('alpha')).resolves.toEqual(encounter);
  });

  it('lists saved encounter ids', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ffxiv-sim-'));
    const store = createEncounterStore(tempDir);

    await store.saveEncounter(createDefaultEncounter(), 'alpha');
    await store.saveEncounter(createDefaultEncounter(), 'beta');

    await expect(store.listEncounters()).resolves.toEqual(['alpha', 'beta']);
  });
});
