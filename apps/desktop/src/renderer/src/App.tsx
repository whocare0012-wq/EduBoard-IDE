// SPDX-License-Identifier: GPL-3.0-only
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { BoardInfo, CommandResult, PortInfo, Sketch, ToolSettings } from '../../shared/types';
import './editor';
import ConfirmDialog from './ConfirmDialog';
import type { BlockEditorHandle } from './BlockEditor';
import type { ProjectDocument, ProjectLanguage, ProjectMode, TextDrafts, WorkspaceState } from '../../shared/project-format';
import { TEMPLATES, microTemplate } from '../../shared/blocks/templates';
import type { MicroBoardId } from '../../shared/boards';
import MicroPythonPane from './MicroPythonPane';

const BlockEditor = lazy(() => import('./BlockEditor'));

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

function displayResult(action: string, result: CommandResult): string {
  return [
    '[' + action + '] ' + (result.ok ? '成功' : '失败'),
    result.streamed ? '' : result.stdout.trim(),
    result.streamed && result.ok ? '' : result.stderr.trim()
  ].filter(Boolean).join('\n') + '\n';
}

export default function App(): JSX.Element {
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
  const [confirmation, setConfirmation] = useState<{ message: string; resolve: (answer: boolean) => void } | null>(null);
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
  const [consoleText, setConsoleText] = useState('欢迎使用 EduBoard IDE。请先安装 Arduino CLI 和 ESP32 核心。\n');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [monitoring, setMonitoring] = useState(false);
  const [serialInput, setSerialInput] = useState('');

  useEffect(() => {
    const removeTaskOutput = window.eduboard.onTaskOutput((data) => {
      setConsoleText((previous) => (previous + data).slice(-60_000));
    });
    const removeOutput = window.eduboard.onMonitorData((data) => {
      setConsoleText((previous) => (previous + data).slice(-60_000));
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

  function confirmChange(message: string): Promise<boolean> {
    return new Promise(resolve => setConfirmation({ message, resolve }));
  }

  function discardIfNeeded(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    return confirmChange('继续操作会丢失三个模式中未保存的更改。可取消后先保存。');
  }

  function append(message: string): void {
    setConsoleText((previous) => (previous + message + '\n').slice(-60_000));
  }

  async function withBusy(task: () => Promise<void>): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      append('[错误] ' + String(error));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function refreshToolchain(): Promise<void> {
    try {
      setTools(await window.eduboard.toolSettings());
      const version = await window.eduboard.cliVersion();
      setCliStatus(version.ok ? version.stdout.trim() : version.stderr.trim());
      if (!version.ok) { setBoards([]); return; }
      const result = await window.eduboard.boards();
      setBoards(result.boards);
      if (!result.ok) append(displayResult('识别开发板', result));
    } catch (error) { setCliStatus(String(error)); }
  }

  async function refreshPythonTools(): Promise<void> {
    try {
      const info = await window.eduboard.pythonInfo();
      setPythonStatus(info.ok ? Object.entries(info.versions).map(([name, version]) => name + ' ' + version).join(' · ') : info.stderr);
    } catch (error) { setPythonStatus(String(error)); }
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
      append('[识别串口失败] ' + String(error));
    }
  }

  function applySketch(sketch: Sketch): void {
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

  async function save(): Promise<boolean> {
    const blocks = mode === 'blocks' ? blockEditor.current?.snapshot() : null;
    if (mode === 'blocks' && !blocks) throw new Error('请等待积木编辑器加载完成。');
    const document: ProjectDocument = { format: 'eduboard-project', version: 1, language, mode,
      source: blocks ? blocks.code : source, fqbn: fqbn.trim(), workspace: blocks ? blocks.workspace : workspaceState,
      microBoard: microBoardId, drafts: textDrafts, blockTarget };
    const otherLanguage = language === 'arduino' ? 'micropython' : 'arduino';
    const result = mode === 'text' && filePath && !projectPath && !workspaceState && textDrafts[otherLanguage] === null
      ? await window.eduboard.saveSketch(source) : await window.eduboard.saveProject(document);
    if (!result) return false;
    setFilePath(result.filePath);
    setSource(result.source);
    setSavedDrafts(textDrafts);
    if (blocks) setWorkspaceState(blocks.workspace);
    setProjectPath(result.projectPath || '');
    setSavedFqbn(fqbn);
    setSavedMicroBoard(microBoardId);
    setSavedBlockTarget(blockTarget);
    setSavedBlockRevision(blockRevision);
    append('[已保存] ' + result.filePath);
    if (blocks?.error) append('[积木] 工作区已保留，生成错误仍需修复：' + blocks.error);
    return true;
  }

  function resetProject(nextSource: string, nextMode: ProjectMode, nextWorkspace: WorkspaceState | null): void {
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
      if (existing !== null && existing !== code && !(await confirmChange('采用积木生成代码会替换当前语言的文本。积木和另一语言的代码会保留。'))) return;
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
        nextSource = textDrafts[nextLanguage] ?? (state ? await generated(state, nextLanguage) : nextLanguage === 'arduino' ? STARTER : PY_STARTER.replace('Pin(2,', microBoardId === 'esp32c3' ? 'Pin(3,' : 'Pin(2,'));
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
      setWorkspaceState(state); setLanguage(target); setBlockTarget(target); setBlockReady(false); setBlockEpoch(previous => previous + 1);
      if (target === 'micropython') { if (selectedTemplate === 'sh1106') setSelectedTemplate('led'); await refreshPythonTools(); }
      await refreshPorts(target);
    });
  }

  async function checkPython(): Promise<void> {
    await withBusy(async () => {
      if (!(await save())) return;
      append(displayResult('语法检查', await window.eduboard.checkPython()));
    });
  }

  async function runPython(): Promise<void> {
    await withBusy(async () => {
      if (!port.trim()) { append('[运行] 请先选择实际开发板的串口。'); return; }
      if (!(await save())) return;
      append(displayResult('运行 MicroPython', await window.eduboard.runPython(port.trim(), baud)));
    });
  }

  async function compile(): Promise<void> {
    await withBusy(async () => {
      if (mode === 'blocks' && (!blockReady || blockError)) throw new Error(blockError || '积木尚未准备好。');
      if (!(await save())) return;
      append('[编译中] ' + fqbn);
      const result = await window.eduboard.compile(fqbn.trim());
      append(displayResult('编译', result));
    });
  }

  async function upload(): Promise<void> {
    await withBusy(async () => {
      if (mode === 'blocks' && (!blockReady || blockError)) throw new Error(blockError || '积木尚未准备好。');
      if (!port.trim()) {
        append('[上传] 请先填写或选择串口，例如 COM3。');
        return;
      }
      if (!(await save())) return;
      append('[编译中] ' + fqbn);
      const result = await window.eduboard.compile(fqbn.trim());
      append(displayResult('编译', result));
      if (!result.ok) return;
      append('[上传中] ' + port.trim());
      const uploaded = await window.eduboard.upload(fqbn.trim(), port.trim());
      append(displayResult('上传', uploaded));
    });
  }

  async function toggleMonitor(): Promise<void> {
    await withBusy(async () => {
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
      append('[串口发送失败] ' + String(error));
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <span className="logo">◈</span>
          <strong>EduBoard IDE</strong>
          <span className="version">0.3 Preview</span>
        </div>
        <div className="toolbar">
          <button disabled={busy} onClick={() => void withBusy(async () => {
            if (!(await discardIfNeeded())) return;
            await window.eduboard.newSketch(language);
            resetProject(language === 'arduino' ? STARTER : PY_STARTER, 'text', null);
          })}>新建</button>
          <button disabled={busy} onClick={() => void withBusy(async () => {
            if (!(await discardIfNeeded())) return;
            const project = await window.eduboard.openSketch();
            if (project) applySketch(project);
          })}>打开</button>
          <button disabled={busy} onClick={() => void withBusy(async () => { await save(); })}>保存</button>
          {language === 'arduino' ? <>
            <button className="primary" disabled={busy || mode === 'blocks' && (!blockReady || Boolean(blockError))} onClick={() => void compile()}>编译</button>
            <button className="primary" disabled={busy || mode === 'blocks' && (!blockReady || Boolean(blockError))} onClick={() => void upload()}>编译并上传</button>
          </> : <>
            <button disabled={busy || mode === 'blocks' && (!blockReady || Boolean(blockError))} onClick={() => void checkPython()}>检查语法</button>
            <button className="primary" disabled={busy || mode === 'blocks' && (!blockReady || Boolean(blockError))} onClick={() => void runPython()}>运行到设备</button>
          </>}
          {busy && <button onClick={() => void window.eduboard.cancelTask().catch(error => append(String(error)))}>取消任务</button>}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <h3>当前项目</h3>
          <div className="file">{filePath || '未保存项目'}{dirty ? ' · 有未保存更改' : ''}</div>
          {projectPath && <p className="muted small">项目文件：{projectPath}</p>}
          <h3>开发板示例</h3>
          <label htmlFor="example">示例</label>
          <select id="example" value={selectedTemplate} disabled={busy} onChange={event => setSelectedTemplate(event.target.value)}>
            {TEMPLATES.filter(item => language === 'arduino' || item.id !== 'sh1106').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button disabled={busy} onClick={() => void newBlocks()}>新建图形化示例</button>
          <p className="muted small">{template.summary}</p>
          <details><summary>接线说明</summary>
            {template.wiring.map(line => <p className="muted small wiring-line" key={line}>{line}</p>)}
            {template.libraries.length > 0 && <p className="muted small">依赖：{template.libraries.join('、')}</p>}
          </details>
          <h3>开发板配置</h3>
          {language === 'arduino' && <>
          <label htmlFor="fqbn">Arduino FQBN</label>
          <input id="fqbn" list="installed-boards" value={fqbn} disabled={busy} onChange={(e) => setFqbn(e.target.value)} />
          <datalist id="installed-boards">
            {boards.map((board) => <option key={board.fqbn} value={board.fqbn}>{board.name}</option>)}
          </datalist>
          <p className="muted small">已安装目标：{boards.length} · 请选择实际板型</p>
          </>}
          <label htmlFor="port">串口</label>
          <input id="port" value={port} list="available-ports" placeholder="COM3" disabled={busy || monitoring} onChange={(e) => setPort(e.target.value)} />
          <datalist id="available-ports">
            {ports.map((item) => <option key={item.address} value={item.address}>{item.label}</option>)}
          </datalist>
          <button onClick={() => void refreshPorts()} disabled={busy}>刷新串口列表</button>
          <p className="muted small">串口数量：{ports.length}（也可以手动输入）</p>
          {language === 'micropython' && <MicroPythonPane boardId={microBoardId} onBoard={setMicroBoardId} port={port} busy={busy} action={withBusy} save={save} append={append} result={displayResult} />}
          <h3>工具链状态</h3>
          <p className="muted small">{language === 'arduino' ? cliStatus : pythonStatus}</p>
          <details>
            <summary>工具链设置</summary>
            <div className="tool-settings">
              {language === 'arduino' ? <>
              <p className="muted small">Arduino CLI：{tools?.arduinoCliPath || '检查中'}</p>
              <button disabled={busy} onClick={() => void selectTool('arduinoCliPath')}>选择 Arduino CLI</button>
              <p className="muted small">配置：{tools?.arduinoConfigPath || '使用 CLI 默认配置'}</p>
              <button disabled={busy} onClick={() => void selectTool('arduinoConfigPath')}>选择 CLI 配置</button>
              <button disabled={busy} onClick={() => void withBusy(refreshToolchain)}>刷新开发板</button>
              <button disabled={busy} onClick={() => void withBusy(async () => {
                append('[工具链] 联网安装官方 ESP32 核心，可能需要较长时间。');
                append(displayResult('安装 ESP32 核心', await window.eduboard.installEsp32()));
                await refreshToolchain();
              })}>安装 ESP32 核心（联网）</button>
              <button disabled={busy} onClick={() => void withBusy(async () => {
                append('[工具链] 联网安装固定版本的示例传感器库。');
                append(displayResult('安装示例依赖', await window.eduboard.installExampleLibraries()));
              })}>安装示例依赖（联网）</button>
              </> : <>
                <p className="muted small">Python：{tools?.pythonPath || 'python'}</p>
                <button disabled={busy} onClick={() => void selectTool('pythonPath')}>选择 Python 工具环境</button>
                <button disabled={busy} onClick={() => void withBusy(refreshPythonTools)}>刷新 Python 工具</button>
                <p className="muted small">按离线说明安装 mpremote、esptool、pyserial。语法检查只解析代码；设备模块须在板上验证。</p>
              </>}
            </div>
          </details>
          <h3>使用提醒</h3>
          <p className="muted small">{language === 'arduino' ? '开发预览：上传前确认 ESP32 核心和驱动。' : '开发预览：需先安装匹配的 MicroPython 固件。C3 新示例默认 LED3、按钮5；换板后重新检查引脚。'}</p>
        </aside>

        <section className="editor-region">
          <nav className="mode-tabs" aria-label="开发模式">
            <button aria-pressed={mode === 'blocks'} disabled={busy} onClick={() => void switchMode('blocks')}>图形化</button>
            <button aria-pressed={mode === 'text' && language === 'arduino'} disabled={busy} onClick={() => void switchMode('arduino')}>C++</button>
            <button aria-pressed={mode === 'text' && language === 'micropython'} disabled={busy} onClick={() => void switchMode('micropython')}>Python</button>
            <span>切换保留各模式内容</span>
          </nav>
          <div className="section-head">
            <strong>{mode === 'blocks' ? 'Blockly · 生成 ' + (language === 'arduino' ? 'Arduino C++' : 'MicroPython') : language === 'arduino' ? 'Arduino C++' : 'MicroPython'}</strong>
            {mode === 'blocks' && <select aria-label="积木生成语言" className="language-select" value={blockTarget} disabled={busy || !blockReady} onChange={event => void switchBlockTarget(event.target.value as ProjectLanguage)}>
              <option value="arduino">Arduino C++</option><option value="micropython">MicroPython</option>
            </select>}
            {workspaceState && <button disabled={busy || mode === 'blocks' && (!blockReady || Boolean(blockError))} onClick={() => void adoptGenerated()}>{mode === 'blocks' ? '采用生成代码' : '从积木更新代码'}</button>}
            <span>{dirty ? '有未保存更改' : filePath ? '已保存' : '新建项目未保存'}</span>
          </div>
          {mode === 'blocks' && <div className={blockError ? 'block-message error' : 'block-message'} role={blockError ? 'alert' : undefined}>
            {blockError || blockWarnings.join(' · ') || '积木单向生成代码。采用生成代码可更新文本工作区；三个模式的内容分别保留。'}
          </div>}
          <div className={'editor' + (mode === 'blocks' ? ' editors-split' : '')}>
            {mode === 'blocks' && workspaceState && <div className="blocks-pane">
              <Suspense fallback={<p>正在加载本地积木编辑器…</p>}>
                <BlockEditor key={blockEpoch} ref={blockEditor} initial={workspaceState} language={language} disabled={busy} onUpdate={(snapshot, changed) => {
                  setWorkspaceState(snapshot.workspace); setSource(snapshot.code); setBlockError(snapshot.error); setBlockWarnings(snapshot.warnings); setBlockReady(true);
                  if (changed) setBlockRevision(previous => previous + 1);
                }} />
              </Suspense>
            </div>}
            <div className="code-pane">
            <Editor
              key={blockEpoch + ':' + mode + ':' + language}
              height="100%"
              language={language === 'arduino' ? 'cpp' : 'python'}
              theme="vs-dark"
              value={source}
              onChange={(value) => { if (mode === 'text') { const code = value ?? ''; setSource(code); setTextDrafts(previous => ({ ...previous, [language]: code })); } }}
              loading={<p className="muted">正在加载本地编辑器…</p>}
              options={{ minimap: { enabled: false }, fontSize: 15, automaticLayout: true, tabSize: 2, readOnly: busy || mode === 'blocks', accessibilitySupport: 'on', editContext: false, ariaLabel: mode === 'blocks' ? '生成代码预览' : language === 'arduino' ? 'Arduino C++ 代码编辑器' : 'MicroPython 代码编辑器', scrollBeyondLastLine: false }}
            />
            </div>
          </div>
          <div className="console-header">
            <strong>{language === 'arduino' ? '输出 / 串口监视器' : '输出 / MicroPython REPL'}</strong>
            <div className="row">
              <select aria-label="串口波特率" value={baud} disabled={busy || monitoring} onChange={(e) => setBaud(Number(e.target.value))}>
                <option value={9600}>9600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
              </select>
              <button disabled={busy} onClick={() => void toggleMonitor()}>{monitoring ? '关闭串口' : language === 'arduino' ? '打开串口' : '连接 REPL'}</button>
              {language === 'micropython' && <button disabled={busy || !monitoring} onClick={() => void withBusy(async () => { await window.eduboard.interruptPython(); append('[REPL] 已发送中断，请查看设备响应。'); })}>中断设备程序</button>}
              <button onClick={() => setConsoleText('')}>清空</button>
            </div>
          </div>
          <pre className="console">{consoleText || '暂无输出'}</pre>
          <div className="serial-input">
            <input aria-label="串口发送文本" placeholder="向串口发送文本..." value={serialInput} disabled={!monitoring || busy} onKeyDown={(e) => {
              if (e.key === 'Enter') void sendSerial();
            }} onChange={(e) => setSerialInput(e.target.value)} />
            <button disabled={!monitoring || busy} onClick={() => void sendSerial()}>发送</button>
          </div>
        </section>
      </div>
      <footer className="footer">
        <span>EduBoard IDE · GPL-3.0 · Independent open-source project</span>
        <span role="status">{busy ? '任务执行中…' : monitoring ? '串口监视运行中' : '准备就绪（未验证硬件连接）'}</span>
      </footer>
      {confirmation && <ConfirmDialog message={confirmation.message} onAnswer={(answer) => {
        confirmation.resolve(answer);
        setConfirmation(null);
      }} />}
    </div>
  );
}
