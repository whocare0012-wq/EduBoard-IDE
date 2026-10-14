// SPDX-License-Identifier: GPL-3.0-only
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, parse, resolve } from 'node:path';
import type { Sketch } from '../shared/types';
import { validateProject, type ProjectDocument } from '../shared/project-format';

export const MAX_SOURCE_BYTES = 1_000_000;

export function validateSource(source: unknown): string {
  if (typeof source !== 'string' || Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new Error('程序必须是小于 1 MB 的文本 / Source must be smaller than 1 MB.');
  }
  return source;
}

export function validateSketchName(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(name) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(name)) {
    throw new Error('项目名须以字母或下划线开头，仅含字母、数字、下划线和短横线，最多 63 字符。');
  }
  return name;
}

export function normalizeSketchPath(selectedPath: string): string {
  const chosen = extname(selectedPath).toLowerCase() === '.ino' ? selectedPath : selectedPath + '.ino';
  const name = validateSketchName(parse(chosen).name);
  const parent = dirname(resolve(chosen));
  const folder = basename(parent) === name ? parent : join(parent, name);
  return join(folder, name + '.ino');
}

export function assertSketchPath(filePath: string): void {
  const name = validateSketchName(parse(filePath).name);
  if (extname(filePath).toLowerCase() !== '.ino' || basename(dirname(filePath)) !== name) {
    throw new Error('Arduino 项目须使用同名文件夹，例如 Blink/Blink.ino，请整理文件后重新打开。');
  }
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = join(dirname(filePath), '.' + basename(filePath) + '.' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, filePath);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function readSketch(filePath: string): Promise<Sketch> {
  assertSketchPath(filePath);
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SOURCE_BYTES) {
    throw new Error('只能打开小于 1 MB 的普通 Arduino 文件。');
  }
  const source = validateSource(await readFile(filePath, 'utf8'));
  return { filePath, name: basename(filePath), source };
}

export async function writeSketch(filePath: string, source: unknown): Promise<Sketch> {
  assertSketchPath(filePath);
  const safeSource = validateSource(source);
  await atomicWrite(filePath, safeSource);
  return { filePath, name: basename(filePath), source: safeSource };
}

export function normalizeProjectPath(selectedPath: string): string {
  const name = validateSketchName(basename(selectedPath).replace(/\.eduboard\.json$/i, '').replace(/\.(ino|json|py)$/i, ''));
  const parent = dirname(resolve(selectedPath));
  const folder = basename(parent) === name ? parent : join(parent, name);
  return join(folder, name + '.eduboard.json');
}

export function projectSourcePath(projectPath: string, language: ProjectDocument['language']): string {
  const name = basename(projectPath).replace(/\.eduboard\.json$/i, '');
  validateSketchName(name);
  if (basename(dirname(projectPath)) !== name) throw new Error('项目文件须放在同名文件夹中，例如 Blink/Blink.eduboard.json。');
  return join(dirname(projectPath), language === 'arduino' ? name + '.ino' : 'main.py');
}

export async function readProject(projectPath: string): Promise<Sketch> {
  const info = await lstat(projectPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4_000_000) throw new Error('项目须为小于 4 MB 的普通文件。');
  const document = validateProject(JSON.parse(await readFile(projectPath, 'utf8')));
  return { filePath: projectSourcePath(projectPath, document.language), name: basename(projectPath), source: document.source, document, projectPath };
}

export async function writeProject(projectPath: string, value: unknown): Promise<Sketch> {
  const document = validateProject(value);
  const sourcePath = projectSourcePath(projectPath, document.language);
  const encoded = JSON.stringify(document, null, 2) + '\n';
  if (Buffer.byteLength(encoded, 'utf8') > 4_000_000) throw new Error('项目保存文件须小于 4 MB。');
  // JSON is the authoritative project. Its source is also exported for external compilers.
  await atomicWrite(sourcePath, document.source);
  await atomicWrite(projectPath, encoded);
  return { filePath: sourcePath, name: basename(projectPath), source: document.source, document, projectPath };
}
