// SPDX-License-Identifier: GPL-3.0-only
import { microBoard, type MicroBoardId } from './boards';
export type ProjectLanguage = 'arduino' | 'micropython';
export type ProjectMode = 'text' | 'blocks';
export type WorkspaceState = Record<string, unknown>;
export type TextDrafts = Record<ProjectLanguage, string | null>;
export const FQBN_PATTERN = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+(?::[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+)*)?$/;

export interface ProjectDocument {
  format: 'eduboard-project';
  version: 1;
  language: ProjectLanguage;
  mode: ProjectMode;
  source: string;
  fqbn: string;
  workspace: WorkspaceState | null;
  microBoard?: MicroBoardId;
  drafts?: TextDrafts;
  blockTarget?: ProjectLanguage;
}

export const BLOCK_TYPES = new Set([
  'edu_setup', 'edu_loop', 'edu_pin_mode', 'edu_write', 'edu_read', 'edu_analog_read', 'edu_delay', 'edu_print',
  'edu_dht_read', 'edu_oled_text', 'edu_pixel',
  'math_number', 'math_arithmetic', 'math_modulo', 'math_change', 'logic_boolean', 'logic_compare',
  'logic_operation', 'logic_negate', 'controls_if', 'controls_repeat_ext', 'controls_whileUntil',
  'variables_get', 'variables_set', 'text'
]);

export const SENSOR_LIBRARIES = [
  'Adafruit Unified Sensor@1.1.15', 'Adafruit BusIO@1.17.4', 'Adafruit GFX Library@1.12.6',
  'DHT sensor library@1.4.7', 'Adafruit SH110X@2.1.15', 'Adafruit NeoPixel@1.15.5'
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
}

export function validateWorkspace(value: unknown): WorkspaceState {
  if (!record(value) || Object.keys(value).some(key => key !== 'blocks' && key !== 'variables')) throw new Error('不支持的积木项目结构。');
  if (value.blocks !== undefined && (!record(value.blocks) || value.blocks.blocks !== undefined && !Array.isArray(value.blocks.blocks))) throw new Error('无效的积木列表。');
  if (value.variables !== undefined && !Array.isArray(value.variables)) throw new Error('无效的变量列表。');
  let nodes = 0;
  let blockCount = 0;
  function visit(node: unknown, depth: number, isBlock = false): void {
    if (++nodes > 30_000 || depth > 100) throw new Error('积木项目过大或嵌套过深。');
    if (isBlock && !Array.isArray(node) && !record(node)) throw new Error('无效的积木对象。');
    if (typeof node === 'string' && node.length > 65_536) throw new Error('积木字段过长。');
    if (node && typeof node === 'object') {
      if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1, isBlock); return; }
      if (!record(node)) throw new Error('无效的积木字段。');
      if (isBlock) {
        if (typeof node.type !== 'string' || !BLOCK_TYPES.has(node.type) || ++blockCount > 1000) throw new Error('项目包含不支持的积木或积木数量超过 1000。');
        if (record(node.extraState)) {
          const count = node.extraState.elseIfCount;
          if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 20)) throw new Error('条件分支数量须在 0–20 之间。');
        }
      }
      for (const [key, item] of Object.entries(node)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('不安全的积木字段。');
        visit(item, depth + 1, key === 'block' || key === 'shadow' || key === 'blocks' && Array.isArray(item));
      }
    }
  }
  visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 2_000_000) throw new Error('积木工作区须小于 2 MB。');
  return value;
}

export function validateProject(value: unknown): ProjectDocument {
  if (!record(value) || value.format !== 'eduboard-project' || value.version !== 1) throw new Error('未知项目格式或版本。');
  if (value.language !== 'arduino' && value.language !== 'micropython') throw new Error('未知项目语言。');
  if (value.mode !== 'text' && value.mode !== 'blocks') throw new Error('未知编辑模式。');
  if (typeof value.source !== 'string' || new TextEncoder().encode(value.source).length > 1_000_000) throw new Error('程序文本须小于 1 MB。');
  if (typeof value.fqbn !== 'string' || value.fqbn.length > 240 || !FQBN_PATTERN.test(value.fqbn)) throw new Error('无效的项目开发板目标。');
  const workspace = value.workspace === null ? null : validateWorkspace(value.workspace);
  if (value.mode === 'blocks' && !workspace) throw new Error('积木项目缺少工作区。');
  const selectedBoard = value.microBoard !== undefined || value.language === 'micropython' ? microBoard(value.microBoard ?? 'esp32').id : undefined;
  let drafts: TextDrafts | undefined;
  if (value.drafts !== undefined) {
    if (!record(value.drafts) || Object.keys(value.drafts).some(key => key !== 'arduino' && key !== 'micropython')) throw new Error('无效的文本工作区。');
    for (const language of ['arduino', 'micropython'] as const) {
      const draft = value.drafts[language];
      if (draft !== null && (typeof draft !== 'string' || new TextEncoder().encode(draft).length > 1_000_000)) throw new Error('每个文本工作区须小于 1 MB。');
    }
    drafts = { arduino: value.drafts.arduino as string | null, micropython: value.drafts.micropython as string | null };
    if (value.mode === 'text' && drafts[value.language] !== value.source) throw new Error('当前程序与文本工作区不一致。');
  }
  if (value.blockTarget !== undefined && value.blockTarget !== 'arduino' && value.blockTarget !== 'micropython') throw new Error('未知积木生成目标。');
  if (value.mode === 'blocks' && value.blockTarget !== undefined && value.blockTarget !== value.language) throw new Error('积木生成目标与当前语言不一致。');
  return { format: 'eduboard-project', version: 1, language: value.language, mode: value.mode, source: value.source, fqbn: value.fqbn, workspace,
    ...(selectedBoard ? { microBoard: selectedBoard } : {}), ...(drafts ? { drafts } : {}), ...(value.blockTarget ? { blockTarget: value.blockTarget } : {}) };
}
