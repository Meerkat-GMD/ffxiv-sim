import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  parseEncounterDocument,
  type EncounterDocument,
} from '../src/shared/encounter';

export type EncounterStore = ReturnType<typeof createEncounterStore>;

export function createEncounterStore(baseDir = 'server/data/encounters') {
  async function saveEncounter(
    encounter: EncounterDocument,
    requestedId = createEncounterId(encounter.name),
  ) {
    const id = safeEncounterId(requestedId);
    const document = parseEncounterDocument(encounter);

    await mkdir(baseDir, { recursive: true });
    await writeFile(
      filePath(id),
      JSON.stringify(document, null, 2),
      'utf-8',
    );

    return { id };
  }

  async function loadEncounter(id: string) {
    const contents = await readFile(filePath(safeEncounterId(id)), 'utf-8');

    return parseEncounterDocument(JSON.parse(contents));
  }

  async function listEncounters() {
    await mkdir(baseDir, { recursive: true });

    return (await readdir(baseDir))
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => fileName.slice(0, -'.json'.length))
      .sort();
  }

  function filePath(id: string) {
    return join(baseDir, `${id}.json`);
  }

  return {
    listEncounters,
    loadEncounter,
    saveEncounter,
  };
}

function createEncounterId(name: string) {
  return `${safeEncounterId(name)}-${Date.now().toString(36)}`;
}

function safeEncounterId(value: string) {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  if (id.length === 0) {
    throw new Error('Encounter id is required');
  }

  return id;
}
