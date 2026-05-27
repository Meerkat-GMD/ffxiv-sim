import { useState, type ChangeEvent } from 'react';
import {
  parseEncounterDocument,
  type EncounterDocument,
} from '../shared/encounter';

type EncounterControlsProps = {
  encounter: EncounterDocument;
  onApplyEncounter?: (encounter: EncounterDocument) => void;
  onLoadFromServer?: (encounterId: string) => void;
  onSaveToServer?: () => void;
  statusMessage?: string;
};

export function EncounterControls({
  encounter,
  onApplyEncounter,
  onLoadFromServer,
  onSaveToServer,
  statusMessage,
}: EncounterControlsProps) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [encounterId, setEncounterId] = useState('');

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const parsed = parseEncounterDocument(JSON.parse(await file.text()));
      setErrorMessage(undefined);
      onApplyEncounter?.(parsed);
    } catch (error) {
      setErrorMessage(
        `Import failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      input.value = '';
    }
  }

  return (
    <aside className="panel encounter-panel" aria-label="Encounter controls">
      <h2>Encounter</h2>

      <div className="encounter-controls">
        <button
          aria-label="Export encounter"
          className="timeline-button"
          onClick={() => exportEncounter(encounter)}
          type="button"
        >
          Export
        </button>
        <label className="file-import-button">
          Import
          <input
            accept="application/json,.json"
            aria-label="Import encounter JSON"
            onChange={handleImport}
            type="file"
          />
        </label>
      </div>

      <div className="encounter-server-controls">
        <button
          aria-label="Save encounter to server"
          className="timeline-button"
          disabled={!onSaveToServer}
          onClick={onSaveToServer}
          type="button"
        >
          Save
        </button>
        <input
          aria-label="Server encounter id"
          onChange={(event) => setEncounterId(event.currentTarget.value)}
          placeholder="encounter id"
          type="text"
          value={encounterId}
        />
        <button
          aria-label="Load encounter from server"
          className="timeline-button"
          disabled={!onLoadFromServer || encounterId.trim().length === 0}
          onClick={() => onLoadFromServer?.(encounterId.trim())}
          type="button"
        >
          Load
        </button>
      </div>

      {errorMessage ? <p className="encounter-error">{errorMessage}</p> : null}
      {statusMessage ? <p className="encounter-status">{statusMessage}</p> : null}
    </aside>
  );
}

export function exportEncounter(encounter: EncounterDocument) {
  const blob = new Blob([JSON.stringify(encounter, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.download = `${safeFileName(encounter.name)}.json`;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'encounter';
}
