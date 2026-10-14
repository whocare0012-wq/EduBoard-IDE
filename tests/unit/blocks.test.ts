// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Blockly from 'blockly/core';
import { registerBlocks } from '../../apps/desktop/src/shared/blocks/definitions';
import { cppString, generateArduino } from '../../apps/desktop/src/shared/blocks/arduino-generator';
import { TEMPLATES } from '../../apps/desktop/src/shared/blocks/templates';
import { validateProject, validateWorkspace } from '../../apps/desktop/src/shared/project-format';

registerBlocks();
test('all five teaching workspaces generate and round-trip through Blockly JSON', () => {
  for (const template of TEMPLATES) {
    const first = new Blockly.Workspace(); const second = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(validateWorkspace(template.createWorkspace()), first);
      const generated = generateArduino(first);
      assert.match(generated.code, /void setup\(\)/);
      assert.match(generated.code, /void loop\(\)/);
      assert.deepEqual(generated.warnings, []);
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(first), second);
      assert.equal(generateArduino(second).code, generated.code);
      if (template.id === 'button') assert.match(generated.code, /else/);
      if (template.id === 'dht11') assert.equal((generated.code.match(/DHT eduDht_4/g) || []).length, 1);
    } finally { first.dispose(); second.dispose(); }
  }
});

test('project validation rejects unknown formats, pollution, deep data and excessive block counts', () => {
  const valid = { format: 'eduboard-project', version: 1, language: 'arduino', mode: 'blocks', source: '', fqbn: 'esp32:esp32:esp32', workspace: TEMPLATES[0].createWorkspace() };
  assert.equal(validateProject(valid).mode, 'blocks');
  assert.throws(() => validateProject({ ...valid, version: 99 }));
  assert.throws(() => validateWorkspace(JSON.parse('{"blocks":{"__proto__":{"polluted":true}}}')));
  assert.throws(() => validateWorkspace({ blocks: { blocks: Array.from({ length: 1001 }, () => ({ type: 'edu_delay' })) } }));
  assert.throws(() => validateWorkspace({ arbitraryPlugin: {} }));
  assert.throws(() => validateWorkspace({ blocks: { blocks: [{ type: 'unknown' }] } }));
  assert.throws(() => validateWorkspace({ blocks: { blocks: 'bad' } }));
  assert.throws(() => validateWorkspace({ blocks: { blocks: [{ type: 'controls_if', extraState: { elseIfCount: 1000000 } }] } }));
  assert.equal(cppString('a"\\\n\u00001'), '"a\\"\\\\\\n\\0001"');
});

test('numeric variables and division generate valid C++ number semantics', () => {
  const workspace = new Blockly.Workspace();
  try {
    const state = { variables: [{ name: '分数', id: 'score' }], blocks: { languageVersion: 0, blocks: [{ type: 'edu_setup', inputs: { BODY: { block: { type: 'variables_set', fields: { VAR: { id: 'score' } }, inputs: { VALUE: { block: { type: 'math_arithmetic', fields: { OP: 'DIVIDE' }, inputs: { A: { block: { type: 'math_number', fields: { NUM: 7 } } }, B: { block: { type: 'math_number', fields: { NUM: 3 } } } } } } } } } } }] } };
    Blockly.serialization.workspaces.load(validateWorkspace(state), workspace);
    const generated = generateArduino(workspace).code;
    assert.match(generated, /7\.0 \/ 3\.0/);
    assert.match(generated, /double eduVar_/);
  } finally { workspace.dispose(); }
});

test('conflicting roots and invalid NeoPixel indices fail explicitly', () => {
  const workspace = new Blockly.Workspace();
  try {
    workspace.newBlock('edu_setup'); workspace.newBlock('edu_setup');
    assert.throws(() => generateArduino(workspace), /只能有一个/);
    workspace.clear();
    Blockly.serialization.workspaces.load(TEMPLATES.find(template => template.id === 'neopixel')!.createWorkspace(), workspace);
    workspace.getAllBlocks(false).find(block => block.type === 'edu_pixel')!.setFieldValue(20, 'INDEX');
    assert.throws(() => generateArduino(workspace), /序号/);
  } finally { workspace.dispose(); }
});
