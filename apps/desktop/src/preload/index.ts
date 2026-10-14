// SPDX-License-Identifier: GPL-3.0-only
import { contextBridge, ipcRenderer } from 'electron';
import type { EduBoardApi, Sketch, CommandResult, PortsResult, ActionResult, BoardsResult, ToolSettings, PythonToolsResult, DeviceFilesResult, FirmwareInfo } from '../shared/types';

const api: EduBoardApi = {
  cliVersion: () => ipcRenderer.invoke('cli:version') as Promise<CommandResult>,
  ports: () => ipcRenderer.invoke('cli:ports') as Promise<PortsResult>,
  boards: () => ipcRenderer.invoke('cli:boards') as Promise<BoardsResult>,
  toolSettings: () => ipcRenderer.invoke('tools:get') as Promise<ToolSettings>,
  chooseTool: (tool) => ipcRenderer.invoke('tools:choose', tool) as Promise<ToolSettings | null>,
  installEsp32: () => ipcRenderer.invoke('cli:install-esp32') as Promise<CommandResult>,
  cancelTask: () => ipcRenderer.invoke('task:cancel') as Promise<void>,
  onTaskOutput: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string): void => listener(data);
    ipcRenderer.on('task:output', handler);
    return () => ipcRenderer.removeListener('task:output', handler);
  },
  newSketch: (language) => ipcRenderer.invoke('project:new', language) as Promise<void>,
  openSketch: () => ipcRenderer.invoke('project:open') as Promise<Sketch | null>,
  saveSketch: (source) => ipcRenderer.invoke('project:save', source) as Promise<Sketch | null>,
  saveProject: (document) => ipcRenderer.invoke('project:save-document', document) as Promise<Sketch | null>,
  installExampleLibraries: () => ipcRenderer.invoke('cli:install-example-libraries') as Promise<CommandResult>,
  pythonInfo: () => ipcRenderer.invoke('python:info') as Promise<PythonToolsResult>,
  pythonPorts: () => ipcRenderer.invoke('python:ports') as Promise<PortsResult>,
  checkPython: () => ipcRenderer.invoke('python:check') as Promise<CommandResult>,
  runPython: (port, baud) => ipcRenderer.invoke('python:run', port, baud) as Promise<CommandResult>,
  startRepl: (port, baud) => ipcRenderer.invoke('python:repl', port, baud) as Promise<ActionResult>,
  interruptPython: () => ipcRenderer.invoke('python:interrupt') as Promise<void>,
  listDeviceFiles: (port) => ipcRenderer.invoke('python:files', port) as Promise<DeviceFilesResult>,
  uploadPython: (port, path) => ipcRenderer.invoke('python:upload', port, path) as Promise<CommandResult>,
  downloadDeviceFile: (port, path) => ipcRenderer.invoke('python:download', port, path) as Promise<CommandResult | null>,
  deleteDeviceFile: (port, path) => ipcRenderer.invoke('python:delete', port, path) as Promise<CommandResult>,
  chooseFirmware: (boardId) => ipcRenderer.invoke('python:choose-firmware', boardId) as Promise<FirmwareInfo | null>,
  flashFirmware: (token, port) => ipcRenderer.invoke('python:flash', token, port) as Promise<CommandResult>,
  compile: (fqbn) => ipcRenderer.invoke('cli:compile', fqbn) as Promise<CommandResult>,
  upload: (fqbn, port) => ipcRenderer.invoke('cli:upload', fqbn, port) as Promise<CommandResult>,
  startMonitor: (port, baud) => ipcRenderer.invoke('monitor:start', port, baud) as Promise<ActionResult>,
  stopMonitor: () => ipcRenderer.invoke('monitor:stop') as Promise<void>,
  sendMonitor: (text) => ipcRenderer.invoke('monitor:send', text) as Promise<void>,
  onMonitorData: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string): void => listener(data);
    ipcRenderer.on('monitor:data', handler);
    return () => ipcRenderer.removeListener('monitor:data', handler);
  },
  onMonitorState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, running: boolean): void => listener(running);
    ipcRenderer.on('monitor:state', handler);
    return () => ipcRenderer.removeListener('monitor:state', handler);
  }
};

contextBridge.exposeInMainWorld('eduboard', api);
