import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { files } from '../scripts/release-files.mjs';
// Code points keep this scanner from matching its own forbidden-token definitions.
export const forbidden = [[103,114,105,108,108,45,109,101],[103,114,105,108,108,95,109,101],[71,114,105,108,108,32,77,101],[71,82,73,76,76,95,77,69],[103,109,45],[65,115,107,65,108,105,103,110],[97,115,107,97,108,105,103,110],[38382,40784]].map(c=>String.fromCodePoint(...c));
const failures=[];
for(const path of files){
 let text=await readFile(new URL('../'+path,import.meta.url),'utf8');
 // Necessary migration identifiers are exact-line exceptions, not branding aliases.
 if(path==='server/legacy-installation.mjs'){
  const q=s=>"'"+s+"'";
  const expected=["// Only identifiers necessary to detect or copy an existing installation.",`export const oldSettingsDirectory = ${q(forbidden[0])};`,`export const oldSkillDirectory = ${q(forbidden[0])};`,`export const oldServerNames = [${q(forbidden[6])}, ${q(forbidden[0]+'-ui')}];`,`export const oldPluginIds = [${q(forbidden[0])}, ${q(forbidden[6])}];`, ''].join('\n');
  assert.equal(text.replaceAll('\r\n','\n'),expected,'migration exception is limited to these identifiers');text='';
 }
 if(path==='docs/PRIVACY.md')text=text.replace('旧设置目录：`~/.config/'+forbidden[0]+'/`。确认无需旧记录后可手动删除；迁移不会替你删除。','');
 if(path==='NOTICE.md')text=text.replace(/https:\/\/github\.com\/mattpocock\/skills[^\s)]*/g,'');
 if(path==='LICENSE')text=text.replace('Copyright (c) 2026 Matt Pocock','');
 for(const word of forbidden)if(text.toLowerCase().includes(word.toLowerCase())||path.toLowerCase().includes(word.toLowerCase()))failures.push(path+': forbidden token');
}
assert.deepEqual(failures,[],'published sources must use the new identity');
console.log(`Naming passed: ${files.length} allowlisted files`);
