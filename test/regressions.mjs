import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { policyFor } from '../server/preferences.mjs';
import { installSkill } from '../scripts/setup.mjs';
const text=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
test('A2 interview text does not claim an automatic follow-up',async()=>{
  for(const path of ['skills/spellout/SKILL.md','server/preferences.mjs','docs/SETTINGS.md'])assert.doesNotMatch(await text(path),/自动附带|卡片自动发送|automatically appended|card.s automatic|answer ends with/);
});
test('compatible needs explicitly use multiple selection without forced prioritization',async()=>{
  const skill=await text('skills/spellout/SKILL.md');
  assert.doesNotMatch(skill,/每题给 2–3 个具体、互斥/);
  assert.match(skill,/multiple: true/);
  for(const intensity of ['minimal','balanced','deep']){
    const policy=policyFor({intensity}).instructions.join('\n');
    assert.match(policy,/multiple: true/);
    assert.match(policy,/mutually exclusive/);
    assert.match(policy,/Do not invent a priority/);
  }
  assert.match(await text('server/index.mjs'),/Set multiple: true for compatible/);
});

test('A3 minimal only asks blocking choices',()=>{
  const policy=policyFor({intensity:'minimal'}).instructions.join('\n');
  assert.doesNotMatch(policy,/applies at every intensity|For an unresolved choice.*call spellout_ask/);
  assert.match(policy,/non-blocking.*stated.*assumptions/i);
});
test('A3 skill agrees with minimal policy',async()=>{
  assert.doesNotMatch(await text('skills/spellout/SKILL.md'),/不因提问强度较低而改成纯文字/);
});
test('A4 acknowledged latest revision is processed, correction is not',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'spellout-processed-'));const old=process.env.SPELLOUT_ANSWERS_DIR;process.env.SPELLOUT_ANSWERS_DIR=dir;
  try{const a=await import('../server/answers.mjs');const id=randomUUID();await a.rememberDecision({decisionId:id,questions:[{question:'Pick',options:[{label:'A'},{label:'B'}]}]});
    await a.saveAnswer(id,[{picks:[0]}]);assert.equal((await a.readAnswer(id)).processed,false);
    await a.acknowledgeAnswer(id,0,'Review');assert.equal((await a.readAnswer(id)).processed,true);
    await a.reviseAnswer(id,[{picks:[1]}],0,randomUUID());assert.equal((await a.readAnswer(id)).processed,false);
  }finally{if(old===undefined)delete process.env.SPELLOUT_ANSWERS_DIR;else process.env.SPELLOUT_ANSWERS_DIR=old;await fs.rm(dir,{recursive:true,force:true});}
});
test('A5 untouched skill upgrades with a verified version backup; user edits stop upgrade',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'spellout-upgrade-'));const source=join(dir,'source'),target=join(dir,'target');
  try{await fs.mkdir(source);await fs.writeFile(join(source,'SKILL.md'),'v1');await installSkill(source,target,'0.4.0');
    const metadata=JSON.parse(await fs.readFile(join(target,'.spellout-install.json'),'utf8'));assert.equal(metadata.version,'0.4.0');
    await fs.writeFile(join(source,'SKILL.md'),'v2');await installSkill(source,target,'0.5.0');assert.equal(await fs.readFile(join(target,'SKILL.md'),'utf8'),'v2');
    const backup=(await fs.readdir(dir)).find(n=>n.startsWith('target.backup-0.4.0-'));assert.ok(backup);assert.equal(await fs.readFile(join(dir,backup,'SKILL.md'),'utf8'),'v1');
    await fs.writeFile(join(target,'SKILL.md'),'user edits');await fs.writeFile(join(source,'SKILL.md'),'v3');await assert.rejects(installSkill(source,target,'0.6.0'),/differs|conflict/i);assert.equal(await fs.readFile(join(target,'SKILL.md'),'utf8'),'user edits');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('A7 partial write failure cleans the answer temp file',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'spellout-partial-'));const old=process.env.SPELLOUT_ANSWERS_DIR;process.env.SPELLOUT_ANSWERS_DIR=dir;
  try{
    // Inject a real partial filesystem write followed by ENOSPC at the module boundary.
    globalThis.__answerFs={...fs,writeFile:async(path)=>{await fs.writeFile(path,'partial');throw Object.assign(new Error('disk full'),{code:'ENOSPC'});}};
    let code=await text('server/answers.mjs');code=code.replace(/import \{([^}]+)\} from 'node:fs\/promises';/,'const {$1}=globalThis.__answerFs;').replace("'./preferences.mjs'",JSON.stringify(new URL('../server/preferences.mjs',import.meta.url).href));
    const a=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    await assert.rejects(a.createRecord(randomUUID(),'answer',{}),{code:'ENOSPC'});assert.deepEqual(await fs.readdir(dir),[]);
  }finally{delete globalThis.__answerFs;if(old===undefined)delete process.env.SPELLOUT_ANSWERS_DIR;else process.env.SPELLOUT_ANSWERS_DIR=old;await fs.rm(dir,{recursive:true,force:true});}
});
test('A9 documented settings and round size match implementation',async()=>{
  const settings=await text('docs/SETTINGS.md');for(const field of ['diversity','challenge','questionsPerRound'])assert.match(settings,new RegExp('\\| '+field+' \\|'));
  const pkg=JSON.parse(await text('package.json'));assert.match(pkg.description,/1.{0,4}5/);
  assert.doesNotMatch(await text('README.md'),/excluding[^.]*historical card versions/);
});
