// Take the token-radar screenshots: board, detail, filtered.
// Usage: node shot-radar.mjs <outDir> <repoDir> [port]
// Serves <outDir> (which holds data.js + dashboard/) and screenshots the dashboard.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const outDir = process.argv[2];
const repoDir = process.argv[3];
const port = Number(process.argv[4] || 8093);

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((req, res) => {
  const path = join(outDir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'dashboard/index.html');
  if (!existsSync(path)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (err) => console.log('PAGE ERROR:', String(err).slice(0, 300)));
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text().slice(0, 300)); });

const shots = [
  { name: '1-board.jpg', hash: '#/', scroll: null },
  { name: '2-detail.jpg', hash: '#/protocol/steakhouse-financial', scroll: '#detail' },
  { name: '3-filtered.jpg', hash: '#/category/Derivatives', scroll: null },
];
mkdirSync(join(repoDir, 'screenshots'), { recursive: true });
for (const shot of shots) {
  const url = `http://127.0.0.1:${port}/dashboard/index.html${shot.hash}`;
  console.log('shot:', shot.name, url);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
  } catch {
    console.log('  TIMEOUT waiting for __shotReady, screenshotting anyway');
  }
  await new Promise((r) => setTimeout(r, 400));
  if (shot.scroll) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: 'start' }); }, shot.scroll);
    await new Promise((r) => setTimeout(r, 300));
  }
  const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
  writeFileSync(join(repoDir, 'screenshots', shot.name), buf);
  console.log('  wrote', shot.name, buf.length, 'bytes');
}
await browser.close();
server.close();
console.log('done');
