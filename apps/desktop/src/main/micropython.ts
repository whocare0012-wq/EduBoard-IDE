// SPDX-License-Identifier: GPL-3.0-only
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, join, posix, resolve, sep } from 'node:path';
import { microBoard, type MicroBoard } from '../shared/boards';
import type { ActionResult, CommandResult, DeviceFilesResult, FirmwareInfo, PythonToolsResult } from '../shared/types';
import { validateBaud, validatePort } from './arduino';
import { CommandRunner, SerialSession } from './processes';

export function validateRemotePath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 120 || !/^\/[A-Za-z0-9_./-]+$/.test(value) || value.split('/').includes('..') || posix.normalize(value) !== value || value === '/') {
    throw new Error('设备文件路径须为 /main.py 等英文路径，不能包含上级目录或控制字符。');
  }
  return value;
}

export function verifyFirmware(bytes: Buffer, board: MicroBoard): void {
  if (bytes.length < 24 || bytes.length > board.minimumFlash - board.offset || bytes[0] !== 0xe9 || bytes.readUInt16LE(12) !== board.imageChipId) throw new Error('固件格式、容量或芯片不匹配。');
  if (createHash('sha256').update(bytes).digest('hex') !== board.sha256) throw new Error('固件 SHA-256 与支持的官方固件不一致，请下载指定版本。');
}

export interface ChipProbe { chip: string; description: string; revision: number; features: string[]; flashBytes: number; secureBoot: boolean; flashEncryption: boolean; }
export function validateProbe(value: unknown, board: MicroBoard): ChipProbe {
  const info = value as Partial<ChipProbe> | null;
  if (!info || info.chip !== board.chip || !Number.isInteger(info.revision) || info.revision! < board.minimumRevision || typeof info.flashBytes !== 'number' || info.flashBytes < board.minimumFlash) throw new Error('实际芯片、修订版或闪存容量与所选固件不匹配。');
  if (typeof info.secureBoot !== 'boolean' || typeof info.flashEncryption !== 'boolean' || info.secureBoot || info.flashEncryption) throw new Error('不支持刷写已启用安全启动或闪存加密的设备。');
  if (!Array.isArray(info.features) || info.features.some(item => typeof item !== 'string') || board.id === 'esp32' && !info.features.includes('Dual Core')) throw new Error('所选 ESP32 固件需要匹配的双核芯片。');
  return info as ChipProbe;
}

export class MicroPythonService {
  private prepared: { info: FirmwareInfo; path: string; board: MicroBoard } | null = null;
  constructor(
    private readonly runner: CommandRunner,
    private readonly serial: SerialSession,
    private readonly python: () => { executable: string; args: string[] },
    private readonly helper: string,
    private readonly stagingRoot: string,
    private readonly boardLookup: (value: unknown) => MicroBoard = microBoard
  ) {}

