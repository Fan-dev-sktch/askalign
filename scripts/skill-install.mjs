import { readFile, readdir, lstat, mkdir, writeFile, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
const marker='.spellout-install.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fileMap(dir,prefix=''){
 const result=new Map();
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())throw new Error('Skill symlink conflict');
  const name=prefix+e.name,path=join(dir,e.name);
  if(e.isDirectory())for(const [k,v] of await fileMap(path,name+'/'))result.set(k,v);
  else if(e.isFile())result.set(name,await readFile(path));else throw new Error('Unsupported skill entry');
 }return result;
}
async function inventory(target){
 try{const stat=await lstat(target);if(!stat.isDirectory()||stat.isSymbolicLink())return null;return await fileMap(target);}
 catch(e){if(e.code==='ENOENT')return undefined;return null;}
}
export async function installedVersion(target){try{return JSON.parse(await readFile(join(target,marker),'utf8')).version??null;}catch{return null;}}
function recorded(files){
 try{const record=JSON.parse(files.get(marker));const actual=[...files].filter(([k])=>k!==marker);
  return typeof record.version==='string'&&record.files&&actual.length===Object.keys(record.files).length&&actual.every(([k,v])=>record.files[k]===hash(v))?record:null;
 }catch{return null;}
}
export async function skillState(source,target){
 const b=await inventory(target);if(b===undefined)return 'missing';if(!b)return 'conflict';
 const a=await fileMap(source);a.delete(marker);const userFiles=new Map(b);userFiles.delete(marker);
 if(b.has(marker)&&!recorded(b))return 'conflict';
 if(a.size===userFiles.size&&[...a].every(([k,v])=>userFiles.get(k)?.equals(v)))return 'same';
 return recorded(b)?'upgrade':'conflict';
}
export async function installSkill(source,target,version='0.5.0'){
 const state=await skillState(source,target);if(state==='conflict')throw new Error('Existing skill differs / 技能冲突，未覆盖。');
 const files=await fileMap(source);files.delete(marker);
 const previous=state!=='missing'?await inventory(target):null;
 if(state==='same'&&await installedVersion(target)===version)return;
 if(state==='upgrade'||state==='same'&&previous?.has(marker)){
  const record=recorded(previous);if(!record)throw new Error('Skill conflict');
  const backup=target+'.backup-'+record.version.replace(/[^a-zA-Z0-9.-]/g,'_')+'-'+randomUUID();await mkdir(backup);
  for(const [name,bytes] of previous){const path=join(backup,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
  const verified=await inventory(backup);if(!verified||verified.size!==previous.size||![...previous].every(([k,v])=>verified.get(k)?.equals(v)))throw new Error('Skill backup verification failed');
  const current=await inventory(target);if(!current||current.size!==previous.size||![...previous].every(([k,v])=>current.get(k)?.equals(v)))throw new Error('Skill conflict after backup');
 }
 await mkdir(dirname(target),{recursive:true});if(state==='missing')await mkdir(target);
 for(const [name,bytes] of files){const path=join(target,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:state==='missing'?'wx':'w'});}
 for(const name of previous?.keys()??[])if(name!==marker&&!files.has(name))await unlink(join(target,name));
 await writeFile(join(target,marker),JSON.stringify({version,files:Object.fromEntries([...files].map(([k,v])=>[k,hash(v)]))},null,2)+'\n');
}
