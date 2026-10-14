// SPDX-License-Identifier: GPL-3.0-only
// Uses the real Arduino compiler. Never uploads or opens a physical serial port.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

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
  console.log('PASS real Arduino CLI: installed board discovery, port JSON, ESP32 Blink compile from offline desktop. Hardware upload and serial acceptance remain pending.');
} finally {
  await application.close();
  await rm(temp, { recursive: true, force: true });
}
