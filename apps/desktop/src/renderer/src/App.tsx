// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { BoardInfo, CommandResult, PortInfo, Sketch, ToolSettings } from '../../shared/types';
import './editor';
import ConfirmDialog from './ConfirmDialog';

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

function displayResult(action: string, result: CommandResult): string {
  return [
    '[' + action + '] ' + (result.ok ? '成功' : '失败'),
    result.streamed ? '' : result.stdout.trim(),
    result.streamed && result.ok ? '' : result.stderr.trim()
  ].filter(Boolean).join('\n') + '\n';
}

export default function App(): JSX.Element {
  const [source, setSource] = useState(STARTER);
  const [savedSource, setSavedSource] = useState(STARTER);
  const [confirmation, setConfirmation] = useState<{ resolve: (answer: boolean) => void } | null>(null);
  const dirty = source !== savedSource;
  const [filePath, setFilePath] = useState('');
  const [fqbn, setFqbn] = useState('esp32:esp32:esp32');
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
  }, [dirty, busy, source, confirmation]);

  function discardIfNeeded(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    return new Promise((resolve) => setConfirmation({ resolve }));
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

  async function selectTool(tool: 'arduinoCliPath' | 'arduinoConfigPath'): Promise<void> {
    await withBusy(async () => {
      const selected = await window.eduboard.chooseTool(tool);
      if (selected) { setTools(selected); await refreshToolchain(); await refreshPorts(); }
    });
  }

  async function refreshPorts(): Promise<void> {
    try {
      const result = await window.eduboard.ports();
      setPorts(result.ports);
      if (!result.ok) append(displayResult('识别串口', result));
    } catch (error) {
      append('[识别串口失败] ' + String(error));
    }
  }

  function applySketch(sketch: Sketch): void {
    setSource(sketch.source);
    setSavedSource(sketch.source);
    setFilePath(sketch.filePath);
    append('[项目] ' + sketch.filePath);
  }

  async function save(): Promise<boolean> {
    const result = await window.eduboard.saveSketch(source);
    if (!result) return false;
    setFilePath(result.filePath);
    setSavedSource(result.source);
    append('[已保存] ' + result.filePath);
    return true;
  }

  async function compile(): Promise<void> {
    await withBusy(async () => {
      if (!(await save())) return;
      append('[编译中] ' + fqbn);
      const result = await window.eduboard.compile(fqbn.trim());
      append(displayResult('编译', result));
    });
  }

  async function upload(): Promise<void> {
    await withBusy(async () => {
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
      const result = await window.eduboard.startMonitor(port.trim(), baud);
      append('[串口] ' + result.message);
    });
  }

  async function sendSerial(): Promise<void> {
    if (!serialInput) return;
    try {
      await window.eduboard.sendMonitor(serialInput + '\n');
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
          <span className="version">Pre-alpha · V0.1</span>
        </div>
        <div className="toolbar">
          <button disabled={busy} onClick={() => void withBusy(async () => {
            if (!(await discardIfNeeded())) return;
            await window.eduboard.newSketch();
            setFilePath('');
            setSource(STARTER);
            setSavedSource(STARTER);
          })}>新建</button>
          <button disabled={busy} onClick={() => void withBusy(async () => {
            if (!(await discardIfNeeded())) return;
            const project = await window.eduboard.openSketch();
            if (project) applySketch(project);
          })}>打开</button>
          <button disabled={busy} onClick={() => void withBusy(async () => { await save(); })}>保存</button>
          <button className="primary" disabled={busy} onClick={() => void compile()}>编译</button>
          <button className="primary" disabled={busy} onClick={() => void upload()}>编译并上传</button>
          {busy && <button onClick={() => void window.eduboard.cancelTask().catch(error => append(String(error)))}>取消任务</button>}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <h3>当前项目</h3>
          <div className="file">{filePath || '未保存 · Blink.ino'}{dirty ? ' · 有未保存更改' : ''}</div>
          <h3>开发板配置</h3>
          <label htmlFor="fqbn">Arduino FQBN</label>
          <input id="fqbn" list="installed-boards" value={fqbn} disabled={busy} onChange={(e) => setFqbn(e.target.value)} />
          <datalist id="installed-boards">
            {boards.map((board) => <option key={board.fqbn} value={board.fqbn}>{board.name}</option>)}
          </datalist>
          <p className="muted small">已安装目标：{boards.length} · 请选择实际板型</p>
          <label htmlFor="port">串口</label>
          <input id="port" value={port} list="available-ports" placeholder="COM3" disabled={busy} onChange={(e) => setPort(e.target.value)} />
          <datalist id="available-ports">
            {ports.map((item) => <option key={item.address} value={item.address}>{item.label}</option>)}
          </datalist>
          <button onClick={() => void refreshPorts()} disabled={busy}>刷新串口列表</button>
          <p className="muted small">串口数量：{ports.length}（也可以手动输入）</p>
          <h3>工具链状态</h3>
          <p className="muted small">{cliStatus}</p>
          <details>
            <summary>工具链设置</summary>
            <div className="tool-settings">
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
            </div>
          </details>
          <h3>使用提醒</h3>
          <p className="muted small">此版本为开源开发预览。上传前请确认已安装对应 ESP32 核心和驱动。</p>
        </aside>

        <section className="editor-region">
          <div className="section-head">
            <strong>Arduino C++</strong>
            <span>{dirty ? '有未保存更改' : filePath ? '已保存' : '新建项目未保存'}</span>
          </div>
          <div className="editor">
            <Editor
              height="100%"
              language="cpp"
              theme="vs-dark"
              value={source}
              onChange={(value) => setSource(value ?? '')}
              loading={<p className="muted">正在加载本地编辑器…</p>}
              options={{ minimap: { enabled: false }, fontSize: 15, automaticLayout: true, tabSize: 2, readOnly: busy, accessibilitySupport: 'on', editContext: false, ariaLabel: 'Arduino C++ 代码编辑器', scrollBeyondLastLine: false }}
            />
          </div>
          <div className="console-header">
            <strong>输出 / 串口监视器</strong>
            <div className="row">
              <select aria-label="串口波特率" value={baud} disabled={busy || monitoring} onChange={(e) => setBaud(Number(e.target.value))}>
                <option value={9600}>9600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
              </select>
              <button disabled={busy} onClick={() => void toggleMonitor()}>{monitoring ? '关闭串口' : '打开串口'}</button>
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
      {confirmation && <ConfirmDialog message="继续操作会丢失编辑器中未保存的更改。可取消后先保存。" onAnswer={(answer) => {
        confirmation.resolve(answer);
        setConfirmation(null);
      }} />}
    </div>
  );
}
