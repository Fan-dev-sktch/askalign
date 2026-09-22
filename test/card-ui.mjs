import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

const html = await readFile(new URL('../server/decision-v8.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
assert.match(script, /html\.style\.height='max-content'/, 'measure content height the same way as the MCP Apps reference implementation');
assert.match(script, /params:\{width,height\}/, 'notify the host with both dimensions');
assert.match(script, /resizeObserver\.observe\(document\.documentElement\).*resizeObserver\.observe\(document\.body\)/, 'observe document changes, not only the card');

function card(data, overrides = {}) {
  // Evaluate only this repository's checked-in UI, never downloaded/user HTML.
  const window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  if (overrides.fastTimers) {
    const original = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => original(callback, delay === 15000 ? 0 : delay, ...args);
  }
  window.requestAnimationFrame = callback => window.setTimeout(() => callback(Date.now()), 0);
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.document.documentElement.getBoundingClientRect = () => ({ height: 240 });
  const sent = [];
  const savedAnswers = [];
  const notifications = [];
  window.openai = {
    toolOutput: { structuredContent: data },
    setWidgetState(state) { this.widgetState = state; },
    async sendFollowUpMessage(message) { sent.push(message); },
    ...overrides.host,
  };
  let parent;
  if (overrides.standardBridge) delete window.openai;
  parent = { postMessage(message) {
    if (message.id === undefined) {
      notifications.push(message);
      return;
    }
    if (message.method === 'ui/message') {
      sent.push(message.params);
      if (overrides.bridgeTimeout) return;
    }
    if (message.method === 'tools/call') {
      savedAnswers.push(message.params.arguments);
      if (overrides.saveTimeout) return;
    }
    window.dispatchEvent(new window.MessageEvent('message', {
      source: parent, data: { jsonrpc: '2.0', id: message.id, result: message.method === 'ui/message' ? (overrides.bridgeResult ?? {}) : message.method === 'tools/call' ? (overrides.saveResult ?? {structuredContent:{saved:true,decisionId:message.params.arguments.decisionId}}) : {hostContext:overrides.hostContext} },
    }));
  } };
  Object.defineProperty(window, 'parent', { value: parent });
  window.eval(script);
  if (overrides.standardBridge) window.dispatchEvent(new window.MessageEvent('message', {
    source: parent, data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: data } },
  }));
  const doc = window.document;
  const input = value => doc.querySelector(`#options input[value="${value}"]`);
  return { window, doc, sent, savedAnswers, notifications, input, click: value => input(value).click(), next: () => doc.getElementById('next').click(), back: () => doc.getElementById('back').click() };
}

