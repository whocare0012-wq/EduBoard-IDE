// SPDX-License-Identifier: GPL-3.0-only
export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
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

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface EduBoardApi {
  cliVersion(): Promise<CommandResult>;
  ports(): Promise<PortsResult>;
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
