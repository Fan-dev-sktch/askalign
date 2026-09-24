import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classify, skillState, installSkill, supportedNode } from '../scripts/setup.mjs';
import { oldPluginIds } from '../server/legacy-installation.mjs';
const dir = await mkdtemp(join(tmpdir(),'spellout-setup-'));
try {
  const server = join(dir,'project','server','index.mjs');
  const item = {name:'spellout',enabled:true,transport:{command:process.execPath,args:[server]}};
  assert.equal(supportedNode('22.11.0'),false);
  assert.equal(supportedNode('22.12.0'),true);
  assert.equal(supportedNode('24.0.0'),true);
  assert.equal(classify([],{installed:[]},server).state,'new');
  assert.equal(classify([item],{installed:[]},server).state,'existing');
  assert.equal(classify([{...item,name:'spellout'}],{installed:[]},server).state,'existing');
  assert.equal(classify([{...item,enabled:false}],{installed:[]},server).state,'conflict');
  assert.equal(classify([item],{installed:[]},join(dir,'moved','index.mjs')).state,'conflict');
  assert.equal(classify([item,{...item,name:'spellout'}],{installed:[]},server).state,'conflict');
  assert.equal(classify([],{installed:[{pluginId:'spellout@personal',enabled:false}]},server).state,'plugin');
  assert.throws(()=>classify([],{},server),/Unknown/);
  assert.ok(classify([],{installed:[{pluginId:oldPluginIds[0]+'@personal'}]},server).reason.includes('codex plugin remove '),'legacy plugin command matches the CLI remove subcommand');
  const source=join(dir,'source'),target=join(dir,'user','skills','spellout');
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
