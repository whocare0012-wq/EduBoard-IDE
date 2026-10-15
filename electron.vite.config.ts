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
    publicDir: resolve('node_modules/blockly/media'),
    server: { host: '127.0.0.1' },
    plugins: [react(), {
      name: 'renderer-csp',
      transformIndexHtml(html, context) {
        const dev = Boolean(context.server);
        const policy = "default-src 'self'; script-src 'self'" + (dev ? " 'unsafe-inline'" : '') +
          "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'" +
          (dev ? ' ws://localhost:* ws://127.0.0.1:*' : '') + "; object-src 'none'; base-uri 'none'; frame-src 'none'";
        return html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="' + policy + '">');
      }
    }],
    // electron-vite leaves the renderer unminified by default; Monaco alone is ~8 MB that way.
    build: { minify: 'esbuild', rollupOptions: { input: resolve('apps/desktop/src/renderer/index.html') } }
  }
});
