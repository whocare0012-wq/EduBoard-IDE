// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const temp = await mkdtemp(join(tmpdir(), 'eduboard-desktop-'));
const screenshots = resolve('output/playwright');
await mkdir(screenshots, { recursive: true });
const environment = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE' && key !== 'ELECTRON_RENDERER_URL'));
const application = await electron.launch({
  executablePath: process.env.EDUBOARD_SMOKE_EXE || require('electron'),
  args: process.env.EDUBOARD_SMOKE_EXE ? [] : ['.'],
  cwd: process.cwd(),
  env: { ...environment, EDUBOARD_USER_DATA: join(temp, 'profile'), ARDUINO_CLI_PATH: process.env.ARDUINO_CLI_PATH || join(temp, 'missing-arduino-cli.exe') },
  timeout: 60_000
});
try {
  const page = await application.firstWindow();
  const errors = [];
  const remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await page.context().setOffline(true);
  await page.getByRole('button', { name: '保存', exact: true }).waitFor();
  await page.locator('.monaco-editor').waitFor({ timeout: 30_000 });
  assert.equal(await page.evaluate(() => typeof window.eduboard.saveSketch), 'function');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const preferences = await application.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  assert.deepEqual(preferences, { sandbox: true, contextIsolation: true, nodeIntegration: false });
  const selected = join(temp, '学生项目', 'Blink.ino');
  const expectedPath = join(temp, '学生项目', 'Blink', 'Blink.ino');
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, selected);
  const editor = page.locator('.monaco-editor textarea').first();
  const text = '// 离线编辑测试\nvoid setup() {}\nvoid loop() {}\n';
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await page.getByText('有未保存更改', { exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+S');
  await page.getByText('已保存', { exact: true }).waitFor();
  assert.equal(await readFile(expectedPath, 'utf8'), text);
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('// unsaved');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.ok((await page.locator('.file').innerText()).includes(expectedPath));
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
  }, expectedPath);
  await page.getByRole('button', { name: '打开', exact: true }).click();
  await page.getByRole('button', { name: '放弃更改并继续', exact: true }).click();
  await page.getByText('已保存', { exact: true }).waitFor();
  const diskText = await page.evaluate(() => window.eduboard.openSketch().then(sketch => sketch?.source));
  assert.equal(diskText, text);
  await page.getByRole('button', { name: '编译', exact: true }).click();
  await page.locator('.console').filter({ hasText: '[编译] 失败' }).waitFor();
  await page.screenshot({ path: join(screenshots, 'foundation.png') });
  assert.deepEqual(errors, [], 'Renderer must not have uncaught errors');
  assert.deepEqual(remoteRequests, [], 'Editor must not contact a CDN');
  console.log('PASS desktop: offline Monaco, isolated preload, Unicode save/reopen, unsaved protection, missing-tool diagnostics.');
} finally {
  await application.close();
  await rm(temp, { recursive: true, force: true });
}
