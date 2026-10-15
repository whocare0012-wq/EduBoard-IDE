// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef } from 'react';
import { icons } from './icons';

export interface ConfirmText { title: string; confirm: string; tone?: 'danger' | 'primary'; }
export const DISCARD_TEXT: ConfirmText = { title: '未保存的内容', confirm: '放弃更改并继续', tone: 'danger' };

export default function ConfirmDialog({ message, text = DISCARD_TEXT, onAnswer, onSave }: { message: string; text?: ConfirmText; onAnswer: (yes: boolean) => void; onSave?: () => void }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <div className="modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onAnswer(false); }
        if (event.key === 'Tab') {
          const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
          if (buttons && buttons.length > 0) {
            const index = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
            const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
            event.preventDefault(); buttons[next].focus();
          }
        }
      }}>
        <div className="modal-head">
          <span className="modal-icon">{icons.warning}</span>
          <h2 id="confirm-title">{text.title}</h2>
        </div>
        <p id="confirm-message">{message}</p>
        <div className="row">
          <button className="btn lg" onClick={() => onAnswer(false)}>取消</button>
          <button className={'btn lg ' + (text.tone === 'danger' ? 'danger' : 'primary')} onClick={() => onAnswer(true)}>{text.confirm}</button>
          {onSave && <button className="btn lg primary" onClick={onSave}>保存后继续</button>}
        </div>
      </div>
    </div>
  );
}
