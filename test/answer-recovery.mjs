import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { setTimeout as delay } from 'node:timers/promises';
import { waitForAnswer } from '../server/answers.mjs';

const directory = await mkdtemp(join(tmpdir(), 'spellout-recovery-'));
async function connect() {
  const client = new Client({name:'answer-recovery-test',version:'1'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server/index.mjs',import.meta.url))],env:{...process.env,SPELLOUT_ANSWERS_DIR:directory}}));
  return client;
}
let client = await connect();
const ask = async () => (await client.callTool({name:'spellout_ask',arguments:{question:'如何曝光？',options:[{label:'演示'},{label:'下载'}]}})).structuredContent;
const read = async decisionId => (await client.callTool({name:'spellout_read_answer',arguments:{decisionId}})).structuredContent;
const save = (decisionId,answers) => client.callTool({name:'spellout_submit_answer',arguments:{decisionId,answers}});
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
  const waiting = await ask();
  const pending = await client.callTool({name:'spellout_read_answer',arguments:{decisionId:waiting.decisionId,waitMs:30}});
  assert.equal(pending.structuredContent.status,'pending','timeout must not invent a choice');
  assert.equal(waiting.continuation.action,'wait_for_answer','issuing a card starts waiting, not a final reply');
  for(let i=0;i<3;i++){
    const next=await client.callTool({name:'spellout_read_answer',arguments:{decisionId:waiting.decisionId,waitMs:20}});
    assert.deepEqual(next.structuredContent.continuation,{
      action:'wait_for_answer',tool:'spellout_read_answer',arguments:{decisionId:waiting.decisionId,waitMs:30000,contextVersion:0},
    },'each timeout carries another bounded wait for the same card');
  }
  assert.equal((await client.callTool({name:'spellout_read_answer',arguments:{decisionId:waiting.decisionId,waitMs:30001}})).isError,true);
  const second = await connect();
  try {
    const resultPromise = client.callTool({name:'spellout_read_answer',arguments:{decisionId:waiting.decisionId,waitMs:5000}});
    await delay(100);
    await second.callTool({name:'spellout_submit_answer',arguments:{decisionId:waiting.decisionId,answers:[{picks:[1]}]}});
    const result = await resultPromise;
    assert.equal(result.structuredContent.status,'answered');
    assert.equal(result.structuredContent.continuation,undefined,'an answer exits the waiting loop');
    assert.deepEqual(result.structuredContent.items[0].answers,['下载'],'active read receives cross-process answer without a queued message');
  } finally { await second.close(); }
  const sameProcess = await ask();
  const sameWait = client.callTool({name:'spellout_read_answer',arguments:{decisionId:sameProcess.decisionId,waitMs:5000}});
  await delay(50);
  await save(sameProcess.decisionId,[{picks:[0]}]);
  assert.equal((await sameWait).structuredContent.status,'answered','waiting must not block the submitting tool');
  const dismiss = decisionId => client.callTool({name:'spellout_dismiss',arguments:{decisionId}});
  const retired=await ask(), isolated=await ask();
  const retireWait=client.callTool({name:'spellout_read_answer',arguments:{decisionId:retired.decisionId,waitMs:5000}});
  assert.equal((await dismiss(retired.decisionId)).structuredContent.status,'dismissed');
  const retiredRead=(await retireWait).structuredContent;
  assert.equal(retiredRead.status,'dismissed','dismissal wakes a pending wait');
  assert.equal(retiredRead.continuation,undefined,'text replacing the card exits the waiting loop');
  assert.equal((await dismiss(retired.decisionId)).structuredContent.status,'dismissed','idempotent dismissal');
  assert.equal((await read(isolated.decisionId)).status,'pending','another task remains pending');
  const lateSave=await save(retired.decisionId,[{picks:[0]}]);
  assert.equal(lateSave.isError,true);
  assert.equal(lateSave.structuredContent.status,'dismissed','late clicks get an actionable retired result');
  assert.equal((await dismiss(a.decisionId)).structuredContent.status,'answered','saved answer is never erased');
  assert.equal((await dismiss('00000000-0000-4000-8000-000000000001')).structuredContent.status,'unknown');
  const racer=await connect();
  try {
    for(let i=0;i<12;i++){
      const racing=await ask();
      const [retireResult,saveResult]=await Promise.all([
        dismiss(racing.decisionId),
        racer.callTool({name:'spellout_submit_answer',arguments:{decisionId:racing.decisionId,answers:[{picks:[1]}]}}),
      ]);
      const final=await read(racing.decisionId);
      assert.ok(['dismissed','answered'].includes(final.status));
      assert.equal(retireResult.structuredContent.status,final.status);
      assert.equal(Boolean(saveResult.isError),final.status==='dismissed','one atomic winner across processes');
    }
  } finally {await racer.close();}
  await client.close();client=await connect();
  assert.equal((await read(retired.decisionId)).status,'dismissed','dismissal survives restart');
  console.log('Decision lifecycle passed: dismissal, late clicks, answer preservation, task isolation and cross-process races');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(waitForAnswer(waiting.decisionId,30000,controller.signal),{name:'AbortError'});
  console.log('Answer priority passed: bounded wait, same-process and cross-process submissions, cancellation');
  console.log('Answer recovery passed: custom and normal answers, restart, isolated IDs, idempotent retry and conflict rejection');
} finally { await client.close(); await rm(directory,{recursive:true,force:true}); }
