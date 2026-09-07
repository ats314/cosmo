#!/usr/bin/env node
/* Binary documents never enter this database. This is how they are kept out.

   The rule is simple and it is about cost: a PDF cannot be grepped, cannot be
   line-anchored, and cannot be read by an agent without spending tokens on the
   whole thing to find one paragraph. Every session that opens it pays again for
   what the last session already read. So a source document is converted to text
   ONCE, on the way in, and only the text is ever cited afterwards.

   Extraction is dependency-free by the same rule the harnesses follow — Node's
   zlib is enough for the two formats that matter (PDF content streams and the
   OOXML zip container). If `pdftotext` happens to be installed it is used
   first, because a real typesetting-aware extractor beats this one.

   WHAT IT CANNOT DO, stated up front so nobody trusts it further than it goes:
   a scanned PDF is images and comes out empty (that needs OCR, which is not
   here); PDFs using CID-keyed fonts with custom encodings can come out
   garbled. Both cases are reported rather than silently written, because a
   half-extracted source that looks complete is the failure worth avoiding.

     node db/ingest.mjs <file> [--id source.some-slug] [--title "…"] [--note "why it is here"]

   Writes db/sources/<slug>.txt and appends a source record to
   db/records/parts/sources.jsonl. Run `node db/build.mjs` afterwards. */
import { readFile, writeFile, mkdir, appendFile, stat } from 'node:fs/promises';
import { inflateSync, inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, extname, resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('usage: node db/ingest.mjs <file> [--id source.slug] [--title "…"] [--note "why"]');
  process.exit(1);
}
const opt = (name) => { const i = args.indexOf(`--${name}`); return i < 0 ? null : args[i + 1]; };

const abs = resolve(file);
let raw;
try { raw = await readFile(abs); }
catch (e) { console.error(`Cannot read ${abs}: ${e.message}`); process.exit(1); }
const ext = extname(abs).toLowerCase();
const slug = (opt('id') || `source.${basename(abs, ext)}`).replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
const outName = slug.replace(/^source\./, '') + '.txt';

const clean = (s) => s
  .replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const stripTags = (xml) => clean(xml
  .replace(/<\/(w:p|p|div|br|tr|li|h[1-6]|a:p)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/[ \t]{2,}/g, ' '));

/* ---------- the OOXML container ----------
   .docx/.pptx/.xlsx are zip files. The central directory is parsed rather than
   the local headers because entries written in streaming mode put their sizes
   in a trailing descriptor the local header does not have — reading local
   headers works on most files and then mysteriously does not on some. */
function unzip(buf) {
  const files = new Map();
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip container (no end-of-central-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.slice(start, start + compSize);
    try { files.set(name, method === 0 ? data : inflateRawSync(data)); }
    catch { /* one unreadable member does not fail the document */ }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ---------- PDF ----------
   Content streams are located by their dictionaries, inflated when Flate-coded,
   and mined for the text-showing operators. Positioning is discarded; what
   survives is reading order as the producer wrote it, which is what a later
   reader actually needs. */
function pdfText(buf) {
  const chunks = [];
  const s = buf.toString('latin1');
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    const dictFrom = s.lastIndexOf('<<', m.index);
    const dict = dictFrom < 0 ? '' : s.slice(dictFrom, m.index);
    let body = Buffer.from(s.slice(start, end), 'latin1');
    if (/\/FlateDecode/.test(dict)) {
      try { body = inflateSync(body); }
      catch { try { body = inflateRawSync(body); } catch { continue; } }
    } else if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode|Image)/.test(dict)) {
      continue;                                   // an image, not prose
    }
    const text = body.toString('latin1');
    if (!/\b(Tj|TJ)\b/.test(text)) continue;
    const out = [];
    /* (literal) Tj — and the array form, where the numbers are kerning and the
       big negative ones are word gaps worth turning back into spaces. */
    const op = /(?:\[((?:[^\[\]\\]|\\.)*)\]\s*TJ)|(?:\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|"))|(?:(T\*|Td|TD))/g;
    let t;
    while ((t = op.exec(text))) {
      if (t[3]) { out.push('\n'); continue; }
      if (t[2] !== undefined) { out.push(unescapePdf(t[2])); continue; }
      let line = '';
      const inner = /\(((?:[^()\\]|\\.)*)\)|(-?\d+\.?\d*)/g;
      let piece;
      while ((piece = inner.exec(t[1]))) {
        if (piece[1] !== undefined) line += unescapePdf(piece[1]);
        else if (Number(piece[2]) < -180) line += ' ';
      }
      out.push(line);
    }
    const joined = out.join('').replace(/\n{2,}/g, '\n');
    if (joined.trim()) chunks.push(joined);
  }
  return clean(chunks.join('\n\n'));
}

