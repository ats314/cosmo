/* STAGE THE PUBLISHED SITE. Netlify's build step, and it holds no list.

   IT LIVES HERE AND NOT IN tools/ BECAUSE tools/ MEANS SOMETHING. Every
   tools/*.mjs is a CI harness, and check.mjs enforces exactly that: a file
   there must declare a lane, must be run by the workflow, and must be named in
   docs/harnesses.md. This is a deploy step, not a check — it asserts nothing —
   so filing it under tools/ would either break that guard or hollow it out by
   widening it to admit things that are not harnesses. It sits with the rest of
   the Netlify half instead.

   The set of files that make up the site is stated once, in the `cp … _site/`
   line of .github/workflows/pages.yml, and guarded there: check.mjs fails the
   build if a tracked file at the repository root is in neither that list nor
   its own internal one. That guard is what stops an internal document becoming
   a public URL, and it only guards ONE list.

   So this reads that line rather than restating it. A second copy would be a
   second thing to update, and the failure mode is silent on whichever host got
   forgotten — the site is an allowlist on Pages and the whole repository on
   Netlify, or an asset 404s on one host and not the other. all.mjs already
   works this way for the same reason: it runs what CI runs by parsing CI,
   holding no list of harnesses of its own.

   The BUILD stamp is applied here too, exactly as the Pages workflow applies
   it: the source says 'dev' and only the published artifact carries a sha, so
   index.html stays a single hand-written file with no build step. Netlify
   supplies the commit as COMMIT_REF. */
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);   /* netlify/ -> repository root */
const wf = await readFile(new URL('.github/workflows/pages.yml', root), 'utf8');

const cp = wf.match(/\bcp\s+([\s\S]*?)\s+_site\//);
if (!cp) {
  console.error('build.mjs: could not find the `cp … _site/` staging list in pages.yml.\n'
    + 'That line is the single statement of what the published site contains. If the\n'
    + 'deploy has been restructured, this build step has to be restructured with it —\n'
    + 'it must never fall back to publishing the whole repository, which is what the\n'
    + 'allowlist exists to prevent.');
  process.exit(1);
}
const files = cp[1].split(/[\s\\]+/).filter(Boolean);

await rm(new URL('_site/', root), { recursive: true, force: true });
await mkdir(new URL('_site/', root), { recursive: true });

for (const f of files) {
  await copyFile(new URL(f, root), new URL('_site/' + f, root));
}

/* Stamp the artifact, never the source. COMMIT_REF is Netlify's; the Pages
   workflow uses GITHUB_SHA for the identical rewrite. Absent either, the page
   keeps saying 'dev', which is true — it is an unstamped build. */
const sha = (process.env.COMMIT_REF || process.env.GITHUB_SHA || '').slice(0, 7);
if (sha) {
  const p = new URL('_site/index.html', root);
  const html = await readFile(p, 'utf8');
  const stamped = html.replace("const BUILD='dev'", `const BUILD='${sha}'`);
  if (stamped === html) {
    console.error("build.mjs: could not find `const BUILD='dev'` to stamp in index.html.\n"
      + 'The build stamp is how a screenshot says which build it came from; a deploy\n'
      + 'that silently ships an unstamped page brings back the day that bought it.');
    process.exit(1);
  }
  await writeFile(p, stamped);
}

console.log(`build.mjs: staged ${files.length} files into _site/${sha ? ` at ${sha}` : ' (unstamped)'}`);
