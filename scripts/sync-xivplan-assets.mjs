import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(appRoot, '..');

const syncTargets = [
  {
    label: 'marker',
    source: path.join(workspaceRoot, 'xivplan', 'public', 'marker'),
    destination: path.join(appRoot, 'public', 'assets', 'xivplan', 'marker'),
  },
  {
    label: 'actor',
    source: path.join(workspaceRoot, 'xivplan', 'public', 'actor'),
    destination: path.join(appRoot, 'public', 'assets', 'xivplan', 'actor'),
  },
];

async function assertDirectory(directory, label) {
  let info;

  try {
    info = await stat(directory);
  } catch (error) {
    throw new Error(`${label} directory does not exist: ${directory}`, { cause: error });
  }

  if (!info.isDirectory()) {
    throw new Error(`${label} path is not a directory: ${directory}`);
  }
}

async function syncDirectory({ label, source, destination }) {
  await assertDirectory(source, `${label} source`);
  await rm(destination, { force: true, recursive: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
  console.log(`Synced ${label}: ${source} -> ${destination}`);
}

for (const target of syncTargets) {
  await syncDirectory(target);
}
