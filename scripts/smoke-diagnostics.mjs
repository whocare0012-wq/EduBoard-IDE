// SPDX-License-Identifier: GPL-3.0-only
// Offline Electron + real host AST parser; deterministic compiler transport fixture, no hardware.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { closeSmoke } from './close-smoke.mjs';

const require = createRequire(import.meta.url);
const root = await mkdtemp(join(tmpdir(), 'eduboard-diagnostics-'));
const working = join(root, '中文 tools'); await mkdir(working);
// Node treats the CLI's first positional command as an entry point. No production bypass is used.
await copyFile(resolve('tests/fixtures/diagnostic-compiler.cjs'), join(working, 'compile'));
await writeFile(join(working, 'version'), 'console.log("fixture CLI transport")');
await writeFile(join(working, 'board'), 'console.log(JSON.stringify({detected_ports:[]}))');
await writeFile(join(working, 'core'), 'console.log(JSON.stringify({boards:[]}))');
const folder = join(root, '中文 project', 'Diagnostics'); await mkdir(folder, { recursive: true });
const project = join(folder, 'Diagnostics.eduboard.json');
const cppLine = 'void setup() { BROKEN_CPP; }';
const cpp = Array.from({ length: 80 }, (_, i) => '// compiler row ' + i).join('\n') + '\n' + cppLine + '\nvoid loop() {}\n';
const badPython = 'emoji = "😀"; broken = )';
const python = Array.from({ length: 100 }, (_, i) => '# parser row ' + i).join('\n') + '\n' + badPython + '\n';
await writeFile(project, JSON.stringify({ format: 'eduboard-project', version: 1, language: 'arduino', mode: 'text', source: cpp,
  fqbn: 'esp32:esp32:esp32', microBoard: 'esp32', workspace: null, blockTarget: 'arduino', drafts: { arduino: cpp, micropython: python } }));
await writeFile(join(folder, 'Diagnostics.ino'), cpp);
const environment = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)));
const application = await electron.launch({ executablePath: process.env.EDUBOARD_SMOKE_EXE || require('electron'),
  args: process.env.EDUBOARD_SMOKE_EXE ? [] : [resolve('.')], cwd: working,
  env: { ...environment, EDUBOARD_USER_DATA: join(root, 'profile'), ARDUINO_CLI_PATH: process.execPath, ARDUINO_CLI_CONFIG_FILE: '', EDUBOARD_PYTHON_PATH: process.env.EDUBOARD_PYTHON_PATH || 'python' } });
