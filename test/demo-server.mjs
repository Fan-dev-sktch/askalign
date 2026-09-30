import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDemoServer } from '../scripts/demo.mjs';

const server = createDemoServer();
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  assert.equal(server.address().address, '127.0.0.1');
  const base = `http://127.0.0.1:${server.address().port}`;
  const redirect = await fetch(base, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/docs/demo.html');
  const demo = await fetch(base + '/docs/demo.html');
  assert.equal(demo.status, 200);
  assert.match(demo.headers.get('content-type'), /text\/html/);
  assert.match(await demo.text(), /id="card"/);
  const card = await fetch(base + '/server/card.html?demo=test');
  assert.equal(card.status, 200);
  assert.match(await card.text(), /spellout_submit_answer/);
  const head = await fetch(base + '/docs/demo.html', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const path of ['/package.json', '/server/answers.mjs', '/docs/../package.json', '/%2e%2e/package.json', '/.config/spellout/answers/', '/docs/demo.html/extra']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  const write = await fetch(base + '/docs/demo.html', { method: 'POST', body: 'answer' });
  assert.equal(write.status, 405);
  assert.equal(write.headers.get('allow'), 'GET, HEAD');
  console.log('Demo server passed: same-origin pages, query, HEAD, loopback, rejected file access and writes');
} finally {
  await new Promise(resolve => server.close(resolve));
}