const questions = [
  { question: '先做哪部分？', options: [{ label: '界面' }, { label: '玩法' }], recommendedIndex: 0 },
  { question: '同时检查哪些？', options: [{ label: '操作' }, { label: '音效' }], multiple: true },
];
const themed = card({ decisionId: 'theme', questions }, {hostContext:{theme:'dark',styles:{variables:{'--font-sans':'Arial','--font-text-md-size':'18px','--color-text-primary':'#eeeeee'}}}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(themed.doc.documentElement.style.getPropertyValue('--font-text-md-size'),'18px','initial host typography is applied');
assert.equal(themed.doc.documentElement.dataset.theme,'dark');
themed.click(0);
themed.window.dispatchEvent(new themed.window.MessageEvent('message',{source:themed.window.parent,data:{jsonrpc:'2.0',method:'ui/notifications/host-context-changed',params:{theme:'light',styles:{variables:{'--font-text-md-size':'15px','--color-text-primary':'#222222'},css:{fonts:'/* host font sheet */'}}}}}));
assert.equal(themed.doc.documentElement.style.getPropertyValue('--font-text-md-size'),'15px');
assert.equal(themed.doc.documentElement.dataset.theme,'light');
assert.equal(themed.doc.getElementById('host-fonts').textContent,'/* host font sheet */');
assert.equal(themed.doc.getElementById('question').textContent,questions[1].question,'theme changes preserve question progress');
assert.equal(themed.sent.length,0,'theme changes never submit');
const c = card({ decisionId: 'decision-1', locale: 'zh-CN', questions });
await new Promise(resolve => setTimeout(resolve, 25));
const sizeNotification = c.notifications.find(message => message.method === 'ui/notifications/size-changed');
assert.ok(sizeNotification, 'card reports its size to the host on initialization');
assert.ok(Number.isFinite(sizeNotification.params.width) && sizeNotification.params.width > 0, 'size report includes width');
assert.ok(Number.isFinite(sizeNotification.params.height) && sizeNotification.params.height > 0, 'size report includes height');
assert.equal(c.doc.getElementById('question').textContent, '先做哪部分？');
assert.equal(c.doc.querySelectorAll('.card').length, 1, 'one card holds the whole sequence');
assert.equal(c.doc.querySelectorAll('.steps,.review-row').length, 0, 'sequential UI has no tabs or review');
assert.equal(c.doc.getElementById('back').hidden, true, 'first page has no redundant Back button');
c.click(0);
assert.equal(c.doc.getElementById('question').textContent, '同时检查哪些？', 'single choice advances immediately in the same card');
assert.equal(c.doc.getElementById('back').hidden, false, 'later pages offer Back');
c.click(0);
c.click(1);
assert.equal(c.doc.getElementById('question').textContent, '同时检查哪些？', 'multiple choices wait for Next');
assert.equal(c.input(0).checked, true);
assert.equal(c.input(1).checked, true);
c.back();
assert.equal(c.input(0).checked, true, 'Back restores first answer');
c.click(1);
assert.equal(c.input(0).checked, true, 'second-question selection survives Back');
assert.equal(c.input(1).checked, true);
c.next();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(c.sent.length, 1, 'last answer submits without an extra review screen');
c.next();
assert.equal(c.sent.length, 1, 'used card cannot submit again');
assert.match(c.sent[0].content[0].text, /玩法/);

const single = card({ decisionId: 'decision-single', locale: 'zh-CN', questions: [
  { question: '选哪项？', options: [{ label: '甲' }, { label: '乙' }] },
] });
assert.equal(single.doc.getElementById('progress').hidden, true, 'one question needs no progress counter');
assert.equal(single.doc.querySelector('.footer').hidden, true, 'single choice needs no empty action bar');
single.click(1);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(single.sent.length, 1, 'one-question single choice submits immediately');
assert.match(single.sent[0].content[0].text, /乙/);

let closeCalls = 0;
const closeAfterSend = card({ decisionId: 'close-after-send', questions: [questions[0]] }, {
  host: { async requestClose() { closeCalls++; } },
});
closeAfterSend.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(closeCalls, 0, 'successful submission keeps the inline receipt instead of closing the host');
assert.equal(closeAfterSend.doc.querySelector('.receipt').hidden, false);
assert.equal(closeAfterSend.doc.querySelector('.receipt').open, false);
assert.match(closeAfterSend.doc.querySelector('.receipt summary').textContent, /界面/);
closeAfterSend.doc.querySelector('.receipt').open = true;
assert.equal(closeAfterSend.sent.length, 1, 'expanding receipt does not resend');

let stateAtClose;
const hangingClose = card({ decisionId: 'hanging-close', questions: [questions[0]] }, {
  host: { requestClose() {
    stateAtClose = structuredClone(this.widgetState);
    return new Promise(() => {});
  } },
});
hangingClose.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(stateAtClose, undefined, 'host close is never invoked');
assert.equal(hangingClose.window.openai.widgetState.privateContent.sent, true);
assert.equal(hangingClose.doc.getElementById('question').textContent, '已记录', 'a stalled close cannot leave the card sending');
hangingClose.next();
assert.equal(hangingClose.sent.length, 1, 'a stalled close cannot cause duplicate delivery');
const restoredAfterClose = card({ decisionId: 'hanging-close', questions: [questions[0]] }, {
  host: { widgetState: structuredClone(hangingClose.window.openai.widgetState) },
});
assert.equal(restoredAfterClose.doc.getElementById('question').textContent, '已记录', 'reopening during close restores delivered state');

const failedClose = card({ decisionId: 'failed-close', questions: [questions[0]] }, {
  host: { async requestClose() { throw new Error('Close unavailable'); } },
});
failedClose.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(failedClose.doc.getElementById('question').textContent, '已记录', 'close failure does not undo delivery');
assert.equal(failedClose.window.openai.widgetState.privateContent.sent, true);

const custom = card({ decisionId: 'decision-2', locale: 'en', questions: [
  { question: 'What next?', options: [{ label: 'Build' }, { label: 'Research' }], multiple: false },
] });
assert.equal(custom.doc.getElementById('question').textContent, 'What next?');
assert.equal(custom.doc.getElementById('free').hidden, true, 'Other has no input box until selected');
custom.click(2);
const field = custom.doc.getElementById('free');
assert.equal(field.parentElement.closest('.option'), custom.input(2).closest('.option'), 'free-text field is inside custom option');
custom.next();
assert.equal(custom.sent.length, 0, 'empty custom answer cannot submit');
field.value = 'My own direction';
field.dispatchEvent(new custom.window.Event('input', { bubbles: true }));
custom.next();
await new Promise(resolve => setTimeout(resolve, 0));
assert.match(custom.sent[0].content[0].text, /My own direction/);
assert.equal(custom.savedAnswers[0].answers[0].custom, 'My own direction', 'custom input is saved independently of the follow-up wrapper');
assert.equal(custom.doc.documentElement.lang, 'en');

const customKeyboard = card({ decisionId: 'keyboard', locale: 'zh-CN', questions: [questions[0]] });
const draft = card({ decisionId: 'draft-back', locale: 'zh-CN', questions });
draft.click(2);
const draftField = draft.doc.getElementById('free');
draftField.value = '保留我写的需求';
draftField.dispatchEvent(new draft.window.Event('input', { bubbles: true }));
draft.click(0);
draft.back();
draft.click(2);
assert.equal(draftField.value, '保留我写的需求', 'switching answers and returning preserves the custom draft');
draft.click(1);
draft.click(0);
draft.next();
await new Promise(resolve => setTimeout(resolve, 0));
assert.doesNotMatch(draft.sent[0].content[0].text, /保留我写的需求/, 'unselected custom drafts are never submitted');
customKeyboard.click(2);
const keyboardField = customKeyboard.doc.getElementById('free');
keyboardField.value = '键盘答案';
keyboardField.dispatchEvent(new customKeyboard.window.Event('input', { bubbles: true }));
keyboardField.dispatchEvent(new customKeyboard.window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
assert.equal(customKeyboard.sent.length, 0, 'Alt+Enter does not submit');
keyboardField.dispatchEvent(new customKeyboard.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
await new Promise(resolve => setTimeout(resolve, 0));
assert.match(customKeyboard.sent[0].content[0].text, /键盘答案/, 'Enter submits custom answer');

const restored = card({ decisionId: 'decision-2', locale: 'en', questions: [
  { question: 'What next?', options: [{ label: 'Build' }, { label: 'Research' }] },
] }, { host: { widgetState: structuredClone(custom.window.openai.widgetState) } });
assert.equal(restored.doc.getElementById('next').hidden, true, 'completed state restores disabled controls');
restored.next();
assert.equal(restored.sent.length, 0);

const failure = card({ decisionId: 'failure', questions: [questions[0]] }, { bridgeResult: { isError: true } });
failure.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(failure.doc.getElementById('next').hidden, false, 'explicit rejection permits retry');
assert.match(failure.doc.getElementById('question').textContent, /失败/, 'failure no longer claims to be sending');

const timeout = card({ decisionId: 'timeout', questions: [questions[0]] }, { fastTimers: true, bridgeTimeout: true });
timeout.click(0);
await new Promise(resolve => setTimeout(resolve, 25));
assert.equal(timeout.doc.getElementById('next').hidden, true, 'uncertain delivery must not offer duplicate submission');
assert.match(timeout.doc.getElementById('status').textContent, /请勿重复/);

const malformed = card({ decisionId: 'bad-state', questions: [questions[0]] }, {
  host: { widgetState: { privateContent: { decisionId: 'bad-state', page: 1, sent: true, answers: [null] } } },
});
assert.equal(malformed.doc.getElementById('question').textContent, questions[0].question, 'malformed saved state resets safely');

const standard = card({ decisionId: 'standard', questions: [questions[0]] }, { standardBridge: true });
standard.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(standard.sent.length, 1, 'standard MCP Apps bridge delivers a follow-up without the optional OpenAI bridge');
assert.equal(standard.sent[0].role, 'user');
assert.match(standard.sent[0].content[0].text, /界面/);

const hybrid = card({ decisionId: 'hybrid', questions: [questions[0]] }, {
  hybridBridge: true,
  host: { async sendFollowUpMessage() { /* Optional alias resolves without delivering. */ } },
});
hybrid.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(hybrid.sent.length, 1, 'standard MCP Apps message is used even when an optional alias is present');
assert.equal(hybrid.doc.getElementById('question').textContent, '已记录');

const rejected = card({ decisionId: 'bridge-rejected', questions: [questions[0]] }, {
  standardBridge: true, bridgeResult: { isError: true },
});
rejected.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.notEqual(rejected.doc.getElementById('question').textContent, '已记录', 'host rejection must not be reported as sent');

const saveFailure = card({decisionId:'save-failed',questions:[questions[0]]},{saveResult:{isError:true}});
saveFailure.click(0);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(saveFailure.sent.length,0,'never notify without a durable receipt');
assert.notEqual(saveFailure.doc.getElementById('question').textContent,'已记录');
const saveTimeout = card({decisionId:'save-timeout',questions:[questions[0]]},{saveTimeout:true,fastTimers:true});
saveTimeout.click(0);
await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(saveTimeout.sent.length,0,'storage timeout must not trigger conversation');
assert.equal(saveTimeout.doc.getElementById('next').hidden,false,'safe to retry idempotent storage');
console.log('Card UI passed: sequence, receipt-before-message, storage failure, custom input, delivery errors and restore');
