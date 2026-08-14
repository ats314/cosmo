/* @lane full */
/* THE ONLY HARNESS THAT LOOKS AT A PIXEL A PLAYER WOULD SEE.

   Every other check in this repo stubs the canvas. fxcheck records WebGL calls
   and asserts on what was ISSUED; drawcheck validates every 2D call the way a
   browser would. Both are necessary and neither can see a frame. A drawImage
   at the wrong translate is indistinguishable from one at the right translate:
   the call is valid, the arguments are finite, the count is correct, and the
   glow lands three pixels off the light it belongs to.

   That blind spot has a body count. In one session it hid: a hairline rim down
   every screen edge (reported by the owner as "it's like you put a layer over
   the screen"), every halo oscillating a few pixels off its own light
   ("everything just kind of wobbles around"), two fixed white highlight terms
   burying six world palettes into three, and the shipped glow path carrying
   less than half the light of the fallback it replaced. Seven checks were
   green through all of it. The bugs were not subtle — they were invisible to
   the only eyes CI had.

   So this one renders. Real Chromium, real WebGL under SwiftShader (GL.on
   comes up true, so the actual backdrop shader runs rather than the 2D
   fallback), the real game driven into a real run, and assertions on the
   framebuffer. It is the seventh harness and it is slow on purpose: it is the
   difference between "somebody should look at the game" being an instruction
   a person has to remember and being something the build does.

   ON THE DEPENDENCY. Every other tool here runs on Node's vm and a stubbed
   DOM with nothing installed, and that rule is worth keeping for them. This
   one cannot: there is no way to rasterise a fragment shader without a GPU
   stack. It therefore SKIPS, loudly, when no browser is present — and
   check.mjs asserts that the CI workflow installs one, so a skip can only
   ever happen on a developer's machine and never silently in the build. A
   guard that can quietly not run is not a guard. */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { seedLine } from './lib/rng.mjs';

console.log(seedLine('rendercheck'));

const fail = [];
const note = [];
const root = new URL('../', import.meta.url);
const indexPath = new URL('index.html', root).pathname;

/* ---------------- find a browser, or skip loudly ---------------- */
function findChromium() {
  if (process.env.COSMO_CHROME && existsSync(process.env.COSMO_CHROME)) return process.env.COSMO_CHROME;
  /* the image this repo's sessions run in ships one here */
  for (const g of ['/opt/pw-browsers']) {
    if (!existsSync(g)) continue;
    for (const d of ['chromium-1194/chrome-linux/chrome', 'chromium/chrome-linux/chrome']) {
      if (existsSync(`${g}/${d}`)) return `${g}/${d}`;
    }
  }
  return null;
}
async function loadPlaywright() {
  for (const spec of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(spec); } catch { /* keep looking */ }
  }
  try {
    const req = createRequire(import.meta.url);
    return await import(req.resolve('playwright'));
  } catch { return null; }
}

const pw = await loadPlaywright();
const exe = findChromium();
if (!pw || (!exe && !process.env.CI)) {
  console.log('SKIP  rendercheck: no Playwright/Chromium on this machine.');
  console.log('      Every other harness runs on a stubbed canvas and cannot see a frame, so this');
  console.log('      is the only check that would catch a rim, a detached halo or a dead palette.');
  console.log('      CI installs a browser and runs it — check.mjs fails the build if that step is');
  console.log('      ever removed, so this skip cannot happen where it matters.');
  process.exit(0);
}

/* ---------------- render helpers ---------------- */
const LAUNCH = {
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'],
};
if (exe) LAUNCH.executablePath = exe;

const browser = await pw.chromium.launch(LAUNCH);

/* A page already in a run, with the board cleared: this harness is about the
   backdrop and the glow, and a shard drifting through a sample window is
   noise in every number below. */
async function playing(dpr = 3, w = 390, h = 844) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await p.goto('file://' + indexPath);
  await p.waitForTimeout(1100);
  await p.evaluate(() => { startGame(); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { G.spikes.length = 0; G.pows.length = 0; });
  return p;
}

/* Read the BACKDROP's own framebuffer, in the same task as the draw so the
   drawing buffer is still intact without preserveDrawingBuffer. */
