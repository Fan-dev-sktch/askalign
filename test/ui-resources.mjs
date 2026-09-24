import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createUiResources, revisionOf } from '../server/ui-resources.mjs';

const cache = await mkdtemp(join(tmpdir(), 'spellout-ui-'));
const previousEnv = process.env.SPELLOUT_UI_RESOURCES_DIR;
process.env.SPELLOUT_UI_RESOURCES_DIR = cache;
const client = new Client({ name: 'ui-upgrade-test', version: '1' });
try {
  const old = await createUiResources('<html>Previous release</html>');
  const current = await createUiResources('<html>Current release</html>');
  assert.notEqual(old.uri, current.uri);
  assert.equal(await current.read(old.uri), '<html>Previous release</html>');
  assert.equal(await old.read(current.uri), '<html>Current release</html>', 'an older live resolver can read snapshots created by a newer process');
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server/index.mjs',import.meta.url))],env:{...process.env}}));
  const restored = await client.readResource({uri:old.uri});
  assert.equal(restored.contents[0].uri,old.uri);
  assert.equal(restored.contents[0].text,'<html>Previous release</html>','fresh MCP process serves previously issued URI');
  await assert.rejects(client.readResource({uri:'ui://spellout/card-0000000000000000.html'}));
  await assert.rejects(current.read('ui://spellout/card-../../settings.html'),/Invalid/);
  const hash = old.uri.match(/card-(.+)\.html/)[1];
  await writeFile(join(cache,`card-${hash}.html`),'tampered');
  await assert.rejects(current.read(old.uri),/integrity/);
  console.log('UI resource upgrades passed: restart, mixed processes, missing revision and integrity');
} finally {
  await client.close();
  if (previousEnv === undefined) delete process.env.SPELLOUT_UI_RESOURCES_DIR;
  else process.env.SPELLOUT_UI_RESOURCES_DIR = previousEnv;
  await rm(cache,{recursive:true,force:true});
}
