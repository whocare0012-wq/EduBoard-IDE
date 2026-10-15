// SPDX-License-Identifier: GPL-3.0-only
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardInfo, CommandResult, PortInfo, Sketch, SourceDiagnostic, ToolSettings } from '../../shared/types';
import { appendOutput, displayResult, outputLines, type OutputChunk } from '../../shared/console-output';
import CodeEditor, { type CodeEditorHandle, type EditorDiagnostics, type EditorLocation } from './CodeEditor';
import ResizeHandle from './ResizeHandle';
import useWorkspaceLayout from './useWorkspaceLayout';
import { icons } from './icons';
import ConfirmDialog, { DISCARD_TEXT, type ConfirmText } from './ConfirmDialog';
import type { BlockEditorHandle } from './BlockEditor';
import type { ProjectDocument, ProjectLanguage, ProjectMode, TextDrafts, WorkspaceState } from '../../shared/project-format';
import { TEMPLATES, examplePins, microTemplate } from '../../shared/blocks/templates';
import { MICRO_BOARDS, type MicroBoardId } from '../../shared/boards';
import MicroPythonPane from './MicroPythonPane';

const BlockEditor = lazy(() => import('./BlockEditor'));
type SidebarPanel = 'project' | 'device' | 'tools';
interface DiagnosticRun extends EditorDiagnostics { id: number; }

/** Colour console lines; detail lines under a failed step stay red until the next step or blank line. */
function consoleLineClasses(lines: string[]): Array<string | undefined> {
  let failing = false;
  return lines.map(line => {
    const step = /^\[[^\]]+\]/.test(line);
    if (step || !line.trim()) failing = false;
    if (/^\[错误\]|\] 失败|^\[[^\]]*失败\]|未找到工具|Error|error:/.test(line)) { failing = step || failing; return 'line-error'; }
    if (failing) return 'line-error';
    if (/\] 成功|^\[已保存\]/.test(line)) return 'line-success';
    return step ? 'line-step' : undefined;
  });
}

/** Strip Electron's IPC wrapper so learners see only the actual reason. */
function errorText(error: unknown): string {
  return String(error).replace(/^Error: /, '').replace(/^Error invoking remote method '[^']+': /, '').replace(/^Error: /, '');
}

const STARTER = [
  '// EduBoard IDE - ESP32 Blink',
  '// Change LED_PIN to match your board.',
  'const int LED_PIN = 2;',
  '',
  'void setup() {',
  '  pinMode(LED_PIN, OUTPUT);',
  '  Serial.begin(115200);',
  '}',
  '',
  'void loop() {',
  '  digitalWrite(LED_PIN, HIGH);',
  '  Serial.println("LED ON");',
  '  delay(1000);',
  '  digitalWrite(LED_PIN, LOW);',
  '  Serial.println("LED OFF");',
  '  delay(1000);',
  '}',
  ''
].join('\n');
const PY_STARTER = '# EduBoard IDE - MicroPython\n# Use an external LED on GPIO2; adjust for your board.\nfrom machine import Pin\nimport time\n\nled = Pin(2, Pin.OUT)\nwhile True:\n    led.value(1)\n    print("LED ON")\n    time.sleep_ms(1000)\n    led.value(0)\n    print("LED OFF")\n    time.sleep_ms(1000)\n';
const pythonStarter = (board: MicroBoardId): string => {
  const pin = examplePins('micropython', board).led;
  return PY_STARTER.replace('GPIO2', 'GPIO' + pin).replace('Pin(2,', 'Pin(' + pin + ',');
};

