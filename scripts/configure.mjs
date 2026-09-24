import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Generate machine-specific paths locally, never commit them to the repository.
const server = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
const config = { mcpServers: { 'spellout': { command: process.execPath, args: [server] } } };
await writeFile(new URL('../.mcp.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log('Generated local .mcp.json. Keep this checkout in its current location.');
const quote = process.platform === 'win32'
  ? value => "'" + value.replaceAll("'", "''") + "'"
  : value => "'" + value.replaceAll("'", "'\\''") + "'";
console.log('For a direct MCP install, run this command in ' + (process.platform === 'win32' ? 'PowerShell' : 'your shell') + ':');
console.log('codex mcp add spellout -- ' + quote(process.execPath) + ' ' + quote(server));
console.log('If SpellOut is already installed as a plugin, update that plugin instead; do not register a second server.');
