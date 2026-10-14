// SPDX-License-Identifier: GPL-3.0-only
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BoardInfo, CommandResult, PortInfo } from '../shared/types';
import { CommandRunner, SerialSession } from './processes';

export const ESP32_INDEX_URL = 'https://espressif.github.io/arduino-esp32/package_esp32_index.json';
export const ESP32_CORE = 'esp32:esp32@3.3.12';

export function validateFqbn(value: unknown): string {
  if (typeof value !== 'string' || value.length > 240 || !/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+(?::[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+)*)?$/.test(value)) {
    throw new Error('无效的开发板 FQBN，请选择已安装的目标。');
  }
  return value;
}

export function validatePort(value: unknown): string {
  if (typeof value !== 'string' || value.length > 240 || !/^(COM[1-9][0-9]{0,3}|\/dev\/[A-Za-z0-9_./-]+)$/i.test(value)) {
    throw new Error('无效串口地址，请填写 COM3 等本地串口。');
  }
  return value;
}

export function validateBaud(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 300 || value > 2_000_000) throw new Error('无效波特率。');
  return value;
}

export function parsePorts(text: string): PortInfo[] {
  const parsed = JSON.parse(text) as { detected_ports?: unknown[] };
  if (!parsed || !Array.isArray(parsed.detected_ports)) throw new Error('Arduino CLI 返回了无效的串口列表。');
  return parsed.detected_ports.flatMap((item) => {
    const port = (item as { port?: { address?: unknown; label?: unknown; protocol?: unknown } })?.port;
    if (!port || typeof port.address !== 'string' || (port.protocol && port.protocol !== 'serial')) return [];
    try { validatePort(port.address); } catch { return []; }
    return [{ address: port.address, label: typeof port.label === 'string' ? port.label.slice(0, 240) : port.address }];
  });
}

export function parseBoards(text: string): BoardInfo[] {
  const parsed = JSON.parse(text) as { boards?: unknown[]; platforms?: Array<{ installed_version?: string; releases?: Record<string, { boards?: unknown[] }> }> };
  const entries = Array.isArray(parsed?.boards) ? parsed.boards : Array.isArray(parsed?.platforms)
    ? parsed.platforms.flatMap(platform => platform?.installed_version && Array.isArray(platform.releases?.[platform.installed_version]?.boards)
      ? platform.releases![platform.installed_version].boards! : []) : null;
  if (!entries) throw new Error('Arduino CLI 返回了无效的开发板列表。');
  return entries.flatMap((item) => {
    const board = item as { fqbn?: unknown; name?: unknown };
    if (!board || typeof board.fqbn !== 'string' || typeof board.name !== 'string') return [];
    try { validateFqbn(board.fqbn); } catch { return []; }
    return [{ fqbn: board.fqbn, name: board.name.slice(0, 240) }];
  });
}

export class ArduinoService {
  private compiled: { path: string; fqbn: string; hash: string; buildPath: string } | null = null;
  constructor(
    private readonly runner: CommandRunner,
    private readonly serial: SerialSession,
    private readonly configuration: () => { executable: string; args: string[] },
    private readonly buildRoot: string
  ) {}

  invalidate(): void { this.compiled = null; }

  run(args: string[], stream = false, timeout = 600_000): Promise<CommandResult> {
    const tool = this.configuration();
    return this.runner.run(tool.executable, [...tool.args, ...args], { stream, timeout, env: { ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false' } });
  }

  async compile(path: string, board: unknown): Promise<CommandResult> {
    const fqbn = validateFqbn(board);
    this.compiled = null;
    const hash = createHash('sha256').update(await readFile(path)).digest('hex');
    const buildPath = join(this.buildRoot, createHash('sha256').update(path + '\0' + fqbn).digest('hex').slice(0, 24));
    const result = await this.run(['compile', '--fqbn', fqbn, '--build-path', buildPath, dirname(path)], true);
    if (result.ok) this.compiled = { path, fqbn, hash, buildPath };
    return result;
  }

  async upload(path: string, board: unknown, address: unknown): Promise<CommandResult> {
    const fqbn = validateFqbn(board);
    const port = validatePort(address);
    const built = this.compiled;
    const hash = createHash('sha256').update(await readFile(path)).digest('hex');
    if (!built || built.path !== path || built.fqbn !== fqbn || built.hash !== hash) {
      return { ok: false, stdout: '', stderr: '程序或开发板已改变，请先重新编译再上传。' };
    }
    await this.serial.stop();
    return this.run(['upload', '--fqbn', fqbn, '--port', port, '--input-dir', built.buildPath, dirname(path)], true);
  }
}
