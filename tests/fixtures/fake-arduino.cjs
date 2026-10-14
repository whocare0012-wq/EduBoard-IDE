// SPDX-License-Identifier: GPL-3.0-only
// Transport fixture only. It does not represent a physical board or compiler.
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const logIndex = args.indexOf('--fixture-log');
if (logIndex >= 0) {
  fs.appendFileSync(args[logIndex + 1], JSON.stringify({ args: args.slice(logIndex + 2), pid: process.pid }) + '\n');
  args.splice(logIndex, 2);
}
if (args[0] === 'compile') {
  const source = fs.readFileSync(path.join(args.at(-1), path.basename(args.at(-1)) + '.ino'), 'utf8');
  if (source.includes('INVALID')) { console.error('fixture compile error'); process.exit(1); }
  const folder = args[args.indexOf('--build-path') + 1];
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'fixture.bin'), 'fixture');
  console.log('fixture compiled');
} else if (args[0] === 'upload') {
  console.log('fixture uploaded');
} else if (args[0] === 'monitor') {
  console.log('fixture serial ready');
  process.stdin.on('data', data => process.stdout.write(data));
  setInterval(() => {}, 1000);
} else process.exit(1);
