import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve('apps/desktop/src/main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve('apps/desktop/src/preload/index.ts') } }
  },
  renderer: {
    root: resolve('apps/desktop/src/renderer'),
    plugins: [react()],
    build: { rollupOptions: { input: resolve('apps/desktop/src/renderer/index.html') } }
  }
});