async function skyRGB(p) {
  return p.evaluate(() => {
    glRender(0.016);
    const g = GL.g, w = GL.vw, h = GL.vh, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
    let R = 0, G2 = 0, B = 0; const n = w * h;
    const lum = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      R += px[k * 4]; G2 += px[k * 4 + 1]; B += px[k * 4 + 2];
      lum[k] = 0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2];
    }
    /* THE BRIGHT DECILE, SEPARATELY, because that is where the failure lives.
       Two fixed white highlight terms bury the palette exactly where m is
       high and leave the dim regions alone — so a whole-frame mean sees a
       washed-out version of the bug (0.132 -> 0.096 in normalised distance,
       which slid under a threshold) while the bright decile sees it head on.
       Measure where the defect is, not where the pixels are. */
    const sorted = Array.from(lum).sort((a, b) => b - a);
    const cut = sorted[Math.floor(n * 0.10)] || 0;
    let hR = 0, hG = 0, hB = 0, m = 0;
    for (let k = 0; k < n; k++) {
      if (lum[k] < cut) continue;
      hR += px[k * 4]; hG += px[k * 4 + 1]; hB += px[k * 4 + 2]; m++;
    }
    m = m || 1;
    return { R: R / n, G: G2 / n, B: B / n, hR: hR / m, hG: hG / m, hB: hB / m, w, h, on: GL.on };
  });
}

/* Column luminance profile of a composited screenshot, sampled down the
   playable band so the HUD and the safe-area insets do not enter the mean. */
async function columns(p, xs) {
  const buf = await p.screenshot({ clip: { x: 0, y: 140, width: 60, height: 460 } });
  return p.evaluate(async ({ b64, xs }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const lum = (x, y) => { const i = (y * W + x) * 4; return 0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]; };
    const col = x => { let s = 0; for (let y = 0; y < H; y++) s += lum(x, y); return s / H; };
    return xs.map(x => col(Math.min(x, W - 1)));
  }, { b64: buf.toString('base64'), xs });
}

