import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createUiResources, revisionOf } from '../server/ui-resources.mjs';

const cache = await mkdtemp(join(tmpdir(), 'askalign-ui-'));
const previousEnv = process.env.ASKALIGN_UI_RESOURCES_DIR;
process.env.ASKALIGN_UI_RESOURCES_DIR = cache;
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
  const reportedUri = 'ui://grill-me/decision-daeeebd045e86374.html';
  const recovered = await client.readResource({uri:reportedUri});
  assert.equal(recovered.contents[0].uri,reportedUri);
  assert.equal(revisionOf(recovered.contents[0].text),'daeeebd045e86374','the exact URI from the reported failure resolves to its original bytes');
  await assert.rejects(client.readResource({uri:'ui://grill-me/decision-0000000000000000.html'}));
  await assert.rejects(current.read('ui://grill-me/decision-../../settings.html'),/Invalid/);
  const hash = old.uri.match(/decision-(.+)\.html/)[1];
  await writeFile(join(cache,`decision-${hash}.html`),'tampered');
  await assert.rejects(current.read(old.uri),/integrity/);
  console.log('UI resource upgrades passed: restart, mixed processes, reported legacy URI, missing revision and integrity');
} finally {
  await client.close();
  if (previousEnv === undefined) delete process.env.ASKALIGN_UI_RESOURCES_DIR;
  else process.env.ASKALIGN_UI_RESOURCES_DIR = previousEnv;
  await rm(cache,{recursive:true,force:true});
}
