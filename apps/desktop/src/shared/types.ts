// SPDX-License-Identifier: GPL-3.0-only
import type { ProjectDocument } from './project-format';
import type { MicroBoardId } from './boards';
export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  cancelled?: boolean;
  streamed?: boolean;
}

export interface Sketch {
  filePath: string;
  name: string;
  source: string;
  document?: ProjectDocument;
  projectPath?: string;
}

export interface PortInfo {
  address: string;
  label: string;
}

export interface PortsResult extends CommandResult {
  ports: PortInfo[];
}

export interface BoardInfo { fqbn: string; name: string; }
export interface BoardsResult extends CommandResult { boards: BoardInfo[]; }
export interface ToolSettings { arduinoCliPath: string; arduinoConfigPath: string; pythonPath: string; }
export interface PythonToolsResult extends CommandResult { versions: Record<string, string | null>; }
export interface FirmwareInfo { token: string; boardId: MicroBoardId; filename: string; sha256: string; bytes: number; version: string; offset: number; }
export interface DeviceFilesResult extends CommandResult { files: Array<{ name: string; size: number; directory: boolean }>; truncated?: boolean; }

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface EduBoardApi {
  cliVersion(): Promise<CommandResult>;
  ports(): Promise<PortsResult>;
  boards(): Promise<BoardsResult>;
  toolSettings(): Promise<ToolSettings>;
  chooseTool(tool: 'arduinoCliPath' | 'arduinoConfigPath' | 'pythonPath'): Promise<ToolSettings | null>;
  installEsp32(): Promise<CommandResult>;
  cancelTask(): Promise<void>;
  onTaskOutput(listener: (data: string) => void): () => void;
  pythonInfo(): Promise<PythonToolsResult>;
  pythonPorts(): Promise<PortsResult>;
  checkPython(): Promise<CommandResult>;
  runPython(port: string, baud: number): Promise<CommandResult>;
  startRepl(port: string, baud: number): Promise<ActionResult>;
  interruptPython(): Promise<void>;
  listDeviceFiles(port: string): Promise<DeviceFilesResult>;
  uploadPython(port: string, path: string): Promise<CommandResult>;
  downloadDeviceFile(port: string, path: string): Promise<CommandResult | null>;
  deleteDeviceFile(port: string, path: string): Promise<CommandResult>;
  chooseFirmware(boardId: MicroBoardId): Promise<FirmwareInfo | null>;
  flashFirmware(token: string, port: string): Promise<CommandResult>;
  newSketch(language?: ProjectDocument['language']): Promise<void>;
  openSketch(): Promise<Sketch | null>;
  saveSketch(source: string): Promise<Sketch | null>;
  saveProject(document: ProjectDocument): Promise<Sketch | null>;
  installExampleLibraries(): Promise<CommandResult>;
  compile(fqbn: string): Promise<CommandResult>;
  upload(fqbn: string, port: string): Promise<CommandResult>;
  startMonitor(port: string, baud: number): Promise<ActionResult>;
  stopMonitor(): Promise<void>;
  sendMonitor(text: string): Promise<void>;
  onMonitorData(listener: (data: string) => void): () => void;
  onMonitorState(listener: (running: boolean) => void): () => void;
}
