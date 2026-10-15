// SPDX-License-Identifier: GPL-3.0-only
// Real offline Electron persistence/close events. Dialogs and failure paths use only this temp tree.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rename, rmdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { closeSmoke } from './close-smoke.mjs';

const require = createRequire(import.meta.url);
const root = await mkdtemp(join(tmpdir(), 'eduboard-unsaved-'));
const working = join(root, 'tools'); await mkdir(working);
await writeFile(join(working, 'version'), 'console.log("fixture CLI")');
await writeFile(join(working, 'core'), 'console.log(JSON.stringify({boards:[]}))');
await writeFile(join(working, 'board'), 'console.log(JSON.stringify({detected_ports:[]}))');
await writeFile(join(working, 'compile'), 'console.log("fixture busy task ready");setInterval(()=>{},1000)');
await writeFile(join(working, 'monitor'), 'console.log("fixture serial pid: " + process.pid);setInterval(()=>{},1000)');
const template = JSON.parse(await readFile(resolve('examples/Lesson_led/Lesson_led.eduboard.json'), 'utf8'));
const cpp = '// original C++\nvoid setup() {}\nvoid loop() {}\n';
const python = 'print("original Python")\n';
async function seed(name, source) {
  const folder = join(root, name); await mkdir(folder);
  const project = join(folder, name + '.eduboard.json');
  await writeFile(project, JSON.stringify({ ...template, language: 'arduino', mode: 'text', source,
    drafts: { arduino: source, micropython: python }, blockTarget: 'arduino', microBoard: 'esp32' }));
  await writeFile(join(folder, name + '.ino'), source);
  return project;
}
const projectA = await seed('ProjectA', cpp);
const projectB = await seed('ProjectB', '// target B\nvoid setup() {}\nvoid loop() {}\n');
const blockedParent = join(root, 'blocked'); await writeFile(blockedParent, 'A file cannot contain a project directory');
const environment = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)));
let profile = 0;
async function launch() {
  const application = await electron.launch({ executablePath: process.env.EDUBOARD_SMOKE_EXE || require('electron'), args: process.env.EDUBOARD_SMOKE_EXE ? [] : [resolve('.')], cwd: working,
    env: { ...environment, EDUBOARD_USER_DATA: join(root, 'profile-' + ++profile), ARDUINO_CLI_PATH: process.execPath, ARDUINO_CLI_CONFIG_FILE: '' } });
  const page = await application.firstWindow(); await page.setViewportSize({ width: 1280, height: 820 });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); await page.context().setOffline(true);
  await application.evaluate(({ dialog }) => {
    globalThis.unsavedSmoke = { saves: 0, opens: 0, saveMode: 'ok', openMode: 'ok', savePath: '', openPath: '', overwrite: 1 };
    dialog.showSaveDialog = async () => {
      const state = globalThis.unsavedSmoke; state.saves++;
      return { canceled: state.saveMode === 'cancel', filePath: state.savePath };
    };
    dialog.showOpenDialog = async () => {
      const state = globalThis.unsavedSmoke; state.opens++;
      return { canceled: state.openMode === 'cancel', filePaths: [state.openPath] };
    };
    dialog.showMessageBox = async () => ({ response: globalThis.unsavedSmoke.overwrite, checkboxChecked: false });
  });
  const native = options => application.evaluate((_electron, values) => Object.assign(globalThis.unsavedSmoke, values), options);
  const counts = () => application.evaluate(() => ({ saves: globalThis.unsavedSmoke.saves, opens: globalThis.unsavedSmoke.opens }));
  const ready = () => page.getByRole('status').filter({ hasText: /准备就绪|串口监视运行中/ }).waitFor();
  const input = () => page.locator('.monaco-editor textarea').first();
  const modal = () => page.getByRole('dialog', { name: '未保存的内容', exact: true });
  const settleModal = () => page.evaluate(() => Promise.all(Array.from(document.querySelector('.modal-backdrop')?.getAnimations({ subtree: true }) || []).map(animation => animation.finished.catch(() => {}))));
  async function edit(source) { await input().focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(source); await page.getByText('有未保存更改', { exact: true }).waitFor(); }
  async function switchTo(name) { await page.getByRole('button', { name, exact: true }).click(); await ready(); }
  async function open(path) { await native({ openPath: path, openMode: 'ok' }); await page.getByRole('button', { name: '打开', exact: true }).click(); await ready(); }
  const requestClose = (quit = false) => application.evaluate(({ app, BrowserWindow }, quit) => { if (quit) app.quit(); else BrowserWindow.getAllWindows()[0].close(); }, quit);
  async function saveContinue() { await modal().getByRole('button', { name: '保存后继续', exact: true }).click(); }
  await page.locator('.monaco-editor').waitFor();
  return { application, page, errors, native, counts, ready, input, modal, edit, switchTo, open, requestClose, saveContinue, settleModal };
}

