// SPDX-License-Identifier: GPL-3.0-only
import { isAbsolute, resolve, win32 } from 'node:path';
import { plainOutput } from '../shared/diagnostics';
import type { SourceDiagnostic } from '../shared/types';

function sourcePath(path: string): string {
  // A drive letter / UNC prefix is a path, not the line-number delimiter.
  if (/^(?:[a-z]:[\\/]|\\\\)/i.test(path)) return win32.normalize(path).toLowerCase();
  const absolute = isAbsolute(path) ? resolve(path) : resolve(process.cwd(), path);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

/** Parse GCC-style locations, including the owned Python parser's equivalent output.
 * Never treat a matching basename in a library or generated build directory as the active file.
 */
export function parseDiagnostics(output: string, primaryFile: string): SourceDiagnostic[] {
  const diagnostics: SourceDiagnostic[] = [];
  const seen = new Set<string>();
  const expected = sourcePath(primaryFile);
  for (const logLine of plainOutput(output).split(/\r?\n/)) {
    const match = /^(.*?):(\d+)(?::(\d+))?:\s*(fatal error|error|warning|note):\s*(.+)$/.exec(logLine);
    if (!match || sourcePath(match[1]) !== expected) continue;
    const line = Number(match[2]); const column = Number(match[3] || 1);
    if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 1) continue;
    const severity = match[4] === 'warning' ? 'warning' : match[4] === 'note' ? 'info' : 'error';
    const message = match[5];
    const key = JSON.stringify([line, column, severity, message]);
    if (seen.has(key)) continue;
    seen.add(key);
    diagnostics.push({ file: primaryFile, line, column, severity, message, logLine });
    if (diagnostics.length === 500) break;
  }
  return diagnostics;
}
