import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';

function buildId(): string {
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return (process.env.COMMIT_REF || process.env.GITHUB_SHA || 'dev').slice(0, 7); }
}

export default defineConfig(({ command }) => ({
  base: './',
  define: { __COSMO_BUILD__: JSON.stringify(command === 'build' ? buildId() : 'dev') },
  server: { host: 'localhost', port: 5173, strictPort: true },
  preview: { host: 'localhost', port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
}));
