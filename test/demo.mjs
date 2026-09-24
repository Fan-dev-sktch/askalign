import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
const hostHtml=await readFile(new URL('../docs/demo.html',import.meta.url),'utf8');
const cardHtml=await readFile(new URL('../server/card.html',import.meta.url),'utf8');
const host=new Window({url:'https://demo.test/docs/demo.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true,disableIframePageLoading:true}});
const card=new Window({url:'https://demo.test/server/card.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
const calls=[];
const tick=()=>new Promise(r=>setTimeout(r,20));
try{
  host.document.write(hostHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));
  card.document.write(cardHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));
  host.structuredClone=structuredClone;card.structuredClone=structuredClone;
  Object.defineProperty(host.document.querySelector('iframe'),'contentWindow',{value:card});
  Object.defineProperty(card,'parent',{value:host});
  host.postMessage=m=>{calls.push(m);queueMicrotask(()=>host.dispatchEvent(new host.MessageEvent('message',{source:card,origin:host.location.origin,data:m})));};
  card.postMessage=m=>queueMicrotask(()=>card.dispatchEvent(new card.MessageEvent('message',{source:host,origin:host.location.origin,data:m})));
  host.eval(hostHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
  card.eval(cardHtml.match(/<script>([\s\S]*?)<\/script>/)[1]);
  await tick();
  const choose=i=>card.document.querySelector(`#options input[value="${i}"]`).click();
  choose(1); // single choice
  choose(0);choose(1);choose(3); // multiple plus Other
  const field=card.document.getElementById('free');field.value='Keyboard access';field.dispatchEvent(new card.Event('input',{bubbles:true}));
  card.document.getElementById('next').click();await tick();
  const answer=host.document.getElementById('answer').textContent;
  for(const label of ['Internal team','Anonymous feedback','No login required','Keyboard access'])assert.ok(answer.includes(label),`demo answer missing: ${label}`);
  assert.match(card.document.querySelector('.receipt summary').textContent,/^Awaiting read$/);
  card.document.dispatchEvent(new card.Event('visibilitychange'));await tick();
  assert.ok(calls.some(m=>m.params?.name==='spellout_read_answer'));
  assert.equal(calls.filter(m=>m.method==='ui/message').length,0);
  host.document.getElementById('restart').click();
  assert.ok(!host.document.getElementById('answer').textContent.includes('Keyboard access'),'restart clears in-memory answers');
  console.log('Demo passed: actual demo/card bridge, single, multi, Other, saved status, reset and zero ui/message');
}finally{await host.happyDOM.close();await card.happyDOM.close();}