let current;
try {
  current = await launch();
  const { application, page, errors, native, counts, ready, input, modal, edit, switchTo, open, requestClose, saveContinue, settleModal } = current;
  await assert.rejects(page.evaluate(() => window.eduboard.respondToClose('not-a-request', true)), /关闭请求已失效/);
  await open(projectA);
  const originalA = await readFile(projectA, 'utf8');
  const cppPending = '// 保存后继续 C++\nvoid setup() {}\nvoid loop() {}\n';
  const pyPending = 'print("保存后继续 Python")\n';
  await edit(cppPending); await switchTo('Python'); await edit(pyPending); await switchTo('图形化');
  await page.locator('.blocklyText').filter({ hasText: /^1000$/ }).first().click();
  await page.locator('.blocklyHtmlInput').fill('250'); await page.locator('.blocklyHtmlInput').press('Enter');
  await switchTo('C++');
  await page.getByRole('button', { name: '新建', exact: true }).click(); await modal().waitFor();
  assert.equal(await modal().getByRole('button').count(), 3);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '取消');
  await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), '保存后继续');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), '取消');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), '放弃更改并继续');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), '保存后继续');
  await mkdir(resolve('output/playwright'), { recursive: true });
  await settleModal();
  await page.screenshot({ path: resolve('output/playwright/unsaved-dialog.png') });
  await page.keyboard.press('Escape'); await ready();
  assert.equal(await readFile(projectA, 'utf8'), originalA);

  // Actual filesystem failure: an export target temporarily becomes an empty directory.
  const exportA = join(root, 'ProjectA', 'ProjectA.ino');
  await rename(exportA, exportA + '.backup'); await mkdir(exportA);
  try {
    await native({ opens: 0 });
    await page.getByRole('button', { name: '收起输出', exact: true }).click();
    await page.getByRole('button', { name: '打开', exact: true }).click(); await saveContinue();
    await page.locator('.console').filter({ hasText: '[错误]' }).waitFor(); await ready();
    await page.getByRole('button', { name: '收起输出', exact: true }).waitFor();
    assert.equal((await counts()).opens, 0, 'Failed save must not open another project');
    assert.equal(await readFile(projectA, 'utf8'), originalA);
    assert.match(await page.locator('.file').innerText(), /ProjectA/);
    await page.locator('.view-lines').filter({ hasText: '保存后继续 C++' }).waitFor();
    await page.getByText('有未保存更改', { exact: true }).waitFor();
  } finally { await rmdir(exportA); await rename(exportA + '.backup', exportA); }
  // Canceling an overwrite is also a canceled save, not permission to continue.
  await writeFile(exportA, '// external file'); await native({ overwrite: 0 });
  await page.getByRole('button', { name: '打开', exact: true }).click(); await saveContinue(); await ready();
  assert.equal((await counts()).opens, 0); assert.equal(await readFile(projectA, 'utf8'), originalA);
  await writeFile(exportA, cpp); await native({ overwrite: 1 });
  await page.getByRole('button', { name: '新建', exact: true }).click(); await saveContinue(); await ready();
  const savedA = JSON.parse(await readFile(projectA, 'utf8'));
  assert.deepEqual(savedA.drafts, { arduino: cppPending, micropython: pyPending });
  assert.match(JSON.stringify(savedA.workspace), /"MS":250/);
  assert.equal(savedA.source, cppPending); assert.equal(await page.locator('.file').innerText(), '未保存项目');
  console.log('PASS save-before-new: both drafts + blocks persisted; cancel, keyboard navigation, real save failure and canceled overwrite retain the project.');

  const untitled = '// keep untitled on canceled save\nvoid setup() {}\nvoid loop() {}\n';
  await edit(untitled); await native({ saveMode: 'cancel', opens: 0, saves: 0 });
  await page.getByRole('button', { name: '打开', exact: true }).click(); await saveContinue(); await ready();
  assert.deepEqual(await counts(), { saves: 1, opens: 0 });
  assert.equal(await page.locator('.file').innerText(), '未保存项目');
  await requestClose(); await saveContinue(); await ready();
  assert.equal((await counts()).saves, 2); assert.equal(page.isClosed(), false);
  await page.locator('.view-lines').filter({ hasText: 'keep untitled' }).waitFor();
  await native({ saveMode: 'ok', savePath: join(blockedParent, 'Fail.eduboard.json') });
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('button', { name: '新建', exact: true }).click(); await saveContinue();
  await page.locator('.console').filter({ hasText: '[错误]' }).waitFor(); await ready();
  assert.equal(await page.locator('.file').innerText(), '未保存项目'); await page.locator('.view-lines').filter({ hasText: 'keep untitled' }).waitFor();
  const untitledPath = join(root, 'UntitledSaved', 'UntitledSaved.eduboard.json');
  await native({ savePath: untitledPath, openMode: 'cancel' });
  await page.getByRole('button', { name: '打开', exact: true }).click(); await saveContinue(); await ready();
  assert.equal(JSON.parse(await readFile(untitledPath, 'utf8')).source, untitled);
  assert.match(await page.locator('.file').innerText(), /UntitledSaved/);
  const later = '// saved before open\nvoid setup() {}\nvoid loop() {}\n';
  await edit(later); await native({ openMode: 'ok', openPath: projectB });
  await page.getByRole('button', { name: '打开', exact: true }).click(); await saveContinue(); await ready();
  assert.equal(JSON.parse(await readFile(untitledPath, 'utf8')).source, later);
  await page.locator('.view-lines').filter({ hasText: 'target B' }).waitFor();
  console.log('PASS save-before-open: canceled/failed Save As stays untitled; successful save precedes open, canceled open keeps the saved project.');

  // A real, long-lived owned subprocess must survive a rejected quit request.
  await page.getByRole('button', { name: '编译', exact: true }).click();
  await page.locator('.console').filter({ hasText: 'fixture busy task ready' }).waitFor();
  await requestClose(true); await page.locator('.console').filter({ hasText: '请先完成或取消当前操作' }).waitFor();
  await page.getByRole('button', { name: '取消任务', exact: true }).waitFor();
  assert.equal(await modal().count(), 0); assert.equal(page.isClosed(), false);
  await page.getByRole('button', { name: '取消任务', exact: true }).click();
  await page.locator('.console').filter({ hasText: '任务已取消' }).waitFor(); await ready();
  const bPending = '// B saved before graphical new\nvoid setup() {}\nvoid loop() {}\n';
  await edit(bPending);
  await page.getByRole('button', { name: '新建图形化示例', exact: true }).click(); await saveContinue(); await ready();
  assert.equal(JSON.parse(await readFile(projectB, 'utf8')).source, bPending);
  await page.locator('.blocklySvg').waitFor();
  await page.locator('.blocklyText').filter({ hasText: /^1000$/ }).first().click();
  await page.locator('.blocklyHtmlInput').fill('400'); await page.locator('.blocklyHtmlInput').press('Enter');
  await page.getByLabel('Arduino FQBN').fill('esp32:esp32:esp32:FlashSize=4M');
  await page.getByLabel('串口', { exact: true }).fill('COM9999');
  await page.getByRole('button', { name: '打开串口', exact: true }).click(); await ready();
  await page.getByRole('button', { name: '关闭串口', exact: true }).waitFor();
  const serialPid = Number(/fixture serial pid: (\d+)/.exec(await page.locator('.console').innerText())?.[1]);
  assert.ok(serialPid > 0, 'Serial transport fixture is running without opening a real port');
  await page.evaluate(() => { window.eduboard.onCloseRequested(id => { window.lastCloseForSmoke = id; }); });
  await requestClose(); await modal().waitFor(); await requestClose();
  assert.equal(await modal().count(), 1, 'Repeated native close requests share one confirmation');
  const oldRequest = await page.evaluate(() => window.lastCloseForSmoke);
  assert.equal(typeof oldRequest, 'string');
  await modal().getByRole('button', { name: '取消', exact: true }).click(); await ready();
  assert.doesNotThrow(() => process.kill(serialPid, 0), 'Cancel close must keep the current serial session');
  await assert.rejects(page.evaluate(id => window.eduboard.respondToClose(id, true), oldRequest), /关闭请求已失效/);
  await native({ saveMode: 'cancel' }); await requestClose(true); await saveContinue(); await ready();
  assert.equal(page.isClosed(), false); await page.getByText('有未保存更改', { exact: true }).waitFor();
  assert.doesNotThrow(() => process.kill(serialPid, 0), 'Canceled save must not stop serial');
  await native({ saveMode: 'ok', savePath: join(blockedParent, 'Fail.eduboard.json') });
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await requestClose(); await saveContinue(); await page.locator('.console').filter({ hasText: '[错误]' }).waitFor(); await ready();
  assert.equal(page.isClosed(), false); await page.locator('.blocklyText').filter({ hasText: /^400$/ }).waitFor();
  assert.doesNotThrow(() => process.kill(serialPid, 0), 'Failed save must not stop serial');
  const blocksPath = join(root, 'BlocksSaved', 'BlocksSaved.eduboard.json');
  await native({ savePath: blocksPath }); await requestClose(true); await modal().waitFor();
  // A late listener/Strict Mode ready notification may redeliver the same native request.
  await page.evaluate(() => { window.closeRedeliveries = 0; window.eduboard.onCloseRequested(() => { window.closeRedeliveries++; }); });
  await page.waitForFunction(() => window.closeRedeliveries > 0);
  await settleModal();
  await page.screenshot({ path: resolve('output/playwright/unsaved-close.png') });
  const exited = application.waitForEvent('close', { timeout: 15_000 });
  const closed = page.waitForEvent('close'); await saveContinue(); await closed; await exited;
  assert.throws(() => process.kill(serialPid, 0), { code: 'ESRCH' }, 'Approved close waits for serial process exit');
  const blocksSaved = JSON.parse(await readFile(blocksPath, 'utf8'));
  assert.equal(blocksSaved.mode, 'blocks'); assert.equal(blocksSaved.fqbn, 'esp32:esp32:esp32:FlashSize=4M');
  assert.match(blocksSaved.source, /delay\(400\)/); assert.match(JSON.stringify(blocksSaved.workspace), /"MS":400/);
  assert.deepEqual(errors, []); await closeSmoke(application); current = null;
  console.log('PASS save-before-close/quit: cancel, failure, retry, repeated requests, token replay rejection, busy-task preservation, saved blocks + metadata and actual process close.');

  current = await launch(); await current.open(blocksPath); await current.page.locator('.blocklySvg').waitFor();
  await current.page.locator('.view-lines').filter({ hasText: 'Generated by EduBoard IDE' }).waitFor();
  const cleanExited = process.platform === 'darwin' ? Promise.resolve() : current.application.waitForEvent('close', { timeout: 15_000 });
  const cleanClosed = current.page.waitForEvent('close'); await current.requestClose(); await cleanClosed; await cleanExited;
  assert.deepEqual(current.errors, []); await closeSmoke(current.application); current = null;
  current = await launch(); await current.open(projectA);
  const beforeDiscard = await readFile(projectA, 'utf8'); await current.edit('// discard only on explicit choice\n');
  await current.requestClose(); await current.modal().waitFor();
  const discardExited = process.platform === 'darwin' ? Promise.resolve() : current.application.waitForEvent('close', { timeout: 15_000 });
  const discarded = current.page.waitForEvent('close');
  await current.modal().getByRole('button', { name: '放弃更改并继续', exact: true }).click(); await discarded; await discardExited;
  assert.equal(await readFile(projectA, 'utf8'), beforeDiscard);
  assert.deepEqual(current.errors, []); await closeSmoke(current.application); current = null;
  console.log('PASS clean close and explicit discard: saved graphical projects close without a prompt; discard never writes the project. No hardware.');
} catch (error) {
  if (current && !current.page.isClosed()) {
    await mkdir(resolve('output/playwright'), { recursive: true });
    await current.page.screenshot({ path: resolve('output/playwright/unsaved-failure.png') }).catch(() => {});
  }
  throw error;
} finally {
  if (current) await closeSmoke(current.application);
  assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.match(basename(root), /^eduboard-unsaved-/);
  await rm(resolve(root), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
