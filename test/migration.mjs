import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { oldSettingsDirectory } from '../server/legacy-installation.mjs';
const dir=await mkdtemp(join(tmpdir(),'spellout-migration-'));
const script=fileURLToPath(new URL('../server/preferences.mjs',import.meta.url));
const run=(home,custom)=>spawnSync(process.execPath,['--input-type=module','-e',`const p=await import(${JSON.stringify(new URL('../server/preferences.mjs',import.meta.url).href)});const state=await p.readPreferenceState();console.log(JSON.stringify(p.onboardingFor(state.configured)));`],{encoding:'utf8',env:{...process.env,HOME:home,USERPROFILE:home,SPELLOUT_SETTINGS_PATH:custom??''}});
try{
 const home=join(dir,'home'),old=join(home,'.config',oldSettingsDirectory),current=join(home,'.config','spellout');await mkdir(join(old,'answers'),{recursive:true});
 const prefs='{"intensity":"deep","diversity":"exploratory"}\n';await writeFile(join(old,'preferences.json'),prefs);await writeFile(join(old,'answers','keep.json'),'keep');
 let result=run(home);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).required,false,'migrated preferences do not trigger onboarding');assert.equal(await readFile(join(current,'preferences.json'),'utf8'),prefs);assert.deepEqual(await readdir(current),['preferences.json']);
 await writeFile(join(old,'preferences.json'),'{"intensity":"minimal"}');result=run(home);assert.equal(result.status,0);assert.equal(await readFile(join(current,'preferences.json'),'utf8'),prefs,'existing new preferences never overwritten');
 assert.equal(await readFile(join(old,'answers','keep.json'),'utf8'),'keep');
 const customHome=join(dir,'custom-home');await mkdir(join(customHome,'.config',oldSettingsDirectory),{recursive:true});await writeFile(join(customHome,'.config',oldSettingsDirectory,'preferences.json'),prefs);assert.equal(run(customHome,join(customHome,'custom.json')).status,0);await assert.rejects(readFile(join(customHome,'custom.json')),{code:'ENOENT'});
 console.log('Migration passed: preferences copied once, source retained, no answers copied, custom path untouched');
}finally{await rm(dir,{recursive:true,force:true});}
