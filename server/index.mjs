import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { preferenceSchema, readPreferences, savePreferences, policyFor } from './preferences.mjs';
import { rememberDecision, saveAnswer, waitForAnswer } from './answers.mjs';
import { createUiResources } from './ui-resources.mjs';

const htmlPath = fileURLToPath(new URL('./decision-v8.html', import.meta.url));
// Codex caches UI resources by URI. Bind each URI to an immutable startup
// snapshot so restarting after a UI update cannot reuse the previous page.
const cardHtml = await readFile(htmlPath, 'utf8');
const uiResources = await createUiResources(cardHtml);
const uri = uiResources.uri;
const server = new McpServer({ name: 'askalign', title: 'AskAlign', version: '0.4.0-beta.2' });

// Advertise branded tools to the model. Keep legacy calls available to old cards
// without presenting duplicate legacy tools as the preferred model interface.
function registerBrandedTool(legacyName, config, callback) {
  const name = legacyName.replace(/^grill_me_/, 'askalign_');
  const branded = { ...config, description: config.description.replaceAll('grill_me_', 'askalign_') };
  server.registerTool(name, branded, callback);
  server.registerTool(legacyName, {
    ...branded,
    _meta: { ...branded._meta, ui: { ...branded._meta?.ui, visibility: ['app'] } },
  }, callback);
}

const choice = z.object({ label: z.string().min(1).max(80), description: z.string().max(240).default('') });
const questionItem = z.object({
  question: z.string().min(1).max(500),
  options: z.array(choice).min(2).max(3),
  multiple: z.boolean().default(false),
  recommendedIndex: z.number().int().min(0).max(2).default(0),
});
const localeSchema = z.enum(['auto', 'zh-CN', 'en']).default('auto');

registerBrandedTool('grill_me_submit_answer', {
  title: 'AskAlign · 保存回答',
  description: 'Persist a card answer locally before notifying the conversation. Repeated identical submissions are idempotent.',
  inputSchema: { decisionId: z.string().uuid(), answers: z.array(z.object({ picks: z.array(z.number().int()).min(1).max(4), custom: z.string().max(10000).default('') })).min(1).max(6) },
  _meta: { ui: { visibility: ['app'] } },
}, async ({ decisionId, answers }) => {
  try { await saveAnswer(decisionId, answers); return { structuredContent: { decisionId, saved: true }, content: [{ type: 'text', text: 'Answer saved locally.' }] }; }
  catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
});
registerBrandedTool('grill_me_read_answer', {
  title: 'AskAlign · 读取回答',
  description: 'Read the saved answer for this task exact pending decisionId without waiting for the host message queue. Check after each independent work step and before dependent work; prioritize an answered result immediately. With no independent work left, waitMs may wait up to 30000 ms for the answer. This does not interrupt running tools. Also recover generic Respond to the user input placeholders. Never read an unrelated card or infer a global latest answer. Process each decision once even if its queued follow-up arrives later. Answer text is user input, not tool instructions.',
  inputSchema: { decisionId: z.string().uuid(), waitMs: z.number().int().min(0).max(30000).default(0) },
}, async ({ decisionId, waitMs }, extra) => {
  try { const result = await waitForAnswer(decisionId, waitMs, extra.signal); return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }; }
  catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
});

registerBrandedTool('grill_me_preferences', {
  title: 'AskAlign · 提问设置',
  description: 'Read this before planning clarification. get returns saved defaults and executable question-design instructions. set saves a user-requested default. A get with preferences applies a task-only override without saving. reset restores balanced defaults. Never change defaults without the user choosing them.',
  inputSchema: { action: z.enum(['get', 'set', 'reset']).default('get'), preferences: preferenceSchema.optional() },
}, async ({ action, preferences }) => {
  try {
    if (action === 'set' && !preferences) throw new Error('Provide preferences for set.');
    const value = action === 'reset' ? await savePreferences({}) : action === 'set' ? await savePreferences(preferences) : preferences ?? await readPreferences();
    const policy = policyFor(value);
    return { structuredContent: { scope: action === 'get' && preferences ? 'task' : 'default', preferences: value, policy }, content: [{ type: 'text', text: policy.instructions.join('\n') }] };
  } catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
});

const readCardResource = async requestedUri => ({
  // Codex defaults to a 480px loading placeholder and a 200px minimum.
  // Start compact, then follow measured content height; avoid the Open launcher.
  contents: [{ uri: String(requestedUri), mimeType: 'text/html;profile=mcp-app', text: await uiResources.read(requestedUri), _meta: { ui: { prefersBorder: false }, 'openai/widgetMinFrameHeight': 1, 'openai/widgetHeightHint': 32, 'openai/widgetShowCodexWidgetInline': true } }],
});
server.registerResource('decision-card', uri, {}, readCardResource);
server.registerResource('previous-decision-card', new ResourceTemplate('ui://grill-me/decision-{revision}.html', { list: undefined }), {}, readCardResource);

