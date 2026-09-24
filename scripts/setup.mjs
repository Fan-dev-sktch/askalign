import { skillState, installSkill, installedVersion } from './skill-install.mjs';
import { oldSkillDirectory, oldServerNames, oldPluginIds } from '../server/legacy-installation.mjs';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const repositoryVersion=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
export const firstPrompt = '用 SpellOut 发一张体验卡，让我选择少问、适度确认或深入探索；按我的选择保存提问偏好，再准确复述收到的答案。';
export function supportedNode(version) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || major === 22 && minor >= 12;
}
export function findCodex() {
  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const native = join(dir, process.platform === 'win32' ? 'codex.exe' : 'codex');
    if (existsSync(native)) return [native];
    const js = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(js)) return [process.execPath, js];
  }
  throw new Error('Codex CLI not found / 未找到 Codex CLI。安装并登录 Codex CLI 后重试；不修改现有配置。');
}
export function classify(servers, plugins, serverPath, nodePath = process.execPath) {
  if (!Array.isArray(servers) || !Array.isArray(plugins?.installed)) throw new Error('Unknown Codex inventory format');
  const previous=servers.filter(s=>oldServerNames.includes(s.name));
  const oldPlugins=plugins.installed.filter(p=>oldPluginIds.includes((p.pluginId??p.name??'').split('@')[0]));
  if(previous.length||oldPlugins.length)return {state:'legacy',reason:'Old installation / 请手动移除旧安装：\n'+previous.map(s=>'codex mcp remove '+s.name).concat(oldPlugins.map(p=>'codex plugin remove '+(p.pluginId??p.name))).join('\n')};
  if (plugins.installed.some(p => /^(spellout)(@|$)/i.test(p.pluginId ?? p.name ?? ''))) return { state: 'plugin', reason: '已有插件安装，请更新原插件。' };
  const related=servers.filter(s=>/spellout/i.test(s.name??'')||(s.transport?.args??[]).some(a=>/spellout/i.test(a)||resolve(a)===resolve(serverPath)));
  if(!related.length)return {state:'new',reason:'New direct install / 可新建直接安装。'};
  const exact=related.length===1&&related[0].name==='spellout'&&related[0].enabled!==false&&related[0].transport?.command===nodePath&&related[0].transport?.args?.length===1&&resolve(related[0].transport.args[0])===resolve(serverPath);
  return exact?{state:'existing',reason:'Same checkout registered / 当前目录已注册。'}:{state:'conflict',reason:'Existing registration conflict / 已有注册冲突，未修改。'};
}
export {skillState, installSkill} from './skill-install.mjs';
export async function main(args = process.argv.slice(2)) {
  if (args.some(a => !['--check', '--yes'].includes(a))) throw new Error('Usage: npm run setup -- [--check | --yes]');
  if (!supportedNode(process.versions.node)) throw new Error('Node.js 22.12+ required / 请先安装 Node.js 22.12 或更高版本。');
  const codex = findCodex();
  const run = a => execFileSync(codex[0], [...codex.slice(1), ...a], { encoding: 'utf8', timeout: 30000, stdio: ['ignore','pipe','pipe'] });
  let servers, plugins;
  try { servers = JSON.parse(run(['mcp','list','--json'])); plugins = JSON.parse(run(['plugin','list','--json'])); }
  catch { throw new Error('Cannot inspect Codex installations / 无法读取 Codex 安装清单。请更新 CLI，或按 README 手动安装；未修改配置。'); }
  const serverPath = join(root, 'server', 'index.mjs');
  const state = classify(servers, plugins, serverPath);
  console.log('SpellOut setup / 安装向导\nNode: OK\nCodex CLI: OK\n' + state.reason);
  const previousSkill=join(homedir(),'.agents','skills',oldSkillDirectory);
  if(existsSync(previousSkill)){
    const quoted="'"+previousSkill.replaceAll("'","''")+"'";
    console.log('Back up user edits first / 先备份用户修改，再手动移除：\n'+(process.platform==='win32'?'Remove-Item -LiteralPath '+quoted+' -Recurse':"rm -r -- '"+previousSkill.replaceAll("'","'\\''")+"'"));
  }
  if(state.state==='legacy'||existsSync(previousSkill))throw new Error('Old installation detected; stopped without changing configuration or files.');
  if (['plugin','conflict'].includes(state.state)) { if (args.includes('--check')) return; throw new Error('Automatic installation stopped / 已停止自动安装，保留原安装。'); }
  const source = join(root,'skills','spellout'), target = join(homedir(),'.agents','skills','spellout');
  const skill = await skillState(source,target);
  const installed=await installedVersion(target);console.log('Installed skill / 已装技能版本: '+(installed??'unknown / 未知')+'; repository / 仓库版本: '+repositoryVersion+'; match / 一致: '+(installed===repositoryVersion));
  console.log('Skill / 技能: ' + skill + '\nDirectory / 固定目录: ' + root);
  if (skill === 'conflict') throw new Error('Existing skill differs / 已有技能包含不同内容，请先备份并手动处理；未修改配置。');
  if (args.includes('--check')) { console.log('Check only / 仅检查，未安装。'); return; }
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli)) throw new Error('Run through npm run setup / 请使用 npm run setup 启动。');
  console.log('Plan / 将执行：npm ci → 本地测试 → 注册 MCP（若缺失）→ 安装技能（若缺失）。\nExisting preferences and answers are preserved / 保留偏好和答案。');
  if (!args.includes('--yes')) {
    if (!process.stdin.isTTY) throw new Error('Interactive confirmation required; use --yes only for an intended install / 请在终端确认安装。');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answer; try { answer = await rl.question('Install? / 开始安装？ [y/N] '); } finally { rl.close(); }
    if (!/^y(es)?$/i.test(answer.trim())) { console.log('Cancelled / 已取消，未修改。'); return; }
  }
  for (const a of [['ci'],['test']]) execFileSync(process.execPath,[npmCli,...a],{cwd:root,stdio:'inherit',timeout:180000});
  // Recheck after dependency installation and user confirmation; never overwrite a new registration.
  const now = classify(JSON.parse(run(['mcp','list','--json'])),JSON.parse(run(['plugin','list','--json'])),serverPath);
  if (!['new','existing'].includes(now.state)) throw new Error('Installation changed during setup / 安装状态已变化，请重新检查。');
  if (await skillState(source,target) === 'conflict') throw new Error('Skill changed during setup / 技能已变化，未覆盖。');
  if (now.state === 'new') run(['mcp','add','spellout','--',process.execPath,serverPath]);
  const verified = classify(JSON.parse(run(['mcp','list','--json'])),JSON.parse(run(['plugin','list','--json'])),serverPath);
  if (verified.state !== 'existing') throw new Error('Registration could not be verified / 未能确认注册结果；请检查配置，不要重复添加。');
  await installSkill(source,target,repositoryVersion);
  if (await skillState(source,target) !== 'same') throw new Error('Skill verification failed');
  console.log('\nSetup verified / 注册和技能安装已核对。\n重新打开 Codex 并新建任务，粘贴下面这句 / Restart Codex, start a new task and paste:\n\n' + firstPrompt + '\n\nSuccess / 验收：看到卡片 → 点选 → 助手准确复述答案。脚本不会自动发送对话，也不能证明客户端卡片已显示。');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