  private run(args: string[], stream = false, timeout = 120_000): Promise<CommandResult> {
    const config = this.python();
    return this.runner.run(config.executable, [...config.args, '-u', ...args], { stream, timeout, env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
  }

  async info(): Promise<PythonToolsResult> {
    const config = this.python();
    const result = await new CommandRunner().run(config.executable, [...config.args, '-u', this.helper, 'info'], { timeout: 20_000, env: { PYTHONUTF8: '1' } });
    if (!result.ok) return { ...result, versions: {} };
    try {
      const data = JSON.parse(result.stdout) as { python: string; packages: Record<string, string | null> };
      const missing = ['mpremote', 'esptool', 'pyserial'].filter(name => typeof data.packages?.[name] !== 'string');
      return { ...result, stdout: '', ok: !missing.length, versions: { python: data.python, ...data.packages }, stderr: missing.length ? '缺少工具：' + missing.join(', ') + '，请选择已按 requirements-tools.txt 配置的 Python。' : result.stderr };
    } catch { return { ...result, ok: false, versions: {}, stderr: 'Python 工具返回了无效的状态数据。' }; }
  }

  async ports(): Promise<CommandResult & { ports: Array<{ address: string; label: string }> }> {
    const config = this.python();
    const result = await new CommandRunner().run(config.executable, [...config.args, '-u', this.helper, 'ports'], { timeout: 20_000 });
    try {
      const entries = JSON.parse(result.stdout) as Array<{ address: string; label: string }>;
      if (!result.ok || !Array.isArray(entries)) throw new Error();
      const ports = entries.filter(entry => { try { validatePort(entry?.address); return true; } catch { return false; } }).map(entry => ({ address: entry.address, label: typeof entry.label === 'string' ? entry.label.slice(0, 240) : entry.address }));
      return { ...result, stdout: '', ports };
    } catch { return { ...result, ok: false, ports: [] }; }
  }

  check(path: string): Promise<CommandResult> { return this.run([this.helper, 'check', path], true, 30_000); }

  async startRepl(address: unknown, baud: unknown): Promise<ActionResult> {
    const port = validatePort(address); const speed = validateBaud(baud); const config = this.python();
    return this.serial.start(config.executable, [...config.args, '-u', this.helper, 'repl', port, '--baud', String(speed)], { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }, 'EDUBOARD_REPL_READY');
  }

  async interrupt(): Promise<void> {
    await this.serial.send('\x03');
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.serial.send('\x02');
  }

  async runScript(path: string, address: unknown, baud: unknown): Promise<CommandResult> {
    const port = validatePort(address);
    const speed = validateBaud(baud);
    await this.serial.stop();
    const result = await this.run(['-m', 'mpremote', 'connect', port, 'run', '--no-follow', path], true);
    if (!result.ok) return result;
    const repl = await this.startRepl(port, speed);
    return repl.ok ? result : { ...result, ok: false, stderr: '脚本可能已经启动，但 REPL 未能重连：' + repl.message };
  }

  async upload(path: string, address: unknown, destination: unknown): Promise<CommandResult> {
    const port = validatePort(address); const remote = validateRemotePath(destination);
    await this.serial.stop();
    return this.run(['-m', 'mpremote', 'connect', port, 'fs', 'cp', path, ':' + remote], true);
  }

  async list(address: unknown): Promise<DeviceFilesResult> {
    const port = validatePort(address);
    await this.serial.stop();
    const source = "import os,json\nnames=os.listdir('/')\nfiles=[{'name':n,'size':os.stat('/'+n)[6],'directory':bool(os.stat('/'+n)[0]&16384)} for n in names[:256]]\nprint(json.dumps({'files':files,'truncated':len(names)>256}))";
    const result = await this.run(['-m', 'mpremote', 'connect', port, 'exec', source]);
    if (!result.ok) return { ...result, files: [] };
    try {
      const data = JSON.parse(result.stdout) as { files: Array<{ name: string; size: number; directory: boolean }>; truncated: boolean };
      if (!Array.isArray(data.files)) throw new Error();
      return { ...result, stdout: '', files: data.files.filter(file => typeof file.name === 'string' && file.name.length <= 240 && typeof file.size === 'number' && Number.isFinite(file.size) && typeof file.directory === 'boolean'), truncated: Boolean(data.truncated) };
    } catch { return { ...result, ok: false, files: [], stderr: '设备返回了无效的文件列表。' }; }
  }

  async download(address: unknown, source: unknown, destination: string): Promise<CommandResult> {
    const port = validatePort(address); const remote = validateRemotePath(source);
    await this.serial.stop();
    const temporary = destination + '.' + randomUUID() + '.download';
    try {
      const result = await this.run(['-m', 'mpremote', 'connect', port, 'fs', 'cp', ':' + remote, temporary], true);
      if (result.ok) {
        const file = await lstat(temporary);
        if (!file.isFile() || file.isSymbolicLink() || file.size > 4_000_000) throw new Error('下载文件须为小于 4 MB 的普通文件。');
        await rename(temporary, destination);
      }
      return result;
    } finally { await unlink(temporary).catch(() => undefined); }
  }

  async remove(address: unknown, target: unknown): Promise<CommandResult> {
    const port = validatePort(address); const remote = validateRemotePath(target);
    await this.serial.stop();
    return this.run(['-m', 'mpremote', 'connect', port, 'fs', 'rm', ':' + remote], true);
  }

  async prepare(path: string, boardId: unknown): Promise<FirmwareInfo> {
    this.prepared = null;
    const board = this.boardLookup(boardId);
    const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink() || file.size > board.minimumFlash) throw new Error('请选择支持的普通 .bin 固件文件。');
    const bytes = await readFile(path);
    verifyFirmware(bytes, board);
    const info: FirmwareInfo = { token: randomUUID(), boardId: board.id, filename: basename(path), sha256: board.sha256, bytes: bytes.length, version: '1.29.0', offset: board.offset };
    this.prepared = { info, path, board };
    return info;
  }

  async flash(token: unknown, address: unknown): Promise<CommandResult> {
    const selected = this.prepared;
    if (!selected || token !== selected.info.token) throw new Error('请重新选择并确认固件。');
    const port = validatePort(address);
    const bytes = await readFile(selected.path);
    verifyFirmware(bytes, selected.board);
    await this.serial.stop();
    const probe = await this.run([this.helper, 'probe', port]);
    if (!probe.ok) return probe;
    validateProbe(JSON.parse(probe.stdout), selected.board);
    this.prepared = null;
    const folder = resolve(this.stagingRoot);
    const staged = resolve(folder, selected.info.token + '.bin');
    if (!staged.startsWith(folder + sep)) throw new Error('无效固件暂存目录。');
    await mkdir(folder, { recursive: true });
    await writeFile(staged, bytes, { flag: 'wx' });
    try {
      // One esptool operation keeps chip/secure-boot checks before erase/write. Never --force.
      return await this.run(['-m', 'esptool', '--chip', selected.board.chip, '--port', port, '--baud', '115200', 'write-flash', '--erase-all', '0x' + selected.board.offset.toString(16), staged], true, 900_000);
    } finally { await unlink(staged).catch(() => undefined); }
  }
}
