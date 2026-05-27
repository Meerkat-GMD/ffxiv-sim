import { describe, expect, it, vi } from 'vitest';
import { createDefaultEncounter } from '../shared/encounter';
import { loadEncounterFromServer, saveEncounterToServer } from './encounterApi';

describe('encounter api client', () => {
  it('saves encounters to the server', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: 'alpha' }),
      ok: true,
    });

    await expect(
      saveEncounterToServer({
        encounter: createDefaultEncounter(),
        fetcher,
        serverUrl: 'http://localhost:3001',
      }),
    ).resolves.toEqual({ id: 'alpha' });

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/api/encounters',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('loads encounters from the server', async () => {
    const encounter = createDefaultEncounter();
    const fetcher = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(encounter),
      ok: true,
    });

    await expect(
      loadEncounterFromServer({
        encounterId: 'alpha',
        fetcher,
        serverUrl: 'http://localhost:3001',
      }),
    ).resolves.toEqual(encounter);
  });
});
