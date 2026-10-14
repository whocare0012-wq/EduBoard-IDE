// SPDX-License-Identifier: GPL-3.0-only
// Deterministic transport fixture; it never contacts a serial port.
const fs = require('node:fs');
const args = process.argv.slice(2);
const log = args[1];
args.splice(0, 2);
fs.appendFileSync(log, JSON.stringify(args) + '\n');
const marker = args.indexOf('-u'); if (marker >= 0) args.splice(marker, 1);
if (args.includes('probe')) {
  const config = JSON.parse(fs.readFileSync(log + '.config', 'utf8'));
  console.log(JSON.stringify(config));
} else if (args.includes('repl')) {
  process.stdout.write('EDUBOARD_REPL_READY\nfixture REPL\n');
  process.stdin.on('data', data => process.stdout.write(data));
  setInterval(() => {}, 1000);
} else if (args.includes('check')) {
  console.log('Syntax OK');
} else if (args.includes('exec')) {
  console.log(JSON.stringify({ files: [{ name: 'main.py', size: 30, directory: false }], truncated: false }));
} else if (args.includes('cp') && args.at(-2).startsWith(':')) {
  fs.writeFileSync(args.at(-1), 'print("downloaded")\n');
  console.log('download fixture');
} else if (args.includes('write-flash') || args.includes('mpremote')) {
  console.log('fixture operation completed');
} else process.exit(1);
