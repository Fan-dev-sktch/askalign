import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only the demo and its card are served; no directory browsing or local records.
const pages = new Map([
  ['/docs/demo.html', new URL('../docs/demo.html', import.meta.url)],
  ['/server/card.html', new URL('../server/card.html', import.meta.url)],
]);
export function createDemoServer() {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/') {
      response.writeHead(302, { Location: '/docs/demo.html' }).end();
      return;
    }
    const page = pages.get(pathname);
    if (!page) { response.writeHead(404).end('Not found'); return; }
    try {
      const content = await readFile(page);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(500).end('Demo file unavailable. Re-extract the complete source package.');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createDemoServer();
  server.on('error', error => {
    console.error(`Demo could not start / 演示无法启动：${error.code ?? error.message}`);
    process.exitCode = 1;
  });
  // An available loopback port avoids colliding with other local applications.
  server.listen(0, '127.0.0.1', () => {
    console.log(`SpellOut demo / 说透演示\nOpen / 在浏览器打开：http://127.0.0.1:${server.address().port}/docs/demo.html\nChoose 简体中文 in Language for Chinese.\nScripted questions, no AI or account required. No installation or settings changes.\n预设问题，不运行 AI，无需账号，不安装插件或修改设置。\nKeep this terminal open; press Ctrl+C to stop / 保持终端开启，Ctrl+C 结束。`);
  });
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
}