try {
  /* ================= 1. THE SCREEN EDGE =================
     A full-screen layer composited at the wrong offset, or upscaled so its
     outermost texel is clamp-smeared, puts a hairline frame around the whole
     game. Both have shipped: a 1.82x bright rim from the blur reading past
     its own texture, and a rim from the glow being composited inside the
     camera dolly's translate while its source was drawn without it.
     The test is local — each edge column against the interior of the SAME
     rows — so scene content cancels and only a border artifact survives. */
  {
    const p = await playing();
    const cols = await columns(p, [0, 1, 2, 3, 4, 6, 10, 20, 40]);
    const interior = cols.slice(5).reduce((a, b) => a + b, 0) / cols.slice(5).length;
    const worst = Math.max(...cols.slice(0, 4).map(c => Math.abs(c - interior) / (interior || 1)));
    /* 0.12: the shipped rim measured 0.39 at column 0 and the corrected build
       measures under 0.04. A band between them catches the artifact without
       failing on the vignette's own gentle falloff, which is real content. */
    if (worst > 0.12) {
      fail.push(`the screen edge has a rim: outermost columns deviate ${(worst * 100).toFixed(0)}% from the interior `
        + `(${cols.slice(0, 4).map(v => v.toFixed(1)).join('/')} against ${interior.toFixed(1)}) — a full-screen layer is `
        + 'composited at the wrong offset or upscaled past its last texel');
    } else {
      note.push(`screen edge: outer columns within ${(worst * 100).toFixed(1)}% of interior — no rim`);
    }
    await p.close();
  }

  /* ================= 2. THE GLOW CARRIES ITS LIGHT =================
     The GPU glow replaced a drawn-disc halo that the docs describe as "tuned
     to carry the same light, so this is nearly invisible". It was not: the
     shipped path measured less than half the fallback, which is most of why
     the effects read as weak. This pins the ratio so the two paths cannot
     drift apart again silently. The bound is deliberately generous — this is
     a drift alarm, not a tuning target — and the measured value is PRINTED
     every run so the number is visible whether or not it fails. */
  {
    const p = await playing();
    const glow = await p.evaluate(() => {
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0; const n = c.width * c.height;
      for (let k = 0; k < n; k++) s += 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2];
      return s / n;
    });
    await p.evaluate(() => { FX.on = false; });
    await p.waitForTimeout(700);
    const disc = await p.evaluate(() => {
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0; const n = c.width * c.height;
      for (let k = 0; k < n; k++) s += 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2];
      return s / n;
    });
    const ratio = glow / (disc || 1);
    note.push(`glow vs disc-halo light: ${glow.toFixed(1)} against ${disc.toFixed(1)} (ratio ${ratio.toFixed(2)})`);
    if (ratio < 0.35 || ratio > 2.6) {
      fail.push(`the two glow paths carry very different light: GPU ${glow.toFixed(1)} against discs ${disc.toFixed(1)} `
        + `(ratio ${ratio.toFixed(2)}) — the degrade ladder swaps between these mid-run, and a player sees the scene `
        + 'change brightness when it does');
    }
    await p.close();
  }

  /* ================= 3. THE SKY REACHES A PIXEL, AND THE WORLDS DIFFER
     "Six worlds" is a claim about what a player sees, and for one shipped
     build it was false in the only way that matters: two fixed white
     highlight terms sat on top of every palette, so the bright half of every
     sky was the same cream and three of the six were indistinguishable.
     fxcheck cannot see this — it measures nebula MASS through a port of the
     noise chain, and mass was correct the whole time. Colour needed a pixel.

     A FRESH PAGE PER WORLD, and that is not caution. Switching worlds inside
     one page and screenshotting left the PREVIOUS world's pixels in the
     buffer, which reported two different worlds as identical and sent an
     investigation down a false trail. The instrument lied; measuring it
     again with the instrument would not have found that. */
  {
    const names = await (async () => {
      const p = await playing(1, 300, 640);
      const n = await p.evaluate(() => WORLDS.map(w => w.n));
      await p.close();
      return n;
    })();
    /* EVERY WORLD, NOT A SAMPLE — and that is a correction, not caution. The
       first cut of this probed three spread across the table (0, middle,
       last), which are the three most different, and it passed cleanly when
       the white-highlight bug was reintroduced. The collapse that actually
       shipped was between ADJACENT worlds: DUSTLANE and VEIL rendered as the
       same picture while carrying amber and violet. Sampling the extremes
       cannot see the failure mode; it is the near pairs that collapse.
       Six page loads is most of this harness's runtime and it buys the only
       assertion here that a person could not make by glancing at the game. */
    const probe = names.map((_, i) => i);
    const seen = [];
    for (const i of probe) {
      const p = await browser.newPage({ viewport: { width: 300, height: 640 } });
      await p.goto('file://' + indexPath);
      await p.waitForTimeout(900);
      await p.evaluate(i => { startGame(); G.skyW = i; }, i);
      await p.waitForTimeout(2000);
      const c = await skyRGB(p);
      if (c.on !== true) fail.push(`the backdrop shader did not come up in a real browser (world ${names[i]})`);
      seen.push({ n: names[i], ...c });
      await p.close();
    }
    for (const s of seen) {
      const lum = 0.299 * s.R + 0.587 * s.G + 0.114 * s.B;
      if (lum < 3) fail.push(`world ${s.n} renders essentially black (luma ${lum.toFixed(1)}) — the sky must never go dark`);
    }
    /* distinct means distinct in HUE, not merely in brightness: a set of
       worlds that differ only in exposure is the failure this is here for */
    const norm = s => { const t = s.hR + s.hG + s.hB || 1; return [s.hR / t, s.hG / t, s.hB / t]; };
    let closest = 1e9, pair = '';
    for (let a = 0; a < seen.length; a++) for (let b = a + 1; b < seen.length; b++) {
      const [x, y] = [norm(seen[a]), norm(seen[b])];
      const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      if (d < closest) { closest = d; pair = `${seen[a].n}/${seen[b].n}`; }
    }
    /* 0.045 sits between the two measured states rather than at a round
       number: with the white highlights restored the closest pair collapses
       to 0.024, and the shipped build measures 0.091. Set from the failure. */
    if (closest < 0.045) {
      fail.push(`two worlds render as the same place: ${pair} differ by ${closest.toFixed(3)} in normalised colour — `
        + 'a highlight or grade term is sitting on top of the palettes and burying them');
    } else {
      note.push(`worlds sampled ${seen.map(s => s.n).join('/')}: closest pair ${pair} differs ${closest.toFixed(3)} in hue`);
    }
  }
} catch (e) {
  fail.push(`the render harness threw: ${e && e.message}`);
} finally {
  await browser.close();
}

for (const n of note) console.log('  ' + n);
if (fail.length) {
  console.error('RENDERCHECK FAILED');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log('RENDERCHECK OK  the frame a player sees was rendered and measured');
