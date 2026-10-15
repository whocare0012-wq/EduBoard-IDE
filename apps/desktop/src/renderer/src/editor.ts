// SPDX-License-Identifier: GPL-3.0-only
import { loader } from '@monaco-editor/react';
// Keep editor commands while loading only the two languages this IDE uses.
import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/features/register.all';
import 'monaco-editor/editor/browser/coreCommands';
import 'monaco-editor/languages/definitions/cpp/register';
import 'monaco-editor/languages/definitions/python/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export { monaco };

// Mirrors the CSS design tokens in styles.css so the editor sits flush with the surrounding UI.
export const EDITOR_THEME = 'eduboard-dark';
monaco.editor.defineTheme(EDITOR_THEME, {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: 'comment', foreground: '6f7d91', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c792ea' },
    { token: 'string', foreground: 'a5d6a7' },
    { token: 'number', foreground: 'f2b66d' },
    { token: 'type', foreground: '7fdbca' },
    { token: 'identifier', foreground: 'dbe2ec' },
    { token: 'delimiter', foreground: '9aa6b8' }
  ],
  colors: {
    'editor.background': '#0f1318', 'editor.foreground': '#dbe2ec', 'editorLineNumber.foreground': '#465062', 'editorLineNumber.activeForeground': '#a9b2c1',
    'editor.lineHighlightBackground': '#161c24', 'editor.lineHighlightBorder': '#00000000', 'editor.selectionBackground': '#3d7bfd47', 'editor.inactiveSelectionBackground': '#3d7bfd24',
    'editorCursor.foreground': '#8fb3ff', 'editorIndentGuide.background1': '#1f2630', 'editorIndentGuide.activeBackground1': '#353e4d', 'editorWhitespace.foreground': '#2b3341',
    'editorGutter.background': '#0f1318', 'editorWidget.background': '#1a2029', 'editorWidget.border': '#353e4d', 'editorSuggestWidget.background': '#1a2029',
    'editorSuggestWidget.selectedBackground': '#2b3341', 'scrollbarSlider.background': '#ffffff1a', 'scrollbarSlider.hoverBackground': '#ffffff2e', 'scrollbarSlider.activeBackground': '#ffffff3d',
    'editorBracketMatch.background': '#3d7bfd26', 'editorBracketMatch.border': '#3d7bfd80', 'focusBorder': '#3d7bfd'
  }
});
