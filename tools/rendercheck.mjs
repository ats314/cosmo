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
   framebuffer. It is the eighth harness and it is slow on purpose: it is the
   difference between "somebody should look at the game" being an instruction
   a person has to remember and being something the build does.

   ON THE DEPENDENCY. Every other tool here runs on Node's vm and a stubbed
   DOM with nothing installed, and that rule is worth keeping for them. This
   one cannot: there is no way to rasterise a fragment shader without a GPU
   stack. It therefore SKIPS, loudly, when no browser is present — and
   check.mjs asserts that the CI workflow installs one, so a skip can only
   ever happen on a developer's machine and never silently in the build. A
   guard that can quietly not run is not a guard. */
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { seedLine } from './lib/rng.mjs';
import { loadGameHtml } from './lib/game-source.mjs';

console.log(seedLine('rendercheck'));

const fail = [];
const note = [];
const gameHtml = process.env.COSMO_INDEX
  ? await readFile(resolve(process.env.COSMO_INDEX), 'utf8')
  : await loadGameHtml();
async function openGame(page) {
  // An isolated origin gives storage its normal browser behavior while this
  // harness executes the canonical body directly, without the Phaser host.
  await page.route('http://cosmo-render.test/**', route => route.fulfill({
    status: 200, contentType: 'text/html', body: gameHtml,
  }));
  await page.goto('http://cosmo-render.test/');
}

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
    const mod = await import(pathToFileURL(req.resolve('playwright')).href);
    return mod.chromium ? mod : mod.default;
  } catch { return null; }
}

const pw = await loadPlaywright();
const exe = findChromium();
/* IN CI, A MISSING BROWSER IS A FAILURE AND NEVER A SKIP. The first cut of
   this read `if (!pw || …)` and would have skipped in CI the moment the
   playwright package was unresolvable — which is precisely the silent
   non-running guard that check.mjs's workflow assertion exists to prevent,
   reintroduced inside the harness that assertion protects. The environment
   decides the severity, not the symptom. */
if (process.env.CI && !pw) {
  console.error('RENDERCHECK FAILED');
  console.error('  - no Playwright in CI: the workflow must install the package AND the browser '
    + '(`npm install --no-save playwright@<v>` then `npx playwright install --with-deps chromium`). '
    + 'This is the only check in the repo that looks at a pixel and it must never skip in the build.');
  process.exit(1);
}
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
  await openGame(p);
  await p.waitForTimeout(1100);
  await p.evaluate(() => { startGame(); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { G.spikes.length = 0; G.pows.length = 0; G.invuln=G.t+100; });
  return p;
}

/* Read the BACKDROP's own framebuffer, in the same task as the draw so the
   drawing buffer is still intact without preserveDrawingBuffer. */
