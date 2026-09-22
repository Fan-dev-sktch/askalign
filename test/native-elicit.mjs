import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const client = new Client({ name: 'grill-me-native-test', version: '1.0.0' }, {
  capabilities: { elicitation: { form: {} } },
});
const requests = [];
client.setRequestHandler(ElicitRequestSchema, async request => {
  requests.push(request.params);
  return { action: 'accept', content: { choice: '界面' } };
});
const transport = new StdioClientTransport({ command: process.execPath, args: [server] });
try {
  await client.connect(transport);
  const result = await client.callTool({
    name: 'grill_me_native',
    arguments: {
      question: '先看哪里？',
      options: [{ label: '界面' }, { label: '玩法' }],
      locale: 'zh-CN',
    },
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].mode, 'form');
  assert.equal(requests[0].message, '先看哪里？');
  assert.deepEqual(result.structuredContent.answers, ['界面']);
  console.log('Native form elicitation passed');
} finally {
  await client.close();
}
