// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export default function useWorkspaceLayout() {
  const region = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth - 336, height: window.innerHeight - 72 });
  const [outputOpen, setOutputOpen] = useState(true);
  const [preferredHeight, setPreferredHeight] = useState<number | null>(null);
  const [previewPreference, setPreviewPreference] = useState<boolean | null>(null);
  const [preferredPercent, setPreferredPercent] = useState(40);
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const maxOutput = Math.max(112, size.height - 320);
  const outputHeight = Math.round(clamp(preferredHeight ?? size.height * 0.25, 112, Math.min(480, maxOutput)));
  const minPreview = Math.min(50, Math.ceil(220 / Math.max(size.width, 1) * 100));
  const maxPreview = Math.max(minPreview, Math.min(65, Math.floor((1 - 280 / Math.max(size.width, 1)) * 100)));
  const previewPercent = clamp(preferredPercent, minPreview, maxPreview);
  return {
    region, outputOpen, setOutputOpen, outputHeight, maxOutput: Math.min(480, maxOutput),
    resizeOutput: setPreferredHeight, resetOutput: () => setPreferredHeight(null),
    previewVisible: previewPreference ?? size.width >= 760,
    showPreview: () => setPreviewPreference(true),
    togglePreview: () => setPreviewPreference(previous => !(previous ?? size.width >= 760)),
    previewPercent, minPreview, maxPreview, resizePreview: setPreferredPercent,
    resetPreview: () => { setPreferredPercent(40); setPreviewPreference(null); },
    previewUnitsPerPixel: 100 / Math.max(size.width, 1)
  };
}
