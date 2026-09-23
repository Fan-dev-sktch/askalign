import { cp, mkdir, mkdtemp, readFile, writeFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyRelease } from './verify-release.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const stage = await mkdtemp(join(tmpdir(), 'grill-release-'));
const files = ['package.json','package-lock.json','LICENSE','README.md','README.zh-CN.md','.gitignore','.gitattributes','docs/test-workflow.yml','docs/PRIVACY.md','docs/RELEASE.md','docs/SETTINGS.md','skills/grill-me/SKILL.md','skills/grill-me/agents/openai.yaml','scripts/configure.mjs','scripts/release.mjs','test/smoke.mjs','test/card-ui.mjs','test/native-elicit.mjs','test/preferences.mjs','.codex-plugin/plugin.json','server/index.mjs','server/preferences.mjs','server/decision-v8.html'];
files.push('NOTICE.md', 'docs/AUTHENTICITY.md', 'scripts/verify-release.mjs', 'test/release-integrity.mjs');
files.push('scripts/setup.mjs', 'test/setup.mjs');
files.push('server/answers.mjs', 'test/answer-recovery.mjs', 'docs/demo.html', '.nojekyll');
for (const file of files) {
  if (!(await lstat(join(root, file))).isFile()) throw new Error(`Release input must be a regular file: ${file}`);
  const text = await readFile(join(root, file), 'utf8');
  // Conservative checks for common leaks; never print matched secret values.
  if (/(?:[A-Z]:[\\/]+Users[\\/]+[^\s\\/]+|\/(?:home|Users)\/[^\s/]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,})/i.test(text)) throw new Error(`Possible private path or credential in ${file}; review before packaging`);
  await mkdir(join(stage, file, '..'), { recursive: true });
  await cp(join(root, file), join(stage, file));
}
const manifest = JSON.parse(await readFile(join(stage, '.codex-plugin/plugin.json'), 'utf8'));
manifest.version = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8')).version;
await writeFile(join(stage, '.codex-plugin/plugin.json'), JSON.stringify(manifest,null,2)+'\n');
const packageInfo = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
const provenance = { schemaVersion: 1, name: packageInfo.name, version: packageInfo.version, maintainer: manifest.author.name, builtAt: new Date().toISOString(), files: [] };
for (const path of [...files].sort()) provenance.files.push({ path, sha256: createHash('sha256').update(await readFile(join(stage, path))).digest('hex') });
await writeFile(join(stage, 'RELEASE-PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
await verifyRelease(stage);
await mkdir(join(root,'dist'), { recursive: true });
const output = join(root,'dist','askalign-source.tgz');
execFileSync('tar', ['-czf', output, '-C', stage, '.']);
const checksum = createHash('sha256').update(await readFile(output)).digest('hex');
await writeFile(join(root, 'dist', 'SHA256SUMS'), `${checksum}  askalign-source.tgz\n`);
console.log(JSON.stringify({ output, stage, checksum }));
