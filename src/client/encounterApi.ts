import {
  parseEncounterDocument,
  type EncounterDocument,
} from '../shared/encounter';

type Fetcher = typeof fetch;

type SaveEncounterOptions = {
  encounter: EncounterDocument;
  encounterId?: string;
  fetcher?: Fetcher;
  serverUrl: string;
};

type LoadEncounterOptions = {
  encounterId: string;
  fetcher?: Fetcher;
  serverUrl: string;
};

export async function saveEncounterToServer({
  encounter,
  encounterId,
  fetcher = fetch,
  serverUrl,
}: SaveEncounterOptions) {
  const response = await fetcher(
    `${serverUrl}/api/encounters${encounterId ? `/${encounterId}` : ''}`,
    {
      body: JSON.stringify(encounter),
      headers: { 'Content-Type': 'application/json' },
      method: encounterId ? 'PUT' : 'POST',
    },
  );

  if (!response.ok) {
    throw new Error('Failed to save encounter');
  }

  return (await response.json()) as { id: string };
}

export async function loadEncounterFromServer({
  encounterId,
  fetcher = fetch,
  serverUrl,
}: LoadEncounterOptions) {
  const response = await fetcher(`${serverUrl}/api/encounters/${encounterId}`);

  if (!response.ok) {
    throw new Error('Failed to load encounter');
  }

  return parseEncounterDocument(await response.json());
}
