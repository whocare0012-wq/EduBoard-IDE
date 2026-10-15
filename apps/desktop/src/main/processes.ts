// SPDX-License-Identifier: GPL-3.0-only
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import type { ActionResult, CommandResult } from '../shared/types';

const MAX_OUTPUT = 2 * 1024 * 1024;

export async function terminateProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  if (child.pid) {
    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, () => resolve());
      });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  } else child.kill();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([closed, new Promise<void>((_, reject) => {
      timer = setTimeout(() => {
        if (process.platform !== 'win32' && child.pid) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        }
        reject(new Error('无法确认串口/工具进程已关闭，请重启应用后重试。'));
      }, 5000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

type Terminate = (child: ChildProcessWithoutNullStreams) => Promise<void>;
const ABANDONED = '工具进程未能确认退出，已停止等待；如串口仍被占用，请重启应用。';

export class CommandRunner {
  private active: ChildProcessWithoutNullStreams | null = null;
  private abandon: ((reason: string) => void) | null = null;
  private cancelRequested = false;
  get busy(): boolean { return this.active !== null; }

  constructor(private readonly output?: (text: string) => void, private readonly terminate: Terminate = terminateProcess) {}

  async cancel(): Promise<void> {
    if (!this.active) return;
    this.cancelRequested = true;
    try { await this.terminate(this.active); }
    catch (error) { this.abandon?.(String(error)); throw error; }
  }

  run(executable: string, args: string[], options: { timeout?: number; env?: NodeJS.ProcessEnv; stream?: boolean } = {}): Promise<CommandResult> {
    if (this.active) return Promise.resolve({ ok: false, stdout: '', stderr: '已有任务正在执行，请等待或取消。' });
    this.cancelRequested = false;
    return new Promise((resolve) => {
      const child = spawn(executable, args, {
        windowsHide: true, shell: false, stdio: 'pipe', detached: process.platform !== 'win32',
        env: { ...process.env, ...options.env }
      });
      this.active = child;
      let settled = false;
      let stdout = '';
      let stderr = '';
      let failure = '';
      let timedOut = false;
      const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
      const receive = (kind: 'stdout' | 'stderr', text: string): void => {
        if (settled) return;
        if (kind === 'stdout') stdout = (stdout + text).slice(-MAX_OUTPUT);
        else stderr = (stderr + text).slice(-MAX_OUTPUT);
        if (options.stream) this.output?.(text.slice(-20_000));
      };
      child.stdout.on('data', (chunk: Buffer) => receive('stdout', decoders.stdout.write(chunk)));
      child.stderr.on('data', (chunk: Buffer) => receive('stderr', decoders.stderr.write(chunk)));
      child.on('error', (error: NodeJS.ErrnoException) => {
        failure = error.code === 'ENOENT'
          ? '未找到工具：' + executable + '。请在工具链设置中选择已安装的程序，或按离线部署文档安装。'
          : error.message;
      });
      const settle = (code: number | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (this.active === child) { this.active = null; this.abandon = null; }
        const reason = [this.cancelRequested ? '任务已取消。' : timedOut ? '任务超时，请检查工具输出。' : '', failure].filter(Boolean).join('\n');
        resolve({ ok: code === 0 && !reason, stdout, stderr: [stderr, reason].filter(Boolean).join('\n'), cancelled: this.cancelRequested, streamed: Boolean(options.stream) });
      };
      // If the child cannot be confirmed closed, stop waiting so the IDE does not stay busy forever.
      this.abandon = reason => { failure = [failure, reason, ABANDONED].filter(Boolean).join('\n'); settle(null); };
      const timeout = setTimeout(() => {
        timedOut = true;
        void this.terminate(child).catch(error => this.abandon?.(String(error)));
      }, options.timeout ?? 600_000);
      child.on('close', (code) => {
        receive('stdout', decoders.stdout.end());
        receive('stderr', decoders.stderr.end());
        settle(code);
      });
    });
  }
}

export class SerialSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  constructor(private readonly output: (text: string) => void, private readonly state: (running: boolean) => void, private readonly terminate: Terminate = terminateProcess) {}
  get running(): boolean { return this.child !== null; }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) { this.state(false); return; }
    try { await this.terminate(child); }
    finally {
      // Forget an unconfirmed child too; otherwise every later stop()/start() would fail on it forever.
      if (this.child === child) { this.child = null; this.state(false); }
    }
  }

  async start(executable: string, args: string[], env?: NodeJS.ProcessEnv, readyLine?: string): Promise<ActionResult> {
    await this.stop();
    return new Promise((resolve) => {
      const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: 'pipe', detached: process.platform !== 'win32', env: { ...process.env, ...env } });
      this.child = child;
      let settled = false;
      const finish = (result: ActionResult): void => { if (!settled) { settled = true; resolve(result); } };
      const decoder = new StringDecoder('utf8');
      const errorDecoder = new StringDecoder('utf8');
      let pending = '';
      let readySeen = false;
      child.stdout.on('data', (chunk: Buffer) => {
        let text = decoder.write(chunk);
        if (readyLine && !readySeen) {
          pending = (pending + text).slice(-20_000);
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) {
            if (line.trim() === readyLine) {
              readySeen = true; clearTimeout(ready); this.state(true); finish({ ok: true, message: '串口已连接，请查看设备输出。' });
            } else this.output(line + '\n');
          }
          if (!readySeen) return;
          text = pending; pending = '';
        }
        this.output(text.slice(-20_000));
      });
      child.stderr.on('data', (chunk: Buffer) => this.output(errorDecoder.write(chunk).slice(-20_000)));
      const ready = setTimeout(() => {
        if (readyLine && !readySeen) {
          finish({ ok: false, message: '串口连接超时，请检查 Python 工具和端口。' });
          void this.terminate(child).catch(error => this.output(String(error)));
          return;
        }
        if (this.child === child) { this.state(true); finish({ ok: true, message: '串口连接请求已发出，请查看设备输出。' }); }
      }, readyLine ? 10_000 : 350);
      child.on('error', (error) => finish({ ok: false, message: error.message }));
      child.on('close', (code) => {
        clearTimeout(ready);
        this.output(decoder.end() + errorDecoder.end());
        if (this.child === child) { this.child = null; this.state(false); }
        this.output('[串口已关闭] ' + (code ?? '停止') + '\n');
        finish({ ok: false, message: '串口未能连接，请检查端口、驱动与工具路径。' });
      });
    });
  }

  async send(text: unknown): Promise<void> {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 2048) throw new Error('串口发送文本须小于 2048 字节。');
    const child = this.child;
    if (!child || child.stdin.destroyed || child.exitCode !== null) throw new Error('串口尚未连接。');
    await new Promise<void>((resolve, reject) => child.stdin.write(text, error => error ? reject(error) : resolve()));
  }
}
