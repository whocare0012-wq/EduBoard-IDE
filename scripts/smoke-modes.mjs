// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { closeSmoke } from './close-smoke.mjs';

const require = createRequire(import.meta.url);
const root = await mkdtemp(join(tmpdir(), 'eduboard-modes-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)));
const application = await electron.launch({ executablePath: process.env.EDUBOARD_SMOKE_EXE || require('electron'), args: process.env.EDUBOARD_SMOKE_EXE ? [] : ['.'], cwd: process.cwd(), env: { ...env, EDUBOARD_USER_DATA: join(root, 'profile'), ARDUINO_CLI_PATH: join(root, 'missing-cli.exe') } });
try {
  const page = await application.firstWindow(); const errors = []; const remote = [];
  await page.setViewportSize({ width: 1280, height: 820 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
  await page.context().setOffline(true);
  await page.locator('.monaco-editor').waitFor();
  const savedPath = join(root, 'ThreeModes', 'ThreeModes.eduboard.json');
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    dialog.showMessageBoxSync = () => 1;
  }, savedPath);
  const ready = () => page.getByRole('status').filter({ hasText: '准备就绪' }).waitFor();
  async function switchTo(name) { await page.getByRole('button', { name, exact: true }).click(); await ready(); }
  async function showEnd() { await page.locator('.monaco-editor textarea').first().focus(); await page.keyboard.press('ControlOrMeta+End'); }
  async function edit(code) {
    await page.locator('.monaco-editor textarea').first().focus();
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code);
    await page.getByText('有未保存更改', { exact: true }).waitFor();
  }
  const cpp = '// C++ preserved\nvoid setup() {}\nvoid loop() {}\n';
  const python = '# Python preserved\nprint("independent draft")\n';
  await edit(cpp); await switchTo('Python'); await edit(python);
  await switchTo('C++'); await page.locator('.view-lines').filter({ hasText: 'C++ preserved' }).waitFor();
  await switchTo('图形化'); await page.locator('.blocklySvg').waitFor();
  await page.locator('.blocklyText').filter({ hasText: /^1000$/ }).first().click();
  await page.locator('.blocklyHtmlInput').fill('500'); await page.locator('.blocklyHtmlInput').press('Enter');
  await page.getByRole('combobox', { name: '积木生成语言' }).selectOption('micropython'); await ready();
  await showEnd();
  await page.locator('.code-pane .view-lines').filter({ hasText: 'time.sleep_ms(500)' }).waitFor();
  await page.getByRole('button', { name: '采用生成代码', exact: true }).click();
  await page.getByRole('dialog').waitFor(); await page.getByRole('button', { name: '取消', exact: true }).click(); await ready();
  await switchTo('Python'); await page.locator('.view-lines').filter({ hasText: 'Python preserved' }).waitFor();
  await switchTo('C++'); await page.getByRole('button', { name: '保存', exact: true }).click(); await ready();
  const document = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.equal(document.source, cpp); assert.deepEqual(document.drafts, { arduino: cpp, micropython: python });
  assert.equal(document.mode, 'text'); assert.equal(document.blockTarget, 'micropython'); assert.ok(document.workspace);
  assert.equal(document.microBoard, 'esp32');
  await page.getByRole('button', { name: '新建', exact: true }).click(); await ready();
  await page.getByRole('button', { name: '打开', exact: true }).click(); await ready();
  await page.locator('.view-lines').filter({ hasText: 'C++ preserved' }).waitFor();
  await switchTo('Python'); await page.locator('.view-lines').filter({ hasText: 'Python preserved' }).waitFor();
  await switchTo('图形化'); await page.locator('.blocklyText').filter({ hasText: /^500$/ }).first().waitFor();
  await ready(); assert.equal(await page.getByText('有未保存更改', { exact: true }).count(), 0, 'Switching saved modes must not mark code dirty');
  await page.getByRole('combobox', { name: '积木生成语言' }).selectOption('arduino'); await ready();
  await showEnd();
  await page.locator('.code-pane .view-lines').filter({ hasText: 'delay(500)' }).waitFor();
  await switchTo('C++'); await page.locator('.view-lines').filter({ hasText: 'C++ preserved' }).waitFor();
  await page.getByRole('button', { name: '从积木更新代码', exact: true }).click();
  await page.getByRole('dialog').filter({ hasText: '替换文本代码？' }).waitFor(); await page.getByRole('button', { name: '替换代码', exact: true }).click(); await ready();
  await showEnd();
  await page.locator('.code-pane .view-lines').filter({ hasText: 'delay(500)' }).waitFor();
  await switchTo('Python'); await page.locator('.view-lines').filter({ hasText: 'Python preserved' }).waitFor();
  await page.getByRole('button', { name: '保存', exact: true }).click(); await ready();
  const adopted = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.match(adopted.drafts.arduino, /delay\(500\)/); assert.equal(adopted.drafts.micropython, python);
  await mkdir(resolve('output/playwright'), { recursive: true }); await page.screenshot({ path: resolve('output/playwright/three-modes.png') });
  const oled = JSON.parse(await readFile(resolve('examples/Lesson_sh1106/Lesson_sh1106.eduboard.json'), 'utf8'));
  const brokenPath = join(root, 'RepairBlocks', 'RepairBlocks.eduboard.json');
  await mkdir(join(root, 'RepairBlocks'));
  await writeFile(brokenPath, JSON.stringify({ ...oled, mode: 'text', blockTarget: 'micropython', drafts: { arduino: oled.source, micropython: null } }));
  await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, brokenPath);
  await page.getByRole('button', { name: '打开', exact: true }).click(); await ready();
  await switchTo('图形化'); await page.getByRole('alert').filter({ hasText: 'SH1106' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '运行到设备', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await ready();
  const repair = JSON.parse(await readFile(brokenPath, 'utf8')); assert.equal(repair.mode, 'blocks'); assert.ok(repair.workspace);
  await switchTo('C++'); await switchTo('图形化'); await page.getByRole('alert').filter({ hasText: 'SH1106' }).waitFor();
  await page.getByRole('combobox', { name: '积木生成语言' }).selectOption('arduino'); await ready();
  await page.locator('.code-pane .view-lines').filter({ hasText: 'Generated by EduBoard IDE' }).waitFor();
  assert.equal(await page.locator('.block-message[role="alert"]').count(), 0, 'Changing generation target recovers the retained layout');
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  console.log('PASS three modes: independent drafts, retained blocks, both generators, overwrite confirmation, save/reopen, generation-error repair and offline UI.');
} catch (error) {
  await mkdir(resolve('output/playwright'), { recursive: true });
  await (await application.firstWindow()).screenshot({ path: resolve('output/playwright/three-modes-failure.png') }).catch(() => {});
  throw error;
} finally { await closeSmoke(application); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
