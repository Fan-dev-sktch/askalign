import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const server = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const client = new Client({ name: 'grill-me-smoke', version: '1.0.0' });
const testDir = await mkdtemp(join(tmpdir(), 'askalign-smoke-'));
const transport = new StdioClientTransport({ command: process.execPath, args: [server], env: { ...process.env, ASKALIGN_ANSWERS_DIR: testDir } });
try {
  await client.connect(transport);
  assert.equal(client.getServerVersion().name, 'askalign');
  assert.equal(client.getServerVersion().title, 'AskAlign');
  const tools = await client.listTools();
  for (const tool of tools.tools) {
    assert.ok(tool.title?.startsWith('AskAlign · '), 'every tool has an explicit branded display title');
    if (tool.name.startsWith('grill_me_')) {
      assert.deepEqual(tool._meta?.ui?.visibility, ['app'], 'legacy aliases are not advertised to the model');
      assert.ok(tools.tools.some(t => t.name === tool.name.replace('grill_me_', 'askalign_')), 'each legacy alias has a new entry point');
    }
  }
  const ask = tools.tools.find(tool => tool.name === 'grill_me_ask');
  assert.ok(ask, 'ask tool is advertised');
  const expectedHtml = await readFile(new URL('../server/decision-v8.html', import.meta.url), 'utf8');
  const revision = createHash('sha256').update(expectedHtml).digest('hex').slice(0, 16);
  const resourceUri = `ui://grill-me/decision-${revision}.html`;
  assert.equal(ask._meta?.ui?.resourceUri, resourceUri);
  const result = await client.callTool({ name: 'grill_me_ask', arguments: {
    question: '先做哪一部分？', options: [{ label: '玩法', description: '先验收' }, { label: '美术', description: '先统一风格' }], multiple: false, recommendedIndex: 0,
  } });
  assert.equal(result.structuredContent.question, '先做哪一部分？');
  assert.match(result.structuredContent.decisionId, /^[0-9a-f-]{36}$/i);
  assert.equal(result.structuredContent.questions.length, 1);
  assert.equal(result.structuredContent.options.length, 2);
  assert.match(result.content[0].text, /直接输入自己的想法/);
  const newCard = await client.callTool({name:'askalign_ask',arguments:{question:'名称迁移测试',options:[{label:'继续'},{label:'稍后'}]}});
  const newId = newCard.structuredContent.decisionId;
  const legacySave = await client.callTool({name:'grill_me_submit_answer',arguments:{decisionId:newId,answers:[{picks:[0]}]}});
  assert.equal(legacySave.structuredContent.saved,true);
  const newRead = await client.callTool({name:'askalign_read_answer',arguments:{decisionId:newId}});
  assert.deepEqual(newRead.structuredContent.items[0].answers,['继续'],'old card submit and new reader share answers');
  assert.equal((await client.callTool({name:'grill_me_read_answer',arguments:{decisionId:newId}})).structuredContent.status,'answered');
  const sequence = await client.callTool({ name: 'grill_me_ask', arguments: { questions: [
    { question: '先看哪里？', options: [{ label: '界面' }, { label: '玩法' }], multiple: false },
    { question: '同时检查哪些？', options: [{ label: '操作' }, { label: '音效' }], multiple: true },
  ] } });
  assert.equal(sequence.structuredContent.questions.length, 2);
  assert.notEqual(sequence.structuredContent.decisionId, result.structuredContent.decisionId);
  assert.equal(sequence.structuredContent.questions[1].multiple, true);
  const english = await client.callTool({ name: 'grill_me_ask', arguments: {
    question: 'Which direction should we take?',
    options: [{ label: 'Prototype', description: 'Fast feedback' }, { label: 'Release', description: 'More testing' }],
    locale: 'en',
  } });
  assert.equal(english.structuredContent.locale, 'en');
  assert.match(english.content[0].text, /reply in your own words/);
  assert.equal(result.structuredContent.locale, 'zh-CN');
  const resource = await client.readResource({ uri: resourceUri });
  assert.equal(resource.contents[0].text, expectedHtml, 'resource content matches its advertised revision');
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.equal(resource.contents[0]._meta?.['openai/widgetMinFrameHeight'], 1,
    'allow the completed card to shrink below the Codex default 200px minimum');
  assert.equal(resource.contents[0]._meta?.['openai/widgetHeightHint'], 32,
    'avoid the default 480px placeholder before content height arrives');
  assert.equal(resource.contents[0]._meta?.['openai/widgetShowCodexWidgetInline'], true,
    'keep the card inline rather than using the host Open launcher');
  const html = resource.contents[0].text;
  assert.match(html, /下一题/);
  assert.doesNotMatch(html, /确认并继续|这些答案准确吗/, 'no extra review page');
  assert.match(html, /words\.append\(freeEl\)/, 'free-text field lives inside the custom option');
  assert.match(html, /if\(page===questions\.length\)void submitAnswers\(\)/, 'last answer submits directly');
  assert.match(html, /en:\{loading:/, 'English UI copy exists');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'card script exists');
  new Function(script);
  console.log('MCP smoke passed: tool, result, UI resource');
} finally {
  await client.close();
  await rm(testDir, { recursive: true, force: true });
}
