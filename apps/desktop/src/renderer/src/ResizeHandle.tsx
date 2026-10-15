// SPDX-License-Identifier: GPL-3.0-only
import { useRef } from 'react';

interface Props {
  label: string;
  orientation: 'horizontal' | 'vertical';
  value: number;
  min: number;
  max: number;
  unitsPerPixel?: number;
  step: number;
  onChange: (value: number) => void;
  onReset: () => void;
}

export default function ResizeHandle({ label, orientation, value, min, max, unitsPerPixel = 1, step, onChange, onReset }: Props): JSX.Element {
  const drag = useRef<{ origin: number; value: number } | null>(null);
  const update = (next: number): void => onChange(Math.round(Math.max(min, Math.min(max, next))));
  return <div className={'resize-handle ' + orientation} role="separator" aria-label={label} aria-orientation={orientation}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} tabIndex={0} title={label + '（拖动或方向键调整，双击恢复默认）'}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { origin: orientation === 'vertical' ? event.clientX : event.clientY, value };
    }} onPointerMove={event => {
      if (!drag.current) return;
      const position = orientation === 'vertical' ? event.clientX : event.clientY;
      update(drag.current.value + (drag.current.origin - position) * unitsPerPixel);
    }} onPointerUp={event => {
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }} onLostPointerCapture={() => { drag.current = null; }} onDoubleClick={onReset} onKeyDown={event => {
      const increase = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
      const decrease = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
      if (![increase, decrease, 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      update(event.key === 'Home' ? min : event.key === 'End' ? max : value + (event.key === increase ? step : -step));
    }} />;
}
