/* Build the same Vite product used by Pages and Capacitor.
 * Only dist/ is public; optional account functions remain in netlify/functions.
 * Invoke Node directly so platform-specific npm shims cannot alter the build. */
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
await access(new URL('../dist/index.html', import.meta.url));
console.log('Cosmo: checked TypeScript and built the public dist artifact.');