const page = await application.firstWindow();
try {
  await page.setViewportSize({ width: 1280, height: 820 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.context().setOffline(true);
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    dialog.showMessageBoxSync = () => 1;
  }, project);
  const ready = () => page.getByRole('status').filter({ hasText: '准备就绪' }).waitFor();
  const input = () => page.locator('.monaco-editor textarea').first();
  const links = () => page.locator('.diagnostic-link');
  const markers = () => page.locator('.monaco-editor .squiggly-error');
  async function switchTo(name) { await page.getByRole('button', { name, exact: true }).click(); await ready(); }
  async function edit(code) { await input().focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code); }
  async function save() { await page.getByRole('button', { name: '保存', exact: true }).click(); await ready(); }
  const readProject = async () => JSON.parse(await readFile(project, 'utf8'));
  const settled = () => page.evaluate(() => new Promise(resolve => {
    let frames = 0; function frame() { if (++frames === 24) resolve(); else requestAnimationFrame(frame); } frame();
  }));
  async function assertNoMarkers() { await page.waitForFunction(() => !document.querySelector('.monaco-editor .squiggly-error')); }
  await page.locator('.monaco-editor').waitFor();
  await page.getByRole('button', { name: '打开', exact: true }).click(); await ready();
  await switchTo('Python');
  await page.getByRole('button', { name: '检查语法', exact: true }).click();
  const pythonLink = links().filter({ hasText: 'SyntaxError' });
  await pythonLink.waitFor(); await ready();
  assert.equal(await links().count(), 1);
  assert.equal((await page.locator('.console').innerText()).split('SyntaxError:').length - 1, 1, 'Streamed Python error appears once');
  assert.equal(await pythonLink.getAttribute('title'), '跳到第 101 行，第 ' + (badPython.indexOf(')') + 1) + ' 列');
  await input().focus(); await page.keyboard.press('ControlOrMeta+Home');
  await pythonLink.click(); await markers().first().waitFor();
  await page.locator('.view-lines').filter({ hasText: 'broken' }).waitFor();
  await settled();
  await mkdir(resolve('output/playwright'), { recursive: true });
  await page.screenshot({ path: resolve('output/playwright/diagnostics-python.png') });
  await switchTo('C++'); await assertNoMarkers();
  await pythonLink.focus(); await page.keyboard.press('Enter'); await ready();
  await input().waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.activeElement === document.querySelector('.monaco-editor textarea'));
  await page.keyboard.insertText('X'); await save();
  const pythonIndex = python.indexOf(badPython) + badPython.indexOf(')');
  assert.equal((await readProject()).drafts.micropython, python.slice(0, pythonIndex) + 'X' + python.slice(pythonIndex), 'Keyboard log navigation selects the Python model and UTF-16 column');
  await assertNoMarkers(); assert.equal(await pythonLink.count(), 0, 'Edits invalidate old log navigation');
  await edit('print("fixed")\n');
  await page.getByRole('button', { name: '检查语法', exact: true }).click();
  await page.locator('.console').filter({ hasText: '[语法检查] 成功' }).waitFor(); await ready(); await assertNoMarkers();

  await switchTo('C++');
  await page.getByRole('button', { name: '编译', exact: true }).click();
  const cppLink = links().filter({ hasText: 'fixture undeclared' });
  await cppLink.waitFor(); await ready();
  assert.equal(await links().count(), 1, 'Dependency file with the same basename is not navigable');
  const output = await page.locator('.console').innerText();
  assert.equal(output.split('fixture undeclared BROKEN_CPP').length - 1, 1, 'Streamed compiler failure appears once');
  assert.equal(output.split('fixture library error').length - 1, 1);
  assert.doesNotMatch(output, /\x1b/);
  await input().focus(); await page.keyboard.press('ControlOrMeta+Home');
  await cppLink.click(); await markers().first().waitFor();
  await settled();
  await page.screenshot({ path: resolve('output/playwright/diagnostics-cpp.png') });
  await switchTo('Python'); await assertNoMarkers();
  await cppLink.click(); await ready();
  await page.waitForFunction(() => document.activeElement === document.querySelector('.monaco-editor textarea'));
  await page.keyboard.insertText('X'); await save();
  assert.equal((await readProject()).drafts.arduino, cpp.replace('BROKEN_CPP', 'XBROKEN_CPP'), 'Click returns to the correct C++ model, line and column');
  await assertNoMarkers(); assert.equal(await cppLink.count(), 0);
  await edit('void setup() {}\nvoid loop() {}\n');
  await page.getByRole('button', { name: '编译', exact: true }).click();
  await page.locator('.console').filter({ hasText: '[编译] 成功' }).waitFor(); await ready(); await assertNoMarkers();
  assert.equal(await links().count(), 0);

  await switchTo('图形化'); await page.locator('.blocklySvg').waitFor();
  await page.getByRole('button', { name: '编译', exact: true }).click();
  const previewLink = links().filter({ hasText: 'fixture preview compiler error' });
  await previewLink.waitFor(); await ready();
  await page.setViewportSize({ width: 860, height: 600 });
  await page.locator('.code-pane.preview-hidden').waitFor({ state: 'attached' });
  await switchTo('C++'); await assertNoMarkers();
  await previewLink.click(); await ready();
  await page.locator('.code-pane:not(.preview-hidden)').waitFor(); await markers().first().waitFor();
  await page.locator('.view-lines').filter({ hasText: 'void loop()' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '图形化', exact: true }).getAttribute('aria-pressed'), 'true');
  await settled();
  await page.screenshot({ path: resolve('output/playwright/diagnostics-preview-narrow.png') });
  await switchTo('C++'); await assertNoMarkers();
  await page.getByRole('button', { name: '打开', exact: true }).click(); await ready();
  assert.equal(await links().count(), 0, 'Opening a project removes all earlier session links');
  await assertNoMarkers();
  await page.getByRole('button', { name: '编译', exact: true }).click(); await previewLink.waitFor(); await ready();
  await page.getByRole('button', { name: '新建', exact: true }).click(); await ready();
  assert.equal(await links().count(), 0, 'New projects cannot navigate earlier session logs'); await assertNoMarkers();
  assert.deepEqual(errors, []);
  console.log('PASS diagnostics: real Python syntax/Unicode columns, fixture compiler/fragmented output, one error copy, inline markers, mouse/keyboard navigation across models, stale edit/success/open cleanup, isolated read-only preview and narrow auto-expansion. No hardware.');
} catch (error) {
  await mkdir(resolve('output/playwright'), { recursive: true });
  await page.screenshot({ path: resolve('output/playwright/diagnostics-failure.png') });
  throw error;
} finally { await closeSmoke(application); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
