// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parseDiagnostics } from '../../apps/desktop/src/main/diagnostics';
import { appendOutput, displayResult, outputLines } from '../../apps/desktop/src/shared/console-output';
import { CommandRunner } from '../../apps/desktop/src/main/processes';

test('locations handle drive letters, spaces, Unicode, colours and severities without basename guessing', () => {
  const file = 'D:\\我的项目 space\\Blink\\Blink.ino';
  const line = file + ':12:7: error: expected semicolon';
  const output = '\x1b[31m' + line + '\x1b[0m\r\n' + line + '\n'
    + 'd:/我的项目 space/Blink/Blink.ino:4: warning: unused variable\n'
    + file + ':2:1: note: declared here\n'
    + file + ':1:3: fatal error: missing header\n'
    + 'D:\\library\\Blink.ino:12:7: error: library failure\n'
    + 'Blink.ino:12:7: error: ambiguous relative file\n'
    + file + ':0:1: error: invalid line\n'
    + file + ':1:9999999999999999999999: error: invalid column\n';
  const diagnostics = parseDiagnostics(output, file);
  assert.equal(diagnostics.length, 4);
  assert.deepEqual(diagnostics.map(item => [item.line, item.column, item.severity]), [[12, 7, 'error'], [4, 1, 'warning'], [2, 1, 'info'], [1, 3, 'error']]);
  assert.equal(diagnostics[0].logLine, line);
  assert.equal(diagnostics[0].file, file);
  const posix = '/tmp/中文 folder/Sketch.ino';
  assert.equal(parseDiagnostics(posix + ':9:2: error: broken', posix)[0].line, 9);
  assert.equal(parseDiagnostics('other/main.py:3:4: error: invalid syntax', resolve('main.py')).length, 0);
  assert.equal(parseDiagnostics('main.py:3:4: error: invalid syntax', resolve('main.py'))[0].column, 4);
});

test('fragmented output keeps check identities, strips colours after assembly and bounds old logs', () => {
  let chunks = appendOutput([], '\x1b[3', 1);
  chunks = appendOutput(chunks, '1mfile.py:4:2: error: broken\x1b[0m\r', 1);
  chunks = appendOutput(chunks, '\n', 1);
  chunks = appendOutput(chunks, 'same message\nsame message\n');
  assert.deepEqual(outputLines(chunks).slice(0, 3), [
    { text: 'file.py:4:2: error: broken', runId: 1 }, { text: 'same message', runId: undefined }, { text: 'same message', runId: undefined }
  ], 'Serial telemetry is not deduplicated');
  assert.deepEqual(outputLines(appendOutput(appendOutput([], 'file.py:', 1), '4:2: error: interleaved', 2))[0], { text: 'file.py:4:2: error: interleaved', runId: undefined });
  chunks = appendOutput(chunks, 'x'.repeat(70_000), 2);
  assert.equal(chunks.reduce((size, chunk) => size + chunk.text.length, 0), 60_000);
  assert.equal(outputLines(chunks)[0].runId, 2);
});

test('streamed errors appear once and non-streamed reasons remain visible', async () => {
  let output = '';
  const runner = new CommandRunner(text => { output += text; });
  const result = await runner.run(process.execPath, ['-e', 'console.error("unique compile error");process.exit(1)'], { stream: true });
  const console = output + displayResult('编译', result);
  assert.equal(console.split('unique compile error').length - 1, 1);
  assert.match(console, /\[编译\] 失败/);
  const missing = await runner.run(resolve('nonexistent-tool.exe'), [], { stream: true });
  assert.match(displayResult('编译', missing), /未找到工具/);
  const timedOut = await runner.run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stream: true, timeout: 100 });
  assert.match(displayResult('编译', timedOut), /超时/);
  assert.match(displayResult('运行', { ...result, summary: 'REPL reconnect failed' }), /REPL reconnect failed/);
  assert.match(displayResult('检查', { ok: false, stdout: '', stderr: 'preflight failed' }), /preflight failed/);
});