async function still(dpr=1,w=300,h=640) {
  const p=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  await p.addInitScript(seed=>{
    let x=seed>>>0;
    Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
    window.requestAnimationFrame=()=>0;
  },Number(process.env.SEED)||20260814);
  await openGame(p);
  await p.evaluate(()=>{
    startGame();G.level=3;G.nRings=3;G.ringI=1;G.hopFromI=1;G.hopP=1;
    G.spikes=[];G.pows=[];G.stars=[];G.sceneEvent=null;BH.phase=0;BH.warp=0;
    G.t=G.started+20;G.vt=20;G.banner=null;G.teach=0;G.didReverse=G.didHop=true;
    GL.flowVt=20;GL.tw=5;draw();
  });
  return p;
}
async function skyRGB(p,state={}) {
  return p.evaluate(state=>{
    if(state.world!==undefined)G.skyW=state.world;
    if(state.clock!==undefined)GL.tw=state.clock;
    if(!GL.on)return {on:false};
    glRender(0);
    const g=GL.g,w=GL.vw,h=GL.vh,px=new Uint8Array(w*h*4);
    g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,px);
    const hist=new Array(256).fill(0),cells=new Array(96).fill(0),counts=new Array(96).fill(0);
    const lum=new Float32Array(w*h);
    let R=0,G2=0,B=0,quiet=0,gradient=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const k=y*w+x,v=.299*px[k*4]+.587*px[k*4+1]+.114*px[k*4+2];
      lum[k]=v;R+=px[k*4];G2+=px[k*4+1];B+=px[k*4+2];hist[Math.min(255,Math.floor(v))]++;
      if(v<12)quiet++;
      const cell=Math.min(11,Math.floor(y/h*12))*8+Math.min(7,Math.floor(x/w*8));
      cells[cell]+=v;counts[cell]++;
      if(x>0)gradient+=Math.abs(v-lum[k-1]);
    }
    const n=w*h;
    const percentile=q=>{let k=0;for(let i=0;i<256;i++){k+=hist[i];if(k>=n*q)return i;}return 255;};
    const cut=percentile(.90);let hR=0,hG=0,hB=0,m=0;
    for(let k=0;k<n;k++)if(lum[k]>=cut){hR+=px[k*4];hG+=px[k*4+1];hB+=px[k*4+2];m++;}
    return {R:R/n,G:G2/n,B:B/n,hR:hR/(m||1),hG:hG/(m||1),hB:hB/(m||1),
      mean:(.299*R+.587*G2+.114*B)/n,p10:percentile(.10),p90:cut,quiet:quiet/n,
      gradient:gradient/n,cells:cells.map((v,i)=>v/(counts[i]||1)),w,h,on:GL.on};
  },state);
}
const correlation=(a,b)=>{
  const ma=a.reduce((x,y)=>x+y,0)/a.length,mb=b.reduce((x,y)=>x+y,0)/b.length;
  let ab=0,aa=0,bb=0;
  for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;ab+=x*y;aa+=x*x;bb+=y*y;}
  return ab/Math.sqrt(aa*bb||1);
};

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
  /* Optional review frames from the same real browser used by these checks.
     A source override allows the before and after to use identical scenarios. */
  if (process.env.COSMO_SHOTS) {
    const dir = resolve(process.env.COSMO_SHOTS);
    await mkdir(dir, { recursive: true });
    for (const [name, level, mode] of [
      ['ordinary', 3, 'quiet'], ['blackhole', 4, 'blackhole'],
      ['hypernova', 3, 'hyper'], ['spotlight', 3, 'spot'],
    ]) {
      const p = await playing(2);
      await p.evaluate(({ level, mode }) => {
        G.level=level; G.nRings=3; G.ringI=1; G.hopFromI=1; G.hopP=1;
        G.invuln=G.t+100; G.banner=null; G.teach=0; G.stars=[];
        G.skyW=LEVEL_HOME[level-1];
        if(mode==='blackhole') { startBlackHole(); for(let i=0;i<180;i++)update(1/60); }
        if(mode==='hyper') { G.hyper=G.hyperD=16*SPB; G.hyperGlow=1; }
        if(mode==='spot') { G.spot=16*SPB; }
      }, {level,mode});
      await p.waitForTimeout(800);
      await p.screenshot({ path: resolve(dir, name+'.png') });
      await p.close();
    }
  }
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
    const worst = Math.max(...cols.slice(0, 3).map((c,i) => Math.abs(c-2*cols[i+1]+cols[i+2])/(interior||1)));
    /* 0.12: the shipped rim measured 0.39 at column 0 and the corrected build
       measures under 0.04. A band between them catches the artifact without
       failing on the vignette's own gentle falloff, which is real content. */
    if (worst > 0.12) {
      fail.push(`the screen edge has a rim: outermost columns have a discontinuity of ${(worst * 100).toFixed(0)}% from the interior `
        + `(${cols.slice(0, 4).map(v => v.toFixed(1)).join('/')} against ${interior.toFixed(1)}) — a full-screen layer is `
        + 'composited at the wrong offset or upscaled past its last texel');
    } else {
      note.push(`screen edge: local edge discontinuity ${(worst * 100).toFixed(1)}% of interior — no rim`);
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
    const p = await still(3);
    /* This foreground canvas is transparent over a separate sky canvas.
       getImageData returns unpremultiplied RGB: a barely visible coloured
       halo pixel otherwise counts as a fully opaque light. Compare the
       actual contribution over the unchanged backdrop by including alpha. */
    const glow = await p.evaluate(() => {
      draw();
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0; const n = c.width * c.height;
      for (let k = 0; k < n; k++) s += (0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2]) * d[k * 4 + 3] / 255;
      return s / n;
    });
    await p.evaluate(() => { FX.on = false; draw(); });
    const disc = await p.evaluate(() => {
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0; const n = c.width * c.height;
      for (let k = 0; k < n; k++) s += (0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2]) * d[k * 4 + 3] / 255;
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

  /* ================= 3. A VISIBLE PLACE WITH ROOM TO PLAY =================
     The former test required every world to differ in hue. Worlds now author
     a silhouette as well as a palette, so near colours may coexist only when
     their large-scale luminance shapes actually differ. A fresh deterministic
     page, stopped animation and same-task draw/read remove stale-buffer and
     incidental gameplay noise. Real pixels, not a cloned noise implementation. */
  {
    const p=await still();
    const names=await p.evaluate(()=>WORLDS.map(w=>w.n)),seen=[];
    for(let i=0;i<names.length;i++){
      const c=await skyRGB(p,{world:i,clock:5});
      if(!c.on){fail.push(`world ${names[i]} failed to compile in a real browser`);break;}
      seen.push({n:names[i],...c});
      // A shaded planet now fills a substantial part of the frame. Preserve
      // material, shadow and highlight range without prescribing empty area.
      if(c.mean<5||c.mean>110||c.p90<25)
        fail.push(`world ${names[i]} loses its visible material (mean ${c.mean.toFixed(1)}, p90 ${c.p90}) or floods the frame`);
      if(c.p10>40||c.p90-c.p10<25)
        fail.push(`world ${names[i]} loses shadow/highlight depth (${c.p10}-${c.p90})`);
      if(c.gradient>6)
        fail.push(`world ${names[i]} carries excessive pixel contrast (${c.gradient.toFixed(2)} luma/pixel)`);
    }
    const norm=s=>{const t=s.hR+s.hG+s.hB||1;return [s.hR/t,s.hG/t,s.hB/t];};
    let closest=Infinity,pair='',pairShape=0;
    for(let a=0;a<seen.length;a++)for(let b=a+1;b<seen.length;b++){
      const x=norm(seen[a]),y=norm(seen[b]),d=Math.hypot(...x.map((v,k)=>v-y[k]));
      const corr=correlation(seen[a].cells,seen[b].cells);
      if(d<closest){closest=d;pair=`${seen[a].n}/${seen[b].n}`;pairShape=corr;}
      if(d<.045&&corr>.88)
        fail.push(`${seen[a].n}/${seen[b].n} collapse in both hue (${d.toFixed(3)}) and composition (r=${corr.toFixed(3)})`);
    }
    note.push(`8 textured celestial worlds: mean ${Math.min(...seen.map(s=>s.mean)).toFixed(1)}-${Math.max(...seen.map(s=>s.mean)).toFixed(1)}; closest hue ${pair} ${closest.toFixed(3)}, spatial r=${pairShape.toFixed(2)}`);

    /* Continuous motion and earned orbital pressure belong to the world.
       A beat impulse alone cannot flash it; events expire at the same clock,
       and the black hole retains sole priority over reward lighting. */
    const quiet=await skyRGB(p,{world:0,clock:5});
    await p.evaluate(()=>{G.beat=1;G.pocket=1;G.combo=12;});
    const ordinary=await skyRGB(p);
    if(Math.abs(ordinary.mean-quiet.mean)>.01)
      fail.push('an ordinary beat impulse flashed the rendered sky');
    await p.evaluate(()=>{G.build=dropNeed()-1;});
    const charged=await skyRGB(p);
    if(Math.abs(charged.mean-ordinary.mean)<.01||charged.mean>ordinary.mean*1.30)
      fail.push('earned orbital pressure is invisible or overwhelms the resting world');
    const moving=await skyRGB(p,{clock:7});
    const motion=moving.cells.reduce((s,v,i)=>s+Math.abs(v-charged.cells[i]),0)/moving.cells.length;
    if(motion<.20)fail.push(`the living field barely moves across two seconds (${motion.toFixed(3)} cell luma)`);
    await skyRGB(p,{clock:5});
    await p.evaluate(()=>{scenePulse('drop',3);G.t+=.9;});
    const peak=await skyRGB(p);
    const deformation=peak.cells.reduce((s,v,i)=>s+Math.abs(v-charged.cells[i]),0)/peak.cells.length;
    if(peak.mean/charged.mean>1.16||peak.mean/charged.mean<0.84)
      fail.push(`an earned material transition flashes the world (luma ratio ${(peak.mean/charged.mean).toFixed(2)})`);
    if(deformation<.20)fail.push('an earned scene event lost its visible material response');
    await p.evaluate(()=>{G.t+=3;});
    const settled=await skyRGB(p);
    await p.evaluate(()=>{G.sceneEvent=null;});
    const withoutEvent=await skyRGB(p);
    if(Math.abs(settled.mean-withoutEvent.mean)>.01)
      fail.push('an expired scene event still affected the field at the same clock');
    await p.evaluate(()=>{scenePulse('nova',3);G.t+=.18;BH.phase=2;BH.warp=1;});
    const hole=await skyRGB(p);
    if(hole.mean>=quiet.mean)
      fail.push('the black hole stacked a peak over its eclipse instead of owning the scene');
    note.push(`living field: two-second motion ${motion.toFixed(2)} cell luma; orbit pressure, event expiry and BH priority rendered`);
    await p.close();

  }

  /* ================= 4. THE FALLBACK IS THE SAME AUTHORED PLACE =================
     A real 2D image verifies the fallback, including its finite pixel buffer.
     Compare the large-scale cloud light with GL, without arena objects or
     post-processing hiding a wrong colour, orientation or empty cache. */
  {
    const p=await still(1,300,640);let largest=0;
    for(const world of [0]){
      const gpu=await skyRGB(p,{world,clock:5});
      const fallback=await p.evaluate(()=>{
        ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);drawCalmSky();
        const c=document.getElementById('c'),d=ctx.getImageData(0,0,c.width,c.height).data;
        let s=0;for(let k=0;k<d.length;k+=4)s+=.299*d[k]+.587*d[k+1]+.114*d[k+2];
        return {mean:s/(d.length/4),cache:SKY_2D.key};
      });
      const difference=Math.abs(fallback.mean-gpu.mean)/gpu.mean;largest=Math.max(largest,difference);
      if(!fallback.cache||difference>.16)
        fail.push(`fallback world ${world} does not carry the same cloud light as GL (${gpu.mean.toFixed(1)} vs ${fallback.mean.toFixed(1)})`);
    }
    await p.close();note.push(`fallback: rendered DRIFT pair within ${(largest*100).toFixed(1)}% of GPU cloud light`);
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
