import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const directory = await mkdtemp(join(tmpdir(), 'askalign-recovery-'));
async function connect() {
  const client = new Client({name:'answer-recovery-test',version:'1'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server/index.mjs',import.meta.url))],env:{...process.env,ASKALIGN_ANSWERS_DIR:directory}}));
  return client;
}
let client = await connect();
const ask = async () => (await client.callTool({name:'grill_me_ask',arguments:{question:'如何曝光？',options:[{label:'演示'},{label:'下载'}]}})).structuredContent;
const read = async decisionId => (await client.callTool({name:'grill_me_read_answer',arguments:{decisionId}})).structuredContent;
const save = (decisionId,answers) => client.callTool({name:'grill_me_submit_answer',arguments:{decisionId,answers}});
try {
  const a=await ask(), b=await ask();
  assert.equal((await read(a.decisionId)).status,'pending');
  const input=[{picks:[2],custom:'直接发到github上会有人看吗'}];
  assert.ok(!(await save(a.decisionId,input)).isError);
  assert.ok(!(await save(a.decisionId,input)).isError,'identical retries are safe');
  assert.equal((await save(a.decisionId,[{picks:[0],custom:''}])).isError,true,'conflicting replay cannot overwrite');
  assert.equal((await save(b.decisionId,[{picks:[9],custom:''}])).isError,true);
  assert.equal((await read(b.decisionId)).status,'pending','another card stays isolated');
  await client.close(); client=await connect();
  const recovered=await read(a.decisionId);
  assert.equal(recovered.status,'answered');
  assert.equal(recovered.items[0].answers[0],input[0].custom,'answer survives restart even if model receives only placeholder');
  await save(b.decisionId,[{picks:[1],custom:'unselected private draft'}]);
  const normal=await read(b.decisionId);
  assert.deepEqual(normal.items[0].answers,['下载']);
  assert.equal(normal.answers[0].custom,'','do not persist unselected drafts');
  console.log('Answer recovery passed: custom and normal answers, restart, isolated IDs, idempotent retry and conflict rejection');
} finally { await client.close(); await rm(directory,{recursive:true,force:true}); }
