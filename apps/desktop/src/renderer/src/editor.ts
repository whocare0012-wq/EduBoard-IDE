// SPDX-License-Identifier: GPL-3.0-only
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import 'monaco-editor/languages/definitions/cpp/register';
import 'monaco-editor/languages/definitions/python/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
