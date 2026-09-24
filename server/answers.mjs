import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { settingsPath } from './preferences.mjs';

const directory = () => process.env.SPELLOUT_ANSWERS_DIR || join(dirname(settingsPath()), 'answers');
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
  try { await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' }); await link(temp, destination); return true; }
  catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
export async function rememberDecision(decision) {
  if (!await create(decision.decisionId, 'question', decision)) throw new Error('Decision already exists');
}
function normalizeAnswers(decision, answers) {
  if (!Array.isArray(answers) || answers.length !== decision.questions.length) throw new Error('Answer count mismatch');
  const normalized = answers.map((answer, i) => {
    const q = decision.questions[i];
    if (!Array.isArray(answer.picks) || !answer.picks.length || new Set(answer.picks).size !== answer.picks.length || (!q.multiple && answer.picks.length !== 1) || answer.picks.some(p => !Number.isInteger(p) || p < 0 || p > q.options.length)) throw new Error('Invalid selected options');
    const picks = [...answer.picks].sort((a,b) => a-b);
    const custom = picks.includes(q.options.length) && typeof answer.custom === 'string' ? answer.custom.trim() : '';
    if (custom.length > 10000 || picks.includes(q.options.length) && !custom) throw new Error('Invalid custom answer');
    return { picks, custom };
  });
  return normalized;
}
function answerRecord(decision, answers, revision = 0) {
  const normalized = normalizeAnswers(decision, answers);
  return { decisionId: decision.decisionId, revision, receivedAt: new Date().toISOString(), answers: normalized, items: decision.questions.map((q,i) => ({ question: q.question, answers: normalized[i].picks.map(p => p === q.options.length ? normalized[i].custom : q.options[p].label) })) };
}
export async function saveAnswer(decisionId, answers) {
  const decision = await get(decisionId, 'question');
  if (!decision) throw new Error('Unknown decision; reopen a new card');
  const record = answerRecord(decision, answers);
  const normalized = record.answers;
  if (!await create(decisionId, 'answer', record)) {
    const previous = await get(decisionId, 'answer');
    if (previous.status === 'dismissed') throw Object.assign(new Error('This card was dismissed; use the conversation instead'), { code: 'CARD_DISMISSED' });
    if (JSON.stringify(previous.answers) !== JSON.stringify(normalized)) throw new Error('This decision already has a different answer');
    return previous;
  }
  return record;
}
export async function readAnswer(decisionId) {
  const answer = await get(decisionId, 'answer');
  if (answer) {
    if (answer.status === 'dismissed') return answer;
    let latest={revision:0,...answer};
    for(let n=1;n<=1000;n++){const next=await get(decisionId, `revision-${n}`);if(!next)break;latest=next;}
    const acknowledgement=await get(decisionId, `ack-${latest.revision}`);
    return {status:'answered',...latest,processed:acknowledgement?.revision===latest.revision,...(acknowledgement?{acknowledgement}: {})};
  }
  return { decisionId, status: await get(decisionId, 'question') ? 'pending' : 'unknown' };
}

// Answer and dismissal compete for the same immutable terminal record. The
// atomic link also protects against submissions from an older server process.
export async function dismissDecision(decisionId) {
  if (!await get(decisionId, 'question')) return { decisionId, status: 'unknown' };
  await create(decisionId, 'answer', { decisionId, status: 'dismissed', dismissedAt: new Date().toISOString(), reason: 'user_message' });
  return readAnswer(decisionId);
}

// Read the saved answer independently of the host's follow-up message queue.
// Polling also sees submissions from a different MCP server process.
export async function waitForAnswer(decisionId, waitMs = 0, signal) {
  if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 30000) throw new Error('waitMs must be an integer from 0 to 30000');
  const deadline = performance.now() + waitMs;
  for (;;) {
    signal?.throwIfAborted();
    const result = await readAnswer(decisionId);
    if (result.status !== 'pending' || performance.now() >= deadline) return result;
    await delay(Math.min(200, Math.max(0, deadline - performance.now())), undefined, { signal });
  }
}

export async function reviseAnswer(decisionId, answers, expectedRevision, requestId) {
  const current=await readAnswer(decisionId);
  if(current.status!=='answered')throw new Error('Only a saved answer can be revised');
  const decision=await get(decisionId,'question');
  const record={...answerRecord(decision,answers,expectedRevision+1),requestId};
  const previous=await get(decisionId,`revision-${expectedRevision+1}`);
  if(previous?.requestId===requestId&&JSON.stringify(previous.answers)===JSON.stringify(record.answers))return previous;
  if(current.revision!==expectedRevision||expectedRevision>=1000)throw new Error('Answer changed; reload the latest answer before editing');
  if(!await create(decisionId,`revision-${record.revision}`,record)){
    const winner=await get(decisionId,`revision-${record.revision}`);
    if(winner?.requestId===requestId&&JSON.stringify(winner.answers)===JSON.stringify(record.answers))return winner;
    throw new Error('Answer changed; reload the latest answer before editing');
  }
  return record;
}
export async function acknowledgeAnswer(decisionId, revision, nextStep) {
  const current=await readAnswer(decisionId);
  if(current.status!=='answered'||current.revision!==revision)throw new Error('Read the latest answer before acknowledging');
  const record={decisionId,revision,nextStep,receivedAt:new Date().toISOString()};
  await create(decisionId,`ack-${revision}`,record);
  return readAnswer(decisionId);
}
export {get as readRecord,create as createRecord};
