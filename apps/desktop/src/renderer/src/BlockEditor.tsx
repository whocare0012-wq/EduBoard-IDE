// SPDX-License-Identifier: GPL-3.0-only
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Blockly from 'blockly/core';
import { registerBlocks, TOOLBOX } from '../../shared/blocks/definitions';
import { snapshotWorkspace, type BlockSnapshot } from '../../shared/blocks/snapshot';
import type { ProjectLanguage, WorkspaceState } from '../../shared/project-format';

export type { BlockSnapshot } from '../../shared/blocks/snapshot';
export interface BlockEditorHandle { snapshot(): BlockSnapshot; }
interface Props { initial: WorkspaceState; language: ProjectLanguage; disabled: boolean; onUpdate: (snapshot: BlockSnapshot, changed: boolean) => void; }

const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor({ initial, language, disabled, onUpdate }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const listener = useRef(onUpdate);
  const loadError = useRef('');
  listener.current = onUpdate;
  function snapshot(): BlockSnapshot {
    if (!workspace.current) throw new Error('积木编辑器尚未准备好。');
    if (loadError.current) return { code: '', warnings: [], libraries: [], workspace: initial, error: loadError.current };
    return snapshotWorkspace(workspace.current, language);
  }
  useImperativeHandle(ref, () => ({ snapshot: () => { Blockly.WidgetDiv.hide(); return snapshot(); } }));
  useEffect(() => {
    if (container.current) container.current.inert = disabled;
    if (disabled) { Blockly.WidgetDiv.hide(); Blockly.DropDownDiv.hideWithoutAnimation(); }
  }, [disabled]);
  useEffect(() => {
    registerBlocks();
    if (!container.current) return;
    const current = Blockly.inject(container.current, {
      theme: Blockly.Theme.defineTheme('eduboard', { name: 'eduboard', base: Blockly.Themes.Classic,
        componentStyles: { workspaceBackgroundColour: '#f9fbff', toolboxBackgroundColour: '#e5ebf3', toolboxForegroundColour: '#18263a', flyoutBackgroundColour: '#dde6f2', flyoutForegroundColour: '#18263a', flyoutOpacity: 1, scrollbarColour: '#91a4bf' } }),
      toolbox: TOOLBOX, media: './', sounds: false, trashcan: true,
      scrollbars: true, zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 1.5, minScale: 0.2 },
      grid: { spacing: 20, length: 2, colour: '#bcc7d5', snap: true }
    });
    workspace.current = current;
    Blockly.Events.disable();
    try { Blockly.serialization.workspaces.load(initial, current); }
    catch (error) { loadError.current = '积木工作区加载失败，请检查项目格式或从备份恢复：' + String(error); }
    finally { Blockly.Events.enable(); }
    listener.current(snapshot(), false);
    const fit = requestAnimationFrame(() => { if (workspace.current === current) { Blockly.svgResize(current); current.zoomToFit(); } });
    const changed = (event: Blockly.Events.Abstract): void => {
      if (!event.isUiEvent && event.type !== Blockly.Events.FINISHED_LOADING) listener.current(snapshot(), true);
    };
    current.addChangeListener(changed);
    const resize = new ResizeObserver(() => Blockly.svgResize(current));
    resize.observe(container.current);
    return () => {
      cancelAnimationFrame(fit); resize.disconnect(); current.removeChangeListener(changed); current.dispose(); workspace.current = null;
    };
  }, []);
  return <div ref={container} className="blockly-container" aria-label="Blockly 积木工作区" />;
});

export default BlockEditor;
