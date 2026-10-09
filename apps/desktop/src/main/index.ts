// SPDX-License-Identifier: GPL-3.0-only
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, parse } from 'node:path';
import type { CommandResult, PortsResult, Sketch, PortInfo, ActionResult } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let currentSketchPath: string | null = null;
let monitor: ChildProcessWithoutNullStreams | null = null;

const cliPath = (): string => process.env.ARDUINO_CLI_PATH?.trim() || 'arduino-cli';

function runCli(args: string[], timeout = 600_000): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(cliPath(), args, {
      windowsHide: true,
      timeout,
      maxBuffer: 16 * 1024 * 1024
    }, (error, stdout, stderr) => {
      resolve({
        ok: error === null,
        stdout: String(stdout ?? ''),
        stderr: [String(stderr ?? ''), error?.message ?? ''].filter(Boolean).join('\n')
      });
    });
  });
}

function validateFqbn(fqbn: unknown): string {
  if (typeof fqbn !== 'string' || !/^[a-zA-Z0-9_.:-]{3,160}$/.test(fqbn)) {
    throw new Error('Invalid board FQBN. Choose an installed Arduino board target.');
  }
  return fqbn;
}

function validatePort(port: unknown): string {
  if (typeof port !== 'string' || !/^[a-zA-Z0-9_./:-]{2,240}$/.test(port)) {
    throw new Error('Invalid serial port address.');
  }
  return port;
}

function validateSource(source: unknown): string {
  if (typeof source !== 'string' || source.length > 1_000_000) {
    throw new Error('Sketch source must be text smaller than 1 MB.');
  }
  return source;
}

function sketch(filePath: string, source: string): Sketch {
  return { filePath, name: basename(filePath), source };
}

async function saveSketch(source: string): Promise<Sketch | null> {
  const safeSource = validateSource(source);
  if (!currentSketchPath) {
    const selection = await dialog.showSaveDialog({
      title: 'Save Arduino sketch',
      defaultPath: join(app.getPath('documents'), 'Blink.ino'),
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }]
    });
    if (selection.canceled || !selection.filePath) return null;

    // Arduino CLI requires SketchName/SketchName.ino.
    const chosen = extname(selection.filePath).toLowerCase() === '.ino'
      ? selection.filePath
      : selection.filePath + '.ino';
    const name = parse(chosen).name;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(name)) {
      throw new Error('Use only letters, numbers, underscores or hyphens in sketch names.');
    }
    const chosenFolder = dirname(chosen);
    const folder = basename(chosenFolder).toLowerCase() === name.toLowerCase()
      ? chosenFolder
      : join(chosenFolder, name);
    currentSketchPath = join(folder, name + '.ino');
  }

  await mkdir(dirname(currentSketchPath), { recursive: true });
  await writeFile(currentSketchPath, safeSource, 'utf8');
  return sketch(currentSketchPath, safeSource);
}

function sendMonitorData(chunk: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitor:data', chunk.slice(0, 20_000));
  }
}

function sendMonitorState(running: boolean): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitor:state', running);
  }
}

