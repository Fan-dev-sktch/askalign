import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const home=await mkdtemp(join(tmpdir(),'spellout-tests-'));
const root=fileURLToPath(new URL('..',import.meta.url));
const tests=['smoke','card-ui','native-elicit','preferences','release-integrity','answer-recovery','read-status','setup','ui-resources','experience','demo','regressions','forget','migration','setup-check','naming'];
try{
 for(const name of tests){
  const result=spawnSync(process.execPath,[...(name==='regressions'?['--test']:[]),`test/${name}.mjs`],{cwd:root,stdio:'inherit',env:{...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:join(home,'.codex'),SPELLOUT_SETTINGS_PATH:join(home,'.config','spellout','preferences.json'),SPELLOUT_ANSWERS_DIR:join(home,'answers'),SPELLOUT_UI_RESOURCES_DIR:join(home,'ui-resources')}});
  if(result.status!==0){process.exitCode=result.status??1;break;}
 }
}finally{
 const parent=resolve(tmpdir())+sep;if(!resolve(home).startsWith(parent))throw new Error('Unsafe test directory');
 await rm(home,{recursive:true,force:true});
}
