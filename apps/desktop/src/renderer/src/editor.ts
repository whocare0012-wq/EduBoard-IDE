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
