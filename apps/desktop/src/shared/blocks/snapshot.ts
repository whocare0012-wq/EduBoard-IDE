// SPDX-License-Identifier: GPL-3.0-only
import * as Blockly from 'blockly/core';
import { registerBlocks } from './definitions';
import { generateArduino, type GeneratedCode } from './arduino-generator';
import { generateMicroPython } from './python-generator';
import type { ProjectLanguage, WorkspaceState } from '../project-format';

export interface BlockSnapshot extends GeneratedCode { workspace: WorkspaceState; error: string; }

export function snapshotWorkspace(workspace: Blockly.Workspace, language: ProjectLanguage): BlockSnapshot {
  const state = Blockly.serialization.workspaces.save(workspace) as WorkspaceState;
  try { return { ...(language === 'arduino' ? generateArduino(workspace) : generateMicroPython(workspace)), workspace: state, error: '' }; }
  catch (error) { return { code: '', warnings: [], libraries: [], workspace: state, error: String(error) }; }
}

export function generateFromState(state: WorkspaceState, language: ProjectLanguage): BlockSnapshot {
  registerBlocks();
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, workspace);
    return snapshotWorkspace(workspace, language);
  } finally { workspace.dispose(); }
}