export default function App(): JSX.Element {
  const layout = useWorkspaceLayout();
  const [editorSession, setEditorSession] = useState(0);
  const codeEditor = useRef<CodeEditorHandle>(null);
  const [diagnosticRuns, setDiagnosticRuns] = useState<DiagnosticRun[]>([]);
  const [location, setLocation] = useState<EditorLocation | null>(null);
  const nextRunId = useRef(0);
  const taskOutputRun = useRef<number | undefined>(undefined);
  const [source, setSource] = useState(STARTER);
  const [language, setLanguage] = useState<ProjectLanguage>('arduino');
  const [microBoardId, setMicroBoardId] = useState<MicroBoardId>('esp32');
  const [savedMicroBoard, setSavedMicroBoard] = useState<MicroBoardId>('esp32');
  const [pythonStatus, setPythonStatus] = useState('请选择配置过 MicroPython 工具的 Python。');
  const [textDrafts, setTextDrafts] = useState<TextDrafts>({ arduino: STARTER, micropython: null });
  const [savedDrafts, setSavedDrafts] = useState<TextDrafts>({ arduino: STARTER, micropython: null });
  const [blockTarget, setBlockTarget] = useState<ProjectLanguage>('arduino');
  const [savedBlockTarget, setSavedBlockTarget] = useState<ProjectLanguage>('arduino');
  const [mode, setMode] = useState<ProjectMode>('text');
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [blockEpoch, setBlockEpoch] = useState(0);
  const [blockRevision, setBlockRevision] = useState(0);
  const [savedBlockRevision, setSavedBlockRevision] = useState(0);
  const [blockReady, setBlockReady] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [blockWarnings, setBlockWarnings] = useState<string[]>([]);
  const blockEditor = useRef<BlockEditorHandle>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('led');
  const template = TEMPLATES.find(item => item.id === selectedTemplate)!;
  const [projectPath, setProjectPath] = useState('');
  const [savedFqbn, setSavedFqbn] = useState('esp32:esp32:esp32');
  const [confirmation, setConfirmation] = useState<{ message: string; text: ConfirmText; resolve: (answer: boolean) => void } | null>(null);
  const [filePath, setFilePath] = useState('');
  const [fqbn, setFqbn] = useState('esp32:esp32:esp32');
  const dirty = textDrafts.arduino !== savedDrafts.arduino || textDrafts.micropython !== savedDrafts.micropython
    || blockRevision !== savedBlockRevision || blockTarget !== savedBlockTarget || fqbn !== savedFqbn || microBoardId !== savedMicroBoard;
  const [port, setPort] = useState('');
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [tools, setTools] = useState<ToolSettings | null>(null);
  const [baud, setBaud] = useState(115200);
  const [cliStatus, setCliStatus] = useState('检查 Arduino CLI 中...');
  const [consoleChunks, setConsoleChunks] = useState<OutputChunk[]>([{ text: '欢迎使用 EduBoard IDE。请先安装 Arduino CLI 和 ESP32 核心。\n' }]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [monitoring, setMonitoring] = useState(false);
  const [serialInput, setSerialInput] = useState('');
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel | null>('project');
  const [cliOk, setCliOk] = useState(false);
  const [pythonOk, setPythonOk] = useState(false);
  const consoleRef = useRef<HTMLPreElement>(null);
  const consoleLines = useMemo(() => outputLines(consoleChunks), [consoleChunks]);
  const consoleClasses = useMemo(() => consoleLineClasses(consoleLines.map(line => line.text)), [consoleLines]);
  const logLocations = useMemo(() => new Map(diagnosticRuns.flatMap(run => run.diagnostics.map(diagnostic =>
    [run.id + ':' + diagnostic.logLine, { run, diagnostic }] as const))), [diagnosticRuns]);

  useEffect(() => {
    // Follow new output unless the reader has scrolled up to inspect earlier lines.
    const element = consoleRef.current;
    if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 80) element.scrollTop = element.scrollHeight;
  }, [consoleChunks]);

  useEffect(() => {
    const removeTaskOutput = window.eduboard.onTaskOutput((data) => {
      const runId = taskOutputRun.current;
      setConsoleChunks(previous => appendOutput(previous, data, runId));
    });
    const removeOutput = window.eduboard.onMonitorData((data) => {
      setConsoleChunks(previous => appendOutput(previous, data));
    });
    const removeState = window.eduboard.onMonitorState(setMonitoring);
    void refreshToolchain();
    void refreshPorts();
    return () => {
      removeOutput();
      removeState();
      removeTaskOutput();
    };
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (dirty || busy) { event.preventDefault(); event.returnValue = ''; }
    };
    const shortcut = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!busy && !confirmation) void withBusy(async () => { await save(); });
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', shortcut);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', shortcut);
    };
  }, [dirty, busy, source, textDrafts, workspaceState, confirmation, fqbn, mode, language, microBoardId, blockRevision, blockTarget]);

  function confirmChange(message: string, text = DISCARD_TEXT): Promise<boolean> {
    return new Promise(resolve => setConfirmation({ message, text, resolve }));
  }

  function discardIfNeeded(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    return confirmChange('继续操作会丢失三个模式中未保存的更改。可取消后先保存。');
  }

  function append(message: string): void {
    const runId = taskOutputRun.current;
    setConsoleChunks(previous => appendOutput(previous, message, runId, true));
  }

  function invalidateDiagnostics(targetLanguage: ProjectLanguage, preview: boolean): void {
    setDiagnosticRuns(previous => previous.filter(run => run.language !== targetLanguage || run.preview !== preview));
    setLocation(null);
  }

  async function checked(action: string, saved: Sketch, task: () => Promise<CommandResult>): Promise<CommandResult> {
    const run: DiagnosticRun = { id: ++nextRunId.current, session: editorSession, language, preview: mode === 'blocks', source: saved.source, diagnostics: [] };
    const matchesSnapshot = run.preview || codeEditor.current?.drafts()[language] === saved.source;
    setDiagnosticRuns(previous => [...previous.filter(item => item.language !== run.language || item.preview !== run.preview), ...(matchesSnapshot ? [run] : [])]);
    taskOutputRun.current = run.id;
    try {
      const result = await task();
      const lineCount = saved.source.split(/\r\n|\r|\n/).length;
      const diagnostics = (result.diagnostics || []).filter(item => item.line <= lineCount);
      // A late undo/edit invalidates a pending check too; never resurrect its old locations.
      setDiagnosticRuns(previous => previous.map(item => item.id === run.id ? { ...item, diagnostics } : item));
      append(displayResult(action, result));
      return result;
    } finally { taskOutputRun.current = undefined; }
  }

  async function jumpToDiagnostic(run: DiagnosticRun, diagnostic: SourceDiagnostic): Promise<void> {
    if (busyRef.current || run.session !== editorSession || !run.preview && codeEditor.current?.drafts()[run.language] !== run.source) return;
    if (run.preview) { await switchMode('blocks'); layout.showPreview(); }
    else await switchMode(run.language);
    setLocation({ ...run, ...diagnostic, id: ++nextRunId.current });
  }

  async function withBusy(task: () => Promise<void>): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      append('[错误] ' + errorText(error));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function refreshToolchain(): Promise<void> {
    try {
      setTools(await window.eduboard.toolSettings());
      const version = await window.eduboard.cliVersion();
      setCliStatus(version.ok ? version.stdout.trim() : version.stderr.trim()); setCliOk(version.ok);
      if (!version.ok) { setBoards([]); return; }
      const result = await window.eduboard.boards();
      setBoards(result.boards);
      if (!result.ok) append(displayResult('识别开发板', result));
    } catch (error) { setCliStatus(String(error)); setCliOk(false); }
  }

  async function refreshPythonTools(): Promise<void> {
    try {
      const info = await window.eduboard.pythonInfo();
      setPythonStatus(info.ok ? Object.entries(info.versions).map(([name, version]) => name + ' ' + version).join(' · ') : info.stderr); setPythonOk(info.ok);
    } catch (error) { setPythonStatus(String(error)); setPythonOk(false); }
  }

  async function selectTool(tool: 'arduinoCliPath' | 'arduinoConfigPath' | 'pythonPath'): Promise<void> {
    await withBusy(async () => {
      const selected = await window.eduboard.chooseTool(tool);
      if (selected) { setTools(selected); if (tool === 'pythonPath') await refreshPythonTools(); else await refreshToolchain(); await refreshPorts(); }
    });
  }

  async function refreshPorts(targetLanguage: ProjectLanguage = language): Promise<void> {
    try {
      const result = await (targetLanguage === 'arduino' ? window.eduboard.ports() : window.eduboard.pythonPorts());
      setPorts(result.ports);
      if (!result.ok) append(displayResult('识别串口', result));
    } catch (error) {
      append('[识别串口失败] ' + errorText(error));
    }
  }

  function applySketch(sketch: Sketch): void {
    setDiagnosticRuns([]); setLocation(null);
    setEditorSession(previous => previous + 1);
    setSource(sketch.source);
    setFilePath(sketch.filePath);
    setProjectPath(sketch.projectPath || '');
    const nextLanguage = sketch.document?.language || (sketch.filePath.toLowerCase().endsWith('.py') ? 'micropython' : 'arduino');
    const nextMode = sketch.document?.mode || 'text';
    const drafts: TextDrafts = sketch.document?.drafts || { arduino: null, micropython: null };
    if (!sketch.document?.drafts && nextMode === 'text') drafts[nextLanguage] = sketch.source;
    setTextDrafts(drafts); setSavedDrafts(drafts);
    const target = sketch.document?.blockTarget || nextLanguage;
    setBlockTarget(target); setSavedBlockTarget(target);
    setLanguage(nextLanguage); setMicroBoardId(sketch.document?.microBoard || 'esp32'); setSavedMicroBoard(sketch.document?.microBoard || 'esp32');
    if (nextLanguage === 'micropython') { if (selectedTemplate === 'sh1106') setSelectedTemplate('led'); void refreshPythonTools(); void refreshPorts(nextLanguage); }
    setMode(nextMode);
    setWorkspaceState(sketch.document?.workspace || null);
    setBlockRevision(0); setSavedBlockRevision(0); setBlockReady(false); setBlockError('');
    setBlockEpoch(previous => previous + 1);
    if (sketch.document) { setFqbn(sketch.document.fqbn); setSavedFqbn(sketch.document.fqbn); }
    else setSavedFqbn(fqbn);
    append('[项目] ' + sketch.filePath);
  }

  async function save(): Promise<Sketch | null> {
    const blocks = mode === 'blocks' ? blockEditor.current?.snapshot() : null;
    if (mode === 'blocks' && !blocks) throw new Error('请等待积木编辑器加载完成。');
    const liveDrafts = { ...textDrafts, ...codeEditor.current?.drafts() };
    const liveSource = mode === 'text' ? liveDrafts[language] ?? source : source;
    setTextDrafts(liveDrafts);
    if (mode === 'text') setSource(liveSource);
    const document: ProjectDocument = { format: 'eduboard-project', version: 1, language, mode,
      source: blocks ? blocks.code : liveSource, fqbn: fqbn.trim(), workspace: blocks ? blocks.workspace : workspaceState,
      microBoard: microBoardId, drafts: liveDrafts, blockTarget };
    const otherLanguage = language === 'arduino' ? 'micropython' : 'arduino';
    const result = mode === 'text' && filePath && !projectPath && !workspaceState && liveDrafts[otherLanguage] === null
      ? await window.eduboard.saveSketch(liveSource) : await window.eduboard.saveProject(document);
    if (!result) return null;
    setFilePath(result.filePath);
    setSource(current => current === liveSource ? result.source : current);
    setSavedDrafts(liveDrafts);
    if (blocks) setWorkspaceState(blocks.workspace);
    setProjectPath(result.projectPath || '');
    setSavedFqbn(fqbn);
    setSavedMicroBoard(microBoardId);
    setSavedBlockTarget(blockTarget);
    setSavedBlockRevision(blockRevision);
    append('[已保存] ' + result.filePath);
    if (blocks?.error) append('[积木] 工作区已保留，生成错误仍需修复：' + blocks.error);
    return result;
  }

  function resetProject(nextSource: string, nextMode: ProjectMode, nextWorkspace: WorkspaceState | null): void {
    setDiagnosticRuns([]); setLocation(null);
    setEditorSession(previous => previous + 1);
    setFilePath(''); setProjectPath(''); setSource(nextSource);
    const drafts: TextDrafts = { arduino: null, micropython: null };
    if (nextMode === 'text') drafts[language] = nextSource;
    setTextDrafts(drafts); setSavedDrafts(drafts); setBlockTarget(language); setSavedBlockTarget(language);
    setMode(nextMode); setWorkspaceState(nextWorkspace); setBlockEpoch(previous => previous + 1);
    setBlockRevision(0); setSavedBlockRevision(0); setBlockError(''); setBlockWarnings([]); setBlockReady(false); setSavedFqbn(fqbn);
    setSavedMicroBoard(microBoardId);
  }

  async function newBlocks(): Promise<void> {
    await withBusy(async () => {
      if (!(await discardIfNeeded())) return;
      await window.eduboard.newSketch(language);
      resetProject('', 'blocks', language === 'arduino' ? template.createWorkspace() : microTemplate(template, microBoardId));
      append('[示例] ' + template.name + ' · 请按接线说明检查实际板型。');
    });
  }

  async function generated(state: WorkspaceState, target: ProjectLanguage, allowError = false): Promise<string> {
    const result = (await import('../../shared/blocks/snapshot')).generateFromState(state, target);
    if (result.error && !allowError) throw new Error(result.error);
    return result.code;
  }

  async function adoptGenerated(): Promise<void> {
    await withBusy(async () => {
      const state = mode === 'blocks' ? blockEditor.current?.snapshot().workspace : workspaceState;
      if (!state) throw new Error('请先创建图形化工作区。');
      const code = await generated(state, language);
      const existing = textDrafts[language];
      if (existing !== null && existing !== code && !(await confirmChange('采用积木生成代码会替换当前语言的文本。积木和另一语言的代码会保留。', { title: '替换文本代码？', confirm: '替换代码' }))) return;
      invalidateDiagnostics(language, false);
      setWorkspaceState(state); setTextDrafts(previous => ({ ...previous, [language]: code }));
      setSource(code); setMode('text'); setBlockEpoch(previous => previous + 1);
      append('[代码] 已采用积木生成代码。文本修改不会自动转回积木。');
    });
  }

  async function switchMode(target: 'blocks' | ProjectLanguage): Promise<void> {
    await withBusy(async () => {
      if (target === 'blocks' ? mode === 'blocks' : mode === 'text' && language === target) return;
      const state = mode === 'blocks' ? blockEditor.current?.snapshot().workspace : workspaceState;
      if (mode === 'blocks' && !state) throw new Error('请等待积木编辑器加载完成。');
      const nextLanguage = target === 'blocks' ? state ? blockTarget : language : target;
      let nextSource: string;
      let nextWorkspace = state;
      if (target === 'blocks') {
        nextWorkspace ||= nextLanguage === 'arduino' ? template.createWorkspace() : microTemplate(template, microBoardId);
        nextSource = await generated(nextWorkspace, nextLanguage, true);
      } else {
        nextSource = textDrafts[nextLanguage] ?? (state ? await generated(state, nextLanguage) : nextLanguage === 'arduino' ? STARTER : pythonStarter(microBoardId));
      }
      if (nextLanguage !== language) await window.eduboard.stopMonitor();
      if (target !== 'blocks' && textDrafts[nextLanguage] === null) setTextDrafts(previous => ({ ...previous, [nextLanguage]: nextSource }));
      if (nextWorkspace && !workspaceState) { setBlockRevision(previous => previous + 1); setBlockTarget(nextLanguage); }
      setWorkspaceState(nextWorkspace || null); setLanguage(nextLanguage); setSource(nextSource);
      setMode(target === 'blocks' ? 'blocks' : 'text'); setBlockReady(false); setBlockError(''); setBlockEpoch(previous => previous + 1);
      if (nextLanguage === 'micropython') { if (selectedTemplate === 'sh1106') setSelectedTemplate('led'); await refreshPythonTools(); }
      if (nextLanguage !== language) await refreshPorts(nextLanguage);
    });
  }

  async function switchBlockTarget(target: ProjectLanguage): Promise<void> {
    await withBusy(async () => {
      if (target === blockTarget) return;
      const state = blockEditor.current?.snapshot().workspace;
      if (!state) throw new Error('请等待积木编辑器加载完成。');
      await window.eduboard.stopMonitor();
      setDiagnosticRuns(previous => previous.filter(run => !run.preview)); setLocation(null);
      setWorkspaceState(state); setLanguage(target); setBlockTarget(target); setBlockReady(false); setBlockEpoch(previous => previous + 1);
      if (target === 'micropython') { if (selectedTemplate === 'sh1106') setSelectedTemplate('led'); await refreshPythonTools(); }
      await refreshPorts(target);
    });
  }

  async function checkPython(): Promise<void> {
    await withBusy(async () => {
      layout.setOutputOpen(true);
      const saved = await save();
      if (!saved) return;
      await checked('语法检查', saved, () => window.eduboard.checkPython());
    });
  }

  async function runPython(): Promise<void> {
    await withBusy(async () => {
      layout.setOutputOpen(true);
      if (!port.trim()) { append('[运行] 请先选择实际开发板的串口。'); return; }
      if (!(await save())) return;
      append(displayResult('运行 MicroPython', await window.eduboard.runPython(port.trim(), baud)));
    });
  }

  async function compile(): Promise<void> {
    await withBusy(async () => {
      layout.setOutputOpen(true);
      if (mode === 'blocks' && (!blockReady || blockError)) throw new Error(blockError || '积木尚未准备好。');
      const saved = await save();
      if (!saved) return;
      append('[编译中] ' + fqbn);
      await checked('编译', saved, () => window.eduboard.compile(fqbn.trim()));
    });
  }

  async function upload(): Promise<void> {
    await withBusy(async () => {
      layout.setOutputOpen(true);
      if (mode === 'blocks' && (!blockReady || blockError)) throw new Error(blockError || '积木尚未准备好。');
      if (!port.trim()) {
        append('[上传] 请先填写或选择串口，例如 COM3。');
        return;
      }
      const saved = await save();
      if (!saved) return;
      append('[编译中] ' + fqbn);
      const result = await checked('编译', saved, () => window.eduboard.compile(fqbn.trim()));
      if (!result.ok) return;
      append('[上传中] ' + port.trim());
      const uploaded = await window.eduboard.upload(fqbn.trim(), port.trim());
      append(displayResult('上传', uploaded));
    });
  }

  async function toggleMonitor(): Promise<void> {
    await withBusy(async () => {
      layout.setOutputOpen(true);
      if (monitoring) {
        await window.eduboard.stopMonitor();
        append('[串口] 已停止监视');
        return;
      }
      if (!port.trim()) {
        append('[串口] 请先填写串口地址');
        return;
      }
      const result = await (language === 'arduino' ? window.eduboard.startMonitor(port.trim(), baud) : window.eduboard.startRepl(port.trim(), baud));
      append('[串口] ' + result.message);
    });
  }

  async function sendSerial(): Promise<void> {
    if (!serialInput) return;
    try {
      await window.eduboard.sendMonitor(serialInput + (language === 'micropython' ? '\r' : '\n'));
      setSerialInput('');
    } catch (error) {
      append('[串口发送失败] ' + errorText(error));
    }
  }

  const activePanel = sidebarPanel === 'device' && language !== 'micropython' ? 'project' : sidebarPanel;
  const blocksBlocked = mode === 'blocks' && (!blockReady || Boolean(blockError));
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : '';
  const languageName = language === 'arduino' ? 'Arduino C++' : 'MicroPython';
  const toolsOk = language === 'arduino' ? cliOk : pythonOk;
  const togglePanel = (panel: SidebarPanel): void => setSidebarPanel(current => current === panel ? null : panel);
  const railItems: Array<{ id: SidebarPanel; label: string; icon: JSX.Element }> = [
    { id: 'project', label: '项目', icon: icons.project },
    ...(language === 'micropython' ? [{ id: 'device' as const, label: '设备', icon: icons.chip }] : []),
    { id: 'tools', label: '工具链', icon: icons.tools }
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {icons.logo}
          <span className="brand-name">EduBoard IDE</span>
          <span className="brand-tag">0.3 Preview</span>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button className="btn ghost collapse-able" aria-label="新建" title="新建项目" disabled={busy} onClick={() => void withBusy(async () => {
            if (!(await discardIfNeeded())) return;
            await window.eduboard.newSketch(language);
            resetProject(language === 'arduino' ? STARTER : pythonStarter(microBoardId), 'text', null);
          })}>{icons.newFile}<span className="label-collapse">新建</span></button>
          <button className="btn ghost collapse-able" aria-label="打开" title="打开项目或源程序" disabled={busy} onClick={() => void withBusy(async () => {
            if (!(await discardIfNeeded())) return;
            const project = await window.eduboard.openSketch();
            if (project) applySketch(project);
          })}>{icons.open}<span className="label-collapse">打开</span></button>
          <button className="btn ghost collapse-able" aria-label="保存" title="保存 (Ctrl+S)" disabled={busy} onClick={() => void withBusy(async () => { await save(); })}>{icons.save}<span className="label-collapse">保存</span></button>
        </div>
        <div className="spacer" />
        <div className="target">
          <div className="target-field" title={language === 'arduino' ? 'Arduino 开发板（FQBN）' : 'MicroPython 固件 / 板型'}>
            {icons.chip}
            {language === 'arduino' ? <>
              <input id="fqbn" className="input mono target-board" aria-label="Arduino FQBN" list="installed-boards" value={fqbn} disabled={busy} spellCheck={false} onChange={(e) => {
                setFqbn(e.target.value); setDiagnosticRuns(previous => previous.filter(run => run.language !== 'arduino')); setLocation(null);
              }} />
              <datalist id="installed-boards">
                {boards.map((board) => <option key={board.fqbn} value={board.fqbn}>{board.name}</option>)}
              </datalist>
            </> : <select id="micro-board" className="select target-board" aria-label="固件 / 板型" value={microBoardId} disabled={busy} onChange={event => setMicroBoardId(event.target.value as MicroBoardId)}>
              {MICRO_BOARDS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>}
          </div>
          <div className="target-field" title="串口（可从列表选择或手动输入）">
            {icons.plug}
            <input id="port" className="input mono target-port" aria-label="串口" value={port} list="available-ports" placeholder="COM3" spellCheck={false} disabled={busy || monitoring} onChange={(e) => setPort(e.target.value)} />
            <datalist id="available-ports">
              {ports.map((item) => <option key={item.address} value={item.address}>{item.label}</option>)}
            </datalist>
            <button className="btn ghost icon-only" aria-label="刷新串口列表" title={'刷新串口列表（已发现 ' + ports.length + ' 个）'} disabled={busy} onClick={() => void refreshPorts()}>{icons.refresh}</button>
          </div>
        </div>
        <div className="actions">
          {language === 'arduino' ? <>
            <button className="btn lg narrow-icon" aria-label="编译" disabled={busy || blocksBlocked} title="编译并检查程序" onClick={() => void compile()}>{icons.verify}<span className="label-narrow">编译</span></button>
            <button className="btn lg primary narrow-icon" aria-label="编译并上传" disabled={busy || blocksBlocked} title="编译后上传到开发板" onClick={() => void upload()}>{icons.upload}<span className="label-narrow">编译并上传</span></button>
          </> : <>
            <button className="btn lg narrow-icon" aria-label="检查语法" disabled={busy || blocksBlocked} title="仅解析语法，不在电脑上执行" onClick={() => void checkPython()}>{icons.verify}<span className="label-narrow">检查语法</span></button>
            <button className="btn lg primary narrow-icon" aria-label="运行到设备" disabled={busy || blocksBlocked} title="保存并在开发板上运行" onClick={() => void runPython()}>{icons.run}<span className="label-narrow">运行到设备</span></button>
          </>}
          {busy && !confirmation && <button className="btn lg danger" onClick={() => void window.eduboard.cancelTask().catch(error => append(String(error)))}>{icons.stop}取消任务</button>}
        </div>
        {busy && !confirmation && <div className="progress" aria-hidden="true" />}
      </header>

      <div className="body">
        <nav className="rail" aria-label="侧边栏">
          {railItems.map(item => <button key={item.id} className="rail-button" aria-label={item.label} title={item.label} aria-pressed={activePanel === item.id} onClick={() => togglePanel(item.id)}>{item.icon}</button>)}
        </nav>

        {activePanel && <aside className="sidebar" aria-label={railItems.find(item => item.id === activePanel)?.label}>
          <div className="sidebar-head">{activePanel === 'project' ? '项目' : activePanel === 'device' ? 'MicroPython 设备' : '工具链'}</div>
          <div className="sidebar-scroll">
            {activePanel === 'project' && <>
              <div className="card project-card">
                <div className="project-name">{filePath ? icons.file : icons.newFile}<span title={filePath || undefined}>{fileName || '未命名项目'}</span></div>
                <div className="file" title={filePath || undefined}><bdi>{filePath || '未保存项目'}</bdi></div>
                <div className="pill-row">
                  <span className="pill accent">{languageName}</span>
                  <span className="pill">{mode === 'blocks' ? '图形化' : '文本'}</span>
                  {dirty && <span className="pill warning"><span className="dot" />未保存</span>}
                </div>
                {projectPath && <dl className="kv"><dt>项目文件</dt><dd title={projectPath}>{projectPath.split(/[\\/]/).pop()}</dd></dl>}
              </div>
              <section className="panel-section">
                <div className="section-title">开发板示例</div>
                <div className="field">
                  <label htmlFor="example">示例</label>
                  <select id="example" className="select" value={selectedTemplate} disabled={busy} onChange={event => setSelectedTemplate(event.target.value)}>
                    {TEMPLATES.filter(item => language === 'arduino' || item.id !== 'sh1106').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <p className="hint">{template.summary}</p>
                <button className="btn block" disabled={busy} onClick={() => void newBlocks()}>{icons.blocks}新建图形化示例</button>
                <details className="disclosure">
                  <summary>接线说明</summary>
                  <div className="disclosure-body">
                    <p className="hint">所选板型下新建示例的默认接线；已修改程序请以实际引脚为准。</p>
                    <ul className="wiring">{template.wiring(examplePins(language, microBoardId)).map(line => <li key={line}>{line}</li>)}</ul>
                    {template.libraries.length > 0 && <p className="hint">依赖：{template.libraries.join('、')}</p>}
                  </div>
                </details>
              </section>
              <div className="note">{icons.info}<span>{language === 'arduino' ? '开发预览：上传前确认 ESP32 核心和驱动。' : '开发预览：需先安装匹配的 MicroPython 固件。C3 新示例默认 LED3、按钮5；换板后重新检查引脚。'}</span></div>
            </>}
            {activePanel === 'device' && <MicroPythonPane boardId={microBoardId} port={port} busy={busy} action={withBusy} save={async () => Boolean(await save())} append={append} result={displayResult} />}
            {activePanel === 'tools' && <>
              <section className="panel-section">
                <div className="section-title">状态</div>
                <div className={'status-line ' + (toolsOk ? 'ok' : 'bad')}><span className="dot" /><span>{language === 'arduino' ? cliStatus : pythonStatus}</span></div>
              </section>
              {language === 'arduino' ? <>
                <section className="panel-section">
                  <div className="section-title">Arduino CLI</div>
                  <dl className="kv">
                    <dt>程序</dt><dd>{tools?.arduinoCliPath || '检查中'}</dd>
                    <dt>配置</dt><dd>{tools?.arduinoConfigPath || '使用 CLI 默认配置'}</dd>
                    <dt>目标</dt><dd>已安装 {boards.length} 个开发板</dd>
                  </dl>
                  <div className="button-stack">
                    <button className="btn block" disabled={busy} onClick={() => void selectTool('arduinoCliPath')}>选择 Arduino CLI</button>
                    <button className="btn block" disabled={busy} onClick={() => void selectTool('arduinoConfigPath')}>选择 CLI 配置</button>
                    <button className="btn block" disabled={busy} onClick={() => void withBusy(refreshToolchain)}>{icons.refresh}刷新开发板</button>
                  </div>
                </section>
                <section className="panel-section">
                  <div className="section-title">联网安装</div>
                  <div className="button-stack">
                    <button className="btn block" disabled={busy} onClick={() => void withBusy(async () => {
                      append('[工具链] 联网安装官方 ESP32 核心，可能需要较长时间。');
                      append(displayResult('安装 ESP32 核心', await window.eduboard.installEsp32()));
                      await refreshToolchain();
                    })}>{icons.download}安装 ESP32 核心（联网）</button>
                    <button className="btn block" disabled={busy} onClick={() => void withBusy(async () => {
                      append('[工具链] 联网安装固定版本的示例传感器库。');
                      append(displayResult('安装示例依赖', await window.eduboard.installExampleLibraries()));
                    })}>{icons.download}安装示例依赖（联网）</button>
                  </div>
                </section>
              </> : <section className="panel-section">
                <div className="section-title">Python 工具环境</div>
                <dl className="kv"><dt>Python</dt><dd>{tools?.pythonPath || 'python'}</dd></dl>
                <div className="button-stack">
                  <button className="btn block" disabled={busy} onClick={() => void selectTool('pythonPath')}>选择 Python 工具环境</button>
                  <button className="btn block" disabled={busy} onClick={() => void withBusy(refreshPythonTools)}>{icons.refresh}刷新 Python 工具</button>
                </div>
                <p className="hint">按离线说明安装 mpremote、esptool、pyserial。语法检查只解析代码；设备模块须在板上验证。</p>
              </section>}
            </>}
          </div>
        </aside>}

        <main className="main" ref={layout.region}>
          <div className="section-head">
            <nav className="mode-tabs" aria-label="开发模式">
              <button aria-pressed={mode === 'blocks'} disabled={busy} title="图形化积木（切换保留各模式内容）" onClick={() => void switchMode('blocks')}>{icons.blocks}图形化</button>
              <button aria-pressed={mode === 'text' && language === 'arduino'} disabled={busy} title="Arduino C++ 文本" onClick={() => void switchMode('arduino')}>{icons.code}C++</button>
              <button aria-pressed={mode === 'text' && language === 'micropython'} disabled={busy} title="MicroPython 文本" onClick={() => void switchMode('micropython')}>{icons.python}Python</button>
            </nav>
            <div className="head-title">
              {mode === 'blocks' ? <>
                <strong>积木生成</strong>
                <select aria-label="积木生成语言" className="select language-select" value={blockTarget} disabled={busy || !blockReady} onChange={event => void switchBlockTarget(event.target.value as ProjectLanguage)}>
                  <option value="arduino">Arduino C++</option><option value="micropython">MicroPython</option>
                </select>
              </> : <strong>{languageName}</strong>}
            </div>
            <div className="head-actions">
              {workspaceState && <button className="btn narrow-icon" aria-label={mode === 'blocks' ? '采用生成代码' : '从积木更新代码'} title={mode === 'blocks' ? '用积木生成的代码替换当前语言的文本' : '用积木重新生成当前语言的文本'} disabled={busy || blocksBlocked} onClick={() => void adoptGenerated()}>{icons.code}<span className="label-narrow">{mode === 'blocks' ? '采用生成代码' : '从积木更新代码'}</span></button>}
              <span className={'save-state' + (dirty ? ' dirty' : filePath ? '' : ' new')}><span className="dot" />{dirty ? '有未保存更改' : filePath ? '已保存' : '新建项目未保存'}</span>
            </div>
          </div>
          {mode === 'blocks' && <div className={'block-message' + (blockError ? ' error' : blockWarnings.length ? ' warning' : '')} role={blockError ? 'alert' : undefined}>
            {blockError ? icons.warning : blockWarnings.length ? icons.warning : icons.info}
            <span>{blockError || blockWarnings.join(' · ') || '积木单向生成代码。采用生成代码可更新文本工作区；三个模式的内容分别保留。'}</span>
            <button className="btn ghost" aria-pressed={layout.previewVisible} disabled={busy} onClick={layout.togglePreview}>
              {layout.previewVisible ? '隐藏代码预览' : '显示代码预览'}
            </button>
          </div>}
          <div className={'editor' + (mode === 'blocks' && layout.previewVisible ? ' editors-split' : '')}>
            {mode === 'blocks' && workspaceState && <div className="blocks-pane">
              <Suspense fallback={<p className="hint" style={{ padding: 16 }}>正在加载本地积木编辑器…</p>}>
                <BlockEditor key={blockEpoch} ref={blockEditor} initial={workspaceState} language={language} disabled={busy} onUpdate={(snapshot, changed) => {
                  setWorkspaceState(snapshot.workspace); setSource(snapshot.code); setBlockError(snapshot.error); setBlockWarnings(snapshot.warnings); setBlockReady(true);
                  if (changed) { setBlockRevision(previous => previous + 1); invalidateDiagnostics(language, true); }
                }} />
              </Suspense>
            </div>}
            {mode === 'blocks' && layout.previewVisible && <ResizeHandle label="调整代码预览宽度" orientation="vertical"
              value={layout.previewPercent} min={layout.minPreview} max={layout.maxPreview} step={5} unitsPerPixel={layout.previewUnitsPerPixel}
              onChange={layout.resizePreview} onReset={layout.resetPreview} />}
            <div className={'code-pane' + (mode === 'blocks' && !layout.previewVisible ? ' preview-hidden' : '')}
              style={mode === 'blocks' ? { flexBasis: layout.previewPercent + '%' } : undefined}>
              {mode === 'blocks' && <div className="pane-label">{icons.code}生成代码<span className="pill">只读</span></div>}
              <div className="monaco-host">
                <CodeEditor ref={codeEditor} session={editorSession} language={language} preview={mode === 'blocks'} disabled={busy}
                  value={source} reports={diagnosticRuns} location={location}
                  onChange={(code, changedLanguage) => {
                    invalidateDiagnostics(changedLanguage, false);
                    if (mode === 'text' && changedLanguage === language) setSource(code);
                    setTextDrafts(previous => ({ ...previous, [changedLanguage]: code }));
                  }}
                />
              </div>
            </div>
          </div>
          {layout.outputOpen && <ResizeHandle label="调整输出高度" orientation="horizontal" value={layout.outputHeight} min={112} max={layout.maxOutput}
            step={16} onChange={layout.resizeOutput} onReset={layout.resetOutput} />}
          <section className={'output' + (layout.outputOpen ? '' : ' collapsed')} aria-label="输出" style={{ height: layout.outputOpen ? layout.outputHeight : 36 }}>
            <div className="console-header">
              <span className="console-title">{icons.terminal}<span className="title-long">{language === 'arduino' ? '输出 / 串口监视器' : '输出 / MicroPython REPL'}</span>
                <span className="title-short">{language === 'arduino' ? '输出' : 'REPL'}</span></span>
              <div className="row">
                <select aria-label="串口波特率" className="select" value={baud} disabled={busy || monitoring} onChange={(e) => setBaud(Number(e.target.value))}>
                  <option value={9600}>9600 baud</option>
                  <option value={115200}>115200 baud</option>
                  <option value={230400}>230400 baud</option>
                </select>
                <button className={'btn' + (monitoring ? '' : ' primary')} disabled={busy} onClick={() => void toggleMonitor()}>{monitoring ? icons.unplug : icons.plug}{monitoring ? '关闭串口' : language === 'arduino' ? '打开串口' : '连接 REPL'}</button>
                {language === 'micropython' && <button className="btn" disabled={busy || !monitoring} onClick={() => void withBusy(async () => { await window.eduboard.interruptPython(); append('[REPL] 已发送中断，请查看设备响应。'); })}>{icons.interrupt}中断设备程序</button>}
                <button className="btn ghost" title="清空输出" onClick={() => setConsoleChunks([])}>{icons.clear}清空</button>
                <button className="btn ghost output-toggle" aria-label={layout.outputOpen ? '收起输出' : '展开输出'} aria-expanded={layout.outputOpen}
                  onClick={() => layout.setOutputOpen(!layout.outputOpen)}>{layout.outputOpen ? '收起' : '展开'}</button>
              </div>
            </div>
            <div className="output-content" hidden={!layout.outputOpen}>
            <pre className="console" ref={consoleRef}>{consoleChunks.length ? consoleLines.map((line, index) => {
              const target = logLocations.get(line.runId + ':' + line.text);
              return <span key={index} className={consoleClasses[index]}>{target ? <button className="diagnostic-link" disabled={busy}
                title={'跳到第 ' + target.diagnostic.line + ' 行，第 ' + target.diagnostic.column + ' 列'}
                onClick={() => void jumpToDiagnostic(target.run, target.diagnostic)}>{line.text}</button> : line.text}{index < consoleLines.length - 1 ? '\n' : ''}</span>;
            }) : <span className="console-empty">暂无输出</span>}</pre>
            <div className="serial-input">
              <input className="input" aria-label="串口发送文本" placeholder={monitoring ? '向串口发送文本，按 Enter 发送' : '连接串口后可发送文本'} value={serialInput} disabled={!monitoring || busy} onKeyDown={(e) => {
                if (e.key === 'Enter') void sendSerial();
              }} onChange={(e) => setSerialInput(e.target.value)} />
              <button className="btn" disabled={!monitoring || busy} onClick={() => void sendSerial()}>{icons.send}发送</button>
            </div>
            </div>
          </section>
        </main>
      </div>
      <footer className={'statusbar' + (busy && !confirmation ? ' busy' : monitoring ? ' live' : '')}>
        <span className="status-item" role="status">{confirmation ? '等待确认…' : busy ? <><span className="spinner" />任务执行中…</> : monitoring ? <><span className="dot" />串口监视运行中</> : '准备就绪（未验证硬件连接）'}</span>
        <span className="status-item">{languageName}</span>
        <span className="status-item">{language === 'arduino' ? fqbn : MICRO_BOARDS.find(item => item.id === microBoardId)?.name}</span>
        <span className="status-item">{port.trim() || '未选择串口'} · {baud}</span>
        <span className="status-item muted push">EduBoard IDE · GPL-3.0 · Independent open-source project</span>
      </footer>
      {confirmation && <ConfirmDialog message={confirmation.message} text={confirmation.text} onAnswer={(answer) => {
        confirmation.resolve(answer);
        setConfirmation(null);
      }} />}
    </div>
  );
}
