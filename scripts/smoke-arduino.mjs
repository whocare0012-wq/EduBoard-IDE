// SPDX-License-Identifier: GPL-3.0-only
// Uses the real Arduino compiler. Never uploads or opens a physical serial port.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { closeSmoke } from './close-smoke.mjs';

if (!process.env.ARDUINO_CLI_PATH) throw new Error('Set ARDUINO_CLI_PATH to the separately installed real CLI.');
const require = createRequire(import.meta.url);
const temp = await mkdtemp(join(tmpdir(), 'eduboard-real-compile-'));
const sketchPath = join(temp, 'Blink', 'Blink.ino');
await mkdir(join(temp, 'Blink'));
await writeFile(sketchPath, await readFile(resolve('examples/Blink/Blink.ino'), 'utf8'));
const environment = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE' && key !== 'ELECTRON_RENDERER_URL'));
const application = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...environment, EDUBOARD_USER_DATA: join(temp, 'profile') }, timeout: 60_000 });
try {
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.context().setOffline(true);
  await page.locator('.monaco-editor').waitFor();
  const boards = await page.evaluate(() => window.eduboard.boards());
  assert.equal(boards.ok, true, boards.stderr);
  assert.ok(boards.boards.some(board => board.fqbn === 'esp32:esp32:esp32'));
  const ports = await page.evaluate(() => window.eduboard.ports());
  assert.equal(ports.ok, true, ports.stderr);
  await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, sketchPath);
  await page.getByRole('button', { name: '打开', exact: true }).click();
  await page.getByText('已保存', { exact: true }).waitFor();
  await page.getByRole('button', { name: '编译', exact: true }).click();
  console.log('Real ESP32 Blink compilation started through desktop UI.');
  await page.locator('.console').filter({ hasText: '[编译] 成功' }).waitFor({ timeout: 600_000 });
  const output = await page.locator('.console').innerText();
  assert.match(output, /Sketch uses|程序使用/);
  await mkdir(resolve('output/playwright'), { recursive: true });
  await page.screenshot({ path: resolve('output/playwright/arduino-compile.png') });
  const invalid = '// Real compiler diagnostic check\n// 中文 path/source is supported\n\nvoid setup() {\n  BROKEN_CPP;\n}\nvoid loop() {}\n';
  const editor = page.locator('.monaco-editor textarea').first();
  await editor.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(invalid);
  await page.getByRole('button', { name: '编译', exact: true }).click();
  const diagnostic = page.locator('.diagnostic-link').filter({ hasText: 'BROKEN_CPP' });
  await diagnostic.waitFor({ timeout: 600_000 });
  await page.getByRole('status').filter({ hasText: '准备就绪' }).waitFor();
  assert.match(await diagnostic.getAttribute('title'), /第 5 行，第 3 列/);
  const failed = await page.locator('.console').innerText();
  assert.equal(failed.split('\n').filter(line => /: error:.*BROKEN_CPP/.test(line)).length, 1, 'Real GCC diagnostic is streamed once');
  // Monaco retains the opened file's EOL and may apply its native multi-line indentation.
  const checked = await readFile(sketchPath, 'utf8');
  await editor.focus(); await page.keyboard.press('ControlOrMeta+Home'); await diagnostic.click();
  await page.locator('.monaco-editor .squiggly-error').first().waitFor();
  await page.waitForFunction(() => document.activeElement === document.querySelector('.monaco-editor textarea'));
  await page.screenshot({ path: resolve('output/playwright/arduino-diagnostic.png') });
  await page.keyboard.insertText('X');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '准备就绪' }).waitFor();
  const withoutAutoWhitespace = value => value.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
  assert.equal(withoutAutoWhitespace(await readFile(sketchPath, 'utf8')), withoutAutoWhitespace(checked.replace('BROKEN_CPP', 'XBROKEN_CPP')), 'Real GCC error link selects its actual source position');
  assert.equal(await page.locator('.diagnostic-link').count(), 0);
  assert.equal(await page.locator('.monaco-editor .squiggly-error').count(), 0);
  await editor.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(await readFile(resolve('examples/Blink/Blink.ino'), 'utf8'));
  await page.getByRole('button', { name: '编译', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.console')?.textContent?.split('[编译] 成功').length === 3, undefined, { timeout: 600_000 });
  console.log('PASS real Arduino CLI: installed boards/ports, Blink compile, actual GCC error marker/link/one-copy output, edit cleanup and repaired compile. Hardware upload and serial acceptance remain pending.');
} finally {
  await closeSmoke(application);
  await rm(temp, { recursive: true, force: true });
}