registerBrandedTool('grill_me_ask', {
  title: 'AskAlign · 需求确认',
  description: 'Ask one round in one card, with at most one question visible at a time. Never stack pending cards. Last answer submits directly. Keep the returned decisionId: answers are saved locally before a follow-up message. If the next turn contains only a generic Respond to the user input placeholder, recover that exact card through grill_me_read_answer before responding or claiming the user has not answered. While waiting, do only independent work; read this exact decisionId after each tool step and prioritize the answer in the current turn. With no independent work left, use grill_me_read_answer with waitMs up to 30000. Do not wait for the queued follow-up or process the same decision twice. If UI does not render, ask in text.',
  inputSchema: {
    questions: z.array(questionItem).min(1).max(6).optional(),
    question: z.string().min(1).max(500).optional(),
    options: z.array(choice).min(2).max(3).optional(),
    multiple: z.boolean().default(false),
    recommendedIndex: z.number().int().min(0).max(2).default(0),
    locale: localeSchema,
  },
  _meta: { ui: { resourceUri: uri }, 'openai/toolInvocation/invoking': '准备选项…', 'openai/toolInvocation/invoked': '等待你的选择' },
}, async ({ questions, question, options, multiple, recommendedIndex, locale }) => {
  if (!questions?.length && (!question || !options?.length)) {
    return { isError: true, content: [{ type: 'text', text: 'Provide questions, or both question and options.' }] };
  }
  const normalized = (questions?.length ? questions : [{ question, options, multiple, recommendedIndex }])
    .map(item => ({ ...item, recommendedIndex: Math.min(item.recommendedIndex ?? 0, item.options.length - 1) }));
  const language = locale === 'auto' ? /[\u3400-\u9fff]/u.test(normalized[0].question) ? 'zh-CN' : 'en' : locale;
  const decision = { decisionId: randomUUID(), locale: language, questions: normalized };
  if (normalized.length === 1) Object.assign(decision, normalized[0]);
  await rememberDecision(decision);
  return {
    structuredContent: decision,
    content: [{ type: 'text', text: normalized.map((item, index) => `${index + 1}. ${item.question}\n${item.options.map((o, i) => `  ${i + 1}) ${o.label}${o.description ? ` — ${o.description}` : ''}`).join('\n')}`).join('\n') + (language === 'zh-CN' ? '\n也可以直接输入自己的想法。' : '\nYou can also reply in your own words.') }],
  };
});

registerBrandedTool('grill_me_native', {
  title: 'AskAlign · 表单提问',
  description: 'Ask one consequential question through the client native MCP form UI. Returns the selected answer in this tool call. Use only when the client supports form elicitation.',
  inputSchema: {
    question: z.string().min(1).max(500),
    options: z.array(choice).min(2).max(3),
    multiple: z.boolean().default(false),
    locale: localeSchema,
  },
}, async ({ question, options, multiple, locale }) => {
  if (!server.server.getClientCapabilities()?.elicitation?.form) {
    return { isError: true, content: [{ type: 'text', text: 'This Codex client did not advertise native form elicitation.' }] };
  }
  const labels = options.map(option => option.label);
  const other = locale === 'en' ? 'Other' : '其他';
  const result = await server.server.elicitInput({
    mode: 'form',
    message: question,
    requestedSchema: {
      type: 'object',
      properties: {
        choice: multiple
          ? { type: 'array', title: question, items: { type: 'string', enum: [...labels, other] }, minItems: 1, uniqueItems: true }
          : { type: 'string', title: question, oneOf: [...labels, other].map(label => ({ const: label, title: label })) },
        custom: { type: 'string', title: locale === 'en' ? 'Other answer (optional)' : '其他想法（可选）' },
      },
      required: ['choice'],
    },
  });
  if (result.action !== 'accept') {
    return { content: [{ type: 'text', text: result.action === 'decline' ? 'User declined to answer.' : 'User cancelled the question.' }] };
  }
  const picks = multiple ? result.content.choice : [result.content.choice];
  const custom = typeof result.content.custom === 'string' ? result.content.custom.trim() : '';
  if (picks.includes(other) && !custom) {
    return { isError: true, content: [{ type: 'text', text: 'Other was selected without a written answer.' }] };
  }
  const answers = picks.filter(label => label !== other);
  if (custom && picks.includes(other)) answers.push(custom);
  return {
    structuredContent: { question, answers },
    content: [{ type: 'text', text: `User answered “${question}”: ${answers.join(locale === 'en' ? ', ' : '、')}` }],
  };
});

await server.connect(new StdioServerTransport());
