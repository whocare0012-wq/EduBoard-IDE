// SPDX-License-Identifier: GPL-3.0-only
// Real offline Electron checks. Dialogs point only at this check's temporary projects.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const root = await mkdtemp(join(tmpdir(), 'eduboard-workspace-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)));
const folder = join(root, 'History'); await mkdir(folder);
const project = join(folder, 'History.eduboard.json');
const cpp = Array.from({ length: 100 }, (_, index) => '// C++ viewport row ' + index).join('\n') + '\nvoid setup() {}\nvoid loop() {}\n';
const python = Array.from({ length: 100 }, (_, index) => '# Python viewport row ' + index).join('\n') + '\nprint("history base")\n';
await writeFile(project, JSON.stringify({ format: 'eduboard-project', version: 1, language: 'arduino', mode: 'text', source: cpp,
  fqbn: 'esp32:esp32:esp32', microBoard: 'esp32', workspace: null, blockTarget: 'arduino', drafts: { arduino: cpp, micropython: python } }));
await writeFile(join(folder, 'History.ino'), cpp);
const application = await electron.launch({ executablePath: process.env.EDUBOARD_SMOKE_EXE || require('electron'), args: process.env.EDUBOARD_SMOKE_EXE ? [] : ['.'], cwd: process.cwd(), env: { ...env, EDUBOARD_USER_DATA: join(root, 'profile'), ARDUINO_CLI_PATH: join(root, 'missing-cli.exe') } });
try {
  const page = await application.firstWindow(); const errors = []; const remote = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
  await page.context().setOffline(true);
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    dialog.showMessageBoxSync = () => 1;
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  }, project);
  const ready = () => page.getByRole('status').filter({ hasText: '准备就绪' }).waitFor();
  async function switchTo(name) { await page.getByRole('button', { name, exact: true }).click(); await ready(); }
  const editor = () => page.locator('.monaco-editor textarea').first();
  async function save() { await page.getByRole('button', { name: '保存', exact: true }).click(); await ready(); }
  const readProject = async () => JSON.parse(await readFile(project, 'utf8'));
  async function state() {
    // Observe the actual selection, visible caret and scrollbar without a production test API.
    return page.evaluate(() => {
      const input = document.querySelector('.monaco-editor textarea');
      const slider = document.querySelector('.monaco-editor .scrollbar.vertical .slider');
      return { start: input.selectionStart, end: input.selectionEnd,
        firstVisible: document.querySelector('.monaco-editor .view-line')?.textContent, scroll: slider?.style.top };
    });
  }
  async function settled() {
    await page.evaluate(() => new Promise(resolve => {
      let previous = ''; let frames = 0;
      function frame() {
        const input = document.querySelector('.monaco-editor textarea');
        const slider = document.querySelector('.monaco-editor .scrollbar.vertical .slider');
        const current = JSON.stringify([input?.selectionStart, input?.selectionEnd, slider?.style.top, document.querySelector('.monaco-editor .view-line')?.textContent]);
        frames = previous === current ? frames + 1 : 0; previous = current;
        if (frames >= 8) resolve(); else requestAnimationFrame(frame);
      }
      frame();
    }));
  }
  async function assertState(expected, label) { await settled(); assert.deepEqual(await state(), expected, label); }
  await page.locator('.monaco-editor').waitFor();
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 820));
  await page.getByRole('button', { name: '打开', exact: true }).click(); await ready();
  await editor().focus(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText('// CPP undo sentinel');
  await page.locator('.view-lines').filter({ hasText: 'CPP undo sentinel' }).waitFor();
  await page.keyboard.press('Shift+ArrowLeft'); await page.keyboard.press('Shift+ArrowLeft'); await settled();
  const cppState = await state(); assert.notEqual(cppState.start, cppState.end);
  await switchTo('Python'); await editor().focus(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText('# Python undo sentinel');
  await page.locator('.view-lines').filter({ hasText: 'Python undo sentinel' }).waitFor();
  await page.keyboard.press('Shift+ArrowLeft'); await settled();
  const pythonState = await state();
  await switchTo('图形化'); await page.locator('.blocklySvg').waitFor();
  await switchTo('C++'); await editor().focus(); await assertState(cppState, 'C++ selection, caret and scroll survive text/preview switching');
  const cppEdited = cpp + '// CPP undo sentinel';
  await page.keyboard.press('ControlOrMeta+Z'); await save(); assert.notEqual((await readProject()).drafts.arduino, cppEdited, 'Undo remains available after switching');
  await editor().focus(); await page.keyboard.press('ControlOrMeta+Y'); await save(); assert.equal((await readProject()).drafts.arduino, cppEdited);
  // Monaco may group typed words into separate undo entries; preserve that native behavior.
  for (let index = 0; index < 8 && (await readProject()).drafts.arduino !== cpp; index++) {
    await editor().focus(); await page.keyboard.press('ControlOrMeta+Z'); await save();
  }
  assert.equal((await readProject()).drafts.arduino, cpp);
  await switchTo('Python'); await editor().focus(); await assertState(pythonState, 'Python owns an independent cursor and selection');
  await page.keyboard.press('ControlOrMeta+Z'); await save();
  assert.notEqual((await readProject()).drafts.micropython, python + '# Python undo sentinel');
  for (let index = 0; index < 8 && (await readProject()).drafts.micropython !== python; index++) {
    await editor().focus(); await page.keyboard.press('ControlOrMeta+Z'); await save();
  }
  assert.deepEqual((await readProject()).drafts, { arduino: cpp, micropython: python });
  await switchTo('C++'); await page.getByRole('button', { name: '从积木更新代码', exact: true }).click();
  await page.getByRole('dialog').waitFor(); await page.getByRole('button', { name: '替换代码', exact: true }).click(); await ready();
  await editor().focus(); await page.keyboard.press('ControlOrMeta+Z'); await settled(); await save();
  assert.equal((await readProject()).drafts.arduino, cpp, 'Adoption is undoable and never replaces the Python model');
  await application.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, join(root, 'Fresh.eduboard.json'));
  await page.getByRole('button', { name: '新建', exact: true }).click(); await ready();
  await editor().focus(); await page.keyboard.press('ControlOrMeta+Z'); await save();
  assert.match(await readFile(join(root, 'Fresh', 'Fresh.ino'), 'utf8'), /ESP32 Blink/);
  await page.getByRole('button', { name: '打开', exact: true }).click(); await ready();
  await editor().focus(); await page.keyboard.press('ControlOrMeta+Y'); await save();
  assert.equal((await readProject()).drafts.arduino, cpp, 'New/open project sessions do not reuse old undo stacks');

  await switchTo('Python'); await page.getByRole('combobox', { name: '固件 / 板型' }).selectOption('esp32c3');
  await page.getByRole('button', { name: '新建图形化示例', exact: true }).click();
  await page.getByRole('dialog').waitFor(); await page.getByRole('button', { name: '放弃更改并继续', exact: true }).click(); await ready();
  await page.locator('.blocklySvg').waitFor();
  await page.getByText('接线说明', { exact: true }).click();
  assert.match(await page.locator('.wiring').innerText(), /GPIO3/);
  assert.doesNotMatch(await page.locator('.wiring').innerText(), /GPIO2\b|经典 ESP32/);
  await application.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, join(root, 'C3Led.eduboard.json'));
  await save();
  assert.match(JSON.parse(await readFile(join(root, 'C3Led', 'C3Led.eduboard.json'), 'utf8')).source, /eduPin_3/);
  await page.getByRole('combobox', { name: '示例', exact: true }).selectOption('button');
  await page.getByRole('button', { name: '新建图形化示例', exact: true }).click(); await ready();
  assert.match(await page.locator('.wiring').innerText(), /GPIO5/); assert.match(await page.locator('.wiring').innerText(), /GPIO3/);
  await application.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, join(root, 'C3Button.eduboard.json'));
  await save();
  assert.match(JSON.parse(await readFile(join(root, 'C3Button', 'C3Button.eduboard.json'), 'utf8')).source, /eduPin_5.init\(Pin.IN, Pin.PULL_UP\)/);

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(860, 600));
  await page.getByRole('button', { name: '显示代码预览', exact: true }).waitFor();
  assert.equal(await page.locator('.code-pane').isVisible(), false, 'Narrow workspaces hide preview automatically');
  const narrowEditor = await page.locator('.editor').boundingBox(); const narrowOutput = await page.locator('.output').boundingBox();
  assert.ok(narrowEditor.height > 260); assert.ok(narrowOutput.height < 160);
  const header = await page.locator('.console-header').boundingBox(); const title = await page.locator('.console-title').boundingBox();
  assert.ok(title.y >= header.y && title.y + title.height <= header.y + header.height, 'REPL title stays inside its toolbar');
  for (const control of await page.locator('.console-header button,.console-header select').all()) {
    const rect = await control.boundingBox(); assert.ok(rect.x >= header.x && rect.x + rect.width <= header.x + header.width + 1);
  }
  await mkdir(resolve('output/playwright'), { recursive: true }); await page.screenshot({ path: resolve('output/playwright/workspace-narrow.png') });
  await page.getByRole('button', { name: '收起输出', exact: true }).click();
  assert.equal((await page.locator('.output').boundingBox()).height, 36);
  assert.ok((await page.locator('.editor').boundingBox()).height > narrowEditor.height + 70);
  await page.getByRole('button', { name: '显示代码预览', exact: true }).click();
  const divider = page.getByRole('separator', { name: '调整代码预览宽度' });
  const firstWidth = (await page.locator('.code-pane').boundingBox()).width;
  await divider.focus(); await page.keyboard.press('ArrowLeft');
  assert.ok((await page.locator('.code-pane').boundingBox()).width > firstWidth + 15);
  const beforeDrag = (await page.locator('.code-pane').boundingBox()).width; const split = await divider.boundingBox();
  await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2); await page.mouse.down();
  await page.mouse.move(split.x + 30, split.y + split.height / 2, { steps: 5 }); await page.mouse.up();
  assert.ok((await page.locator('.code-pane').boundingBox()).width < beforeDrag - 10, 'Pointer dragging changes preview width');
  await page.getByRole('button', { name: '展开输出', exact: true }).click();
  const heightDivider = page.getByRole('separator', { name: '调整输出高度' });
  const firstHeight = (await page.locator('.output').boundingBox()).height;
  await heightDivider.focus(); await page.keyboard.press('ArrowUp');
  assert.ok((await page.locator('.output').boundingBox()).height > firstHeight + 10);
  const heightSplit = await heightDivider.boundingBox();
  await page.mouse.move(heightSplit.x + 50, heightSplit.y + 3); await page.mouse.down();
  await page.mouse.move(heightSplit.x + 50, heightSplit.y - 20, { steps: 5 }); await page.mouse.up();
  assert.ok((await page.locator('.output').boundingBox()).height > firstHeight + 25);
  await heightDivider.dblclick(); assert.ok((await page.locator('.output').boundingBox()).height < 160);
  await divider.dblclick(); await page.getByRole('button', { name: '显示代码预览', exact: true }).waitFor();
  assert.equal(await page.getByText('有未保存更改', { exact: true }).count(), 0, 'Layout changes do not modify the project');
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 820));
  await page.getByRole('button', { name: '隐藏代码预览', exact: true }).waitFor();
  await page.screenshot({ path: resolve('output/playwright/workspace-wide.png') });
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  console.log('PASS workspace: independent cursor/selection/scroll and undo/redo, undoable adoption, project-session isolation, C3 wiring, narrow layout, panel collapse and pointer/keyboard resize.');
} catch (error) {
  await mkdir(resolve('output/playwright'), { recursive: true });
  await (await application.firstWindow()).screenshot({ path: resolve('output/playwright/workspace-failure.png') }).catch(() => {});
  throw error;
} finally { await application.close(); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
