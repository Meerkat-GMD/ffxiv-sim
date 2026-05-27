import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const distDir = resolve(projectRoot, 'dist');

if (!distDir.startsWith(projectRoot)) {
  throw new Error(`Refusing to remove a path outside the project: ${distDir}`);
}

await rm(distDir, { force: true, recursive: true });
