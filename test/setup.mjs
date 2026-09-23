import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classify, skillState, installSkill, supportedNode } from '../scripts/setup.mjs';
const dir = await mkdtemp(join(tmpdir(),'askalign-setup-'));
try {
  const server = join(dir,'project','server','index.mjs');
  const item = {name:'grill-me-ui',enabled:true,transport:{command:process.execPath,args:[server]}};
  assert.equal(supportedNode('22.11.0'),false);
  assert.equal(supportedNode('22.12.0'),true);
  assert.equal(supportedNode('24.0.0'),true);
  assert.equal(classify([],{installed:[]},server).state,'new');
  assert.equal(classify([item],{installed:[]},server).state,'existing');
  assert.equal(classify([{...item,name:'askalign'}],{installed:[]},server).state,'existing');
  assert.equal(classify([{...item,enabled:false}],{installed:[]},server).state,'conflict');
  assert.equal(classify([item],{installed:[]},join(dir,'moved','index.mjs')).state,'conflict');
  assert.equal(classify([item,{...item,name:'askalign'}],{installed:[]},server).state,'conflict');
  assert.equal(classify([],{installed:[{pluginId:'grill-me@personal',enabled:false}]},server).state,'plugin');
  assert.throws(()=>classify([],{},server),/Unknown/);
  const source=join(dir,'source'),target=join(dir,'user','skills','grill-me');
  await mkdir(source);await writeFile(join(source,'SKILL.md'),'original');
  assert.equal(await skillState(source,target),'missing');
  await installSkill(source,target);assert.equal(await skillState(source,target),'same');
  await installSkill(source,target); // Idempotent install.
  await writeFile(join(target,'SKILL.md'),'user edits');
  await assert.rejects(installSkill(source,target),/differs/);
  assert.equal(await readFile(join(target,'SKILL.md'),'utf8'),'user edits');
  await writeFile(join(target,'extra.md'),'keep');
  assert.equal(await skillState(source,target),'conflict');
  console.log('Setup passed: new/existing/plugin/conflict, disabled and moved installs, preserved user edits, idempotent copy');
} finally { await rm(dir,{recursive:true,force:true}); }
