import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
const folder = await mkdtemp(join(tmpdir(), 'grill-preferences-'));
const file = join(folder, 'settings.json');
async function connect() {
  const client = new Client({ name: 'preferences-test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server/index.mjs', import.meta.url))], env: { ...process.env, GRILL_ME_SETTINGS_PATH: file } }));
  return client;
}
let client = await connect();
const call = args => client.callTool({ name: 'grill_me_preferences', arguments: args });
try {
  assert.equal((await call({})).structuredContent.policy.intensity, 'balanced');
  assert.equal((await call({ action: 'set', preferences: { intensity: 'deep' } })).structuredContent.policy.depth, 'motivation');
  await client.close(); client = await connect();
  assert.equal((await call({})).structuredContent.policy.intensity, 'deep', 'saved preference survives server restart');
  const temporary = await call({ preferences: { intensity: 'minimal' } });
  assert.equal(temporary.structuredContent.scope, 'task');
  assert.equal(temporary.structuredContent.policy.questionsPerRound, 1);
  assert.equal((await call({})).structuredContent.policy.intensity, 'deep', 'task override does not overwrite default');
  assert.equal((await call({ preferences: { intensity: 'deep', frequency: 'milestones' } })).structuredContent.policy.frequency, 'milestones');
  assert.equal((await call({ action: 'set' })).isError, true);
  await writeFile(file, 'broken');
  assert.equal((await call({})).isError, true, 'corrupt settings are not silently overwritten');
  assert.equal((await call({ action: 'reset' })).structuredContent.policy.intensity, 'balanced');
  console.log('Preferences passed: defaults, persistence, override, policy, validation, recovery');
} finally { await client.close(); await rm(folder, { recursive: true, force: true }); }
