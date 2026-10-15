// SPDX-License-Identifier: GPL-3.0-only
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname, join, posix } from 'node:path';
import type { BoardsResult, CommandResult, FirmwareInfo, PortsResult, Sketch, ToolSettings } from '../shared/types';
import { atomicWrite, defaultProjectName, exportNeedsConfirmation, generationFailed, normalizeProjectPath, normalizeSketchPath, projectPathForSource, projectSourcePath, readProject, readPythonScript, readSketch, validateSource, writeProject, writeSketch } from './projects';
import { SENSOR_LIBRARIES, validateProject, type ProjectLanguage } from '../shared/project-format';
import { microBoard } from '../shared/boards';
import { MicroPythonService, validateRemotePath } from './micropython';
import { ArduinoService, ESP32_CORE, ESP32_INDEX_URL, parseBoards, parsePorts, validateBaud, validatePort } from './arduino';
import { CommandRunner, SerialSession } from './processes';
import { SettingsStore } from './settings';

app.setName('EduBoard IDE');
if (process.env.EDUBOARD_USER_DATA) app.setPath('userData', process.env.EDUBOARD_USER_DATA);
let mainWindow: BrowserWindow | null = null;
let currentSketchPath: string | null = null;
let currentProjectPath: string | null = null;
let currentLanguage: ProjectLanguage = 'arduino';
let preparedFirmware: FirmwareInfo | null = null;
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
const python = new MicroPythonService(runner, serial, () => ({ executable: settings.get().pythonPath, args: [] }),
  app.isPackaged ? join(process.resourcesPath, 'tool_bridge.py') : join(app.getAppPath(), 'apps/desktop/resources/tool_bridge.py'), join(app.getPath('temp'), 'eduboard-firmware'));

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
    const document = existing.document!;
    const saved = await writeProject(currentProjectPath, { ...document, mode: 'text', source: safeSource,
      ...(document.drafts ? { drafts: { ...document.drafts, [document.language]: safeSource } } : {}) });
    arduino.invalidate();
    return saved;
  }
  let targetPath = currentSketchPath;
  if (currentLanguage === 'micropython' && targetPath) {
    await atomicWrite(targetPath, safeSource);
    return { filePath: targetPath, name: basename(targetPath), source: safeSource };
  }
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
  let targetPath = currentProjectPath ?? (currentSketchPath ? projectPathForSource(currentSketchPath) : null);
  if (!targetPath) {
    // A standalone script cannot become a project in place (projects need Name/Name.eduboard.json), so ask where to put it.
    const fallback = document.language === 'arduino' ? 'Blink' : 'PythonProject';
    const defaultPath = currentSketchPath ? join(dirname(currentSketchPath), defaultProjectName(currentSketchPath, fallback) + '.eduboard.json') : join(app.getPath('documents'), fallback + '.eduboard.json');
    const selected = await dialog.showSaveDialog({ title: '保存 EduBoard 项目（将创建同名文件夹）', defaultPath, filters: [{ name: 'EduBoard Project', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePath) return null;
    targetPath = normalizeProjectPath(selected.filePath);
  }
  const exists = (path: string): Promise<boolean> => lstat(path).then(() => true, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return false; throw error; });
  const targetSource = projectSourcePath(targetPath, document.language);
  // An existing export is ours only if it still holds what this project last saved for that language.
  const foreignSource = async (): Promise<boolean> => {
    if (generationFailed(document) || !(await exists(targetSource))) return false;
    // Converting the opened standalone source into a project: that file is the one being edited.
    if (!currentProjectPath && targetSource === currentSketchPath) return false;
    if (targetPath !== currentProjectPath) return true;
    // Within a project, the export may have been edited outside the IDE since the last save.
    const saved = await readProject(targetPath).then(project => project.document!, () => null);
    return readFile(targetSource, 'utf8').then(text => exportNeedsConfirmation(text, saved, document.language), () => true);
  };
  if (targetPath !== currentProjectPath && await exists(targetPath) || await foreignSource()) {
    const choice = await dialog.showMessageBox({ type: 'warning', title: '覆盖已有项目？', message: targetPath, detail: '是否覆盖已有项目数据及程序？\n' + targetSource, buttons: ['取消', '覆盖'], defaultId: 0, cancelId: 0 });
    if (choice.response !== 1) return null;
  }
  const saved = await writeProject(targetPath, document);
  currentProjectPath = saved.projectPath!;
  currentSketchPath = saved.filePath;
  currentLanguage = document.language;
  arduino.invalidate();
  return saved;
}

async function pythonProject(): Promise<string> {
  if (currentLanguage !== 'micropython' || !currentSketchPath) throw new Error('请先保存 MicroPython 项目。');
  const script = await readPythonScript(currentSketchPath);
  if (currentProjectPath && (await readProject(currentProjectPath)).source !== script.source) throw new Error('导出的 Python 程序与项目不一致，请保存后重试。');
  return script.filePath;
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
  handle('project:new', (language) => operation(async () => {
    if (language !== undefined && language !== 'arduino' && language !== 'micropython') throw new Error('未知项目语言。');
    await serial.stop();
    currentSketchPath = null; currentProjectPath = null; currentLanguage = language === 'micropython' ? language : 'arduino'; arduino.invalidate();
  }));
  handle('project:open', () => operation(async (): Promise<Sketch | null> => {
    const selection = await dialog.showOpenDialog({
      title: '打开 EduBoard 项目或源程序', properties: ['openFile'], filters: [{ name: 'EduBoard / Source', extensions: ['json', 'ino', 'py'] }]
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const selectedPath = selection.filePaths[0];
    const opened = selectedPath.toLowerCase().endsWith('.eduboard.json') ? await readProject(selectedPath)
      : selectedPath.toLowerCase().endsWith('.py') ? await readPythonScript(selectedPath) : await readSketch(selectedPath);
    await serial.stop();
    currentSketchPath = opened.filePath;
    currentProjectPath = opened.projectPath || null;
    currentLanguage = opened.document?.language || (selectedPath.toLowerCase().endsWith('.py') ? 'micropython' : 'arduino');
    arduino.invalidate();
    return opened;
  }));
  handle('project:save', (source) => operation(() => saveSketch(source)));
  handle('project:save-document', (document) => operation(() => saveProject(document)));
  handle('cli:compile', (board) => operation(async (): Promise<CommandResult> => {
    if (!currentSketchPath) return { ok: false, stdout: '', stderr: '请先保存项目。' };
    if (currentLanguage !== 'arduino') return { ok: false, stdout: '', stderr: '当前项目是 MicroPython，请使用检查语法或运行。' };
    if (currentProjectPath && (await readProject(currentProjectPath)).source !== (await readSketch(currentSketchPath)).source) {
      return { ok: false, stdout: '', stderr: '导出的程序与项目文件不一致，请保存项目后重新编译。' };
    }
    return arduino.compile(currentSketchPath, board);
  }));
  handle('cli:upload', (board, port) => operation(async (): Promise<CommandResult> => {
    if (!currentSketchPath) return { ok: false, stdout: '', stderr: '请先保存项目。' };
    if (currentLanguage !== 'arduino') return { ok: false, stdout: '', stderr: '当前项目是 MicroPython。' };
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
  handle('python:info', () => python.info());
  handle('python:ports', () => python.ports());
  handle('python:check', () => operation(async () => python.check(await pythonProject())));
  handle('python:run', (port, baud) => operation(async () => python.runScript(await pythonProject(), port, baud)));
  handle('python:repl', (port, baud) => operation(() => python.startRepl(port, baud)));
  handle('python:interrupt', () => operation(() => python.interrupt()));
  handle('python:files', (port) => operation(() => python.list(port)));
  handle('python:upload', (port, destination) => operation(async (): Promise<CommandResult> => {
    const path = await pythonProject(); const target = validateRemotePath(destination);
    const choice = await dialog.showMessageBox({ type: 'warning', title: '上传到开发板？', message: String(port) + ' → ' + target, detail: '这会替换设备上的同名文件；main.py / boot.py 会影响启动行为。', buttons: ['取消', '上传'], defaultId: 0, cancelId: 0 });
    return choice.response === 1 ? python.upload(path, port, target) : { ok: false, stdout: '', stderr: '已取消上传。', cancelled: true };
  }));
  handle('python:download', (port, source) => operation(async (): Promise<CommandResult | null> => {
    const remote = validateRemotePath(source);
    const selected = await dialog.showSaveDialog({ title: '保存设备文件', defaultPath: join(app.getPath('documents'), posix.basename(remote)) });
    if (selected.canceled || !selected.filePath) return null;
    return python.download(port, remote, selected.filePath);
  }));
  handle('python:delete', (port, target) => operation(async (): Promise<CommandResult> => {
    const remote = validateRemotePath(target);
    const selected = await dialog.showMessageBox({ type: 'warning', title: '删除设备文件？', message: String(port) + ' → ' + remote, detail: '删除后无法撤销。', buttons: ['取消', '删除'], defaultId: 0, cancelId: 0 });
    return selected.response === 1 ? python.remove(port, remote) : { ok: false, stdout: '', stderr: '已取消删除。', cancelled: true };
  }));
  handle('python:choose-firmware', (boardId) => operation(async (): Promise<FirmwareInfo | null> => {
    const board = microBoard(boardId);
    preparedFirmware = null;
    const selected = await dialog.showOpenDialog({ title: '选择 ' + board.name + ' 的指定官方固件', properties: ['openFile'], filters: [{ name: 'Firmware', extensions: ['bin'] }] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    preparedFirmware = await python.prepare(selected.filePaths[0], board.id);
    return preparedFirmware;
  }));
  handle('python:flash', (token, port) => operation(async (): Promise<CommandResult> => {
    if (!preparedFirmware || token !== preparedFirmware.token) throw new Error('请重新选择并确认固件。');
    const board = microBoard(preparedFirmware.boardId);
    const selected = await dialog.showMessageBox({ type: 'warning', title: '擦除并刷入 MicroPython？', message: board.name + ' · 串口 ' + String(port),
      detail: '将擦除全部闪存，覆盖固件和设备文件。\n' + board.notes + '\n固件 ' + preparedFirmware.filename + '\nSHA-256 ' + preparedFirmware.sha256,
      buttons: ['取消', '确认擦除并刷入'], defaultId: 0, cancelId: 0 });
    if (selected.response !== 1) return { ok: false, stdout: '', stderr: '已取消刷机。', cancelled: true };
    try { return await python.flash(token, port); } finally { preparedFirmware = null; }
  }));
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
