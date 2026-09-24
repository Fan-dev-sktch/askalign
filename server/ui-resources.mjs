import { readFile, mkdir, writeFile, link, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { settingsPath } from './preferences.mjs';

export const revisionOf = html => createHash('sha256').update(html).digest('hex').slice(0, 16);
const cacheDir = () => process.env.SPELLOUT_UI_RESOURCES_DIR || join(dirname(settingsPath()), 'ui-resources');
const filename = revision => `card-${revision}.html`;

export async function createUiResources(html) {
  const revision = revisionOf(html);
  await mkdir(cacheDir(), { recursive: true, mode: 0o700 });
  const destination = join(cacheDir(), filename(revision));
  const temp = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temp, html, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try { await link(temp, destination); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  finally { await unlink(temp); }
  return {
    uri: `ui://spellout/${filename(revision)}`,
    async read(uri) {
      const match = /^ui:\/\/spellout\/card-([a-f0-9]{16})\.html$/.exec(String(uri));
      if (!match) throw new Error('Invalid card resource URI');
      const requested = match[1];
      if (requested === revision) return html;
      for (const path of [join(cacheDir(), filename(requested))]) {
        let snapshot;
        try { snapshot = await readFile(path, 'utf8'); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        if (revisionOf(snapshot) !== requested) throw new Error('Card resource integrity check failed');
        return snapshot;
      }
      throw new Error('Unknown card resource revision');
    },
  };
}
