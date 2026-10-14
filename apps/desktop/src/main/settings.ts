// SPDX-License-Identifier: GPL-3.0-only
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { ToolSettings } from '../shared/types';
import { atomicWrite } from './projects';

export class SettingsStore {
  private value: ToolSettings = {
    arduinoCliPath: process.env.ARDUINO_CLI_PATH?.trim() || 'arduino-cli',
    arduinoConfigPath: process.env.ARDUINO_CLI_CONFIG_FILE?.trim() || '',
    pythonPath: process.env.EDUBOARD_PYTHON_PATH?.trim() || 'python'
  };
  constructor(private readonly file: string) {}

  async load(): Promise<void> {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as Partial<ToolSettings>;
      for (const key of ['arduinoCliPath', 'arduinoConfigPath', 'pythonPath'] as const) {
        const path = saved[key];
        if (typeof path === 'string' && path.length < 2000 && (path === '' || isAbsolute(path))) this.value[key] = path;
      }
    } catch { /* Missing/corrupt preferences fall back to tool detection without touching projects. */ }
  }

  get(): ToolSettings { return { ...this.value }; }

  async set(key: keyof ToolSettings, path: string): Promise<ToolSettings> {
    const updated = { ...this.value, [key]: path };
    await atomicWrite(this.file, JSON.stringify(updated, null, 2) + '\n');
    this.value = updated;
    return this.get();
  }
}
