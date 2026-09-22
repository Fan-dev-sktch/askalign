import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyRelease } from '../scripts/verify-release.mjs';

const root = await mkdtemp(join(tmpdir(), 'grill-integrity-test-'));
const content = 'original release content\n';
const record = { schemaVersion: 1, files: [{ path: 'sample.txt', sha256: createHash('sha256').update(content).digest('hex') }] };
const manifest = () => writeFile(join(root, 'RELEASE-PROVENANCE.json'), JSON.stringify(record));
try {
  await writeFile(join(root, 'sample.txt'), content); await manifest();
  assert.equal(await verifyRelease(root), 1);
  await writeFile(join(root, 'sample.txt'), 'modified');
  await assert.rejects(verifyRelease(root), /Checksum mismatch/);
  await writeFile(join(root, 'sample.txt'), content);
  await writeFile(join(root, 'extra.txt'), 'unexpected');
  await assert.rejects(verifyRelease(root), /Unexpected file/);
  await rm(join(root, 'extra.txt'));
  await rm(join(root, 'sample.txt'));
  await assert.rejects(verifyRelease(root), /ENOENT/);
  record.files[0].path = '../outside.txt'; await manifest();
  await assert.rejects(verifyRelease(root), /Invalid manifest entry/);
  console.log('Release integrity passed: original, tampered, extra, missing, unsafe path');
} finally { await rm(root, { recursive: true, force: true }); }
