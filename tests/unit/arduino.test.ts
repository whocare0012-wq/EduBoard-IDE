// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { ArduinoService, parseBoards, parsePorts, validateBaud, validateFqbn, validatePort } from '../../apps/desktop/src/main/arduino';
import { CommandRunner, SerialSession } from '../../apps/desktop/src/main/processes';
import { writeSketch } from '../../apps/desktop/src/main/projects';

test('accepts board menu targets and local ports, rejects injected or malformed arguments', () => {
  assert.equal(validateFqbn('esp32:esp32:esp32:FlashSize=4M,PartitionScheme=default'), 'esp32:esp32:esp32:FlashSize=4M,PartitionScheme=default');
  for (const value of ['xx', 'esp32:esp32', 'esp32:esp32:x;calc.exe', '--help']) assert.throws(() => validateFqbn(value));
  for (const value of ['COM0', 'COM3 & calc', '-p', '192.168.1.2']) assert.throws(() => validatePort(value));
  assert.equal(validatePort('COM3'), 'COM3');
  assert.equal(validateBaud(115200), 115200);
  assert.throws(() => validateBaud(0));
  assert.throws(() => parsePorts('{}'));
  assert.deepEqual(parsePorts('{"detected_ports":[{"port":{"address":"COM3","label":"USB","protocol":"serial"}},{"port":{"address":"host","protocol":"network"}}]}'), [{ address: 'COM3', label: 'USB' }]);
  assert.deepEqual(parseBoards('{"boards":[{"name":"ESP32","fqbn":"esp32:esp32:esp32"}]}'), [{ name: 'ESP32', fqbn: 'esp32:esp32:esp32' }]);
  assert.deepEqual(parseBoards('{"platforms":[{"installed_version":"3.3.12","releases":{"3.3.12":{"boards":[{"name":"ESP32","fqbn":"esp32:esp32:esp32"}]}}}]}'), [{ name: 'ESP32', fqbn: 'esp32:esp32:esp32' }]);
});

test('streams UTF-8 and treats shell metacharacters as a literal argument', async () => {
  let output = '';
  const runner = new CommandRunner(text => { output += text; });
  const value = '中文 & echo unsafe; $(calc)';
  const result = await runner.run(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', '--', value], { stream: true });
  assert.equal(result.ok, true);
  assert.equal(result.stdout, value);
  assert.equal(output, value);
  const unicode = await runner.run(process.execPath, ['-e', 'process.stdout.write(Buffer.from([0xe4]));setTimeout(()=>process.stdout.write(Buffer.from([0xb8,0xad])),20)']);
  assert.equal(unicode.stdout, '中');
});

test('cancellation and timeout close a child before another command can start', async () => {
  let ready: () => void = () => {};
  const started = new Promise<void>(resolve => { ready = resolve; });
  const runner = new CommandRunner(text => { if (text.includes('ready')) ready(); });
  const pending = runner.run(process.execPath, ['-e', 'console.log("ready");setInterval(()=>{},1000)'], { stream: true });
  await started;
  const busy = await runner.run(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(busy.ok, false);
  await runner.cancel();
  assert.equal((await pending).cancelled, true);
  assert.equal(runner.busy, false);
  const timeout = await runner.run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 100 });
  assert.equal(timeout.ok, false);
  assert.match(timeout.stderr, /超时/);
  assert.equal((await runner.run(process.execPath, ['-e', 'console.log("after")'])).ok, true);
});

test('upload uses the just-built artifact, rejects stale source, and stops serial first', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'eduboard-arduino-'));
  const serial = new SerialSession(() => {}, () => {});
  try {
    const path = join(temp, 'Blink', 'Blink.ino');
    const log = join(temp, 'calls.jsonl');
    await writeSketch(path, 'void setup() {}\nvoid loop() {}');
    const fixture = resolve('tests/fixtures/fake-arduino.cjs');
    const service = new ArduinoService(new CommandRunner(), serial, () => ({ executable: process.execPath, args: [fixture, '--fixture-log', log] }), join(temp, 'builds'));
    const fqbn = 'esp32:esp32:esp32';
    assert.equal((await service.upload(path, fqbn, 'COM3')).ok, false);
    assert.equal((await service.compile(path, fqbn)).ok, true);
    assert.equal((await serial.start(process.execPath, [fixture, '--fixture-log', log, 'monitor'])).ok, true);
    assert.equal(serial.running, true);
    assert.equal((await service.upload(path, fqbn, 'COM3')).ok, true);
    assert.equal(serial.running, false);
    const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.ok(calls.at(-1).args.includes('--input-dir'));
    await writeSketch(path, 'void setup() {}\nvoid loop() {} // changed');
    assert.equal((await service.upload(path, fqbn, 'COM3')).ok, false);
    await writeSketch(path, 'INVALID');
    assert.equal((await service.compile(path, fqbn)).ok, false);
    assert.equal((await service.upload(path, fqbn, 'COM3')).ok, false);
  } finally { await serial.stop(); await rm(temp, { recursive: true, force: true }); }
});

test('serial startup failure never reports a connected monitor', async () => {
  const states: boolean[] = [];
  const serial = new SerialSession(() => {}, state => states.push(state));
  const result = await serial.start(process.execPath, ['-e', 'console.error("port busy");process.exit(2)']);
  assert.equal(result.ok, false);
  assert.equal(serial.running, false);
  assert.equal(states.includes(true), false);
});
