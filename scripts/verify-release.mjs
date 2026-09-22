import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyRelease(root) {
  const record = JSON.parse(await readFile(join(root, 'RELEASE-PROVENANCE.json'), 'utf8'));
  if (record.schemaVersion !== 1 || !Array.isArray(record.files) || !record.files.length) throw new Error('Invalid release manifest');
  const expected = new Set(['RELEASE-PROVENANCE.json']);
  for (const entry of record.files) {
    if (typeof entry.path !== 'string' || !/^[\w.\-/]+$/.test(entry.path) || entry.path.startsWith('/') || entry.path.split('/').some(p => !p || p === '.' || p === '..') || expected.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid manifest entry');
    expected.add(entry.path);
  }
  async function walk(folder, prefix = '') {
    for (const name of await readdir(folder)) {
      const relative = prefix + name, path = join(folder, name), stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic link: ${relative}`);
      if (stat.isDirectory()) await walk(path, relative + '/');
      else if (!stat.isFile() || !expected.has(relative)) throw new Error(`Unexpected file: ${relative}`);
    }
  }
  await walk(root);
  for (const entry of record.files) {
    const actual = createHash('sha256').update(await readFile(join(root, entry.path))).digest('hex');
    if (actual !== entry.sha256) throw new Error(`Checksum mismatch: ${entry.path}`);
  }
  return record.files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Verified ${await verifyRelease(resolve(dirname(fileURLToPath(import.meta.url)), '..'))} packaged files. This checks integrity, not publisher identity.`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
