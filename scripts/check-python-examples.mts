// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import Blockly from 'blockly/core';
import { registerBlocks } from '../apps/desktop/src/shared/blocks/definitions';
import { TEMPLATES, microTemplate } from '../apps/desktop/src/shared/blocks/templates';
import { generateMicroPython } from '../apps/desktop/src/shared/blocks/python-generator';
import { CommandRunner } from '../apps/desktop/src/main/processes';
import { MICRO_BOARDS } from '../apps/desktop/src/shared/boards';
import { verifyFirmware } from '../apps/desktop/src/main/micropython';
import { readFile } from 'node:fs/promises';

registerBlocks();
const python = process.env.EDUBOARD_PYTHON_PATH || 'python';
const output = resolve('output/python-checks'); await mkdir(output, { recursive: true });
for (const board of MICRO_BOARDS) {
  for (const template of TEMPLATES.filter(item => item.id !== 'sh1106')) {
    const workspace = new Blockly.Workspace();
    try {
      const state = microTemplate(template, board.id);
      Blockly.serialization.workspaces.load(state, workspace);
      const code = generateMicroPython(workspace).code;
      const path = join(output, board.id + '-' + template.id + '.py'); await writeFile(path, code);
      const result = await new CommandRunner().run(python, [resolve('apps/desktop/resources/tool_bridge.py'), 'check', path]);
      assert.equal(result.ok, true, result.stderr);
      if (process.argv.includes('--write-examples') && board.id === 'esp32') {
        const name = 'Python_' + template.id; const directory = resolve('examples', name);
        await mkdir(directory, { recursive: true }); await writeFile(join(directory, 'main.py'), code);
        await writeFile(join(directory, name + '.eduboard.json'), JSON.stringify({ format: 'eduboard-project', version: 1, language: 'micropython', mode: 'blocks', fqbn: 'esp32:esp32:esp32', microBoard: board.id, source: code, workspace: state }, null, 2) + '\n');
      }
    } finally { workspace.dispose(); }
  }
}
console.log('PASS host Python syntax: four examples × four documented board/variant targets. Device modules still require hardware acceptance.');
if (process.env.EDUBOARD_FIRMWARE_DIR) {
  for (const board of MICRO_BOARDS) verifyFirmware(await readFile(join(process.env.EDUBOARD_FIRMWARE_DIR, board.filename)), board);
  console.log('PASS firmware metadata: all four real official images match pinned SHA-256, chip ID, size and flash offset.');
}
