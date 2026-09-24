import { readFile, mkdir, writeFile, rename, copyFile, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { oldSettingsDirectory } from './legacy-installation.mjs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod/v3';

export const preferenceSchema = z.object({
  intensity: z.enum(['minimal', 'balanced', 'deep']).default('balanced'),
  coverage: z.enum(['focused', 'broad']).optional(),
  depth: z.enum(['decision', 'motivation']).optional(),
  frequency: z.enum(['blocking', 'milestones', 'discovery']).optional(),
  diversity: z.enum(['direct', 'varied', 'exploratory']).optional(),
  challenge: z.enum(['accept', 'probe', 'challenge']).optional(),
  questionsPerRound: z.number().int().min(1).max(5).optional(),
}).strict();
export const settingsPath = () => process.env.SPELLOUT_SETTINGS_PATH || join(homedir(), '.config', 'spellout', 'preferences.json');
// Apply the new default only to new installations, not to existing saved files.
export const newUserPreferences = Object.freeze({ intensity: 'deep' });
export function onboardingFor(configured) {
  if (configured) return { required: false };
  return {
    required: true,
    question: '以后你希望我怎样确认需求？这会保存为后续对话的默认方式，随时可以再改。',
    presets: [
      { label: '深入探索', description: '推荐：主动发现重要取舍，探索动机和不同场景；每轮最多三题。', preferences: { intensity: 'deep' } },
      { label: '适度确认', description: '在任务开始和关键节点集中提问，主要确认当前目标与取舍。', preferences: { intensity: 'balanced' } },
      { label: '只问关键问题', description: '只问阻塞执行的问题，其余说明默认假设后继续；每轮最多一题。', preferences: { intensity: 'minimal' } },
    ],
  };
}
export async function migratePreferences() {
  if(process.env.SPELLOUT_SETTINGS_PATH)return;
  const destination=settingsPath(),source=join(homedir(),'.config',oldSettingsDirectory,'preferences.json');
  try{await lstat(destination);return;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{const stat=await lstat(source);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Preference migration requires a regular file');}catch(error){if(error.code==='ENOENT')return;throw error;}
  await mkdir(dirname(destination),{recursive:true});
  try{await copyFile(source,destination,constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST')throw error;}
}
export async function readPreferenceState() {
  await migratePreferences();
  try { return { preferences: preferenceSchema.parse(JSON.parse(await readFile(settingsPath(), 'utf8'))), configured: true }; }
  catch (error) { if (error.code === 'ENOENT') return { preferences: preferenceSchema.parse(newUserPreferences), configured: false }; throw new Error('SpellOut preferences are invalid or unreadable; repair the file or reset preferences.'); }
}
export async function readPreferences() {
  return (await readPreferenceState()).preferences;
}
export async function savePreferences(input) {
  const value = preferenceSchema.parse(input), file = settingsPath();
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, file);
  return value;
}
export function policyFor(input) {
  const p = preferenceSchema.parse(input);
  const presets = {
    minimal: { coverage: 'focused', depth: 'decision', frequency: 'blocking', diversity: 'direct', challenge: 'accept', questionsPerRound: 1 },
    balanced: { coverage: 'focused', depth: 'decision', frequency: 'milestones', diversity: 'varied', challenge: 'probe', questionsPerRound: 3 },
    deep: { coverage: 'broad', depth: 'motivation', frequency: 'discovery', diversity: 'exploratory', challenge: 'challenge', questionsPerRound: 3 },
  };
  const effective = { ...presets[p.intensity], ...p };
  const instructions = [
    effective.coverage === 'broad' ? 'Explore goals, users, scenarios, constraints, alternatives and success criteria when relevant.' : 'Focus on the current task and decisions that change its outcome.',
    effective.depth === 'motivation' ? 'Ask why a preference matters, probe trade-offs and latent needs; let each answer guide the next question.' : 'Stop probing once enough information exists to make the decision.',
    effective.frequency === 'blocking' ? 'Ask only when a material missing fact blocks safe progress; otherwise proceed with stated assumptions.' : effective.frequency === 'milestones' ? 'Batch independent questions at task start or milestones; avoid interrupting each implementation step.' : 'Ask follow-ups when new meaningful uncertainties emerge; do independent work while awaiting answers.',
    `Ask at most ${effective.questionsPerRound} questions per round. Never repeat known answers or stack pending cards.`,
    effective.diversity === 'direct' ? 'Use direct concrete questions; avoid unnecessary scenario variations.' : effective.diversity === 'varied' ? 'Vary direct questions with examples, comparisons and trade-offs when useful.' : 'Explore overlooked alternatives with examples, counterexamples and changed conditions; avoid repeating the same question in different words.',
    effective.challenge === 'accept' ? 'Respect stated preferences; clarify contradictions and material risks without optional challenges.' : effective.challenge === 'probe' ? 'Gently check important assumptions and explain why an alternative may matter.' : 'Actively test consequential assumptions against the user goal and discuss trade-offs. Offer reasons, not adversarial interrogation; do not override an explicit user choice.',
    effective.frequency === 'blocking' ? 'For non-blocking choices, proceed with stated default assumptions without issuing a card. Ask a card only for a material blocker.' : 'For an unresolved choice of name, style, feature direction, priority or approach that changes the deliverable, give 2-3 concrete alternatives and call spellout_ask in the same turn, including when the user asks which style to choose or which option you recommend. Briefly explain your recommendation before the card; your recommendation is not user confirmation. Before finishing such advice, verify that the card was actually called. Respect an explicit choice, delegation to decide and implement, or a request for advice without questions; do not create choices for factual explanations or force compatible goals into single choice.',
    'For questions warranted by the current intensity, use multiple: true when needs, difficulties, scenarios or features can coexist, and label the question as multi-select. Use single choice only for mutually exclusive decisions or an explicitly needed single priority. Do not invent a priority question to force compatible needs into one answer. Collect compatible needs first; ask priority separately only when a real constraint requires it. An unchecked option is not a rejection or a permanent exclusion.',
    'If the user reports a missed card, verify the call history. When the original decision is still unresolved and no matching card is pending, briefly acknowledge the omission and call the card in the same turn. Explanation alone is not recovery. A failed or unavailable tool requires an honest text fallback.',
    'Before asking, extract stated goals, scenarios, constraints and previous decisions from the current task; distinguish user statements from assumptions. Investigate discoverable facts yourself.',
    'Ask only when different answers change a concrete outcome or next action. Briefly state that impact in the question and describe practical trade-offs in the options.',
    'For consequential ambiguity, test one plausible scenario grounded in the user task: actor, situation, action and expected outcome. Label invented details as assumptions. Offer reasonable alternative outcomes with trade-offs, not a recommended yes to your own interpretation; allow the scenario to be rejected or left uncertain.',
    'If needed, vary one relevant condition to check a boundary. Convert the answer into an observable acceptance condition and revise contradicted assumptions. Do not generalize a scenario choice into a global preference. Reuse known answers instead of asking again; a passed scenario is not confirmation of all requirements or permission to implement.',
    'After an answer, state its practical implication and act on it. Ask dependent follow-ups one at a time, guided by that answer; clarify only the conflicting point if it contradicts an earlier decision.',
    'For vague answers, use a concrete scenario or trade-off instead of repeated abstract why questions. Stop when goals, key constraints and acceptance criteria are sufficient, including in deep mode. Never persist inferred preferences without explicit user choice.',
    'If the user explicitly requests multiple rounds to discover their real needs before action, enter a task-only requirements interview. This overrides the default proceed-when-sufficient and independent-work rules above, regardless of intensity. A request to add this capability is not itself a request to start an interview.',
    'In interview mode, there is no fixed total round limit; keep each round short and let answers guide the next round. Explore relevant scenarios, motivations, priorities, constraints, unacceptable outcomes and acceptance criteria without repeating known answers or guessing psychological motives.',
    'During the interview, only read and analyze material needed to clarify requirements; do not implement or produce deliverables yet. Ordinary card answers mean continue the interview, not permission to start implementation.',
    'When understanding is sufficient, summarize the requirements and remaining assumptions and explicitly ask whether to start or continue clarifying. Implement only after the user confirms that summary or explicitly asks to start. If they only say stop asking, stop questions without treating that as permission to implement.',
    'Outside interview mode, if the user says start working or stop asking, proceed with available information. No clarification mode grants permission for external or destructive actions.',
  ];
  return { ...effective, instructions };
}
