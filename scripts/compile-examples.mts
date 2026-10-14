// SPDX-License-Identifier: GPL-3.0-only
// Real compilation check, never uploads. Requires the pinned core and sensor libraries.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import Blockly from 'blockly/core';
import { registerBlocks } from '../apps/desktop/src/shared/blocks/definitions';
import { generateArduino } from '../apps/desktop/src/shared/blocks/arduino-generator';
import { TEMPLATES } from '../apps/desktop/src/shared/blocks/templates';
import { CommandRunner } from '../apps/desktop/src/main/processes';

const executable = process.env.ARDUINO_CLI_PATH;
assert.ok(executable, 'Set ARDUINO_CLI_PATH before compiling teaching examples.');
const config = process.env.ARDUINO_CLI_CONFIG_FILE ? ['--config-file', process.env.ARDUINO_CLI_CONFIG_FILE] : [];
registerBlocks();
const root = resolve('output/example-checks');
const results = [];
for (const template of TEMPLATES) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(template.createWorkspace(), workspace);
    const generated = generateArduino(workspace);
    const name = 'Lesson_' + template.id;
    const folder = join(root, name);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, name + '.ino'), generated.code);
    const result = await new CommandRunner().run(executable, [...config, 'compile', '--fqbn', 'esp32:esp32:esp32', '--build-path', join(root, 'build-' + template.id), folder]);
    await writeFile(join(root, template.id + '.log'), result.stdout + result.stderr);
    assert.equal(result.ok, true, template.name + ': ' + result.stderr);
    const summary = result.stdout.split('\n').filter(line => /Sketch uses|Global variables/.test(line)).join(' / ');
    results.push({ example: template.id, ok: true, summary });
    console.log('PASS real ESP32 compiler:', template.name, summary);
    // Keep generated source companions in the repository, not compiler artifacts.
    if (process.argv.includes('--write-examples')) {
      const example = resolve('examples', name);
      await mkdir(example, { recursive: true });
      await writeFile(join(example, name + '.ino'), generated.code);
      await writeFile(join(example, name + '.eduboard.json'), JSON.stringify({ format: 'eduboard-project', version: 1, language: 'arduino', mode: 'blocks', source: generated.code, fqbn: 'esp32:esp32:esp32', workspace: template.createWorkspace() }, null, 2) + '\n');
    }
  } finally { workspace.dispose(); }
}
await writeFile(join(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log('Hardware behavior remains pending. No board was flashed or uploaded.');
