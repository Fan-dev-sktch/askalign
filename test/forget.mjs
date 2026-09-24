import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'spellout-forget-'));
const cli=fileURLToPath(new URL('../scripts/forget.mjs',import.meta.url));
const run=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,SPELLOUT_ANSWERS_DIR:dir,SPELLOUT_SETTINGS_PATH:join(dir,'preferences.json')}});
try{
 const id=randomUUID(),fresh=randomUUID(),context=randomUUID();
 const oldDate=new Date(Date.now()-40*86400000);
 const old=async(name,value={})=>{await writeFile(join(dir,name),JSON.stringify(value));await utimes(join(dir,name),oldDate,oldDate);};
 await old(`${id}.question.json`);await old(`${id}.answer.json`);await old('preferences.json',{intensity:'deep'});await old('unrelated.json');
 await old(`${context}.context-0.json`);await writeFile(join(dir,`${fresh}.question.json`),JSON.stringify({contextId:context}));
 const preview=run([]);assert.equal(preview.status,0,preview.stderr);assert.match(preview.stdout,new RegExp(id));await readFile(join(dir,`${id}.answer.json`));
 assert.notEqual(run(['--yes']).status,0,'explicit age cutoff required');
 const deleted=run(['--older-than','30d','--yes']);assert.equal(deleted.status,0,deleted.stderr);
 await assert.rejects(readFile(join(dir,`${id}.answer.json`)),{code:'ENOENT'});
 for(const file of ['preferences.json','unrelated.json',`${fresh}.question.json`,`${context}.context-0.json`])await readFile(join(dir,file));
 assert.equal(run(['--older-than','oops','--yes']).status,1);
 console.log('Forget passed: preview, explicit age/delete gate, old records, recent references and preferences preserved');
}finally{await rm(dir,{recursive:true,force:true});}
