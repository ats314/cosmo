/* @lane full */
/* The real built Phaser host, exercised only through browser input and its
   read-only snapshot. Canonical VM tests own detailed simulation behavior. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
async function loadPlaywright() {
  for (const name of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { const mod = await import(name); return mod.chromium ? mod : mod.default; } catch {}
  }
  try {
    const mod = await import(pathToFileURL(require.resolve('playwright')).href);
    return mod.chromium ? mod : mod.default;
  } catch { return null; }
}
function findChromium() {
  for (const path of [process.env.COSMO_CHROME,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe']) {
    if (path && existsSync(path)) return path;
  }
  return undefined;
}
const pw = await loadPlaywright(), executablePath = findChromium();
if (!pw || (!executablePath && !process.env.CI)) {
  if (process.env.CI) throw new Error('enginecheck needs the Playwright package and Chromium in CI');
  console.log('SKIP  enginecheck: install Playwright/Chromium, or set COSMO_CHROME.');
  process.exit(0);
}
assert(existsSync(resolve(root, 'dist/index.html')), 'run npm run build before enginecheck');
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
assert(existsSync(vite), 'run npm ci before enginecheck');
const origin = 'http://127.0.0.1:4173';
const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '', serverError = null, browser;
server.on('error', error => { serverError = error; });
for (const stream of [server.stdout, server.stderr]) stream.on('data', data => {
  serverLog = (serverLog + data.toString()).slice(-4000);
});
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (serverError || server.exitCode !== null) throw serverError || new Error('Vite preview exited: ' + serverLog);
    try { ready = /Local:/.test(serverLog) && (await fetch(origin)).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert(ready, 'Vite preview did not start: ' + serverLog);
  browser = await pw.chromium.launch({ executablePath,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  // No account or telemetry writes: this local app check needs only its own
  // compiled assets. Rejected external requests must leave play functional.
  await context.route('**/*', route => {
    const request = route.request();
    if (request.url().startsWith(origin + '/') && request.method() === 'GET') return route.continue();
    return route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.COSMO_APP && typeof window.COSMO_APP.snapshot === 'function');
  const snapshot = () => page.evaluate(() => ({ engine: window.COSMO_APP.engine,
    version: window.COSMO_APP.version, ...window.COSMO_APP.snapshot() }));
  await page.waitForFunction(() => window.COSMO_APP.snapshot().menuRects.some(r => r.id === 'start'));
  let state = await snapshot();
  assert.equal(state.engine, 'Phaser');
  assert.equal(state.loopOwner, 'Phaser');
  assert.equal(state.sceneCount, 1, 'the host must run one active scene');
  assert.equal(state.state, 'menu');
  const launch = state.menuRects.find(r => r.id === 'start');
  assert(launch && [launch.x, launch.y, launch.w, launch.h].every(Number.isFinite), 'LAUNCH has no finite hit area');
  await page.touchscreen.tap(launch.x + launch.w / 2, launch.y + launch.h / 2);
  await page.waitForFunction(() => window.COSMO_APP.snapshot().state === 'playing');
  await page.waitForTimeout(250);
  state = await snapshot();
  assert.equal(state.introStage, 0, 'first LAUNCH did not enter the playable introduction');
  const direction = state.direction;
  await page.mouse.click(195, 430);
  await page.waitForFunction(before => window.COSMO_APP.snapshot().direction !== before, direction);
  assert.equal((await snapshot()).direction, -direction, 'a real pointer tap did not reverse exactly once');
  await page.waitForFunction(() => !!window.COSMO_APP.snapshot().introSkipRect);
  const skip = (await snapshot()).introSkipRect;
  await page.touchscreen.tap(skip.x + skip.w / 2, skip.y + skip.h / 2);
  await page.waitForFunction(() => window.COSMO_APP.snapshot().introStage === null);
  const ring = (await snapshot()).ringIndex;
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 390 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 510 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(before => window.COSMO_APP.snapshot().ringIndex !== before, ring);
  state = await snapshot();
  assert.equal(state.state, 'playing');
  assert.equal(state.ringIndex, ring + 1, 'a real downward swipe did not move to the inner ring');
  const before = state;
  await page.waitForTimeout(400);
  const after = await snapshot(), updates = after.engineUpdates - before.engineUpdates;
  assert(updates > 0, 'the Phaser loop stopped');
  assert(Math.abs((after.steps - before.steps) - updates) <= 1, 'simulation is not stepping once per Phaser update');
  assert(Math.abs((after.frames - before.frames) - updates) <= 1, 'a second render loop is active');
  const shots = process.env.COSMO_ENGINE_SHOTS;
  if (shots) { await mkdir(resolve(shots), { recursive: true }); await page.screenshot({ path: resolve(shots, 'phaser-portrait.png') }); }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const v = window.COSMO_APP.snapshot().viewport; return v.width === 844 && v.height === 390;
  });
  state = await snapshot();
  assert.equal(state.sceneCount, 1, 'resize created a second active scene');
  assert.equal(state.state, 'playing', 'resize lost the live run');
  if (shots) await page.screenshot({ path: resolve(shots, 'phaser-landscape.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.COSMO_APP.snapshot().viewport.width === 390);
  assert.equal(await page.evaluate(() => window.__drawErr?.message || null), null, 'runtime rendering threw');
  assert.deepEqual(errors, [], 'the built app raised a browser exception');
  console.log('ENGINECHECK OK  Phaser boot, LAUNCH, pointer tap, touch swipe, portrait/landscape resize and one loop');
} finally {
  try { if (browser) await browser.close(); }
  finally {
    if (server.exitCode === null) {
      server.kill();
      await Promise.race([new Promise(done => server.once('exit', done)), delay(2000)]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
  }
}
