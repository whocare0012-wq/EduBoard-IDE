// SPDX-License-Identifier: GPL-3.0-only
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { monaco, EDITOR_THEME } from './editor';
import type { ProjectLanguage } from '../../shared/project-format';
import type { SourceDiagnostic } from '../../shared/types';

export interface EditorDiagnostics {
  session: number; language: ProjectLanguage; preview: boolean; source: string; diagnostics: SourceDiagnostic[];
}
export interface EditorLocation {
  id: number; session: number; language: ProjectLanguage; preview: boolean; source: string; line: number; column: number;
}

interface Props {
  session: number;
  language: ProjectLanguage;
  preview: boolean;
  value: string;
  disabled: boolean;
  reports: EditorDiagnostics[];
  location: EditorLocation | null;
  onChange: (value: string, language: ProjectLanguage) => void;
}
interface BufferState {
  model: editor.ITextModel; view: editor.ICodeEditorViewState | null; session: number;
  preview: boolean; language: ProjectLanguage; subscription?: { dispose(): void };
}
export interface CodeEditorHandle { drafts(): Partial<Record<ProjectLanguage, string>>; }

/** Own four models per project: two editable buffers and two isolated generated previews. */
const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor(props, ref) {
  const latest = useRef(props); latest.current = props;
  const instance = useRef<editor.IStandaloneCodeEditor | null>(null);
  const buffers = useRef(new Map<string, BufferState>());
  const active = useRef('');
  const changing = useRef(false);
  const revealed = useRef<EditorLocation | null>(null);
  useImperativeHandle(ref, () => ({ drafts: () => Object.fromEntries([...buffers.current.values()]
    .filter(buffer => !buffer.preview && buffer.session === latest.current.session)
    .map(buffer => [buffer.language, buffer.model.getValue()])) }));
  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
    minimap: { enabled: false }, fontSize: 14, lineHeight: 22, fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace', fontLigatures: false,
    padding: { top: 12, bottom: 12 }, automaticLayout: true, tabSize: 2, readOnly: props.disabled || props.preview, accessibilitySupport: 'on', editContext: false,
    renderLineHighlight: 'all', renderValidationDecorations: 'on', smoothScrolling: true, cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on', roundedSelection: true, guides: { indentation: true },
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false }, overviewRulerBorder: false, overviewRulerLanes: 0, hideCursorInOverviewRuler: true, lineNumbersMinChars: 3,
    ariaLabel: props.preview ? '生成代码预览' : props.language === 'arduino' ? 'Arduino C++ 代码编辑器' : 'MicroPython 代码编辑器', scrollBeyondLastLine: false
  }), [props.disabled, props.preview, props.language]);

  function sync(): void {
    const current = instance.current;
    if (!current) return;
    const next = latest.current;
    current.updateOptions({ readOnly: next.disabled || next.preview,
      ariaLabel: next.preview ? '生成代码预览' : next.language === 'arduino' ? 'Arduino C++ 代码编辑器' : 'MicroPython 代码编辑器' });
    const key = next.session + ':' + (next.preview ? 'preview:' : 'text:') + next.language;
    let buffer = buffers.current.get(key);
    if (!buffer) {
      buffer = { model: monaco.editor.createModel(next.value, next.language === 'arduino' ? 'cpp' : 'python',
        monaco.Uri.parse('eduboard://project-' + next.session + '/' + (next.preview ? 'preview-' : '') + next.language)),
        view: null, session: next.session, preview: next.preview, language: next.language };
      const owned = buffer;
      if (!owned.preview) owned.subscription = owned.model.onDidChangeContent(() => {
        // An asynchronous undo may finish after its language has been hidden or input disabled.
        if (!changing.current && owned.session === latest.current.session) {
          monaco.editor.setModelMarkers(owned.model, 'eduboard-check', []);
          latest.current.onChange(owned.model.getValue(), owned.language);
        }
      });
      buffers.current.set(key, buffer);
    }
    changing.current = true;
    try {
      if (active.current !== key) {
        const previous = buffers.current.get(active.current);
        if (previous) previous.view = current.saveViewState();
        current.setModel(buffer.model);
        active.current = key;
        if (buffer.view) current.restoreViewState(buffer.view);
      }
      if (buffer.model.getValue() !== next.value) {
        if (next.preview) buffer.model.setValue(next.value);
        else {
          // Explicit adoption remains undoable; a mode switch never replaces an existing draft.
          buffer.model.pushStackElement();
          buffer.model.pushEditOperations(current.getSelections(), [{ range: buffer.model.getFullModelRange(), text: next.value, forceMoveMarkers: true }], () => null);
          buffer.model.pushStackElement();
        }
      }
      for (const [id, previous] of buffers.current) {
        if (previous.session !== next.session) { previous.subscription?.dispose(); previous.model.dispose(); buffers.current.delete(id); }
      }
    } finally { changing.current = false; }
    syncMarkers();
    reveal();
  }

  function syncMarkers(): void {
    for (const buffer of buffers.current.values()) {
      const source = buffer.model.getValue();
      const report = latest.current.reports.find(item => item.session === buffer.session && item.language === buffer.language
        && item.preview === buffer.preview && item.source === source);
      const markers: editor.IMarkerData[] = (report?.diagnostics || []).filter(item => item.line <= buffer.model.getLineCount()).map(item => {
        const column = Math.min(item.column, buffer.model.getLineMaxColumn(item.line));
        const word = buffer.model.getWordAtPosition({ lineNumber: item.line, column });
        return { startLineNumber: item.line, endLineNumber: item.line, startColumn: column,
          endColumn: Math.max(column + 1, word?.endColumn || column + 1), message: item.message,
          severity: item.severity === 'error' ? monaco.MarkerSeverity.Error : item.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
          source: buffer.language === 'arduino' ? 'Arduino C++' : 'Python syntax' };
      });
      monaco.editor.setModelMarkers(buffer.model, 'eduboard-check', markers);
    }
  }

  function reveal(): void {
    const { location, session, language, preview, value } = latest.current;
    if (!location) { revealed.current = null; return; }
    const current = instance.current;
    if (!current || revealed.current === location || location.session !== session || location.language !== language
      || location.preview !== preview || location.source !== value) return;
    revealed.current = location;
    // The preview may have just been expanded; let its new container size reach Monaco first.
    requestAnimationFrame(() => {
      if (instance.current !== current || latest.current.location !== location) return;
      const model = current.getModel();
      if (!model || model.getValue() !== location.source) return;
      const position = model.validatePosition({ lineNumber: location.line, column: location.column });
      current.layout(); current.setPosition(position);
      current.revealPositionInCenter(position, monaco.editor.ScrollType.Immediate); current.focus();
    });
  }

  useLayoutEffect(sync, [props.session, props.language, props.preview, props.value]);
  useLayoutEffect(syncMarkers, [props.reports]);
  useLayoutEffect(reveal, [props.location]);
  useLayoutEffect(() => {
    const next = latest.current;
    instance.current?.updateOptions({ readOnly: next.disabled || next.preview,
      ariaLabel: next.preview ? '生成代码预览' : next.language === 'arduino' ? 'Arduino C++ 代码编辑器' : 'MicroPython 代码编辑器' });
  }, [props.disabled, props.preview, props.language]);
  useEffect(() => () => {
    for (const buffer of buffers.current.values()) { buffer.subscription?.dispose(); buffer.model.dispose(); }
    buffers.current.clear(); instance.current = null;
  }, []);

  return <Editor height="100%" theme={EDITOR_THEME} options={options} keepCurrentModel saveViewState={false}
    loading={<p className="hint">正在加载本地编辑器…</p>} onMount={current => {
      const bootstrap = current.getModel();
      instance.current = current; sync(); bootstrap?.dispose();
    }} />;
});

export default CodeEditor;
