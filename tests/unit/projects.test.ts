// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { defaultProjectName, exportNeedsConfirmation, normalizeProjectPath, normalizeSketchPath, projectPathForSource, readProject, readSketch, savedSourceFor, validateSketchName, validateSource, writeProject, writeSketch } from '../../apps/desktop/src/main/projects';
import { TEMPLATES } from '../../apps/desktop/src/shared/blocks/templates';

test('save creates a valid sketch and reopening preserves Unicode source', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'eduboard-project-'));
  try {
    const path = normalizeSketchPath(join(folder, 'Blink.ino'));
    const source = '// 中文教学\nvoid setup() {}\nvoid loop() {}\n';
    assert.equal(basename(dirname(path)), 'Blink');
    await writeSketch(path, source);
    assert.equal((await readSketch(path)).source, source);
    await writeSketch(path, source + '// saved twice');
    assert.equal(await readFile(path, 'utf8'), source + '// saved twice');
    assert.deepEqual(await readdir(dirname(path)), ['Blink.ino']);
    assert.equal(normalizeSketchPath(path), path);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('versioned project preserves blocks, source and target and exports a valid sketch', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'eduboard-format-'));
  try {
    const path = normalizeProjectPath(join(temp, 'Blink.json'));
    const document = { format: 'eduboard-project', version: 1, language: 'arduino', mode: 'blocks', fqbn: 'esp32:esp32:esp32', workspace: TEMPLATES[0].createWorkspace(), source: '// generated\nvoid setup() {}\nvoid loop() {}\n' };
    const saved = await writeProject(path, document);
    const reopened = await readProject(path);
    assert.deepEqual(reopened.document, document);
    assert.equal(await readFile(saved.filePath, 'utf8'), document.source);
    assert.deepEqual(await readdir(dirname(path)), ['Blink.eduboard.json', 'Blink.ino']);
    await assert.rejects(writeProject(path, { ...document, version: 99 }));
    assert.deepEqual((await readProject(path)).document, document);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('rejects unsafe names, oversized UTF-8 and invalid Arduino folder structure', async () => {
  for (const name of ['CON', 'COM1', '../x', 'a.b', '9blink', '中文', 'a'.repeat(64)]) {
    assert.throws(() => validateSketchName(name));
  }
  assert.throws(() => validateSource('中'.repeat(340_000)));
  assert.throws(() => validateSource({ source: 'not text' }));
  const folder = await mkdtemp(join(tmpdir(), 'eduboard-invalid-'));
  try {
    const path = join(folder, 'Blink.ino');
    await writeFile(path, 'void setup() {}');
    await assert.rejects(readSketch(path), /Blink\/Blink.ino/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('a blocks project that fails to generate keeps the last good source export', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'eduboard-repair-'));
  try {
    const path = normalizeProjectPath(join(temp, 'Repair.eduboard.json'));
    const good = '// generated\nvoid setup() {}\nvoid loop() {}\n';
    const document = { format: 'eduboard-project', version: 1, language: 'arduino', mode: 'blocks', fqbn: 'esp32:esp32:esp32', workspace: TEMPLATES[0].createWorkspace(), source: good } as const;
    const saved = await writeProject(path, document);
    await writeProject(path, { ...document, source: '' });
    assert.equal(await readFile(saved.filePath, 'utf8'), good);
    assert.equal((await readProject(path)).source, '');
    const fresh = normalizeProjectPath(join(temp, 'Broken.eduboard.json'));
    await writeProject(fresh, { ...document, source: '' });
    assert.deepEqual(await readdir(dirname(fresh)), ['Broken.eduboard.json']);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('export ownership and standalone source conversion pick explicit, safe paths', () => {
  const base = { format: 'eduboard-project', version: 1, fqbn: 'esp32:esp32:esp32', workspace: null } as const;
  const text = { ...base, language: 'arduino', mode: 'text', source: 'cpp', drafts: { arduino: 'cpp', micropython: 'py' } } as const;
  assert.equal(savedSourceFor(text, 'arduino'), 'cpp');
  assert.equal(savedSourceFor(text, 'micropython'), 'py');
  assert.equal(savedSourceFor({ ...base, language: 'arduino', mode: 'text', source: 'cpp' }, 'micropython'), null);
  assert.equal(savedSourceFor({ ...base, language: 'arduino', mode: 'blocks', source: '', workspace: TEMPLATES[0].createWorkspace() }, 'arduino'), null);
  const sketch = join(tmpdir(), 'Blink', 'Blink.ino');
  assert.equal(projectPathForSource(sketch), join(tmpdir(), 'Blink', 'Blink.eduboard.json'));
  assert.equal(projectPathForSource(join(tmpdir(), 'scripts', 'foo.py')), null);
  assert.equal(defaultProjectName(join(tmpdir(), 'foo.py'), 'PythonProject'), 'foo');
  for (const name of ['测试.py', '1st.py', 'my script.py']) assert.equal(defaultProjectName(join(tmpdir(), name), 'PythonProject'), 'PythonProject');
});

test('saving an open project asks before replacing an externally edited export', () => {
  const base = { format: 'eduboard-project', version: 1, fqbn: 'esp32:esp32:esp32', workspace: null } as const;
  const saved = { ...base, language: 'arduino', mode: 'text', source: 'cpp', drafts: { arduino: 'cpp', micropython: null } } as const;
  assert.equal(exportNeedsConfirmation('cpp', saved, 'arduino'), false);
  assert.equal(exportNeedsConfirmation('cpp // edited outside the IDE', saved, 'arduino'), true);
  assert.equal(exportNeedsConfirmation('print(1)', saved, 'micropython'), true);
  assert.equal(exportNeedsConfirmation('cpp', null, 'arduino'), true);
  const failed = { ...base, language: 'arduino', mode: 'blocks', source: '', workspace: TEMPLATES[0].createWorkspace() } as const;
  assert.equal(exportNeedsConfirmation('// last good export', failed, 'arduino'), false);
});
