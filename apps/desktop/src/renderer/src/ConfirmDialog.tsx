// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef } from 'react';

export interface ConfirmText { title: string; confirm: string; }
export const DISCARD_TEXT: ConfirmText = { title: '未保存的内容', confirm: '放弃更改并继续' };

export default function ConfirmDialog({ message, text = DISCARD_TEXT, onAnswer }: { message: string; text?: ConfirmText; onAnswer: (yes: boolean) => void }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <div className="modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onAnswer(false); }
        if (event.key === 'Tab') {
          const buttons = dialog.current?.querySelectorAll('button');
          if (buttons && buttons.length > 0) {
            const next = document.activeElement === buttons[0] ? buttons[1] : buttons[0];
            event.preventDefault(); next?.focus();
          }
        }
      }}>
        <h2 id="confirm-title">{text.title}</h2>
        <p>{message}</p>
        <div className="row">
          <button onClick={() => onAnswer(false)}>取消</button>
          <button onClick={() => onAnswer(true)}>{text.confirm}</button>
        </div>
      </div>
    </div>
  );
}