const unescapePdf = (s) => s
  .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] || c))
  .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));

let text = '';
let how = '';
let warning = null;

if (['.txt', '.md', '.csv', '.tsv', '.json', '.mjs', '.js', '.ts'].includes(ext)) {
  text = clean(raw.toString('utf8'));
  how = 'copied (already text)';
} else if (['.html', '.htm', '.xml'].includes(ext)) {
  text = stripTags(raw.toString('utf8').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' '));
  how = 'markup stripped';
} else if (ext === '.pdf') {
  try {
    text = clean(execFileSync('pdftotext', ['-layout', abs, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    how = 'pdftotext -layout';
  } catch {
    text = pdfText(raw);
    how = 'built-in PDF content-stream extractor';
    warning = 'pdftotext was not available. If this document uses CID-keyed fonts the text may be garbled — read the first page of the output before trusting it.';
  }
  if (!text.trim()) {
    console.error('FAIL  no text came out of this PDF. It is almost certainly a scan (images, no text layer),\n'
      + '      which needs OCR. Nothing was written — an empty source record would read as "this document says nothing".');
    process.exit(1);
  }
} else if (['.docx', '.pptx', '.xlsx'].includes(ext)) {
  const zip = unzip(raw);
  const parts = [...zip.keys()]
    .filter(n => /^(word\/document|ppt\/slides\/slide\d+|ppt\/notesSlides\/\w+|xl\/sharedStrings|xl\/worksheets\/sheet\d+)\.xml$/.test(n))
    .sort();
  if (!parts.length) throw new Error(`no readable document parts inside ${ext} container`);
  text = clean(parts.map(n => stripTags(zip.get(n).toString('utf8'))).join('\n\n'));
  how = `OOXML container, ${parts.length} part(s)`;
} else {
  console.error(`FAIL  no extractor for "${ext}". Convert it to text yourself and ingest that,\n`
    + '      or add an extractor here. Do not commit the binary and cite it — that is the rule this file enforces.');
  process.exit(1);
}

const sha = createHash('sha256').update(raw).digest('hex').slice(0, 16);
const { size } = await stat(abs);
await mkdir(new URL('db/sources/', root), { recursive: true });
const header = `# ${opt('title') || basename(abs)}

> Extracted from \`${basename(abs)}\` (${(size / 1024).toFixed(0)} KB, sha256:${sha}) by db/ingest.mjs
> Method: ${how}. Cite this file, not the original.
${warning ? `>\n> CAVEAT: ${warning}\n` : ''}
---

`;
await writeFile(new URL(`db/sources/${outName}`, root), header + text + '\n');

const words = text.split(/\s+/).filter(Boolean).length;
const record = {
  id: slug,
  kind: 'source',
  name: basename(abs),
  summary: (opt('note') || `External source ingested from ${basename(abs)}; extracted text at db/sources/${outName}.`).slice(0, 200),
  tags: ['source', 'ingested', ext.slice(1)],
  status: 'current',
  provenance: 'generated',
  confidence: 'verified',
  detail: `${words} words, ${how}. Original ${(size / 1024).toFixed(0)} KB, sha256:${sha}. The binary is not committed; this record and db/sources/${outName} are the citable form.`,
  note: `db/sources/${outName}`,
  values: { words, originalBytes: size },
};
await appendFile(new URL('db/records/parts/sources.jsonl', root), JSON.stringify(record) + '\n');

console.log(`OK  ${words} words → db/sources/${outName}`);
console.log(`    ${how}${warning ? `\n    CAVEAT: ${warning}` : ''}`);
console.log(`    record ${slug} appended to db/records/parts/sources.jsonl — run: node db/build.mjs`);
