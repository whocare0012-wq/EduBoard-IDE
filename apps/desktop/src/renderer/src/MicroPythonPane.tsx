// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useState } from 'react';
import { MICRO_BOARDS, microBoard, type MicroBoardId } from '../../shared/boards';
import type { CommandResult, DeviceFilesResult, FirmwareInfo } from '../../shared/types';

interface Props {
  boardId: MicroBoardId; onBoard: (board: MicroBoardId) => void; port: string; busy: boolean;
  action: (work: () => Promise<void>) => Promise<void>; save: () => Promise<boolean>;
  append: (message: string) => void; result: (name: string, result: CommandResult) => string;
}
export default function MicroPythonPane({ boardId, onBoard, port, busy, action, save, append, result }: Props): JSX.Element {
  const [firmware, setFirmware] = useState<FirmwareInfo | null>(null);
  const [files, setFiles] = useState<DeviceFilesResult['files']>([]);
  const [remotePath, setRemotePath] = useState('/main.py');
  const board = microBoard(boardId);
  useEffect(() => { setFirmware(null); }, [boardId]);
  useEffect(() => { setFiles([]); }, [boardId, port]);
  function requirePort(): void { if (!port.trim()) throw new Error('请先选择实际开发板的串口。'); }
  return <>
    <h3>MicroPython 开发板</h3>
    <label htmlFor="micro-board">固件 / 板型</label>
    <select id="micro-board" value={boardId} disabled={busy} onChange={event => onBoard(event.target.value as MicroBoardId)}>
      {MICRO_BOARDS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <p className="muted small">{board.notes}</p>
    <details><summary>固件安装（会清空设备）</summary><div className="tool-settings">
      <p className="muted small">仅接受 MicroPython 1.29.0 的指定 .bin。请按离线部署说明下载到本地。</p>
      <p className="muted small">文件：{board.filename}</p>
      <button disabled={busy} onClick={() => void action(async () => {
        setFirmware(null);
        setFirmware(await window.eduboard.chooseFirmware(boardId));
      })}>选择并校验固件</button>
      {firmware && <p className="muted small">已校验 {firmware.filename} · {firmware.bytes} 字节<br />SHA-256：{firmware.sha256}</p>}
      <button disabled={busy || !firmware || !port.trim()} onClick={() => void action(async () => {
        requirePort();
        if (!firmware) return;
        try { append(result('刷入固件', await window.eduboard.flashFirmware(firmware.token, port.trim()))); }
        finally { setFirmware(null); }
      })}>擦除并刷入固件</button>
      <p className="muted small">将显示板型、串口与摘要确认，并核对实际芯片；取消或失败后需重新校验。中途断电或取消后请重新刷入。</p>
    </div></details>
    <details><summary>设备文件</summary><div className="tool-settings">
      <label htmlFor="device-path">设备路径</label>
      <input id="device-path" value={remotePath} disabled={busy} onChange={event => setRemotePath(event.target.value)} />
      <button disabled={busy} onClick={() => void action(async () => {
        requirePort(); const listed = await window.eduboard.listDeviceFiles(port.trim()); setFiles(listed.files);
        append(result('设备文件列表', listed)); if (listed.truncated) append('[文件] 仅显示前 256 项。');
      })}>刷新设备文件</button>
      <button disabled={busy} onClick={() => void action(async () => {
        requirePort(); if (!(await save())) return;
        append(result('上传 Python 文件', await window.eduboard.uploadPython(port.trim(), remotePath)));
      })}>上传当前程序到设备</button>
      <button disabled={busy} onClick={() => void action(async () => {
        requirePort(); const downloaded = await window.eduboard.downloadDeviceFile(port.trim(), remotePath);
        if (downloaded) append(result('下载设备文件', downloaded));
      })}>下载设备文件</button>
      <button disabled={busy} onClick={() => void action(async () => {
        requirePort(); append(result('删除设备文件', await window.eduboard.deleteDeviceFile(port.trim(), remotePath)));
      })}>删除设备文件</button>
      <ul className="device-files">{files.map(file => <li key={file.name}>
        <button disabled={busy || file.directory} onClick={() => setRemotePath('/' + file.name)}>{file.name}{file.directory ? '/' : ' · ' + file.size + ' B'}</button>
      </li>)}</ul>
      <p className="muted small">文件操作会先断开 REPL。上传会替换同名文件，删除需确认；目录须预先存在。</p>
    </div></details>
  </>;
}
