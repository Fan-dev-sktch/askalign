import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { settingsPath } from './preferences.mjs';

const directory = () => process.env.ASKALIGN_ANSWERS_DIR || join(dirname(settingsPath()), 'answers');
function file(id, kind) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error('Invalid decision ID');
  return join(directory(), `${id}.${kind}.json`);
}
async function get(id, kind) {
  try { return JSON.parse(await readFile(file(id, kind), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function create(id, kind, value) {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const destination = file(id, kind), temp = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  try { await link(temp, destination); return true; }
  catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  finally { await unlink(temp); }
}
export async function rememberDecision(decision) {
  if (!await create(decision.decisionId, 'question', decision)) throw new Error('Decision already exists');
}
export async function saveAnswer(decisionId, answers) {
  const decision = await get(decisionId, 'question');
  if (!decision) throw new Error('Unknown decision; reopen a new card');
  if (!Array.isArray(answers) || answers.length !== decision.questions.length) throw new Error('Answer count mismatch');
  const normalized = answers.map((answer, i) => {
    const q = decision.questions[i];
    if (!Array.isArray(answer.picks) || !answer.picks.length || new Set(answer.picks).size !== answer.picks.length || (!q.multiple && answer.picks.length !== 1) || answer.picks.some(p => !Number.isInteger(p) || p < 0 || p > q.options.length)) throw new Error('Invalid selected options');
    const picks = [...answer.picks].sort((a,b) => a-b);
    const custom = picks.includes(q.options.length) && typeof answer.custom === 'string' ? answer.custom.trim() : '';
    if (custom.length > 10000 || picks.includes(q.options.length) && !custom) throw new Error('Invalid custom answer');
    return { picks, custom };
  });
  const record = { decisionId, receivedAt: new Date().toISOString(), answers: normalized, items: decision.questions.map((q,i) => ({ question: q.question, answers: normalized[i].picks.map(p => p === q.options.length ? normalized[i].custom : q.options[p].label) })) };
  if (!await create(decisionId, 'answer', record)) {
    const previous = await get(decisionId, 'answer');
    if (JSON.stringify(previous.answers) !== JSON.stringify(normalized)) throw new Error('This decision already has a different answer');
    return previous;
  }
  return record;
}
export async function readAnswer(decisionId) {
  const answer = await get(decisionId, 'answer');
  if (answer) return { status: 'answered', ...answer };
  return { decisionId, status: await get(decisionId, 'question') ? 'pending' : 'unknown' };
}
