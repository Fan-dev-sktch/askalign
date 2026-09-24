import { readdir, lstat, readFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingsPath } from '../server/preferences.mjs';
export async function forget(args=process.argv.slice(2)){
 let days=30,explicitAge=false,yes=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--yes')yes=true;
  else if(args[i]==='--older-than'&&/^[1-9][0-9]*d$/.test(args[i+1]??'')){days=Number(args[++i].slice(0,-1));explicitAge=true;}
  else throw new Error('Usage: npm run forget -- [--older-than 30d] [--yes]');
 }
 if(yes&&!explicitAge)throw new Error('Deletion requires --older-than 30d --yes');
 const dir=resolve(process.env.SPELLOUT_ANSWERS_DIR||join(dirname(settingsPath()),'answers'));
 let entries;try{if((await lstat(dir)).isSymbolicLink())throw new Error('Refuse symlink answers directory');entries=await readdir(dir);}catch(e){if(e.code==='ENOENT'){console.log('No answer records.');return;}throw e;}
 const records=[],groups=new Map(),cutoff=Date.now()-days*86400000;
 const pattern=/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(question|answer|seen|waiter|heartbeat|revision-\d+|ack-\d+|context-\d+)\.json$/i;
 for(const name of entries){const match=pattern.exec(name);if(!match)continue;const path=join(dir,name);if(resolve(path)===resolve(settingsPath()))continue;const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink())continue;const record={id:match[1],kind:match[2],name,path,mtime:stat.mtimeMs,size:stat.size};records.push(record);groups.set(record.id,Math.max(groups.get(record.id)??0,record.mtime));}
 const retainedContexts=new Set();
 for(const r of records)if(r.kind==='question'&&groups.get(r.id)>=cutoff){try{const q=JSON.parse(await readFile(r.path,'utf8'));if(q.contextId)retainedContexts.add(q.contextId);}catch{throw new Error('Unreadable retained question; cleanup stopped');}}
 const candidates=records.filter(r=>groups.get(r.id)<cutoff&&!retainedContexts.has(r.id));
 console.log((yes?'Delete / 删除':'Preview only / 仅预览')+` (${days}d):\n`+candidates.map(r=>r.name).join('\n'));
 if(yes){
  // Recheck all candidate groups before deleting; new files or recent changes abort the operation.
  const now=await readdir(dir);for(const name of now){const match=pattern.exec(name);if(!match||!candidates.some(r=>r.id===match[1]))continue;const original=candidates.find(r=>r.name===name),stat=await lstat(join(dir,name));if(!original||!stat.isFile()||stat.isSymbolicLink()||stat.mtimeMs!==original.mtime||stat.size!==original.size)throw new Error('Records changed; cleanup stopped');}
  for(const r of candidates)await unlink(r.path);
 }
 return candidates.map(r=>r.name);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))forget().catch(e=>{console.error(e.message);process.exitCode=1;});
