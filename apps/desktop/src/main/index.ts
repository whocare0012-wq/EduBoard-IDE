// SPDX-License-Identifier: GPL-3.0-only
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { lstat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { BoardsResult, CommandResult, PortsResult, Sketch, ToolSettings } from '../shared/types';
import { normalizeProjectPath, normalizeSketchPath, projectSourcePath, readProject, readSketch, validateSource, writeProject, writeSketch } from './projects';
import { SENSOR_LIBRARIES, validateProject } from '../shared/project-format';
import { ArduinoService, ESP32_CORE, ESP32_INDEX_URL, parseBoards, parsePorts, validateBaud, validatePort } from './arduino';
import { CommandRunner, SerialSession } from './processes';
import { SettingsStore } from './settings';

app.setName('EduBoard IDE');
if (process.env.EDUBOARD_USER_DATA) app.setPath('userData', process.env.EDUBOARD_USER_DATA);
let mainWindow: BrowserWindow | null = null;
let currentSketchPath: string | null = null;
let currentProjectPath: string | null = null;
let operationActive = false;
const settings = new SettingsStore(join(app.getPath('userData'), 'tools.json'));
const publish = (channel: string, value: unknown): void => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value);
};
const runner = new CommandRunner(text => publish('task:output', text));
const serial = new SerialSession(text => publish('monitor:data', text), running => publish('monitor:state', running));
const cliConfiguration = (): { executable: string; args: string[] } => {
  const config = settings.get();
  return { executable: config.arduinoCliPath, args: config.arduinoConfigPath ? ['--config-file', config.arduinoConfigPath] : [] };
};
const arduino = new ArduinoService(runner, serial, cliConfiguration, join(app.getPath('temp'), 'eduboard-builds'));

function assertIdle(): void {
  if (operationActive || runner.busy) throw new Error('已有工具任务正在执行，请等待或取消后再操作。');
}

async function operation<T>(action: () => Promise<T>): Promise<T> {
  assertIdle();
  operationActive = true;
  try { return await action(); } finally { operationActive = false; }
}

function handle(channel: string, action: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Untrusted IPC sender.');
    }
    return action(...args);
  });
}

