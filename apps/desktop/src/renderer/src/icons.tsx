// SPDX-License-Identifier: GPL-3.0-only
// Small stroke icons drawn for EduBoard. Inline SVG keeps the editor fully offline.
import type { ReactNode } from 'react';

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }): JSX.Element {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}

export const icons = {
  newFile: <Icon><path d="M9 1.75H4.5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.25z" /><path d="M9 1.75v3.5h3.5M8 7.5v4M6 9.5h4" /></Icon>,
  open: <Icon><path d="M1.75 4.25a1 1 0 0 1 1-1h3.5l1.5 1.5h5.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1z" /></Icon>,
  save: <Icon><path d="M2.75 2.25h8.5l2 2v9a.5.5 0 0 1-.5.5H2.75a.5.5 0 0 1-.5-.5v-10.5a.5.5 0 0 1 .5-.5z" /><path d="M5 2.25v3h5v-3M4.75 13.75v-4h6.5v4" /></Icon>,
  verify: <Icon><path d="M3 8.5l3.25 3.25L13 5" /></Icon>,
  upload: <Icon><path d="M2.5 8h9M8 4.5L11.5 8 8 11.5M13.5 3v10" /></Icon>,
  run: <Icon><path d="M4.5 2.75v10.5L13 8z" /></Icon>,
  stop: <Icon><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" /></Icon>,
  refresh: <Icon><path d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71M13.25 2.5v3h-3" /></Icon>,
  plug: <Icon><path d="M6 1.75v3M10 1.75v3M4 4.75h8v2.5a4 4 0 0 1-8 0zM8 11.25v3" /></Icon>,
  unplug: <Icon><path d="M6 1.75v3M10 1.75v3M4 4.75h8v2.5a4 4 0 0 1-8 0zM8 11.25v3M2 2l12 12" /></Icon>,
  clear: <Icon><path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 9.1a1 1 0 0 0 1 .9h4.3a1 1 0 0 0 1-.9l.6-9.1" /></Icon>,
  send: <Icon><path d="M2.25 8L13.75 2.5 11 13.75 7.75 9.25zM7.75 9.25L13.75 2.5" /></Icon>,
  interrupt: <Icon><circle cx="8" cy="8" r="5.75" /><path d="M6.5 5.75v4.5M9.5 5.75v4.5" /></Icon>,
  blocks: <Icon><path d="M2.25 3.25a1 1 0 0 1 1-1h3.5v2a1.25 1.25 0 0 0 2.5 0v-2h3.5a1 1 0 0 1 1 1v3.5h-2a1.25 1.25 0 0 0 0 2.5h2v3.5a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1z" /></Icon>,
  code: <Icon><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" /></Icon>,
  python: <Icon><path d="M5.75 2.25h3.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 0-1.5 1.5v1H3.5a1.5 1.5 0 0 1-1.5-1.5v-2.5a1.5 1.5 0 0 1 1.5-1.5h3.75M10.25 13.75h-3.5a1.5 1.5 0 0 1-1.5-1.5v-1.5M10.75 5.25h1.75a1.5 1.5 0 0 1 1.5 1.5v2.5a1.5 1.5 0 0 1-1.5 1.5h-3.75" /></Icon>,
  project: <Icon><path d="M2.25 3.75a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1z" /><path d="M2.25 6.75h11.5" /></Icon>,
  chip: <Icon><rect x="4" y="4" width="8" height="8" rx="1.25" /><path d="M6.5 1.75V4M9.5 1.75V4M6.5 12v2.25M9.5 12v2.25M1.75 6.5H4M1.75 9.5H4M12 6.5h2.25M12 9.5h2.25" /></Icon>,
  tools: <Icon><path d="M9.9 2.4a3.25 3.25 0 0 0-3.9 4.35L2.25 10.5a1.25 1.25 0 0 0 0 1.75l1.5 1.5a1.25 1.25 0 0 0 1.75 0l3.75-3.75a3.25 3.25 0 0 0 4.35-3.9l-2 2-1.75-.25-.25-1.75z" /></Icon>,
  info: <Icon><circle cx="8" cy="8" r="5.75" /><path d="M8 7.25v3.5M8 5.25v.01" /></Icon>,
  warning: <Icon><path d="M8 2.25l6 10.5H2zM8 6.5v3M8 11.25v.01" /></Icon>,
  file: <Icon><path d="M9 1.75H4.5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.25zM9 1.75v3.5h3.5" /></Icon>,
  folder: <Icon><path d="M1.75 4.25a1 1 0 0 1 1-1h3.5l1.5 1.5h5.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1z" /></Icon>,
  download: <Icon><path d="M8 2.25v8M4.75 7L8 10.25 11.25 7M2.75 13.75h10.5" /></Icon>,
  terminal: <Icon><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.25" /><path d="M4.5 6.25L6.75 8 4.5 9.75M8.25 10h3.25" /></Icon>,
  flash: <Icon><path d="M9 1.75L3.5 9h4l-.5 5.25L12.5 7h-4z" /></Icon>,
  logo: (
    <svg className="logo-mark" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="var(--accent)" />
      <path d="M8 7.5h8M8 12h5.5M8 16.5h8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="17.5" cy="12" r="1.6" fill="#fff" />
    </svg>
  )
};
