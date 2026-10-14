// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { normalizeSketchPath, readSketch, validateSketchName, validateSource, writeSketch } from '../../apps/desktop/src/main/projects';

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