async function readCli(args: string[]): Promise<CommandResult> {
  if (operationActive) return { ok: false, stdout: '', stderr: '请等待当前工具任务结束。' };
  const config = cliConfiguration();
  return new CommandRunner().run(config.executable, [...config.args, ...args], { timeout: 30_000, env: { ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false' } });
}

async function saveSketch(source: unknown): Promise<Sketch | null> {
  const safeSource = validateSource(source);
  if (currentProjectPath) {
    const existing = await readProject(currentProjectPath);
    const saved = await writeProject(currentProjectPath, { ...existing.document!, mode: 'text', workspace: null, source: safeSource });
    arduino.invalidate();
    return saved;
  }
  let targetPath = currentSketchPath;
  if (!targetPath) {
    const selection = await dialog.showSaveDialog({
      title: '保存 Arduino 项目 / Save sketch', defaultPath: join(app.getPath('documents'), 'Blink.ino'),
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }]
    });
    if (selection.canceled || !selection.filePath) return null;
    targetPath = normalizeSketchPath(selection.filePath);
    if (await lstat(targetPath).then(() => true, (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    })) {
      const choice = await dialog.showMessageBox({
        type: 'warning', title: '覆盖已有项目？', message: targetPath,
        detail: 'Arduino 文件会保存在同名文件夹中。是否覆盖这个现有文件？',
        buttons: ['取消', '覆盖'], defaultId: 0, cancelId: 0
      });
      if (choice.response !== 1) return null;
    }
  }
  const saved = await writeSketch(targetPath, safeSource);
  currentSketchPath = saved.filePath;
  arduino.invalidate();
  return saved;
}

async function saveProject(value: unknown): Promise<Sketch | null> {
  const document = validateProject(value);
  if (document.language !== 'arduino') throw new Error('MicroPython 工作流将在下一阶段启用。');
  let targetPath = currentProjectPath;
  if (!targetPath && currentSketchPath) targetPath = join(dirname(currentSketchPath), basename(currentSketchPath, '.ino') + '.eduboard.json');
  if (!targetPath) {
    const selected = await dialog.showSaveDialog({ title: '保存 EduBoard 项目', defaultPath: join(app.getPath('documents'), 'Blink.eduboard.json'), filters: [{ name: 'EduBoard Project', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePath) return null;
    targetPath = normalizeProjectPath(selected.filePath);
  }
  const exists = (path: string): Promise<boolean> => lstat(path).then(() => true, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error; });
  const targetSource = projectSourcePath(targetPath, document.language);
  if (targetPath !== currentProjectPath && (await exists(targetPath) || targetSource !== currentSketchPath && await exists(targetSource))) {
    const choice = await dialog.showMessageBox({ type: 'warning', title: '覆盖已有项目？', message: targetPath, detail: '是否覆盖已有项目数据及程序？\n' + targetSource, buttons: ['取消', '覆盖'], defaultId: 0, cancelId: 0 });
    if (choice.response !== 1) return null;
  }
  const saved = await writeProject(targetPath, document);
  currentProjectPath = saved.projectPath!;
  currentSketchPath = saved.filePath;
  arduino.invalidate();
  return saved;
}

function registerHandlers(): void {
  handle('cli:version', () => readCli(['version']));
  handle('cli:ports', async (): Promise<PortsResult> => {
    const result = await readCli(['board', 'list', '--format', 'json']);
    if (!result.ok) return { ...result, ports: [] };
    try { return { ...result, ports: parsePorts(result.stdout) }; }
    catch (error) { return { ...result, ok: false, ports: [], stderr: String(error) }; }
  });
  handle('cli:boards', async (): Promise<BoardsResult> => {
    const result = await readCli(['core', 'list', '--format', 'json']);
    if (!result.ok) return { ...result, boards: [] };
    try { return { ...result, stdout: '', boards: parseBoards(result.stdout) }; }
    catch (error) { return { ...result, ok: false, boards: [], stderr: String(error) }; }
  });
  handle('tools:get', () => settings.get());
  handle('tools:choose', (key) => operation(async (): Promise<ToolSettings | null> => {
    if (key !== 'arduinoCliPath' && key !== 'arduinoConfigPath' && key !== 'pythonPath') throw new Error('未知工具。');
    const selection = await dialog.showOpenDialog({
      title: key === 'arduinoConfigPath' ? '选择 Arduino CLI 配置文件' : '选择已安装的工具程序',
      properties: ['openFile'],
      filters: key === 'arduinoConfigPath' ? [{ name: 'Arduino config', extensions: ['yaml', 'yml'] }] : [{ name: 'Executable', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
    });
    const filePath = selection.filePaths[0];
    if (selection.canceled || !filePath) return null;
    const info = await lstat(filePath);
    if (!info.isFile()) throw new Error('请选择普通工具文件。');
    await serial.stop();
    arduino.invalidate();
    return settings.set(key, filePath);
  }));
  handle('cli:install-esp32', () => operation(async () => {
    await serial.stop();
    const index = await arduino.run(['core', 'update-index', '--additional-urls', ESP32_INDEX_URL], true, 900_000);
    if (!index.ok) return index;
    return arduino.run(['core', 'install', ESP32_CORE, '--additional-urls', ESP32_INDEX_URL], true, 1_800_000);
  }));
  handle('cli:install-example-libraries', () => operation(async () => {
    await serial.stop();
    return arduino.run(['lib', 'install', '--no-deps', ...SENSOR_LIBRARIES], true, 900_000);
  }));
  handle('task:cancel', () => runner.cancel());
  handle('project:new', () => operation(async () => { currentSketchPath = null; currentProjectPath = null; arduino.invalidate(); }));
  handle('project:open', () => operation(async (): Promise<Sketch | null> => {
    const selection = await dialog.showOpenDialog({
      title: '打开 EduBoard 或 Arduino 项目', properties: ['openFile'], filters: [{ name: 'EduBoard / Arduino', extensions: ['json', 'ino'] }]
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const selectedPath = selection.filePaths[0];
    const opened = selectedPath.toLowerCase().endsWith('.eduboard.json') ? await readProject(selectedPath) : await readSketch(selectedPath);
    if (opened.document && opened.document.language !== 'arduino') throw new Error('MicroPython 工作流将在下一阶段启用。');
    currentSketchPath = opened.filePath;
    currentProjectPath = opened.projectPath || null;
    arduino.invalidate();
    return opened;
  }));
  handle('project:save', (source) => operation(() => saveSketch(source)));
  handle('project:save-document', (document) => operation(() => saveProject(document)));
  handle('cli:compile', (board) => operation(async (): Promise<CommandResult> => {
    if (!currentSketchPath) return { ok: false, stdout: '', stderr: '请先保存项目。' };
    if (currentProjectPath && (await readProject(currentProjectPath)).source !== (await readSketch(currentSketchPath)).source) {
      return { ok: false, stdout: '', stderr: '导出的程序与项目文件不一致，请保存项目后重新编译。' };
    }
    return arduino.compile(currentSketchPath, board);
  }));
  handle('cli:upload', (board, port) => operation(async (): Promise<CommandResult> => {
    if (!currentSketchPath) return { ok: false, stdout: '', stderr: '请先保存项目。' };
    return arduino.upload(currentSketchPath, board, port);
  }));
  handle('monitor:start', (address, baud) => operation(async () => {
    const port = validatePort(address);
    const speed = validateBaud(baud);
    const config = cliConfiguration();
    return serial.start(config.executable, [...config.args, 'monitor', '--port', port, '--config', 'baudrate=' + speed, '--quiet']);
  }));
  handle('monitor:stop', () => operation(() => serial.stop()));
  handle('monitor:send', (text) => { assertIdle(); return serial.send(text); });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 860, minHeight: 600, title: 'EduBoard IDE',
    backgroundColor: '#131923', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync({
      type: 'warning', title: '尚有未保存内容', message: '关闭会丢失未保存的内容或中断工具任务。',
      detail: '选择取消可返回编辑器保存项目。', buttons: ['取消', '放弃并关闭'], defaultId: 0, cancelId: 0
    });
    if (choice === 1) event.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await settings.load();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  registerHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(error => { dialog.showErrorBox('EduBoard IDE 启动失败', String(error)); app.quit(); });

let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  void Promise.allSettled([runner.cancel(), serial.stop()]).then(() => { quitting = true; app.quit(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