async function stopMonitor(): Promise<void> {
  const child = monitor;
  if (!child) {
    sendMonitorState(false);
    return;
  }
  monitor = null;
  if (child.exitCode !== null || child.killed) {
    sendMonitorState(false);
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      if (!child.kill()) {
        clearTimeout(timer);
        resolve();
      }
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
  sendMonitorState(false);
}

function registerHandlers(): void {
  ipcMain.handle('cli:version', () => runCli(['version'], 20_000));
  ipcMain.handle('cli:ports', async (): Promise<PortsResult> => {
    const result = await runCli(['board', 'list', '--format', 'json'], 30_000);
    let ports: PortInfo[] = [];
    if (result.ok) {
      try {
        const data = JSON.parse(result.stdout) as {
          detected_ports?: Array<{ port?: { address?: string; label?: string } }>;
        };
        ports = (data.detected_ports ?? [])
          .map((item) => ({
            address: item.port?.address ?? '',
            label: item.port?.label ?? item.port?.address ?? ''
          }))
          .filter((item) => item.address.length > 0);
      } catch {
        return { ...result, ok: false, ports: [], stderr: 'Arduino CLI returned invalid port JSON.' };
      }
    }
    return { ...result, ports };
  });

  ipcMain.handle('project:new', () => {
    currentSketchPath = null;
  });

  ipcMain.handle('project:open', async (): Promise<Sketch | null> => {
    const selection = await dialog.showOpenDialog({
      title: 'Open Arduino sketch',
      properties: ['openFile'],
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }]
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const filePath = selection.filePaths[0];
    const source = await readFile(filePath, 'utf8');
    currentSketchPath = filePath;
    return sketch(filePath, source);
  });

  ipcMain.handle('project:save', (_event, source: string) => saveSketch(source));

  ipcMain.handle('cli:compile', async (_event, board: string): Promise<CommandResult> => {
    const fqbn = validateFqbn(board);
    if (!currentSketchPath) {
      return { ok: false, stdout: '', stderr: 'Save the sketch before compiling.' };
    }
    return runCli(['compile', '--fqbn', fqbn, dirname(currentSketchPath)]);
  });

  ipcMain.handle('cli:upload', async (_event, board: string, port: string): Promise<CommandResult> => {
    const fqbn = validateFqbn(board);
    const validatedPort = validatePort(port);
    if (!currentSketchPath) {
      return { ok: false, stdout: '', stderr: 'Save the sketch before uploading.' };
    }
    await stopMonitor(); // Release the serial port before invoking the uploader.
    return runCli(['upload', '--fqbn', fqbn, '--port', validatedPort, dirname(currentSketchPath)]);
  });

  ipcMain.handle('monitor:start', async (_event, port: string, baud: number): Promise<ActionResult> => {
    const validatedPort = validatePort(port);
    if (!Number.isInteger(baud) || baud < 300 || baud > 2_000_000) {
      throw new Error('Invalid baud rate.');
    }
    await stopMonitor();
    return new Promise<ActionResult>((resolve) => {
      const child = spawn(cliPath(), [
        'monitor', '--port', validatedPort, '--config', 'baudrate=' + baud, '--quiet'
      ], { windowsHide: true, shell: false, stdio: 'pipe' });
      monitor = child;
      let settled = false;
      child.on('spawn', () => {
        sendMonitorState(true);
        settled = true;
        resolve({ ok: true, message: 'Monitor started. Check the console for device output.' });
      });
      child.stdout.on('data', (chunk: Buffer) => sendMonitorData(chunk.toString('utf8')));
      child.stderr.on('data', (chunk: Buffer) => sendMonitorData(chunk.toString('utf8')));
      child.on('error', (error) => {
        if (monitor === child) monitor = null;
        sendMonitorState(false);
        sendMonitorData('[Monitor error] ' + error.message + '\n');
        if (!settled) {
          settled = true;
          resolve({ ok: false, message: error.message });
        }
      });
      child.on('exit', (code) => {
        if (monitor === child) monitor = null;
        sendMonitorState(false);
        sendMonitorData('[Monitor exited: ' + (code ?? 'unknown') + ']\n');
        if (!settled) {
          settled = true;
          resolve({ ok: false, message: 'Monitor closed before becoming ready.' });
        }
      });
    });
  });
  ipcMain.handle('monitor:stop', () => stopMonitor());
  ipcMain.handle('monitor:send', (_event, text: string) => {
    if (typeof text !== 'string' || text.length > 2048) throw new Error('Invalid monitor input.');
    if (!monitor || monitor.stdin.destroyed) throw new Error('Serial monitor is not running.');
    monitor.stdin.write(text);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    title: 'EduBoard IDE',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  registerHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  void stopMonitor();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { void stopMonitor(); });
