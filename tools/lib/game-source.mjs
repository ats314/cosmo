/* One canonical source for the VM and pixel harnesses. The production game
   creates this body inside createCosmoRuntime(host); tests keep its lexical
   globals visible and use its compatibility RAF loop. No copied game fixture. */
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
export const runtimeURL = new URL('src/game/runtime.js', root);

export async function loadGameSource() {
  const source = await readFile(runtimeURL, 'utf8');
  const start = '// @runtime-body:start', end = '// @runtime-body:end';
  const a = source.indexOf(start), b = source.indexOf(end);
  if (a < 0 || b <= a || source.indexOf(start, a + start.length) >= 0 ||
      source.indexOf(end, b + end.length) >= 0)
    throw new Error('runtime.js needs exactly one ordered pair of runtime-body markers');
  const firstLineEnd = source.indexOf('\n', a);
  if (firstLineEnd < 0 || firstLineEnd >= b) throw new Error('runtime.js has an empty runtime body');
  const prefixLines = source.slice(0, firstLineEnd + 1).split('\n').length - 1;
  return {
    body: 'const host = {};' + '\n'.repeat(prefixLines) + source.slice(firstLineEnd + 1, b),
    // Padding keeps VM stack lines aligned with the canonical source file.
    lineOffset: 0,
    path: 'src/game/runtime.js',
  };
}

export async function loadGameHtml() {
  const [shell, game, styles] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'), loadGameSource(),
    readFile(new URL('src/styles.css', root), 'utf8'),
  ]);
  const template = shell.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/head>/i, () => '<style>\n' + styles + '\n</style>\n</head>');
  if (!/<\/body>/i.test(template)) throw new Error('the app shell has no body for the runtime harness');
  return template.replace(/<\/body>/i, () => '<script>\n' + game.body + '\n</script>\n</body>');
}
