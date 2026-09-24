import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { oldSkillDirectory, oldServerNames } from '../server/legacy-installation.mjs';
import { installSkill } from '../scripts/skill-install.mjs';
const dir=await mkdtemp(join(tmpdir(),'spellout-check-'));
const setup=fileURLToPath(new URL('../scripts/setup.mjs',import.meta.url));
try{
 const bin=join(dir,'bin'),fake=join(bin,'node_modules','@openai','codex','bin');await mkdir(fake,{recursive:true});
 await writeFile(join(fake,'codex.js'),`const fs=require('node:fs');const a=process.argv.slice(2);if(a[1]!=='list'||a[2]!=='--json')throw Error('Forbidden non-read-only CLI call');const data=JSON.parse(fs.readFileSync(process.env.SPELLOUT_TEST_INVENTORY,'utf8'));console.log(JSON.stringify(a[0]==='mcp'?data.servers:{installed:[]}));`);
 const inventory=join(dir,'inventory.json');await writeFile(inventory,JSON.stringify({servers:[]}));
 const run=home=>spawnSync(process.execPath,[setup,'--check'],{encoding:'utf8',env:{...process.env,PATH:bin,HOME:home,USERPROFILE:home,CODEX_HOME:join(home,'.codex'),SPELLOUT_TEST_INVENTORY:inventory}});
 const fresh=join(dir,'fresh');await mkdir(fresh);const freshResult=run(fresh);assert.equal(freshResult.status,0,freshResult.stderr);assert.match(freshResult.stdout,/Check only/);assert.deepEqual(await readdir(fresh),[],'check cannot install or change config');
 for(const name of oldServerNames){await writeFile(inventory,JSON.stringify({servers:[{name,enabled:true,transport:{command:'node',args:['old/server.mjs']}}]}));const result=run(fresh);assert.notEqual(result.status,0,'old registration blocks installation');assert.ok((result.stdout+result.stderr).includes('codex mcp remove '+name));}
 await writeFile(inventory,JSON.stringify({servers:[]}));const oldHome=join(dir,'old'),oldSkill=join(oldHome,'.agents','skills',oldSkillDirectory);await mkdir(oldSkill,{recursive:true});await writeFile(join(oldSkill,'SKILL.md'),'keep edits');const oldResult=run(oldHome);assert.notEqual(oldResult.status,0);assert.match(oldResult.stdout+oldResult.stderr,/Remove-Item|rm -r/);assert.equal(await readFile(join(oldSkill,'SKILL.md'),'utf8'),'keep edits');
 const skillSource=fileURLToPath(new URL('../skills/spellout',import.meta.url));const installed=join(fresh,'.agents','skills','spellout');await installSkill(skillSource,installed,'0.4.0');let doctor=run(fresh);assert.match(doctor.stdout,/0\.4\.0.*0\.5\.0.*false/);await installSkill(skillSource,installed,'0.5.0');doctor=run(fresh);assert.match(doctor.stdout,/0\.5\.0.*0\.5\.0.*true/);
 console.log('Setup --check passed in isolated HOME: new install, old MCP registrations, old skill, version mismatch/match; no Codex writes');
}finally{await rm(dir,{recursive:true,force:true});}
