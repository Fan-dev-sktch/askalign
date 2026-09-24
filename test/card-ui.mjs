import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

const html = await readFile(new URL('../server/card.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
assert.match(script, /html\.style\.height='max-content'/, 'measure content height the same way as the MCP Apps reference implementation');
assert.match(script, /params:\{width,height\}/, 'notify the host with both dimensions');
assert.match(script, /resizeObserver\.observe\(document\.documentElement\).*resizeObserver\.observe\(document\.body\)/, 'observe document changes, not only the card');

const windows = [];
function card(data, overrides = {}) {
  // Evaluate only this repository's checked-in UI, never downloaded/user HTML.
  const window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  windows.push(window);
  window.structuredClone = structuredClone;
  if (overrides.fastTimers) {
    const original = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => original(callback, delay === 15000 ? 0 : delay, ...args);
  }
  window.requestAnimationFrame = callback => window.setTimeout(() => callback(Date.now()), 0);
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.document.documentElement.getBoundingClientRect = () => ({ height: 240 });
  const sent = [],calls=[];
  window.followups = sent;
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
    if(message.method==='tools/call'){
      calls.push(message.params);
      const result=overrides.toolHandler?.(message.params);
      if(result!==undefined){window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{jsonrpc:'2.0',id:message.id,result}}));return;}
    }
    if (message.method === 'ui/message') {
      sent.push(message.params);
      if (overrides.bridgeTimeout) return;
    }
    if (message.method === 'tools/call' && message.params.name === 'spellout_read_answer') {
      if(overrides.statusTimeout)return;
      window.dispatchEvent(new window.MessageEvent('message', {source:parent,data:{jsonrpc:'2.0',id:message.id,result:overrides.statusResult??{structuredContent:{decisionId:message.params.arguments.decisionId,status:'pending'}}}}));
      return;
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
  return { window, doc, sent, calls, savedAnswers, notifications, input, click: value => input(value).click(), next: () => doc.getElementById('next').click(), back: () => doc.getElementById('back').click() };
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
assert.equal(c.savedAnswers.length, 1, 'last answer submits without an extra review screen');
c.next();
assert.equal(c.savedAnswers.length, 1, 'used card cannot submit again');
assert.deepEqual(Array.from(c.savedAnswers[0].answers[0].picks), [1]);

const single = card({ decisionId: 'decision-single', locale: 'zh-CN', questions: [
  { question: '选哪项？', options: [{ label: '甲' }, { label: '乙' }] },
] });
assert.equal(single.doc.getElementById('progress').hidden, true, 'one question needs no progress counter');
assert.equal(single.doc.querySelector('.footer').hidden, true, 'single choice needs no empty action bar');
single.click(1);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(single.savedAnswers.length, 1, 'one-question single choice submits immediately');
assert.deepEqual(Array.from(single.savedAnswers[0].answers[0].picks), [1]);

let closeCalls = 0;
const closeAfterSend = card({ decisionId: 'close-after-send', questions: [questions[0]] }, {
  host: { async requestClose() { closeCalls++; } },
});
closeAfterSend.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(closeCalls, 0, 'successful submission keeps the inline receipt instead of closing the host');
assert.equal(closeAfterSend.doc.querySelector('.receipt').hidden, false);
assert.equal(closeAfterSend.doc.querySelector('.receipt').open, false);
assert.equal(closeAfterSend.doc.querySelector('.receipt summary').textContent, '待读取');
assert.match(closeAfterSend.doc.querySelector('.receipt div').textContent, /界面/, 'answer remains inside expandable details');
closeAfterSend.doc.querySelector('.receipt').open = true;
assert.equal(closeAfterSend.savedAnswers.length, 1, 'expanding receipt does not resend');

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
assert.equal(hangingClose.savedAnswers.length, 1, 'a stalled close cannot cause duplicate delivery');
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
assert.equal(custom.sent.length, 0, 'custom answers never enqueue a turn');
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
assert.doesNotMatch(JSON.stringify(draft.savedAnswers), /保留我写的需求/, 'unselected custom drafts are never submitted');
customKeyboard.click(2);
const keyboardField = customKeyboard.doc.getElementById('free');
keyboardField.value = '键盘答案';
keyboardField.dispatchEvent(new customKeyboard.window.Event('input', { bubbles: true }));
keyboardField.dispatchEvent(new customKeyboard.window.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true }));
assert.equal(customKeyboard.sent.length, 0, 'Alt+Enter does not submit');
keyboardField.dispatchEvent(new customKeyboard.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(customKeyboard.savedAnswers[0].answers[0].custom, '键盘答案', 'Enter submits custom answer');

const restored = card({ decisionId: 'decision-2', locale: 'en', questions: [
  { question: 'What next?', options: [{ label: 'Build' }, { label: 'Research' }] },
] }, { host: { widgetState: structuredClone(custom.window.openai.widgetState) } });
assert.equal(restored.doc.getElementById('next').hidden, true, 'completed state restores disabled controls');
restored.next();
assert.equal(restored.sent.length, 0);

const failure = card({ decisionId: 'failure', questions: [questions[0]] }, { saveResult: { isError: true } });
failure.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(failure.doc.getElementById('next').hidden, false, 'explicit rejection permits retry');
assert.match(failure.doc.getElementById('question').textContent, /未确认/, 'failure no longer claims to be sending');

const timeout = card({ decisionId: 'timeout', questions: [questions[0]] }, { fastTimers: true, bridgeTimeout: true });
timeout.click(0);
await new Promise(resolve => setTimeout(resolve, 25));
assert.equal(timeout.doc.getElementById('next').hidden, true, 'saved answer is complete even when message transport hangs');
assert.equal(timeout.sent.length, 0, 'a hanging host-message route cannot delay a saved answer');
assert.match(timeout.doc.querySelector('.receipt summary').textContent, /^待读取$/);

const malformed = card({ decisionId: 'bad-state', questions: [questions[0]] }, {
  host: { widgetState: { privateContent: { decisionId: 'bad-state', page: 1, sent: true, answers: [null] } } },
});
assert.equal(malformed.doc.getElementById('question').textContent, questions[0].question, 'malformed saved state resets safely');

const standard = card({ decisionId: 'standard', questions: [questions[0]] }, { standardBridge: true });
standard.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(standard.savedAnswers.length, 1, 'standard MCP Apps bridge saves without the optional OpenAI bridge');
assert.equal(standard.sent.length, 0, 'standard bridge saves directly without another turn');
assert.deepEqual(Array.from(standard.savedAnswers[0].answers[0].picks), [0]);

const hybrid = card({ decisionId: 'hybrid', questions: [questions[0]] }, {
  hybridBridge: true,
  host: { async sendFollowUpMessage() { /* Optional alias resolves without delivering. */ } },
});
hybrid.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(hybrid.savedAnswers.length, 1, 'answer is saved even when an optional message alias is present');
assert.equal(hybrid.doc.getElementById('question').textContent, '已记录');

const rejected = card({ decisionId: 'bridge-rejected', questions: [questions[0]] }, {
  standardBridge: true, bridgeResult: { isError: true },
});
rejected.click(0);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(rejected.doc.getElementById('question').textContent, '已记录', 'unused message transport cannot reject a saved answer');
assert.equal(rejected.sent.length, 0);

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
// A lost save acknowledgement must recover from durable status, without resending a message.
const recoveredState={structuredContent:{decisionId:'recover-save',status:'pending'}};
const recoverSave=card({decisionId:'recover-save',questions:[questions[0]]},{saveTimeout:true,fastTimers:true,statusResult:recoveredState});
recoverSave.click(1);await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(recoverSave.doc.querySelector('.receipt').hidden,true,'timeout alone does not confirm the save');
recoveredState.structuredContent={decisionId:'recover-save',status:'answered',revision:0,answers:[{picks:[1],custom:''}]};
recoverSave.doc.dispatchEvent(new recoverSave.window.Event('visibilitychange'));await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(recoverSave.doc.querySelector('.receipt').hidden,false,'authoritative status recovers a lost save response without requiring assistant acknowledgement');
assert.match(recoverSave.doc.querySelector('.receipt summary').textContent,/^待读取$/);
assert.doesNotMatch(recoverSave.doc.querySelector('.receipt summary').textContent,/已完成/);
recoverSave.next();assert.equal(recoverSave.savedAnswers.length,1,'recovered receipt blocks resubmission');
const retrySave=card({decisionId:'retry-save',questions:[questions[0]]},{saveTimeout:true,fastTimers:true});
retrySave.click(0);retrySave.next();await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(retrySave.savedAnswers.length,1,'rapid duplicate click is ignored while saving');
retrySave.next();await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(retrySave.savedAnswers.length,2,'an unconfirmed save can be explicitly retried');
assert.equal(JSON.stringify(retrySave.savedAnswers[0]),JSON.stringify(retrySave.savedAnswers[1]),'retry uses the identical durable answer');
console.log('Card UI passed: sequence, direct saved answers, storage failure, custom input, no duplicate messages and restore');

// A normal conversation message is handled by the model's dismiss tool. The UI
// only consumes that exact decision's authoritative status, never focus guesses.
const dismissalState = {structuredContent:{decisionId:'dismiss-me',status:'pending'}};
const dismissedCard = card({decisionId:'dismiss-me',questions:[questions[0]]},{statusResult:dismissalState});
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(dismissedCard.doc.querySelector('.card').hidden,false);
dismissalState.structuredContent.status='dismissed';
await new Promise(resolve=>setTimeout(resolve,2700));
assert.equal(dismissedCard.doc.querySelector('.card').hidden,true,'dismissed card content disappears');
assert.equal(dismissedCard.notifications.filter(n=>n.method==='ui/notifications/size-changed').at(-1).params.height,1,'collapse even when previous frame measured 240px');
assert.equal(dismissedCard.window.openai.widgetState.privateContent.dismissed,true);
dismissedCard.click(0);dismissedCard.next();
assert.equal(dismissedCard.sent.length,0,'stale controls cannot send');
const retiredRestore=card({decisionId:'dismiss-me',questions:[questions[0]]},{host:{widgetState:structuredClone(dismissedCard.window.openai.widgetState)}});
assert.equal(retiredRestore.doc.querySelector('.card').hidden,true,'retirement survives reopening');
const fresh=card({decisionId:'fresh',questions:[questions[0]]},{host:{widgetState:structuredClone(dismissedCard.window.openai.widgetState)}});
assert.equal(fresh.doc.querySelector('.card').hidden,false,'another decision never inherits dismissal');
const wrongStatus=card({decisionId:'keep-me',questions:[questions[0]]},{statusResult:{structuredContent:{decisionId:'other-thread',status:'dismissed'}}});
const failedStatus=card({decisionId:'status-failed',questions:[questions[0]]},{statusResult:{isError:true}});
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(wrongStatus.doc.querySelector('.card').hidden,false,'wrong ID ignored');
assert.equal(failedStatus.doc.querySelector('.card').hidden,false,'read failure is not dismissal');
const lateClick=card({decisionId:'late-click',questions:[questions[0]]},{saveResult:{isError:true,structuredContent:{decisionId:'late-click',status:'dismissed'}}});
lateClick.click(0);
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(lateClick.sent.length,0,'click racing dismissal never emits a follow-up');
assert.equal(lateClick.doc.querySelector('.card').hidden,true);
console.log('Card dismissal passed: exact status, hidden content, 1px height, restore, stale clicks and failed reads');

const task={contextId:'task-test',version:0,preferences:{intensity:'balanced'},brief:{goal:'共同确认需求',confirmed:'三项一起做',open:'视觉效果'}};
let taskState=structuredClone(task);
let rejectContext=false;
const rich=card({decisionId:'rich',context:task,questions:[{...questions[0],reason:'这决定先做哪部分'}]}, {toolHandler:({name,arguments:args})=>{
 if(name==='spellout_context'){
  if(rejectContext)return {isError:true};
  if(args.action==='update')taskState={...taskState,...(args.preferences?{preferences:args.preferences}:{}),...(args.brief?{brief:args.brief}:{}),version:taskState.version+1};
  return {structuredContent:structuredClone(taskState)};
 }
 if(name==='spellout_preferences')return {structuredContent:{scope:'default',preferences:args.preferences}};
 if(name==='spellout_revise_answer')return {structuredContent:{saved:true,decisionId:'rich',revision:1}};
}});
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(rich.doc.querySelector('.tools').hidden,false);
assert.equal(rich.doc.querySelector('.tools').tagName,'DETAILS','auxiliary controls share one collapsed entry');
assert.equal(rich.doc.querySelector('.tools').open,false,'settings do not expand into the question by default');
assert.equal(rich.doc.querySelector('.tools > summary').textContent,'','settings entry uses only a chevron');
assert.equal(rich.doc.querySelector('.tools > summary').getAttribute('aria-label'),'提问设置与需求摘要','icon retains an accessible name');
assert.equal(rich.doc.querySelector('.tools > summary').getAttribute('title'),'提问设置与需求摘要','hover explains the icon');
assert.deepEqual(Array.from(rich.doc.getElementById('aa-questionsPerRound').options).map(x=>x.value),['1','2','3','4','5']);
rich.doc.querySelector('.tools > summary').click();
assert.equal(rich.doc.querySelector('.tools').open,true,'settings can be expanded explicitly');
const roundLimit=rich.doc.getElementById('aa-questionsPerRound');roundLimit.value='5';roundLimit.dispatchEvent(new rich.window.Event('change'));
rich.doc.querySelector('.tools > summary').click();
assert.equal(roundLimit.value,'5','collapsing retains settings draft');
assert.equal(rich.sent.length,0,'opening settings does not submit an answer');
assert.match(rich.doc.querySelector('.why').textContent,/决定/);
assert.equal(rich.doc.getElementById('aa-goal').value,task.brief.goal);
const preset=rich.doc.getElementById('aa-preset');preset.value='deep';preset.dispatchEvent(new rich.window.Event('change',{bubbles:true}));
assert.equal(rich.doc.getElementById('aa-diversity').value,'exploratory');
assert.match(rich.doc.querySelector('.preview').textContent,/真正问题|真实/);
const byText=(label)=>[...rich.doc.querySelectorAll('button')].find(n=>n.textContent===label);
byText('另存为长期默认').click();
assert.equal(rich.calls.filter(c=>c.name==='spellout_preferences').length,0,'unsaved task changes do not change defaults');
roundLimit.value='5';roundLimit.dispatchEvent(new rich.window.Event('change'));
byText('应用到本次任务').click();await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(taskState.preferences.diversity,'exploratory');
assert.equal(taskState.preferences.questionsPerRound,5,'UI saves the five-question limit as a number');
assert.equal(rich.calls.filter(c=>c.name==='spellout_preferences').length,0,'Apply affects task only');
assert.equal(rich.sent.length,0,'settings changes never enqueue another turn');
byText('另存为长期默认').click();await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(rich.calls.filter(c=>c.name==='spellout_preferences').length,1);
const goal=rich.doc.getElementById('aa-goal');goal.value='改后的真实目标';goal.dispatchEvent(new rich.window.Event('input',{bubbles:true}));
rejectContext=true;byText('保存摘要').click();await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(goal.value,'改后的真实目标','failed save retains draft');
assert.equal(taskState.brief.goal,task.brief.goal);
rejectContext=false;byText('保存摘要').click();await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(taskState.brief.goal,'改后的真实目标');
rich.click(0);await new Promise(resolve=>setTimeout(resolve,10));
assert.match(rich.doc.querySelector('.receipt summary').textContent,/^待读取$/,'delivery is not understanding');
byText('修改选择').click();assert.equal(rich.doc.querySelector('.receipt').hidden,true);
rich.click(1);assert.equal(rich.calls.filter(c=>c.name==='spellout_revise_answer').length,0,'editing requires explicit send');
assert.match(rich.doc.querySelector('.delivery').textContent,/玩法/,'correction review shows the new answer');
rich.next();await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(rich.doc.querySelector('.receipt').open,false,'correction receipt collapses after sending');
assert.equal(rich.calls.filter(c=>c.name==='spellout_revise_answer').length,1);
assert.equal(rich.calls.find(c=>c.name==='spellout_revise_answer').arguments.expectedRevision,0);
assert.deepEqual(Array.from(rich.calls.find(c=>c.name==='spellout_revise_answer').arguments.answers[0].picks),[1]);
assert.equal(rich.sent.length,0,'answers, corrections and summaries never enqueue another turn');
assert.equal(rich.doc.querySelector('.receipt summary').textContent,'待读取');
assert.match(rich.doc.querySelector('.receipt div').textContent,/玩法/);
const ackState={structuredContent:{decisionId:'ack-card',status:'pending'}};
const acknowledged=card({decisionId:'ack-card',questions:[questions[0]]},{statusResult:ackState});
acknowledged.click(0);await new Promise(resolve=>setTimeout(resolve,10));
ackState.structuredContent={decisionId:'ack-card',status:'answered',revision:0,answers:[{picks:[0],custom:''}],acknowledgement:{revision:0,nextStep:'先检查界面'}};
acknowledged.doc.dispatchEvent(new acknowledged.window.Event('visibilitychange'));await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(acknowledged.doc.querySelector('.receipt summary').textContent,'已完成');
const stableSummary=acknowledged.doc.querySelector('.receipt summary');
acknowledged.doc.dispatchEvent(new acknowledged.window.Event('visibilitychange'));await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(acknowledged.doc.querySelector('.receipt summary'),stableSummary,'unchanged polling preserves focused elements');
ackState.structuredContent={decisionId:'ack-card',status:'answered',revision:1,answers:[{picks:[1],custom:''}]};
acknowledged.doc.dispatchEvent(new acknowledged.window.Event('visibilitychange'));await new Promise(resolve=>setTimeout(resolve,10));
assert.doesNotMatch(acknowledged.doc.querySelector('.receipt summary').textContent,/已完成/,'old acknowledgement cannot confirm correction');
console.log('Experience UI passed: task settings, explicit defaults, retained drafts, corrections and truthful acknowledgement');
// Both panels share a context version. Saving one must not stale the other
// when the only intervening edit is this card's own successful save.
for (const firstPanel of ['brief', 'settings']) {
 let shared = structuredClone(task);
 const pair = card({decisionId:'paired-'+firstPanel,context:shared,questions:[questions[0]]},{toolHandler:({name,arguments:args})=>{
  if(name!=='spellout_context')return;
  if(args.action==='get')return {structuredContent:structuredClone(shared)};
  if(args.expectedVersion!==shared.version)return {isError:true};
  shared={...shared,...(args.preferences?{preferences:args.preferences}:{}),...(args.brief?{brief:args.brief}:{}),version:shared.version+1};
  return {structuredContent:structuredClone(shared)};
 }});
 await new Promise(r=>setTimeout(r,10));
 const goalDraft=pair.doc.getElementById('aa-goal');goalDraft.value='保留我刚写的目标';goalDraft.dispatchEvent(new pair.window.Event('input'));
 const roundDraft=pair.doc.getElementById('aa-questionsPerRound');roundDraft.value='1';roundDraft.dispatchEvent(new pair.window.Event('change'));
 const press=label=>[...pair.doc.querySelectorAll('button')].find(b=>b.textContent===label).click();
 for(const label of firstPanel==='brief'?['保存摘要','应用到本次任务']:['应用到本次任务','保存摘要']){press(label);await new Promise(r=>setTimeout(r,10));}
 assert.equal(shared.version,2, 'both edited panels save without a self-generated conflict: '+firstPanel);
 assert.equal(shared.brief.goal,'保留我刚写的目标');
 assert.equal(shared.preferences.questionsPerRound,1);
 // A genuinely external edit must still conflict and keep this local draft.
 goalDraft.value='未保存草稿';goalDraft.dispatchEvent(new pair.window.Event('input'));
 shared={...shared,version:3,brief:{...shared.brief,goal:'其他窗口的目标'}};
 press('保存摘要');await new Promise(r=>setTimeout(r,10));
 assert.equal(shared.brief.goal,'其他窗口的目标');assert.equal(goalDraft.value,'未保存草稿');
}
assert.equal(acknowledged.calls.find(c=>c.name==='spellout_read_answer').arguments.source,'card','status polls identify a connected card without asserting visual acceptance');
const saveUnconfirmed=card({decisionId:'save-unconfirmed',questions:[questions[0]]},{fastTimers:true,saveTimeout:true});
await new Promise(r=>setTimeout(r,15));const readsBefore=saveUnconfirmed.calls.filter(c=>c.name==='spellout_read_answer').length;
saveUnconfirmed.click(0);await new Promise(r=>setTimeout(r,30));
assert.ok(saveUnconfirmed.calls.filter(c=>c.name==='spellout_read_answer').length>readsBefore,'A6 timeout immediately checks saved state, not only the scheduled poll');
assert.match(saveUnconfirmed.doc.getElementById('status').textContent,/保存未确认，正在核对/);
assert.doesNotMatch(script,/deliveryUncertain|error\?\.uncertain/,'A6 unreachable uncertain branch is removed');
for(const window of windows)assert.equal(window.followups.length,0,'no UI path may automatically send a conversation request');
await Promise.all(windows.map(window=>window.happyDOM.close()));
