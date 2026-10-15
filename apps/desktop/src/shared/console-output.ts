// SPDX-License-Identifier: GPL-3.0-only
import { plainOutput } from './diagnostics';
import type { CommandResult } from './types';

export interface OutputChunk { text: string; runId?: number; }
export interface OutputLine { text: string; runId?: number; }
const LIMIT = 60_000;

export function displayResult(action: string, result: CommandResult): string {
  return ['[' + action + '] ' + (result.ok ? '成功' : '失败'), result.streamed ? '' : result.stdout.trim(),
    (result.streamed ? result.summary : result.stderr)?.trim()].filter(Boolean).join('\n') + '\n';
}

/** Keep bounded raw output and its check identity, including across fragmented IPC chunks. */
export function appendOutput(previous: OutputChunk[], text: string, runId?: number, completeLine = false): OutputChunk[] {
  if (completeLine) text = (previous.length && !previous.at(-1)!.text.endsWith('\n') ? '\n' : '') + text.replace(/\n+$/, '') + '\n';
  if (!text) return previous;
  const chunks = [...previous, { text, runId }];
  let excess = chunks.reduce((size, chunk) => size + chunk.text.length, 0) - LIMIT;
  while (excess > 0 && chunks.length) {
    if (chunks[0].text.length <= excess) excess -= chunks.shift()!.text.length;
    else { chunks[0] = { ...chunks[0], text: chunks[0].text.slice(excess) }; excess = 0; }
  }
  return chunks;
}

export function outputLines(chunks: OutputChunk[]): OutputLine[] {
  const lines: OutputLine[] = [{ text: '' }];
  for (const chunk of chunks) {
    const parts = chunk.text.split('\n');
    parts.forEach((part, index) => {
      const line = lines.at(-1)!;
      if (part) {
        if (!line.text) line.runId = chunk.runId;
        else if (line.runId !== chunk.runId) line.runId = undefined;
        line.text += part;
      }
      if (index < parts.length - 1) lines.push({ text: '' });
    });
  }
  return lines.map(line => ({ ...line, text: plainOutput(line.text.replace(/\r$/, '')) }));
}
