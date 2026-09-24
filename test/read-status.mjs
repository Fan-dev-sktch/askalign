import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const directory = await mkdtemp(join(tmpdir(), 'spellout-read-status-'));
const server = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const client = new Client({ name: 'read-status-test', version: '1' });
const call = async (name, args) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result.content));
  return result.structuredContent;
};
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], env: {
    ...process.env, SPELLOUT_ANSWERS_DIR: directory, SPELLOUT_SETTINGS_PATH: join(directory, 'preferences.json'),
  } }));
  const card = await call('spellout_ask', { question: '先做哪部分？', options: [{ label: '界面' }, { label: '玩法' }] });
  const decisionId = card.decisionId;
  const first = await call('spellout_read_answer', { decisionId });
  assert.equal(first.cardSeen, false);
  assert.ok(first.context.policy);
  const lean = await call('spellout_read_answer', { ...card.continuation.arguments, waitMs: 10 });
  assert.equal(lean.context.unchanged, true);
  assert.equal(lean.context.policy, undefined);
  assert.equal(lean.continuation.action, 'wait_for_answer', 'timeouts preserve the user requested wait');

  const poll = await call('spellout_read_answer', { decisionId, source: 'card', contextVersion: 0, waitMs: 30000 });
  assert.ok(poll.context.policy, 'UI polls always receive full context, even with a matching version');
  assert.equal(poll.continuation, undefined, 'UI polls neither wait nor receive model continuation instructions');
  assert.equal(poll.waiterIdleMs, undefined, 'poll timestamps cannot establish whether the assistant is active');
  assert.equal((await call('spellout_read_answer', { decisionId })).cardSeen, true);

  const updated = await call('spellout_context', { action: 'update', contextId: card.contextId, expectedVersion: 0,
    requestId: randomUUID(), brief: { goal: '先验证手机显示', confirmed: '', open: '客户端支持情况' } });
  const changed = await call('spellout_read_answer', { decisionId, contextVersion: 0 });
  assert.equal(changed.context.brief.goal, updated.brief.goal, 'changed context must not be suppressed');
  assert.ok(changed.context.policy);
  assert.equal(changed.continuation.arguments.contextVersion, 1);
  const again = await call('spellout_read_answer', { ...changed.continuation.arguments, waitMs: 10 });
  assert.equal(again.context.unchanged, true);

  const unknown = randomUUID();
  assert.equal((await call('spellout_read_answer', { decisionId: unknown, source: 'card' })).status, 'unknown');
  assert.ok(!(await readdir(directory)).some(name => name.startsWith(unknown)), 'unknown cards cannot create seen markers');
  const other = await call('spellout_ask', { question: '另一任务？', options: [{ label: '是' }, { label: '否' }] });
  assert.equal((await call('spellout_read_answer', { decisionId: other.decisionId })).cardSeen, false);

  await call('spellout_submit_answer', { decisionId, answers: [{ picks: [1] }] });
  const answered = await call('spellout_read_answer', { decisionId, contextVersion: 1, waitMs: 30000 });
  assert.equal(answered.status, 'answered');
  assert.ok(answered.context.policy, 'an answer always carries the full policy and brief');
  assert.equal(answered.continuation, undefined);
  console.log('Read status passed: lean assistant polls, full UI context, updates, connection evidence, isolation and saved answers');
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
