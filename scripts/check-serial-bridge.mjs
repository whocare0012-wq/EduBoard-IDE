// SPDX-License-Identifier: GPL-3.0-only
// Exercises the real Python bridge against pyserial's in-memory loop:// transport.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { resolve } from 'node:path';
const helper = resolve('apps/desktop/resources/tool_bridge.py');
const bootstrap = 'import sys,runpy,serial\noriginal=serial.serial_for_url\nserial.Serial=lambda **kwargs: original("loop://",do_not_open=True,**kwargs)\nsys.argv=[' + JSON.stringify(helper) + ',"repl","loop://"]\nrunpy.run_path(' + JSON.stringify(helper) + ',run_name="__main__")';
const child = spawn(process.env.EDUBOARD_PYTHON_PATH || 'python', ['-u', '-c', bootstrap], { windowsHide: true, stdio: 'pipe', env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
let output = ''; let error = '';
child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
child.stdout.on('data', text => { output += text; }); child.stderr.on('data', text => { error += text; });
async function until(expected) {
  const deadline = Date.now() + 10_000;
  while (!output.includes(expected)) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Serial bridge check failed: ' + error + ' / ' + output);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
try {
  await until('EDUBOARD_REPL_READY');
  child.stdin.write('print("中文回环")\r');
  await until('print("中文回环")\r');
  child.stdin.end();
  await new Promise((resolve, reject) => {
    child.once('close', code => code === 0 ? resolve() : reject(new Error(error)));
    setTimeout(() => reject(new Error('Bridge failed to release loop transport')), 5000).unref();
  });
  assert.equal(error, '');
  console.log('PASS real Python serial bridge: ready handshake, UTF-8 bidirectional pipe and clean EOF close using loop transport. No physical port was opened.');
} finally {
  if (child.exitCode === null && child.pid) {
    if (process.platform === 'win32') await new Promise(resolve => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve()));
    else child.kill();
  }
}
