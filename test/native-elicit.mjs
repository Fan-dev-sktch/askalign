import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const client = new Client({ name: 'spellout-native-test', version: '1.0.0' }, {
  capabilities: { elicitation: { form: {} } },
});
const requests = [];
let response = { action: 'accept', content: { choice: '界面' } };
client.setRequestHandler(ElicitRequestSchema, async request => {
  requests.push(request.params);
  return response;
});
const transport = new StdioClientTransport({ command: process.execPath, args: [server] });
try {
  await client.connect(transport);
  const result = await client.callTool({
    name: 'spellout_native',
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
  assert.equal(result.structuredContent.status, 'answered');
  for (const action of ['decline','cancel']) {
    response={action};
    const unavailable=await client.callTool({name:'spellout_native',arguments:{question:'手机系统？',options:[{label:'iOS'},{label:'Android'}],locale:'zh-CN'}});
    assert.equal(unavailable.structuredContent.status,'unanswered');
    assert.equal(unavailable.structuredContent.action,action);
    assert.equal(unavailable.structuredContent.displayConfirmed,false);
    assert.equal(unavailable.structuredContent.answers,undefined);
    assert.equal(unavailable.structuredContent.fallback,'conversation_text');
    assert.doesNotMatch(unavailable.content[0].text,/User (declined|cancelled)/,'a host response cannot be attributed to a user click');
  }
  response={action:'accept',content:{choice:'其他',custom:'设备补充'}};
  const custom=await client.callTool({name:'spellout_native',arguments:{question:'手机系统？',options:[{label:'iOS'},{label:'Android'}],locale:'zh-CN'}});
  assert.deepEqual(custom.structuredContent.answers,['设备补充']);
  const unsupported=new Client({name:'no-form-support',version:'1'}, {capabilities:{}});
  try {
    await unsupported.connect(new StdioClientTransport({command:process.execPath,args:[server]}));
    const unavailable=await unsupported.callTool({name:'spellout_native',arguments:{question:'手机系统？',options:[{label:'iOS'},{label:'Android'}]}});
    assert.equal(unavailable.isError,true);
    assert.equal(unavailable.structuredContent.status,'unavailable');
    assert.equal(unavailable.structuredContent.reason,'form_not_advertised');
    assert.equal(unavailable.structuredContent.displayConfirmed,false);
  } finally { await unsupported.close(); }
  // Host errors and request timeouts must return the same structured
  // "no answer collected" contract instead of a bare protocol error.
  const flaky=new Client({name:'flaky-host',version:'1'},{capabilities:{elicitation:{form:{}}}});
  let flakyMode='error';const flakyRequests=[];
  flaky.setRequestHandler(ElicitRequestSchema,async request=>{flakyRequests.push(request.params);if(flakyMode==='error')throw new Error('Elicitation rejected by host policy');await new Promise(r=>setTimeout(r,1500));return {action:'accept',content:{choice:'iOS'}};});
  try{
    await flaky.connect(new StdioClientTransport({command:process.execPath,args:[server],env:{...process.env,SPELLOUT_NATIVE_TIMEOUT_MS:'1000'}}));
    const failed=await flaky.callTool({name:'spellout_native',arguments:{question:'Which phone OS?',options:[{label:'iOS'},{label:'Android'}]}});
    assert.equal(failed.structuredContent.status,'unanswered');
    assert.equal(failed.structuredContent.reason,'client_error');
    assert.equal(failed.structuredContent.displayConfirmed,false);
    assert.equal(failed.structuredContent.fallback,'conversation_text');
    assert.match(flakyRequests[0].requestedSchema.properties.choice.oneOf.at(-1).const,/^Other$/,'auto locale follows an English question');
    flakyMode='slow';
    const late=await flaky.callTool({name:'spellout_native',arguments:{question:'Which phone OS?',options:[{label:'iOS'},{label:'Android'}]}});
    assert.equal(late.structuredContent.status,'unanswered');
    assert.equal(late.structuredContent.reason,'timeout');
    assert.equal(late.structuredContent.answers,undefined,'a late form submission is not reported as an answer');
    assert.match(late.content[0].text,/later submission .* will not be received/);
  } finally { await flaky.close(); }
  console.log('Native forms passed: accepted, custom, declined, cancelled and unsupported; no assumed user rejection');
} finally {
  await client.close();
}
