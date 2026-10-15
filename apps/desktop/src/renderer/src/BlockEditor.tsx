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
      // Colours mirror the CSS design tokens in styles.css.
      theme: Blockly.Theme.defineTheme('eduboard-dark', { name: 'eduboard-dark', base: Blockly.Themes.Classic,
        componentStyles: { workspaceBackgroundColour: '#0f1318', toolboxBackgroundColour: '#151a21', toolboxForegroundColour: '#c9d1dd', flyoutBackgroundColour: '#1a2029',
          flyoutForegroundColour: '#c9d1dd', flyoutOpacity: 0.97, scrollbarColour: '#3a4352', scrollbarOpacity: 0.8, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3,
          markerColour: '#8fb3ff', cursorColour: '#8fb3ff', selectedGlowColour: '#8fb3ff' },
        fontStyle: { family: '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", sans-serif', weight: '500', size: 11 } }),
      toolbox: TOOLBOX, media: './', sounds: false, trashcan: true, renderer: 'zelos',
      scrollbars: true, zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 1.5, minScale: 0.3 },
      grid: { spacing: 24, length: 2, colour: '#232a35', snap: true }
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
