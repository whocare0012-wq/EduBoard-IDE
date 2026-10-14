// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import * as Blockly from 'blockly/core';
import { MICRO_BOARDS, type MicroBoard } from '../../apps/desktop/src/shared/boards';
import { registerBlocks } from '../../apps/desktop/src/shared/blocks/definitions';
import { TEMPLATES } from '../../apps/desktop/src/shared/blocks/templates';
import { generateMicroPython } from '../../apps/desktop/src/shared/blocks/python-generator';
import { MicroPythonService, validateProbe, validateRemotePath, verifyFirmware } from '../../apps/desktop/src/main/micropython';
import { CommandRunner, SerialSession } from '../../apps/desktop/src/main/processes';

registerBlocks();
test('MicroPython generates GPIO, condition, delay, DHT and NeoPixel workflows', () => {
  for (const template of TEMPLATES) {
    const workspace = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(template.createWorkspace(), workspace);
      if (template.id === 'sh1106') { assert.throws(() => generateMicroPython(workspace), /SH1106/); continue; }
      const generated = generateMicroPython(workspace);
      assert.match(generated.code, /from machine import Pin, ADC/);
      assert.match(generated.code, /while True:/);
      assert.deepEqual(generated.warnings, []);
      if (template.id === 'dht11') assert.match(generated.code, /ticks_diff\(now, eduDhtTime_4\) >= 2000/);
    } finally { workspace.dispose(); }
  }
});

test('rejects remote traversal and firmware/chip/flash/security mismatches', () => {
  assert.equal(validateRemotePath('/lib/app.py'), '/lib/app.py');
  for (const value of ['/', '../main.py', '/a/../main.py', '/a//main.py', '/main.py\n', '/--flag;echo', '/中文.py']) assert.throws(() => validateRemotePath(value));
  const board = MICRO_BOARDS[0];
  assert.throws(() => verifyFirmware(Buffer.alloc(32), board));
  const info = { chip: 'esp32', description: 'fixture', revision: 3, features: ['Dual Core'], flashBytes: 4 * 1024 * 1024, secureBoot: false, flashEncryption: false };
  assert.equal(validateProbe(info, board).chip, 'esp32');
  assert.throws(() => validateProbe({ ...info, chip: 'esp32c3' }, board));
  assert.throws(() => validateProbe({ ...info, flashBytes: 1_000_000 }, board));
  assert.throws(() => validateProbe({ ...info, secureBoot: true }, board));
  assert.throws(() => validateProbe({ ...info, features: ['Single Core'] }, board));
});

test('device operations release REPL; flashing uses validated immutable bytes and one-use tokens', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eduboard-python-'));
  const serial = new SerialSession(() => {}, () => {});
  const log = join(root, 'calls.jsonl');
  const fixture = resolve('tests/fixtures/fake-python.cjs');
  const bytes = Buffer.alloc(64); bytes[0] = 0xe9; bytes.writeUInt16LE(0, 12);
  const board: MicroBoard = { ...MICRO_BOARDS[0], sha256: createHash('sha256').update(bytes).digest('hex') };
  const info = { chip: 'esp32', description: 'fixture', revision: 3, features: ['Dual Core'], flashBytes: 4 * 1024 * 1024, secureBoot: false, flashEncryption: false };
  await writeFile(log + '.config', JSON.stringify(info));
  const service = new MicroPythonService(new CommandRunner(), serial, () => ({ executable: process.execPath, args: [fixture, '--fixture-log', log] }), 'bridge-fixture.py', join(root, 'staging'), id => { assert.equal(id, 'esp32'); return board; });
  try {
    const script = join(root, 'main.py'); await writeFile(script, 'print("hello")');
    assert.equal((await service.startRepl('COM3', 115200)).ok, true);
    assert.equal(serial.running, true);
    const listed = await service.list('COM3'); assert.equal(listed.ok, true); assert.equal(listed.files[0].name, 'main.py');
    assert.equal(serial.running, false);
    assert.equal((await service.upload(script, 'COM3', '/main.py')).ok, true);
    const downloaded = join(root, 'download.py'); assert.equal((await service.download('COM3', '/main.py', downloaded)).ok, true);
    assert.equal(await readFile(downloaded, 'utf8'), 'print("downloaded")\n');
    const firmware = join(root, 'firmware.bin'); await writeFile(firmware, bytes);
    const prepared = await service.prepare(firmware, 'esp32');
    await writeFile(log + '.config', JSON.stringify({ ...info, chip: 'esp32c3' }));
    await assert.rejects(service.flash(prepared.token, 'COM3'), /不匹配/);
    assert.equal((await readFile(log, 'utf8')).includes('write-flash'), false);
    await writeFile(log + '.config', JSON.stringify(info));
    await writeFile(firmware, Buffer.alloc(64));
    await assert.rejects(service.flash(prepared.token, 'COM3'), /固件/);
    await writeFile(firmware, bytes);
    const ready = await service.prepare(firmware, 'esp32');
    assert.equal((await service.flash(ready.token, 'COM3')).ok, true);
    await assert.rejects(service.flash(ready.token, 'COM3'), /重新选择/);
    const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]);
    const flash = calls.find(args => args.includes('write-flash'))!;
    assert.ok(flash.includes('--erase-all')); assert.ok(flash.includes('0x1000')); assert.equal(flash.includes('--force'), false);
  } finally { await serial.stop(); await rm(root, { recursive: true, force: true }); }
});
