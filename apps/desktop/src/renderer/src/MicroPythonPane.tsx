// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useState } from 'react';
import { microBoard, type MicroBoardId } from '../../shared/boards';
import type { CommandResult, DeviceFilesResult, FirmwareInfo } from '../../shared/types';
import { icons } from './icons';

interface Props {
  boardId: MicroBoardId; port: string; busy: boolean;
  action: (work: () => Promise<void>) => Promise<void>; save: () => Promise<boolean>;
  append: (message: string) => void; result: (name: string, result: CommandResult) => string;
}
export default function MicroPythonPane({ boardId, port, busy, action, save, append, result }: Props): JSX.Element {
  const [firmware, setFirmware] = useState<FirmwareInfo | null>(null);
  const [files, setFiles] = useState<DeviceFilesResult['files']>([]);
  const [remotePath, setRemotePath] = useState('/main.py');
  const board = microBoard(boardId);
  useEffect(() => { setFirmware(null); }, [boardId]);
  useEffect(() => { setFiles([]); }, [boardId, port]);
  function requirePort(): void { if (!port.trim()) throw new Error('请先选择实际开发板的串口。'); }
  return <>
    <section className="panel-section">
      <div className="section-title">{board.name}</div>
      <p className="hint">{board.notes}</p>
      <p className="hint">在顶部工具栏切换板型与串口{port.trim() ? '，当前串口 ' + port.trim() : '，尚未选择串口'}。</p>
    </section>
    <details className="disclosure"><summary>{icons.flash}固件安装（会清空设备）</summary><div className="disclosure-body">
      <p className="hint">仅接受 MicroPython 1.29.0 的指定 .bin。请按离线部署说明下载到本地。</p>
      <dl className="kv"><dt>文件</dt><dd>{board.filename}</dd></dl>
      <button className="btn block" disabled={busy} onClick={() => void action(async () => {
        setFirmware(null);
        setFirmware(await window.eduboard.chooseFirmware(boardId));
      })}>{icons.open}选择并校验固件</button>
      {firmware && <div className="note"><span className="pill success"><span className="dot" />已通过</span><span>已校验 {firmware.filename} · {firmware.bytes} 字节<br />SHA-256：<span className="mono">{firmware.sha256}</span></span></div>}
      <button className="btn block danger" disabled={busy || !firmware || !port.trim()} onClick={() => void action(async () => {
        requirePort();
        if (!firmware) return;
        try { append(result('刷入固件', await window.eduboard.flashFirmware(firmware.token, port.trim()))); }
        finally { setFirmware(null); }
      })}>{icons.flash}擦除并刷入固件</button>
      <div className="note warning">{icons.warning}<span>将显示板型、串口与摘要确认，并核对实际芯片；取消或失败后需重新校验。中途断电或取消后请重新刷入。</span></div>
    </div></details>
    <details className="disclosure"><summary>{icons.folder}设备文件</summary><div className="disclosure-body">
      <div className="field">
        <label htmlFor="device-path">设备路径</label>
        <input id="device-path" className="input mono" value={remotePath} disabled={busy} spellCheck={false} onChange={event => setRemotePath(event.target.value)} />
      </div>
      <div className="button-stack">
        <button className="btn block" disabled={busy} onClick={() => void action(async () => {
          requirePort(); const listed = await window.eduboard.listDeviceFiles(port.trim()); setFiles(listed.files);
          append(result('设备文件列表', listed)); if (listed.truncated) append('[文件] 仅显示前 256 项。');
        })}>{icons.refresh}刷新设备文件</button>
        <button className="btn block" disabled={busy} onClick={() => void action(async () => {
          requirePort(); if (!(await save())) return;
          append(result('上传 Python 文件', await window.eduboard.uploadPython(port.trim(), remotePath)));
        })}>{icons.upload}上传当前程序到设备</button>
        <button className="btn block" disabled={busy} onClick={() => void action(async () => {
          requirePort(); const downloaded = await window.eduboard.downloadDeviceFile(port.trim(), remotePath);
          if (downloaded) append(result('下载设备文件', downloaded));
        })}>{icons.download}下载设备文件</button>
        <button className="btn block danger" disabled={busy} onClick={() => void action(async () => {
          requirePort(); append(result('删除设备文件', await window.eduboard.deleteDeviceFile(port.trim(), remotePath)));
        })}>{icons.clear}删除设备文件</button>
      </div>
      {files.length > 0 && <ul className="device-files">{files.map(file => <li key={file.name}>
        <button disabled={busy || file.directory} onClick={() => setRemotePath('/' + file.name)}>{file.directory ? icons.folder : icons.file}<span>{file.name}{file.directory ? '/' : ''}</span>{!file.directory && <span className="size">{file.size} B</span>}</button>
      </li>)}</ul>}
      <p className="hint">文件操作会先断开 REPL。上传会替换同名文件，删除需确认；目录须预先存在。</p>
    </div></details>
  </>;
}
