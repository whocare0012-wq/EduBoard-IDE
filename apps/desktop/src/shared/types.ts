// SPDX-License-Identifier: GPL-3.0-only
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
  newSketch(): Promise<void>;
  openSketch(): Promise<Sketch | null>;
  saveSketch(source: string): Promise<Sketch | null>;
  compile(fqbn: string): Promise<CommandResult>;
  upload(fqbn: string, port: string): Promise<CommandResult>;
  startMonitor(port: string, baud: number): Promise<ActionResult>;
  stopMonitor(): Promise<void>;
  sendMonitor(text: string): Promise<void>;
  onMonitorData(listener: (data: string) => void): () => void;
  onMonitorState(listener: (running: boolean) => void): () => void;
}
