/*
 * Cosmo runtime. Copyright (c) Cosmo's copyright holder. All rights reserved.
 * Proprietary commercial software; see LICENSE. No third-party source copied.
 * The tuned simulation remains JavaScript behind the typed Phaser adapter.
 */
export function createCosmoRuntime(host={}){
// @runtime-body:start
/* Runtime host ownership is explicit. Legacy VM harnesses evaluate the
   canonical body without a host and retain their deterministic standalone boot. */
const runtimeHost=typeof host!=='undefined'&&host?host:{};
function gameHaptic(kind,webPattern){
  try{
    if(typeof runtimeHost.haptic==='function')runtimeHost.haptic(kind);
    else if(navigator.vibrate)navigator.vibrate(webPattern);
  }catch(e){} // Feedback is optional and must never interrupt a movement.
}
const runtimeUnsubscribers=[];
let runtimeDestroyed=false,runtimeFrameId=0,runtimeFrames=0,runtimeSteps=0;
let runtimeCloudStorage=null;
function runtimeListen(target,type,listener,options){
  if(!target||typeof target.addEventListener!=='function')return;
  target.addEventListener(type,listener,options);
  runtimeUnsubscribers.push(function(){
    if(typeof target.removeEventListener==='function')target.removeEventListener(type,listener,options);
  });
}
function runtimePointerEvent(e,type){
  const event=e||{};
  return {type:type,pointerId:event.pointerId===undefined?(event.id===undefined?0:event.id):event.pointerId,
    clientX:event.clientX===undefined?(event.x||0):event.clientX,
    clientY:event.clientY===undefined?(event.y||0):event.clientY,
    preventDefault:function(){if(typeof event.preventDefault==='function')event.preventDefault();}};
}
function runtimeKeyEvent(e){
  const event=e||{};
  return {code:event.code||'',key:event.key||'',repeat:!!event.repeat,
    preventDefault:function(){if(typeof event.preventDefault==='function')event.preventDefault();}};
}

'use strict';
/* ============ COSMO ============
   (storage keys keep the historical cometloop: prefix so no player's saves
   are wiped by the rename)
   Tap = reverse · Swipe = hop rings
   Orbits pay out based on embers gathered during them,
   so the two systems feed each other instead of competing.
   Void #060913 / Nebula #101a33 / Comet #5df0ff /
   Ember #ffc857 / Shard #ff5d73 / Shield #7bffc8 / Warp #b48bff
======================================== */
const cv=runtimeHost.canvas||document.getElementById('c');
const ctx=runtimeHost.context||cv.getContext('2d');
/* iOS only, and only when NOT launched from the home screen. Safari proper is
   fine; it is the in-app sheet that steals the gesture, and both share this
   signature, so the hint is worth showing to either. */
const IN_APP_BROWSER=(function(){
  try{
    if(runtimeHost.native)return false;
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const standalone=window.navigator.standalone===true||
      (window.matchMedia&&window.matchMedia('(display-mode: fullscreen)').matches);
    return ios&&!standalone;
  }catch(e){return false;}
})();
const safeEl=document.getElementById('safe');
/* THE BUILD STAMP. 'dev' in source; the deploy workflow replaces it with the
   short commit sha before upload, so the LIVE page names the exact commit it
   was built from. It exists because a day was lost to screenshots that could
   not say which build they came from: a fix deployed at 1:01:42pm, a
   screenshot taken at 1:02pm, and no way for either side to prove the page
   was the ten-minute-stale cached copy. Drawn faintly on the title screen and
   exposed as window.COSMO_BUILD; never drawn during play. */
const BUILD=typeof __COSMO_BUILD__==='string'?__COSMO_BUILD__:'dev';
try{window.COSMO_BUILD=BUILD;}catch(e){}
/* THE PLAY LINK IS A CONTRACT: whoever opens the plain URL gets the newest
   build. GitHub Pages caches index.html for ten minutes and its CDN keys on
   the exact URL, so on a day with several releases the plain URL hands back
   a copy up to ten minutes old — and every "it's fixed, go look" becomes a
   fresh argument, because the tester is replaying the PREVIOUS build through
   the same button that has always been trustworthy. The page checks its own
   freshness now: fetch the first bytes of index.html past the CDN (a
   minute-bucketed query is its own cache key), read the BUILD stamp out of
   them, and if a newer build exists swap to it once, before play starts.
   Four guards, each load-bearing:
   - BUILD 'dev' (source, harnesses, local files) never checks — force is the
     harness's door;
   - a URL already carrying ?u= never redirects again, so two mismatched
     copies can bounce at most ONE hop and can never loop;
   - the swap fires only from the title screen — reloading a live run to
     freshen its background would be vandalism;
   - every failure (no fetch, offline, a range the host ignores, a parse
     miss) is silence. Staleness is a nuisance; a blocked boot is a bug. */
function freshCheck(force){
  if(runtimeDestroyed||runtimeHost.externalLoop)return;
  try{
    if(!force&&BUILD==='dev')return;
    if(typeof fetch!=='function')return;
    if(/(^|[?&])u=/.test(location.search||''))return;
    fetch(location.pathname+'?chk='+((Date.now()/60000)|0),
      {headers:{'Range':'bytes=0-8191'}})
      .then(function(r){return r.text();})
      .then(function(t){
        const m=t.match(/const BUILD='([0-9a-f]{7})'/);
        if(!m||m[1]===BUILD)return;
        if(G.state==='menu')location.replace(location.pathname+'?u='+m[1]);
      }).catch(function(){});
  }catch(e){}
}
const TAU=Math.PI*2;
const rand=(a,b)=>a+Math.random()*(b-a);
const RM=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||false;
/* HYPERNOVA GETS ITS OWN COLOUR. It was COL.ember — the exact gold of the
   collectible stars — so "am I invincible right now" was being signalled in
   the one colour already meaning "points". Every playtester reported not being
   able to read the state. Magenta is the furthest usable hue from the rest of
   this palette: ember gold sits at ~42deg, shard red at ~352deg, and the
   hypernova now at ~318deg, far enough from the shard that the two never trade
   places at speed, and nowhere near anything that means "collect me". */
const COL={comet:'#5df0ff',ember:'#ffc857',shard:'#ff5d73',shield:'#7bffc8',
  warp:'#b48bff',nova:'#ffffff',hyper:'#ff4fd8',bh:'#8f5cff',
  /* TWO NEW ORBS, AND THEIR COLOURS ARE THE CONSTRAINT THEY WERE CHOSEN
     AGAINST. Every hue the board already spends is spoken for — gold means
     collect, pink-red means death, cyan is the comet, mint is a shield,
     violet is slow-mo, magenta is the star — so a new orb has to land in a
     family none of those occupy or it inherits a meaning it does not have.
     Blue is free and reads as "another one of you", which is exactly what the
     mirror is. Orange is free and is the only honest colour for a burn; it is
     deliberately warm-ORANGE rather than warm-red, because the invariant that
     red belongs to death alone is not negotiable and #ff5d73 is a pink, so
     the two do not sit in the same family at a glance. Verified on a rendered
     frame rather than argued from hex values. */
  mirror:'#4d8cff',scorch:'#ff8a2b'};
/* ---------- THE HOUSE STYLE ----------
   Playtest, verbatim, after six levels: "the game feels exactly like 50
   different agents have worked on it ... very pieced together, not cohesive
   ... my first thought would be 'ai made this'." No single feature was
   wrong. What was wrong is that each one had brought its own vocabulary,
   and nothing in this file said what the vocabulary WAS, so every session
   invented one more. Three rules, written down once, so the next thing added
   here inherits them instead of adding a fourth idiom.

   1. ONE NAME PER THING. The player is on a LEVEL and the level has a name;
      that name appears on the card, in the header, on the death screen and
      in the share text, and nothing else is printed beside it. The tier
      ladder is real and is not player-facing furniture — it speaks by
      arriving (a banner), never by sitting in the corner. A mode may not
      borrow a level's name for its eyebrow.
   2. ONE COUNTER IDIOM. "NOUN ×N" is a multiplier — COMBO ×3, ON BEAT ×8,
      OVERDRIVE ×2, SPOTLIGHT ×2. "NOUN · N" is a count or a clock —
      SHIELDS · 3, SHIELD USED · 2 LEFT, CLEAN ORBITS · 3, BLACK HOLE · 12s,
      LEVEL 4 · REDSHIFT. The dot
      is already this file's connector everywhere else, so the two symbols
      carry the whole distinction and no label has to spell it out in words.
      A lesson names a counter with the exact string the HUD prints for it.
   3. ONE COLOUR PER MEANING, and the list is closed. cyan = you; gold =
      earned; violet = the music; pink-red = death, and death only; mint =
      shield; white = the peak. Everything past that is an ORB's identity
      (magenta hypernova, violet-blue black hole, blue mirror, orange
      scorch) and is spent on that orb alone — never on a readout, never on
      a reward. A new colour needs a meaning nothing above already owns. */
const LAP_EMB_MAX=4; /* embers per orbit that still raise the payout */

/* THE ARENA IS AN ELLIPSE (playtest, near-verbatim: "I wonder if the orbits
   were stretched out more to an oval shape vertically so that they were all a
   little bit bigger and took up more of the screen ... so that the orbits
   would be spaced out a little bit more"). He was right, and it is measurable:
   on a 390x844 phone the arena is WIDTH-constrained at R=167px while 277px of
   vertical room is available, so 110px a side was going unused.
   R stays the horizontal radius; AY is the vertical multiplier. Every position
   in the game flows through posAt(), and canvas ellipse() takes the same
   PARAMETRIC angle posAt() does — a point at angle a sits at
   (cx + R cos a, cy + R·AY sin a) either way — so paths and objects agree for
   free, and unlike a canvas scale() this distorts neither sprites nor stroke
   widths.
   ARENA_STRETCH is the A/B dial: 0 restores the exact circle, 1 takes all the
   room the cap allows. To compare live, set it in the console and call
   resize(). */
let ARENA_STRETCH=0.75;
const ARENA_MAX_Y=1.55;   /* even a very tall screen stops here — past this it
                             reads as an egg rather than a wider orbit */
let W=0,H=0,DPR=1,cx=0,cy=0,R=0,AY=1,u=1,safeTop=0,safeBot=0;
let bgStars=[];
/* Ring 0 is the outermost. Adding a ring adds a higher index further in, so
   existing rings never move when a new one appears. Declared ahead of the
   sprite cache because the initial bake (which runs from the first resize())
   needs the ratios for the conduit sprites. */
/* ---------- THE ORBITS, AND THE ONE THAT IS NOT ALWAYS THERE ----------
   RADII is LIVE and eased, not a constant: black hole mode re-spaces the whole
   annulus rather than squeezing a fourth ring into the gaps of the other three.
   That distinction is the entire reason the fourth ring is possible now, and it
   is worth writing down because the naive version was measured and rejected.
   Adding a ring INSIDE the shipped three puts it at f=0.33 — 55px from centre
   on a 390px phone — where hitTol makes a single shard block 35.7 degrees of
   the orbit, a tenth of the circle behind one crystal. Re-spacing all four
   across the same annulus puts the innermost at f=0.45, 75px out, where a
   shard blocks 26.2 degrees. The shipped INNER ring already blocks 21.6, so
   the new one is a step, not a cliff.
   And the arena is an ellipse (AY ~ 1.41 in portrait), which the rejection did
   not account for: the re-spaced gaps are 33/30/28px horizontally but 47/42/40
   vertically, against a 7.4px comet and a 9.3px shard. That is wider than the
   gaps the shipped three rings already run at their tightest.
   The halos are baked once at RAD_BAKE and scaled at draw time, so easing the
   radii costs no re-bake — buildSprites runs on resize, not per frame. */
const RAD_OFF =[1.0,0.76,0.545,0.0 ];  /* normal play — the fourth is not there */
const RAD_BH  =[1.0,0.80,0.62, 0.45];  /* black hole — four orbits, re-spaced */
const RAD_BAKE=[1.0,0.80,0.62, 0.45];  /* what the halo sprites are baked at */
let RADII=RAD_OFF.slice();
const RING_MULT=[1,1,1]; /* set e.g. [1,1.5,2] to pay more for riding inside */
/* EACH RING IS AN INSTRUMENT — see the audio section for why these move. */
const RINGS=[
  /* outer */ {wave:'sawtooth',cut:1.00,lift:0,   sub:0, tint:'132,162,255'},
  /* mid   */ {wave:'square',  cut:1.18,lift:380, sub:1, tint:'128,206,255'},
  /* inner */ {wave:'square',  cut:1.42,lift:820, sub:2, tint:'168,240,255'},
  /* THE ACCRETION RING — only reachable inside black hole mode. It keeps the
     ladder's own logic (each ring in carries a brighter filter lift) rather
     than inventing a voice, because during the black hole the player is not
     playing the band at all: these values are what the SFX layer reads, and
     the arrangement they would have fed is halted. Violet, not the cyan the
     ladder was walking toward — it belongs to the black hole, not the band. */
  /* accretion */ {wave:'square',cut:1.62,lift:1180,sub:2,tint:'186,150,255'}];
/* SIX CLOUDS, NOT THREE, AND NO TWO ON THE SAME CLOCK. Three blobs on
   near-identical LFOs read as three blobs sliding; six on incommensurate
   periods read as weather. `sp` scales each one's drift rate and `dir` flips
   the rotation of its drift basis, so the field never resolves into a
   pattern the eye can predict. They cycle the three baked tints. */
const nebulas=[
  {x:0.22,y:0.25,r:0.55,ph:0,  sp:1.00,dir: 1,a:0.85},
  {x:0.80,y:0.70,r:0.60,ph:2.1,sp:0.74,dir:-1,a:0.85},
  {x:0.65,y:0.15,r:0.45,ph:4.0,sp:1.27,dir: 1,a:0.75},
  {x:0.14,y:0.74,r:0.50,ph:1.2,sp:0.58,dir:-1,a:0.60},
  {x:0.52,y:0.48,r:0.68,ph:5.3,sp:0.43,dir: 1,a:0.50},
  {x:0.88,y:0.32,r:0.38,ph:3.1,sp:1.49,dir:-1,a:0.55}
];
/* dust motes drifting in the shell of air the arena's light reaches — radii
   are stored as multiples of ring 0 so a resize never reshuffles them */
const MOTES=[];
for(let i=0;i<44;i++)MOTES.push({ang:Math.random()*TAU,rr:1.08+Math.random()*0.67,
  ph:Math.random()*TAU,sp:(0.5+Math.random()*1.1)*(Math.random()<0.5?-1:1),
  sz:0.5+Math.random()*0.6});

/* ---------- sprite cache (shadowBlur is done once, not every frame) ---------- */
const SPR={};
let sprU=-1,sprDPR=-1,sprW=-1,sprH=-1,sprBand=-1;
/* THE SKY DEEPENS WITH THE RUN. Four palettes, keyed to ladder milestones the
   player already gets a banner for, so "the world changed" and "the rules
   changed" arrive as one event. Every band keeps the field at or below the
   opening band's luminance and stays out of the red family — the sky must
   never compete with a shard for the word "danger". skyI is written by the
   game (update/startGame) rather than read from G here, because the first
   bake runs before G exists. */
const SKY_BANDS=[
  {bg:['#131e34','#0b1328','#080d1c','#04060e'],
   neb:['96,80,200','40,140,180','170,70,140'],limb:'132,162,255'},
  {bg:['#0f2232','#0a1726','#07121d','#03070c'],
   neb:['60,160,190','40,140,180','100,120,220'],limb:'128,206,255'},
  {bg:['#1f1631','#130c24','#0d081a','#05030d'],
   neb:['150,70,190','96,80,200','120,100,220'],limb:'190,150,255'},
  {bg:['#241a28','#150f1e','#0e0a16','#06040c'],
   neb:['200,120,80','170,70,140','120,90,200'],limb:'255,200,140'}];
let skyI=0;
/* Eight authored celestial portraits. Every destination owns a monumental
   globe, its light and rings, and the dust cloud behind it. Position and scale
   are fractions of viewport height; materials and colours morph continuously.
   All texture is generated here; no outside artwork or shader is used. */
const WORLDS=[
  {n:'DRIFT',x:-0.10,y:-0.19,lean:0.48,width:0.19,bend:1.80,reach:0.74,grain:0.85,star:0.85,motion:0.80,gain:1.60,
   px:0.13,py:0.30,size:0.285,tilt:-0.38,flatten:0.24,rock:0.12,clouds:0.88,sun:2.55,
   tint:[0.20,0.39,0.74],rim:[0.59,0.87,1.00],dust:[0.53,0.15,0.40]},
  {n:'TIDE',x:0.15,y:-0.13,lean:-0.38,width:0.17,bend:-1.70,reach:0.72,grain:0.65,star:0.70,motion:0.70,gain:1.45,
   px:-0.15,py:0.21,size:0.265,tilt:0.38,flatten:0.18,rock:0.58,clouds:0.72,sun:0.68,
   tint:[0.10,0.52,0.48],rim:[0.56,1.00,0.86],dust:[0.10,0.24,0.55]},
  {n:'DUSTLANE',x:-0.04,y:0.16,lean:1.02,width:0.21,bend:1.90,reach:0.68,grain:1.00,star:0.70,motion:0.60,gain:1.55,
   px:0.16,py:-0.25,size:0.32,tilt:0.24,flatten:0.22,rock:0.92,clouds:0.18,sun:2.18,
   tint:[0.58,0.34,0.15],rim:[1.00,0.78,0.43],dust:[0.38,0.12,0.24]},
  {n:'GLASS',x:-0.13,y:-0.14,lean:0.12,width:0.15,bend:1.15,reach:0.62,grain:0.38,star:1.05,motion:0.55,gain:1.25,
   px:-0.04,py:0.33,size:0.245,tilt:0.82,flatten:0.34,rock:0.35,clouds:0.96,sun:0.15,
   tint:[0.25,0.48,0.68],rim:[0.78,0.95,1.00],dust:[0.12,0.25,0.38]},
  {n:'EMBERFALL',x:-0.14,y:-0.19,lean:-0.68,width:0.18,bend:-2.40,reach:0.78,grain:0.90,star:0.65,motion:0.80,gain:1.65,
   px:0.18,py:0.18,size:0.31,tilt:-0.60,flatten:0.23,rock:0.84,clouds:0.14,sun:2.77,
   tint:[0.68,0.18,0.10],rim:[1.00,0.65,0.26],dust:[0.45,0.12,0.48]},
  {n:'VEIL',x:0.17,y:0.15,lean:0.66,width:0.24,bend:1.70,reach:0.80,grain:0.90,star:0.60,motion:0.68,gain:1.70,
   px:-0.15,py:-0.25,size:0.30,tilt:-0.32,flatten:0.29,rock:0.12,clouds:0.80,sun:0.63,
   tint:[0.44,0.18,0.69],rim:[0.90,0.62,1.00],dust:[0.15,0.39,0.59]},
  {n:'GRID',x:0.12,y:-0.19,lean:1.35,width:0.17,bend:0.50,reach:0.68,grain:0.28,star:0.55,motion:0.50,gain:1.25,
   px:-0.16,py:0.19,size:0.28,tilt:0.12,flatten:0.13,rock:1.00,clouds:0.22,sun:0.15,
   tint:[0.48,0.23,0.36],rim:[1.00,0.65,0.77],dust:[0.22,0.16,0.50]},
  {n:'DEEPFIELD',x:-0.16,y:-0.22,lean:-0.22,width:0.18,bend:-1.80,reach:0.60,grain:0.55,star:1.10,motion:0.48,gain:1.30,
   px:0.11,py:0.30,size:0.25,tilt:0.50,flatten:0.42,rock:0.62,clouds:0.60,sun:2.70,
   tint:[0.10,0.25,0.45],rim:[0.41,0.69,0.96],dust:[0.21,0.12,0.46]}];
/* HOW MANY ORBITS BUY A NEW WORLD. The owner's brief, verbatim: "players
   should want to get orbits, and they should be rewarded with a cool
   background change" — and, separately, "many people have complained they
   didnt even know they were supposed to do orbits". Those are the same bug.
   An orbit paid points into a number in the corner; nothing in the world the
   player was looking at moved because of it, so the mechanic was invisible
   and therefore optional. Orbits now BUY the journey: seven of them arrive
   somewhere new, and at a fed orbit every ~9s that is a new sky roughly every
   minute of clean play.
   ORB_WORLD_SECS is the trickle underneath it and exists so the sky is never
   frozen for a player who is struggling — 150s of any play advances one world
   on its own. It is deliberately far slower than the orbit route: the point
   is that orbiting is how you travel, not one of two ways. */
const ORB_PER_WORLD=7, ORB_WORLD_SECS=150;
/* which world each level opens on, as a FLOOR on the journey — see startGame */
/* IT HAS TO CLIMB, AND IT DID NOT. This read [0,1,5,3,2,7], and because the
   floor is a `Math.max` against a journey that never goes backwards, LEVEL 3
   floored the sky at world 5 and levels 4 and 5 then asked for 3 and 2 — both
   already behind. Their entries were DEAD: in a real run from level 1 nobody
   ever saw EMBERFALL or GLASS as a level's opening image, and the promise this
   constant exists to keep ("every level has a guaranteed distinct opening
   image") was true for three levels out of six. It only looked right from the
   level select, which starts a level with skyW at 0 — which is exactly how it
   was screenshotted when it was written.
   The fix is the journey order, so the table climbs and each level's home is
   reachable. And with the order partly free, it was spent on making the names
   agree: THE STORM opens on DUSTLANE (mass everywhere, cut to ribbons — a dust
   storm), EVENT HORIZON on GLASS (void and stars: the world whose own note
   says darkness is composition rather than absence), REDSHIFT on EMBERFALL
   (the warm one — it had been handed the COLD one), HEAT DEATH on DEEP FIELD.
   Only partly free, because VEIL cannot move: it is GRID's bright neighbour
   and the sky-brightness gate fails without it — see the note on VEIL. So
   VEIL and GRID are not homes; they are what you travel THROUGH between
   REDSHIFT and HEAT DEATH by orbiting, which is the point of a journey that
   is bought rather than assigned. */
const LEVEL_HOME=[0,1,2,3,4,7];   /* DRIFT TIDE VEIL GLASS EMBERFALL DEEPFIELD */
/* Contrast moderation in the annulus the orbits occupy — see the red-ban note
   above. 0 disables it and gives the unmoderated sky. */
const SKY_ARENA_CALM=0.62;
function makeCanvas(w,h,fn){
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.ceil(w*DPR));c.height=Math.max(1,Math.ceil(h*DPR));
  const g=c.getContext('2d');
  g.setTransform(DPR,0,0,DPR,0,0);
  fn(g,w,h);
  return {c:c,w:w,h:h};
}
/* Star positions are generated once in normalised space and re-baked at each
   size, so resizing never reshuffles the sky. */
let starField=[];
function buildStarField(){
  if(starField.length)return;
  const tiers=[
    {n:104,r:[0.4,0.9],a:[0.14,0.30],c:'138,164,214',halo:false},
    {n:54, r:[0.9,1.5],a:[0.24,0.44],c:'202,224,255',halo:false},
    {n:15, r:[1.4,2.2],a:[0.48,0.72],c:'255,255,255',halo:true}
  ];
  for(let ti=0;ti<tiers.length;ti++){const t=tiers[ti];
    for(let i=0;i<t.n;i++)
      starField.push({x:Math.random(),y:Math.random(),r:rand(t.r[0],t.r[1]),
        a:rand(t.a[0],t.a[1]),c:t.c,halo:t.halo,tier:ti});}
}
function makeSprite(half,fn){
  const s=Math.ceil(half*2);
  const c=document.createElement('canvas');
  c.width=Math.ceil(s*DPR);c.height=Math.ceil(s*DPR);
  const g=c.getContext('2d');
  g.setTransform(DPR,0,0,DPR,0,0);
  g.translate(s/2,s/2);
  fn(g);
  return {c:c,s:s};
}
function blit(sp,x,y,scale,rot,alpha){
  if(!sp)return;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(x,y);
  if(rot)ctx.rotate(rot);
  const d=sp.s*scale;
  ctx.drawImage(sp.c,-d/2,-d/2,d,d);
  ctx.restore();
}
function buildSprites(bandOnly){
  /* Scene colour is procedural now. A palette change needs no canvas bakes;
     only gameplay sprites are allocated, on initial load and real resizes. */
  if(bandOnly)return;
  SPR.ember=makeSprite(9*u+24,function(g){
    const hr=22*u;
    const gr=g.createRadialGradient(0,0,0,0,0,hr);
    gr.addColorStop(0,'rgba(255,200,87,0.36)');
    gr.addColorStop(0.35,'rgba(255,170,60,0.13)');
    gr.addColorStop(1,'rgba(255,150,40,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,hr,0,TAU);g.fill();
    g.fillStyle=COL.ember;
    g.beginPath();
    for(let i=0;i<8;i++){
      const rr=(i%2===0)?9*u:9*u*0.34,a=i*Math.PI/4;
      const X=Math.cos(a)*rr,Y=Math.sin(a)*rr;
      if(i===0)g.moveTo(X,Y);else g.lineTo(X,Y);
    }
    g.closePath();g.fill();
    g.fillStyle='rgba(255,247,224,0.92)';
    g.beginPath();g.arc(0,0,2.6*u,0,TAU);g.fill();
  });
  /* Shards get a lit facet and a rim so they read as solid crystal against
     all the glow — threats should feel heavier than collectibles. ONE KEY
     LIGHT: the bright face sits at -x, and the draw rotates each crystal to
     its ring angle, so every shard is lit by the arena's own lamp. */
  SPR.shard=makeSprite(11*u+26,function(g){
    const R0=11*u,hr=R0*2.3,d=R0*0.7*Math.SQRT2;
    const gr=g.createRadialGradient(0,0,0,0,0,hr);
    gr.addColorStop(0,'rgba(255,93,115,0.45)');
    gr.addColorStop(0.42,'rgba(255,93,115,0.16)');
    gr.addColorStop(1,'rgba(255,93,115,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,hr,0,TAU);g.fill();
    const lg=g.createLinearGradient(-d,0,d,0);
    lg.addColorStop(0,'#ff9dab');
    lg.addColorStop(0.48,'#ff5d73');
    lg.addColorStop(1,'#c53a52');
    const dia=function(){g.beginPath();
      g.moveTo(-d,0);g.lineTo(0,-d);g.lineTo(d,0);g.lineTo(0,d);g.closePath();};
    g.fillStyle=lg;dia();g.fill();
    g.strokeStyle='rgba(255,198,208,0.7)';g.lineWidth=1.2;dia();g.stroke();
    g.strokeStyle='rgba(255,255,255,0.20)';g.lineWidth=1;
    g.beginPath();g.moveTo(0,-d);g.lineTo(0,d);g.stroke();
  });
  /* SHARD FAMILIES. One sprite served four behaviours; now each kin keeps the
     red-crystal halo (the taught lesson is colour-keyed) and varies only its
     silhouette: the drifter is a chevron whose point leads its motion, the
     blinker a hollow core that says "this one cycles". */
  SPR.shardDrift=makeSprite(11*u+26,function(g){
    const R0=11*u,hr=R0*2.3;
    const gr=g.createRadialGradient(0,0,0,0,0,hr);
    gr.addColorStop(0,'rgba(255,93,115,0.45)');
    gr.addColorStop(0.42,'rgba(255,93,115,0.16)');
    gr.addColorStop(1,'rgba(255,93,115,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,hr,0,TAU);g.fill();
    /* bright trails at -x, matching the key light; the point leads */
    const lg=g.createLinearGradient(-R0*0.6,0,R0,0);
    lg.addColorStop(0,'#ff9dab');
    lg.addColorStop(0.5,'#ff5d73');
    lg.addColorStop(1,'#c53a52');
    g.fillStyle=lg;
    g.beginPath();
    g.moveTo(R0*0.95,0);g.lineTo(-R0*0.55,R0*0.62);
    g.lineTo(-R0*0.18,0);g.lineTo(-R0*0.55,-R0*0.62);
    g.closePath();g.fill();
    g.strokeStyle='rgba(255,198,208,0.7)';g.lineWidth=1.2;g.stroke();
  });
  SPR.shardBlink=makeSprite(11*u+26,function(g){
    const R0=11*u,hr=R0*2.3,d=R0*0.7*Math.SQRT2;
    const gr=g.createRadialGradient(0,0,0,0,0,hr);
    gr.addColorStop(0,'rgba(255,93,115,0.45)');
    gr.addColorStop(0.42,'rgba(255,93,115,0.16)');
    gr.addColorStop(1,'rgba(255,93,115,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,hr,0,TAU);g.fill();
    const lg=g.createLinearGradient(-d,0,d,0);
    lg.addColorStop(0,'#ff9dab');
    lg.addColorStop(0.48,'#ff5d73');
    lg.addColorStop(1,'#c53a52');
    g.fillStyle=lg;
    /* the rim band: outer diamond minus the hollow core */
    g.beginPath();
    g.moveTo(-d,0);g.lineTo(0,-d);g.lineTo(d,0);g.lineTo(0,d);g.closePath();
    const h2=d*0.42;
    g.moveTo(-h2,0);g.lineTo(0,h2);g.lineTo(h2,0);g.lineTo(0,-h2);g.closePath();
    g.fill('evenodd');
    g.strokeStyle='rgba(255,198,208,0.7)';g.lineWidth=1.2;
    g.beginPath();
    g.moveTo(-d,0);g.lineTo(0,-d);g.lineTo(d,0);g.lineTo(0,d);g.closePath();
    g.stroke();
    g.fillStyle='rgba(255,93,115,0.9)';
    g.beginPath();g.arc(0,0,1.8*u,0,TAU);g.fill();
  });
  /* Bloom is drawn additively, the core is not — otherwise the head
     saturates to a white smear and stops reading as a cyan point. */
  SPR.cometGlow=makeSprite(9*u+34,function(g){
    const hr=25*u;
    const gr=g.createRadialGradient(0,0,0,0,0,hr);
    gr.addColorStop(0,'rgba(110,238,255,0.50)');
    gr.addColorStop(0.22,'rgba(93,240,255,0.22)');
    gr.addColorStop(0.55,'rgba(70,190,255,0.07)');
    gr.addColorStop(1,'rgba(60,160,255,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,hr,0,TAU);g.fill();
  });
  /* THE PROTAGONIST HAS A HEADING NOW. A teardrop pointing +x, rotated to the
     direction of travel at draw time — three concentric discs had no
     orientation, so the thing the player stares at could not show the reverse
     it had just made. The taper hands off into the trail. */
  SPR.comet=makeSprite(13*u+6,function(g){
    const layers=[['rgba(52,196,224,0.9)',8.6],[COL.comet,6.6],['#eafdff',3.4]];
    for(const L of layers){
      const r=L[1]*u;
      g.fillStyle=L[0];
      g.beginPath();
      g.arc(2.2*u,0,r,-Math.PI/2,Math.PI/2);
      /* the tail converges rather than closing round — a body, not a dot */
      g.quadraticCurveTo(-r*0.4,r*0.55,2.2*u-r*1.9,0);
      g.quadraticCurveTo(-r*0.4,-r*0.55,2.2*u,-r);
      g.closePath();g.fill();
    }
  });
  SPR.shieldRing=makeSprite(15*u+16,function(g){
    g.shadowColor=COL.shield;g.shadowBlur=7;
    g.strokeStyle=COL.shield;g.lineWidth=1.7;
    g.beginPath();g.arc(0,0,15*u,0,TAU);g.stroke();
  });
  /* THE ORBS ARE SPRITES NOW. drawPow ran the file's only remaining per-frame
     shadowBlur — the exact cost this cache exists to avoid — and the live
     strokes were thin beside the layered baked embers and shards. The glow is
     paid for once here; rotation and pulse ride blit()'s own args. */
  SPR.powShield=makeSprite(10*u+18,function(g){
    g.shadowColor=COL.shield;g.shadowBlur=12;
    g.strokeStyle=COL.shield;g.lineWidth=2.5;
    g.beginPath();g.arc(0,0,10*u,0,TAU);g.stroke();
  });
  SPR.powWarpO=makeSprite(10*u+18,function(g){
    g.shadowColor=COL.warp;g.shadowBlur=12;
    g.strokeStyle=COL.warp;g.lineWidth=2.5;
    g.strokeRect(-7*u,-7*u,14*u,14*u);
  });
  SPR.powWarpI=makeSprite(6*u+14,function(g){
    g.shadowColor=COL.warp;g.shadowBlur=8;
    g.strokeStyle=COL.warp;g.lineWidth=2.5;
    g.strokeRect(-4*u,-4*u,8*u,8*u);
  });
  SPR.powNova=makeSprite(11*u+20,function(g){
    g.shadowColor='#ffb36b';g.shadowBlur=14;
    g.strokeStyle=COL.nova;g.lineWidth=2;
    g.beginPath();
    for(let i=0;i<16;i++){
      const sr=(i%2===0)?11*u:4*u,aa=i*Math.PI/8;
      if(i===0)g.moveTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
      else g.lineTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
    }
    g.closePath();g.stroke();
  });
  SPR.powHyper=makeSprite(12*u+22,function(g){
    /* the friends asked for exactly this: "like a star in Mario" — so it IS
       a five-point star, gold with a white edge, recognisable at a glance */
    g.shadowColor='#ff8fe4';g.shadowBlur=14;
    g.fillStyle=COL.hyper;g.strokeStyle='#ffffff';g.lineWidth=1.6;
    g.beginPath();
    for(let i=0;i<10;i++){
      const sr=(i%2===0)?11*u:4.6*u,aa=-Math.PI/2+i*Math.PI/5;
      if(i===0)g.moveTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
      else g.lineTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
    }
    g.closePath();g.fill();g.stroke();
  });
  /* the hub lamp the whole scene is lit by */
  SPR.core=makeSprite(46*u,function(g){
    for(const L of [[34,'120,160,255',0.05],[13,'150,190,255',0.16],[3,'220,235,255',0.5]]){
      const gr=g.createRadialGradient(0,0,0,0,0,L[0]*u);
      gr.addColorStop(0,'rgba('+L[1]+','+L[2]+')');
      gr.addColorStop(1,'rgba('+L[1]+',0)');
      g.fillStyle=gr;g.beginPath();g.arc(0,0,L[0]*u,0,TAU);g.fill();
    }
    g.fillStyle='#eef6ff';g.beginPath();g.arc(0,0,1.5*u,0,TAU);g.fill();
  });
  /* the comet's furnace core, flickered over the base teardrop */
  SPR.cometHot=makeSprite(8*u+8,function(g){
    const gr=g.createRadialGradient(1.3*u,0,0,1.3*u,0,5*u);
    gr.addColorStop(0,'rgba(255,255,255,0.9)');
    gr.addColorStop(1,'rgba(190,250,255,0)');
    g.fillStyle=gr;g.beginPath();g.arc(1.3*u,0,5*u,0,TAU);g.fill();
    g.fillStyle='#ffffff';
    g.beginPath();
    g.arc(1.3*u,0,4*u,-Math.PI/2,Math.PI/2);
    g.quadraticCurveTo(-1.6*u,2.2*u,-6.3*u,0);
    g.quadraticCurveTo(-1.6*u,-2.2*u,1.3*u,-4*u);
    g.closePath();g.fill();
  });
  /* a fat annular shockwave for the moments that earn one */
  SPR.shock=(function(){
    const c=document.createElement('canvas');c.width=128;c.height=128;
    const g=c.getContext('2d');
    const gr=g.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0.60,'rgba(235,245,255,0)');
    gr.addColorStop(0.78,'rgba(235,245,255,0.55)');
    gr.addColorStop(1,'rgba(235,245,255,0)');
    g.fillStyle=gr;g.fillRect(0,0,128,128);
    return {c:c,s:128};
  })();
  /* a mote of lit dust, and a conduit node pip */
  SPR.mote=makeSprite(5*u+4,function(g){
    const gr=g.createRadialGradient(0,0,0,0,0,5*u);
    gr.addColorStop(0,'rgba(214,232,255,0.8)');
    gr.addColorStop(1,'rgba(214,232,255,0)');
    g.fillStyle=gr;g.beginPath();g.arc(0,0,5*u,0,TAU);g.fill();
  });
  SPR.pip=makeSprite(3.5*u+8,function(g){
    g.shadowColor='rgb(150,190,255)';g.shadowBlur=6;
    g.fillStyle='rgba(190,215,255,0.9)';
    g.beginPath();g.arc(0,0,1.7*u,0,TAU);g.fill();
  });
  /* THE LIT LIMB. SPR.core is commented as "the hub lamp the whole scene is
     lit by" and until now exactly one object answered it: the shard, whose
     baked bright face is rotated hubward at draw time. That trick is right,
     and it generalises — everything else on the board is a decal that glows
     the same on all sides no matter where it is standing, which is why a
     dense board reads as stickers on glass rather than objects in a room.
     Baked facing -x and rotated by the SCREEN direction out from the hub, so
     the lit edge always faces the lamp. Screen direction, not the parametric
     ring angle: with AY above 1 the arena is a stretched circle and the two
     differ by up to eleven degrees at the diagonals, which is a highlight
     visibly off-centre on exactly the objects nearest the player's eye. */
  SPR.rim=makeSprite(13*u+10,function(g){
    g.lineCap='round';
    g.shadowColor='rgba(180,215,255,0.85)';g.shadowBlur=6;
    g.strokeStyle='rgba(214,234,255,0.95)';
    g.lineWidth=2.2*u;
    g.beginPath();g.arc(0,0,9*u,Math.PI*0.72,Math.PI*1.28);g.stroke();
  });
}

function resize(width,height,pixelRatio){
  if(runtimeDestroyed)return;
  const external=!!runtimeHost.externalLoop;
  DPR=Math.min(Number.isFinite(pixelRatio)&&pixelRatio>0?pixelRatio:
    (external?(runtimeHost.dpr||DPR||1):(window.devicePixelRatio||1)),2);
  W=Math.max(1,Number.isFinite(width)?width:(external?(runtimeHost.width||W||390):window.innerWidth));
  H=Math.max(1,Number.isFinite(height)?height:(external?(runtimeHost.height||H||844):window.innerHeight));
  /* The production canvas belongs to Phaser's Scale Manager. */
  if(!external){
    cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
    cv.style.width=W+'px';cv.style.height=H+'px';
  }
  ctx.setTransform(DPR,0,0,DPR,0,0);
  cx=W/2;cy=H/2;
  u=Math.max(0.75,Math.min(Math.min(W,H)/420,1.3));
  try{
    const insets=typeof runtimeHost.insets==='function'?runtimeHost.insets():runtimeHost.insets;
    if(insets){safeTop=Math.max(0,insets.top||0);safeBot=Math.max(0,insets.bottom||0);}
    else{
      const cs=getComputedStyle(safeEl);
      safeTop=parseFloat(cs.paddingTop)||0;
      safeBot=parseFloat(cs.paddingBottom)||0;
    }
  }catch(e){safeTop=0;safeBot=0;}
  /* SIZE THE ARENA FROM THE FREE BOX, not from a flat fraction of the screen.
     `min(W,usableH)*0.31` ignored the furniture at both ends and left 74px of
     dead margin either side in portrait while ALREADY overlapping in
     landscape — 16px of clearance under the ring and the tier banner drawing
     80px up into the HUD. Solving the actual box fixes both at once: portrait
     gains about a third more arena, landscape stops colliding. */
  const topLim=safeTop+150*u;            /* under the score / embers / groove stack */
  const botLim=H-safeBot-74*u;           /* over the shield button */
  const vBox=Math.max(40,(botLim-topLim)/2);
  /* 30u leaves exactly enough for the comet plus a full three-shield stack
     (15u sprite at 1.86x = 28u) at the widest point of the outer ring. */
  const hBox=W/2-30*u;
  R=Math.max(52,Math.min(hBox,vBox));
  /* R is width-bound in portrait, so the leftover vertical room is exactly
     what the stretch spends. Capped, and never below 1, so a landscape screen
     (where vBox is the binding constraint) simply stays circular. */
  AY=1;
  if(ARENA_STRETCH>0&&R>0)
    AY=1+(Math.max(1,Math.min(vBox/R,ARENA_MAX_Y))-1)*Math.min(1,ARENA_STRETCH);
  cy=(topLim+botLim)/2;
  /* normalised coords: the star field never needs rebuilding on resize */
  if(!bgStars.length){
    for(let i=0;i<22;i++)bgStars.push({x:Math.random(),y:Math.random(),r:rand(0.7,1.7),ph:rand(0,TAU),tw:rand(0.5,2.5)});
  }
  if(sprU!==u||sprDPR!==DPR||sprW!==W||sprH!==H||sprBand!==skyI){
    /* A band change alone crossfades from the outgoing sky; a real resize
       cannot, because the old bake is the wrong size. The 1-2ms rebake lands
       on the same frame as the tier banner, where a long frame is invisible. */
    const bandOnly=sprU===u&&sprDPR===DPR&&sprW===W&&sprH===H&&sprBand!==-1;
    /* The scene interpolates its own field; no outgoing bitmap survives. */
    buildSprites(bandOnly);

    sprU=u;sprDPR=DPR;sprW=W;sprH=H;sprBand=skyI;
  }
}
if(!runtimeHost.externalLoop)runtimeListen(window,'resize',resize);
resize(runtimeHost.width,runtimeHost.height,runtimeHost.dpr);

function angDist(a,b){const d=Math.abs((a-b)%TAU);return d>Math.PI?TAU-d:d;}
/* RADII and RINGS are declared up top, before the sprite cache — the initial
   bake needs them. The inner ring was lifted to 0.545 of a larger R so the
   innermost track is ~42% wider than it once was; each ring is an instrument
   (performerHit transposes by ring, the sub doubles, the pad opens) — the
   tempo never changes, only how finely the bar is cut. */
function ringOf(){return G.state==='playing'?Math.min(RINGS.length-1,effRing()):0;}
function radiusOf(i){return R*RADII[i];}
/* AN EMBER'S RADIUS HAS ONE OWNER, AND IT IS ITS RING. It briefly had two: the
   magnetar pull gave an ember a FREE radius in s.pr so it could curve between
   rings instead of teleporting, and every pass that draws an ember then had to
   be taught to read it. Several passes draw an ember. The bloom pass was not
   taught, so for the whole of every pull each ember's glow stayed parked on the
   ring it started from while the ember flew inward — sixteen detached glows at
   once, up to 89px apart on a 390px screen. That was fixed with a starR()
   accessor and a build guard, and it broke again anyway, because the guard only
   covered loops it could recognise as star loops.
   The mechanic is gone and so is the free radius. There is nothing left to
   disagree about: radiusOf(s.ring) is the only radius an ember has. Anything
   that reintroduces a per-object radius reintroduces this whole bug class. */
/* ---------- THE ORBIT STACK HAS DEPTH ----------
   The backdrop already parallaxes: five baked planes ride the camera dolly by
   their own depth, which is why the sky reads as far away. The arena did not.
   Four orbits, one plane, pinned dead still while everything behind them
   moved — so the stack read as rings printed on the glass in front of a
   world, rather than as a machine standing in one.
   The offset is a function of the RADIUS ALONE. That is the whole reason this
   is safe: posAt() takes the radius as an argument, so every object standing
   on an orbit gets exactly the offset that orbit gets, without anything
   having to be told which ring it is on. A shard cannot come unstuck from its
   track because the two are computed from the same number.
   It rides the SAME LFO as the backdrop dolly, scaled — one camera moving,
   not two effects agreeing. The hub is depth 0 and never moves, which is
   what makes the differential visible at all: the outer orbit swings against
   a fixed lamp.
   KNOWN APPROXIMATION, and it is the only one: a few positions are STORED
   rather than recomputed — the nova front's centre, the trail's points, a
   particle's birthplace — so they carry the offset that was live when they
   were taken. The dolly moves about half a pixel over a second at this
   amplitude, against a nova front that grows to hundreds of pixels and a
   trail that is three pixels wide. Nothing here is a hit test on a tolerance
   that small; the real hit tests are all on angles and radii, which this
   never touches.
   ARENA_PARALLAX is the A/B dial: 0 restores the flat stack exactly. */
let ARENA_PARALLAX=1.0;
const PARA_K=1.15;          /* the arena's swing as a multiple of the dolly's */
let paX=0,paY=0;            /* set once per frame in draw(), from camX/camY */
/* Presentation-only copy of the translation actually drawn this frame. */
let flightShakeX=0,flightShakeY=0;
function depthOf(r){return R>0?Math.min(1.35,r/R):0;}
function posAt(a,r){
  const d=depthOf(r);
  return[cx+paX*d+Math.cos(a)*r,cy+paY*d+Math.sin(a)*r*AY];
}
/* the same offset for anything drawn as an arc about the hub rather than as a
   point on one — ring strokes, lap arcs, ignition heads, the saucer's beam */
function ecx(r){return cx+paX*depthOf(r);}
function ecy(r){return cy+paY*depthOf(r);}

/* ---------- audio ----------
   Everything is synthesised; there are no audio files. The layout is a fixed
   bus built once, with per-sound voices created and discarded on top of it:

     voice ─┬─► dry ─────────────► world ─┐
            └─► send ─► verb ────────────►├─► limiter ─► makeup ─► clip ─► out
     bed ──────────────► bedDuck ─────────┘

   Measured before writing any of this: the old layer peaked at 0.138 on the
   busiest moment in the game, so ~86% of the available headroom was going
   unused. That, not clipping, was the reason it sounded thin on a phone. */
let AC=null,muted=false;
let audioUnlocked=false;
let A=null;                      /* the bus, built once */
const MASTER=2.15;               /* makeup. Measured, not guessed: 2.6 put the
                                    nova cascade 3 samples over full scale. */
/* iPhone speakers roll off hard under ~500Hz. Anything whose PAYLOAD lives
   below that is inaudible on the target device however loud it looks here —
   which is why the old bump and empty-shield cues could not be heard at all. */
function buildBus(){
  if(A||!AC)return;
  const c=AC;
  const out=c.createGain();out.gain.value=1;
  /* Soft clip after makeup so a stacked moment saturates instead of tearing.
     3rd-order curve: linear to ~0.5, then bends. */
  const clip=c.createWaveShaper();
  const n=1024,cv=new Float32Array(n);
  for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.tanh(x*1.25)/Math.tanh(1.25);}
  clip.curve=cv;clip.oversample='2x';
  const makeup=c.createGain();makeup.gain.value=MASTER;
  const lim=c.createDynamicsCompressor();
  lim.threshold.value=-16;lim.knee.value=6;lim.ratio.value=12;
  lim.attack.value=0.003;lim.release.value=0.14;
  const world=c.createGain();world.gain.value=1;
  const bedDuck=c.createGain();bedDuck.gain.value=1;
  /* THE HOLE. One gain node carrying the whole band — pad, arp, root, hats.
     The drop's silence is a single automation curve written on this, which is
     why it cannot be left stranded by mute, death or a backgrounded tab. */
  const hole=c.createGain();hole.gain.value=1;
  /* THE PUMP. One gain after the hole that dips under each payoff kick and
     recovers before the next — the classic sidechain breath the section was
     missing. payoffStep is its only writer and endSection its only undo,
     per the same-call discipline that governs the hole. */
  const pump=c.createGain();pump.gain.value=1;
  /* Leave headroom in ordinary flight; earned passages can open the band
     without turning up the player's separate instrument or the cues. */
  const band=c.createGain();band.gain.value=0.72;
  /* THE PLAYER'S INSTRUMENT, on its own path. It bypasses bedDuck, so a nova
     or an ignition gets the band out of the way and NOT you; and it bypasses
     hole, so when the drop takes the floor out from under the arrangement your
     own notes are the thing left standing. A +3dB bell at 1.5kHz is the most
     efficient band on a 15mm phone driver and this mix was thin there. */
  const perf=c.createGain();perf.gain.value=1;
  const pq=c.createBiquadFilter();
  pq.type='peaking';pq.frequency.value=1500;pq.Q.value=0.9;pq.gain.value=3;
  perf.connect(pq);
  /* Reverb: a real convolver over a generated impulse. Two delay taps read as
     slapback rather than space — above the ~50ms fusion threshold you hear
     two echoes, not a room. Noise through an exponential decay diffuses. */
  const verb=c.createConvolver();
  const sr=c.sampleRate,len=Math.floor(sr*1.6),ir=c.createBuffer(2,len,sr);
  for(let ch=0;ch<2;ch++){
    const d=ir.getChannelData(ch);
    for(let i=0;i<len;i++){
      const t=i/len;
      d[i]=(Math.random()*2-1)*Math.pow(1-t,2.6)*(i<sr*0.006?t*160:1);
    }
  }
  verb.buffer=ir;
  const send=c.createGain();send.gain.value=0.20;
  const verbTone=c.createBiquadFilter();
  verbTone.type='highpass';verbTone.frequency.value=420; /* keep the tail out of the mud */
  /* ...and a lowpass above: a BRIGHT tail is why the game read as sparkly
     even at matched levels — the deep genres keep the room dark */
  const verbDark=c.createBiquadFilter();
  verbDark.type='lowpass';verbDark.frequency.value=3200;
  /* THE DUB DELAY. The single biggest "groovy, relaxing synth" move there
     is: a tempo-synced dotted-eighth delay with dark feedback, so every note
     that feeds it trails away in rhythm instead of stopping dead. It hangs
     off the bed path BEFORE the hole, so the drop's silence swallows the
     echoes too — the discipline holds. */
  const dly=c.createDelay(1.2);
  dly.delayTime.value=(60/104)*0.75;          /* dotted eighth at 104bpm */
  const dfb=c.createGain();dfb.gain.value=0.42;
  const dtone=c.createBiquadFilter();
  dtone.type='lowpass';dtone.frequency.value=1100; /* each repeat darkens hard */
  const dout=c.createGain();dout.gain.value=0.55;
  dly.connect(dtone);dtone.connect(dfb);dfb.connect(dly);
  dtone.connect(dout);dout.connect(bedDuck);
  world.connect(lim);bedDuck.connect(hole);hole.connect(pump);pump.connect(band);band.connect(lim);pq.connect(lim);
  send.connect(verb);verb.connect(verbTone);verbTone.connect(verbDark);verbDark.connect(lim);
  lim.connect(makeup);makeup.connect(clip);clip.connect(out);out.connect(c.destination);
  out.gain.value=muted?0:1;      /* mute the BUS, never the clock — see toggleMute */
  A={out:out,world:world,send:send,lim:lim,bed:bedDuck,hole:hole,pump:pump,band:band,perf:perf,makeup:makeup,dly:dly};
  buildBed();
}
/* The bed. Filter movement carries the escalation, never amplitude: a slow
   volume wobble on a sustained tone is the single most fatiguing thing you can
   put in a game, and this one has to survive fifteen-minute runs. Fundamentals
   sit low but the harmonics of a sawtooth reach well into the band a phone can
   actually reproduce, so it is present on a speaker without being boomy. */
let BED=null;
/* ---------- music ----------
   Adaptive layering, which is how games do this: ONE fixed tempo, with layers
   entering as the difficulty clock rises. Nothing speeds up and nothing
   changes key mid-LEVEL, so it can never lurch; what changes inside a level
   is how much of the arrangement you are hearing — and, since the chorus
   arrived, WHICH SECTION of the song it is playing: hot play lifts the
   record from its verse into a second progression at the four-bar seam and
   cooling off settles it back, which is the horizontal axis (form) on top
   of the vertical one (layers). See PROGB.

   The key and the progression are per level, not per game — see PROG and
   LV[].key. What every level shares is the constraint: its chords are drawn
   from the natural minor of its own tonic, which is the mode the SFX
   pentatonic is scaled into, so nothing the game plays can clash with what the
   music is doing underneath it. That guarantee is the reason the progressions
   are what they are, and musiccheck.mjs is where it is enforced.

   CH below is level 1's row, and only that: applyLevelMusic overwrites it from
   PROG on every level change. It is declared with real values rather than
   empty because buildBed retunes from CH[0] before a level is ever started. */
const BPM=104,SPB=60/BPM,STEPS=32;      /* 4 bars of 4, counted in eighths */
const CH=[[110,220,261.63,329.63],      /* Am  — level 1's i  */
          [ 87.31,174.61,220,261.63],   /* F   — level 1's VI */
          [130.81,261.63,329.63,392],   /* C   — level 1's III */
          [ 98,196,246.94,293.66]];     /* G   — level 1's VII */
/* Pentatonic degrees for the arp and the counter-line, as indices into PENT. */
/* ARP tops out at degree 4 (784Hz) on purpose: the player's floor is 784 and a
   boundary only reads as a boundary if the band actually stops below it. */
const ARP=[0,2,4,2,3,2,4,3],CNT=[7,5,4,5,7,8,7,5];
/* THE STAR RUN — sixteen sixteenths, one bar, restated for as long as the
   hypernova lasts. Four ascending four-note cells, each starting one degree
   above the last, so the line climbs and wraps instead of resolving. Indices
   into PENT, which is the level's own minor pentatonic: an interval over the
   tonic, never a frequency, so it transposes with the key and stays consonant
   against every chord in either section. Degrees 4-10 sit ABOVE the band's
   degree-4 arp ceiling — the star is meant to be on top of the arrangement,
   which is the one voice in the game that is. */
const STARRUN=[4,5,6,7, 5,6,7,8, 6,7,8,9, 7,8,9,10];
/* The score-anchored layer ladder. The riff and the solo it used to declare
   here (RIFF, SOLO) are deleted: they were superseded by the per-level RIFFL
   and SOLOL and had no reader left, so they sat in the distributed file as two
   tunes nobody plays — and, worse, as the obvious thing to edit for anyone
   trying to change the riff. */
const LAYER_AT=[600,1400,2400,3600];
const LAYER_NAME=['NEW MUSIC: RHYTHM','NEW MUSIC: MELODY',
                  'NEW MUSIC: DEEP BASS','NEW MUSIC: HIGH NOTES'];
/* ---------- the payoff section ----------
   A drop is not a moment, it is a DOOR. What was shipped fired six voices for
   1.3s and then returned to exactly the arrangement it had been playing, so
   earning one bought nothing. This is what it opens onto.

   Eight bars, 18.46s, entered through a real hole. Bars 0-1 the band states a
   hook that exists nowhere else in the game. Bars 2-3 the hook STOPS and those
   bars are the player's. Bars 4-5 the hook returns with the drums at four
   times the backbeat rate. Bar 6 is the player's again. Bar 7 is a written
   descent that lands one eighth before the ordinary loop resumes.

   PAY = 2 x STEPS is load-bearing: MU.step returns to 0 exactly as the section
   ends, so the chord walk stays aligned and the seam lands on a downbeat. */
/* PAYREST is now only the musical breathing room between two sections, not a
   rationing device — see armDrop. Long enough that the ordinary arrangement
   is heard again between payoffs; short enough that earning one means having
   one. */
/* PAYREST was 20s, which with the 18.5s section put a second drop 38.5s from
   the first — beyond what most runs survive, so in practice a run's meter
   only ever paid once and "keep playing to fill the build" read as broken.
   Four bars of ordinary arrangement is still a real breath between sections. */
const PAY=32,S16=SPB/4,PAYLEN=PAY*(SPB/2),PAYREST=0;
/* 8 bars x 16 sixteenths of PENT degrees, -1 = rest. The accents are 3+3+2 and
   share not one position with ARP's straight eighths, which is what makes it
   read as a different piece of music rather than the same music louder. */
/* ONE HOOK FOR FOUR LEVELS was the last place "each level is its own song"
   stopped being true. The payoff is the loudest, most-anticipated thing in
   the game, and every level's peak stated the same tune transposed — so the
   deeper a player got, the more the reward sounded like the reward they had
   already been given.
   The RHYTHM is shared on purpose, and that is not laziness. Those accent
   positions are the hook's signature, they are what keeps it clear of ARP's
   straight eighths, and they are the grid the response bars answer against.
   Four different rhythms would be four different pieces of music; four
   melodies over one rhythm is a game with a tune. So bars 2, 3 and 6 stay
   the player's on every level, bar 7 is always the written descent, and only
   the pitches move.
   The bar comments below name bars, not chords. The rise latches at whichever
   bar line comes next, so a section can begin on any of the four chords —
   PAY = 2 x STEPS guarantees only that it ENDS where it started. The hook is
   pentatonic throughout precisely so it does not care. */
const HOOKL=[
/* LIFT OFF — arcs up, falls back, reaches once at the top of the bar */
[/*0*/  8,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 8,-1,-1, 9,-1,
 /*1*/  8,-1,-1, 6,-1,-1, 5,-1,  3,-1,-1, 5,-1,-1,-1,-1,
 /*2*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*3*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*4*/  8,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 8,-1,-1, 9,-1,
 /*5*/  8,-1,-1, 6,-1,-1, 5,-1,  3,-1,-1, 5,-1,-1,-1,-1,
 /*6*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*7*/  9,-1,-1, 8,-1,-1, 7,-1,  6,-1,-1, 5,-1,-1,-1,-1],  /* the descent */
/* INTO THE RINGS — climbs, and the second bar ends ABOVE where it began, so
   the statement hangs unanswered the way the level's own iv chord does */
[/*0*/  5,-1,-1, 7,-1,-1, 8,-1,  7,-1,-1, 5,-1,-1, 7,-1,
 /*1*/  8,-1,-1, 7,-1,-1, 5,-1,  7,-1,-1, 8,-1,-1,-1,-1,
 /*2*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*3*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*4*/  5,-1,-1, 7,-1,-1, 8,-1,  7,-1,-1, 5,-1,-1, 7,-1,
 /*5*/  8,-1,-1, 7,-1,-1, 5,-1,  7,-1,-1, 8,-1,-1,-1,-1,
 /*6*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*7*/  8,-1,-1, 7,-1,-1, 6,-1,  5,-1,-1, 3,-1,-1,-1,-1],  /* the descent */
/* THE STORM — narrow and insistent, built on a repeated note. The level whose
   bass line is a climb gets the tune that refuses to move */
[/*0*/  6,-1,-1, 6,-1,-1, 8,-1,  6,-1,-1, 5,-1,-1, 6,-1,
 /*1*/  8,-1,-1, 8,-1,-1, 9,-1,  8,-1,-1, 6,-1,-1,-1,-1,
 /*2*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*3*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*4*/  6,-1,-1, 6,-1,-1, 8,-1,  6,-1,-1, 5,-1,-1, 6,-1,
 /*5*/  8,-1,-1, 8,-1,-1, 9,-1,  8,-1,-1, 6,-1,-1,-1,-1,
 /*6*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*7*/  9,-1,-1, 8,-1,-1, 6,-1,  5,-1,-1, 4,-1,-1,-1,-1],  /* the descent */
/* EVENT HORIZON — the widest leaps in the game. Over a tonic pedal a melody
   can go anywhere, so this one does */
[/*0*/  5,-1,-1, 9,-1,-1, 8,-1,  9,-1,-1, 5,-1,-1, 8,-1,
 /*1*/  6,-1,-1,10,-1,-1, 9,-1,  8,-1,-1, 6,-1,-1,-1,-1,
 /*2*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*3*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*4*/  5,-1,-1, 9,-1,-1, 8,-1,  9,-1,-1, 5,-1,-1, 8,-1,
 /*5*/  6,-1,-1,10,-1,-1, 9,-1,  8,-1,-1, 6,-1,-1,-1,-1,
 /*6*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*7*/ 10,-1,-1, 9,-1,-1, 8,-1,  6,-1,-1, 5,-1,-1,-1,-1],  /* the descent */
/* REDSHIFT — a SINKING SEQUENCE. The same three-note cell restated a degree
   lower each time it comes round, so the tune is always receding from where
   it just was and never arrives. The level is named for light that is running
   away; this is that, in the melody. */
[/*0*/  9,-1,-1, 8,-1,-1, 6,-1,  8,-1,-1, 6,-1,-1, 5,-1,
 /*1*/  8,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 3,-1,-1,-1,-1,
 /*2*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*3*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*4*/  9,-1,-1, 8,-1,-1, 6,-1,  8,-1,-1, 6,-1,-1, 5,-1,
 /*5*/  8,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 3,-1,-1,-1,-1,
 /*6*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*7*/  8,-1,-1, 6,-1,-1, 5,-1,  4,-1,-1, 3,-1,-1,-1,-1],  /* the descent */
/* HEAT DEATH — THE COOLING LINE. The first cut of this tried to say "running
   down" by taking notes OUT of the 3+3+2 grammar, and musiccheck rejected it
   in as many words: the accent positions are shared across every level on
   purpose, because six melodies over one rhythm is a game with a tune and six
   rhythms is six unrelated pieces. The harness was right and the idea was
   wrong. So the energy leaves through PITCH instead — every cell starts lower
   than the one before it and the intervals narrow as the bar goes on, from a
   fourth down to a single step, until the phrase has nowhere left to fall.
   Same skeleton as the other five, at the end of its life. */
[/*0*/ 10,-1,-1, 9,-1,-1, 7,-1,  9,-1,-1, 7,-1,-1, 6,-1,
 /*1*/  7,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 4,-1,-1,-1,-1,
 /*2*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*3*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*4*/ 10,-1,-1, 9,-1,-1, 7,-1,  9,-1,-1, 7,-1,-1, 6,-1,
 /*5*/  7,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 4,-1,-1,-1,-1,
 /*6*/ -1,-1,-1,-1,-1,-1,-1,-1, -1,-1,-1,-1,-1,-1,-1,-1,   /* YOURS */
 /*7*/ 10,-1,-1, 8,-1,-1, 7,-1,  5,-1,-1, 3,-1,-1,-1,-1]]; /* the descent */
/* A SECOND ENDING for bars 4-5, played on every other section, so two drops
   in a row never state the hook identically. 32 slots per level because the
   two bars sit over different chords; the accents keep the 3+3+2 grammar or
   the bars stop reading as the same tune. */
const HOOKBL=[
[/*4*/  8,-1,-1, 9,-1,-1,11,-1,  9,-1,-1, 8,-1,-1, 6,-1,
 /*5*/  8,-1,-1, 6,-1,-1, 5,-1,  8,-1,-1, 9,-1,-1,-1,-1],
[/*4*/  5,-1,-1, 8,-1,-1, 9,-1,  8,-1,-1, 7,-1,-1, 5,-1,
 /*5*/  7,-1,-1, 8,-1,-1, 9,-1, 10,-1,-1, 8,-1,-1,-1,-1],
[/*4*/  6,-1,-1, 8,-1,-1, 6,-1,  9,-1,-1, 8,-1,-1, 6,-1,
 /*5*/  8,-1,-1, 9,-1,-1, 8,-1, 10,-1,-1, 9,-1,-1,-1,-1],
[/*4*/  5,-1,-1, 8,-1,-1,10,-1,  9,-1,-1, 8,-1,-1, 5,-1,
 /*5*/  6,-1,-1, 9,-1,-1,11,-1, 10,-1,-1, 8,-1,-1,-1,-1],
[/*4*/  8,-1,-1, 6,-1,-1, 9,-1,  8,-1,-1, 6,-1,-1, 4,-1,
 /*5*/  6,-1,-1, 5,-1,-1, 3,-1,  5,-1,-1, 6,-1,-1,-1,-1],
[/*4*/ 11,-1,-1, 9,-1,-1, 8,-1, 10,-1,-1, 8,-1,-1, 6,-1,
 /*5*/  8,-1,-1, 6,-1,-1, 5,-1,  6,-1,-1, 3,-1,-1,-1,-1]];
/* sixteenths to the next note, so a note can be as long as the gap it owns.
   One derivation for both tables now — it wraps on the table's own length,
   which is what the two hand-written copies each did for their own size. */
const hookGaps=function(tab){const L=tab.length,g=new Array(L).fill(0);
  for(let s=0;s<L;s++){if(tab[s]<0)continue;let n=1;
    while(n<16&&tab[(s+n)%L]<0)n++;g[s]=n;}return g;};
const HOOKGL=HOOKL.map(hookGaps),HOOKBGL=HOOKBL.map(hookGaps);
/* Complete answering melodies, one per world. Former input-response bars
   now continue automatically, including for a player who never taps. */
const ANSWERL=[
 [8,-1,-1,6,-1,-1,5,-1,6,-1,-1,8,-1,-1,5,-1],
 [5,-1,6,-1,-1,8,-1,-1,9,-1,8,-1,-1,6,-1,-1],
 [6,-1,-1,8,-1,-1,9,-1,8,-1,-1,6,-1,-1,5,-1],
 [8,-1,-1,5,-1,-1,6,-1,9,-1,-1,8,-1,-1,5,-1],
 [6,-1,-1,5,-1,-1,4,-1,5,-1,-1,8,-1,-1,6,-1],
 [9,-1,-1,8,-1,-1,6,-1,8,-1,-1,5,-1,-1,4,-1]];
let MU=null,NOISE=null;
const BEATQ=[];
/* Retained for lifecycle compatibility; no recorder schedules this queue. */
const LOOPQ=[];
function buildBed(){
  if(BED||!AC)return;
  const c=AC,g=c.createGain();g.gain.value=0;
  const lp=c.createBiquadFilter();lp.type='lowpass';
  lp.frequency.value=320;lp.Q.value=0.7;
  const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=70;
  /* The pad is four continuously running voices, retuned per chord rather than
     restarted — restarting sustained oscillators every bar is what makes cheap
     game music click audibly at the seams. */
  const oscs=[],gains=[];
  for(let i=0;i<4;i++){
    for(let k=0;k<2;k++){
      const o=c.createOscillator();
      o.type=i<2?'sawtooth':'triangle';
      o.frequency.value=CH[0][i];
      o.detune.value=k?8:-8;            /* unison detune = chorus, not chord drift */
      const vg=c.createGain();vg.gain.value=(i<2?0.05:0.03)/2;
      o.connect(vg);vg.connect(lp);o.start();
      oscs.push(o);gains.push(vg);
    }
  }
  lp.connect(hp);hp.connect(g);
  g.connect(A.bed);g.connect(A.send);
  BED={g:g,lp:lp,oscs:oscs,gains:gains};
  /* One noise buffer, reused by every hat for the life of the page. 1.5s, not
     0.4 — the drop's riser sweeps a continuous 1.73s tail and a short buffer
     loops audibly underneath it. */
  const n=c.createBuffer(1,c.sampleRate*1.5,c.sampleRate),d=n.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  NOISE=n;
  MU={next:0,step:0,chord:-1,armed:false,cool:0,
      sect:0,       /* 0 verse, 1 chorus — see PROGB and applySect */
      sectAt:0,     /* MU.barN when the section last changed — the form clock */
      chainT:0,     /* audio time the current groove chain began */
      crown:0,      /* the ring the drop fired from — sets section richness */
      landT:0,      /* audio time the drop lands — the moment to move on */
      landDone:0,   /* 0 unarmed, 1 hit, 2 spent */
      pend:null,    /* a drop earned while busy, waiting for the music to free up */
      pendSrc:null, /* the style that earned the banked drop, for its flavour */
      flavor:null,  /* the style that earned the LIVE drop — payoffStep reads it */
      why:null,lateAt:4,
      pay:0,        /* eighths left in the payoff; 0 = inactive. the only flag. */
      payEnd:0,     /* audio-clock deadline, so no stall path can strand it */
      payN:0,payHits:0,barHits:0,barN:0,
      rise:false,   /* a FULL two-bar rise is locked in */
      riseI:0,      /* the bar line the rise latched on */
      lpLock:0,hushEnd:0,chainBar:-1,liftEnd:0,
      brk:0,brkN:0,brkCool:0,brkEnd:false, /* the drum break: eighths left, count, gate, crash-due */
      glow:0};      /* afterglow: the payoff leaves every gate open until this audio time */
}
/* THE SUB REGISTER TURNS AROUND AT 40Hz. Every fixed low interval keeps the
   register A minor chose, and the six keys descend a whole tone each — so by
   REDSHIFT and HEAT DEATH the drop's boom (f*0.374577) had fallen to 26 and
   23Hz and the tonic-half drones to 35 and 31Hz: below what any phone
   reproduces AT ALL, so the game's biggest hits were literally silent on the
   two newest levels. Octave-doubling below 40Hz keeps the pitch class (a sub
   an octave up is the same note with actual air behind it) — the same
   register turnaround the basslines already got by hand. */
function subF(f){while(f<40)f*=2;return f;}
/* One-shot musical voice. Separate from beep() because music needs a filter
   and a longer tail, and because it must route through the bed's duck so a
   nova pushes the score out of the way along with everything else. */
function note(f,t,dur,type,g,cut,pan,bus,echo){
  if(!A||!AC||muted)return;
  try{
    const o=AC.createOscillator(),v=AC.createGain(),lp=AC.createBiquadFilter();
    o.type=type;o.frequency.setValueAtTime(f,t);
    lp.type='lowpass';lp.frequency.setValueAtTime(cut||3000,t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(180,(cut||3000)*0.35),t+dur);
    v.gain.setValueAtTime(0.0001,t);
    v.gain.exponentialRampToValueAtTime(g,t+0.012);
    v.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(lp);lp.connect(v);
    let tail=v;
    if(pan&&AC.createStereoPanner){const sp=AC.createStereoPanner();sp.pan.value=pan;v.connect(sp);tail=sp;}
    tail.connect(bus||A.bed);
    /* The player's voice goes out drier. Wet reads as far away, dry reads as
       close, and close is what "mine" sounds like. Half the trick is here. */
    const sg=AC.createGain();sg.gain.value=bus?0.28:0.5;tail.connect(sg);sg.connect(A.send);
    /* the optional dub send: 0..1 of this voice into the delay loop */
    if(echo&&A.dly){const eg=AC.createGain();eg.gain.value=echo;tail.connect(eg);eg.connect(A.dly);}
    o.start(t);o.stop(t+dur+0.02);
  }catch(e){}
}
/* hz/dec/wet are optional and every original call site omits them. With them
   this same voice is a snare's noise body, an open hat, or the drop's riser. */
function hat(t,g,hz,dec,wet,e,lp){
  if(!A||!AC||!NOISE||muted)return;
  try{
    const s=AC.createBufferSource(),v=AC.createGain(),hp=AC.createBiquadFilter();
    const d=dec||0.055;
    s.buffer=NOISE;s.loop=true;
    hp.type='highpass';hp.frequency.value=hz||7200;
    v.gain.setValueAtTime(0.0001,t);
    v.gain.exponentialRampToValueAtTime(g,t+0.004);
    v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    /* lp: cap the band. Measured: lowering only the highpass WIDENS the
       noise and reads as MORE sizzle — a dark shaker is a bandpass tick,
       not a lower floor. The rhythm hats cap; crashes and the payoff keep
       the full sheen, because those are the moments that may sparkle. */
    let head=hp;
    if(lp){const lo=AC.createBiquadFilter();lo.type='lowpass';lo.frequency.value=lp;
      hp.connect(lo);head=lo;}
    s.connect(hp);head.connect(v);v.connect(A.bed);
    if(wet){const sg=AC.createGain();sg.gain.value=wet;v.connect(sg);sg.connect(A.send);}
    /* e: send into the dub delay — the genre's trick for hypnotic hats is a
       TIMED delay, rhythmic space instead of more hits */
    if(e&&A.dly){const eg=AC.createGain();eg.gain.value=e;v.connect(eg);eg.connect(A.dly);}
    s.start(t);s.stop(t+d+0.03);
  }catch(e2){}
}
/* note() cannot sweep a pitch, so the kick is its own voice. The 400Hz START
   is the part a phone hears; the 48Hz body is a headphone bonus and never
   carries information. */
function kick(t,g){
  if(!A||!AC||muted)return;
  try{const o=AC.createOscillator(),v=AC.createGain();
    o.type='sine';o.frequency.setValueAtTime(400,t);
    o.frequency.exponentialRampToValueAtTime(48,t+0.075);
    v.gain.setValueAtTime(0.0001,t);
    v.gain.exponentialRampToValueAtTime(g,t+0.006);
    v.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
    o.connect(v);v.connect(A.bed);o.start(t);o.stop(t+0.27);}catch(e){}
}
/* 1900Hz noise is what a phone reproduces of a snare; the body underneath is
   for headphones and is deliberately half the gain.
   THE BODY IS TUNED NOW. It was a hardcoded 196Hz on every level — G3, which
   is the VII in A minor and sits in key there for the obvious reason that A
   minor is the key it was picked in. It is not in key anywhere else, and on
   EVENT HORIZON it is a semitone above the tonic chord's own third, which is
   the one level a good player spends twenty minutes inside. The interval was
   what was wanted, so the interval is what is stored: a minor seventh over
   whatever the level's tonic is. 110 * 2^(10/12) is 196.0, so level 1's snare
   is unchanged to the cycle and the other three stop rubbing. */
function snare(t,g,wet){
  hat(t,g,1900,0.17,wet);
  note(CH[0][0]*1.7818,t,0.085,'triangle',g*0.5,900,0);
}
/* THE BASS VOICE: the drop's floor as an instrument — a saw growl a
   speaker can hear, a sine sub for headphones, a square glint for a phone.
   note()'s own closing filter is the envelope, so every hit moves. */
function bassN(f,t,dur,g){
  note(f,t,dur,'sawtooth',g*0.8,900,0);
  note(f/2,t,dur,'sine',g,320,0);
  note(f*2,t,dur*0.6,'square',g*0.30,1600,0);
}
/* THE CINEMA (playtest: "tailor the electro to be more cinematic — like
   it's in a movie"; the reference was trailer-score houses). Two voices
   carry it: a string-section SWELL — detuned saws with a slow bowed attack
   and a filter that opens and closes like breath — and a noise RISER that
   turns a phrase the way a reverse cymbal turns a scene. Both go to the
   reverb send much wetter than anything else in the game: the room is the
   cinema. */
function swellPad(f,t,dur,g,pan){
  if(!A||!AC||muted)return;
  try{
    const v=AC.createGain(),lp=AC.createBiquadFilter();
    lp.type='lowpass';lp.frequency.setValueAtTime(900,t);
    lp.frequency.linearRampToValueAtTime(2200,t+dur*0.5);
    lp.frequency.exponentialRampToValueAtTime(500,t+dur);
    v.gain.setValueAtTime(0.0001,t);
    v.gain.linearRampToValueAtTime(g,t+dur*0.4);
    v.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const mk=function(ff,det){const o=AC.createOscillator();o.type='sawtooth';
      o.frequency.setValueAtTime(ff,t);if(det)o.detune.value=det;
      o.connect(lp);o.start(t);o.stop(t+dur+0.05);};
    mk(f,-6);mk(f,6);
    lp.connect(v);
    let tail=v;
    if(pan&&AC.createStereoPanner){const sp=AC.createStereoPanner();sp.pan.value=pan;v.connect(sp);tail=sp;}
    tail.connect(A.bed);
    const sg=AC.createGain();sg.gain.value=0.7;tail.connect(sg);sg.connect(A.send);
  }catch(e){}
}
function riser(t,dur,g,hz){
  if(!A||!AC||!NOISE||muted)return;
  try{
    const sc=AC.createBufferSource(),v=AC.createGain(),hp=AC.createBiquadFilter();
    sc.buffer=NOISE;sc.loop=true;
    hp.type='highpass';hp.frequency.setValueAtTime(hz||1600,t);
    hp.frequency.exponentialRampToValueAtTime((hz||1600)*3,t+dur);
    v.gain.setValueAtTime(0.0001,t);
    v.gain.exponentialRampToValueAtTime(g,t+dur*0.92);
    v.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.06);
    sc.connect(hp);hp.connect(v);v.connect(A.bed);
    const sg=AC.createGain();sg.gain.value=0.5;v.connect(sg);sg.connect(A.send);
    sc.start(t);sc.stop(t+dur+0.1);
  }catch(e){}
}
/* THE SECTION'S VOICE. Square alone at 1.3kHz for fifteen minutes is an ice
   pick; the triangle gives it a body at the same perceived loudness. */
function lead(f,t,dur,g,cut,pan){
  note(f,t,dur,'square',  g*0.62,cut,     pan);
  note(f,t,dur,'triangle',g*0.55,cut*0.7, pan);
}
/* THE GUITAR. A detuned saw pair plus the fifth, driven into a hard clip —
   by level ten the stars have become a stage amp (the playtest spec,
   verbatim: "level ten they're different electric guitar sounds"). The
   short slide into the pitch is the hammer-on; the shared curve is computed
   once, so a note costs what note() costs. */
const DIST=(function(){const n=512,c=new Float32Array(n);
  for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(x*5)/Math.tanh(5);}
  return c;})();
function gtr(f,t,dur,g,pan){
  if(!A||!AC||muted)return;
  try{
    const ws=AC.createWaveShaper();ws.curve=DIST;ws.oversample='2x';
    const pre=AC.createGain();pre.gain.value=2.2;
    const lp=AC.createBiquadFilter();lp.type='lowpass';
    lp.frequency.setValueAtTime(3400,t);
    lp.frequency.exponentialRampToValueAtTime(1200,t+dur);
    const v=AC.createGain();
    v.gain.setValueAtTime(0.0001,t);
    v.gain.exponentialRampToValueAtTime(g,t+0.010);
    v.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const osc=function(ff,det){
      const o=AC.createOscillator();o.type='sawtooth';
      o.frequency.setValueAtTime(ff*0.97,t);
      o.frequency.exponentialRampToValueAtTime(ff,t+0.035);
      if(det)o.detune.value=det;
      o.connect(pre);o.start(t);o.stop(t+dur+0.02);
    };
    osc(f,0);osc(f,-9);osc(f*1.5,5);        /* the power chord's fifth */
    pre.connect(ws);ws.connect(lp);lp.connect(v);
    let tail=v;
    if(pan&&AC.createStereoPanner){const sp=AC.createStereoPanner();sp.pan.value=pan;v.connect(sp);tail=sp;}
    tail.connect(A.bed);
    const sg=AC.createGain();sg.gain.value=0.4;tail.connect(sg);sg.connect(A.send);
    if(A.dly){const eg=AC.createGain();eg.gain.value=0.3;tail.connect(eg);eg.connect(A.dly);}
  }catch(e){}
}
/* ---------- the drop ----------
   A rise, a SILENCE, and the hit — and the third is the one that was missing.
   Measured on the shipped build, the "hush" was -0.1dB against an ordinary bar:
   musicStep's `if(hush)return` stopped SCHEDULING notes, but the pad is a bank
   of continuously running oscillators whose gain lives in bedTick, so it played
   straight through and filled the hole completely. The riser hat also sat above
   the guard and fired at the loudest gain of any hat in the game, inside the
   silence. The drop then landed +2.9dB on a phone speaker — barely the
   threshold at which a human notices a level change at all.

   None of that is fixed by turning the drop up; peak was already 0.97. It is
   fixed by taking everything else away first. Loudness by contrast is free. */
const DROPQ=[];
/* SAY WHY. Arming used to set a flag and produce no feedback whatsoever — no
   sound, no text, no HUD change — and the drop then landed up to nine seconds
   later. A player could earn one, hear it arrive, and have no way to connect
   the two. The reason is now named on screen at the instant it is earned, and
   the run-up is drawn, so the whole chain from cause to payoff is visible. */
/* EARNING ALWAYS COUNTS. Measured over a five-minute run, twenty drops were
   earned and fifteen were thrown away by the cooldown — so the cooldown, not
   the player, was deciding when a drop happened. That is a timer wearing an
   achievement's clothes.
   Nothing is discarded now. Earn one while a section is playing, or inside the
   gap after it, and it is BANKED: it fires the moment the music is free. The
   only thing the cooldown still does is stop two sections overlapping, which
   is a musical constraint rather than a rationing one. What keeps drops
   special is that they are hard to earn, not that they are hard to receive. */
/* THE BUILD. Three discrete triggers were the wrong shape: each one named a
   single behaviour, so a player who navigated by HOPPING BETWEEN RINGS — a
   perfectly good style that avoids tapping altogether — matched none of them
   and earned nothing at all. And a build-up that arrives as a threshold you
   cross invisibly is not a build-up; it is a lottery result.
   One meter now, filled by everything the game considers playing well:
   gathering sparks, hopping tracks, landing taps in time, and closing orbits.
   It is on screen the whole time, so the answer to "how am I causing this" is
   simply visible. It also decays, so it measures how you are playing NOW
   rather than how long you have been alive. */
const BUILD_SRC={ember:'GATHERING SPARKS',hop:'WORKING THE RINGS',
                 time:'PLAYING IN TIME',orbit:'CLEAN ORBITS'};
/* ---------- WHAT A DROP COSTS, AND WHY IT GOES UP ----------
   THE PAYOFF WAS 41% OF EVERY BAR IN THE GAME. Measured, not guessed: six
   minutes of natural play — a bot that hops, taps on the beat and survives,
   with nothing force-fed — divided into 33% verse, 26% chorus and 41% payoff
   hook, with a drop every 34.6 seconds and a modal gap of exactly 34.6s. That
   flatness is the diagnosis. 34.6s is PAYLEN + PAYREST + the rise, so the
   meter was full every single time the cooldown lifted and the ONLY thing
   gating the biggest moment in the game was its own cooldown. The owner's
   report was "the beat drop happens too frequently and the sound is
   repetitive and annoying", and both halves were the same bug: the section
   the entire arrangement exists to set up was the most-heard music in it.

   THE FIRST DROP OF A RUN IS A GIFT; THE REST ARE EARNED. A flat, much higher
   threshold would have fixed the share and broken the opening — most runs are
   short, and a player who never hears a drop at all has lost the feature
   rather than had it rationed. So the cost escalates within a run and stops
   escalating quickly: drop 1 at 1.0, then +0.8 each, capped at 4.2. Drop one
   still lands around 30 seconds in, exactly as it always did, and the steady
   state moves out past a minute.
   HAIRTRIG scales the whole curve rather than subtracting from its base. As a
   flat -0.15 it was worth 15% of the first drop and 5% of the fourth, which is
   an upgrade that quietly retires itself over a run; as a multiplier it is
   worth the same 15% forever. */
/* Three fed orbits earn a tangible reward. Ordinary taps never change jobs. */
const DROP_STEP=0, DROP_STEP_MAX=0;
function dropNeed(){return upgOn('hairtrig')?2:3;}
function starfallActive(){return !!(G.starfall&&G.starfall.left>0);}
function build(amount,src){
  if(G.state!=='playing'||G.intro||LAB.on||bhActive()||FIN.on||starfallActive())return;
  // Only a completed star-fed orbit qualifies; near-miss calls are smaller.
  if(src!=='orbit'||amount<0.04)return;
  G.build=Math.min(dropNeed(),G.build+1);G.buildFx=1;
  if(G.build<dropNeed())return;
  G.build=0;G.dropsEarned++;G.sawDrop=true;
  if(MU&&AC&&AC.state==='running')armDrop('STARFALL','orbit');
  else startStarfall();
}
const LAND_WIN=0.29,LAND_PERFECT=0.12;
function tryLand(){} // Retired: a reward never asks for a different tap.
function starfallWave(){
  const sf=G.starfall;if(!sf||sf.wave>=3)return;
  const base=effRing(),near=base===G.nRings-1?Math.max(0,base-1):base+1;
  const world=SKY.mix||skyMix(),planet=world.planet;
  const px=W*.5+planet[0]*H,py=H*.5-planet[1]*H,pr=planet[2]*H;
  const inward=Math.atan2(cy-py,cx-px);
  for(let j=0;j<5&&G.stars.length<30;j++){
    const s={a:(G.angle+G.dir*(0.55+j*0.42)+TAU*4)%TAU,
      ring:j%3===2?near:base,t:0,life:5,starfall:true,wave:sf.wave};
    if(!RM){
      const a=inward+(j-2)*.13+sf.wave*.12;
      const x=px+Math.cos(a)*pr*1.06,y=py+Math.sin(a)*pr*1.06;
      const target=posAt(s.a,radiusOf(s.ring));
      const bend=(40+j*12)*u*G.dir;
      s.flight={x:(x-cx)/u,y:(y-cy)/u,cx:((x+target[0])/2-cx+bend)/u,
        cy:((y+target[1])/2-cy-48*u)/u,delay:j*.065,duration:.68+j*.045};
    }
    G.stars.push(s);
  }
  sf.wave++;
}
function startStarfall(){
  if(G.state!=='playing'||G.intro||bhActive()||starfallActive())return;
  G.starfall={left:PAYLEN,total:PAYLEN,next:PAYLEN/3,wave:0,got:0,score:0,
    scoreStart:G.score,embersStart:G.embers};
  G.starfallResult=null;G.armFx=null;G.landFx=null;G.secFx=null;G.sayFx=null;
  G.teach=0;G.teachHint=null;G.teachSoft=false;
  G.invuln=Math.max(G.invuln,G.t+PAYLEN+0.6);
  novaBlast(cx,cy);starfallWave();scenePulse('drop',3.5);
  G.dropFx=1;
}
function tickStarfall(dt){
  if(!starfallActive()||bhActive()||G.state!=='playing')return;
  const sf=G.starfall;sf.left=Math.max(0,sf.left-dt);sf.next-=dt;
  sf.got=Math.max(0,G.embers-sf.embersStart);sf.score=Math.max(0,G.score-sf.scoreStart);
  // Keep the earned safety when a black-hole detour advanced the run clock.
  G.invuln=Math.max(G.invuln,G.t+sf.left+0.6);
  while(sf.next<=0&&sf.wave<3){starfallWave();sf.next+=sf.total/3;}
  if(sf.left<=0){
    G.starfallResult={at:G.t,got:sf.got,score:sf.score};
    G.spikeT=Math.max(G.spikeT,1.2);G.secFx=null;
  }
}
function armDrop(why,src){
  if(!MU||MU.armed||!AC)return;
  why=why||'STARFALL';
  if(MU.pay>0||MU.rise||AC.currentTime<MU.cool){
    if(!MU.pend){
      MU.pend=why;MU.pendSrc=src||null;G.sawDrop=true;
      G.armFx={why:why,t:0,banked:true};
      /* the earn is HEARD even when banked — quieter, same vocabulary */
      note(PENT[8]*0.5,AC.currentTime,0.26,'square',0.017,3000,-0.2);
      note(PENT[5]*0.5,AC.currentTime,0.20,'square',0.016,3000,0.2);
      gameHaptic('reward',12);
    }
    return;
  }
  MU.armed=true;
  MU.why=why;MU.flavor=src||null;
  G.sawDrop=true;
  G.armFx={why:why,t:0};
  /* The game's biggest promise used to be made in silence — a ripple and a
     buzz. The same two-note stab fireLift uses for a tier unlock, so the
     vocabulary for "something was just earned" stays one thing. */
  note(PENT[8]*0.5,AC.currentTime,0.30,'square',0.028,3000,-0.2);
  note(PENT[5]*0.5,AC.currentTime,0.22,'square',0.026,3000,0.2);
  gameHaptic('reward',18);
}
/* THE RULE THIS WHOLE FEATURE HANGS OFF: every duck writes its own undo at
   schedule time, in the same call. Never rely on a later tick to restore a
   param. AudioParam automation runs on the audio clock independently of JS,
   mute, visibility and game state, so a hole whose recovery is already written
   cannot be stranded by any of them. endSection() is belt and braces here, not
   the mechanism. Do not add a second duck on A.hole without this discipline. */
function schedulePreDrop(tD){
  if(!A||!AC||!BED)return;
  const e=SPB/2,g=A.hole.gain;
  g.cancelScheduledValues(tD-2*e);
  g.setValueAtTime(1,tD-2*e);                  /* pin, so the cancel cannot click */
  g.linearRampToValueAtTime(0.22,tD-1.5*e);    /* the swallow: -13dB in 144ms */
  g.linearRampToValueAtTime(0.05,tD-1*e);      /* -26dB for the last eighth */
  g.setValueAtTime(0.05,tD-0.008);
  g.linearRampToValueAtTime(1,tD);             /* 8ms restore, landing ON the beat */
  MU.hushEnd=tD+0.02;
  MU.landT=0;MU.landDone=1;      /* the instant the player is aiming at */
  /* Linear ramps, not setTargetAtTime: asymptotic curves never arrive and need
     a pin. 8ms rather than a step because 0.05->1 on eight running sawtooths
     clicks; 8ms is under the audibility floor and does not soften the hit.
     0.05 rather than 0, because the 1.6s reverb tail is fed pre-duck and rings
     through — the hole is a hole in the band, not digital silence. */
  const f=BED.lp.frequency;
  f.cancelScheduledValues(tD-2*e);
  f.setValueAtTime(f.value,tD-2*e);
  f.linearRampToValueAtTime(2600,tD-1.5*e);    /* opens through the rise... */
  f.linearRampToValueAtTime(220,tD-1*e);       /* ...then slams for the hole */
  f.setValueAtTime(220,tD-0.008);
  f.linearRampToValueAtTime(1600,tD+0.06);
  MU.lpLock=tD+0.25;
}
function fireDrop(t){
  MU.armed=false;MU.rise=false;
  MU.pay=PAY;MU.payEnd=t+PAYLEN+0.6;MU.payN++;MU.payHits=0;MU.barHits=0;
  MU.cool=t+PAYLEN+PAYREST;
  /* THE EARNED NAME CHANGES THE MUSIC. A TIME drop goes double-time two bars
     early, and the other styles flavour their section in payoffStep — the
     name on the HUD finally has a sound attached. */
  MU.lateAt=MU.flavor==='time'?2:4;
  /* THE CROWN. The ring you fire it from sets how rich the section plays —
     never how much it pays. Depth's reward stays the record itself: an
     inner-ring drop states the hook doubled at the octave with the full
     swing; an outer-ring drop plays it lean. */
  MU.crown=ringOf();
  G.secScore=0;G.secMult=1;
  /* The sub was 1.30s and the single largest gain figure in the drop, at 55Hz
     — a third of the budget spent where the target device reproduces nothing,
     smearing across the first two bars of the hook it exists to introduce.
     Shorter now, and the stabs moved up an octave to pre-echo the hook. */
  /* THE DROP WAS IN THE WRONG KEY ON THREE LEVELS OUT OF FOUR. Every pitch
     below was an absolute literal — 55/110 and 41.2/82.4 and the 110/164.81
     braam are A and E, chosen when A minor was the only key the game had. The
     stabs beside them use PENT and transpose correctly, which is what hid it:
     half of the loudest event in the game followed the level and half of it
     did not. On THE STORM that fixed A natural sounds a semitone against F
     minor's own A flat, at the single moment the arrangement is most exposed.
     Written as intervals over the level's tonic now, which is what was always
     meant — CH[0][0] is 110 on level 1, so level 1 is unchanged. */
  const f=CH[0][0];
  note(subF(f*0.5),t,0.55,'sawtooth',0.045,620);  /* headphone weight only */
  note(f,    t,0.60,'sawtooth',0.055,2600);
  note(PENT[8],t,0.45,'square',0.034,6000,-0.22);
  note(PENT[5],t,0.45,'square',0.034,6000, 0.22);
  hat(t,0.060,2400,0.55,0.55);                    /* the crash, wet */
  /* THE FLOOR DROPS OUT (playtest: "the payoff isn't big enough"). A real
     sub boom under the crash — headphone weight — its octave for the phone
     speaker, and a long dark wash so the hit has a tail instead of an edge.
     The fifth BELOW the tonic, an octave and a fourth down: 2^(-17/12). */
  note(subF(f*0.374577),t,0.90,'sine',0.060,320);
  note(f*0.749154,t,0.70,'triangle',0.050,700);
  hat(t,0.030,900,0.9,0.6);
  /* the braam: a fifth-stack brass bloom swelling out of the impact — the
     trailer-score hit the playtest asked for by name. Tonic and its fifth,
     which is what 110 and 164.81 were. */
  swellPad(f,t,1.4,0.040,0);
  swellPad(f*1.49831,t,1.4,0.030,0.15);
  /* No kick here on purpose. The caller runs payoffStep at this same t and its
     bar 0 fires one — the impact and the section starting are ONE event, and
     scheduling both put two kicks on the same sample. */
  DROPQ.push(t);                                  /* the picture waits for it */
}
/* THE SECTION. Called instead of the ordinary arrangement for eight bars. */
function payoffStep(t,ch,k){
  const n=PAY-MU.pay,pb=n>>3,ps=n&7;
  const late=pb>=2,answer=pb===2||pb===3,w=.68;
  /* Every bar is authored. The answering phrase belongs to the band, never
     to an input mode or to a player who must rescue a silent arrangement. */
  G.payOpen=0;
  if(ps===0)MU.barHits=0;
  const pumpKick=tt=>{
    if(!A)return;
    const pg=A.pump.gain;
    pg.setValueAtTime(1,tt-.002);pg.linearRampToValueAtTime(.70,tt+.02);
    pg.setTargetAtTime(1,tt+.05,.09);
  };
  if(late||ps%2===0)BEATQ.push(t);
  if(ps===0){kick(t,.075*w);pumpKick(t);}
  if(late&&ps===5){kick(t+S16,.050*w);pumpKick(t+S16);}
  if(!late){
    if(pb%2===1&&ps===4)snare(t,.052*w,.45);
    if(ps%2===1)hat(t,.011*w,7200,.055);
    if(pb%2===1&&ps===7)hat(t,.020*w,5200,.22,.30);
  }else{
    if(ps===2||ps===6)snare(t,.048*w,.15);
    hat(t,((ps===0||ps===4)?.021:.014)*w,7200,.05);
    if(k>.35||PLAY.heat>.34||MU.flavor==='hop'||MU.crown>=2)
      hat(t+S16,.009*w,7600,.04);
  }
  if(MU.crown>=1&&!late&&ps%2===0)hat(t+S16,.008*w,8600,.04);
  if(late||ps%2===0){
    note(subF(ch[0]/2),t,.15,'sine',.044*w,240);
    note(ch[0]*2,t,.10,'square',.016*w,1600);
  }
  const sus=MU.flavor==='orbit'?1.7:1;
  if(ps===0||ps===4)note(ch[1],t,(ps?.20:.32)*sus,'triangle',.030*w,700);
  if(!answer&&pb!==7&&(ps===3||ps===5||(MU.flavor==='orbit'&&ps===1))){
    note(ch[2]*2,t,.20*sus,'sawtooth',.020*w,4200,-.26);
    note(ch[3]*2,t,.20*sus,'sawtooth',.020*w,4200,.26);
  }
  if(MU.flavor==='ember'&&pb!==7&&ps%2===0)hat(t+S16,.010*w,9000,.04,.3);
  const pan=pb%2?.30:-.30,gh=(.048+.014*k)*w;
  const alt=MU.payN%2===0&&pb<2,voice=MU.payN%3;
  const li=Math.max(0,Math.min(HOOKL.length-1,(G.level||1)-1));
  const hk=HOOKL[li],hkg=HOOKGL[li],hb=HOOKBL[li],hbg=HOOKBGL[li];
  for(let j=0;j<2;j++){
    const s16=ps*2+j,ix=pb*16+s16;
    const d=answer?ANSWERL[li][(s16+(pb===3?4:0))%16]:alt?hb[pb*16+s16]:hk[ix];
    if(d<0)continue;
    if(!answer&&(s16===3||s16===11)&&PLAY.heat<=.30&&voice!==2)continue;
    const tt=t+j*S16,gap=answer?3:alt?hbg[pb*16+s16]:hkg[ix];
    /* The softer answer changes texture while the complete melody continues.
       Its quiet lower harmony gives the release depth without louder peaks. */
    lead(PENT[d],tt,answer?.34:gap>8?.50:Math.min(.34,.06+.075*gap),
      gh*(answer?.78:1),answer?3500:5200,pan);
    if(answer||voice===1)
      note(PENT[Math.max(0,d-2)],tt,answer?.40:.26,'triangle',gh*.30,2800,-pan);
    if(voice===2||MU.crown>=2)
      note(PENT[Math.min(13,d+5)],tt,.18,'square',gh*(MU.crown>=2?.40:.30),6400,-pan*.5);
    if(late&&k>.30&&!answer&&voice!==1)
      note(PENT[Math.max(0,d-2)],tt,.24,'triangle',gh*.30,3400,-pan);
  }
  MU.pay--;
  if(MU.pay===0&&G.secScore>0)G.secFx={total:G.secScore,t:0};
  if(MU.pay===0)MU.glow=t+16*SPB;
}
/* Clear interrupted phrases through one path. Reward banking is independent
   of the arrangement and survives only while the same run is still playing. */
function endSection(){
  if(!MU)return;
  /* EARNED STAYS EARNED. A drop that was armed or rising but never paid out
     goes back to the bank instead of vanishing — a glance at another app, a
     mute, or a GC stall must not eat the thing the player was promised. A
     section already in flight is not re-banked: that drop was received.
     Death and menu do not bank; a new run always starts clean. */
  const bank=G.state==='playing'?
    (MU.pend||((MU.armed||MU.rise)?(MU.why||'DROP EARNED'):null)):null;
  const bankSrc=G.state==='playing'?(MU.pend?MU.pendSrc:MU.flavor):null;
  MU.pay=0;MU.payEnd=0;MU.payHits=0;MU.barHits=0;
  MU.armed=false;MU.rise=false;MU.riseI=0;MU.lpLock=0;MU.hushEnd=0;MU.liftEnd=0;
  MU.pend=bank;MU.pendSrc=bank?bankSrc:null;MU.flavor=null;MU.lateAt=4;MU.crown=0;
  MU.landT=0;MU.landDone=0;
  MU.brk=0;MU.brkEnd=false;MU.brkCool=0;MU.glow=0;
  MU.orbitTone=null;
  LOOP.pat=null;LOOP.n=0;LOOP.until=0;LOOP.heard=false;LOOPQ.length=0;
  PLAY.tape.length=0;PLAY.slot=-1;PLAY.idx=0;
  G.loopFx=0;G.odBrk=false;
  G.pay=0;G.payOpen=0;
  if(A&&AC){const t=AC.currentTime;
    A.hole.gain.cancelScheduledValues(t);
    A.hole.gain.setTargetAtTime(1,t,0.04);
    A.pump.gain.cancelScheduledValues(t);
    A.pump.gain.setTargetAtTime(1,t,0.04);}
  if(BED&&AC)BED.lp.frequency.cancelScheduledValues(AC.currentTime);
  /* every abnormal path lands back on the verse — a phrase interrupted by a
     lock screen or a death is not resumed, and neither is a section. The
     next seam re-earns the chorus if the play still deserves it. */
  if(MU.sect)applySect(0);
}
/* A tier unlock gets ceremony, not a chorus: 2.3s, no hush, no response bars.
   Handing an 18.5s section with three player bars to someone who has never
   grooved, over a full-screen text banner, reads as the music breaking. */
function fireLift(){
  if(!MU||!AC||MU.pay>0||MU.rise)return;
  const t=AC.currentTime;
  if(t<MU.liftEnd)return;
  MU.liftEnd=t+2*SPB*4;
  hat(t,0.055,3200,0.40,0.45);
  note(PENT[8]*0.5,t,0.40,'square',0.032,3000,-0.2);
  note(PENT[5]*0.5,t,0.40,'square',0.032,3000, 0.2);
  note(CH[0][0],t,0.60,'sawtooth',0.055,900);
}
/* ONE AUTHORED BAR OF DRUMS. The kit walks a descending tom fill without
   changing the player's instrument. The crash back in belongs to musicStep.
   The toms were absolute too: 261.63 / 220 / 174.61 is C4 A3 F3, which is a
   descending III - i - VI in A minor and nothing in particular anywhere else.
   `kf` carries the fill into the level's key while leaving the figure written
   in the A the rest of this file is written in; it is 1 on level 1. */
function breakStep(beat,t){
  const kf=CH[0][0]/110;
  hat(t+S16,0.008,4800,0.035,0,0,7600);  /* a 16th shaker keeps the grid audible */
  if(beat===0)kick(t,0.075);
  if(beat===1)hat(t,0.016,7200,0.05);
  if(beat===2){kick(t,0.050);hat(t,0.012,8000,0.04);}
  if(beat===3)note(261.63*kf,t,0.14,'triangle',0.05,1200,-0.2);
  if(beat===4)snare(t,0.055,0.35);
  if(beat===5)note(220*kf,t,0.14,'triangle',0.05,1100,0.2);
  if(beat===6){snare(t,0.045,0.30);snare(t+S16,0.030,0.30);}
  if(beat===7){snare(t,0.050,0.35);snare(t+S16,0.055,0.40);
    note(174.61*kf,t,0.16,'triangle',0.05,1000,0);}
}
/* Which layers are audible right now. Intensity is the difficulty clock, so
   the arrangement thickens as the run gets harder and a long run genuinely
   sounds different from its opening — which is also the only channel telling
   you that speed has climbed from 1.4 to 4.2 rad/s. */
/* Two brief reward colours, shared by the spacious and driving arrangements. */
function powerColour(t,ch,beat,bar){
  if(G.hyper>0)return;
  if(G.mirror>0&&beat===7&&bar%2===0){
    note(ch[1]*2,t,0.18,'triangle',0.020,1800,-0.48);
    note(ch[1]*2,t+S16,0.16,'triangle',0.016,1500,0.48);
  }
  if(G.scorch>0&&beat===5){
    note(ch[0],t,0.085,'sawtooth',0.018,950,-0.12);
    note(ch[0]*1.49831,t+S16,0.070,'triangle',0.013,1200,0.12);
  }
}
/* The same committed-motion envelopes drive dust, light and musical space.
   Pressure comes from a star-fed route, never from an autonomous volume LFO. */
function orbitMusicState(){
  const f=G.currentFlow||{};
  const active=G.state==='playing'&&!frozen()&&!G.intro&&!bhActive()&&!FIN.on&&
    G.hyper<=0&&G.od<=0&&!(MU&&(MU.pay>0||MU.armed||MU.rise))&&!(f.release>0.05);
  const turn=active?Math.min(1,Math.max(0,f.turn||0)):0;
  const hop=active?Math.min(1,Math.max(0,f.hop||0)):0;
  const q=active&&G.lapEmbers>0?Math.min(1,Math.max(0,G.lapAcc/TAU)):0;
  const streak=active?Math.min(1,Math.max(0,G.lapStreak||0)/3):0;
  return {active:active,q:q,turn:turn,hop:hop,radial:f.radial||0,dir:f.dir||G.dir,
    pressure:Math.min(1,(q*0.65+streak*0.35)*(1-turn*0.8))};
}
/* At most two quiet notes per orbit, only on the accompaniment's quarter-note
   slots. Completed-orbit fanfares already own the resolution; do not double it. */
function orbitColour(t,ch,beat,state){
  if(!MU||!AC||AC.state!=='running')return false;
  if(!state.active){MU.orbitTone=null;return false;}
  let memo=MU.orbitTone;
  if(!memo||memo.lap!==G.orbits||memo.dir!==G.dir||memo.run!==G.started)
    memo=MU.orbitTone={lap:G.orbits,dir:G.dir,run:G.started,mark:0,next:t};
  const mark=state.q>=2/3?2:state.q>=1/3?1:0;
  if(mark===0){memo.mark=0;return false;}
  if((beat!==2&&beat!==6)||mark<=memo.mark||t<memo.next)return false;
  memo.mark=mark;memo.next=t+SPB*1.5;
  note(ch[mark===1?2:3]*2,t,0.46,'triangle',0.024,1800+900*state.pressure,
    state.dir*0.24,undefined,0.36);
  return true;
}
function musicStep(i,t,k){
  const bar=(i/8)|0,beat=i%8;
  /* THE SONG MOVES BETWEEN ITS SECTIONS HERE, and only here: once per
     four-bar loop, at the seam, when nothing else owns the harmony. Hot
     play — an earned state, a groove chain, real heat — lifts the record
     into its chorus (see PROGB); cooling off hands it back. The afterglow
     term means every payoff RESOLVES into the chorus, so the drop is also
     the guaranteed road in: a player who never chains still hears the
     section, the same worst-case promise the drop itself makes. Frozen
     while a drop is anywhere in flight (the payoff owns its eight bars),
     and the first eight bars of a level are always the verse — the song
     states its home before it leaves it. */
  /* THE LIFT IS STILL EARNED; WHAT CHANGED IS WHICH EARNING COUNTS AND HOW
     LONG IT LASTS. Making the drop rarer took the chorus down with it —
     measured over six minutes of natural play, chorus bars fell from 26% to
     10% and the verse rose to 62% — because `t<MU.glow`, the payoff
     afterglow, was quietly doing almost all the work. Trading "the payoff
     hook over and over" for "the verse loop over and over" is the same
     complaint one table along.
     The first fix tried was a form clock that lifted the record on its own
     after sixteen bars, and musiccheck rejected it in one line: "the chorus
     engaged at heat 0 — the lift is free". It was right. A chorus nobody
     earns is wallpaper, and the harness holds that at heat 0 a level voices
     its verse row and nothing else, forever. So the clock is gone.
     Two changes instead, and neither hands anything out. G.lapStreak joins
     the hot set: a clean orbit is the other thing this game measures skill
     with, it is SUSTAINABLE where PLAY.heat is not (heat is +0.26 a tap
     against 0.34/s of decay, so it spikes and collapses — only frantic input
     holds it, which is the exact behaviour the saucer exists to discourage),
     and it means the player who travels rather than the player who mashes
     gets the song. And the chorus now HOLDS for twelve bars after the hot
     state lapses instead of settling at the next seam, so an earned lift
     lasts long enough to be a section rather than a flicker.
     Entry is unchanged in kind: cold play never lifts, which is what the
     harness checks and what keeps the section worth arriving at. */
  if(i===0&&MU.pay<=0&&!MU.rise&&!MU.armed&&!FIN.on&&!bhActive()&&MU.barN>=8){
    const hotSect=(G.od>0||G.hyper>0||t<MU.glow||G.groove>=4||G.lapStreak>=2||
                   PLAY.heat>0.50);
    let wantB=MU.sect;
    if(hotSect)wantB=1;
    else if(MU.sect&&MU.barN-MU.sectAt>=CHOR_HOLD)wantB=0;
    if(wantB!==MU.sect){
      applySect(wantB);
      MU.sectAt=MU.barN;
      if(wantB&&G.state==='playing'){
        G.chorusN++;
        /* name — gloss, the say channel's one grammar ("SCORCH — your wake
           burns"); this had them swapped, the only line in the channel that did */
        G.saidChor=true;
      }
    }
  }
  const cix=chI(bar),ch=CH[cix];
  /* The retune moved to the TOP, before any return: the pad keeps tracking the
     progression while it is ducked and through the whole payoff, so it comes
     back in tune rather than glissing into place. MU.chord tracks the BAR,
     not the pitch — a section swap retunes at its first bar line because the
     ordinal moved, and the L2 chorus's repeated tonic bar retunes to the same
     four frequencies, which is a no-op by value. */
  if(MU.chord!==bar%4){
    MU.chord=bar%4;
    for(let v=0;v<4;v++)for(let u2=0;u2<2;u2++)
      BED.oscs[v*2+u2].frequency.setTargetAtTime(ch[v],t,0.09);
  }
  if(beat===0)MU.barN++;
  /* THE BLACK HOLE OUTRANKS EVERYTHING, including a payoff section already in
     flight. Placed after the chord retune so the pad keeps tracking the
     progression silently underneath and returns in tune, exactly as it does
     through the payoff — the same reason that retune sits above every return. */
  if(bhActive()){bhStep(t);return;}
  if(MU.pay>0){payoffStep(t,ch,k);return;}
  // Start the earned reward on the next quarter beat, with no timing exam.
  if(MU.armed&&i%2===0){
    G.od=0;G.odBrk=false;fireDrop(t);payoffStep(t,ch,k);return;
  }
  const rn=-1,rise=false;
  /* the star dive is a composed setpiece: it walks the level's own verse
     home, whatever section the run had earned when the finish line hit.
     The revert RE-RETUNES in place, and that second write is load-bearing:
     this latch sits BELOW the bar retune, which has already scheduled the
     chorus chord at this same t, and applySect touches tables, never
     oscillators — so without it the dive's entire first bar (2.3s) sounded
     over the chorus chord while the comment above claimed otherwise. Same
     t, later write wins; nothing sounds twice. */
  if(FIN.on&&FIN.pend&&i%16===0){FIN.pend=false;FIN.step=0;
    if(MU.sect){applySect(0);
      for(let v=0;v<4;v++)for(let u2=0;u2<2;u2++)
        BED.oscs[v*2+u2].frequency.setTargetAtTime(CH[chI(bar)][v],t,0.09);}}
  if(FIN.on&&!FIN.pend){finStep(t);return;}
  /* chorus_bars counts bars the chorus ARRANGEMENT actually owns, which is
     why it sits HERE, below every handoff, and not beside barN at the top:
     the flag stays frozen through a black hole (band halted) and a payoff
     (the section's eight bars), and the flag-only counter overstated the
     telemetry by exactly those bars. The first below-the-flag version sat
     above the returns and still counted two transition bars — the bar the
     drop LANDS on (fireDrop runs later in the same step) and the star
     dive's latch bar (finStep runs later in the same step). A bar that
     reaches this line is the ordinary arrangement's: armed, rising or
     plain, the pad is voicing the chorus through all of them. */
  if(beat===0&&MU.sect)G.chorusBars++;
  if(beat%2===0)BEATQ.push(t);          /* quarter notes, for the visual pulse */
  /* A brief automatic drum fill varies sustained engaged play. It never
     remaps an input or requests one. Releases retain priority. */
  if(beat===0&&MU.brk<=0&&!MU.armed&&!MU.rise&&!MU.pend&&
     (G.odBrk||(PLAY.heat>0.55&&G.od<=0&&k>0.22&&t>=MU.brkCool))){
    MU.brk=8;MU.brkN++;MU.brkCool=t+30;G.odBrk=false;
    duckBed(0.5,0.9);
  }
  if(MU.brk>0){
    breakStep(beat,t);
    MU.brk--;if(MU.brk<=0)MU.brkEnd=true;
    return;
  }
  /* The cymbal returns the arrangement; an automatic fill earns no visual hit. */
  if(MU.brkEnd){MU.brkEnd=false;hat(t,0.055,2600,0.5,0.5);}
  if(rise){
    /* THE RISE, AND NOTHING ELSE. It measured -19.8dB against an ordinary
       bar's -19.6 because the arp, counter-line and root kept playing
       underneath it. The return is the entire fix. */
    const n=rn,q=n/16;
    if(n<14){                            /* eighths 14 and 15 are the hole */
      note(PENT[Math.min(9,1+Math.round(n*0.62))],t,0.15,'sawtooth',
        0.014+0.041*q,700+7300*q,n%2?0.22:-0.22);
      /* a HIGHPASS sweep: all the tension, no low end, so it costs the
         limiter nothing at the moment the drop needs the headroom */
      hat(t,0.006+0.032*q,1200+6400*q,0.10,0.20);
      if(n===0)note(CH[0][0],t,0.42,'triangle',0.075,900);
      if(n>=10&&n<14){
        snare(t,0.018+0.024*q,0.25);snare(t+S16,0.020+0.026*q,0.25);
      }
    }
    return;
  }
  /* THE ARMED WAIT LEANS FORWARD. Between earning a drop and the rise there
     can be nine silent seconds of unchanged music; a sixteenth shaker fading
     in says "something is coming" the whole way. Capped near the riser hat's
     own floor so the rise still arrives as an event. */
  if(MU.armed&&!MU.rise){
    const w8=(8-i%8)%8;                          /* eighths until the latch */
    hat(t,Math.min(0.008,0.003+0.005*(1-w8/8)),4600,0.04,0,0,7400);
  }
  /* overdrive and the payoff's afterglow hold open every gate the clock or
     the heat could — see G.od and MU.glow */
  const hot=G.od>0||G.hyper>0||t<MU.glow;
  const orbit=orbitMusicState(),orbitNote=orbitColour(t,ch,beat,orbit);
  /* Open space is a real arrangement, not the busy one turned down. Each
     world keeps its chord walk and arp contour; bass phrases remember its
     rhythmic identity in a few separated notes. The player opens the engine
     by moving inward, finding the beat, or earning a sustained passage. */
  const driving=hot||MU.sect||G.groove>=3||G.lapStreak>=2||PLAY.heat>0.45||ringOf()>0;
  if(!driving){
    const calls=[[0,5],[1,6],[0,4],[0,6],[0,3,6],[0,6]];
    const phrase=calls[Math.min(calls.length-1,G.level-1)];
    if(beat===0)kick(t,0.035);
    const at=phrase.indexOf(beat);
    if(at>=0){
      const f=G.level>=4&&at>0?ch[1]:at>0?ch[3]/2:ch[0];
      bassN(f,t,0.24,0.026);
    }
    if(beat===2&&!orbitNote){
      const d=ARP[(i+bar)%ARP.length];
      note(PENT[d]*0.5,t,SPB*1.6,'triangle',0.028,1700,bar%2?-0.28:0.28,undefined,0.42);
    }
    if(beat===0&&bar%2===1)swellPad(ch[2],t,SPB*3.2,0.020,-0.15);
    powerColour(t,ch,beat,bar);
    return;
  }
  /* The root was the loudest figure in the loop and a phone reproduced almost
     none of it: 110Hz on a TRIANGLE (harmonics fall as 1/n²) through a 900Hz
     lowpass leaves the 3rd at 330Hz, under the rolloff. Two voices now — the
     sub for headphones, and a real one two octaves up that a speaker can play. */
  /* the root is the sub's job alone — its bright octave double is gone;
     bassN's square glint already gives the speaker its handle, and two
     voices saying "root" every bar was the start of the mud */
  if(beat===0||beat===6)
    note(ch[0],t,beat===0?0.42:0.22,'triangle',0.055,900);
  /* THE HEARTBEAT (playtest, final round: "the drop hits — literally
     nothing else does"). Measured on the master bus, ordinary play peaked
     4.7dB under the section, and the cause was structural: the kit only
     assembled as you dove inward, so the DEFAULT ring had no kick at all.
     Ring 0 now carries one kick per bar from the start and a second at
     half band; the inner rings still stack their patterns on top — inner
     stays hotter, but nowhere is silent any more. */
  if(ringOf()===0){
    if(beat===0)kick(t,0.050);
    if((k>0.30||PLAY.heat>0.35||hot)&&beat===4)kick(t,0.038);
  }
  /* THE RECORD BREATHES ALL GAME. The payoff's sidechain pump — the
     genre's inhale — now runs gently under ordinary play too: every
     bar-line kick dips the band ~1.5dB and lets it back. Dip and recovery
     written in the same call, per the pump's own discipline; the player's
     perf bus bypasses it, so your own notes stand still. */
  if(beat===0&&A){
    const pg=A.pump.gain;
    pg.setValueAtTime(1,t-0.002);
    /* the chorus inhales deeper — the pump is most of what "the record
       lifted" feels like on a phone speaker, where the harmony is subtle */
    pg.linearRampToValueAtTime(MU.sect?0.80:0.84,t+0.02);
    pg.setTargetAtTime(1,t+0.05,0.11);
  }
  /* THE BASS IS A SYNTH NOW. The polite triangle floor never registered
     next to the section's saw-and-sub, so the section was the only thing
     that ever hit. bassN() walks root / push / fifth / approach from
     almost the first bar, swelling with the run and the playing. */
  if(k>0.12||PLAY.heat>0.20||hot){
    const bg=0.026+0.020*Math.min(1,k+0.3*PLAY.heat);
    /* the whaa: a saw swell breathing out of every bar-line bass note —
       the drop's mouth, speaking continuously once the run warms up */
    if(beat===0){bassN(ch[0],t,0.30,bg);
      /* the whaa breathes on EVEN bars; the strings answer on the odd
         ones — call and response instead of a pile on every downbeat */
      if((k>0.35||hot)&&bar%2===0)swellPad(ch[0],t,0.55,0.026+0.016*k,0);}
    /* EACH LEVEL HAS ITS OWN BASSLINE. L1 walks, L2 pushes off the beat (the
       swung deep-house lean), L3 ROLLS relentless eighths, L4 jumps the
       octave. This used to be the largest single difference between the
       songs, back when all four walked the same chords in different keys;
       the progressions differ now too, so it is one of several. */
    if(MU.sect&&G.level<=2){
      /* THE CHORUS BASS DRIVES. Levels 1 and 2 walk sparse verse figures;
         when the song lifts they switch to the genre's engine — root
         eighths leaning legato, one approach note into the turn. Levels 3
         and 4 keep their own figures: they already drive, and the roll and
         the octave jump ARE those levels' identities. */
      bassN(ch[0],t,beat%2?0.11:0.15,bg*(beat===0?1:(beat%2?0.55:0.75)));
      if(beat===6)bassN(ch[3]/2,t+S16,0.12,bg*0.60);
    }else if(G.level===1){
      if(beat===2)bassN(ch[0],t+S16,0.16,bg*0.80);
      if(beat===5)bassN(ch[3]/2,t,0.18,bg*0.85);
      if(beat===7)bassN(ch[0]*0.75,t+S16,0.12,bg*0.70);
      if((k>0.5||PLAY.heat>0.5||hot)&&(beat===1||beat===3||beat===6))
        bassN(ch[0],t,0.11,bg*0.45);
    }else if(G.level===2){
      if(beat===1)bassN(ch[0],t+S16,0.13,bg*0.65);
      if(beat===3)bassN(ch[2]/2,t,0.17,bg*0.85);
      if(beat===4)bassN(ch[0],t+S16,0.11,bg*0.55);
      if(beat===6)bassN(ch[3]/2,t+S16,0.15,bg*0.80);
    }else if(G.level===3){
      bassN(ch[0],t,beat%2?0.10:0.15,bg*(beat===0?1:(beat%2?0.5:0.72)));
      if(beat===4)bassN(ch[2]/2,t,0.14,bg*0.80);
      if(beat===7)bassN(ch[1]/2,t+S16,0.10,bg*0.55);
    }else if(G.level===4){
      /* L4 JUMPS THE OCTAVE. Level 4 had no bassline of its own: the branch
         above caught it, so the endless level — the one good players spend
         most of a session inside — was the only level whose bottom end was
         second-hand. It alternates root and octave on the eighths now, the
         oldest bass figure the genre has. bassN puts a sine an octave under
         whatever it is handed, so the weight never leaves the floor while the
         audible fundamental keeps stepping up and back down. */
      bassN(beat%2?ch[1]:ch[0],t,0.11,bg*(beat===0?1:(beat%2?0.62:0.80)));
      if(beat===6)bassN(ch[3]/2,t+S16,0.12,bg*0.62);
    }else if(G.level===5){
      /* L5 PUSHES THE 3+3+2. Every other bassline in the game is symmetrical
         — walked, offbeat, rolled or octave-jumped, all of them even. This
         one lands on eighths 0, 3 and 6, which is the same accent grammar the
         payoff hook has used on every level since it was written. REDSHIFT is
         the level where the bass and the hook finally agree about where the
         bar leans, so the whole level pulls in one direction. */
      if(beat===3)bassN(ch[0],t,0.15,bg*0.78);
      if(beat===6)bassN(ch[1],t,0.13,bg*0.70);
      if(beat===7)bassN(ch[3]/2,t+S16,0.10,bg*0.50);
    }else{
      /* L6 RIDES THE OCTAVE, AND THAT IS A FIX RATHER THAN A FLOURISH. Its
         tonic is 61.74Hz, the lowest root in the game, and a bassline sitting
         on it for a whole bar would give the level people spend the most time
         inside the thinnest audible bottom end of the six — a phone speaker
         reproduces almost nothing of a 62Hz fundamental. So the low root
         sounds on the downbeat for weight (the beat===0 line above already
         fires it) and every other eighth is ch[1], an octave up, where the
         note is actually heard. Relentless rather than sparse: the hook is
         the thing running down on this level, and the engine under it is not. */
      bassN(ch[1],t,beat%2?0.09:0.13,bg*(beat%2?0.48:0.68));
      if(beat===6)bassN(ch[2]/2,t+S16,0.11,bg*0.55);
    }
  }
  /* THE SOLO (playtest: "some keyboard solos"). After every payoff the lead
     answers over the afterglow: a written phrase with a slide into each
     note, running wet through the dub delay. The drop no longer ends —
     it hands off. */
  if(t<MU.glow){
    const sd=SOLOL[G.level-1][i%32];
    if(sd>=0){
      const sdc=Math.min(8,sd);           /* the solo sings, it does not shriek */
      note(PENT[sdc],t,0.20,'sawtooth',0.026,2600,(i%16<8)?-0.25:0.25,undefined,0.6);
      if(AC)beep(PENT[sdc]*0.96,0.05,'sawtooth',0.010,PENT[sdc],Math.max(0,t-AC.currentTime),0,0.2);
    }
  }
  /* THE MACHINE OWNS THE BEAT; THE PLAYER OWNS THE OFFBEAT. The arp is pinned
     to even eighths at every difficulty — the old ||k>0.62 filled every slot
     late in a run, which is exactly when the player is working hardest, and
     put the band's square on top of the player's note in the same register. */
  const ad=ARP[(i+bar)%ARP.length];
  /* THE STARS CHANGE VOICE AS YOU CLIMB (Hunter's idea): one instrument
     early, a detuned synth pair by level 4, a sawtooth lead by level 7 —
     same key, same degrees, a band that grows up with the run. And heat can
     open every layer the clock would: playing hard means hearing more NOW. */
  const av=G.tier>=T_VOICE[2]?'sawtooth':'square';
  if(!orbitNote&&(k>0.18||PLAY.heat>0.30||hot)&&beat%2===0){
    /* AN OCTAVE DOWN — and ONE tenant per band: when the riff layer
       unlocks it REPLACES the arp in this register instead of stacking on
       it. The arrangement evolves; it does not accumulate. */
    if(G.score<LAYER_AT[1]){
      note(PENT[ad]*0.5,t,0.22,av,0.022+0.013*k,700+900*k,
        (beat%4===0?-0.3:0.3),undefined,0.35);
      note(PENT[ad]*0.503,t,0.22,'sawtooth',0.013+0.007*k,650+800*k,
        (beat%4===0?0.3:-0.3),undefined,0.35);
    }
  }
  /* the old "drive" doubling layer is deleted outright: the deep genres are
     built from a LIMITED palette — kick, bass, one offbeat hat, one or two
     tonal layers — and this was a second bright square adding nothing but
     sparkle on top of the arp. Subtraction is the genre. */
  /* The chain opens the arrangement as it climbs, and the counter-line DROPS
     OUT at x7 — taking a layer away near the top is what makes the last two
     links feel like a held breath rather than just more music. */
  const gv=Math.max(0,G.groove-4);
  if((k>0.45||gv>0||hot)&&(beat===2||beat===6))hat(t,0.016+0.008*k+0.004*gv,4200,0.05,0,0.35,7000);
  /* THE RING IS THE KIT. Subdivision alone was too polite — the hats sat at
     0.008 and the "inner is hotter" promise was inaudible on the device this
     ships to. Pattern reads louder than gain, so each ring now has a
     rhythmic identity: the outer rides clean, the MID ring gains a half-time
     kick and a low fifth leaning into the turn, and the INNER ring runs a
     four-on-the-floor with a moving octave bass. Hop inward and a drum kit
     assembles under you; hop out and it breathes away. Same 104bpm, same
     key — only how much engine is running. */
  const rg2=ringOf(),rs=RINGS[rg2].sub;
  if(rg2>=1){
    if(beat===0)kick(t,0.042);
    if(beat===4)kick(t,0.034);
    if(beat===3)note(ch[3]/2,t,0.18,'triangle',0.020,900);
    if(beat===6)note(ch[0]*2,t,0.10,'square',0.010,2200,0);
  }
  if(rg2>=2){
    if(beat===2||beat===6)kick(t,0.036);
    if(beat%2===1)note(ch[0]*2,t,0.12,'square',0.013,2400,0);
  }
  /* THE offbeat shaker — dry, dark, and echoed in time: the one hat the
     genre keeps */
  if(rs>=1&&beat%2===1)hat(t,0.011,4000,0.038,0,0.35,6800);
  if(rs>=2&&beat%2===0){
    hat(t+S16,0.008,4400,0.032,0,0,7200);
    hat(t+S16*1.16,0.004,4800,0.03,0,0,7400);   /* the inner ring swings, as ghosts */
  }
  /* THE SCORE SWELLS. Strings breathe in on every other bar line and a
     soft riser turns each four-bar phrase into the next — the two moves
     trailer music is built from, at game volume. The swell sits on the
     chord's third, so the harmony is finally VOICED rather than implied. */
  if((k>0.20||PLAY.heat>0.30||hot)&&beat===0&&bar%2===1)
    swellPad(bar%4===1?ch[2]*2:ch[3]*2,t,2.6,0.024+0.014*k,(bar%4<2)?-0.2:0.2);
  if((k>0.5||hot)&&bar%4===3&&beat===4)riser(t,2*SPB,0.016,1600);
  /* EACH LEVEL IS ITS OWN SONG: key, chord SHAPE, arp, bassline, riff, solo
     and payoff hook all swap at startGame (the bed retunes itself from CH),
     and every level past the first has a kit identity — L2 swings with a soft
     clap lean, L3 drives four-on-the-floor with an offbeat hat everywhere, L4
     rides an open offbeat hat and doubles the floor. L1 is the reference: it
     has no lean because it IS the lean the others are heard against. */
  if(G.level===2){
    if(beat===2||beat===6)hat(t+S16*1.16,0.007,4400,0.03,0,0,7200);
    if(beat===7)hat(t+S16,0.006,4200,0.03,0,0,7000);
    /* ...and in the chorus the backbeat stops waiting for the clock */
    if((k>0.35||hot||MU.sect)&&bar%2===1&&beat===4)snare(t,0.020,0.20);
  }
  if(G.level===3){
    if((beat===2||beat===6)&&ringOf()===0)kick(t,0.032);
    if((k>0.30||hot)&&beat%2===1)hat(t,0.008,4200,0.04,0,0.3,6800);
  }
  if(G.level===4){
    /* AND LEVEL 4 HAD NO KIT EITHER — the branches above stopped at three, so
       the only percussion identity the endless level ever had was whatever
       the ring and the sky band happened to be lending it. It RIDES: the
       offbeat hat is open rather than clipped (a long dark decay into the dub
       delay, where L3's is a short tick), and the floor doubles onto the
       half-beats once the run is warm. The level with no finish line is the
       one that never stops driving. */
    if(beat%2===1)hat(t,0.012,3600,0.15,0,0.35,6400);
    /* rg2<2: the inner-ring kit already owns the 2/6 kick slots (rg2>=2
       above), and two kick oscillators in one timeslot is the doubled-drum
       mud the chorus lean was rewritten to avoid — the level kick yields the
       way L3's does with its ringOf()===0 guard */
    if((k>0.25||hot)&&rg2<2&&(beat===2||beat===6))kick(t,0.030);
    if((k>0.45||hot)&&beat===7)snare(t+S16,0.022,0.28);
  }
  /* L5 PUTS THE 3+3+2 IN THE KIT TOO. Its bassline leans on eighths 0, 3 and
     6; the hats mark the same two offbeats, so the level's asymmetry is
     audible with the bass muted. No kick on 0 and no snare on 4 anywhere in
     here, deliberately: skyI FLOORS at 3 from level 4 onward and band 3
     already owns both of those slots, so adding either would be the doubled-
     drum bug the chorus lean was rewritten to avoid. */
  if(G.level===5){
    if(beat===3||beat===6)hat(t,0.009,4600,0.05,0,0.2,7000);
    if((k>0.30||hot)&&beat===2)snare(t,0.016,0.20);
    if(beat===7)hat(t+S16,0.006,5000,0.035,0,0,7400);
  }
  /* L6 RUNS SIXTEENTHS. Level 4 rides an open offbeat hat and level 3 a
     clipped one, so the last level cannot have a hat pattern at all without
     repeating one of them — it has a CONTINUOUS one instead, an eighth-note
     tick with the sixteenth between it once the run is warm. Nothing else in
     the game is that dense, which is the point: HEAT DEATH is the level whose
     kit never lets go, under the sparsest hook of the six. Same slot rules as
     level 5 — the floor doubles on 2 and 6, never on 0. */
  if(G.level===6){
    hat(t,0.008,3800,0.10,0,0.25,6600);
    if(k>0.25||hot)hat(t+S16,0.006,4400,0.055,0,0,7200);
    /* same slot yield as level 4's kick above: the inner-ring kit owns 2/6 */
    if(rg2<2&&(beat===2||beat===6))kick(t,0.032);
  }
  /* THE CHORUS LEAN — the genre's chorus recipe, at this band's scale: the
     open offbeat hat arrives (levels 1-3; level 4 rides one all game, so its
     chorus adds the sixteenth ghost instead), a half-time backbeat lands
     (level 2's own lean already covers it there — see above), and ONE color
     tone a bar: the sounding chord's own seventh (SEVB), sustained an octave
     up. m7 on the minor chords, maj7 on III and VI, and the dominant-shaped
     m7 on VII — the stacked third decides, which is the reference records'
     own voicing split — and the one place extensions live: the arp and
     every riff stay plain pentatonic, per the same records. */
  if(MU.sect){
    /* ONE TENANT PER BAND holds at the seam too. The first version of this
       lean stacked its additions onto voices already playing: the sky is
       FLOORED at G.level-1, so level 4 has carried sky band 3's beat-4
       snare since its first bar — the chorus "backbeat" doubled it, ~+4.6dB
       on one slot, on the level good players live in — and level 3's floor
       is band 2, whose signature IS the open offbeat hat, so "the open hat
       arrives" stacked a third copy over the sky's and the level's own
       tick. The sixteenth ghost is likewise the inner rings' own pattern
       (rs>=2). Each addition now yields wherever its slot already has that
       tenant: the chorus is the harmony moving, never the same drum twice
       as loud. musiccheck runs the harness at each level's sky floor and
       fails on a doubled snare body. */
    /* levels 4-6 all ride an offbeat hat of their own (L4 open, L5 on the
       3+3+2, L6 continuous), so for all three the chorus adds the sixteenth
       ghost instead of a second open hat — the yield rule, applied to the two
       levels that did not exist when it was written */
    if(G.level>=4){if(rs<2&&beat%2===0)hat(t+S16,0.007,4400,0.04,0,0,7200);}
    else if(beat%2===1&&skyI!==2)hat(t,0.010,3800,0.13,0,0.3,6600);
    if(beat===4&&G.level!==2&&skyI!==3)snare(t,0.018,0.20);
    if(beat===0)note(SEVB[G.level-1][cix]*2,t,1.6,'triangle',0.016,1400,(bar%2)?0.22:-0.22);
  }
  /* THE SKY FLAVOURS THE KIT (playtest: "more electro beats"). Each palette
     band the run climbs through puts its own spin on the percussion: band 1
     swings its sixteenths, band 2 rides the classic offbeat open hat, band
     3 leans heavy. Additive only — the ring's identity stays. */
  if(skyI===1&&(k>0.30||PLAY.heat>0.30||hot)&&(beat===2||beat===6))
    hat(t+S16*1.16,0.006,4400,0.035,0,0,7200);
  if(skyI===2&&beat%2===1)hat(t,0.010,3600,0.11,0,0,6500);
  if(skyI===3){
    if(beat===0)kick(t,0.026);
    if(beat===4)snare(t,0.026,0.25);
  }
  /* SCORE BUYS THE BAND (playtest, verbatim: "once a player reaches 2000
     points add a new electro synth layer that maintains until they get 3000
     points where another music layer is added. And so on."). Permanent for
     the run, each named as it arrives — see the layer ladder in update(). */
  if(G.score>=LAYER_AT[0]&&beat%2===0)
    note(ch[0]*2,t+S16,0.10,'square',0.011,1000,beat%4?0.2:-0.2,undefined,0.35);
  if(G.score>=LAYER_AT[1]&&!orbitNote){
    /* the arp's successor — same register, richer tune (see the arp gate) */
    const rd=RIFFL[G.level-1][(bar%2)*8+beat];
    if(rd>=0){
      note(PENT[rd]*0.5,t,0.18,'sawtooth',0.018,1200,(bar%2)?0.24:-0.24,undefined,0.5);
      note(PENT[rd]*0.503,t,0.18,'square',0.010,900,(bar%2)?-0.2:0.2);
    }
  }
  /* the third layer was a SECOND bassline playing a different pattern
     against bassN — the single worst clash in the mix. It is a held sub
     drone now: one voice, one note per bar, pure weight under everything. */
  /* ...and on level 4 it stops following the chord and becomes a PEDAL. That
     level's progression leaves the tonic and returns inside four bars
     (i VI VII i); pinning the sub to the tonic under it is what turns a chord
     loop into a drone with harmony moving over the top, which is the whole
     point of a pedal point. Every other level keeps the bar's own root. */
  if(G.score>=LAYER_AT[2]&&beat===0)
    note(subF((G.level===4?CH[0][0]:ch[0])/2),t,1.5,'triangle',0.020,300,0);
  if(G.score>=LAYER_AT[3]&&beat===7)
    note(PENT[11]*0.5,t+S16,0.22,'sine',0.010,3600,(bar%2)?0.35:-0.35,undefined,0.5);
  /* OVERDRIVE: eight bars of double-time — the eleventh notch. Every gate
     above is already held open (hot); this is the engine note itself. */
  if(G.od>0){
    G.od--;
    hat(t,0.009,4200,0.045,0,0,7000);
    hat(t+S16,0.007,4600,0.04,0,0,7200);
    if(G.od===0){G.odBrk=true;cueState(false);} /* it ends the way a record ends: on the break */
  }
  /* ================= HYPERNOVA: THE STAR RUN =================
     "Like getting a star in Mario, but with our theme." The kit already rode
     sixteenths and the floor already pounded every other beat, and that is a
     TEXTURE change — the same song, busier. What a star does in the game
     everyone means by this is HARMONIC and MELODIC: a different tune arrives,
     instantly, and it is unmistakably the invincibility tune.

     WHY NOT THE CHORUS. The star already lifts the record into it — hypernova
     is in the hot-play set at the top of this function. But that lift can only
     land at a four-bar seam, and a seam can be up to a full loop away while
     the star lasts sixteen beats. So a player could take the star, hear
     nothing change, and have it expire before the section arrived. The one
     thing this moment cannot be is late.

     WHY NOT A THIRD SECTION. `applySect` is the only writer of CH/ARP and
     sections change only at a four-bar seam, never inside a payoff, rise,
     black hole or star dive. A star that swapped the harmony mid-bar would
     break the rule those four exceptions exist to protect, and it would fight
     the chorus for the same tables.

     SO THE STAR IS AN OVERLAY, NOT A SECTION. The harmony underneath is
     whatever was already playing; the star adds a voice above it that starts
     on the frame you take it. That is why it is immediate, and why it cannot
     collide with anything.

     THE RUN ITSELF is sixteen sixteenths that climb and wrap: four ascending
     cells, each starting a degree higher than the last, so the line spirals
     upward and never resolves. That is the whole feeling of the thing — an
     unstoppable climb, restated every bar for as long as you are untouchable.
     Written as PENT DEGREES, never frequencies, so it is an interval over the
     level's own tonic and transposes with the key by construction. The
     pentatonic is consonant against any triad in the natural minor, so the
     run is safe over the verse, the chorus, and any chord either walks to. */
  if(G.hyper>0){
    hat(t,0.013,5200,0.045,0,0,7400);
    hat(t+S16,0.010,5800,0.04,0,0.3,7600);
    if(beat%2===0)kick(t,0.055);
    /* the two sixteenths this eighth owns */
    for(let s=0;s<2;s++){
      const ix=beat*2+s,d=STARRUN[ix];
      /* alternating pan gives the run width without moving anything else */
      const pn=(ix%2)?0.22:-0.22;
      /* square for the bite, triangle under it for body — the same pairing
         lead() uses, at the register above the band's degree-4 ceiling */
      note(PENT[d],t+s*S16,0.115,'square',0.026,3400,pn);
      note(PENT[d],t+s*S16,0.115,'triangle',0.018,2100,pn);
    }
    /* AND THE FLOOR DRIVES. Straight eighths on the live chord's root, so the
       star pushes forward against a progression that is still walking rather
       than sitting on a pedal. chI/CH, never a stored frequency: this has to
       follow a section change if one lands while the star is running. */
    bassN(ch[0]*0.5,t,SPB*0.42,0.052);
  }
  /* Temporary colours keep their own space on the grid. The reflected pair
     answers once every two bars; the wake is a dry root/fifth flicker. Neither
     starts a second melody under the star, a drop, or the black hole. */
  powerColour(t,ch,beat,bar);
  /* 3 / 7 / 11 melodic events per bar still hold. The kit sits underneath
     them; the payoff section remains the loudest thing in the game. */
  /* THE COVER. The band fills the offbeat only while nobody else is playing
     it, and fades out continuously as you engage — so the first thing you hear
     when you start working the controls is the machine stepping aside. Dull
     and quiet on purpose: 0.014 against the player's ~0.10. It is a cover. */
  /* the offbeat "cover" square is deleted too — filling the offbeat is the
     dub delay's job now, and a delay tail is hypnotic where a fresh note is
     just another sparkle */
  /* CNT[i%8] with i only ever 11 or 27 resolved to CNT[3] both times — one
     repeated pitch, not a line. Indexed by something that moves now, and
     dropped an octave so it sits below the player's floor. */
  if((k>0.72||PLAY.heat>0.65||hot)&&gv<3&&beat===3&&(bar%2===1)){
    note(PENT[CNT[((i/4)|0)%CNT.length]]/2,t,0.55,'triangle',0.030,2200,0.15);
  }
}
/* ---------- the player as performer ----------
   Every input already makes a functional noise the instant it happens; that
   does not change, because delaying it would make the controls feel laggy.
   What is added is a SECOND hit placed on the musical grid, so a player mashing
   reverse while stuck is not making noise — they are playing the record.

   A short percussive note tolerates the ~72ms average delay that quantising
   costs, where a sustained one would not. And consecutive inputs walk a figure
   instead of repeating a pitch, so tapping back and forth is a phrase. */
/* The three figures live INLINE in performerHit, not here. There were named
   constants at this line — REVSEQ, HOPIN, HOPOUT — with no reader and, having
   drifted, with different values from the tables actually played: REVSEQ said
   [0,2,4,5,4,2,3,1] where the live tap figure is [0,2,1,3,2,0,3,1]. The
   comment they carried described their own range (0..5) as the reason the ring
   transposition works, while the live tables stay inside 0..3. Anyone tuning
   the tap phrase would have edited them and heard nothing change, then
   believed a range claim that was not true of the running code. Deleted rather
   than rewired: one copy of a table is the only safe number of copies. */
/* THE CHORD IS THE INSTRUMENT (playtest: "I don't feel the game being
   harmonious with my movements... general music theory is off"). The old
   figures walked the pentatonic SCALE, which is in key but indifferent to
   the bar's chord — melodically safe, harmonically nowhere. chTone(ix)
   resolves an index against the chord SOUNDING RIGHT NOW: 0-3 walk the
   voicing (root, octave, third, fifth), each block of four an octave up.
   Everything the player triggers speaks through this, so a tap is a chord
   tone of THIS bar by construction — harmony is no longer luck. */
/* WHICH CHORD IS SOUNDING is two facts, not one: the bar ordinal, and the
   section's walk order. The verse walks its row in place; the chorus may
   open anywhere in its row (CHOFF — see PROGB), which is how a chorus
   starts off-tonic while CH[0] stays the i chord every tonic-reader
   assumes. Every consumer of "the chord now" goes through this. */
function chI(bar){return (MU&&MU.sect)?((bar+CHOFF[G.level-1])%4):(bar%4);}
function chTone(ix){
  const ch=CH[MU?chI((MU.step/8)|0):0];
  const i2=Math.max(0,ix|0);
  return ch[i2%4]*(1<<((i2/4)|0));
}
let PLAY={heat:0,idx:0,last:-9,slot:-1,bias:0,biasN:0,tape:[]};
/* Legacy recorder storage is kept inert for saved-run and cleanup paths.
   Movement feedback is immediate; no tape is captured or played back. */
const LOOP={pat:null,n:0,until:0,heard:false};
/* ---------- the finale: THE STAR DIVE ----------
   Execution round four, and this time it is not a minigame — it is the
   game, concentrated, played as a REWARD: a beautiful new melody heard
   before the next track. The duet demanded new literacy; the countdown
   demanded none. Now the level's closing melody appears PHYSICALLY: a
   trail of bright stars spiralling from the outer ring down to the inner
   one, ending at a final star nearest the core. Players already chase
   stars on pure instinct, so there is nothing to explain — orbit,
   reverse, hop inward, and collecting the trail PERFORMS the ending:
   each star is the next note of a cadence descending to the root, each
   fourth star adds a voice, and the last one lands the full chord and
   the braam as you arrive at the heart of the arena. Miss stars and the
   ending plays thinner; a generous timeout completes the level
   regardless; sweep every one for PERFECT ENDING. Both verbs, zero
   words. */
const FIN={on:false,pend:false,done:false,step:0,score:0,got:0,
  voices:0,t0:0,trail:[],sun:null,bloomed:false,lastAt:-9};

/* ================= BLACK HOLE =================
   An optional wager in three acts. Ride the fourth, innermost ring to bank
   energy. At twelve seconds gravity releases: reach the outermost ring before
   seventeen seconds to cash out. Staying too long loses the bank and a shield.
   Ordinary orb rewards are suspended through the event, then resume. */
const BH_DUR=17;
const BH_ESCAPE=12;
const BH_WARP=0.85;
const BH_TS=0.60;
const BH_DENSITY=1.25;
const BH_PULL=4;
const BH_IGNITE=1.2;
const BH_HORIZON=600;    /* maximum bank from eight seconds at the inner ring */
function bhDensity(){
  return BH.phase===2?1.25+0.75*Math.min(1,BH.t/BH_ESCAPE):BH_DENSITY;
}
const BH={on:false,phase:0,t:0,warp:0,score:0,hits0:0,step:0,pullT:0,rings0:3,
  lit:false,igT:0,charge:0,escape:false};
/* phase 0 off, 1 opening, 2 challenge, 3 closing. Ring zero is OUTERMOST. */
function bhActive(){return BH.phase>0;}
function bhTick(dt){
  if(BH.phase===0)return;
  BH.t+=dt;
  if(BH.phase===1){
    BH.warp=Math.min(1,BH.t/BH_WARP);
    if(BH.warp>=1){BH.phase=2;BH.t=0;G.nRings=4;}
  }else if(BH.phase===2){
    BH.warp=1;
    BH.igT=Math.max(0,BH.igT-dt);
    if(BH.t>=BH_ESCAPE&&!BH.escape){
      BH.escape=true;BH.pullT=0;
      G.banner=null;
      say('ESCAPE: swipe to the outer ring',2,8);
      beep(CH[0][0]*4,0.2,'sine',0.045,CH[0][0]*6);
      /* No fresh wall may close behind the escape signal. Existing threats
         remain readable; short grace covers the transition itself. */
      G.invuln=Math.max(G.invuln,G.t+0.6);
    }
    if(G.state==='playing'){
      if(BH.escape){
        if(G.ringI===0&&G.hopP>=1)endBlackHole(true);
        else if(BH.t>=BH_DUR)endBlackHole(false);
      }else{
        if(G.ringI===G.nRings-1&&G.hopP>=1){
          BH.charge=Math.min(1,BH.charge+dt/8);
          if(!BH.lit){
            BH.lit=true;BH.igT=BH_IGNITE;
            beep(CH[0][0]*4,0.3,'sine',0.045,CH[0][0]*6);
          }
        }
        BH.pullT+=dt;
        if(BH.pullT>=BH_PULL&&G.hopP>=1){
          BH.pullT=0;
          if(G.ringI<G.nRings-1){
            G.hopFrom=radiusOf(G.ringI);G.hopFromI=G.ringI;
            G.ringI++;G.hopP=0;
            G.invuln=Math.max(G.invuln,G.t+0.55);
            beep(CH[0][0]*3,0.20,'sine',0.032,CH[0][0]*2);
          }
        }
      }
    }
  }else{
    /* Withdraw every entity from the temporary lane before its radius closes.
       This also runs after death and when the lab is left mid-challenge. */
    if(G.nRings>BH.rings0){
      G.nRings=BH.rings0;
      G.spikes=G.spikes.filter(s=>s.ring<G.nRings);
      G.stars=G.stars.filter(s=>s.ring<G.nRings);
      G.pows=G.pows.filter(s=>s.ring<G.nRings);
      if(G.ringI>=G.nRings){G.ringI=G.nRings-1;G.hopP=1;}
      if(G.hopFromI>=G.nRings){G.hopFromI=G.ringI;G.hopP=1;}
      G.hopFrom=radiusOf(G.hopFromI);
    }
    BH.warp=Math.max(0,1-BH.t/BH_WARP);
    if(BH.warp<=0){BH.phase=0;BH.on=false;}
  }
  for(let i=0;i<4;i++)RADII[i]=RAD_OFF[i]+(RAD_BH[i]-RAD_OFF[i])*BH.warp;
}
function startBlackHole(){
  if(BH.phase>0)return;
  Object.assign(BH,{phase:1,t:0,warp:0,score:0,step:0,pullT:0,lit:false,igT:0,
    charge:0,escape:false,hits0:G.blocks,rings0:G.nRings,on:true});
  G.bhN++;G.bhT=G.t;
  /* Save earned drops; audio ownership never confiscates the player's meter. */
  if(MU){
    MU.brk=0;
    const bank=MU.pend||((MU.armed||MU.rise)?(MU.why||'STARFALL'):null);
    const bankSrc=MU.pend?MU.pendSrc:MU.flavor;
    const sect=MU.sect;
    endSection();
    applySect(sect);
    MU.pend=bank;MU.pendSrc=bank?bankSrc:null;
  }
  duckBed(0.08,0.16);
  G.banner={str:'BLACK HOLE',eyebrow:'RISK / REWARD',
    sub:'charge inside · escape to the outer ring on the signal',t:0};
  if(G.teach>0)flushLesson(true);
  G.teach=0;G.teachSoft=false;
  /* Complex cross-ring formations do not belong in a gravity challenge. */
  G.spikes=[];G.parts=[];G.rings=[];G.hyperGlow=0;G.spotGlow=0;
  G.invuln=Math.max(G.invuln,G.t+BH_WARP+0.3);
  if(AC&&!muted){
    hat(AC.currentTime,0.18,900,0.35,0.20,0,5800);
    beep(CH[0][0]*8,0.80,'sine',0.055,CH[0][0]);
  }
  track('blackhole_entered',{game_level:G.level,tier:G.tier,score:G.score,run_index:G.runs});
}
function endBlackHole(escaped){
  if(BH.phase!==2)return;
  BH.phase=3;BH.t=0;
  if(G.state!=='playing')return;
  const spent=Math.max(0,G.blocks-BH.hits0),p=posPlayer();
  if(!escaped){
    if(G.shields>0){G.shields--;G.blocks++;G.invuln=Math.max(G.invuln,G.t+1.5);}
    else if(!LAB.on){die();return;}
    popup(p[0],p[1]-28*u,'REWARD LOST',COL.shard,1.15);
    say('Too late: reach the outer ring at ESCAPE',2.5,8);
    beep(CH[0][0]*2,0.35,'triangle',0.05,CH[0][0]);
    track('blackhole_failed',{game_level:G.level,charge:+BH.charge.toFixed(2),run_index:G.runs});
    return;
  }
  const bonus=Math.round((80+BH_HORIZON*BH.charge+20*BH.score)/Math.pow(1.5,Math.min(3,spent)));
  G.score+=bonus;G.scorePop=1;
  popup(p[0],p[1]-30*u,'ESCAPED +'+bonus,COL.warp,1.3);
  G.invuln=Math.max(G.invuln,G.t+1.5);
  scenePulse('drop',3);
  if(!RM){
    G.rings.push({x:cx,y:cy,r:radiusOf(0)*0.45,life:1,col:COL.warp,sp:280,dec:1.1});
    burst(p[0],p[1],COL.warp,12,240);
  }
  gameHaptic('reward',[25,35,55]);
  beep(CH[0][0],0.6,'sine',0.060,CH[0][0]*4);
  beep(CH[0][0]*3,0.45,'sine',0.035,CH[0][0]*6,undefined,0.25);
  track('blackhole_survived',{game_level:G.level,seconds:+(G.t-G.bhT).toFixed(1),
    shields_spent:spent,charge:+BH.charge.toFixed(2),bonus,stars:BH.score,run_index:G.runs});
}
/* The challenge piece stays in the level's minor key. Its tension comes from
   the mode's own tritone, separated phrases, and a heartbeat that accelerates
   as escape approaches. Entry and exit cues own the transition warps. */
function bhStep(t){
  if(BH.phase!==2)return;
  /* Half tempo keeps the event on the record's grid. Three acts follow the
     same clock as gravity and the escape opening; no parallel audio timer. */
  const fs=BH.step++;
  if(fs&1)return;
  const hs=fs>>1,beat=hs%8,bar=(hs/8)|0;
  const root=CH[0][0],q=Math.min(1,Math.max(0,BH.t/BH_DUR));
  const escapeAt=BH_ESCAPE/BH_DUR;
  const act=q<0.35?0:q<escapeAt?1:2;
  const charge=Math.min(1,Math.max(0,BH.charge||0));
  const escape=Math.max(0,(q-escapeAt)/(1-escapeAt));
  /* One pulse owner: 1 / 2 / 4 heartbeats per half-time bar. Its landed
     visual pulse comes from the same timestamp, including the last act. */
  const pulse=beat===0||(act>=1&&beat===4)||(act===2&&(beat===2||beat===6));
  if(pulse){
    kick(t,0.036+act*0.009+charge*0.006);
    BEATQ.push(t);
  }
  /* The abyss has weight without detuning the record or dropping the lowest
     worlds below the speaker floor. Motion comes from timbre and register. */
  if(beat===0)note(subF(root*0.5),t,SPB*(act===2?2.3:4.2),'sawtooth',
    0.052+0.012*charge,180+act*100,0);
  /* Degree 2 against flat 6 is the mode's own tritone. Long, separated
     statements leave silence around it; the escape replaces it with motion. */
  if(beat===0||(act===1&&beat===5)){
    note(root*1.12246,t,SPB*(act===2?1.3:2.8),'square',0.026+0.005*act,820,-0.32);
    note(root*1.58740,t,SPB*(act===2?1.3:2.8),'square',0.026+0.005*act,760,0.32);
  }
  /* Accretion is pressure, not a constant wall of noise. One dark grain opens
     as the player stays deep; a second short breath arrives with escape. */
  if(beat===4)hat(t,0.034+act*0.012+charge*0.015,300+act*180,0.15,0,0,1000+act*500);
  if(act>=1&&beat===2)hat(t,0.030+charge*0.022,520,SPB*0.26,0,-0.18,1600);
  if(act===2&&beat===6)hat(t,0.040+0.022*escape,1000+escape*500,0.16,0,0.18,3100);
  /* A distant tuned beacon stays audible on a phone even in the opening.
     Inner-ring charge adds its fifth: the bank can be heard growing. */
  if(beat===6&&(bar%2===1||act>=1)){
    note(root*1.18921*8,t,SPB*0.8,'triangle',0.018+0.010*charge,2600,0.34);
    if(charge>0.35)note(root*1.78180*4,t,SPB*0.65,'triangle',0.010+0.012*charge,2200,-0.28);
    hat(t,0.010+act*0.004,3200,0.075,0,0.34,6800);
  }
  /* The escape gate introduces a rising question, never a victory cadence.
     Only an actual successful exit supplies the resolution in endBlackHole. */
  if(act===2&&beat%2===1){
    const climb=[1.12246,1.18921,1.33484,1.49831];
    note(root*4*climb[(beat-1)>>1],t,SPB*0.55,'triangle',
      0.028+0.010*escape+0.007*charge,2200+escape*1200,(beat<4?-0.20:0.20));
  }
}
function finStep(t){
  const fs=FIN.step++;
  const beat=fs%8;
  if(beat%2===0)BEATQ.push(t);
  /* the floor rolls under the dive; voices join as the trail is gathered */
  if(beat===0){kick(t,0.050);bassN(CH[chI((fs/8)|0)][0],t,0.28,0.034);}
  if(beat===4)kick(t,0.036);
  if(beat%2===1)hat(t,0.009,4000,0.038,0,0.35,6800);
  if(FIN.voices>=1&&beat===0)swellPad(chTone(2),t,2.0,0.024,0);
  if(FIN.voices>=2&&beat%2===0)note(chTone(4),t,0.12,'square',0.010,1800,0.2);
  /* the kit fills in as the melody comes home — the rush is audible */
  if(FIN.got>=4&&beat%2===0)hat(t+S16,0.007,5200,0.035,0,0,7200);
  if(FIN.got>=6&&(beat===2||beat===6))kick(t,0.032);
  if(FIN.got>=9)hat(t,0.006,4600,0.03,0,0.3,7000);
}
/* NEAREST sixteenth, not the next one. Snapping forward alone costs up to a
   full slot — 144ms at this tempo, past the point where a sound stops feeling
   attached to the tap that caused it. Snapping to the nearest halves the worst
   case to 72ms: a tap landing just after a beat plays essentially now and
   reads as on it, and only a tap in the back half of a slot waits. */
function gridNear(){
  const now=AC.currentTime,s=SPB/4;
  if(!MU||!MU.next)return now+0.015;
  let t=MU.next;
  while(t>now)t-=s;                          /* last grid point at or before now */
  /* Returns the GRID POINT itself, which can sit slightly in the past — the
     caller clamps for scheduling. Returning a clamped now+12ms here made
     every front-half tap a unique timestamp, so the one-note-per-slot guard
     in performerHit compared fresh numbers and never deduped: held Space
     auto-repeat stacked three or four notes into a single sixteenth. */
  return ((now-t)>s*0.5)?t+s:t;
}
/* ---------- everything lands on the grid ----------
   The player's own inputs were always quantised; the game's REPLIES were not
   — every ember, orbit, shield and milestone fired its beep at collision
   time, a cloud of off-grid sounds over a quantised band. cueTone() is the
   universal fix: the caller keeps its instant transient (feel), and hands
   the tonal payload here to land on the sixteenth grid. One voice per slot;
   a taken slot pushes to the next, so a fast ember chain comes out as an
   actual sixteenth-note run — the player making music by moving. */
const CUE={slot:0};
function cueTone(fn){
  if(!AC)return;                       /* no context yet: nothing to play into */
  if(!MU||!MU.next||AC.state!=='running'){fn(0);return;}
  const now=AC.currentTime;
  let t=Math.max(gridNear(),now+0.012);
  /* a taken slot cascades to the next sixteenth (capped a beat out, so a
     burst compresses rather than drifting away from its cause) */
  if(CUE.slot>=t-1e-4&&CUE.slot-now<SPB)t=CUE.slot+S16;
  CUE.slot=t;
  fn(t-now);
}
/* ---------- groove ----------
   Reward for playing in time, and NEVER a penalty for not. An off-beat input
   simply earns nothing: the game already demands you tap when a shard arrives,
   and docking you for surviving at the wrong moment would force a choice
   between playing well and playing in time. Nobody should have to make that.

   The window has to absorb touch latency — 30-50ms on a phone before JS even
   hears about it — so a single tight hit is not the achievement. The chain is. */
/* The window cannot simply be tight. A phone adds 30-50ms between the finger
   and the JS event, so judging absolute accuracy would mean a player tapping
   perfectly in time registers late and never scores at all — and their device,
   not their playing, would decide it.

   So judge CONSISTENCY instead. Track a running bias and score the deviation
   from it: a player who is reliably 60ms late is playing in time and gets
   credit, while arbitrary tapping has no stable bias to deviate from and
   fails. This is what "creating a good beat" actually means, and it
   self-calibrates to whatever device it lands on. */
/* THE CHAIN CLIMBS ON THE BEAT, NOT ON THE FINE GRID. The chain used to
   climb on any sixteenth-tight hit, and at ±32ms against a 144ms grid a
   random tapper lands ~44% of taps — with a miss costing one rung instead
   of the chain, that is a random walk that visits ×8 by accident ("feels
   like you can tap randomly and get chains" — the playtest, verbatim, and
   the math agrees: simulated mashing reached ×8 in a quarter of 300-tap
   trials). Three tiers now, and each answers a different intent:
   - CLIMB: tight against the QUARTER — the beat, the exact grid the ring
     contracts onto (beatPhase), so the thing taught and the thing judged
     are finally the same thing. ~11% for a random tap; every simulated
     mash profile now peaks around ×2-×4 and effectively never maxes.
   - HOLD:  tight against the sixteenth only — offbeat eighths included. A
     tap played in the song's own subdivisions keeps the chain alive and
     still earns the section garnish; it just doesn't climb. Syncopation
     and survival fills keep what they brought. Playing to live never costs.
   - SLIP:  one rung, never the chain, never points — unchanged.
   The quarter gridlines are a subset of the sixteenth's, so one learned
   bias serves both tiers. Accepted residual: a metronomically steady ~7Hz
   drummer a few percent off tempo can still grind to ×8 in ~18s of
   unbroken drumming — that is rhythm skill, merely not this song's, and
   walling it off would cost the real sixteenth players their climb. */
const TIGHT=0.032;
/* anchor: MU.next is the next unscheduled EIGHTH, so it sits on the sixteenth
   grid always but on the quarter grid only when MU.step is even — the quarter
   caller must hand in the true beat boundary, derived the same way beatPhase
   derives the ring's. Anchored wrong, the judged beat lands on the OFFBEAT
   whenever the scheduler head has odd parity — caught by musiccheck. */
function gridOff(s,anchor){         /* signed: negative early, positive late */
  const now=AC.currentTime;
  if(!MU||!MU.next)return 9;
  let t=anchor===undefined?MU.next:anchor;
  while(t>now)t-=s;
  while(t+s<=now)t+=s;   /* the anchor can sit behind now (a stalled tick) —
                            walking only downward returned offsets larger
                            than the grid step itself */
  const late=now-t,early=(t+s)-now;
  return late<=early?late:-early;
}
function judgeTiming(x,y){
  if(G.state!=='playing'||!AC||!MU)return 0;
  const off4=gridOff(SPB,MU.next+((MU.step%2)?SPB/2:0)),off16=gridOff(SPB/4);
  if(off4>8)return 0;
  const W=upgOn('steadyhand')?0.045:TIGHT;
  const dev4=Math.abs(off4-PLAY.bias),dev16=Math.abs(off16-PLAY.bias);
  /* The bias learns only from taps plausibly AIMED at the grid. It used to
     learn from every tap, so a stretch of survival tapping dragged the
     calibration around and then a genuinely on-beat tap "missed" — and a
     player consistently ~72ms late reads as early against the NEXT gridline,
     so the EMA also ate sign-flipped noise at the boundary. Gating on
     nearness to the current bias excludes both.
     AND IT IS A LATENCY, SO IT BARELY MOVES. The bias exists to learn the
     device — a quantity that is static for a session — but at 0.18 per tap
     the EMA was fast enough to TRACK a drifting cadence, and simulation
     showed a sloppy ~7Hz masher whose phase random-walks across the grid
     being chased by his own calibration all the way to ×8. Twelve gated
     taps of fast learning calibrate a fresh device; after that the bias
     slews at most 3ms per tap and lives within ±120ms, plenty for any real
     tendency drift and far too slow to follow a wander.
     THE FAST SAMPLES ARE RESERVED FOR QUARTER-PLAUSIBLE TAPS (review
     catch): the sixteenth gate is wider than the sixteenth's own ±72ms
     range, so on a fresh session EVERY survival tap qualified and twelve
     arbitrary ones could spend the whole budget before the player ever
     aimed at a beat — a +40ms device then needed ~18 deliberate taps to
     its first ×8 instead of ~12. Only taps within the gate of the QUARTER
     spend a fast sample now; everything gated still learns through the
     slew, which alone converges a consistent 40ms tapper in ~13 taps.
     Accepted tail: a 70ms+ device whose budget was fully spent on noise
     recalibrates only at slew speed — the bias persists across runs, so
     it is a one-time session cost, not a per-run one. */
  if(Math.min(dev4,dev16)<W*2.5){
    const d=((dev4<=dev16?off4:off16)-PLAY.bias)*0.18;
    PLAY.bias+=(PLAY.biasN<12&&dev4<W*2.5)?(PLAY.biasN++,d):Math.max(-0.003,Math.min(0.003,d));
    PLAY.bias=Math.max(-0.12,Math.min(0.12,PLAY.bias));
  }
  if(dev16<W){
    /* RIDING THE SECTION IS THE SCORE. During the payoff every tight hit
       pays — not just climbs — multiplied by a perfect landing. Playing
       through the drop is the skill; nothing asks you to stop. */
    if(MU&&MU.pay>0){
      const ex=8*(G.secMult||1);
      G.score+=ex;G.secScore+=ex;G.scorePop=Math.max(G.scorePop,0.6);
    }else if(G.od>0||G.hyper>0||G.shields>=shieldMax()||MU.sect===1){
      G.score+=8;G.scorePop=Math.max(G.scorePop,0.5);
    }
    /* HOLD: in the song's subdivisions but off the beat. The chain neither
       climbs nor slips, and its decay clock refreshes — a payoff fill played
       in sixteenths keeps the chain you brought into it. The note stays
       bright (performerHit reads the return), but the ring's catch flash and
       the popups are the CLIMB's: feedback belongs to the thing it teaches. */
    if(dev4>=W){
      if(G.groove>0)G.grooveT=G.t+2.8;
      return G.groove;
    }
    const was=G.groove;
    G.groove=Math.min(8,G.groove+1);
    G.grooveT=G.t+2.8;
    /* Score only on the way UP: 36 in total on the climb, nothing for holding,
       so it stays a garnish next to the 86 a maxed orbit pays. What a tight
       chain actually buys is your OWN instrument getting louder and brighter,
       and x8 fires the lift and a fat build bonus. What opens the ARRANGEMENT
       is PLAY.heat — engagement, not accuracy — so playing at all thickens
       the record and playing in time sharpens it. Neither ever costs a point. */
    if(G.groove>was){
      G.score+=G.groove;
      if(G.groove===1&&MU)MU.chainT=AC.currentTime;
      build(0.011,'time');
      /* THE CLIMB IS HEARD. +10% gain per rung was ~0.6dB — under the JND on
         a phone speaker — so rungs one to four were inaudible and the ladder
         only spoke through HUD text. Now the tap that raises the chain
         carries a quiet tone one scale degree higher per rung: eight tight
         sixteenths literally walk up the scale. On the perf bus so it fuses
         with the player's own note; silenced during the payoff, whose
         response bars already give their taps the lead voice. */
      if(!MU||MU.pay<=0)
        note(PENT[Math.min(13,G.groove+4)]*0.5,Math.max(PLAY.slot,AC.currentTime+0.012),
          0.10,'sine',0.010+0.003*G.groove,3200,0,A.perf);
      /* THE SUMMIT PAYS. x8 used to arm the drop directly; when the build
         meter absorbed that route the ceremony was deleted and the top of
         the ladder became a dead end paying the same 0.021 as any rung. The
         lift is the tier-unlock fanfare — earned, not a chorus — and the
         bonus makes a full chain worth about a quarter of the meter. */
      if(G.groove===8){fireLift();build(0.06,'time');}
    }
    G.grooveFx=1;
    /* Once per RUN, on the exact tap that proved it. This was once-per-
       DEVICE-ever, so every run after the first discovery got nothing at
       x2 \u2014 the rediscovery moment the ladder-replay philosophy exists for.
       didGroove stays persisted as the lifetime record. */
    if(G.groove>=2&&!G.beatPop){
      G.beatPop=true;
      if(!LAB.on&&!G.didGroove){G.didGroove=true;savePref('cometloop:groove','1');}  /* not from the lab — see hop() */
      popup(x,y-34*u,'ON TIME',COL.warp,1.0);
    }
    /* the popup names the tap; the lesson names the SYSTEM — once per
       device, on the exact input that proved the player can find it. It
       sits OUTSIDE the once-per-run popup latch: a deferred lesson must be
       re-offered by every later on-beat tap, not lost with the popup. */
    if(G.groove>=2)firstMeet('beat');
    /* the summit says what it bought — once per run, at the moment ×8 lands */
    if(G.groove===8&&!G.said8){G.said8=true;say('GREAT TIMING',2,8);}
    return G.groove;
  }
  /* a miss costs one link, never the chain and never points — losing eight for
     one late tap under pressure would just teach players to stop trying */
  if(G.groove>0)G.groove=Math.max(0,G.groove-1);
  /* THE MISS SAYS WHICH WAY. A tap that was plausibly aimed at the pulse gets
     a dim arc beside the beat ring — leading side early, trailing side late —
     so a player hunting the beat can steer instead of guessing. Gated on
     nearness so survival taps are not nagged, and it never speaks in text:
     "early/late" is an answer to a question only the ring has asked. */
  if(dev4<W*2.5)G.missFx={s:off4-PLAY.bias>0?1:-1,t:1};
  return 0;
}
function performerHit(kind,dir,ring){
  if(!A||!AC||!MU||frozen()||G.state!=='playing'||AC.state!=='running'||bhActive())return;
  const now=AC.currentTime,slot=gridNear();
  if(Math.abs(slot-PLAY.slot)<1e-4)return;
  PLAY.slot=slot;
  const t=Math.max(slot,now+.012);
  PLAY.heat=Math.min(1,PLAY.heat+.26);G.lastTapAt=now;
  if(now-PLAY.last>2.4)PLAY.idx=0;
  PLAY.last=now;
  const rg=Math.min(2,ring===undefined?effRing():ring);
  const ci=(kind==='hop'?(dir<0?[2,1,0,1]:[1,2,3,2])[PLAY.idx%4]:
    [0,2,1,3,2,0,3,1][PLAY.idx%8])+rg;
  PLAY.idx++;
  const p=posPlayer(),gr=judgeTiming(p[0],p[1]),rv=RINGS[rg];
  const flow=G.currentFlow||{},motion=kind==='hop'?(flow.hop||0):(flow.turn||0);
  const spread=motion*(kind==='hop'?0.16:0.10);
  const side=kind==='hop'?(flow.radial||-dir):(flow.dir||G.dir);
  const pan=Math.max(-0.75,Math.min(0.75,panAt(p[0])+side*spread));
  /* Turning always sounds like turning; hopping always follows its direction.
     Sections never remap controls, record a phrase or ask for musical input. */
  const g=(.032+.024*PLAY.heat)*(1+.08*gr);
  if(MU.pay>0){MU.payHits++;MU.barHits++;}
  note(chTone(ci+2),t,.16,rv.wave,g,(1500+1200*PLAY.heat)*(1+.16*gr)*rv.cut,
    pan,A.perf,.12);
  note(chTone(ci),t,.13,rv.wave,g*.34,1100*rv.cut,
    Math.max(-0.75,Math.min(0.75,pan-side*spread*2)),A.perf);
  if(rg>=2)note(chTone(ci+4),t,.09,'sine',g*.25,3600,pan,A.perf);
}
/* Lookahead stays on the audio clock, independent of rendering stalls. */
function musicTick(){
  if(!A||!AC||!MU||!BED||AC.state!=='running')return;
  if(G.state!=='playing'){
    if(MU.pay||MU.rise||MU.armed||MU.pend||MU.hushEnd||MU.brk||MU.brkEnd||LOOP.pat||PLAY.tape.length)endSection();
    MU.next=0;return;
  }
  const now=AC.currentTime;
  /* Coming back from a background: never flush the backlog as one chord. */
  /* A phrase cannot be resumed across an unknown gap, so the rest of the
     section is forfeited rather than replayed compressed. */
  if(!MU.next||MU.next<now-0.4){endSection();MU.next=now+0.06;MU.step=0;MU.chord=-1;}
  /* FRONT-LOADED, at playtester insistence ("the music is THE key — front
     load it"): the layering used to reach full ~6 minutes in, which nobody
     ever heard. Full band now arrives inside the runs people actually have. */
  const k=Math.min(1,dl()/150);
  let guard=0;
  while(MU.next<now+0.16&&guard++<16){
    musicStep(MU.step,MU.next,k);
    MU.step=(MU.step+1)%STEPS;
    MU.next+=SPB/2;
  }
}
function bedTick(dt){
  if(!BED||!AC)return;
  const t=AC.currentTime;
  const playing=G.state==='playing';
  const k=playing?Math.min(1,dl()/170):0;
  const orbit=orbitMusicState();
  /* Redistribute the existing pad budget: root/octave weight opens into
     third/fifth color. The sum stays 0.16; no new oscillator or master gain. */
  for(let v=0;v<4;v++)for(let pair=0;pair<2;pair++){
    const weight=orbit.active?(v<2?0.065-0.02*orbit.pressure:0.015+0.02*orbit.pressure):
      (v<2?0.05:0.03);
    BED.gains[v*2+pair].gain.setTargetAtTime(weight/2,t,0.22);
  }
  /* not gated on muted: the bus already is, and gating here made unmuting
     produce a 0.9s pad swell that read as a fade-in rather than a switch */
  /* THE DEADLINE. bedTick runs from update() unconditionally, so this catches
     every stall path including the ones nobody enumerated — an iOS phone-call
     interrupt mid-section leaves musicTick bailing on AC.state, and only this
     line would notice. */
  if(MU&&MU.pay>0&&t>MU.payEnd)endSection();
  /* a banked drop fires the instant the music can carry one */
  if(MU&&MU.pend&&!MU.armed&&!MU.rise&&MU.pay<=0&&t>=MU.cool&&playing&&!bhActive()){
    const w=MU.pend,ws=MU.pendSrc;MU.pend=null;MU.pendSrc=null;armDrop(w,ws);
  }
  /* the two title screens keep the bed's low idle — the level picker is part
     of the front of the game, not a pause */
  /* THE BLACK HOLE TAKES THE PAD WITH IT, and until now it did not. "The
     existing music immediately cuts out" is the pitch's first line about the
     mode, and startBlackHole delivered it by silencing the SCHEDULER —
     musicStep hands off to bhStep and no new notes are written. But the pad is
     a bank of eight continuously running oscillators whose gain lives here, in
     the one function that writes BED.g, and nothing here knew about the mode.
     So the level's own chord progression sustained straight through the black
     hole at full level, tracking bar by bar: measured, 54% of the mix was
     byte-identical either side of the entry, and the preset piece — 18 dB
     quieter on a phone — was mixed underneath the band it was supposed to have
     replaced. This is the same bug the drop's hush had, diagnosed in the
     comment above DROPQ and never generalised: silencing the scheduler is not
     silencing the band. The floor drops out now. */
  /* A quiet baseline has room to grow. Depth/time still shape the arrangement,
     but only playing well or earning a mode opens its overall level. This is
     downstream of the scheduled hush/pump so their envelopes remain intact. */
  if(A&&A.band){
    const earned=playing?Math.min(1,Math.max(G.groove/8,G.lapStreak/4,PLAY.heat*0.45)):0;
    let band=0.72+0.18*earned;
    if(bhActive())band=0.84+0.16*Math.min(1,Math.max(0,BH.t/BH_DUR)*0.5+(BH.charge||0)*0.5);
    else if(playing&&(G.hyper>0||G.od>0||FIN.on||(MU&&(MU.pay>0||MU.rise))))band=1;
    A.band.gain.setTargetAtTime(band,t,band>A.band.gain.value?0.18:0.75);
  }
  const lvl=bhActive()?0.010:
    (playing?0.17+0.26*k:((G.state==='menu'||G.state==='levelsel'||G.state==='powersel')?0.06:0.02));
  /* The pad recedes for the payoff and comes back for its second half. This
     IS the loudness of the section: contrast costs no headroom. bedTick stays
     the ONLY writer of BED.g, which is why there is no stuck-pad case. */
  let mul=1;
  /* 0.50 in the late half, not 0.65: measured, the double-time bars were the
     loudest instant in the game and drove the soft clip to 1.45 pre-limiter.
     The pad comes down, never the hook — the pad receding IS the loudness. */
  if(bhActive())mul=1;
  else if(MU&&MU.pay>0)mul=((PAY-MU.pay)>>3)<(MU.lateAt||4)?0.35:0.60;
  /* THE STAR OPENS THE BAND, and it has to be written HERE or it does not
     happen. bedTick is the only writer of BED.g, so a mode that adds voices in
     musicStep and nothing else gets a brighter cutoff over a pad sitting at
     exactly the level it was before — which is the bug the black hole shipped
     and the drop's hush shipped before it. The star is the one moment in the
     game that should sound BIGGER rather than merely busier, so the floor
     comes up under the run instead of stepping back for it. */
  else if(G.hyper>0)mul=1.22;
  /* it CUTS on the way in (0.05s) and SWELLS on the way out (0.9s): the pitch
     is explicit that a crossfade would read as a transition between two songs
     rather than as the floor dropping away, and coming back is the opposite
     gesture — daylight, not another cut */
  BED.g.gain.setTargetAtTime(lvl*mul,t,bhActive()?0.05:(playing?0.9:0.5));
  G.pay=(MU&&MU.pay>0)?MU.pay/PAY:0;
  /* floor at 520: below that a phone speaker reproduces little of it, and the
     opening minutes would be silent on the device this actually ships to */
  /* engagement decays over ~3s, so a flurry lifts the arrangement and then
     settles rather than latching */
  PLAY.heat=Math.max(0,PLAY.heat-dt*0.34);
  /* Keep the audio timestamps for phase, never turn each note into a shared
     brightness impulse. The timing marker follows beatPhase continuously. */
  while(BEATQ.length&&BEATQ[0]<=t)BEATQ.shift();
  LOOPQ.length=0;G.loopFx=0;  /* retired recorder state cannot restart */
  while(DROPQ.length&&DROPQ[0]<=t){
    DROPQ.shift();startStarfall();G.dropFx=1;
    // Starfall owns one conversion front and its actual arriving stars.
    // The scheduler must not add another set of shockwaves or screen light.
    gameHaptic('reward',[34,30,70]);
  }
  if(BEATQ.length>32)BEATQ.length=0;      /* a stall must not bank a burst */
  /* THE GROOVE IS AUDIBLE AS A BUILD. From x5 up the pad opens under the
     player's hands whether or not the chain ever reaches x8 — the build a
     real track waits eight bars for, paid for with playing instead. */
  const gv=Math.max(0,G.groove-4);
  /* the pad opens as you go inward too, so the whole mix brightens with depth */
  let cut=520+1500*k*k+900*PLAY.heat+420*gv+(playing?RINGS[ringOf()].lift:0)
    +((MU&&MU.armed&&!MU.rise)?260:0)    /* the armed wait audibly opens */
    +(G.od>0?420:0)+(G.hyper>0?520:0)+((MU&&t<MU.glow)?280:0) /* overdrive, hypernova and afterglow run bright */
    +((MU&&MU.sect)?200:0)               /* the chorus opens the pad — half the lift */
    +(FIN.on?90*FIN.got:0);                      /* the dive opens with every star */
  if(orbit.active)cut=Math.max(520,cut+750*orbit.pressure-280*orbit.turn+
    160*orbit.hop*orbit.radial);
  if(MU&&MU.pay>0)cut=Math.min(cut,((PAY-MU.pay)>>3)<(MU.lateAt||4)?380:700);
  /* Time slip darkens the air, while every note keeps the level's pitch and
     the scheduler keeps its grid. The drop still owns its darker filter. */
  else if(G.slow>0&&!bhActive())cut=Math.max(520,cut*0.68);
  /* schedulePreDrop owns this param through the hole; do not fight it */
  if(!MU||t>=MU.lpLock)BED.lp.frequency.setTargetAtTime(cut,t,
    orbit.active&&(orbit.turn>0||orbit.hop>0)?0.13:0.5);
  musicTick();
}
/* Big moments push the bed and the reverb tail out of the way, then let them
   back. Without this the bed fights the one sound you actually need to hear. */
function duckBed(amount,rel){
  if(!A||!AC)return;
  /* An ember collected inside the hole would otherwise cancel the scheduled
     recovery and undo the silence. During the hush the band is already 26dB
     down, there is nothing to duck, and the cue itself goes through A.world. */
  if(MU&&AC.currentTime<MU.hushEnd)return;
  const t=AC.currentTime;
  A.bed.gain.cancelScheduledValues(t);
  A.bed.gain.setTargetAtTime(amount,t,0.02);
  A.bed.gain.setTargetAtTime(1,t+0.09,rel||0.35);
}
function ensureAudio(){
  try{
    if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
    /* 'interrupted' is WebKit-only and is where a phone call, Siri or an alarm
       leaves you. Nothing else recovers from it, and it is not 'suspended'. */
    if(AC.state==='suspended'||AC.state==='interrupted')AC.resume();
    /* iOS will not actually start a context until something has been played
       through it inside a user gesture — resume() alone can leave it silent.
       A one-sample buffer is enough, and is inaudible. */
    if(!audioUnlocked&&AC.state!=='closed'){
      const src=AC.createBufferSource();
      src.buffer=AC.createBuffer(1,1,22050);
      src.connect(AC.destination);src.start(0);
      audioUnlocked=true;
    }
    buildBus();
  }catch(e){}
}
/* Coming back from the app switcher or a lock screen leaves the context
   suspended on iOS, and nothing else would resume it until the next tap. */
function runtimeVisibilityChanged(){
  /* iOS can replay pending automation compressed on resume, so a section in
     flight is abandoned rather than rushed through. */
  if(!document.hidden){ensureAudio();endSection();}
  else{
    /* Desktop and Android keep WebAudio running in a hidden tab, but the rAF
       loop stops — so the pad froze at playing volume and droned one chord
       for as long as the tab stayed hidden. Take the bed down directly
       (bedTick brings it back on the first visible frame), and drain the
       flash queues so returning minutes later cannot fire a stale drop
       shake. endSection banks an earned drop rather than eating it. */
    endSection();
    if(BED&&AC)BED.g.gain.setTargetAtTime(0.005,AC.currentTime,0.15);
    BEATQ.length=0;DROPQ.length=0;
  }
}
if(!runtimeHost.externalLifecycle)runtimeListen(document,'visibilitychange',runtimeVisibilityChanged);
/* One place to toggle from, so both the icon and the M key report what they
   did. Mute persists per device, and a silent game with no acknowledgement
   reads as broken audio rather than as a setting someone switched. */
/* MUTE THE BUS, NEVER THE CLOCK. The old guards on musicTick, judgeTiming and
   performerHit did not silence the rhythm system, they deleted it: musicTick
   returning early left MU.next frozen, so gridOff() answered its sentinel
   forever, BEATQ never filled, G.beat never left 0, and even the VISUAL beat
   stopped. Sound off meant no groove, no score from it, no drop, and no
   metronome — for a deaf player, or anyone on a bus, the whole mechanic simply
   did not exist. Now the clock always runs and only the output is gated; note()
   and hat() early-out so a silent run still costs nothing to play. */
function toggleMute(){
  muted=!muted;savePref('cometloop:muted',muted?'1':'0');
  const r=muteRect();
  popup(r.x+r.w/2,r.y+r.h+18*u,muted?'SOUND OFF':'SOUND ON',
    muted?'rgba(255,166,166,0.95)':COL.comet,1.05);
  ensureAudio();
  /* musicTick still runs while muted but note()/hat() do not, so a section
     muted mid-flight would never be heard again — end it rather than let it
     run out silently against a ducked bus. */
  if(muted)endSection();
  /* 20ms rather than a jump, so muting mid-decay does not click */
  if(A&&AC)A.out.gain.setTargetAtTime(muted?0:1,AC.currentTime,0.02);
  if(!muted)beep(700,0.08,'sine',0.05,1000);
}
/* `when` schedules on the audio clock instead of setTimeout, so arpeggios
   stay in time and don't fire late when the tab is backgrounded */
/* Kept at its original signature on purpose. Thirty call sites depend on it,
   and replacing them wholesale is how an audio rewrite takes the game down —
   so the bus was built underneath it instead. `pan` and `wet` are optional
   extras; every existing caller keeps working untouched. */
function beep(f,d,type,g,slide,when,pan,wet){
  if(!AC||muted)return;
  try{
    if(!A)buildBus();
    /* GRAVITATIONAL REDSHIFT: inside full BH mode, gameplay SFX sink. It was a
       flat two semitones for the whole mode, which is the one shape a redshift
       cannot have — a constant offset is a transposition, and the ear
       normalises to a transposition within a second or two and then stops
       hearing it. It FALLS now, on the same squared curve as the sub drone in
       bhStep, from nothing at entry to a perfect fourth by the exit: two and a
       half times the old depth, and it arrives rather than simply being on.
       A fourth is also the one deep interval that stays in key — the SFX
       pentatonic transposed down five semitones is still inside the level's
       natural minor, which a flat two semitones never was. Gated on phase 2 so
       the entry beeps (phase 1) and exit beeps (phase 3) keep their pitch. */
    if(BH.phase===2){
      const bq=Math.min(1,BH.t/BH_DUR),rs=Math.pow(2,-5/12*bq*bq);
      f*=rs;if(slide)slide*=rs;
    }
    const t0=AC.currentTime+(when||0),o=AC.createOscillator(),v=AC.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t0);
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,t0+d);
    /* A short attack instead of a step. The old jump was inaudible because an
       oscillator starts at phase zero, but a ramp also lets short cues layer
       without their onsets summing into a spike. */
    const atk=Math.min(0.006,d*0.25);
    v.gain.setValueAtTime(0.0001,t0);
    v.gain.exponentialRampToValueAtTime(Math.max(g,0.0002),t0+atk);
    v.gain.exponentialRampToValueAtTime(0.0001,t0+d);
    o.connect(v);
    let tail=v;
    if(pan&&AC.createStereoPanner){
      const sp=AC.createStereoPanner();
      sp.pan.value=Math.max(-1,Math.min(1,pan));
      v.connect(sp);tail=sp;
    }
    if(A){
      tail.connect(A.world);
      const w=wet===undefined?1:wet;
      if(w>0){const sg=AC.createGain();sg.gain.value=w;tail.connect(sg);sg.connect(A.send);}
    }else tail.connect(AC.destination);
    o.start(t0);o.stop(t0+d+0.02);
  }catch(e){}
}
/* Screen x to pan, narrowed so it never feels gimmicky in headphones — and it
   degrades to nothing on a portrait phone, which sums to one driver anyway. */
function panAt(x){return Math.max(-1,Math.min(1,((x-cx)/(W*0.5))*0.55));}
/* A minor pentatonic has no semitones in it, so any subset of these played
   together is consonant — which is what a ten-shard nova cascade needs. */
/* Extended to fourteen so the PLAYER has a register above the band. Degrees
   0-4 are the band's; 4-13 are the player's, and every one of those is above
   the ~500Hz a phone speaker gives up on. One minor pentatonic throughout,
   scaled per level by LV[].key, so nothing here can clash with anything else.
   THAT IS A CONSTRAINT ON THE CHORDS, NOT A FACT ABOUT THEM. A minor
   pentatonic contains the tonic, third, fourth, fifth and seventh of its
   scale, so it is consonant against any triad built from the natural minor
   and is NOT safe against chords borrowed from outside it — a major dominant,
   the obvious way to make a minor progression sound more finished, puts a
   raised leading tone a semitone under the pentatonic's own seventh in every
   sound effect the game has. Every row of PROG is diatonic to its own natural
   minor for this reason and no other. musiccheck.mjs holds the line. */
const PENT=[440,523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.5,1568,
            1760,2093,2349.32,2637];
const PENT_BASE=PENT.slice();
/* ---------- levels ----------
   The run is SIX LEVELS, the first five with a clear finish line on the
   difficulty clock, each with an intro card naming the mechanics it will
   introduce, and each with its own song — same 104bpm grid (the dub delay
   stays in time), but a new key, a new PROGRESSION, a new arp contour, its
   own bassline, its own payoff hook and a different lean to the kit.

   THE KEYS WALK THE WHOLE-TONE SCALE DOWN AND CLOSE THE CIRCLE. A, G, F, Eb,
   Db, B — six whole steps, which is exactly one lap of the whole-tone scale:
   a seventh level would be A again, an octave below where the game opened.
   That is why there are six and not five or seven. Going deeper into the game
   literally deepens the music, and the descent now has a floor it arrives at
   rather than a slope it falls down forever. The progressions are not
   transpositions of each other — see PROG, which is where the six songs stop
   being one song. Progress persists; death retries the level you are on, so
   later levels are trainable without regrinding.

   THE REGISTER TURNS AROUND EVEN THOUGH THE KEY KEEPS DESCENDING, and levels
   5 and 6 are where that stops being free. LV[].key scales the SFX pentatonic
   and by level 6 it is 0.5612, which puts PENT[0] on B3 at 247Hz against
   level 1's A4 — fine for the effects layer. The BASS is where it breaks:
   PROG's roots are written absolutely and level 6's tonic IS the literal
   descent, 61.74Hz — the turnaround happens in the ARRANGEMENT, not in this
   table. Level 6's bassline rides ch[1] an octave up and touches ch[0] only
   on the downbeat (see its row), and every dedicated SUB voice — the drop's
   boom, the payoff floor, the braam, the layer-three drone — passes through
   subF(), which octave-doubles anything below 40Hz. The pitch CLASS keeps
   descending, which is what the ear actually tracks, while the sounding
   register turns around — the same thing a bass player does walking a line
   down and jumping back up to keep playing. (An earlier version of this
   comment claimed the tables themselves were voiced up an octave and that
   musiccheck pinned a 60Hz floor; neither was true — the tables descend,
   and the floor that exists is subF's 40Hz turnaround, which musiccheck's
   sub-drone check now tracks.) */
/* THE CURRICULUM RULE, REBUILT FOR SIX LEVELS. The owner's call on what
   levels 5 and 6 should introduce was "complete overhaul from the ground up",
   and this is the rule that overhaul lands on.
   It used to end all teaching at level 3's floor, dl 340. That was right when
   level 4 was the only level after it and became wrong the moment there were
   three: LIFT OFF through THE STORM taught nine formations in 340 difficulty-
   seconds, and then EVENT HORIZON, REDSHIFT and HEAT DEATH would have taught
   nothing at all for the twelve minutes that follow. A second half that
   introduces nothing is not an exam, it is a plateau \u2014 which is the exact
   complaint that produced level 4 in the first place, restated one level
   further on. Stretching the old ladder over six levels would have reproduced
   it; the ladder is rebuilt instead.
   THIS COMMIT MOVES THE STRUCTURE, NOT YET THE LADDER, and says so rather
   than describing the game it is on the way to. Right now all nine formations
   still unlock inside dl 0-340 and levels 4, 5 and 6 introduce no new SHAPE
   at all \u2014 the plateau above, one level longer. What has changed is that
   there is somewhere to put the fix: six songs, six keys, six finish lines,
   and a difficulty clock with room past dl 470.
   The ladder rebuild that fills levels 4 and 5 is the next commit and is
   deliberately not pre-announced here. A comment that describes intentions
   is the same defect as a rule that disagrees with its enforcement: it makes
   the careful reader wrong, and this file has paid for that twice.
   The card lines below are checked against MECHANICS.md \u2014 update both
   together. */
const LV=[
 /* THREE LINES, NOT SIX. Playtest, near-verbatim: "initially I felt like
    there were like eight rules so it was sort of hard to keep track of all of
    them — you could consider starting out with just three or four." He was
    counting this card. The game already introduces one mechanic at a time —
    that is the whole tier ladder — and then this screen undercut it by
    previewing the entire syllabus before he had touched anything.
    The three that survive are the two verbs and the thing that hurts. Orbit
    scoring, the musical rule and the star dive all keep their own channels:
    the hint ladder, the level 1 calm lesson and the finale banner. Nothing is
    left untaught, which curriculum.mjs verifies.
    And the red line no longer lies. "red kills you" is false for the first two
    hits of every run, because every run starts with two shields — the same
    playtester hit "a ton of reds" before dying and concluded he had misread
    something. He had not; the card had. */
 {dl0:0,  end:90,  name:'LIFT OFF', key:1,
  mech:[['tap','Tap to turn around'],
        ['swipe',null],   /* null = resolved at draw time by swipeWords() */
        ['shard','Red hits use shields; no shields means game over']]},
 /* THE LATER CARDS STOPPED PREVIEWING THE SYLLABUS. The note above explains
    why level 1's card came down to three lines; levels 2-4 then went on making
    the identical mistake one screen later. Level 2's card listed gates,
    drifters and blinkers \u2014 which unlock at dl 100, 128 and 165, so all three
    were named on a card shown at dl 90, up to 75 seconds before the first one
    exists \u2014 and then named four orbs the player had no referent for in a
    single line. Each of those has a banner that names it and a lesson that
    explains it at the moment it arrives, with a specimen lit and the world
    slowed. A card cannot compete with that; it can only spend the player's
    attention in advance.
    Two lines each now, and they say what the level IS rather than what it will
    contain. Nothing is left untaught, which curriculum.mjs verifies. */
 {dl0:90, end:215, name:'INTO THE RINGS', key:0.8909,
  /* TWIN unlocks at dl 18 and level 1 runs dl 0-90, so every reader of this
     card has already met the shapes. GATES at dl 100 is what level 2 actually
     opens with. */
  mech:[['shard','Tap to turn away from walls'],
        ['beat','Swipe to a ring without red obstacles']]},
 {dl0:215,end:340,name:'THE STORM', key:0.7937,
  mech:[['shard','Tap to turn before a moving wall reaches you'],
        ['star','Collect stars, then complete an orbit']]},
 /* EVENT HORIZON HAS A FINISH LINE NOW, and losing "the endless one" is what
    it is FOR. It was made endless when it was the last level; with two levels
    after it, an endless level in the middle of the run is a wall the game
    never lets you past. It keeps its identity — it is still the black hole's
    level, and it is still the one that opens a fourth orbit — and it gains
    the one thing it never had: a way to finish it. The fourth song drops
    another whole step (A -> G -> F -> Eb) and walks the progression that
    never leaves home, which now reads as the pedal under the black hole
    rather than as the sound of a level nobody completes.
    DIVERS unlock here, at dl 395. The black hole is guaranteed once, as it
    already was, and THE TWIN joins the rotation. */
 {dl0:340,end:470,name:'EVENT HORIZON', key:0.7071,
  /* CARD ROWS QUOTE THE LESSON, WORD FOR WORD where they can. The MEET
     header's doctrine: one sentence per idea, and the same one every time —
     three paraphrases of one sentence read as three rules, which is what
     "there were like eight rules" was actually counting. The banner subs
     already obey it; these rows were the stragglers. */
  mech:[['shard','Watch which ring the red obstacle moves to'],
        /* "ring", not "orbit": the track is a ring in every lesson and banner
           (SECOND RING, "one ring is open"), and orbit is the scoring word */
        ['warp','Black hole: reach the outer ring at ESCAPE']]},
 /* REDSHIFT teaches cross-ring positioning and route control. */
 {dl0:470,end:610,name:'REDSHIFT', key:0.6300,
  mech:[['swipe','Swipe to the ring with no wall'],
        ['star','Scorch clears red obstacles behind you']]},
 /* HEAT DEATH is the currently authored frontier. Infinity keeps play
    available until the next level is built; it is not an endless-mode rule. */
 {dl0:610,end:Infinity,name:'HEAT DEATH', key:0.5612,
  mech:[['shard','Tap to turn; swipe to a ring without red'],
        ['star','Collect stars and complete orbits to score']]}];
/* Declared here rather than beside the death-screen helpers so loadPrefs can
   clamp against it — it used to sit 1,300 lines further down, which put it in
   its own temporal dead zone for everything that boots first. */
const LEVEL_MAX=LV.length;
/* ---------- one mode, and the table that survives it ----------
   CHILL IS GONE FOR NOW. The owner's call: one mode until the game is
   perfected, and then a difficulty conversation from a settled baseline
   rather than alongside one. What is deliberately NOT gone is the mechanism.

   MODES stays, with a single row, and that row is still the IDENTITY: every
   knob 1, or 0 for the additive shield. So every expression the knobs appear
   in — dl(), speedAt(), warnTime(), shardCap(), spawnGap(), the shield bank —
   still reduces to exactly what shipped, and this table still cannot quietly
   become the place the real game is tuned. check.mjs still fails the build if
   a knob stops being neutral or is declared without a call site.

   Keeping it costs one row and buys the thing that was expensive to get
   right: the rule that a second difficulty is a DERIVATIVE and never a second
   implementation. That rule was not obvious, it was arrived at, and it is
   written into the shape of this table and its guards. Deleting the table
   would delete the rule and leave a future second mode to rediscover it —
   most likely as a branch on a flag somewhere in the game code, which is
   exactly what the table exists to prevent. Bringing chill back is adding a
   row; it is not re-deriving a design.

   WHY THE CLOCK IS THE MAIN LEVER, kept here because it is the reasoning a
   second mode will need. Everything that presses on the player — speed, shard
   cap, arrival rate, warning length, the tier ladder, the finish line — is
   already keyed off dl(), the difficulty clock. Slowing that one number eases
   all six together and in the proportions they were tuned in, which is the
   only way "easier" stays recognisably the same game. The other knobs are
   trims on top of it, not a second difficulty curve.

   AND WHAT A MODE MUST NEVER TOUCH: the curriculum, the music, the scoring.
   Orbs and lessons are gated on G.level and tiers on dl, so any future mode
   meets every formation and every orb in the same order at the same points —
   it just gets there in a different number of seconds. curriculum.mjs fails
   if a mode moves a tier, a finish line or a level boundary. */
let MODE='skill';
const MODES={
  skill:{id:'skill',name:'SKILL',tag:'the game at full pace',
    c:COL.comet,
    clock:1,speed:1,warn:1,cap:1,gap:1,shields:0,demo:1}
};
function MD(){return MODES[MODE]||MODES.skill;}
/* THE RECORDS ARE STILL KEYED BY MODE, and the unsuffixed keys are still
   SKILL's — which is the whole reason removing chill costs no player their
   history. Every value ever written to `cometloop:best` and `cometloop:gl`
   was skill's, because chill's went to `:chill`-suffixed keys precisely so
   that a chill best could never redefine what the plain key meant. So with
   chill gone the plain keys mean exactly what they always meant, on every
   device, with nothing to migrate.
   THE `:chill` KEYS ARE LEFT ON DISK, DELIBERATELY. They cost a few bytes,
   nothing reads them, and they are somebody's record — if chill comes back
   it comes back with its history intact. Deleting them would be a one-way
   door opened for tidiness.
   recKey keeps its mode argument even though one mode can only produce one
   answer: it is the seam a second mode returns through, and the guard that
   the unsuffixed key belongs to skill lives inside it. */
const REC={skill:{best:0,lvlMax:1}};
function recKey(k,m){return 'cometloop:'+k+((m||MODE)==='skill'?'':':'+(m||MODE));}
function useMode(m){
  MODE=MODES[m]?m:'skill';
  G.best=REC[MODE].best;G.lvlMax=REC[MODE].lvlMax;
}
/* ---------- the powerup lab ----------
   A door on the title screen, and deliberately NOT a mode. MODES is the
   difficulty table and check.mjs holds it to that: every row the same knobs,
   skill the identity element, no knob declared without a call site. A sandbox
   that pins the difficulty clock and forces one orb is not a difficulty, so
   it is a flag with its own front screen rather than a row — and that stayed
   true when CHILL was retired, which is the test of it: the table went to one
   row and the lab did not become the second one. It navigates the way the
   swipe chooser's `change` control does.

   WHAT IT IS FOR. Six of the seven orbs sit behind a curriculum ladder and the
   seventh is rare on purpose — three blackhole_entered events in the game's
   entire recorded history, every one of them on level 4. Seeing what an orb
   actually feels like meant playing until the game decided to hand you one.
   The lab hands you the one you asked for, again and again, on a board quiet
   enough to watch it work.

   WHAT IT DELIBERATELY IS NOT. Not a way to practise and not a way to farm.
   The clock is pinned at LAB_DL and never ramps, so no level can finish and no
   tier can arrive; and nothing a lab run does reaches the device. No record
   moves, no first-encounter lesson is spent, no preference is written, and no
   telemetry leaves except the single event saying the lab was opened.
   smoke.mjs snapshots localStorage across a whole lab run — entry, orbs taken,
   a death — and fails if one key changes. A tool that quietly rewrites the
   save file it was opened in order to avoid touching is worse than no tool.

   THE WORDING IS THE GAME'S OWN. Every line below is lifted from the channel
   that already explains that orb — hintText for the three intro orbs, MEET for
   the three that carry lessons — so the picker cannot drift into being a second,
   differently-worded description of the same six things. */
const LAB_ORBS=[
 {id:'shield',   n:'SHIELD',    d:'Blocks one red hit'},
 {id:'warp',     n:'SLOW-MO',   d:'Slows movement for 6 seconds'},
 {id:'nova',     n:'NOVA',      d:'Turns red obstacles into stars'},
 {id:'spot',     n:'MAGNET', d:'Nearby stars curve into you for 10 seconds'},
 {id:'hyper',    n:'HYPERNOVA', d:'Move faster, safe from red, for about 9s'},
 {id:'mirror',   n:'THE MIRROR', d:'Collects stars on the far side for about 9s'},
 {id:'scorch',   n:'SCORCH',     d:'Clears red behind you for 8 seconds'},
 {id:'slip',     n:'SLIPSTREAM', d:'Swipe rings to clear red for 12 seconds'},
 {id:'trail',    n:'STAR TRAIL', d:'Nine bonus stars to collect in 16 seconds'},
 {id:'blackhole',n:'BLACK HOLE',d:'Ride the inner ring; swipe out at ESCAPE'}
];
/* THE CALM BOARD, CHOSEN RATHER THAN PICKED OUT OF THE AIR. dl 40 is exactly
   TIERS[3].at — THIRD RING — which is the lowest clock value that gives the
   arena all three orbits. Three matters: the black hole opens a FOURTH ring on
   entry and restores what it found on exit, so a one-ring lab would have
   demonstrated that reveal against nothing. What dl 40 buys everywhere else is
   the quiet: shardCap 4 spread over three rings, a 2.4s arrival gap, speed
   1.62 of a 4.2 ceiling, and a 2.35s telegraph on every shard. Level 1's
   finish line is dl 90 and the clock never moves, so the lab is endless. */
const LAB_DL=40;
const LAB={on:false,type:'blackhole',invuln:true,sel:5};
/* Red cannot touch you with the ghost on. Written as one predicate read at the
   single lethal-contact site rather than as a shield top-up, because a bank
   that refills is still a bank being spent — the pip row would count down and
   the LAST SHIELD popup would fire, both of them lying about a run that cannot
   end. Nothing is consumed and nothing is announced; red simply passes. */
function labGhost(){return LAB.on&&LAB.invuln;}
/* ---------- pause ----------
   A FLAG, NOT A STATE, and that distinction is load-bearing. G.state==='playing'
   gates roughly twenty behaviours, and draw() dispatches on it with the DEATH
   SCREEN as its final else — so a 'paused' state would have rendered GAME OVER
   over a live run the first time anyone pressed the button. The run stays
   'playing' and everything that reads the state stays true; what stops is the
   clock.

   AND STOPPING THE CLOCK IS THE WHOLE MECHANISM. update() opens with G.t+=dt,
   so returning before that line freezes every deadline in the file at once —
   invulnerability, spawn timers, cooldowns, lesson spacing, the tier ladder,
   the difficulty clock, G.vt and the black hole's own tick, which lives inside
   update and would otherwise run the mode to completion behind the panel. It is
   the same argument the mode table makes for using dl() as its lever and the
   lab makes for pinning it: one number, so nothing can drift out of step with
   anything else. runTime() reads G.deadT-G.started, both on G.t, so paused
   seconds leave the reported run length for free rather than by subtraction.

   WHAT IT COSTS TO GET WRONG, already documented elsewhere in this file: the
   pad is eight continuously running oscillators whose gain is written every
   frame by bedTick, its only writer. Freezing update() stops bedTick, and a
   stopped bedTick does not silence the band — it FREEZES it, droning one chord
   at playing volume for as long as the panel is up. Silencing the scheduler is
   not silencing the band. The bed is taken down explicitly on the way in, the
   way the visibilitychange handler already does it, and bedTick restores it on
   the first frame after the countdown.

   THE BOARD IS HIDDEN WHILE PAUSED, which is the balance half. Shards telegraph
   for between one and 2.35 seconds; a button that freezes a warning mid-flight
   and lets you read the board at leisure is a difficulty change wearing a
   convenience label. You cannot study what is not drawn. The countdown covers
   the other direction — the board comes back for three seconds so you can
   re-orient, frozen and unresponsive, and only then does time start again.
   RE-PAUSING IS ON A COOLDOWN for the reason the countdown alone does not
   cover: without one, pause-resume-pause is an unlimited supply of three-second
   frozen looks at a live board, which is the exact thing the hidden board
   exists to prevent, reassembled out of the escape hatch. */
const PAUSE_COUNT=3;    /* seconds of frozen, visible board before play resumes */
const PAUSE_COOL=5;     /* seconds of real play before pause re-arms */
const PAUSE={on:false,resumeT:0,cool:0,n:0,total:0,at:0};
/* PAUSED TIME IS WALL-CLOCK, AND THE FRAME DELTA CANNOT MEASURE IT.
   frame() clamps dt to 0.05s, deliberately, so a stalled tab cannot fast-
   forward the simulation on its first frame back — and while a tab is hidden
   requestAnimationFrame does not fire at all. Accumulating pause duration out
   of dt therefore recorded a ten-minute locked-phone break as a single capped
   frame: 0.05 seconds. That is not a rounding error, it is the exact case the
   field exists to detect, silently reported as its opposite.
   performance.now() is monotonic and answers whether or not any frames ran.
   The countdown deliberately still rides dt: it is an animation, and a tab
   backgrounded mid-count SHOULD hold rather than silently expire.
   Read through a function because the in-flight pause has not been committed
   yet — telemetry can fire while the panel is up only if a later change lets
   it, and a getter cannot be wrong about that the way a bare field can. */
function pauseNow(){try{return performance.now();}catch(e){return 0;}}
function pausedSeconds(){
  return PAUSE.total+(PAUSE.at?Math.max(0,(pauseNow()-PAUSE.at)/1000):0);
}
/* Paused, or counting back in — either way the simulation is frozen. Read by
   update() and by the input handler, so the two can never disagree about
   whether the world is running. */
function frozen(){return PAUSE.on||PAUSE.resumeT>0;}
function canPause(){return G.state==='playing'&&!frozen()&&PAUSE.cool<=0;}
/* THE AUDIO CONTEXT IS DELIBERATELY LEFT RUNNING. Suspending it would freeze
   AC.currentTime and keep MU.next valid, which sounds like the tidy answer and
   is the riskier one: iOS only reliably resumes a context from inside a user
   gesture, the resume would land three seconds later at the end of the
   countdown, and every tap already calls ensureAudio() at the top of the
   handler — so a stray touch on the panel would have un-suspended it behind the
   pause anyway.
   Nothing is needed, because musicTick already survives an arbitrary gap: it
   detects MU.next falling more than 0.4s behind, abandons the section rather
   than replaying it compressed, and restarts on the next grid line. That is the
   path a backgrounded tab has always taken, and its guard++<16 cap bounds the
   worst case regardless. So a pause does exactly what the visibilitychange
   handler does when the tab goes away — that code is the template, and this
   should stay a copy of it rather than a second answer to the same question. */
function pauseAudio(){
  endSection();                        /* banks an earned drop instead of eating it */
  BEATQ.length=0;DROPQ.length=0;       /* or resuming fires a stale drop shake */
  if(BED&&AC)BED.g.gain.setTargetAtTime(0.005,AC.currentTime,0.08);
}
function pauseGame(){
  if(!canPause())return;
  PAUSE.on=true;PAUSE.resumeT=0;PAUSE.n++;PAUSE.at=pauseNow();
  /* a finger held across the pause must not steer the run when it comes back:
     the same reason die() drops it */
  pd=null;
  pauseAudio();
  track('paused',{game_level:G.level,tier:G.tier,score:G.score,
    seconds:Math.round(G.t-G.started),run_index:G.runs});
}
function unpauseGame(){
  if(!PAUSE.on)return;
  PAUSE.on=false;PAUSE.resumeT=PAUSE_COUNT;
  /* resumed from INSIDE the tap that asked for it, which is the only place iOS
     reliably lets a context come back. bedTick restores the pad on the first
     live frame, exactly as it does when a tab becomes visible again. */
  ensureAudio();
}
/* FOUR KEYS WAS NOT FOUR SONGS. Every level walked the identical
   i-VI-III-VII and differed only by transposition, so the harmony under
   EVENT HORIZON was the harmony under LIFT OFF played lower — and the chord
   loop is the one thing a player hears continuously for fifteen minutes.
   "Each level is its own song" was true of the bassline, the riff and the
   solo, and false of the thing underneath all three.
   Each level owns a different minor-mode cadence now. The transposition
   ladder is unchanged (A -> G -> F -> Eb, see LV[].key): going deeper still
   deepens the music, and now it also changes what the music is DOING.

   Every shape is diatonic to its level's natural minor, which is the
   constraint that actually binds here: PENT is scaled by the same L.key and
   every sound effect in the game speaks through it, so one chord from
   outside the mode would put the entire SFX layer out of tune with the band.
   Checked numerically rather than by ear — exact octaves, perfect fifths, and
   no chord introducing a semitone rub against the pentatonic that the shipped
   progressions did not already carry.

   Level 1 is deliberately untouched: it is the first impression, and the
   groove a returning player already knows. */
const PROG=[
 /* LIFT OFF — A minor — i VI III VII. Resolves without ever settling, which
    is what you want under a run that is trying not to end. */
 [[110,220,261.63,329.63],[87.31,174.61,220,261.63],
  [130.81,261.63,329.63,392],[98,196,246.94,293.66]],          /* Am F  C  G  */
 /* INTO THE RINGS — G minor — i VII VI iv. The roots walk down and keep
    walking: G F Eb C, the descending minor tetrachord, with the iv landing
    below the tonic rather than closing above it — so every four bars the loop
    hands itself back unresolved and has to climb to start again.
    The iv is voiced at C2 rather than C3 for that reason and one other: the
    pad glides between chords (setTargetAtTime, see the retune), so a chord
    that leaps is a chord you HEAR swoop. C3 made this the largest glide in
    the game at nine semitones; continuing the descent makes it three. */
 [[98,196,233.08,293.66],[87.31,174.61,220,261.63],
  [77.78,155.56,196,233.08],[65.41,130.81,155.56,196]],        /* Gm F  Eb Cm */
 /* THE STORM — F minor — i III v VI. The roots climb: F Ab C spells the
    tonic triad and Db leans one semitone past the top of it. The only one of
    the four whose bass is a LINE rather than a set of leaps. */
 [[87.31,174.61,207.65,261.63],[103.83,207.65,261.63,311.13],
  [130.81,261.63,311.13,392],[138.59,277.18,349.23,415.30]],   /* Fm Ab Cm Db */
 /* EVENT HORIZON — Eb minor — i VI VII i. A pedal: it leaves home and is
    back inside four bars, forever, which is what the level with no finish
    line should sound like. The third score layer pins its sub to the tonic
    underneath (see the sub drone) so the bottom never moves at all.
    Level 4 crashed on arrival before this row existed — PROG, ARPL, RIFFL and
    SOLOL are all indexed by G.level-1 and all stopped at three, so the fourth
    level read undefined. curriculum.mjs is the only harness that drives far
    enough to have found it. */
 [[77.78,155.56,184.99,233.08],[61.74,123.47,155.56,184.99],
  [69.30,138.59,174.61,207.65],[77.78,155.56,184.99,233.08]],  /* Ebm Cb Db Ebm */
 /* REDSHIFT — Db minor — i iv VII III. THE DESCENDING FIFTHS, which is the
    one strong functional motion in the mode that no other level uses: every
    root falls a fifth to the next (Db Gb Cb Fb, written as rising fourths to
    keep the glide inside seven semitones). It is the progression that is
    always leaving, and it lands on III — the relative major — rather than
    home, so the loop turns back to the tonic from the brightest chord it
    owns instead of cadencing onto it. A sequence, not a circle. */
 [[69.30,138.59,164.81,207.65],[92.50,184.99,220,277.18],
  [123.47,246.94,311.13,369.99],[82.41,164.81,207.65,246.94]], /* Dbm Gbm Cb Fb */
 /* HEAT DEATH — B minor — i iv v VI. Three minor chords in a row, which no
    other level does and which is the coldest colour the mode has, then one
    major that lifts and is immediately taken away again by the turnaround.
    The level that never ends gets the loop that never warms up.
    Its ROOT is the lowest in the game at 61.74Hz, and that is handled in the
    arrangement rather than in this table: level 6's bassline rides ch[1] an
    octave up and touches ch[0] only on the downbeat, the same way level 4
    jumps the octave. A root written low and then played low all bar would
    have given the level people spend the most time in the thinnest bottom
    end in the game. */
 [[61.74,123.47,146.83,185],[82.41,164.81,196,246.94],
  [92.50,184.99,220,277.18],[98,196,246.94,293.66]]];          /* Bm Em F#m G */
const ARPL=[[0,2,4,2,3,2,4,3],[0,3,1,4,2,4,3,1],[0,1,3,2,4,2,3,1],[0,4,2,3,1,3,4,2],
            [0,2,1,3,4,3,1,2],[0,3,4,2,1,2,4,3]];
/* per-level written parts: the riff layer and the afterglow solo are
   different tunes on each level, not the same tune transposed */
const RIFFL=[
 [0,-1,2,-1,3,-1,2,-1, 0,-1,2,-1,4,3,2,-1],
 [0,-1,-1,3,-1,2,-1,-1, 1,-1,-1,3,-1,4,-1,2],
 [0,2,-1,0,3,-1,0,2, 4,-1,3,2,-1,0,-1,-1],
 [0,-1,2,3,-1,2,0,-1, 3,4,-1,3,2,-1,0,-1],
 [0,-1,3,-1,2,4,-1,2, 1,-1,3,-1,4,-1,2,-1],
 [0,4,-1,2,-1,3,-1,1, 2,-1,4,-1,3,2,-1,0]];
const SOLOL=[
 [7,-1,8,-1,9,-1,8,7, -1,5,-1,7,-1,-1,5,-1,
  6,-1,7,-1,9,-1,10,-1, 9,8,-1,7,-1,5,-1,-1],
 [5,-1,-1,7,-1,8,-1,-1, 9,-1,8,-1,7,-1,-1,5,
  -1,6,-1,8,-1,-1,9,-1, 10,-1,9,8,-1,7,-1,-1],
 [7,7,-1,9,-1,7,9,-1, 10,-1,9,-1,8,7,-1,-1,
  5,-1,7,-1,8,-1,9,10, -1,9,-1,7,-1,5,-1,-1],
 [9,-1,10,-1,9,8,-1,7, -1,9,-1,10,-1,12,-1,10,
  9,-1,7,-1,8,-1,9,-1, 7,5,-1,7,-1,-1,5,-1],
 /* REDSHIFT — the solo sinks the way its hook does: each four-note cell
    answers the last one a degree lower */
 [10,-1,9,-1,-1,8,-1,10, 9,-1,8,-1,7,-1,-1,5,
  8,-1,7,-1,6,-1,-1,7, 6,-1,5,-1,-1,3,-1,-1],
 /* HEAT DEATH — the longest notes and the widest gaps of the six; the
    afterglow of the level that is winding down */
 [7,-1,-1,-1,9,-1,-1,10, -1,-1,9,-1,-1,7,-1,-1,
  5,-1,-1,7,-1,-1,8,-1, -1,7,-1,5,-1,-1,-1,-1]];
/* ---------- THE CHORUS ----------
   A VERSE ALONE IS NOT A SONG. Every level walked its one four-chord loop
   forever: the arrangement thickened and thinned (the vertical axis games
   share), but what the harmony was DOING never changed — no section, no lift,
   no form. Each level now owns a SECOND diatonic progression, and the song
   moves between them with the run: play hot and the record lifts into its
   chorus at the next four-bar seam; cool off and it settles back to the
   verse. Horizontal form, driven by play, on top of the vertical layering.

   The shapes are studied from the genre this band imitates (the owner's
   references: Kavinsky — Nightcall, Odd Look, Protovision). Two lessons from
   the records carried here:
   - THE LIFT IS A ROTATION, NOT A KEY CHANGE. Nightcall's chorus never
     modulates: it starts the loop on VI with the tonic withheld until the
     turnaround (F G Em Am under an A-minor verse), and floats. That is
     CHOFF below — the chorus may open on any chord of its row because the
     walk ORDER is a separate fact from the chord INVENTORY.
   - EVERY ROW'S CHORD 0 IS THE i CHORD, IN BOTH TABLES, ALWAYS. CH[0][0] is
     read as "the level's tonic" by roughly twenty-five call sites — the
     snare body, fireDrop, braam, the star-dive floor, the black hole, half
     the SFX layer. The rotation exists so a chorus can START off-tonic
     while CH[0] never stops being the tonic chord those readers assume.
     musiccheck.mjs enforces both halves.

   The four choruses, heard order (walk = row[(bar+CHOFF)%4]):
   L1 LIFT OFF      — VI VII v i  (F G Em Am). The chorus shape Nightcall
     uses, in the key the level shares with it: tonic withheld for three
     bars, home on the fourth. The v is the mode's cool minor dominant —
     lift without a leading tone.
   L2 INTO THE RINGS — VI VII i i (Eb F Gm). The Aeolian cadence — two
     whole-step root ascents into the tonic — where the verse only ever
     descended. Same chords, opposite direction; the loop's last bar IS the
     verse's first, so the sections dovetail with zero seam.
   L3 THE STORM     — i i III VII (Fm Fm Ab Eb). The cell shape Protovision
     runs, its one borrowed chord translated: the record rides two bars of tonic, lifts
     through III and cadences V–i every four bars — the harmonic-minor V is
     unusable here (the raised seventh against the SFX pentatonic), and
     VII–i is the mode's own cadence, so the ramp keeps its shape and burns
     cooler. Asymmetric harmonic rhythm: a ramp, not a circle.
   L4 EVENT HORIZON — iv i III v (Abm Ebm Gb Bbm). The loop shape Odd Look
     rides, in the key the level shares with it (that record sits in Eb
     minor at ~105 BPM — this band's own tempo): launches on the
     subdominant, and the v recycles to iv at the seam instead of
     resolving, endless as the level. Its major V
     is the one chord the record has that this game cannot borrow — the SFX
     pentatonic would rub its raised seventh — so the diatonic v stands in,
     which is also what Nightcall does all along.

   Every chord is diatonic to its level's natural minor, same as PROG — the
   constraint that binds the whole audio path binds the chorus too. */
const PROGB=[
 [[110,220,261.63,329.63],[87.31,174.61,220,261.63],
  [98,196,246.94,293.66],[82.41,164.81,196,246.94]],          /* Am F  G  Em  */
 [[98,196,233.08,293.66],[98,196,233.08,293.66],
  [77.78,155.56,196,233.08],[87.31,174.61,220,261.63]],       /* Gm Gm Eb F   */
 [[87.31,174.61,207.65,261.63],[87.31,174.61,207.65,261.63],
  [103.83,207.65,261.63,311.13],[77.78,155.56,196,233.08]],   /* Fm Fm Ab Eb  */
 [[77.78,155.56,184.99,233.08],[92.50,184.99,233.08,277.18],
  [116.54,233.08,277.18,349.23],[103.83,207.65,246.94,311.13]], /* Ebm Gb Bbm Abm */
 /* L5 REDSHIFT — VI III VII i (Bbb Fb Cb Dbm, heard from slot 1). The verse
    is always leaving; the chorus is the one thing in the level that arrives.
    Its roots fall a fifth, a fifth, then step UP a whole tone onto the tonic
    — the full Aeolian cadence — so the section that answers a sequence of
    departures is the one that finally lands. */
 [[69.30,138.59,164.81,207.65],[110,220,277.18,329.63],
  [82.41,164.81,207.65,246.94],[61.74,123.47,155.56,185]],      /* Dbm Bbb Fb Cb */
 /* L6 HEAT DEATH — III VII iv i (D A Em Bm, heard from slot 1). Opens on the
    relative major, the brightest chord the level owns, and falls the whole
    way home — the only chorus in the game that is a single continuous
    descent. The last level's lift is a long cooling off, not a climb. */
 [[61.74,123.47,146.83,185],[73.42,146.83,185,220],
  [110,220,277.18,329.63],[82.41,164.81,196,246.94]]];          /* Bm D A Em */
/* where each chorus's walk begins in its row — the rotation that lets a
   chorus open off-tonic while row slot 0 stays the i chord */
const CHOFF=[1,2,0,3,1,1];
/* HOW LONG AN EARNED CHORUS LASTS AFTER THE EARNING STOPS, in bars. The
   section used to settle back at the very next four-bar seam the moment the
   hot state lapsed, which is why it read as a flicker rather than a section:
   PLAY.heat is +0.26 a tap against 0.34/s of decay, so it collapses within a
   second of the player's hands going quiet, and the chorus went with it.
   Twelve bars is ~28s — a section length rather than a gust. Entry is
   untouched and still has to be earned; this only governs the exit, and
   musiccheck asserts both halves separately. */
const CHOR_HOLD=12;
/* THE COLOR TONE: each chorus chord's own stacked-third seventh, sustained
   once a bar an octave up — m7 on the minor chords, maj7 on III and VI, and
   on VII the stacked third lands a minor seventh over a major triad: the
   mode's dominant-shaped chord, no raised leading tone anywhere. Diatonic
   by construction (a third above the chord's fifth never leaves the scale);
   held to that numerically in musiccheck. Indexed like PROGB rows. */
const SEVB=[
 [196,164.81,174.61,146.83],       /* G  E  F  D  — Am7 Fmaj7 G7 Em7   */
 [174.61,174.61,146.83,155.56],    /* F  F  D  Eb — Gm7 Gm7 Ebmaj7 F7  */
 [155.56,155.56,196,138.59],       /* Eb Eb G  Db — Fm7 Fm7 Abmaj7 Eb7 */
 [138.59,174.61,207.65,184.99],    /* Db F  Ab Gb — Ebm7 Gbmaj7 Bbm7 Abm7 */
 [123.47,207.65,155.56,110],       /* Cb Ab Eb Bbb — Dbm7 Bbbmaj7 Fbmaj7 Cb7 */
 [110,138.59,196,146.83]];         /* A  C# G  D  — Bm7 Dmaj7 A7 Em7 */
/* the chorus arps: same even-eighth grid, same 0-4 ceiling (the band still
   stops below the player's floor), different contour — the surface the ear
   tracks bar to bar, so the section change reads melodically too */
const ARPBL=[[2,4,3,4,2,4,3,4],[0,1,2,3,4,3,2,1],[3,4,3,4,2,4,3,4],[4,0,3,0,4,1,4,2],
             [1,3,2,4,1,3,2,4],[4,2,4,1,3,1,4,2]];
/* ONE WRITER FOR THE SECTION. CH and ARP are the live tables everything
   reads — the pad retune, chTone, every bassline — so swapping the section
   is copying a row set, and everything downstream follows by construction.
   Callable any time: the pad retunes at the next bar line, not here. */
function applySect(s){
  if(MU)MU.sect=s;
  const li=G.level-1;
  const rows=s?PROGB[li]:PROG[li];
  for(let j=0;j<4;j++)CH[j]=rows[j];
  const arp=s?ARPBL[li]:ARPL[li];
  for(let i=0;i<ARP.length;i++)ARP[i]=arp[i];
}
function applyLevelMusic(){
  const L=LV[G.level-1];
  for(let i=0;i<PENT.length;i++)PENT[i]=PENT_BASE[i]*L.key;
  applySect(0);   /* a level always opens on its verse */
}
/* THE WHAAA. The braam from the drop hit — sub boom under a swelling
   fifth-stack — promoted to the game's signature voice: level starts and
   finishes, overdrive, golden laps, novas, new layers. Every big moment
   speaks in the same deep breath the playtest kept pointing at. */
function braam(g,pan){
  if(!AC)return;
  const f=CH[0][0],t0=AC.currentTime;
  note(subF(f*0.375),t0,0.9,'sine',g*1.1,320);
  swellPad(f,t0+0.01,1.4,g,pan||0);
  swellPad(f*1.5,t0+0.01,1.4,g*0.75,(pan||0)+0.15);
}
/* One event, one impact: a close attack, a tuned body and a spacious tail.
   Direct world routing keeps the strike audible through its own band duck.
   At most five pitched voices and one brief noise source, only on the event. */
function soundImpact(kind,strength){
  if(!AC||muted||frozen())return;
  if(!A)buildBus();if(!A)return;
  const k=Math.max(.2,Math.min(1.2,strength===undefined?1:strength));
  const f=CH[0][0],t=AC.currentTime,fifth=Math.pow(2,7/12);
  const nova=kind==='nova',hyper=kind==='hyper',orbit=kind==='orbit';
  if(!nova&&!hyper&&!orbit)return;
  duckBed(orbit?.72:.22,orbit?.16:.34);
  note(subF(f*.5),t,orbit?.28:.72,'sine',(orbit?.031:.067)*k,380,0,A.world);
  note(f*2,t+.004,orbit?.20:.48,'triangle',(orbit?.025:.044)*k,2200,-.1,A.world);
  if(hyper){
    for(let i=0;i<3;i++)note(PENT[4+i*2],t+i*S16*.5,.23+i*.08,'sawtooth',.025*k,2400+i*700,(i-1)*.2,A.perf);
  }else{
    note(f*4,t+.018,orbit?.22:.70,'triangle',(orbit?.020:.033)*k,4200,-.23,A.world);
    note(f*4*fifth,t+(orbit?.075:.055),orbit?.30:1.02,'sine',(orbit?.016:.029)*k,6000,.23,A.world);
  }
  if(!NOISE||orbit)return;
  try{
    const s=AC.createBufferSource(),bp=AC.createBiquadFilter(),v=AC.createGain();
    s.buffer=NOISE;bp.type='bandpass';bp.Q.value=.8;
    bp.frequency.setValueAtTime(nova?3200:1800,t);
    bp.frequency.exponentialRampToValueAtTime(nova?650:4200,t+.23);
    v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(.055*k,t+.004);
    v.gain.exponentialRampToValueAtTime(.0001,t+.25);
    s.connect(bp);bp.connect(v);v.connect(A.world);s.start(t);s.stop(t+.28);
  }catch(e){}
}
/* THE EAR LEARNS THE LANGUAGE (playtest, near-verbatim: "I'm too focused
   to read the text... if a sound always accompanied that text then I could
   know what's being said without having to actually read it"). Three cues,
   each meaning exactly one thing and never borrowed for anything else:
   cueUnlock — a new mechanic just arrived (tier banners only);
   cueLesson — a teaching sentence is on screen (first-encounter lessons);
   cueState  — a standing bonus state opened (rising) or closed (falling):
   overcharge, spotlight, overdrive. Chord-aware and quiet, so they sit
   inside the record instead of on top of it. */
function cueUnlock(){
  cueTone(function(w){
    const t0=AC.currentTime+w;
    note(chTone(0),t0,0.14,'square',0.030,2200,-0.15,undefined,0.35);
    note(chTone(2),t0+S16,0.14,'square',0.030,2400,0,undefined,0.35);
    note(chTone(4),t0+2*S16,0.20,'square',0.034,2600,0.15,undefined,0.4);
  });
}
function cueLesson(){
  cueTone(function(w){
    const t0=AC.currentTime+w;
    note(chTone(2)*0.5,t0,0.16,'sine',0.030,1500,-0.1);
    note(chTone(0)*0.5,t0+2*S16,0.22,'sine',0.026,1300,0.1);
  });
}
function cueState(on){
  cueTone(function(w){
    const t0=AC.currentTime+w,st=S16*0.5;
    for(let i=0;i<3;i++){
      const ci=on?i*2:4-i*2;
      note(chTone(ci)*2,t0+i*st,0.09,'triangle',on?0.020:0.014,3200,(i-1)*0.15);
    }
  });
}
function levelComplete(){
  if(G.state!=='playing')return;
  flushLesson(true);   /* a lesson the finish line interrupted is still recorded */
  G.state='lvend';G.lvT=G.t;
  G.lvCard={done:true,next:G.level+1};
  /* only a real advance offers a pick — a retry re-reads the same card and
     must not hand out a second upgrade for dying */
  if(G.level+1<=LEVEL_MAX)rollOffer();
  G.carryScore=G.score;
  /* THE WHOLE RUN, NOT THE LAST LEVEL. startGame restores the carried score
     but zeroed every counter beside it and re-baselined the clock, so a player
     who cleared three levels and died 30s into level 4 shared a four-figure
     cumulative score next to "3 orbits · ×1 streak · 0:30" — a six-minute
     session reported as half a minute, with the score as the only honest
     number on a screen whose entire job is to summarise the run. */
  G.carryOrbits=G.orbits;G.carryLands=G.lands;
  G.carryStreak=Math.max(G.carryStreak,G.bestStreak);
  G.carryGroove=Math.max(G.carryGroove,G.bestGroove);
  G.carryTime=(G.carryTime||0)+Math.max(0,G.t-G.started);
  /* the deepest-level record is written where every other record is — at
     death, beside G.best — so the announcement can fire exactly once. Bumping
     it here instead meant the record had already moved by the time the death
     screen tried to compare against it. */
  track('level_cleared',{
    game_level:G.level,score:G.score,run_index:G.runs,
    seconds:Math.round(G.t-G.started),
    /* THE ONLY EVENT THAT CAN REPORT A CLEARED LEVEL'S PAUSES. run_ended fires
       on death and carries the counters startGame() re-baselined at this
       boundary, so without these two a pause taken on level 1 of a run that
       died on level 4 was recorded nowhere at all — the counters existed, were
       reset, and the data was simply gone. Same scale as `seconds` above, so
       the run total is a sum across a run_index either way. */
    pauses:PAUSE.n,paused_seconds:Math.round(pausedSeconds()),
    /* the same pair run_ended carries, for the same reason as `pauses` */
    chorus_entries:G.chorusN,chorus_bars:G.chorusBars,
    /* how the Star Dive went: 11 is the perfect ending */
    fin_got:(FIN.on||FIN.done)?FIN.got:null,
    fin_perfect:(FIN.on||FIN.done)&&FIN.got>=11
  });
  braam(0.07);
  ripple(cx,cy,COL.ember);
  if(!RM)G.rings.push({x:cx,y:cy,r:radiusOf(0),life:1,col:COL.ember,sp:420,dec:1.0,fat:1});
  gameHaptic('reward',[40,30,40,30,90]);
}

/* ---------- persistence (no-ops gracefully if unavailable) ----------
   localStorage is the real store. window.storage is the async host API this
   was first written against; it is still read and written when present so the
   same file works in either place. Both are wrapped: private-mode Safari
   throws on write, and file:// can throw on read. */
function readLocal(k){
  try{return window.localStorage?localStorage.getItem(k):null;}catch(e){return null;}
}
function loadPrefs(){
  /* The record is read per mode and copied into G.best / G.lvlMax by useMode
     below. There is one mode, so this reads one pair of keys — but it stays a
     loop over Object.keys(MODES) rather than two hardcoded reads, because
     that is the difference between adding a mode later and remembering to
     add a mode HERE later. The unsuffixed keys are SKILL's and always were,
     so a device reads back exactly what it wrote. */
  for(const mk of Object.keys(MODES)){
    const b=parseInt(readLocal(recKey('best',mk)),10);
    if(!isNaN(b))REC[mk].best=Math.max(REC[mk].best,b);
    /* `cometloop:level` is retired and deliberately NOT read: it held the
       ten-rung tier ordinal, so a device that stored a 7 under it would read
       back as level 7 of 3. `cometloop:gl` is the one level record. */
    const gl=parseInt(readLocal(recKey('gl',mk)),10);
    if(!isNaN(gl))REC[mk].lvlMax=Math.max(1,Math.min(LEVEL_MAX,gl));
  }
  const r=parseInt(readLocal('cometloop:runs'),10);
  if(!isNaN(r))G.runs=Math.max(G.runs,r);
  G.introPending=readLocal('cometloop:intro')==='active';
  /* `cometloop:mode` is retired: there is one mode and the menu no longer
     offers a choice. Deliberately NOT read — a device that last played chill
     has a 'chill' sitting under this key, and honouring it would select a
     mode that no longer exists. useMode's own fallback would catch that, but
     the honest fix is not to ask. The key is left on disk with the `:chill`
     records, for the same reason. */
  useMode('skill');
  const m=readLocal('cometloop:muted');
  if(m!==null)muted=(m==='1');
  /* absent means this device has never been asked — the chooser is shown once */
  const sw=readLocal('cometloop:swipe');
  if(sw==='screen'||sw==='radial'){SWIPE_MODE=sw;G.swipeAsked=true;}
  /* Deliberately never reset by startGame: it records whether this human has
     ever found the mechanic, not whether this run has. */
  if(readLocal('cometloop:groove')==='1')G.didGroove=true;
  /* Whether this human has ever landed a hop — the rehearsal only interrupts
     a run for someone the gesture has never once worked for. */
  if(readLocal('cometloop:hopped')==='1')G.everHopped=true;
  if(readLocal('cometloop:landed')==='1')G.everLanded=true;
  const st=parseInt(readLocal('cometloop:struggle'),10);
  if(!isNaN(st))G.struggle=st;
  /* which formation types this device has already been introduced to —
     and which have already spent their one death-triggered re-offer */
  const sn=readLocal('cometloop:seen');
  if(sn)for(const k of sn.split(','))if(k)G.seen[k]=1;
  const sn2=readLocal('cometloop:seen2');
  if(sn2)for(const k of sn2.split(','))if(k)G.seen2[k]=1;
  try{
    if(!window.storage||!window.storage.get)return;
    /* The host store is read per mode too, and into REC rather than straight
       into G: these land asynchronously, and the MODE check below is what
       keeps a late arrival for one mode off the screen while another is
       selected. With one mode that check is always true — it stays because
       the asynchrony does not go away when the second mode comes back. */
    for(const mk of Object.keys(MODES)){
      (function(m){
        window.storage.get(recKey('best',m)).then(function(r){
          const v=r&&parseInt(r.value,10);
          if(v&&!isNaN(v)){REC[m].best=Math.max(REC[m].best,v);
            if(MODE===m)G.best=REC[m].best;}
        }).catch(function(){});
        window.storage.get(recKey('gl',m)).then(function(r){
          const v=r&&parseInt(r.value,10);
          if(v&&!isNaN(v)){REC[m].lvlMax=Math.max(REC[m].lvlMax,Math.min(LEVEL_MAX,v));
            if(MODE===m)G.lvlMax=REC[m].lvlMax;}
        }).catch(function(){});
      })(mk);
    }
    window.storage.get('cometloop:runs').then(function(r){
      const v=r&&parseInt(r.value,10);
      if(v&&!isNaN(v))G.runs=Math.max(G.runs,v);
    }).catch(function(){});
    window.storage.get('cometloop:muted').then(function(r){
      if(r)muted=(r.value==='1');
    }).catch(function(){});
  }catch(e){}
}
function savePref(k,v){
  try{if(window.localStorage)localStorage.setItem(k,String(v));}catch(e){}
  try{
    if(window.storage&&window.storage.set)window.storage.set(k,String(v)).catch(function(){});
  }catch(e){}
}

/* ---------- the cloud: an account, records that follow it, a leaderboard ----
   OPTIONAL, EVERYWHERE, IN THE SAME SENSE THE SOUND IS. The menu says "best
   with sound on — never required" and means it: muted play keeps every
   mechanic whole. This holds itself to the identical rule. Signed out, offline,
   blocked by an extension, or served from a host with no functions behind it —
   the game is exactly the game, localStorage is still the real store, and every
   record still works. Nothing here is ever on the path between a tap and a
   comet moving.

   WHERE IT PLUGS IN, AND WHY NOTHING HAD TO BE REBUILT. loadPrefs() has always
   read an optional async `window.storage` beside localStorage and folded the
   two together with Math.max, because the file was first written against a host
   that supplied one. That seam is exactly a cloud save: this installs a
   window.storage backed by /api/progress, and the records, the preferences and
   the taught-mechanics set sync on a path that already existed and is already
   merge-safe. savePref() writes through it for free.

   THE MERGE IS DONE ON THE SERVER, NOT HERE. Two devices on one account means
   two writers, and "whoever closed the tab last wins" would let a phone that
   has not synced since Tuesday erase Thursday's best score. netlify/lib/
   records.mjs takes the max of each record instead, so the two devices commute
   and an offline device is safe to sync days later. It is also why this can
   post cheerfully without reading first: it cannot lower anything. */
const CLOUD_ORIGIN='https://cosmo-arcade.netlify.app';
const CLOUD={
  user:null,          /* {email} once signed in */
  doc:null,           /* the synced document, or null */
  board:null,         /* the last leaderboard read */
  busy:false,err:'',note:'',
  open:false,view:'in' /* 'in' | 'up' | 'me' | 'board' */
};
let cloudTok=null;    /* {id,key,name} — the whole credential */
/* Declared here rather than beside track() below, because cloudSaveTok writes
   it during load and a `let` declared further down the file would still be in
   its temporal dead zone at that moment. */
let TELE_ACCT=null;
let cloudReady=null;  /* resolves with the doc, so storage.get can await it */
let cloudTimer=0;

function cloudSaveTok(t){
  cloudTok=t;
  try{
    if(!window.localStorage)return;
    if(t)localStorage.setItem('cometloop:auth',JSON.stringify(t));
    else localStorage.removeItem('cometloop:auth');
  }catch(e){}
  /* THE JOIN BETWEEN THE TWO DATA SETS IS THIS ONE PROPERTY. Netlify holds the
     records and the board keyed by account id; PostHog holds the play funnel
     keyed by an anonymous per-device id. Stamping the account id onto events
     is what lets one be read against the other — "how does THIS player's
     retention look" — without turning the funnel into personal data: it stays
     an opaque id, the events stay $process_person_profile:false, and a device
     that never signs in is exactly as anonymous as it was before. */
  try{TELE_ACCT=t?t.id:null;}catch(e){}
}
function cloudLoadTok(){
  try{
    const raw=readLocal('cometloop:auth');
    if(!raw)return null;
    const t=JSON.parse(raw);
    return (t&&t.id&&t.key)?t:null;
  }catch(e){return null;}
}

function cloudApi(path,opts){
  const o=opts||{};
  return fetch(CLOUD_ORIGIN+path,{
    method:o.method||'GET',
    headers:o.headers||{'content-type':'application/json'},
    body:o.body
  }).then(function(r){
    return r.json().catch(function(){return {};}).then(function(j){
      if(!r.ok)throw new Error((j&&j.error)||('request failed ('+r.status+')'));
      return j;
    });
  });
}

/* NOTHING EXPIRES, SO NOTHING REFRESHES. The key is the credential and it does
   not age — which is the whole benefit of dropping passwords, and the whole
   cost: there are no sessions to end, so signing out is a local erase and a
   lost device stays signed in until the account is abandoned. Sized to a group
   of friends testing a game; see netlify/lib/accounts.mjs. */
function cloudAuthed(path,opts){
  if(!cloudTok)return Promise.reject(new Error('signed out'));
  const o=opts||{};
  return cloudApi(path,{method:o.method,body:o.body,
    headers:{'content-type':'application/json',
      'authorization':'Bearer '+cloudTok.id+'.'+cloudTok.key}});
}

/* ---- the synced document ---- */
function cloudPull(){
  return cloudAuthed('/api/progress').then(function(j){
    CLOUD.doc=j.doc||{};
    return CLOUD.doc;
  }).catch(function(){
    /* offline or signed out: the game carries on with localStorage alone */
    CLOUD.doc=CLOUD.doc||{};
    return CLOUD.doc;
  });
}
function cloudPushNow(){
  if(!cloudTok||!CLOUD.doc)return Promise.resolve();
  return cloudAuthed('/api/progress',{method:'PUT',
    body:JSON.stringify({doc:CLOUD.doc})})
    .then(function(j){
      /* the server hands back the MERGED document, which is how a device that
         posted a stale record learns the better one it just lost to */
      if(j&&j.doc){CLOUD.doc=j.doc;cloudAdopt(j.doc);}
    }).catch(function(){});
}
function cloudPush(){
  if(runtimeDestroyed)return;
  /* Debounced: a run's end writes several keys in the same breath and each one
     is not worth a request. */
  if(cloudTimer)clearTimeout(cloudTimer);
  cloudTimer=setTimeout(function(){cloudTimer=0;cloudPushNow();},1200);
}

/* Fold a freshly-arrived document into the live game, using the same rules
   loadPrefs uses for a local read. Called after a pull and after a push, so a
   record set on another device shows up on the title screen without a reload. */
function cloudAdopt(d){
  if(!d)return;
  const b=parseInt(d.best,10);
  if(!isNaN(b)&&b>REC[MODE].best){REC[MODE].best=b;G.best=b;savePrefLocal(recKey('best'),b);}
  const gl=parseInt(d.gl,10);
  if(!isNaN(gl)){
    const v=Math.max(1,Math.min(LEVEL_MAX,gl));
    if(v>REC[MODE].lvlMax){REC[MODE].lvlMax=v;G.lvlMax=v;savePrefLocal(recKey('gl'),v);}
  }
  const r=parseInt(d.runs,10);
  if(!isNaN(r)&&r>G.runs){G.runs=r;savePrefLocal('cometloop:runs',r);}
  if(d.groove==='1'&&!G.didGroove){G.didGroove=true;savePrefLocal('cometloop:groove','1');}
  if(d.hopped==='1'&&!G.everHopped){G.everHopped=true;savePrefLocal('cometloop:hopped','1');}
  if(d.landed==='1'&&!G.everLanded){G.everLanded=true;savePrefLocal('cometloop:landed','1');}
  if(d.seen)for(const k of String(d.seen).split(','))if(k)G.seen[k]=1;
  if(d.seen2)for(const k of String(d.seen2).split(','))if(k)G.seen2[k]=1;
  if(d.name)CLOUD.name=d.name;
}

/* A local-only write. cloudAdopt must not call savePref, because savePref
   writes back through window.storage and a document that writes itself back
   into itself is a loop that ends in a request per frame. */
function savePrefLocal(k,v){
  try{if(window.localStorage)localStorage.setItem(k,String(v));}catch(e){}
}

/* THE SEAM. Installed only while signed in, and removed on sign-out, so the
   signed-out game is byte-for-byte the game that shipped before any of this. */
function cloudInstallStorage(){
  cloudReady=cloudPull();
  window.storage={
    get:function(k){
      const kk=String(k).replace(/^cometloop:/,'');
      return cloudReady.then(function(d){
        return (d&&d[kk]!=null)?{value:String(d[kk])}:null;
      });
    },
    set:function(k,v){
      const kk=String(k).replace(/^cometloop:/,'');
      if(!CLOUD.doc)CLOUD.doc={};
      CLOUD.doc[kk]=String(v);
      cloudPush();
      return Promise.resolve();
    }
  };
  runtimeCloudStorage=window.storage;
}
function cloudRemoveStorage(){
  try{delete window.storage;}catch(e){window.storage=undefined;}
}

/* ---- sessions ---- */
function cloudAdoptSession(j){
  cloudSaveTok({id:j.id,key:j.key,name:j.name||''});
  CLOUD.user={name:j.name||''};CLOUD.name=j.name||'';
  cloudInstallStorage();
  /* Push what this device already knows the moment the account is attached.
     A player who has been playing signed out for a week has records worth
     keeping, and the server-side max merge is what makes sending them safe. */
  return cloudReady.then(function(){
    if(!CLOUD.doc)CLOUD.doc={};
    const local={best:String(REC[MODE].best||0),gl:String(REC[MODE].lvlMax||1),
      runs:String(G.runs||0)};
    if(G.didGroove)local.groove='1';
    if(G.everHopped)local.hopped='1';
    if(G.everLanded)local.landed='1';
    const seen=Object.keys(G.seen||{}).join(',');if(seen)local.seen=seen;
    const seen2=Object.keys(G.seen2||{}).join(',');if(seen2)local.seen2=seen2;
    for(const k in local)if(CLOUD.doc[k]==null)CLOUD.doc[k]=local[k];
    else CLOUD.doc[k]=local[k];
    return cloudPushNow();
  });
}
/* A name goes in, an account comes out. One field, one tap, no email. */
function cloudCreate(name){
  return cloudApi('/api/auth',{method:'POST',
    body:JSON.stringify({action:'create',name:name})})
    .then(function(j){return cloudAdoptSession(j);});
}
/* The other half of "personal": the same person on a second device. */
function cloudLink(code){
  return cloudApi('/api/auth',{method:'POST',
    body:JSON.stringify({action:'link',code:code})})
    .then(function(j){return cloudAdoptSession(j);});
}
function cloudCode(){
  return cloudAuthed('/api/auth',{method:'POST',
    body:JSON.stringify({action:'code'})});
}
function cloudRename(name){
  return cloudAuthed('/api/auth',{method:'POST',
    body:JSON.stringify({action:'rename',name:name})})
    .then(function(j){
      CLOUD.name=j.name;
      if(cloudTok)cloudSaveTok({id:cloudTok.id,key:cloudTok.key,name:j.name});
      CLOUD.user={name:j.name};
      return j;
    });
}
function cloudSignOut(silent){
  cloudSaveTok(null);
  CLOUD.user=null;CLOUD.doc=null;CLOUD.board=null;
  cloudRemoveStorage();
  if(!silent)CLOUD.note='signed out — this device keeps its own records';
}

/* ---- the board ---- */
function cloudBoard(){
  const p=cloudTok
    ? cloudAuthed('/api/scores')
    : cloudApi('/api/scores');
  return p.then(function(j){CLOUD.board=j;return j;});
}

/* Offered at the end of a run, never on the path of one. A failure here is
   silent by design: a player who just died does not need a network error, and
   the next run offers the score again. */
function cloudSubmit(score,level,secs){
  if(!cloudTok||LAB.on||!score||score<=0)return;
  if(secs<5)return;
  cloudAuthed('/api/scores',{method:'POST',
    body:JSON.stringify({score:Math.round(score),level:level,
      runTime:Math.round(secs),name:CLOUD.name||''})})
    .then(function(j){
      if(j&&j.improved&&j.rank)CLOUD.note='leaderboard: #'+j.rank;
      if(j&&j.name)CLOUD.name=j.name;
    }).catch(function(){});
}

/* Restore a session on load, BEFORE loadPrefs runs, so the first read of
   window.storage is a real one rather than a miss. */
(function(){
  const t=cloudLoadTok();
  if(!t)return;
  cloudSaveTok(t);                 /* also restamps the telemetry join */
  CLOUD.user={name:t.name||''};CLOUD.name=t.name||'';
  cloudInstallStorage();
})();

/* ---------- the account panel ----------
   Four views behind one door: sign in, create an account, your own standing,
   and the board. It exists only on the title screen and is torn down before a
   run can start, so nothing here is ever between a tap and a comet. */
const acEl=document.getElementById('acct'),acH=document.getElementById('ac-h'),
      acSub=document.getElementById('ac-sub'),acBody=document.getElementById('ac-body');

/* EVERY HARNESS BUT ONE RUNS THIS FILE AGAINST A STUBBED DOM, and a stub's
   getElementById returns an object that is not an element. This is the only
   part of the game that reaches for real DOM nodes, so it is the only part
   that has to survive not finding any — and it found out the honest way, by
   failing musiccheck on the first run after it was written.
   Guarding rather than feature-detecting once at the top, because the panel is
   inert without a real document either way: what matters is that LOADING the
   game never throws, and the screen this drives cannot be opened in a
   harness. */
function acOn(el,ev,fn){
  try{if(el&&typeof el.addEventListener==='function')runtimeListen(el,ev,fn);}catch(e){}
}
const AC_DOM=!!(acEl&&typeof acEl.addEventListener==='function'&&acEl.classList);

/* EVERY NAME ON THE BOARD IS A STRING A STRANGER CHOSE. The server bounds it
   to twelve printable characters, and `<` is a printable character — so the
   only thing standing between a display name and script execution on every
   other player's device is this function. Text goes in through here or it does
   not go in. */
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
}
const num=n=>String(n==null?0:n).replace(/\B(?=(\d{3})+(?!\d))/g,',');

function openAccount(){
  if(!AC_DOM)return;
  CLOUD.open=true;CLOUD.err='';CLOUD.note='';
  CLOUD.view=cloudTok?'me':'in';
  acEl.classList.add('on');
  acRender();
}
function closeAccount(){
  CLOUD.open=false;CLOUD.err='';
  if(!AC_DOM)return;
  acEl.classList.remove('on');
  acBody.innerHTML='';          /* drop the inputs rather than leave a password in the DOM */
}
acOn(document.getElementById('ac-x'),'click',closeAccount);
/* A tap on the veil behind the panel closes it, the way every other door in
   this game has a way back that costs nothing. */
acOn(acEl,'click',function(e){if(e.target===acEl)closeAccount();});

function acMsg(){
  if(CLOUD.err)return '<p class="msg err">'+esc(CLOUD.err)+'</p>';
  if(CLOUD.note)return '<p class="msg ok">'+esc(CLOUD.note)+'</p>';
  return '';
}

function acRender(){
  const v=CLOUD.view;

  /* ONE FIELD. The whole argument for dropping passwords is that a friend
     should be playing within a few seconds of deciding to, so this screen asks
     for a name and nothing else — no email, no confirmation, no second field
     to tab to on a phone. */
  if(v==='in'){
    acH.textContent='PICK A NAME';
    acSub.textContent='this is the name on the leaderboard';
    acBody.innerHTML=
      '<label for="ac-nm">name</label>'+
      '<input id="ac-nm" type="text" maxlength="12" autocomplete="nickname" '+
        'autocapitalize="characters" autocorrect="off" spellcheck="false" '+
        'placeholder="up to 12 characters">'+
      '<button class="go" id="ac-go">START PLAYING</button>'+
      '<button class="alt" id="ac-alt">I have a code from another device</button>'+
      acMsg()+
      '<p class="foot">No email and no password. This device remembers you; a '+
      'code moves you to another one. The game keeps every record here either '+
      'way, so signing in is optional.</p>';
    runtimeListen(document.getElementById('ac-go'),'click',acCreate);
    runtimeListen(document.getElementById('ac-alt'),'click',function(){
      CLOUD.view='code';CLOUD.err='';CLOUD.note='';acRender();});
    acEnter(acCreate);
    const nm=document.getElementById('ac-nm');
    if(nm&&CLOUD.name)nm.value=CLOUD.name;
    return;
  }

  if(v==='code'){
    acH.textContent='ENTER A CODE';
    acSub.textContent='from the device you already play on';
    acBody.innerHTML=
      '<label for="ac-cd">code</label>'+
      '<input id="ac-cd" type="text" maxlength="7" autocapitalize="characters" '+
        'autocorrect="off" spellcheck="false" placeholder="6 characters" '+
        'style="letter-spacing:.3em;text-align:center;font-size:22px">'+
      '<button class="go" id="ac-go">SIGN IN</button>'+
      '<button class="alt" id="ac-alt">back</button>'+
      acMsg()+
      '<p class="foot">Open your account on the other device and choose '+
      '&ldquo;play on another device&rdquo; to get a code. It lasts ten minutes '+
      'and works once.</p>';
    runtimeListen(document.getElementById('ac-go'),'click',acLink);
    runtimeListen(document.getElementById('ac-alt'),'click',function(){
      CLOUD.view='in';CLOUD.err='';CLOUD.note='';acRender();});
    acEnter(acLink);
    return;
  }

  if(v==='me'){
    acH.textContent=CLOUD.name?esc(CLOUD.name).toUpperCase():'YOUR ACCOUNT';
    acSub.textContent='records follow you to any device';
    acBody.innerHTML=
      '<div class="rec">'+
        '<div><b>'+num(G.best)+'</b><span>best score</span></div>'+
        '<div><b>'+esc(LV[Math.max(0,Math.min(LV.length-1,(G.lvlMax||1)-1))].name)+
          '</b><span>furthest</span></div>'+
      '</div>'+
      '<button class="go" id="ac-board">LEADERBOARD</button>'+
      '<button class="alt" id="ac-dev">play on another device</button>'+
      '<button class="alt" id="ac-ren">change my name</button>'+
      '<button class="alt" id="ac-out">sign out</button>'+
      acMsg()+
      '<p class="foot">Records sync whenever they change, and this device keeps '+
      'its own copy, so the game works with no connection at all.</p>';
    runtimeListen(document.getElementById('ac-board'),'click',function(){
      CLOUD.view='board';CLOUD.err='';CLOUD.note='';acRender();acLoadBoard();});
    runtimeListen(document.getElementById('ac-dev'),'click',acGetCode);
    runtimeListen(document.getElementById('ac-ren'),'click',function(){
      CLOUD.view='ren';CLOUD.err='';CLOUD.note='';acRender();});
    runtimeListen(document.getElementById('ac-out'),'click',function(){
      cloudSignOut();CLOUD.view='in';acRender();});
    return;
  }

  if(v==='ren'){
    acH.textContent='CHANGE NAME';
    acSub.textContent='the name on the leaderboard';
    acBody.innerHTML=
      '<label for="ac-nm">name</label>'+
      '<input id="ac-nm" type="text" maxlength="12" autocapitalize="characters" '+
        'autocorrect="off" spellcheck="false">'+
      '<button class="go" id="ac-go">SAVE</button>'+
      '<button class="alt" id="ac-alt">back</button>'+acMsg();
    const nm=document.getElementById('ac-nm');
    if(nm)nm.value=CLOUD.name||'';
    runtimeListen(document.getElementById('ac-go'),'click',acDoRename);
    runtimeListen(document.getElementById('ac-alt'),'click',function(){
      CLOUD.view='me';CLOUD.err='';CLOUD.note='';acRender();});
    acEnter(acDoRename);
    return;
  }

  if(v==='board'){
    acH.textContent='LEADERBOARD';
    acSub.textContent='best run per player';
    const b=CLOUD.board;
    let rows;
    if(!b)rows='<p class="msg">reading the board&hellip;</p>';
    else if(!b.rows||!b.rows.length)rows='<p class="msg">no scores yet — be the first</p>';
    else{
      const mine=b.you?b.you.rank:-1;
      rows='<table>'+b.rows.map(function(r){
        return '<tr class="'+(r.rank===mine?'you':'')+'">'+
          '<td class="r">'+r.rank+'</td>'+
          '<td>'+esc(r.name)+'</td>'+
          '<td class="s">'+num(r.score)+'</td></tr>';
      }).join('')+'</table>';
      /* Your own row, printed again underneath when it is not in view. The
         number a player actually came to see is their own. */
      if(b.you&&mine>b.rows.length)
        rows+='<table><tr class="you"><td class="r">'+b.you.rank+'</td>'+
          '<td>'+esc(b.you.name)+'</td><td class="s">'+num(b.you.score)+'</td></tr></table>';
    }
    acBody.innerHTML=rows+acMsg()+'<button class="alt" id="ac-back">back</button>';
    runtimeListen(document.getElementById('ac-back'),'click',function(){
      CLOUD.view=cloudTok?'me':'in';CLOUD.err='';acRender();});
    return;
  }
}

/* Enter submits. A one-field form that still needs a button tap on a phone
   keyboard is a form people abandon. */
function acEnter(fn){
  acOn(acBody,'keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();fn();}});
}

function acLoadBoard(){
  cloudBoard().then(function(){acRender();})
    .catch(function(e){CLOUD.err=e.message||'could not read the board';acRender();});
}

function acBusy(on,label){
  const go=document.getElementById('ac-go');
  if(go){go.disabled=on;if(label)go.textContent=label;}
}

function acRun(p,onOk){
  if(CLOUD.busy)return;
  CLOUD.busy=true;CLOUD.err='';CLOUD.note='';acBusy(true,'\u2026');
  p.then(function(r){CLOUD.busy=false;onOk(r);})
   .catch(function(e){CLOUD.busy=false;
     CLOUD.err=e.message||'something went wrong';acRender();});
}

function acCreate(){
  const nm=((document.getElementById('ac-nm')||{}).value||'').trim();
  if(!nm){CLOUD.err='type a name first';acRender();return;}
  acRun(cloudCreate(nm),function(){
    CLOUD.view='me';CLOUD.note='records synced';acRender();
    track('account_created',{});
  });
}

function acLink(){
  const cd=((document.getElementById('ac-cd')||{}).value||'').trim();
  if(!cd){CLOUD.err='type the code first';acRender();return;}
  acRun(cloudLink(cd),function(){
    CLOUD.view='me';CLOUD.note='signed in — records synced';acRender();
    track('account_linked',{});
  });
}

function acDoRename(){
  const nm=((document.getElementById('ac-nm')||{}).value||'').trim();
  if(!nm){CLOUD.err='type a name first';acRender();return;}
  acRun(cloudRename(nm),function(){
    CLOUD.view='me';CLOUD.note='name changed';acRender();});
}

function acGetCode(){
  cloudCode().then(function(j){
    CLOUD.err='';
    /* Shown rather than sent: there is no email in this system to send it to,
       and reading six characters across to the other device is the whole
       transfer. */
    acBody.innerHTML=
      '<p class="sub" style="margin-top:4px">type this on the other device, '+
      'within '+(j.minutes||10)+' minutes</p>'+
      '<div style="font-size:34px;font-weight:800;letter-spacing:.28em;'+
      'text-align:center;color:#5df0ff;padding:16px 0 6px">'+esc(j.code)+'</div>'+
      '<button class="alt" id="ac-back">back</button>';
    runtimeListen(document.getElementById('ac-back'),'click',function(){
      CLOUD.view='me';acRender();});
  }).catch(function(e){
    CLOUD.err=e.message||'could not make a code';acRender();});
}

/* ---------- telemetry ----------
   Anonymous gameplay counters, POSTed straight to PostHog's capture API.
   Deliberately NO SDK and no third-party <script>: there is nothing to
   load, so there is no load-order to get wrong and no loader to fail
   silently. One random id per device (cometloop:pid) — no autocapture, no
   session recording, no cookies, no names. The key is a PostHog project
   token: write-only by design, safe to sit in a public file. TELE_OK keeps
   local copies quiet — a file:// or localhost clone (dev, tests) sends
   nothing anywhere. sendBeacon first (survives the tab closing mid-death),
   keepalive fetch as the fallback; a blocked or dead network is silently
   ignored — telemetry is a listener, never a dependency. */
const POSTHOG_KEY='phc_mqJcEAXMtZfZSfEFta3QrkyEXWRK3y7qjipqTX8UjcCj';
const POSTHOG_HOST='https://us.i.posthog.com';
const TELE_OK=(function(){
  try{return location.protocol!=='file:'&&
    !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);}
  catch(e){return false;}
})();
const TELE_ID=(function(){
  try{
    let id=localStorage.getItem('cometloop:pid');
    if(!id){
      id='p'+Math.random().toString(36).slice(2)+Date.now().toString(36);
      localStorage.setItem('cometloop:pid',id);
    }
    return id;
  }catch(e){return 'p'+Math.random().toString(36).slice(2);} /* private mode: per-visit id */
})();
function track(name,props){
  if(!POSTHOG_KEY||!TELE_OK)return;
  /* THE LAB IS SILENT, AND IT IS SILENT HERE RATHER THAN BY TAGGING. A
     `lab_run` property on every event would have been the smaller change and
     the worse one: it moves the burden onto every future query, and the day
     one dashboard forgets the filter, sandbox deaths on a pinned dl-40 board
     with red switched off are averaging into the completion rate. Suppressing
     at the single choke point means a lab run cannot pollute the funnel and an
     event added by a later session inherits that for free. One name is allowed
     through — the event that says the lab was opened at all, which is the only
     thing about a lab session worth counting. */
  if(LAB.on&&name!=='powerup_lab_started')return;
  try{
    const pr=props||{};
    pr.$process_person_profile=false;    /* anonymous events, by declaration */
    /* TWO CONTROL SCHEMES MEANS EVERY NUMBER NEEDS TO SAY WHICH ONE. Without
       this, level-completion and death rates silently average two different
       games together and stop being readable. */
    pr.swipe_mode=SWIPE_MODE;
    /* TWO DIFFICULTY MODES MEANS THE SAME THING AGAIN: without this, chill and
       skill deaths average into one unreadable completion rate. Named
       `play_mode` and NOT `mode`, because `mode` is already spent — the
       swipe_mode_chosen event has always carried the swipe rule under it, and
       redefining a shipped property silently changes what every historical row
       says. One name per thing; retire, never reuse. */
    pr.play_mode=MODE;
    /* THE JOIN KEY, and only when there is one. An account id on the event is
       what lets the Netlify side (records, board) be read against the PostHog
       side (the play funnel) for the same person. It is an opaque uuid and it
       arrives with nothing else attached: no name, no device id beyond the one
       already here, and $process_person_profile stays false above, so a signed
       -in player's events are still anonymous events that happen to carry a
       stable key. A device that never signs in is unchanged. */
    if(TELE_ACCT)pr.account_id=TELE_ACCT;
    pr.$current_url=location.href;
    const body=JSON.stringify({api_key:POSTHOG_KEY,event:name,
      distinct_id:TELE_ID,properties:pr});
    const url=POSTHOG_HOST+'/i/v0/e/';
    /* a string body goes out as text/plain: a CORS "simple request", no
       preflight for sendBeacon to fail */
    if(navigator.sendBeacon&&navigator.sendBeacon(url,body))return;
    if(typeof fetch==='function')
      fetch(url,{method:'POST',body:body,keepalive:true}).catch(function(){});
  }catch(e){}
}
track('$pageview',{});
/* Gesture outcomes, counted where each one actually resolves. Deliberately
   NOT counted inside bump(), which also fires when a swipe hits the outermost
   or innermost ring — that is the game answering correctly, not a misread. */
const GEST={tap:0,swipe:0,lateSwipe:0,unresolved:0};

/* ---------- which way is out ----------
   Two rules, and they only disagree at the top and bottom of the loop.
   RADIAL reads the swipe against the line from the centre through the comet,
   so "away from the middle" is always outward — at the bottom of the loop that
   means swiping DOWN to go out. SCREEN ignores where the comet is: up is the
   outer ring, down is the inner one, always.
   Radial is what the game has been playtested on. Screen was the original, and
   a playtester asked for it back: "can you make it so slide up always changes
   to outer ring and down to inner? i think that's what my brain wants."
   Neither is correct — they are different mental models of the same loop, and
   which one a person holds is not something the game gets to decide for them.
   So it is a choice, made once on a screen where both can actually be felt.
   swipeOut() is the ONLY place either rule is expressed; both gesture
   resolution paths call it, so they can never drift apart. */
let SWIPE_MODE='radial';
/* THE SENTENCE HAS TO FOLLOW THE RULE. Five channels described the hop as
   "swipe up or down", which is the SCREEN rule — and the game has been
   shipping the RADIAL one, where at the bottom of the loop you swipe DOWN to
   go out. So the instruction has been describing a mechanic the build does not
   have, for every player, in the menu key, the level 1 card, the SECOND RING
   banner, the hint ladder and the death coach. Now there are two rules, one of
   them is the player's own choice, and exactly one sentence describes each. */
function swipeWords(){
  return SWIPE_MODE==='screen'?'swipe up or down to change ring'
                              :'swipe out or in to change ring';
}
function swipeOut(dx,dy,ang){
  if(SWIPE_MODE==='screen')return dy<0;          /* up is out, wherever you are */
  /* The outward normal at parametric angle a is (cos a, AY sin a), not
     (cos a, sin a): on a stretched arena the pure basis reads a vertical flick
     near the top of the loop as barely radial at all. */
  return dx*Math.cos(ang)+dy*Math.sin(ang)*AY>0;
}
/* how far the gesture leans along whichever axis the mode cares about — the
   commit threshold needs a magnitude, not just a sign */
function swipeLean(dx,dy,ang){
  if(SWIPE_MODE==='screen')return Math.abs(dy);
  const rnx=Math.cos(ang),rny=Math.sin(ang)*AY;
  return Math.abs((dx*rnx+dy*rny)/(Math.hypot(rnx,rny)||1));
}

/* ---------- state ---------- */
const CW=2.5;   /* combo window seconds */
const WARN=1.15,FADE=0.4,HOP=0.14;
/* ---------- one voice ----------
   Six systems used to write the announcement slot directly, and every write
   was an unconditional overwrite: at the mid-game pile-up "NEW LAYER: BASS"
   could eat "GOLDEN LAP" while its 13-second window kept running with its
   only explanation destroyed. One queue now: say() enqueues with a priority
   and a shelf life, the pump shows ONE line at a time with a breath between,
   and a message that expires unshown is dropped rather than shouted late.
   sayNow() remains for the two bar-timed section calls (YOUR TURN / LISTEN)
   whose whole meaning is the instant they refer to. */
const ANN=[];
let annNext=0;
function say(str,pri,ttl){
  for(const a of ANN)if(a.str===str)return;         /* never queue a duplicate */
  ANN.push({str:str,pri:pri||1,until:G.t+(ttl||14)});
}
function sayNow(str){G.sayFx={str:str,t:0};annNext=G.t+2.8;}
function annPump(){
  if(G.sayFx||G.t<annNext||!ANN.length)return;
  /* a fresh banner owns the announcement real estate — a queued line used
     to print straight through the banner's sub on tall phones; the TTLs
     already drop anything that goes stale while it waits */
  if(G.banner&&G.banner.t<2.6)return;
  for(let i=ANN.length-1;i>=0;i--)if(ANN[i].until<G.t)ANN.splice(i,1);
  let bi=-1;
  for(let i=0;i<ANN.length;i++)if(bi<0||ANN[i].pri>ANN[bi].pri)bi=i;
  if(bi<0)return;
  const a=ANN.splice(bi,1)[0];
  G.sayFx={str:a.str,t:0};
  annNext=G.t+2.8;
}
/* Events report their effect locally. There is no full-screen flash channel. */
function age(){return G.t-G.started;}
/* DIFFICULTY IS A CLOCK. Scoring well nudges it forward a little, but the
   nudge is capped, so playing well can never accelerate you into the wall.
   Everything below is keyed off dl() — "difficulty seconds". */
/* THE MODE IS A CLOCK RATE, and this is the only line that knows it. Chill
   spends more real seconds per difficulty-second, so every term keyed off
   dl() — speed, cap, gap, warn, the tier ladder, the finish line — eases
   together and in the proportions they were tuned in. Applied to the age
   rather than to the result, so a level's FLOOR (dl0) is untouched: chill
   takes longer to cross a level, it does not start it somewhere easier. */
function dl(){
  if(G.intro)return 0;
  /* THE LAB PINS THE CLOCK, and pinning dl() is the whole of how it stays
     calm. Every pressure term in the file already reads this one number —
     speed, shard cap, arrival gap, warning length, the tier ladder, the finish
     line — so freezing it freezes all six together and in the proportions they
     were tuned in, exactly the argument the mode table makes for using the
     clock as its main lever. A lab that instead trimmed each term separately
     would be a second difficulty curve, and the next balance change would
     land in one of them and not the other. */
  if(LAB.on)return LAB_DL;
  const a=(age()+Math.min(G.diff*0.22,40))*MD().clock;
  const base=LV[(G.level||1)-1].dl0;
  /* each level re-runs the gentle opening ramp from its own floor */
  return base+(a<80?a*0.55:44+(a-80));
}
function dlOld(a){
  return a<80?a*0.55:44+(a-80);
}
/* Speed is one axis among four, and a shallow one. The whole curve is
   stretched so a run has room to breathe: half of it is spent below 2.0.
   The exponential has flattened to within 0.2 of its ceiling by ~4 minutes,
   so past that a slow linear climb takes over. Without it a long run settles
   onto a plateau and only ever ends from a lapse of attention. */
const SPEED_MAX=4.2;
function speedAt(){
  const d=dl();
  /* opens at 1.30 rather than 1.40 — the first orbits should feel like a
     glide, not a chase; the ceiling and the tail of the curve are untouched */
  /* the mode's trim scales the whole curve INCLUDING the ceiling, so chill's
     fastest board is genuinely slower than skill's rather than merely taking
     longer to arrive at the same wall */
  return MD().speed*Math.min(SPEED_MAX,1.30+1.70*(1-Math.exp(-d/190))+Math.max(0,d-250)*0.0015);
}
/* Early warns run 2.35s (was 1.90) so a new player has a full extra beat to
   read the pulse before it becomes a crystal; the late floor is unchanged. */
/* THE EXAM KEEPS ASKING. Every pressure term in this file used to be at its
   floor or its ceiling by dl 420 — eighty seconds into a level that never
   ends — so a player who survived five minutes on EVENT HORIZON was playing
   the board they met at eighty seconds, only faster. Speed and one shard-cap
   step were the whole of it. Measured across dl 340 to 1050 before this
   change: warn 1.00 flat, gap 0.80 flat, embers flat, shields flat, tier flat,
   sky flat.
   The second floor is deliberately shallower than the first ramp and arrives
   over minutes rather than seconds. This is not a difficulty increase for
   anyone who dies where most runs die — telemetry's longest level-4 run is
   dl ~560 and the median is nowhere near it. It is a curve for the tail that
   had none. A run ending at dl 420 sees none of it. */
function warnTime(){
  const d=dl();
  /* 1.00s held through the last finish line, then eased to 0.86 over the
     endless level's first three minutes. The ease used to run dl 460→640,
     which was written when everything past dl 340 was the endless exam — and
     was never re-anchored when dl 470–610 became REDSHIFT, a TEACHING level:
     78% of the total telegraph decay landed inside the level that introduces
     THE NARROWS, while HEAT DEATH — the level this curve exists for — got a
     flat tail. Anchored to the boundary now (LV, not a literal, which is how
     the shard-cap comment says this class of number goes stale), so the
     decay lives where the "exam keeps asking" argument actually applies.
     At those speeds 0.86s is still about three radians of travel between
     arming and lethal, so the telegraph stays a telegraph; it never goes
     below 0.86, because the whole game rests on being able to READ a shard
     before it bites. */
  /* the mode's trim multiplies the finished value, so an easier mode's floor
     sits above 0.86 — the telegraph is the thing a relaxed player is most
     short of, and it is the one term where more is unambiguously easier */
  const examDl=LV[LEVEL_MAX-2].end;   /* the endless level's floor: dl 610 */
  return MD().warn*Math.max(0.86,Math.min(Math.max(1.0,2.35-d*0.0042),1.0-(d-examDl)*0.00078));
}
function shardCap(){
  const d=dl();
  /* A single ring can carry more shards than the same count spread over two,
     so the opening is denser but simpler rather than sparse and slow.
     farFromAll keeps 0.5rad between shards, so a ring tops out near 12 —
     10 across three rings stays placeable. The front of this ramp starts at
     ONE: the first threat arrives alone, and pairs only exist once the tap
     has had something real to answer. */
  /* the 5->6->7 steps used to land at dl 70/110/160 — all three inside the
     window where every run was already dying. Spaced out. */
  /* THE TOP OF THIS LADDER WAS BUILT FOR A GAME THAT ENDED AT LEVEL 4. It
     stopped at 12 from dl 680 onward, forever. With six levels, HEAT DEATH
     runs dl 610 to past 1100 and reached every ceiling in the file about
     ninety seconds in — the same "the exam keeps asking" failure that was
     diagnosed and fixed at dl 420 when level 4 was last, recurring one level
     along because the fix was written as a number rather than as a rule.
     Nothing below dl 420 moves: levels 1-3 are tuned, most runs end there, and
     this change is not for them. */
  /* the 10 and 11 steps sat at dl 420 and 540 — 25 and 20 difficulty-seconds
     after the DIVERS (395) and NARROWS (520) banners, so both of the back
     half's new formations got a density step in the middle of their own
     lesson window. Nudged to 445 and 575: end-of-level values are identical,
     and the step now waits for the lesson the way the ratchet waits for the
     banner. */
  const n0=d<8?1:d<20?2:d<32?3:d<55?4:d<120?5:d<200?6:d<270?7:d<340?8:d<445?9:
          d<575?10:d<650?11:d<780?12:d<920?13:d<1080?14:15;
  /* the mode's density trim, floored at one: a board that can hold no threat
     at all is not an easier game, it is a screensaver */
  const n=Math.max(1,Math.round(n0*MD().cap));
  /* "Suddenly, there are double/triple amount of red obstacles." Applied to
     the CAP and to the rate together, because raising one without the other
     just changes how long the board takes to fill. */
  return BH.phase===2?Math.round(n*bhDensity()):n;
}
/* was 2.1-d*0.0035: the same late floor arrives via a gentler opening */
function spawnGap(){
  const d=dl();
  /* the old floor was 0.80 from dl 360 onward, forever. It now keeps easing to
     0.64 by dl 700 — arrival RATE is the lever the board actually feels, far
     more than the cap, because placement failure limits density long before
     shardCap does (measured: mean 6.2 shards on a board whose cap was 8). */
  /* the floor DECAYS; the opening ramp is untouched. Written as max(floor,ramp)
     rather than min(ramp,floor): the first draft used a min, which let the
     decaying term undercut the ramp before dl 420 was even reached and pulled
     level 4's opening gap from 0.90 to 0.85 — a difficulty change smuggled
     into the exact window this change promised not to touch. */
  /* THE FLOOR NOW DECAYS FROM LEVEL 4'S OWN FLOOR, not from 80 dl inside it,
     and it keeps going. Arrival RATE is the lever the board actually feels —
     placement failure limits density long before shardCap does (measured: mean
     6.2 shards on a board whose cap was 8) — so this is the term that has to
     carry the back half, and it was the term that flattened first.
     The crossover is still where the opening ramp hands over: 2.6-0.005d meets
     this line at dl 362, so every value below that is bit-identical to what
     shipped and levels 1-3 are untouched by construction rather than by
     inspection. Kept as max(floor, ramp) for the reason written below. */
  const floor=Math.max(0.50,0.80-Math.max(0,d-340)*0.00048);
  /* the mode's trim scales the finished gap — cap and rate move together, for
     the same reason the black hole scales both */
  const g=Math.max(floor,2.6-d*0.005)*MD().gap;
  return BH.phase===2?g/bhDensity():g;
}
/* EVERY RUN OPENS QUIETLY. This used to fade out by the fourth run, so a
   returning player was dropped straight into a moving board with no room to
   re-find the controls — and anyone handed the phone at run twelve got no
   ramp at all. Now the opening seconds are calm for everybody, every time:
   the first shard is held off, and the tail of the ramp still gives a genuine
   newcomer a little longer on top of that. The difficulty clock past the
   opening is untouched, so the run reaches exactly where it always did. */
function rookie(){
  /* run count OR the struggle streak, whichever asks for more calm: three
     consecutive sub-30s deaths reopen the full 11s opening no matter how
     many lifetime runs the counter shows. */
  return Math.max(0,Math.min(1,(4-G.runs)/3),Math.min(1,(G.struggle||0)/3));
}
/* Measured over five instrumented runs: the first threat was not arriving
   until 10.5s and 13.2 of the first 25 seconds had an empty board — more than
   half the opening was nothing at all. That flat 7s floor was me overshooting
   the gentle-opening request: it bought a newcomer room to find the controls
   and charged every returning player ten seconds of dead air for it.
   The ramp goes back to being a ramp. A first run still opens at 11s, and by
   the fourth it is 4.5s — quicker than the 4s+5s it ever was for a newcomer,
   and back to a game that starts when you press start. */
function firstShardAt(){return 4.5+8.5*rookie();}
/* Embers land on a random ring but you can only reach the one you are on,
   so both the cap and the spawn rate scale with ring count. Without this,
   adding a ring silently cuts your scoring rate while raising difficulty. */
function emberCap(){return Math.min(12,Math.round((3.5+dl()*0.004)*G.nRings));}
function emberGap(){return Math.max(0.30,(1.35-dl()*0.003)/G.nRings);}

/* ---------- shard archetypes ----------
   Each one asks for a different skill, and they unlock on a schedule so
   there is always something new arriving. */
/* THE WHOLE LADDER NOW FITS INSIDE LEVELS 1-2 (the curriculum rule — see
   LV above). The four storm shapes used to unlock at dl 205/250/295/340,
   which is level THREE territory: a player entered "no new tricks — just
   more of them" still owed four brand-new tricks, and the mechanics the
   game is worst at teaching were exactly the ones introduced at its most
   hostile density. They now land inside level 2 (dl 75-190), one at a
   time, each with its banner and first-encounter lesson, and STORM sits
   exactly on level 3's floor so the exam begins with nothing left to
   introduce. Wall-clock spacing inside level 2 (dl 90-215) for a no-nudge
   player: gates +18s · drifters +58s · blinkers +90s · sliding gates
   +112s · flicker pairs +134s · finale ~+151s — every gap clears the 9s
   lesson spacing and the banner's full display with room to spare.
   (Round two, on the owner's call: levels 1 and 2 both run LONGER now —
   finish lines at dl 90 and 215 — because the introductions still crowded
   each other; level 1's back half belongs to the musical curriculum, and
   level 2 gives each threat ~22 difficulty-seconds of its own.)
   Difficulty is untouched, same as when TWIN moved forward: speedAt,
   shardCap, spawnGap and warnTime all key off dl() and none changes here,
   so this changes WHAT arrives, never HOW MUCH.
   The late tiers are compounds rather than new objects: gate, blink and drift
   are independent flags on the same shard, and update and draw already handle
   them in any combination, so a moving wall or an alternating pair costs
   nothing but a spawn branch.

   THE FRONT OF THIS LADDER USED TO SIT BEHIND A WALL NOBODY CLEARED. Ring two
   arrived at 30s and ring three at 128s, so a first-time player met the hop —
   the unfamiliar gesture, the one a circle makes ambiguous — only once the
   board had filled to three shards, and met the third ring essentially never.
   A tester who played four rounds asked for "maybe three layers?" and for new
   power-ups: he was describing things that already shipped, from outside the
   wall that hid them. And because the spawn pool below TWIN is 100% plain
   singles — TWIN being the first tier that carries an alternative shape — his
   whole experience of the game was one obstacle type on two rings. He reported
   that as "needs more stuff", correctly.

   TWIN IS THE SECOND HALF OF THAT FIX, and it turns out to be free. It sat at
   dl 38, so the opening served one repeated object for 63 seconds; at dl 18 it
   is 30. Measured rather than guessed: across 300 simulated runs per setting,
   pulling it from dl 30 to 15 moved median survival by less than 2% (814s to
   822s), left forced inputs per minute flat at 74, and killed nobody inside
   the first 60 seconds at any setting — because a twin spends two slots of the
   same shard cap rather than adding to it. dl 18 rather than 15 only so the
   second ring at dl 12 gets a clear stretch first: twins are the tier that
   makes the hop compulsory, and the lesson should land before the exam.
   (The simulation hops optimally, so it understates how much a twin taxes a
   player still learning the gesture. That is the reason for the gap, not the
   spawn maths.)

   Pulling the front of the ladder in answers both, and it costs no difficulty:
   every pressure term — speedAt, shardCap, spawnGap, warnTime — keys off dl()
   and none of them is touched here, so this changes WHAT arrives, never HOW
   MUCH. Ring two now lands at 20s, inside the quiet opening, where a
   simulation of this spawn system puts median time-to-impact at 3.5s: the hop
   gets taught in the calm the opening exists to provide, rather than at the
   exact moment the calm ends. The late tiers barely move — the top of the
   ladder was never the problem, since almost nobody reaches it either way. */
const TIERS=[
  {at:0,  type:'single',name:null},
  /* Every sub is word-for-word its type's MEET lesson (see the note there);
     the ring tiers, which have no formation and so no lesson, use the same
     vocabulary as the menu key and the hint ladder. "switch track" named a
     thing called a track that appears nowhere else in the game. */
  {at:12, type:null,    name:'SECOND RING', subFn:swipeWords,rings:2},
  {at:18, type:'twin',  name:'TWIN SHARDS', sub:'Two red obstacles: swipe to another ring'},
  /* "faster and higher" was two claims and neither was true: angular speed is
     the same on every ring (one G.speed, no radius term) and an ember pays the
     same wherever you take it. The filter lift IS real \u2014 RINGS[].lift climbs
     0/380/820 going in \u2014 so the honest reward is the one the player can hear. */
  {at:40, type:null,    name:'THIRD RING',  sub:'Swipe to another ring to reach more stars',rings:3},
  {at:100,type:'gate',  name:'GATES',       sub:'A wall blocks every ring; tap to turn around'},
  {at:128,type:'drift', name:'DRIFTERS',    sub:'This red obstacle moves; tap to turn away'},
  {at:165,type:'blink', name:'SHUTTERS',    sub:'Pass through the open shape; avoid solid red'},
  /* THE TWO HARDEST SHAPES NOW LAND IN LEVEL 3 (owner: "the hardest mechanics
     should be reserved for level 3 teaching, that will allow more time to
     learn"). Both are COMPOUNDS — a gate that also drifts, a twin that also
     blinks — so meeting them 22 dl-seconds apart, immediately after meeting
     their two ingredients, was the densest stretch in the game and landed
     exactly where a playtester reported losing track of the rules.
     Adding level 4 had made this worse rather than better: every tier still
     unlocked inside dl 0-215 while an entire level, dl 215-340, taught
     nothing. Level 2 now carries three shapes ~35 apart instead of five ~22
     apart, level 3 carries the two compounds 55 apart with room for their
     lessons to find calm, and level 4 is the exam. */
  {at:240,type:'driftgate',name:'SLIDING GATES',sub:'The wall moves; tap to turn before it reaches you'},
  /* THE SAUCER \u2014 the one shape that answers a PLAYER, not a board. Playtest,
     verbatim: "I just feel like I end up just banging back and forth [on] the
     final level to stay alive and it's not as much fun as when I'm weaving in
     and out. And sort of feels like I'm cheating." He was right, and it is
     structural: farFromAll rejects any spawn within 1.1 rad of the player's
     instantaneous angle, so an oscillation arc narrower than that is a
     sanctuary no static shard can ever be placed inside \u2014 every point of the
     arc is always within 1.1 rad of every position the player can occupy in
     it. Simulated, a camper that adds one hop rule survives fifteen minutes
     on level 4 without a scratch, covering 1.3 radians of the circle.
     Every other formation is placed against the BOARD and then ignores you.
     This one holds station off your tail and is therefore the only red in the
     game whose position is a function of where you have chosen to be \u2014 which
     is what makes turning around cost something at last. It is deliberately
     not a chaser: it never closes under its own power and never outruns you
     (see the note in spawnSpike). It simply occupies the ground behind you,
     and the ground behind you is exactly where a player who refuses to
     travel is about to go.
     Level 3 now carries three shapes ~35 dl apart instead of two ~55 apart,
     which is the spacing level 2 already uses and the same pass that set it;
     FLICKER PAIRS moves 295 -> 310 to keep that rhythm. It cannot go later:
     tier banners may not fire inside level 4 (curriculum.mjs) and dl 340 is
     THE EYE's, so 275 is the last slot with room for its lesson to land. */
  {at:275,type:'saucer',name:'THE SAUCER',sub:'Turning triggers its shot; swipe to another ring'},
  {at:310,type:'blinktwin',name:'SHUTTER PAIRS',sub:'The shapes take turns opening; pass through the open one'},
  /* THE EYE, not STORM. This sub can never render — a dl 340 crossing on
     level 3 always falls inside the suppressed endgame window, and on level 4
     startGame pre-climbs G.tier before the first frame — but the NAME is the
     only label tierLabel() can return on level 4, so every level-4 run printed
     "LEVEL 4 · STORM" in the header, on the death screen and in the share
     text, seconds after the card named the level EVENT HORIZON. LV[2].name is
     'THE STORM'; two different things cannot share it. Renamed rather than
     deleted: smoke.mjs asserts the last tier's `at` equals level 3's finish
     line, so removing the entry fails the build. */
  /* DIVERS \u2014 LEVEL 4, and the first formation the game has ever taught above
     dl 340. Every other shard in the game answers the question "where is it?"
     once and then keeps the answer; this one arms on one orbit and lands on
     another, so the lane it telegraphs in is not the lane it kills in. That
     is the one thing the existing nine cannot say: drift moves a shard ALONG
     its ring, and nothing until now moved one ACROSS rings.
     It is deliberately the level-4 shape rather than the level-5 one. Level 4
     is also the black hole's level, and the black hole's whole geometry is
     orbits moving under the player \u2014 a shard that changes orbit is the same
     idea at the scale of a single threat, met first. */
  {at:395,type:'dive',  name:'DIVERS',      sub:'It moves to the marked ring; swipe to another ring'},
  /* THE NARROWS \u2014 LEVEL 5, and the last thing the game teaches. It is a gate
     with exactly one lane left open, which makes it the mirror of GATES: a
     gate blocks every ring and is answered by a TAP, this blocks every ring
     but one and is answered by a HOP. The two verbs, one wall each, four
     hundred difficulty-seconds apart \u2014 the syllabus closes by asking for the
     other half of the control scheme against the same object it opened with.
     The open lane is always adjacent to the player's, so exactly one hop
     answers it; it is never the lane they are already on, or it would be a
     wall that asks for nothing. */
  {at:520,type:'funnel',name:'THE NARROWS', sub:'Swipe to the ring with no wall'},
  /* THE EYE sits on level 6's floor now rather than level 4's. Same job: the
     rung that introduces nothing and marks the end of teaching. smoke.mjs
     pins it to the last level's floor, so it cannot be appended past. */
  {at:610,type:null,    name:'THE EYE',     sub:'Collect stars and complete orbits to score'}
];
/* THE THREE RUNGS THE BAND ANSWERS TO, BY NAME RATHER THAN BY ORDINAL.
   `invariants.md` warned that twelve places hardcoded tier ordinals for the
   sky band, the NEW SOUND ladder and the star instrument, and that inserting a
   tier below the highest of them shifts every one. Inserting DIVERS and THE
   NARROWS is exactly that insert: THE EYE moved from index 10 to index 12, so
   every `G.tier>=10` in the file silently stopped meaning "the last rung" and
   started meaning "two rungs early". Derived from the table now, so the next
   insert costs nothing and a renamed row fails loudly in check.mjs rather
   than quietly re-timing the audio ladder. */
const T_VOICE=[0,
  TIERS.findIndex(function(t){return t.name==='THIRD RING';}),
  TIERS.findIndex(function(t){return t.name==='SHUTTERS';}),
  TIERS.findIndex(function(t){return t.name==='THE EYE';})];
/* and the same for the sky's four palette bands, for the same reason. These
   two rungs happen not to have shifted this time — the insert went in above
   them — but "happens not to have shifted" is the property that made the
   audio ladder's twelve ordinals safe right up until they were not. */
const T_SKY=[0,
  TIERS.findIndex(function(t){return t.name==='GATES';}),
  TIERS.findIndex(function(t){return t.name==='SLIDING GATES';}),
  TIERS.findIndex(function(t){return t.name==='THE EYE';})];
/* HOW MUCH WORK EACH SHAPE ASKS FOR, used only by the late-board weighting in
   pickType. Ranked by how many independent facts the player has to read before
   they know what to do: a single is a position; a twin is a position and a
   count; a gate is a wall and a verb; a diver is a position that CHANGES; the
   compounds are two behaviours at once, and the saucer is the only shape whose
   position is a function of the player's own choices. Nothing reads this below
   dl 340, so it cannot affect the tuned first three levels. */
const SHAPE_RANK={single:0,twin:1,gate:2,drift:2,blink:2,dive:3,
                  driftgate:4,blinktwin:4,saucer:4,funnel:4};
function tierIndex(){
  const d=dl();
  let i=0;
  for(let k=0;k<TIERS.length;k++)if(d>=TIERS[k].at)i=k;
  /* THE EXAM WAITS FOR THE LESSON. TWIN is the tier that makes the hop
     compulsory, and it used to arrive on a pure clock whether or not the
     player had ever landed one — the direct mechanism of the sub-two-minute
     first sessions. The ladder now holds at SECOND RING until the first hop,
     then resumes exactly where the clock says. A veteran hops in the opening
     seconds and never notices the gate exists. The release valve: after 30
     difficulty-seconds the exam arrives anyway, so the hold cannot be
     farmed — and speedAt/shardCap/spawnGap all still run on dl() untouched,
     so this changes WHAT arrives, never HOW MUCH. Clamped here, not in the
     ratchet, so pickType and the banner can never disagree about the tier. */
  /* Level 2+ passes the hold on the LEVEL, not a forged flag: startGame
     used to set didHop=true for any level-2 start ("reaching level 2
     proved the verb" — false for the finale-backstop player), which also
     switched off the hop hint, the rehearsal and the death coach's best
     line for the whole run. The pacing exemption lives here now and the
     teaching surfaces stay honest per-run. */
  /* THE HOLD HAS A RELEASE VALVE AND THE LAB WOULD JAM IT. The valve is
     `d-G.holdD>=30` — thirty difficulty-seconds — and dl() is a constant in
     the lab, so that difference is zero forever: a player who never hopped
     would be held at SECOND RING for the whole session with no way out and no
     timeout, which is the one shape of bug a frozen clock can introduce. The
     hold is a pacing guard for a first run anyway, and the lab is not one. */
  if(!G.didHop&&G.level<2&&!LAB.on&&G.state==='playing'&&i>1){
    if(!G.holdD)G.holdD=d;               /* set once, at first engagement */
    if(d-G.holdD<30)i=1;
    /* the release valve fired with the hop still unlanded — the purest
       "the hop lesson did not land" signal telemetry has */
    else G.holdTimeout=true;
  }
  return i;
}
/* WHICH FORMATION IS "NEW" RIGHT NOW. Three of the ten tiers announce a ring
   or a storm rather than a shape, so `top` lands on a type:null entry once per
   run at THIRD RING and once at STORM. The featured-tripling below used to key
   off `k===top` directly, which meant those two tiers featured nothing at all:
   crossing THIRD RING dropped gates from 60% of the pool to 33%, so the banner
   celebrating a new ring also quietly made the board easier, and STORM — whose
   own banner promises "just more of everything" — flattened flicker pairs from
   33% to 14%. Walking back to the last tier that actually carries a shape
   keeps the newest formation featured across the gaps. */
function featuredTier(top){
  for(let k=top;k>=0;k--)if(TIERS[k].type)return k;
  return 0;
}
function pickType(){
  const top=tierIndex();
  const feat=featuredTier(top);
  /* THE NEW SHAPE INSISTS UNTIL ITS LESSON LANDS. The curriculum promises
     every formation is met and explained inside levels 1-2, but pool odds
     made that a dice roll: a sliding gate shares the one-wall-at-a-time
     slot with plain gates, its placement loop can fail on a dense board,
     and its lesson defers for calm — a full simulated playthrough reached
     level 3 with the sliding-gate lesson never shown (tools/curriculum.mjs
     now fails the build on exactly that). So while the newest unlocked
     shape's lesson has not landed, it IS the next spawn — banner first
     (the 4s head start), then specimen after specimen until firstMeet
     finds its calm beat. Veterans have seen everything, so this line never
     runs for them; density is untouched — same spawn, different shape. */
  for(let k=0;k<=top;k++){
    const ty=TIERS[k].type;
    if(!ty||G.seen[ty])continue;
    if(k===feat&&G.t-G.featT<4)break;   /* the newest gets its banner first */
    if((ty==='twin'||ty==='blinktwin')&&G.nRings<2)continue;
    /* NO ONE SHAPE MAY OWN THE BOARD, and twins are the shape that does.
       Measured off the live spikes: twins were 62-65% of everything standing
       on levels 5 and 6, against 44% on level 3 — and the cause is a feedback
       loop rather than the odds. A twin places TWO shards from ONE clear spot,
       so it is the cheapest formation to fit on a crowded board; it then
       consumes twice the capacity, which makes every OTHER formation harder to
       place, which makes the next pick a twin. The pool was never the problem
       — sampled in isolation the hard shapes win 70% of the time — the board
       state was. Two pairs live is the ceiling; past that the pool has to
       offer something else, which is the same rule the one-wall-at-a-time
       exclusion has always applied to gates.
       GATED AT dl 340 — level 4's floor — for the same reason every other
       change in this pass is: levels 1-3 are tuned, most runs end there, and
       an unguarded version of this line measured a 9% rise in level 3's board
       complexity, which is a difficulty change nobody asked for. */
    if((ty==='twin'||ty==='blinktwin')&&dl()>=340&&G.spikes.reduce(function(n,s){return n+(s.tw?1:0);},0)>=4)continue;
    /* a dive needs somewhere to dive TO, and a funnel needs a lane to leave
       open — both are meaningless on one orbit */
    if((ty==='dive'||ty==='funnel')&&G.nRings<2)continue;
    if((ty==='gate'||ty==='driftgate'||ty==='funnel')&&G.spikes.some(function(s){return s.gate;}))continue;
    if(ty==='saucer'&&!saucerOK())continue;
    /* A GATE AND A SAUCER MAY NEVER SHARE A BOARD. The gate exists to force
       a reversal and the saucer exists to make one cost something, so the
       pair is the only combination in the game that can demand a move and
       punish it in the same breath. Held apart here rather than solved with
       a placement check, because there is no placement that makes them
       compatible — the conflict is in what they mean, not in where they are. */
    if((ty==='gate'||ty==='driftgate'||ty==='funnel')&&G.spikes.some(function(s){return s.saucer;}))continue;
    return ty;
  }
  const pool=[];
  for(let k=0;k<=top;k++){
    const ty=TIERS[k].type;
    if(!ty)continue;                       /* ring unlocks carry no formation */
    /* nothing to hop over onto */
    if((ty==='twin'||ty==='blinktwin')&&G.nRings<2)continue;
    /* NO ONE SHAPE MAY OWN THE BOARD, and twins are the shape that does.
       Measured off the live spikes: twins were 62-65% of everything standing
       on levels 5 and 6, against 44% on level 3 — and the cause is a feedback
       loop rather than the odds. A twin places TWO shards from ONE clear spot,
       so it is the cheapest formation to fit on a crowded board; it then
       consumes twice the capacity, which makes every OTHER formation harder to
       place, which makes the next pick a twin. The pool was never the problem
       — sampled in isolation the hard shapes win 70% of the time — the board
       state was. Two pairs live is the ceiling; past that the pool has to
       offer something else, which is the same rule the one-wall-at-a-time
       exclusion has always applied to gates.
       GATED AT dl 340 — level 4's floor — for the same reason every other
       change in this pass is: levels 1-3 are tuned, most runs end there, and
       an unguarded version of this line measured a 9% rise in level 3's board
       complexity, which is a difficulty change nobody asked for. */
    if((ty==='twin'||ty==='blinktwin')&&dl()>=340&&G.spikes.reduce(function(n,s){return n+(s.tw?1:0);},0)>=4)continue;
    if((ty==='dive'||ty==='funnel')&&G.nRings<2)continue;
    /* one wall at a time, whether it slides or leaves a lane open */
    if((ty==='gate'||ty==='driftgate'||ty==='funnel')&&G.spikes.some(function(s){return s.gate;}))continue;
    /* both halves of the gate/saucer exclusion — see the note in the insist
       loop. The two filters are duplicated across these loops by an existing
       convention; a precondition added to one and not the other lets the
       insist path spawn what the pool path refuses. */
    if(ty==='saucer'&&!saucerOK())continue;
    if((ty==='gate'||ty==='driftgate'||ty==='funnel')&&G.spikes.some(function(s){return s.saucer;}))continue;
    /* ---- LATE BOARDS FAVOUR THE HARDER SHAPES ----
       THE BACK HALF CANNOT ESCALATE ON DENSITY, because density is already
       saturated. Measured over 100s of play per level with the difficulty
       curves freshly retuned: mean live shards 8.42 on level 4, 9.19 on level
       5, 9.23 on level 6 — a 10% rise across two whole levels, while shardCap
       went 10 -> 12 and the arrival gap fell 0.75 -> 0.62. The board is as
       full as placement will let it be, exactly as the spawnGap note says
       ("placement failure limits density long before shardCap does"), so
       raising the cap buys nothing and raising the rate buys almost nothing.
       What is left is the MIX. A board of nine plain singles and a board of
       nine sliding gates are the same count and nothing like the same game, and
       until now the pool was flat: every unlocked shape equally likely at dl
       900 as at dl 100. So complexity now earns weight as the clock climbs —
       the same board, harder shapes, no extra objects to read and no cost to
       the telegraph.
       hb is 0 at level 4's floor and 1 by dl 900, so LEVELS 1-3 ARE UNTOUCHED
       BY CONSTRUCTION: every weight is exactly 1 while hb is 0, which is the
       identity this whole pool has always had. */
    const hb=Math.max(0,Math.min(1,(dl()-340)/560));
    const w=1+Math.round(hb*(SHAPE_RANK[ty]||0)*1.5);
    for(let q=0;q<w;q++)pool.push(ty);
    /* the newest formation is featured — but only once it has been on the
       ladder ~18s. You meet ONE drifter before you meet three. */
    if(k===feat&&G.t-G.featT>18)pool.push(ty,ty);
  }
  return pool.length?pool[Math.floor(Math.random()*pool.length)]:'single';
}
/* The bank grows with the clock. Late boards carry ten shards across three
   rings and the inner ring costs twice the angle per shard, so three slots
   stopped being enough to play around long before the run ended. */
function shieldMax(){const d=dl();return d<160?3:d<320?4:5;}
/* ================= THE UPGRADE DRAFT =================
   Three tiles on the calm card at the start of levels 2, 3 and 4. They are
   UPGRADES, never new orbs: every player still meets every mechanic, taught
   one at a time, so the curriculum rule survives a draft entirely intact —
   and a card that says "hypernova lasts longer" asks the player to recognise
   nothing new at the exact moment a playtester reported being overloaded.
   Drawn without replacement, so no run ever offers the same card twice.
   `ic` draws the icon at the origin, sized for a 78u tile. */
const UPG=[
 {id:'longstar',n:'LONGER STAR',d:'Hypernova lasts about 14 seconds',c:'#ff4fd8',
  ic:function(g,c){g.fillStyle=c;starPath(g,15,6.4);g.fill();
    g.strokeStyle='#fff';g.lineWidth=2.6;g.lineCap='round';
    g.beginPath();g.arc(0,0,23,-Math.PI/2,Math.PI*0.95);g.stroke();}},
 {id:'deepbank',n:'DEEP BANK',d:'Start each level with 3 shields',c:'#7bffc8',
  ic:function(g,c){g.strokeStyle=c;g.lineWidth=2.6;g.lineCap='round';
    for(let k=0;k<4;k++){g.globalAlpha=k===3?1:0.5;
      g.beginPath();g.arc(0,5,9+k*5.5,-Math.PI*0.86,-Math.PI*0.14);g.stroke();}
    g.globalAlpha=1;}},
 {id:'slowworld',n:'SLOW WORLD',d:'Slow-mo lasts 9 seconds',c:'#b48bff',
  ic:function(g,c){g.strokeStyle=c;g.lineWidth=2.4;
    g.beginPath();g.arc(0,0,17,0,TAU);g.stroke();
    g.strokeStyle='#fff';g.lineWidth=2.6;g.lineCap='round';
    g.beginPath();g.moveTo(0,0);g.lineTo(0,-10);g.moveTo(0,0);g.lineTo(8,4);g.stroke();}},
 {id:'richnova',n:'RICH NOVA',d:'Each cleared red leaves 2 stars',c:'#ffffff',
  ic:function(g,c){g.strokeStyle=c;g.lineWidth=2.4;g.lineCap='round';
    for(let k=0;k<8;k++){const a=k*TAU/8;
      g.beginPath();g.moveTo(Math.cos(a)*7,Math.sin(a)*7);
      g.lineTo(Math.cos(a)*19,Math.sin(a)*19);g.stroke();}
    g.fillStyle=c;g.beginPath();g.arc(0,0,5,0,TAU);g.fill();}},
 {id:'hairtrig',n:'EARLY STARFALL',d:'Starfall after two star-fed orbits',c:'#5df0ff',
  ic:function(g,c){g.fillStyle=c;g.beginPath();
    g.moveTo(-3,-20);g.lineTo(10,-3);g.lineTo(2,-1.5);g.lineTo(7,20);
    g.lineTo(-10,1.5);g.lineTo(-1.5,0);g.closePath();g.fill();}},
 {id:'stagelight',n:'LONG MAGNET',d:'Magnet attracts nearby stars for 16 seconds',c:'#b48bff',
  ic:function(g,c){g.fillStyle=c;g.globalAlpha=0.32;
    g.beginPath();g.moveTo(0,-14);g.lineTo(-18,21);g.lineTo(18,21);g.closePath();g.fill();
    g.globalAlpha=1;g.fillStyle='#fff';g.beginPath();g.arc(0,-16,6.4,0,TAU);g.fill();}},
 /* REDRAWN. It was a bracket that read as a book. A metronome with a WIDE
    sweep is the picture of a forgiving timing window. */
 /* TWO NEW TILES, ONE PER NEW ORB, because the draft has to keep offering a
    live choice as the roster grows. Seven tiles across five draws meant the
    last draw was nearly deterministic; nine keeps the pool genuinely random to
    the end, and every tile still upgrades something the player has met. */
 {id:'longmirror',n:'LONG MIRROR',d:'Mirror lasts about 14 seconds',c:'#4d8cff',
  ic:function(g,c){g.fillStyle=c;
    for(const d of [-1,1]){g.beginPath();
      g.arc(d*2.4,0,7.6,d>0?-Math.PI/2:Math.PI/2,d>0?Math.PI/2:Math.PI*1.5);g.fill();}
    g.strokeStyle='#fff';g.lineWidth=2.4;g.lineCap='round';
    g.beginPath();g.arc(0,0,17,-Math.PI/2,Math.PI*0.9);g.stroke();}},
 {id:'deepburn',n:'DEEP BURN',d:'Scorch lasts 13 seconds',c:'#ff8a2b',
  ic:function(g,c){g.strokeStyle=c;g.lineCap='round';
    for(let q=0;q<3;q++){g.globalAlpha=0.85-q*0.24;g.lineWidth=4.2-q*1.0;
      g.beginPath();g.moveTo(-19+q*2,-6+q*6);g.lineTo(4,-6+q*6);g.stroke();}
    g.globalAlpha=1;g.fillStyle='#fff0dc';
    g.beginPath();g.arc(11,0,6.2,0,TAU);g.fill();}},
 {id:'steadyhand',n:'STEADY HAND',d:'More forgiving tap timing',c:'#ffc857',
  ic:function(g,c){g.strokeStyle=c;g.lineWidth=2.6;g.lineJoin='round';
    g.beginPath();g.moveTo(-13,18);g.lineTo(-6,-16);g.lineTo(6,-16);g.lineTo(13,18);
    g.closePath();g.stroke();
    g.globalAlpha=0.30;g.fillStyle=c;
    g.beginPath();g.moveTo(0,14);g.lineTo(-15,-14);g.lineTo(15,-14);g.closePath();g.fill();
    g.globalAlpha=1;g.strokeStyle='#fff';g.lineWidth=2.6;g.lineCap='round';
    g.beginPath();g.moveTo(0,14);g.lineTo(0,-13);g.stroke();
     g.fillStyle='#fff';g.beginPath();g.arc(0,-2,3.4,0,TAU);g.fill();}},
 {id:'longslip',n:'LONG SLIPSTREAM',d:'Slipstream lasts 18 seconds',c:'#5df0ff',minLevel:2,
  ic:function(g,c){g.strokeStyle=c;g.lineWidth=2.8;g.lineCap='round';
    for(const y of [-9,0,9]){g.beginPath();g.moveTo(-18,y);g.lineTo(8,y);g.stroke();}
    g.beginPath();g.moveTo(3,-17);g.lineTo(19,0);g.lineTo(3,17);g.stroke();}},
 {id:'longtrail',n:'LONG STAR TRAIL',d:'Star trail lasts 24 seconds',c:'#ffc857',minLevel:3,
  ic:function(g,c){g.fillStyle=c;
    for(const p of [[-15,10],[0,-9],[15,6]]){g.save();g.translate(p[0],p[1]);
      starPath(g,7,3);g.fill();g.restore();}}}
];
function starPath(g,rr,ri){g.beginPath();
  for(let i=0;i<10;i++){const sr=i%2?ri:rr,a=-Math.PI/2+i*Math.PI/5;
    i?g.lineTo(Math.cos(a)*sr,Math.sin(a)*sr):g.moveTo(Math.cos(a)*sr,Math.sin(a)*sr);}
  g.closePath();}
const upgOn=id=>!!G.upg[id];
/* Three from what is left, never repeating across a run. */
function rollOffer(){
  /* TAKEN upgrades never repeat; DECLINED ones may. The old !G.offered filter
     burned every unpicked tile for the rest of the run, which was arithmetic
     from the three-level era: five draws × three tiles = fifteen slots against
     nine tiles, so the level-5 and level-6 cards drew from an empty pool and
     the two levels added yesterday were the two levels the draft skipped.
     Repeats-of-declined only enter once the fresh pool runs thin, so early
     draws are as varied as they ever were. */
  const available=x=>(x.minLevel||1)<=G.level+1&&!G.upg[x.id];
  let pool=UPG.filter(x=>available(x)&&!G.offered[x.id]);
  const pick=[];
  for(let k=0;k<3;k++){
    if(!pool.length)pool=UPG.filter(x=>available(x)&&!pick.includes(x));
    if(!pool.length)break;
    pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  }
  G.offer=pick;
  for(const o of pick)G.offered[o.id]=1;
}
const REV_FX=0.07; /* grace before a tap's effects fire, so swipes stay silent */
const SND_SEEN={}; /* voices announced this visit — by crossing or level start */
const G={
  state:'menu',t:0,started:0,deadT:0,
  intro:null,introPending:false,introSkipRect:null,
  /* THE PRESENTATION CLOCK. G.t is real seconds and every deadline in the file
     is written against it (G.invuln, G.bhCool, cooldowns, the audio), so it can
     never be dilated. G.vt is the same clock scaled by G.tsCur — what the
     VISIBLE world runs on. Slow motion used to reach the simulation and stop
     there: the comet halved its speed while the backdrop, the camera dolly, the
     sky drift, the ripples, the popups and the comet's own trail all kept
     running off raw time, so roughly fifteen visible layers were still moving
     at full speed and flatly contradicting the eight that were not. That
     contradiction is what "it doesn't feel slow enough" is made of — the depth
     of the number was never the problem. */
  vt:0,
  score:0,diff:0,best:0,newBest:false,scorePop:0,mile:0,
  lastPopPaid:0,lastPopAt:-9,   /* the ember popup dedupe — see the pickup site */
  newLevel:false, /* did this run reach deeper than any before it */
  swipeAsked:false,selRects:[],selPt:null,selFx:0,selFrom:null,swipeRect:null,
  menuRects:[],menuPt:null,            /* the title screen's controls: START and the lab door */
  lvSel:1,lvSelRects:[],lvSelPt:null,lvSelFx:0,  /* the starting-level picker */
  powSelRects:[],powSelFx:0,   /* the powerup lab's picker */
  labRect:null,                /* the lab's way out, drawn only during a lab run */
  pauseBtn:null,               /* RESUME, published by the pause panel's draw pass */
  startLevel:1,   /* which level this run BEGAN on — see the record guard in die() */
  level:1,lvlMax:1,lvT:0,lvCard:null,carryScore:0,
  carryOrbits:0,carryStreak:0,carryTime:0,carryLands:0,carryGroove:0, /* the three-level structure,
    and the deepest level ever reached — the only level record there is */
  combo:0,comboT:0,lapAcc:0,lapStreak:0,lapEmbers:0,
  skyW:0,   /* the journey, in worlds. Orbits buy it; see ORB_PER_WORLD. */
  orbits:0,bestStreak:0,shareFx:0, /* run summary, for the death screen and share */
  groove:0,grooveT:0,grooveFx:0,bestGroove:0,beat:0,dropFx:0, /* rhythm */
  pocket:0,missFx:null,               /* held ×8 envelope; early/late arc */
  armFx:null,sayFx:null,
  pay:0,payOpen:0,didGroove:false,                            /* the payoff section */
  build:0,buildFx:0,buildSeg:0,buildSrc:{ember:0,hop:0,time:0,orbit:0}, /* the build meter */
  landFx:null,lands:0,everLanded:false,                       /* landing the drop */
  secScore:0,secMult:1,secFx:null,                            /* riding the section */
  embers:0,blocks:0,phases:0,lastHit:'none', /* telemetry counters */
  angle:-Math.PI/2,prevAngle:-Math.PI/2,sweep:0,dir:1,speed:1.7,
  nRings:3,ringI:0,hopFromI:0,hopFrom:0,hopP:1,
  shields:0,invuln:0,slow:0,slowD:4,shMax:0,tsCur:1,sinceShield:0,revPend:0,didShield:false,
  didDodge:false,sawDrop:false,gotWarp:false,gotNova:false,gotHyper:false,gotShield:false,
  gotSpot:false,gotBH:false,gotMirror:false,gotScorch:false,
  hyperPlaced:false,bhPlaced:false,bhRun:false,mirrorPlaced:false,scorchPlaced:false,
  mirror:0,mirrorD:0,mirrorA:0,scorch:0,scorchD:0,burn:null,
  slip:0,slipD:0,slipAt:0,slipFx:null,gotSlip:false,gotTrail:false,
  slipPlaced:false,trailPlaced:false,
  bhCool:0,bhT:0,bhN:0,   /* black hole: rarity gate, entry stamp, count this run */
  dropsEarned:0,loopN:0,nearN:0,bestCombo:0,holdTimeout:false, /* play-style aggregates for run_ended */
  stars:[],spikes:[],pows:[],parts:[],trail:[],rings:[],pops:[],arcs:[],laps:[],novas:[],
  stop:0, /* hitstop: freezes the comet while the celebration plays */
  starT:0.6,spikeT:1.2,powT:6,powN:0,introN:0,shake:0,tier:0,banner:null,featT:0,
  sauT:0,   /* earliest G.t another saucer may arrive — see saucerOK */
  runs:0,didReverse:false,didHop:false,didLap:false,
  teach:0,teachKind:null,teachHint:null,teachType:null,seen:{},seen2:{},campT:0, /* lessons + outer-ring camp clock */
  spotPlaced:false,   /* the level-3 spotlight guarantee */
  lapCut:0,lapCutDir:1,lapCutA:0,lapFx:null, /* a committed reverse's discarded orbit — the cost, drawn */
  beatPop:false,lsnN:0,said8:false,   /* per-run: ON BEAT popup, lessons shown, ×8 line */
  saidChor:false,chorusN:0,chorusBars:0, /* the chorus: named once per run; entries and bars for telemetry */
  loopFx:0,bandCap:false,bandCapT:0,  /* loop-ghost pulse; band-meter caption */
  killerTaught:false,killerRetaught:false,
  od:0,odT:0,odCool:0,odBrk:false,     /* overdrive: eighths left, heat clock, cooldown, break-due */
  odGlow:0,brkGlow:0,finGlow:0,spotGlow:0, /* backdrop envelopes: overdrive, break dim, dive gold, followspot */
  spot:0,lastTapAt:-9,finEnd:0,        /* spotlight; last raw tap time; finale end flag */
  hyper:0,hyperD:0,hyperGlow:0,        /* hypernova: seconds left, full duration, backdrop envelope */
  upg:{},offered:{},offer:[],offerRects:[],picks:[],  /* the upgrade draft */
  layerN:0,bandN:0,bandFx:0,           /* score layers unlocked; band-meter dot count + pulse */
  bandSeen:false,embSeen:false,        /* each HUD meter appears once it has a reading, then stays */
  sndAt:0,sndStr:null,                 /* a NEW SOUND announcement waiting for its banner to clear */
  meetNext:0,teachSoft:false, /* lesson spacing; lesson-without-slowmo */
  holdD:0,hopHintT:0,                   /* the hop lesson: gate, hint clock */
  everHopped:false,struggle:0,coach:null,  /* lifetime hop pref, struggle streak, death coaching */
  bgFade:0,revFlip:0,impactT:0,killer:null, /* sky crossfade, reverse flip, death impact */
  deadPips:0,deadSkip:false             /* death-screen reveal sequencing */
};
loadPrefs();

function curR(){
  if(G.hopP>=1)return radiusOf(G.ringI);
  const p=G.hopP,to=radiusOf(G.ringI);
  /* Ease-out-back: the hop lands with a small overshoot that settles, instead
     of the dead symmetric arrival a smoothstep gives. Purely visual —
     collision runs on ring indices — and clamped to 6u so the comet can
     never visibly leave the track band in either direction. */
  if(RM){const k=p*p*(3-2*p);return G.hopFrom+(to-G.hopFrom)*k;}
  const c1=1.70158,q=p-1;
  const r=G.hopFrom+(to-G.hopFrom)*(1+(c1+1)*q*q*q+c1*q*q);
  const ov=6*u;
  return Math.max(Math.min(r,Math.max(G.hopFrom,to)+ov),Math.min(G.hopFrom,to)-ov);
}
function posPlayer(){return posAt(G.angle,curR());}
function effRing(){return G.hopP<0.5?G.hopFromI:G.ringI;}

/* Magnet stars have one screen-space position shared by contact, crystal,
   bloom and route drawing. Coordinates are in scale units around the hub, so
   resize cannot strand a captured star in the old viewport. */
const MAGNET_RANGE=110,MAGNET_SECS=10,MAGNET_FLIGHT=0.38;
function starfallFlightPos(s,at){
  const target=posAt(s.a,radiusOf(s.ring)),f=s.flight;
  if(!f)return target;
  const t=Math.max(0,Math.min(1,(at-f.delay)/f.duration)),q=1-(1-t)*(1-t),k=1-q;
  return [cx+(k*k*f.x+2*k*q*f.cx)*u+q*q*(target[0]-cx),
    cy+(k*k*f.y+2*k*q*f.cy)*u+q*q*(target[1]-cy)];
}
function starVisualPos(s){
  return s.mag?[cx+s.mag.x*u,cy+s.mag.y*u]:starfallFlightPos(s,s.t);
}
function updateMagnetStar(s,dt){
  if(bhActive()||(s.flight&&s.t<s.flight.delay))return;
  const target=posPlayer(),tx=(target[0]-cx)/u,ty=(target[1]-cy)/u;
  if(!s.mag&&G.spot>0&&Math.abs(s.ring-effRing())<=1){
    const p=starVisualPos(s),x=(p[0]-cx)/u,y=(p[1]-cy)/u;
    const dx=tx-x,dy=ty-y,d=Math.hypot(dx,dy);
    if(d<=MAGNET_RANGE){
      const bend=Math.min(22,d*0.28)*(G.dir||1);
      s.life=Math.max(s.life,s.t+MAGNET_FLIGHT+0.2);
      s.mag={x:x,y:y,x0:x,y0:y,cx:(x+tx)/2-dy/Math.max(1,d)*bend,
        cy:(y+ty)/2+dx/Math.max(1,d)*bend,t:0};
    }
  }
  if(!s.mag)return;
  const m=s.mag;m.t=Math.min(MAGNET_FLIGHT,m.t+dt);
  const q=m.t/MAGNET_FLIGHT,k=1-q;
  m.x=k*k*m.x0+2*k*q*m.cx+q*q*tx;
  m.y=k*k*m.y0+2*k*q*m.cy+q*q*ty;
}
function starTouchesPlayer(s,er){
  if(s.flight&&s.t<s.flight.delay)return false;
  if(s.mag||(s.flight&&s.t<s.flight.delay+s.flight.duration)){
    const p=starVisualPos(s),c=posPlayer();
    return Math.hypot(p[0]-c[0],p[1]-c[1])<=22*u;
  }
  return s.ring===er&&sweptHit(s.a,(22*u)/radiusOf(er));
}

/* Swept-arc test: covers the whole angle travelled this frame, so nothing
   tunnels through a shard on a big screen or after a dropped frame. */
function sweptHit(target,tol){
  if(G.sweep<=0)return angDist(G.angle,target)<tol;
  if(G.sweep+tol>=TAU)return true;
  let d=(target-G.prevAngle)*G.dir;
  d=((d%TAU)+TAU)%TAU;
  if(d>TAU-tol)d-=TAU;
  return d<=G.sweep+tol;
}

function burst(x,y,col,n,spd){
  for(let i=0;i<n;i++){
    const a=Math.random()*TAU,s=rand(spd*0.35,spd);
    G.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,dec:rand(1.2,2.4),col,size:rand(1.5,3.5)*u});
  }
}
function ripple(x,y,col){G.rings.push({x,y,r:10*u,life:1,col:col||COL.comet});}
/* A pickup flash that follows the ring it happened on, instead of a circle
   stamped across the orbit. This is the most repeated moment in the game, so
   it is the one most worth making feel like part of the world. */
function arcFlash(a,ring,col){G.arcs.push({a:a,ring:ring,life:1,col:col});}
function popup(x,y,str,col,sz){
  /* cap the cloud: at mid-game density 6-8 texts floated at once. Oldest
     yields — the newest popup is the one narrating what just happened. */
  /* FOUR, NOT SIX, AND THE OLDER ONES STEP BACK. Screenshotted in the
     finale: four identical "+60" floating in a column down the left margin
     at equal weight, none of them the news. Six was a cap on the crash, not
     on the noise. Four still lets a nova cascade read as a cascade, and the
     survivors dim by age at the draw so the eye lands on the newest without
     a second of them being lost. */
  if(G.pops.length>=4)G.pops.shift();
  G.pops.push({x,y,str,col,life:1,sz:sz||1});
}
/* NOVA. A front that expands from the pickup and turns what it touches into
   light. Converting on CONTACT rather than all at once is the whole point:
   the old version swapped every shard for an ember inside a single frame, so
   the most powerful thing in the game had no duration to it at all. Now you
   watch it travel — nearest shards first, each one detonating as the wave
   reaches it, so the board comes apart in a cascade instead of a cut.

   SPEED WAS TUNED TO THE WRONG DISTANCE. 1600 was picked so the front clears
   a screen diagonal inside its lifetime, and it does — but no shard is ever
   out on the diagonal. The blast is centred on the comet and every shard sits
   inside the ring system, so the farthest one is 2R away: 334px on a 390px
   phone, crossed in 0.225s at the old speed. The cascade this function is
   written to produce finished in thirteen frames and the front then spent
   another half second expanding through empty space. 560 puts the same sweep
   at ~0.65s, which is long enough to read as a wave travelling outward, and
   the decay is slowed to match so the front still outlives the sweep. */
const NOVA_SP=560;
const NOVA_RUN={n:0,at:0,base:0};   /* the cascade's place in its grid run */
/* The 560 figure was tuned on phone geometry, where 2R is ~334px. On a big
   viewport 2R can exceed what 560u/s crosses inside the invulnerability
   window, so the player could die inside their own blast and far shards
   popped in one frame off the expiry net. Each blast now carries whichever
   speed is faster: the tuned one, or the one that clears the ring system in
   the designed ~0.62s. */
function novaBlast(x,y){
  const sp=Math.max(NOVA_SP*u,(2*R+60*u)/0.62);
  G.novas.push({x:x,y:y,r:34*u,life:1,sp:sp,targets:G.spikes.slice()});
}
/* The ember lands on the ring the PLAYER is on, at the angle the shard held.
   Converting in place looked right and paid almost nothing: embers are only
   collectable on your current ring, so on a three-ring board two thirds of a
   nova's output was scenery that expired 5s later. A six-shard nova returned
   about two reachable embers — twelve points against the eighty-six a maxed
   orbit pays, for the rarest thing in the game. Landing them on your own
   track turns the same blast into a guaranteed ember run: the combo climbs,
   the pentatonic phrase resolves, lapEmbers feeds the orbit payout and the
   build meter fills. The burst still fires out where the shard actually was,
   so the light reads as travelling from the danger onto your lane. */
function novaConvert(s,toRing){
  const q=posAt(s.a,radiusOf(s.ring));
  const ring=toRing===undefined?effRing():toRing;
  /* A WALL CONVERTS TO A NECKLACE, NOT A PILE (playtester Buch: "it seems
     to turn them all into stars but place them in a single orbit... stacks
     them on top of each other"). Same-angle formations all land on the
     player's ring, so their embers used to coincide exactly. Each ember now
     steps along the lane in the direction of travel until it has room, so a
     converted wall reads as a string of notes you sweep through in order. */
  /* RICH NOVA doubles the yield, and the second ember walks the same spacing
     search as the first — so a doubled wall is a longer necklace, never two
     embers stacked on one another (which is the exact complaint the spacing
     walk was written for). */
  let ea=s.a;
  const yield2=upgOn('richnova')?2:1;
  for(let c=0;c<yield2;c++){
    for(let f=0;f<8&&G.stars.some(function(st){
        return st.ring===ring&&angDist(st.a,ea)<0.30;});f++)
      ea+=0.36*(G.dir||1);
    /* born marks a nova ember: it condenses from a white-hot point instead of
       the generic fade-in, so the transmutation is watched rather than implied */
    G.stars.push({a:ea,ring:ring,t:0,life:rand(6.0,8.0),born:1});
  }
  burst(q[0],q[1],COL.nova,9,200);
  burst(q[0],q[1],COL.ember,7,130);
  arcFlash(s.a,s.ring,COL.nova);
  arcFlash(ea,ring,COL.ember);
  /* THE CASCADE IS A RUN NOW. Each conversion takes the next sixteenth slot
     and the next pentatonic degree, so a ten-shard nova plays a strict
     ascending sixteenth-note run up the scale — the wave's arrival order
     picks the phrasing, the grid plays it. A gap of most of a second starts
     a fresh run from the bottom. */
  if(AC&&MU&&MU.next&&AC.state==='running'){
    const now=AC.currentTime;
    if(now-NOVA_RUN.at>0.8||NOVA_RUN.base<now){
      NOVA_RUN.n=0;NOVA_RUN.base=Math.max(gridNear(),now+0.012);
    }
    NOVA_RUN.at=now;
    const t=NOVA_RUN.base+NOVA_RUN.n*S16;
    beep(PENT[Math.min(13,NOVA_RUN.n)],0.11,'triangle',0.05,undefined,
      Math.max(0,t-now),panAt(q[0]),1.2);
    NOVA_RUN.n++;
  }else{
    beep(PENT[(Math.random()*10)|0],0.11,'triangle',0.05,undefined,0,panAt(q[0]),1.2);
  }
}
/* IGNITION. Completing an orbit sets the orbit alight: a head races the full
   circumference in the direction you were travelling, leaving a burning wake.
   It is the one effect that describes what you actually did — the reward is
   the lap itself, drawn. Scale comes from the streak, so the celebration
   grows as the thing being celebrated gets harder. */
function ignite(ring,a,dir,streak){
  G.laps.push({ring:ring,a:a,dir:dir,life:1,streak:streak,
    mag:Math.min(1.6,0.7+0.22*Math.max(0,streak-1))});
}
function checkMile(){
  /* every 250, not every 50: at mid-game rates the 50-step fired a centre
     ripple every 2-3 seconds — a metronome of celebration nobody asked for */
  if(Math.floor(G.score/250)>G.mile){
    G.mile=Math.floor(G.score/250);
    ripple(cx,cy,COL.ember);
    cueTone(function(w){
      /* intervals over the level tonic, like every pitch that sounds
         against the band — the literals were A-minor absolutes, in key on
         one level of six. Written as ratios of the old values over level
         1's 110Hz tonic, so level 1 is bit-identical. */
      beep(CH[0][0]*(330/110),0.10,'triangle',0.05,CH[0][0]*(392/110),w);
      beep(CH[0][0]*(440/110),0.12,'triangle',0.05,CH[0][0]*(523/110),w+S16);
    });
  }
}

/* A shard's hit width is (18.5u)/radius RADIANS, so it doubles on the
   innermost ring — half the radius, twice the angle blocked. Spawn clearances
   were flat radians regardless of ring, which meant that at the mandated
   0.5rad separation two inner-ring neighbours overlapped by 0.068rad: a wall
   with no gap, which the player simply cannot pass.
   Expressing clearance as a multiple of the hit width fixes it on every ring
   AND every screen size, since both terms carry the same u/radius factor.
   Any k above 2 leaves a real gap; k=3.5 reproduces what ring 0 always had. */
function hitTol(ring){return (18.5*u)/radiusOf(ring);}
function sep(ring,k){return k*hitTol(ring);}
/* THE CLEARANCE IS A REACTION-TIME GUARANTEE, AND THERE IS NO REACTION TIME TO
   GUARANTEE BEHIND YOU. That one sentence is the whole change, and it closes
   the strategy a playtester found and correctly called cheating.

   The player term was a single symmetric read of G.angle with no memory and no
   heading: nothing could be placed within `minP` of where the comet IS, on any
   ring. For a player who travels, that is exactly right — it is the promise
   that a shard never materialises inside your stopping distance. For a player
   who does NOT travel, it is a permanent sanctuary that moves with them: any
   oscillation arc narrower than 1.1 rad is provably unreachable by every static
   formation in the game, because every point of the arc is always within 1.1
   rad of every position the player can occupy in it. Simulated against the
   shipped build, a camper that added one hop rule survived five fifteen-minute
   level-4 runs without a scratch inside 1.3 radians of the circle, and a camper
   starting on level 1 cleared levels 1, 2 and 3 inside a 30-degree arc.

   So the exclusion now follows TRAVEL rather than position: the full clearance
   ahead along the heading, a short pad behind. The arc you have just left fills
   in behind you, and turning around means turning into what you abandoned.

   WHY THIS IS NOT A NEW HAZARD. Shards already end up behind the player
   constantly — you travel past them every orbit. The bubble never stopped that;
   it only stopped them being PLACED there. Removing the placement ban does not
   invent a threat class, it removes an artificial shelter for someone who never
   moves. And a shard placed behind still spends its whole warn phase (1.0s at
   the floor, up to 2.35s early) harmless, so the reversal that meets it meets a
   telegraph first, exactly like every other shard in the game.

   THE PAD IS A TIME, NOT AN ANGLE. 0.16s of travel at the current speed, floored
   at 0.45 rad, so nothing can be placed on top of the comet at any speed and the
   guarantee does not quietly shrink as the game gets faster.

   GATES ARE EXEMPT, and that exemption is load-bearing. A gate exists to FORCE a
   reversal, and reverseEscape checks at spawn time that the reversal has 1.1 rad
   of clear run to open onto — a check a later spawn behind the player could
   invalidate. While any gate segment is on the board the bubble stays symmetric,
   so the one formation that demands a turn can never be the one that punishes
   it. The saucer already holds the other half of that rule in pickType. */
const BEHIND_MIN=0.45;
function behindPad(){
  for(const s of G.spikes)if(s.gate&&s.phase<2)return 0;   /* a wall is live: no filling in */
  return Math.max(BEHIND_MIN,0.16*G.speed);
}
function farFromAll(a,ring,minP,minSpike,minStar,behind){
  if(behind>0){
    /* signed distance along the heading: 0 is under the comet, TAU is a full
       lap ahead, so `d > TAU-behind` is the short arc immediately behind */
    let d=(a-G.angle)*G.dir;
    d=((d%TAU)+TAU)%TAU;
    if(d<minP||d>TAU-behind)return false;
  }else if(angDist(a,G.angle)<minP)return false;
  for(const s of G.spikes)if(s.ring===ring&&angDist(a,s.a)<minSpike)return false;
  for(const s of G.stars)if(s.ring===ring&&angDist(a,s.a)<minStar)return false;
  for(const s of G.pows)if(s.ring===ring&&angDist(a,s.a)<minStar)return false;
  return true;
}
function spawnStar(){
  for(let i=0;i<14;i++){
    const a=Math.random()*TAU,ring=Math.floor(Math.random()*G.nRings);
    if(farFromAll(a,ring,0.45,sep(ring,2.8),sep(ring,3.9))){G.stars.push({a,ring,t:0,life:rand(7,10)});return;}
  }
}
function mkSpike(a,ring,extra){
  const s={a:a,ring:ring,t:0,phase:0,bt:0,bo:0,va:0,gate:false,blink:false,
    warn:warnTime(),life:rand(2.6,4.4)*(age()<30?0.7:1)};
  if(extra)for(const k in extra)s[k]=extra[k];
  /* THE THREAT ARMS ON THE GRID. The warn stretches by up to one eighth so
     the instant a shard turns lethal lands on a beat subdivision — danger
     arriving as a note in the arrangement rather than a random knock. */
  if(AC&&MU&&MU.next&&AC.state==='running'){
    const now=AC.currentTime,e=SPB/2;
    let tb=MU.next;while(tb>now)tb-=e;
    const over=((now+s.warn-tb)%e+e)%e;
    if(over>1e-3)s.warn+=e-over;
  }
  return s;
}
/* A gate exists to force a reversal, so it has to leave somewhere to reverse
   INTO. Placement is otherwise uniform-random, which can bracket the player:
   wall ahead, shards behind on every ring. A death you had no move against
   reads as the game cheating, and that is the one thing that stops a run
   being worth retrying — so we check first and downgrade the formation
   rather than ship the trap. */
const GATE_ESCAPE=1.1; /* radians of clear run the reversal must open onto */
/* ---------- THE SAUCER ----------
   THE BODY IS NEVER SOLID. Only the shot is. That is the whole answer to the
   playtester's own objection to his own idea — "I know that's getting tricky
   and could lead to some 'there's no way to escape getting hit' moments" — and
   it is not a compromise, it is what makes the mechanic legible. A solid
   object pinned behind the comet would be lethal on the same frame as the tap,
   and the tap is the game's primary survival verb: it would turn every
   reflexive reversal into a death with no move against it, which is the one
   thing this game treats as unforgivable.
   So the saucer threatens on a CLOCK instead of on contact. It rides your tail
   while you travel, harmless. Turn back and it is suddenly in front of you: it
   holds there and charges for one full beat, then blocks the ring it is on for
   a moment. One beat of warning, one verb to answer with, and the answer
   always exists — it is still on the ring you LEFT, so a hop during the charge
   is a clean escape, and it takes SAUCER_HOP to follow you.
   The lag is angular and small (0.55 rad), so it reads as a tail rather than
   as another red across the board. It could not have been a contact threat at
   that distance anyway: a head-on closing rate of twice player speed gives
   0.1s at level-4 speeds, and the game's own reaction floor is a full second
   of telegraph (warnTime). The charge IS that telegraph. */
const SAUCER_LAG=0.55;   /* radians it holds off the tail — a tail, not a wall */
const SAUCER_CHG=SPB;    /* one beat of wind-up, so the shot lands in the bar */
const SAUCER_BEAM=0.42;  /* how long the ring stays blocked */
const SAUCER_HOP=0.42;   /* it follows a ring change, but not instantly */
/* One at a time, never beside a wall, and never without somewhere to hop.
   The gate exclusion is the load-bearing one — see the note in pickType. */
/* THE COOLDOWN IS WHAT KEEPS IT A VISITOR. Without it the saucer is simply
   PRESENT: it is one type in a pool of eight drawn every ~0.85s, so a 7-10s
   life meant the next one arrived before the last had gone and measured
   uptime was 45-57% of level 4. A shape that is on screen half the time is
   not an event, it is the weather — and this one is loud, it holds station in
   the player's eyeline and it fires. Held to roughly a quarter of the run. */
const SAUCER_COOL=[9,15];
function saucerOK(){
  if(G.nRings<2||G.t<G.sauT)return false;
  for(const s of G.spikes)if(s.saucer||s.gate)return false;
  return true;
}
function reverseEscape(minArc){
  for(let k=0;k<G.nRings;k++){
    let clearRing=true;
    for(const s of G.spikes){
      if(s.ring!==k||s.phase===2)continue; /* phase 2 is fading, harmless */
      /* distance to this shard measured along the post-reversal heading */
      let d=(s.a-G.angle)*(-G.dir);
      d=((d%TAU)+TAU)%TAU;
      if(d<minArc){clearRing=false;break;}
    }
    /* any ring will do — hops are fast enough to chain within this arc */
    if(clearRing)return true;
  }
  return false;
}
/* EVERY MECHANIC EXPLAINS ITSELF THE FIRST TIME IT EVER APPEARS. The banner
   names a new tier, but it competes with the thing it is announcing — so the
   first spawn of each formation type (once per device, persisted) dilates
   time for ~3 seconds, holds further spawns, and puts the one relevant
   sentence dead centre while the new thing is actually on screen. Acting
   ends nothing here — the lesson simply expires; it is a pause, not a test. */
/* soft:1 marks a lesson that shows WITHOUT slow-mo — dilation is protection
   for threats, not ceremony for rewards. The flag lives in the table so the
   list can never go stale again (it used to be an enumeration naming two
   orbs that had been cut from the game, which ran the spotlight and the
   gold star through full threat-grade slow-mo). */
/* ONE SENTENCE PER IDEA, AND THE SAME ONE EVERY TIME. Each lesson here is
   word-for-word the `sub` on its tier banner: the banner names the shape, the
   lesson repeats the rule while a specimen is lit, and the death coach says it
   a third time. Repetition of one sentence teaches; three paraphrases of one
   sentence read as three rules, which is what "there were like eight rules"
   was actually counting. Changing one of these means changing both. */
const MEET={
  /* NOT "red kills you". It does not — not for the first two hits of any run,
     because every run starts with two shields, and the level 1 card says so in
     as many words twenty seconds earlier. The game was teaching a rule and
     then visibly breaking it, which is the fastest way to make a player stop
     trusting anything else it tells them. The lethal half is taught where it
     becomes true: the LAST SHIELD popup, at the moment the bank empties. */
  /* NAMES THE TWO VERBS, because this is the sentence where the player most
     needs to know what their options ARE. "get out of its way" shipped here
     and in the hint ladder for a long time, and it is the same defect this
     table's own note diagnoses twice below: it describes a manoeuvre rather
     than an input. There is no getting out of the way in this game — there is
     turning around and there is changing ring, and at the moment red is first
     explained those two facts are the whole of what is useful. Longer than
     what it replaces; fitSz already handles that. */
  single:  {t:'Red hits cost a shield; tap to turn or swipe rings',g:'shard'},
  /* THIS GAME HAS NO AIMED MOVEMENT. The comet travels a fixed circle at a
     fixed speed and there are exactly two verbs: turn around, change ring.
     There is no positioning, no threading, no stopping, no aiming. So a lesson
     that talks about the space between two objects is describing a manoeuvre
     that does not exist here — the player was never trying to go between them
     and has no way to. It reads as a non-sequitur because it IS one.
     Two earlier wordings both failed this way and I diagnosed them as two
     different bugs: one invoked outrunning (there is one fixed speed), the
     other invoked fitting through a gap. Same mistake twice — importing a
     manoeuvre from a genre this game is not.
     What is left is what the game actually has: a count, and a verb. */
  twin:    {t:'Two red obstacles: swipe to another ring',g:'swipe'},
  gate:    {t:'A wall blocks every ring; tap to turn around',g:'tap'},
  /* NOT "these ones chase you", and not "keep moving" — a drifter is given a
     fixed random heading well under player speed and never steers, and there
     is no input in this game that stops you moving. Both halves named a
     behaviour the player would then watch not happen. */
  drift:   {t:'This red obstacle moves; tap to turn away',g:'shard'},
  blink:   {t:'Pass through the open shape; avoid solid red',g:'shard'},
  driftgate:{t:'The wall moves; tap to turn before it reaches you',g:'tap'},
  /* NAMES A VERB THE GAME HAS AND CLAIMS ONLY WHAT IS TRUE. Not "shake it"
     (you cannot — it follows the hop), not "outrun it" and not "get past it"
     (there is no aimed movement here to do either with). Trigger, effect,
     counter-move, in the game's own nouns: turn back is the tap, blocks the
     ring is what a gate already means, swipe off is the hop. The player can
     check every clause of it against the screen inside one charge, which is
     the test the two twin wordings failed. */
  saucer:  {t:'Turning triggers its shot; swipe to another ring',g:'swipe'},
  blinktwin:{t:'The shapes take turns opening; pass through the open one',g:'shard'},
  /* NAMES THE ONE THING THAT IS NEW AND NOTHING ELSE. Every other shard in
     the game answers "which ring?" once; this is the only one whose answer
     changes, so the sentence is about the answer changing and about where to
     look — not about speed, not about dodging, not about a manoeuvre. "watch
     where it lands" is a thing the player can literally do, on the chevron
     the telegraph draws for them, inside one specimen. */
  dive:    {t:'It moves to the marked ring; swipe to another ring',g:'swipe'},
  /* THE MIRROR OF THE GATE LESSON, DELIBERATELY WORDED AS ONE. gates says
     "every ring is blocked — tap to turn around"; this says the same shape of
     sentence with the other verb, because the formations are the same shape
     of idea with the other verb. A player who learned the first reads the
     second in one glance, which is the entire reason THE NARROWS is the last
     thing the game teaches rather than a fifth kind of wall. */
  funnel:  {t:'Swipe to the ring with no wall',g:'swipe'},
  spot:  {t:'Magnet: nearby stars curve into you for 10 seconds',g:'magnet',soft:1},
  /* NOT "gold", and not "double". COL.hyper is '#ff4fd8' and SPR.powHyper
     fills with it — the orb is magenta. Gold is COL.ember, the colour of the
     ordinary collectibles the player is picking up continuously, so the one
     sentence whose job is to identify the object sent them hunting for the
     most common thing on screen. The speed is 1+0.9*hv, eased in and out, so
     "double" rounded up on a value that spends a fifth of its life below even
     1.9x. */
  /* ONE NAME PER OBJECT. This said "the pink star" while the pickup popup,
     the say line and the HUD chip all said HYPERNOVA — the object was renamed
     mid-encounter, seconds apart, on its guaranteed level-2 introduction.
     The name leads and the colour stays as the pointer that finds it. */
  hyper: {t:'Hypernova: move faster, safe from red, for about 9s',g:'star',soft:1},
  /* NAMES WHAT IT DOES, NOT WHAT IT IS MADE OF. "a second comet" is a fact
     about the implementation; "it gathers and it shatters" is the two things
     the player will watch it do. Soft, because it is a pure reward — dilation
     is protection from threats, not ceremony for gifts. */
  mirror:{t:'Mirror: a second comet collects stars and clears red for about 9s',g:'star',soft:1},
  /* THE ONE SENTENCE THAT HAS TO CARRY THE ASYMMETRY. Scorch is the only orb
     whose value is decided by how the player behaves while it runs — a lap
     makes a lap safe and standing still makes almost nothing safe — so the
     lesson has to say "keep going", which is a thing they can do, rather than
     "your wake burns", which is a thing that happens to them. */
  scorch:{t:'Scorch: your path clears red obstacles for 8s',g:'swipe',soft:1},
  slip:{t:'Slipstream: swipe rings to clear nearby red for 12s',g:'swipe',soft:1},
  trail:{t:'Star trail: collect nine bonus stars within 16s',g:'star',soft:1},
  /* NOT soft. Every other orb lesson is soft:1 — dilation is protection from
     threats, not ceremony for rewards — and this is the one orb that is not a
     reward. Taking it starts a mode that is slower, four times as crowded and
     an orbit deeper, and the player gets one sentence's warning before it does.
     Naming the trade IS the lesson, because both halves are true at once and
     a sentence that gave only one of them would be a lie in either direction.
     "everything slows" is the easier half; "the reds pile up" is the harder;
     "a new ring" is the thing they will see and otherwise not believe. */
  blackhole:{t:'Black hole: ride the inner ring; at ESCAPE, swipe to the outer ring',g:'warp'},
  /* not a spawned object: fired by the first reversal that discards most of
     an orbit — the one rule of the scoring economy nothing else teaches */
  /* fired by the FIRST completed lap. The orbit was the game's biggest
     unnamed mechanic: the payout popup is suppressed above speed 2.6 unless a
     streak is already building, so a player who found their rhythm early
     could orbit for a whole run and never see the word. */
  /* "orbit", never "lap". The scoring act had two names, and a player's very
     first completed circle read both in the same frame — this lesson said
     "a full lap" while the payout popped "ORBIT +N" beside it. One word,
     everywhere a player can read: orbit (it was already in the menu key row,
     the popups, the share text and the FIRST ORBIT tier). */
  orbit: {t:'An orbit is a full circle without turning; it earns bonus points',g:'star',soft:1},
  lapcost:{t:'Turning restarts your orbit; collected stars still count',g:'star',soft:1},
  /* THE MUSICAL CURRICULUM (playtest: "combos are never explained, timing
     beats is never explained, the music responding to your beats is never
     really explained — some of the best parts of the game are never used
     by new players"). Three event-triggered lessons name the rhythm layer
     the moment the player first touches it. */
  music: {t:'Each tap and ring change plays a note',g:'beat',soft:1},
  /* EACH COUNTER NAMES ITSELF WITH THE LABEL THE HUD PRINTS FOR IT, and no
     two of them share a noun. This one taught "the chain climbs" while the
     HUD called it ON BEAT; the one below taught "chain stars" while the HUD
     called it COMBO; the finale paid "+60 CHAIN" for a third rule again. */
  beat:  {t:'Tap with the beat to earn bonus points',g:'beat',soft:1},
  /* the combo caps at 6 (G.combo=Math.min(G.combo+1,6)) and the lesson fires
     at 3, so it promised an unbounded climb three rungs before it flattened
     and no player-facing string named the ceiling */
  combo: {t:'Collect stars close together to earn up to 6 points each',g:'star',soft:1}};
function firstMeet(type){
  if(G.intro)return;
  if(G.seen[type]||!MEET[type])return;
  /* AND NEVER IN THE LAB, which is the difference between a testing rig and a
     trap. The lab shows one orb dozens of times; the first of those would fire
     that orb's first-encounter lesson, set its seen bit and persist it — so
     opening the lab to look at the black hole would permanently spend the
     lesson the real game gives you the first time you meet one, and the
     player would never learn it was gone. Deferred rather than suppressed:
     seen is not set, so the encounter that matters still gets its lesson. */
  if(LAB.on)return;
  /* A LESSON WAITS FOR A CALM BEAT. Mid-game, first encounters used to fire
     their 0.35x time dilation in the middle of dense play — a slow-motion
     surprise at the moment attention was scarcest, and lessons could land
     back to back. Now: never within 9s of the last lesson, never while a
     lethal shard is armed near the player, and never while the centre slot
     is already owned by a fresh banner or a payoff card — a lesson that
     runs behind a banner is SPENT without ever being read, and the seen
     bit made that unrecoverable. A deferred lesson is simply re-offered by
     the NEXT encounter of the same type (seen is not set). */
  if(G.t<G.meetNext)return;
  /* never hijack the hop rehearsal: overwriting teachKind mid-rehearsal
     stranded the radial guide AND the 8s window (hop() only ends 'hop'
     lessons) — the lesson simply waits for the next encounter */
  if(G.teach>0&&G.teachKind==='hop')return;
  if(G.banner&&G.banner.t<2.4)return;
  if(G.landFx||G.secFx)return;
  /* AND NEVER INSIDE A BLACK HOLE. The mode owns the centre slot — its own
     banner, its countdown label, the horizon display — and a hard lesson
     drops a veil over the whole screen and dilates a world already running
     at 0.42x. Screenshotted: the arena went dark mid-mode and the HUD with
     it, because the saucer's first encounter fired at second eleven of a set
     piece. Deferred, not spent: seen is not set, so the next encounter of the
     same type offers it again, exactly like the two deferrals above. This is
     the third of the mode's screen-owning guards, beside the tier banner and
     the hint ladder. */
  if(bhActive())return;
  /* soft (no slow-mo) for reward orbs by table flag — and for RE-offers:
     when a death re-armed this lesson (see die), the sentence returns but
     the ceremony does not, so a veteran is never slow-motioned twice */
  const soft=!!MEET[type].soft||!!G.seen2[type];
  /* REWARD LESSONS YIELD TO THE ONE THAT KEEPS YOU ALIVE. The 9s spacing
     above is first-come-first-served, and on a fresh device the musical
     curriculum comes first: measured, combo fired at 5.4s, music at 14.4s,
     orbit at 24.7s, lapcost at 33.9s — and the red shard's lesson, the only
     one about the thing that kills, landed at 44.3s, half a minute after the
     first red armed. A soft lesson therefore waits until the red lesson has
     landed on this device; deferred, not spent, exactly like the guards
     above, so each returns at its next trigger once red has had its say. */
  if(soft&&!G.seen.single)return;
  /* the armed-shard deferral protects against SLOW-MO mid-danger — a soft
     lesson never dilates, so it reads like any hint and may fire in traffic
     (for lapcost that is exactly the teachable moment, and a re-offer that
     required storm-grade calm could defer forever while pickType insists) */
  if(!soft){
    /* a hard lesson freezes the world — never spend a live timed reward's
       clock on it. The hypernova, spotlight and slow-mo run on real time,
       and 2.8 frozen seconds is a third of the marquee item burned while
       the player cannot move. Deferred, re-offered next encounter. */
    if(G.hyper>0||G.spot>0||G.slow>0||G.mirror>0||G.scorch>0||G.slip>0||
       G.stars.some(s=>s.trail))return;
    const mer=effRing();
    for(const sp of G.spikes)
      if(sp.phase===1&&sp.ring===mer&&angDist(sp.a,G.angle)<1.2)return;
  }
  G.meetNext=G.t+9;
  G.seen[type]=1;
  savePref('cometloop:seen',Object.keys(G.seen).join(','));
  G.teach=Math.max(G.teach,2.8);
  G.teachKind='see';
  G.teachType=type;
  G.teachSoft=soft;
  G.teachHint=MEET[type];
  cueLesson();   /* the one sound that always means "a lesson is on screen" */
}
function spawnSpike(){
  let type=BH.phase===2?(Math.random()<0.25?'drift':'single'):pickType();
  if(BH.phase===2&&BH.escape)return;
  if((type==='gate'||type==='driftgate')&&!reverseEscape(GATE_ESCAPE))type='single';
  /* THE SAUCER IS PLACED AGAINST THE PLAYER, NOT AGAINST THE BOARD, so it
     skips the placement loop entirely — there is exactly one position it can
     take and no reason to roll for it. The star dive is the existing
     precedent for a system that legitimately puts an object inside the
     player's no-spawn bubble (FIN.trail starts at G.angle+dir*0.9 and never
     calls farFromAll); this is the second, and for the same reason — the
     object's whole meaning is its relationship to where the comet is.
     Downgraded rather than skipped if the board has turned against it between
     pickType and here, which matches how gates fail. */
  if(type==='saucer'){
    if(!saucerOK())type='single';
    else{
      const sw=G.seen[type]?{}:{warn:warnTime()*1.6};
      firstMeet(type);
      G.sauT=G.t+rand(SAUCER_COOL[0],SAUCER_COOL[1]);
      G.spikes.push(mkSpike((G.angle-G.dir*SAUCER_LAG+TAU)%TAU,G.ringI,
        Object.assign({saucer:true,side:1,chg:0,fire:0,hopT:0,sdir:G.dir,
          life:rand(5,7.5),spot:(G.teach>0&&G.teachType===type)?1:0},sw)));
      return;
    }
  }
  /* firstMeet is called at each SUCCESS site below, never up here: the
     placement loop can fail outright on a dense board, and calling it
     first spent the once-ever lesson (dilation, sentence, seen bit) on a
     formation that never existed. The unseen-type long telegraph is also
     computed BEFORE the lesson stamps seen, so a type's first specimen
     always telegraphs 1.6x — the shard teaches alongside the sentence. */
  const clear=age()<26?1.5:1.1;
  /* THREATS ONLY. Stars and power-up orbs keep the old symmetric clearance —
     letting rewards fill in behind a stationary player would hand the camper a
     reason to stay put, which is the exact behaviour this change exists to
     price. The arc behind you gets colder, not richer. */
  const bp=behindPad();
  /* ---- TRY HARD, THEN SETTLE ----
     THE INTERESTING SHAPES COULD NOT PLACE ON A BUSY BOARD, and that is why
     the back half stopped escalating. Measured by reading the flags off every
     spike standing on the board, over 110s per level: mean shape rank 1.39 on
     level 3, 1.72 on level 4, 1.33 on LEVEL 5 and 1.51 on level 6 — level 5's
     board was LESS complex than level 3's, and gates, divers, funnels and
     saucers were all but absent from levels 4-6 entirely. The pool was not the
     problem: sampled in isolation at dl 810+ it returns hard shapes 70% of the
     time and singles 2%. PLACEMENT was the problem. A gate needs every ring
     clear at one angle, a funnel needs the same plus a wider gap in its open
     lane, a diver needs two rings clear — and on a board already carrying nine
     shards none of those can be satisfied, so all 18 attempts fail and the
     game quietly serves another twin. Density was crowding out variety.
     So shard-to-shard separation RELAXES across the attempt sequence: the
     first tries hold the full spacing, the last accept about 55% of it. The
     player clearance does NOT relax and cannot — `clear` is the reaction-time
     guarantee, the promise that nothing materialises inside your stopping
     distance, and it is the one number here that is not a preference. This
     trades a little shard-to-shard breathing room, late and only when the
     board is full, for the formations the level is supposed to be about. */
  for(let i=0;i<18;i++){
    const relax=1-0.45*(i/17);
    const a=Math.random()*TAU;
    let ring=Math.floor(Math.random()*G.nRings);
    /* ACCRETION: inside the black hole the draw leans one ring inward 45% of
       the time, giving 13.75/25/25/36.25% across the four orbits instead of a
       flat 25% each. Two things were wrong with the flat draw. The fourth
       ring made the mode EASIER by arithmetic — the same shard budget spread
       over four orbits is 0.75x the per-ring density of three, so the one
       feature the pitch called "epic" was quietly a difficulty discount. And
       the gradient is what makes the rest of the mode mean anything: gravity
       drags the comet toward the centre, the 2x stars pay at the centre, so
       the centre has to be where the reds are. Retreating outward is still
       allowed and still safe — it just costs a swipe every four seconds,
       which is the "harder and easier simultaneously" the pitch asked for. */
    if(BH.phase===2&&Math.random()<0.45)ring=Math.min(G.nRings-1,ring+1);
    /* THE NARROWS — a wall with one lane left open, answered by a HOP where a
       gate is answered by a TAP. Placed against the PLAYER's ring rather than
       against the board, which is why it does not use the gate's
       reverseEscape check: the escape it has to guarantee is a lane, not an
       arc. The open lane is adjacent to the comet's current ring, so exactly
       one swipe answers it, and it is never the ring the comet is already on
       — that would be a wall demanding nothing. */
    if(type==='funnel'){
      if(G.nRings<2)break;
      if(angDist(a,G.angle)<1.7)continue;
      const open=G.ringI+(G.ringI===0?1:G.ringI===G.nRings-1?-1:(Math.random()<0.5?1:-1));
      let ok=true;
      for(let k=0;k<G.nRings;k++){
        /* the open lane is held to a WIDER clearance than the walls: it is
           the only way out, so a shard sitting in it turns the formation
           from a demand into a trap */
        if(!farFromAll(a,k,k===open?2.2:1.7,sep(k,3.5*relax),sep(k,2.5*relax)))ok=false;
      }
      if(!ok)continue;
      const flife=rand(2.0,3.0);
      const fw=G.seen[type]?{}:{warn:warnTime()*1.6};
      firstMeet(type);
      const ftag=(G.teach>0&&G.teachType===type)?1:0;
      let anchor=1;
      for(let k=0;k<G.nRings;k++){
        if(k===open)continue;
        /* `bar` marks the one segment the rung is drawn from — a plain gate
           anchors on ring 0, which a funnel may not have */
        G.spikes.push(mkSpike(a,k,Object.assign({gate:true,funnel:true,gap:open,
          bar:anchor,life:flife,spot:ftag},fw)));
        anchor=0;
      }
      return;
    }
    if(type==='gate'||type==='driftgate'){
      /* blocks the same angle on EVERY ring: hopping will not save you */
      if(angDist(a,G.angle)<1.7)continue;
      let ok=true;
      for(let k=0;k<G.nRings;k++)if(!farFromAll(a,k,1.7,sep(k,3.5*relax),sep(k,2.5*relax)))ok=false;
      if(!ok)continue;
      const life=rand(1.9,2.9);
      /* Every segment gets the SAME drift, or the bar shears apart — the
         rung is drawn from ring 0's angle and would stop matching the rest.
         Kept well under player speed: a sliding wall should crowd the exit,
         not chase you down. */
      const va=type==='driftgate'?rand(0.18,0.34)*(Math.random()<0.5?-1:1):0;
      const gw=G.seen[type]?{}:{warn:warnTime()*1.6};
      firstMeet(type);
      /* spot marks the specimen a live lesson is explaining — the veil
         draw rings exactly these shards */
      const gtag=(G.teach>0&&G.teachType===type)?1:0;
      for(let k=0;k<G.nRings;k++)G.spikes.push(mkSpike(a,k,Object.assign({gate:true,life:life,va:va,spot:gtag},gw)));
      return;
    }
    if(type==='twin'||type==='blinktwin'){
      const off=rand(0.30,0.40)*(Math.random()<0.5?-1:1);
      /* both halves of a pair take the same heading-aware clearance, or the
         formation could straddle the comet */
      if(!farFromAll(a,ring,clear,sep(ring,3.5*relax),sep(ring,2.5*relax),bp))continue;
      if(!farFromAll(a+off,ring,clear,sep(ring,3.5*relax),sep(ring,2.5*relax),bp))continue;
      const life=rand(2.4,3.6);
      firstMeet(type);
      /* tw stamps the pairing on both shards: a lone shard cannot say which
         formation it came from, so twin deaths used to report 'single' and
         the death coach went silent for the exact formation that forces
         the unfamiliar verb */
      const ttag=(G.teach>0&&G.teachType===type)?1:0;
      if(type==='blinktwin'){
        /* Half a cycle apart AT DUTY 0.5, so the pair strictly alternates:
           at every instant exactly one side is lethal and the other is the
           gap. Never both dormant (no free pass) and — the half that used to
           be false — never both armed, so "only one is solid at a time" is a
           promise the mechanic actually keeps. */
        const bl=rand(4.4,6.2);
        G.spikes.push(mkSpike(a,ring,{blink:true,bo:0,duty:0.5,life:bl,tw:type,spot:ttag}));
        G.spikes.push(mkSpike(a+off,ring,{blink:true,bo:BLINK*0.5,duty:0.5,life:bl,tw:type,spot:ttag}));
      }else{
        G.spikes.push(mkSpike(a,ring,{life:life,tw:type,spot:ttag}));
        G.spikes.push(mkSpike(a+off,ring,{life:life,tw:type,spot:ttag}));
      }
      return;
    }
    if(!farFromAll(a,ring,clear,sep(ring,3.5*relax),sep(ring,2.5*relax),bp))continue;
    if(type==='drift'){
      /* a type's very first specimens telegraph longer — whether the lesson
         fires now or was deferred for calm, the shard itself teaches */
      const dw=G.seen['drift']?{}:{warn:warnTime()*1.6};
      firstMeet(type);
      G.spikes.push(mkSpike(a,ring,Object.assign({va:rand(0.24,0.5)*(Math.random()<0.5?-1:1),life:rand(3.4,5.2),
        spot:(G.teach>0&&G.teachType===type)?1:0},dw)));
    }else if(type==='blink'){
      const bw=G.seen['blink']?{}:{warn:warnTime()*1.6};
      firstMeet(type);
      G.spikes.push(mkSpike(a,ring,Object.assign({blink:true,life:rand(4.0,6.0),
        spot:(G.teach>0&&G.teachType===type)?1:0},bw)));
    }else if(type==='dive'){
      /* THE LANE IT LEAVES AND THE LANE IT LANDS IN MUST BOTH BE CLEAR. The
         dive is only fair because the arrival is readable, and an arrival on
         top of an existing shard is neither readable nor survivable — so the
         placement is rejected outright rather than downgraded, the same way a
         gate's is. */
      const dto=ring+(ring===0?1:ring===G.nRings-1?-1:(Math.random()<0.5?1:-1));
      if(!farFromAll(a,dto,clear,sep(dto,3.5*relax),sep(dto,2.5*relax),bp))continue;
      const vw=G.seen['dive']?{}:{warn:warnTime()*1.6};
      firstMeet(type);
      G.spikes.push(mkSpike(a,ring,Object.assign({dive:1,diveTo:dto,life:rand(3.0,4.6),
        spot:(G.teach>0&&G.teachType===type)?1:0},vw)));
    }else{
      firstMeet(type);
      G.spikes.push(mkSpike(a,ring,{spot:(G.teach>0&&G.teachType===type)?1:0}));
    }
    return;
  }
}
/* THE CURRICULUM. The first three placements of every run are one of each, in
   this order, and only then does the 40/35/25 roll take over. Left to chance,
   the three types are drawn independently at roughly one placement every 12
   seconds, so a 60-second run — which is most runs, for most players — saw two
   power-ups and had better than even odds of never meeting slow-mo or nova at
   all. Two of the three most interesting things in the game were effectively
   optional content. The tester who asked for "new items, power ups" had been
   playing a game that mostly hands you shields.
   Ordered rather than merely guaranteed: shield first because it is the one
   that keeps you alive and the one the hint ladder already explains, then
   slow-mo, then nova last because it is the spectacle and it wants a board
   with something on it to convert. */
/* ---------- THE MIRROR ----------
   A second comet, opposite you on your own ring, for sixteen beats. It gathers
   what it passes and shatters red on contact, and it cannot be hurt and cannot
   hurt you — it is presence, not protection. On a circular board that is a
   thing no other orb can offer: every existing powerup changes what happens to
   YOU, and this one changes how much of the ring is yours at once. It is
   called THE MIRROR and not THE TWIN, which was the working name, because
   TWIN SHARDS is a formation the player met at dl 18 and two unrelated things
   called twin is the kind of collision this file has paid for before. (ECHO
   was the other candidate and is a banned string — check.mjs fails the build
   on it, because an orb by that name was cut and its teaching data outlived
   it.) */
const MIRROR_BEATS=16;
/* ---------- SCORCH ----------
   Your wake burns. While it lasts, the arc of your own ring you have travelled
   stays lit behind you and destroys any red that is standing in it or arms
   into it — so a full lap makes a full lap safe, and sitting still makes
   almost nothing safe. That asymmetry is the whole design: it is the saucer's
   problem answered from the reward side. The saucer prices camping by putting
   a threat behind a player who will not travel; this pays travelling by making
   distance covered literally the size of the benefit.
   The burn is stored per ring as a ring of sectors rather than as a list of
   arcs, because sectors cannot overlap, cannot leak, and cost one array. */
const SCORCH_SECS=8, BURN_SECT=72, BURN_LIFE=2.6;
const SLIP_SECS=12,SLIP_ARC=0.48,SLIP_GRACE=0.4,SLIP_COOL=0.8;
const STAR_ROUTE_N=9,STAR_ROUTE_SECS=16,STAR_ROUTE_BONUS=4;
function burnIdx(a){return ((Math.floor(((a%TAU)+TAU)%TAU/TAU*BURN_SECT))%BURN_SECT+BURN_SECT)%BURN_SECT;}
function burning(ring,a){
  return !!(G.burn&&G.burn[ring]&&G.burn[ring][burnIdx(a)]>0);
}
/* The route alternates between two adjacent rings, in the direction already
   being travelled. It is a reward to pursue, not a safe lane: reds remain.
   A later pickup replaces the previous route rather than piling routes up. */
function layStarTrail(){
  G.stars=G.stars.filter(function(s){return !s.trail;});
  const r=effRing(),other=r===G.nRings-1?r-1:r+1;
  const life=upgOn('longtrail')?24:STAR_ROUTE_SECS;
  for(let i=0;i<STAR_ROUTE_N;i++){
    G.stars.push({a:(G.angle+G.dir*(0.62+i*0.62)+TAU*2)%TAU,
      ring:i%2&&other>=0?other:r,t:0,life:life,trail:true,trailI:i});
  }
}
/* These collectors run after the comet moves, against the same swept arc as
   player pickups. A point sample skipped the mirror's targets at high speed;
   a nominal speed painted scorch through ground never actually travelled. */
function updateOrbMotion(dt,sdt){
  if(bhActive())return;
  tickStarfall(dt);
  G.slip=Math.max(0,G.slip-dt);
  if(G.slipFx){G.slipFx.t+=dt;if(G.slipFx.t>=0.45)G.slipFx=null;}
  if(G.mirror>0){
    G.mirror=Math.max(0,G.mirror-dt);
    G.mirrorA=G.angle+Math.PI;
    const mr=effRing(),mtol=(22*u)/radiusOf(mr);
    for(let i=G.stars.length-1;i>=0;i--){
      const st=G.stars[i];
      /* The offered route belongs to the player, not the automatic collector. */
      if(st.trail||st.mag||st.ring!==mr||!sweptHit(st.a-Math.PI,mtol))continue;
      G.stars.splice(i,1);
      const mp=posAt(st.a,radiusOf(mr));
      const mpaid=Math.max(1,G.combo);
      G.score+=mpaid;G.diff+=1;G.scorePop=1;
      popup(mp[0],mp[1]-16*u,'+'+mpaid,COL.mirror);
      burst(mp[0],mp[1],COL.mirror,8,150);
      if(AC&&MU)beep(PENT[Math.min(9,3+G.combo)],0.09,'square',0.016,PENT[5],0,panAt(mp[0]),0.2);
    }
    for(let i=G.spikes.length-1;i>=0;i--){
      const sp=G.spikes[i];
      if(sp.ring!==mr||sp.phase!==1||!armed(sp)||sp.saucer)continue;
      if(!sweptHit(sp.a-Math.PI,mtol))continue;
      novaConvert(G.spikes.splice(i,1)[0]);
      const mp=posAt(sp.a,radiusOf(mr));
      burst(mp[0],mp[1],COL.mirror,10,170);
    }
  }
  if(G.burn){
    let anyBurn=false;
    for(const arc of G.burn)for(let q=0;q<BURN_SECT;q++){
      if(arc[q]>0){arc[q]=Math.max(0,arc[q]-sdt);anyBurn=anyBurn||arc[q]>0;}
    }
    if(G.scorch>0){
      G.scorch=Math.max(0,G.scorch-dt);
      const arc=G.burn[effRing()],step=TAU/BURN_SECT;
      const n=Math.max(1,Math.ceil(G.sweep/step));
      /* At least one full orbit of visible wake, including the lab's slower
         board. Stored in gameplay seconds so slow motion does not erase it. */
      const life=Math.max(BURN_LIFE,TAU/Math.max(0.3,G.speed)+0.2);
      for(let q=0;q<=n;q++)arc[burnIdx(G.prevAngle+G.dir*G.sweep*q/n)]=life;
      anyBurn=true;
    }
    if(anyBurn)for(let i=G.spikes.length-1;i>=0;i--){
      const sp=G.spikes[i];
      if(sp.saucer||sp.phase===2||!burning(sp.ring,sp.a))continue;
      novaConvert(G.spikes.splice(i,1)[0]);
      const bp=posAt(sp.a,radiusOf(sp.ring));
      burst(bp[0],bp[1],COL.scorch,12,190);
    }
  }
}
const POW_INTRO=['shield','warp','nova'];
const POW_LESSON={spot:'spotPlaced',hyper:'hyperPlaced',mirror:'mirrorPlaced',
  scorch:'scorchPlaced',slip:'slipPlaced',trail:'trailPlaced',blackhole:'bhPlaced'};
function spawnPow(){
  let type;
  if(LAB.on){
    /* THE LAB IS THE LADDER. Every branch below is a rule about WHEN the game
       is willing to show you something, and the lab exists precisely because
       those rules are the obstacle: the intro trio, the level gates, the pity
       shield, the four guarantees and the black hole's 5% die all answer
       "not yet". One orb, chosen on the picker, placed every time. */
    type=LAB.type;
  }else if(G.introN<POW_INTRO.length){
    /* introN, not powN: the trio replays per RUN, never per level — see the
       reset beside powN's in startGame */
    type=POW_INTRO[G.introN];
  }else if(G.sinceShield>=3){
    /* Every optional offer waits behind the survival bank, including the black
       hole. Otherwise its rare roll could break the three-placement promise. */
    type='shield';
  }else if(G.level>=4&&!G.bhRun&&!G.bhPlaced&&G.t>=G.bhCool&&!bhActive()){
    /* AND LEVEL 4 FINALLY INTRODUCES SOMETHING. The exam still teaches no new
       FORMATION — that half of the curriculum rule is untouched and
       curriculum.mjs still enforces it — but the black hole is guaranteed to
       arrive once on EVENT HORIZON rather than left entirely to a 5% roll.
       A player who reaches the endless level meets the game's biggest set
       piece there; it stays rare everywhere else. The cooldown and the
       !bhActive() guard are new here: without them the guarantee could place
       a second orb while the first was still on the board or while the mode
       was already running. */
    type='blackhole';
  }else if(G.level>=3&&G.t>=G.bhCool&&!bhActive()&&Math.random()<0.05){
    /* THE BLACK HOLE. Rare by design and gated behind its own cooldown as
       well as its roll, because the pitch's whole premise is that it is "a
       rare mode" and "something cool to look forward to" — a thing you meet
       twice a minute is a mechanic, not an event.
       It is the only orb that is not a gift, and the only one you might
       reasonably decline: it sits on a ring like any other pickup, so
       staying off that ring is a real choice with a real cost either way.
       Level 3 onward, per the pitch. It is introduced wherever the player
       first meets it, including level 4 — see the curriculum note in
       CLAUDE.md, which the owner widened to cover all four levels.

       BOTH BLACK HOLE BRANCHES SIT HERE, DIRECTLY BELOW POW_INTRO, and the
       position is the whole point. They used to sit at the BOTTOM of the
       ladder, below hypernova, the pity shield, the bass bomb and the
       spotlight — seven guaranteed placements, and startGame() re-arms every
       one of those flags at each level boundary, so a run that had already
       met all of them on levels 1 and 2 spent level 3's first fifty seconds
       meeting them again before the black hole could roll even once. At the
       measured cadence of ~7.5s per placement that put the first roll at
       ~56s; the median recorded level-3 run dies at 55s, and 64% of them
       ended having never reached a single roll. Telemetry agreed: three
       blackhole_entered events in the game's whole history, every one of
       them on level 4, none on level 3.
       The reorder is safe because the branches it jumps are PATIENT and this
       one is IMPATIENT: hyperPlaced/spotPlaced persist until
       satisfied, so delaying them by one placement costs nothing, while a
       per-placement die that is never rolled is simply gone. */
    type='blackhole';
  }else if(G.level>=2&&!G.hyperPlaced){
    /* THE MARQUEE ITEM IS NOT OPTIONAL CONTENT (the lesson the intro
       curriculum was invented for): at a rare roll a long run could
       plausibly never meet the star at all — the owner reached 6000
       without seeing one. On level 2+ the first placement after the
       curriculum is the star, guaranteed, once per run. */
    type='hyper';
  }else if(G.level>=4&&!G.mirrorPlaced){
    /* THE MIRROR IS LEVEL 4'S ORB, guaranteed once, the same way the star is
       level 2's and the spotlight level 3's. Levels 4 and 5 introduce a
       formation each now; they introduce an orb each too, so the back half of
       the game is taught at the same cadence as the front instead of being
       three levels of the same inventory. */
    type='mirror';
  }else if(G.level>=5&&!G.scorchPlaced){
    type='scorch';
  }else if(G.level>=3&&!G.spotPlaced){
    /* SPOTLIGHT MOVED TO LEVEL 3. Six of the seven orbs used to be met by the
       end of level 2 and levels 3 and 4 introduced nothing at all, which is
       what the owner's rebalance is about: "balance power up introduction,
       mechanics, and difficulty all the way the level 4." Spotlight is the one
       that moves best — it is the least load-bearing of the guarantees
       (hypernova is the marquee item),
       and it is a pure reward, so meeting it later costs a player nothing they
       needed earlier. */
    type='spot';
  }else if(G.level>=2&&!G.slipPlaced){
    type='slip';
  }else if(G.level>=3&&!G.trailPlaced){
    type='trail';
  }else{
    /* the family expansion: two musical orbs join the rotation */
    const rr=Math.random();
    /* MAGNETAR's 0.11 share was redistributed proportionally across the
       remaining six rather than handed to one of them, so removing it changed
       what can appear and not how often the others appear relative to each
       other. The bass bomb's 0.15 goes the same way: with sound off it was a
       weaker nova (a third of the board, no invulnerability, same conversion
       pipeline) and the owner cut it. Shares stay .31/.18/.15/.13/.08
       relative — renormalised over 0.85. */
    /* THE FAMILY IS SEVEN NOW. The magnetar's and the bass bomb's shares were
       each redistributed PROPORTIONALLY when they were cut — removal changes
       what can appear, never how often the survivors appear relative to each
       other — and adding follows the same rule in reverse: the five existing
       orbs keep their ratios exactly (.36/.22/.17/.16/.09 of the old space)
       and the two new ones take a flat 0.16 between them off the top.
       AND THE ROLL RESPECTS THE SAME LEVEL FLOORS AS THE GUARANTEES. It used
       to draw from all seven on any level, so a first-ever run on LIFT OFF
       could be handed the spotlight — level 3's orb — at 37% of every
       post-intro placement, which un-taught the introduction schedule the
       ladder above exists to keep ("hypernova on level 2, spotlight on level
       3"). Filtering by floor and renormalising keeps every surviving ratio
       exactly, per the redistribution rule this comment already states. */
    const POWPOOL=[['shield',0.302,1],['warp',0.185,1],['nova',0.143,1],
                   ['spot',0.134,3],['hyper',0.076,2],['mirror',0.080,4],['scorch',0.080,5],
                   ['slip',0.095,2],['trail',0.095,3]];
    let ptot=0;
    for(const pp of POWPOOL)if(G.level>=pp[2])ptot+=pp[1];
    let prr=rr*ptot;
    type='shield';
    for(const pp of POWPOOL){if(G.level<pp[2])continue;prr-=pp[1];if(prr<=0){type=pp[0];break;}}
  }
  for(let i=0;i<24;i++){
    const a=Math.random()*TAU,ring=Math.floor(Math.random()*G.nRings);
    if(farFromAll(a,ring,0.6,sep(ring,3.2),sep(ring,3.0))){
      G.pows.push({a,ring,t:0,life:7,type});
      /* RARE STAYS RARE, but a DECLINED black hole used to cost the same 55
         seconds as a taken one — so the one orb the game expects you to
         refuse was also the one whose refusal cost the most. The level-4
         guarantee is a guarantee to OFFER, once per run, which is the only
         kind of guarantee an optional thing can carry; bhPlaced still marks
         that offer as spent. A decline now arms a short cooldown instead of
         the full one, and the ordinary 5% roll takes over from there. */
      if(type==='blackhole'){G.bhPlaced=true;G.bhRun=true;G.bhCool=G.t+20;}
      if(type==='hyper')G.hyperPlaced=true;
      if(type==='spot')G.spotPlaced=true;
      if(type==='mirror')G.mirrorPlaced=true;
      if(type==='scorch')G.scorchPlaced=true;
      if(type==='slip')G.slipPlaced=true;
      if(type==='trail')G.trailPlaced=true;
      if(POW_LESSON[type]&&type!=='blackhole')firstMeet(type);
      G.sinceShield=(type==='shield')?0:G.sinceShield+1;
      /* counts PLACEMENTS, not pickups: a player who misses the slow-mo still
         advances the curriculum, or a run spent dodging would serve nothing
         but shields forever. The trio counter advances on the same terms —
         and a pity shield placed while the trio owes one counts as the trio's
         shield, because the thing the slot exists to show has just been shown. */
      if(G.introN<POW_INTRO.length&&type===POW_INTRO[G.introN])G.introN++;
      G.powN++;
      return true;
    }
  }
  return false;
}

function startGame(){
  G.intro=null;G.introSkipRect=null;
  /* A LAB RUN IS NOT A RUN. G.runs is the device's lifetime run count: it
     decides whether a returning player still gets the level-1 card, it rides
     on every telemetry event as run_index, and it is persisted. Ten minutes
     spent looking at orbs would otherwise read, forever after, as ten more
     games played — and would skip the opening card for someone who has in fact
     never played one. */
  if(!LAB.on){G.runs++;savePref('cometloop:runs',G.runs);}
  G.state='playing';G.score=0;G.diff=0;G.newBest=false;G.scorePop=0;G.mile=0;
  /* the level's song, and its head start: a level-2+ start opens with the
     ladder already climbed to the level's floor — silently, because the
     intro card just did the announcing */
  applyLevelMusic();
  const carried=!!G.carryScore;
  if(carried){G.score=G.carryScore;G.mile=Math.floor(G.score/250);G.carryScore=0;}
  /* seed the layer ladder from the carried score, or level 2's first frame
     fires a gold NEW LAYER braam for a layer that has been audible since
     the middle of level 1 — a false announcement that spends the channel's
     credibility exactly where the real ones matter */
  G.layerN=0;
  for(let li=0;li<LAYER_AT.length;li++)if(G.score>=LAYER_AT[li])G.layerN=li+1;
  /* a carried score means the band was already explained last level — the
     caption is once per RUN, not once per level card */
  G.bandCap=G.layerN>0;
  G.combo=0;G.comboT=0;G.lapAcc=0;G.lapStreak=0;G.lapEmbers=0;
  G.lastPopPaid=0;G.lastPopAt=-9;
  /* every run opens in DRIFT and travels out from there — the journey is the
     run's, not the device's, so arriving somewhere is always earned again */
  /* ---- THE JOURNEY SURVIVES A LEVEL BOUNDARY ----
     This reset unconditionally, and startGame() runs on every level advance as
     well as every new run — so a player climbing from level 1 to level 4 had
     the sky sent back to DRIFT three times on the way. Combined with seven
     orbits per world it is the other half of why four of the six worlds were
     content nobody saw: even a clean orbiter who earned three worlds inside a
     level arrived at the next one back at world zero. Measured before this
     line changed: 120s of never reversing bought 27 orbits, which is 3.86
     worlds of travel, and delivered 0.83 — the trickle, and nothing else.
     `carried` is the same signal the black hole's once-per-run guarantee uses:
     true on a level advance, false when a run actually starts. */
  if(!carried)G.skyW=0;
  /* ---- EACH LEVEL PUTS A FLOOR UNDER THE JOURNEY ----
     Levels do not OWN skies — that would fight the journey, which is bought
     with orbits and must never go backwards. They put a floor under it, which
     is the same idiom skyI already uses (it floors at G.level-1). So every
     level has a guaranteed distinct opening image, a player who orbits hard on
     level 2 can arrive at level 3 already PAST its home and keeps every world
     they earned, and nobody is ever sent back to DRIFT for climbing.
     HEAT DEATH opens on DEEP FIELD: the emptiest sky in the table under the
     level that never ends. */
  G.skyW=Math.max(G.skyW,LEVEL_HOME[Math.min(LEVEL_HOME.length-1,G.level-1)]);
  G.orbits=0;G.bestStreak=0;G.shareFx=0;
  G.groove=0;G.grooveT=0;G.grooveFx=0;G.bestGroove=0;G.beat=0;G.dropFx=0;G.armFx=null;G.sayFx=null;
  G.pocket=0;G.missFx=null;
  G.build=0;G.buildFx=0;G.buildSeg=0;G.buildSrc={ember:0,hop:0,time:0,orbit:0};
  G.landFx=null;G.lands=0;G.secScore=0;G.secMult=1;G.secFx=null;G.starfall=null;G.starfallResult=null;
  /* counters restored AFTER the resets above, so the carry survives them —
     sums for the things you accumulate, max for the things you peak at. A run
     that did not carry a score is a fresh run and clears them. */
  if(carried){G.orbits=G.carryOrbits;G.lands=G.carryLands;
    G.bestStreak=G.carryStreak;G.bestGroove=G.carryGroove;}
  else{G.carryOrbits=0;G.carryLands=0;G.carryStreak=0;G.carryGroove=0;G.carryTime=0;}
  /* the chorus's naming line is once per RUN, as its comment and the ledger
     both claim — a carried level boundary keeps the said bit; a fresh run
     (every retry included) clears it. It sat in the per-level reset line
     below at first, so a 1-to-4 climb heard "THE SONG LIFTS" four times. */
  if(!carried)G.saidChor=false;
  G.teach=0;G.teachKind=null;G.teachHint=null;G.campT=0;G.holdD=0;G.hopHintT=0;G.coach=null;
  G.revFlip=0;G.impactT=0;G.killer=null;G.deadPips=0;G.deadSkip=false;
  G.sparkT=0;G.sparkN=0;G.wakeT=0;
  G.od=0;G.odT=0;G.odCool=0;G.odBrk=false;G.odGlow=0;G.brkGlow=0;G.finGlow=0;G.spotGlow=0;
  G.spot=0;G.spotD=0;G.lastTapAt=-9;G.finEnd=0;G.hyper=0;G.hyperD=0;G.hyperGlow=0;
  FIN.on=false;FIN.pend=false;FIN.done=false;FIN.step=0;FIN.score=0;FIN.got=0;FIN.voices=0;FIN.t0=0;FIN.trail.length=0;
  PLAY.tape.length=0;
  LOOP.pat=null;LOOP.n=0;LOOP.until=0;LOOP.heard=false;
  G.bandN=0;G.bandFx=0;G.sndAt=0;G.sndStr=null;G.bandSeen=false;G.embSeen=false;
  G.meetNext=0;G.teachSoft=false;G.teachType=null;ANN.length=0;annNext=0;
  G.lapCut=0;G.lapCutDir=1;G.lapFx=null;G.beatPop=false;G.lsnN=0;G.said8=false;
  G.chorusN=0;G.chorusBars=0;   /* per level, the scale `seconds` uses; saidChor is per run, above */
  G.loopFx=0;G.bandCap=false;G.bandCapT=0;LOOPQ.length=0;
  skyI=0;      /* the sky opens on band 0 — the ratchet re-deepens it as the run climbs */
  pd=null;     /* a finger held across the death screen must not steer the new run */
  /* EVERY RUN STARTS UNPAUSED AND WITH THE BUTTON ARMED. Cleared here rather
     than at each exit, so no path — retry, level card, a picked level, a lab
     restart — can begin a run behind a panel or inside a countdown left over
     from the last one.
     THE COUNTERS ARE THEREFORE PER LEVEL, not per run — startGame() runs at
     every level boundary, not only at a fresh run. That is deliberate and
     matches `seconds`, which has always been this level's clock on both
     telemetry events; it is also why `level_cleared` has to carry the pair,
     since run_ended fires only on death and would otherwise be the sole
     reporter of a number this line had already reset. This comment claimed
     "per RUN" when it was written, which was wrong the moment it was written
     and is exactly the kind of stale claim that makes a careful reader wrong. */
  PAUSE.on=false;PAUSE.resumeT=0;PAUSE.cool=0;PAUSE.n=0;PAUSE.total=0;PAUSE.at=0;
  G.pauseBtn=null;
  BEATQ.length=0;DROPQ.length=0;
  /* brkN resets per RUN: it capped the DRUM BREAK caption per page-load,
     so across a sitting only the first two breaks ever were named */
  if(MU){MU.cool=0;MU.payN=0;MU.barN=0;MU.chainBar=-1;MU.pend=null;MU.brkN=0;}
  endSection();
  G.embers=0;G.blocks=0;G.lastHit='none';
  GEST.tap=0;GEST.swipe=0;GEST.lateSwipe=0;GEST.unresolved=0;
  G.angle=-Math.PI/2;G.prevAngle=G.angle;G.sweep=0;G.dir=1;G.speed=1.40;
  G.nRings=1;G.ringI=0;G.hopFromI=0;G.hopP=1;
  currentWakeReset();
  /* an extra shield while learning: one mistake should not end the lesson */
  /* Two to start, always. One was a single mistake between a new player and
     the retry screen, and shields are now purely "you live" — see the block
     path in updateSpikes. */
  /* the mode's bank is additive, not a replacement: DEEP BANK still means
     'one more shield' in either mode, and chill simply starts one deeper */
  G.shields=2+(upgOn('deepbank')?1:0)+MD().shields;   /* DEEP BANK: literally 'one more shield' */
  G.invuln=0;G.slow=0;G.tsCur=1;G.sinceShield=0;G.revPend=0;G.didShield=false;
  /* Reset EVERY RUN — and a run is not a level. This comment always said
     "run"; the code beneath it ran on every startGame(), which includes every
     level advance, so a player who cleared five levels was re-taught "tap
     anywhere to turn around" and re-served the shield→slow-mo→nova intro trio
     at the top of level 6 — measured: the identical eight-hint beginner
     sequence opened levels 2, 3, 4, 5 AND 6 of a single climb. That replay is
     most of what made the back half read as unowned. `carried` is the same
     signal bhRun already trusts: true on a level advance, false when a run
     actually starts (retries included, which keeps the original intent — a
     returning player, or anyone handed the phone, still gets each reminder
     once, and each clears the instant the thing is done). */
  if(!carried){
    G.didDodge=false;G.sawDrop=false;G.gotWarp=false;G.gotNova=false;G.gotHyper=false;G.gotShield=false;
    G.gotSpot=false;G.gotBH=false;
    G.gotMirror=false;G.gotScorch=false;G.gotSlip=false;G.gotTrail=false;
  }
  G.bhCool=0;G.bhT=0;G.bhN=0;G.bhPlaced=false;
  /* ONCE PER RUN, NOT ONCE PER LEVEL. bhPlaced is cleared on every startGame
     — including a level advance — and the guarantee reads `G.level>=4`, which
     was exactly one level when it was written. With six levels that became a
     guaranteed black hole on level 4, another on 5 and another on 6, on top of
     the ordinary roll: curriculum.mjs's own trace showed BLACK HOLE banners on
     L3, L4, L5 AND L6 of a single playthrough. The orb whose entire design is
     that it is rare — "a thing you meet twice a minute is a mechanic, not an
     event", per the note at its spawn branch — had quietly become the most
     reliable pickup in the back half of the game.
     bhRun survives level transitions and clears only when a run actually
     starts fresh, which is what `carried` distinguishes. The ordinary 5% roll
     still runs everywhere from level 3, so meeting a second one is possible
     and never promised. */
  /* `carried`, not G.carryScore — the latter is consumed and zeroed ~100 lines
     above this, so reading it here is always false and the flag would have
     reset on every level advance, which is the exact bug it exists to fix. */
  if(!carried)G.bhRun=false;
  BH.phase=0;BH.on=false;BH.warp=0;BH.t=0;BH.rings0=3;
  for(let i=0;i<4;i++)RADII[i]=RAD_OFF[i];
  G.dropsEarned=0;G.loopN=0;G.nearN=0;G.bestCombo=0;G.holdTimeout=false;
  /* ONCE PER RUN, LIKE THE LEDGER SAYS. These four are the same bug bhRun's
     comment above describes, applied to the other four guaranteed orbs and
     fixed for one of five: MECHANICS.md says "guaranteed once per run
     (mirrorPlaced)" while this line re-armed every flag at every level
     boundary. Measured on one climb: HYPERNOVA guaranteed on L2, L3, L4, L5
     and L6, SPOTLIGHT five times — and level 5 opened with six marquee
     arrivals in 54 seconds, burying SCORCH and THE NARROWS, the only two
     things level 5 actually introduces. A guarantee belongs to the level it
     names: on a fresh run each flag starts spent for every guarantee whose
     home level is already behind the level the run opens on (a picked
     REDSHIFT start owes level 2 nothing — the level-gated roll below still
     lets the earlier orbs appear), and unspent for the ones still ahead. */
  if(!carried){
    G.hyperPlaced=G.level>2;G.spotPlaced=G.level>3;
    G.mirrorPlaced=G.level>4;G.scorchPlaced=G.level>5;
    G.slipPlaced=G.level>2;G.trailPlaced=G.level>3;
  }
  G.mirror=0;G.mirrorD=0;G.scorch=0;G.scorchD=0;
  G.slip=0;G.slipD=0;G.slipAt=0;G.slipFx=null;
  /* allocated once and cleared per run: four rings of sectors, so a burn
     laid on ring 2 cannot be read off ring 1 and nothing has to be freed */
  if(!G.burn){G.burn=[];for(let bi=0;bi<4;bi++)G.burn.push(new Float32Array(BURN_SECT));}
  for(let bi=0;bi<4;bi++)G.burn[bi].fill(0);
  /* per RUN, with the flags above: a climb that has already reversed, hopped
     and lapped does not re-open level 4 with "tap anywhere to turn around"
     parked over the board */
  if(!carried){G.didReverse=false;G.didHop=false;G.didLap=false;}
  G.stars=[];G.spikes=[];G.pows=[];G.trail=[];G.rings=[];G.pops=[];G.arcs=[];G.laps=[];G.novas=[];G.impacts=[];G.sceneEvent=null;
  G.stop=0;
  /* powT 4, not 6: paired with the dl()>=6 gate below it puts the first
     shield on the board around 10s instead of 17s, which leaves room for all
     three of the intro power-ups inside a short run. */
  G.starT=0.5;G.spikeT=1.2;G.powT=4;G.powN=0;G.started=G.t;G.tier=0;G.banner=null;G.featT=G.t;
  /* the shield→slow-mo→nova intro trio is a CEREMONY, and ceremonies are per
     run: powN keeps counting this level's placements for pacing and telemetry,
     while introN is the only thing the trio branch reads — so level 2 of a
     climb opens with the hypernova guarantee, not a re-run of the syllabus */
  if(!carried)G.introN=0;
  G.sauT=0;
  if(G.level>=2||LAB.on){
    /* didHop is NOT forged here any more — tierIndex exempts level 2+ from
       the twin hold directly, so the hop hint, rehearsal and death coach
       stay honest about what this run's thumbs actually did */
    /* THE LAB CLIMBS THE SAME LADDER, ONCE, AND THEN STOPS. It opens at
       whatever tier LAB_DL names — three rings and two shapes — by the same
       two lines a level-2+ start uses, rather than by assigning G.nRings a
       number of its own. And because the clock never moves, the in-run ratchet
       can never advance past it: no tier arrives mid-session and no banner
       interrupts the thing you came to look at. */
    G.tier=tierIndex();
    for(let i=0;i<=G.tier;i++)if(TIERS[i].rings)G.nRings=Math.max(G.nRings,TIERS[i].rings);
  }
  /* the sky band matches the pre-climbed ladder, same formula as the
     crossing ratchet — level 3 opens in the storm's own ember light */
  /* CLAMPED, because there are six levels and only four sky bands. skyI
     indexes SKY_BANDS (four rows) and is passed to the shader as uPal,
     which clamps to 3 on its own — so an unclamped level 5 or 6 would have
     read SKY_BANDS[4] as undefined and thrown inside the 2D fallback while
     the GPU path quietly carried on. Levels 4, 5 and 6 all floor at the
     deepest band; past that the sky belongs to the world table, not to the
     level number. */
  skyI=Math.min(3,Math.max(G.level-1,G.tier>=T_SKY[3]?3:G.tier>=T_SKY[2]?2:G.tier>=T_SKY[1]?1:0));
  /* a pre-climbed start owns its voice announcement: the crossing that used
     to announce it can no longer happen in-run (STORM sits on level 3's
     floor and endgame crossings hold), so without this the death screen
     kept promising an electric guitar no path could ever announce. Once
     per visit per voice — a retry of the same level stays quiet. */
  if(G.level>=2){
    const vt=G.tier>=T_VOICE[3]?3:G.tier>=T_VOICE[2]?2:G.tier>=T_VOICE[1]?1:0;
    if(vt&&!SND_SEEN[vt]){
      SND_SEEN[vt]=1;G.sndAt=G.t+4.5;
      G.sndStr=vt>=3?'NEW SOUND: ELECTRIC GUITAR':
               vt>=2?'NEW SOUND: SYNTH LEAD':'NEW SOUND: TWIN SYNTHS';
    }
  }
  beep(CH[0][0]*(440/110),0.12,'sine',0.05,CH[0][0]*(880/110));  /* in the level's key */
}
function die(){
  if(G.state!=='playing')return;
  flushLesson(true);   /* a lesson the death interrupted still gets its record */
  G.state='dead';G.deadT=G.t;G.revPend=0;
  /* DYING INSIDE THE BLACK HOLE. bhTick runs whenever bhActive() is true,
     regardless of G.state, so the mode would otherwise complete on the death
     screen: the timer would reach BH_DUR, endBlackHole would fire, the ESCAPE
     bonus and blackhole_survived telemetry would land on a player who did not
     survive, and — if the death came during phase 1 — the fourth ring would
     open post-mortem. Skip straight to the closing warp, starting from the
     current warp position so the orbits unwind smoothly instead of snapping. */
  if(bhActive()){
    /* AND THE DEATH IS RECORDED. There was no event for dying in here at all:
       blackhole_survived fires only on the way out, so the failure case — the
       one number that says whether the mode is too hard — existed nowhere and
       had to be reconstructed by hand-joining an entry to a later run_ended.
       Names follow the one-name-per-ordinal rule: game_level for the 1-4
       level, tier for the unlock ladder. play_mode is not passed — track()
       stamps it on every event already, and a second copy here is a second
       place for it to drift. */
    track('blackhole_died',{game_level:G.level,tier:G.tier,
      seconds:+(G.t-G.bhT).toFixed(1),phase:BH.phase,reached_inner:BH.lit,
      stars:BH.score,score:G.score,run_index:G.runs});
    BH.phase=3;BH.t=BH_WARP*(1-BH.warp);
  }
  pd=null;   /* the gesture died with the run */
  /* THE LAB SCORES NOTHING. Guarded here at the point the record is COMPUTED
     and not merely at the savePref below it: G.best and REC[MODE].best are
     what the title screen's best line prints, so a lab score that skipped the
     write alone
     would still have rewritten the menu's best for the rest of the visit and
     then vanished on reload — a number the player watched appear and could
     never reproduce. A board pinned at dl 40 with red switched off is not a
     score anybody earned. */
  G.newBest=!LAB.on&&G.score>G.best&&G.score>0;
  if(!LAB.on&&G.score>G.best){G.best=G.score;REC[MODE].best=G.best;savePref(recKey('best'),G.best);}
  /* THE SCREEN THE PLAYER IS GUARANTEED TO READ finally uses what the game
     already measured. One line, phrased as an invitation — a struggling
     player does not need another demand. */
  const secs=G.deadT-G.started;
  /* THE RUN IS OFFERED TO THE BOARD HERE, and offered is the word: it is a
     fire-and-forget call that swallows its own failures. A player who has just
     died is owed the death screen, not a network error, and the board is not
     part of the game's own record-keeping — G.best was already written above,
     on this device, before this line runs. Signed out, offline or in the lab,
     this does nothing at all. */
  cloudSubmit(G.score,G.level,secs);
  if(!G.didHop&&G.nRings>1)G.coach={t:'Swipe '+(SWIPE_MODE==='screen'?'up or down':'toward or away from the center')+' to change rings',g:'swipe'};
  /* EVERY NAMED KILLER COACHES WITH ITS OWN LESSON, WORD FOR WORD. Four of
     these were hand-written paraphrases sitting above the fallback that
     already read MEET — so a gate death said "gates want you to turn back",
     the gate banner said "every ring blocked", and the gate lesson said "every
     ring is blocked", and the player was asked to notice those were one rule.
     The fallback was right and the special cases were the bug. */
  else if(G.lastHit!=='single'&&MEET[G.lastHit])G.coach={t:MEET[G.lastHit].t,g:MEET[G.lastHit].g};
  /* a plain red got through, which by definition means the bank was empty:
     name the state that made it lethal rather than contradicting the rule the
     player was taught twenty seconds ago */
  else if(secs<30)G.coach={t:'No shields left: avoid red by tapping or swiping',g:'shard'};
  else G.coach=null;
  /* A DEATH RE-ARMS THE LESSON IT DISPROVES, once per type per device: if
     the killer's lesson was already spent, the next encounter re-offers it
     in the soft form (sentence and glyph, no slow-mo — see firstMeet).
     seen2 marks the re-offer as used so a veteran is never nagged twice. */
  const klr=G.lastHit;
  G.killerTaught=!!(MEET[klr]&&G.seen[klr]);
  G.killerRetaught=!!G.seen2[klr];
  /* NOT FROM A LAB DEATH. This is the other half of firstMeet's lab guard and
     it fails the same way round: dying to a shard in the sandbox would burn
     that shape's one re-offer, so the real death that the re-offer exists for
     would arrive with nothing left to say. The lab neither spends a lesson nor
     re-arms one. */
  if(!LAB.on&&MEET[klr]&&G.seen[klr]&&!G.seen2[klr]){
    delete G.seen[klr];G.seen2[klr]=1;
    savePref('cometloop:seen',Object.keys(G.seen).join(','));
    savePref('cometloop:seen2',Object.keys(G.seen2).join(','));
  }
  /* Consecutive sub-30s deaths quietly reopen the long calm opening — see
     rookie(). One survival past 30s clears it, so a lapsed good player never
     inherits training wheels. */
  /* AND NOT FROM THE LAB, which would otherwise be the one lab write with a
     visible effect on the real game: struggle feeds rookie(), which lengthens
     every future run's calm opening and delays its first shard. Turning the
     ghost off to watch what a red does to you would quietly retune the game
     you go back to afterwards. */
  if(!LAB.on){
    G.struggle=secs<30?(G.struggle||0)+1:0;
    savePref('cometloop:struggle',G.struggle);
  }
  G.deadPips=0;G.deadSkip=false;
  /* the impact beat: two or three frames of flat white with the collision
     silhouetted in it, before the explosion plays */
  if(!RM){const pk=posPlayer();G.impactT=0.13;G.killer={x:pk[0],y:pk[1]};}
  /* Checked before the score, and reported instead of it when both land: a
     player who just got further than they ever have should be told THAT, not
     handed a number. Measured on G.level — the ordinal the screen actually
     prints — because it used to be measured on the tier ladder, which the
     screen never names: a device whose record was level 3 could die on level 2
     at a deeper tier and be congratulated for getting further.
     The record moves HERE, next to G.best at the top of die() rather than at
     the finish line, so the line fires exactly once and every retry of the
     same level after it stays quiet. G.lvlMax never drops below 1, so level 1
     — where every run starts — can never be news. */
  /* A PICKED START IS NOT A CLIMB. The level select exists so a level can be
     tested without playing to it, and the level record is the one thing that
     cannot survive that: choosing EVENT HORIZON and dying on the first shard
     would otherwise print FURTHEST YET and write a level-4 record on a device
     that has never cleared level 1. The record moves only for a run that
     began where every run used to begin — a run that STARTED at level 1 and
     climbed keeps counting, including after a retry, because startLevel is
     the level the run opened on and not the level it is on now. */
  /* The lab clause is belt as well as braces and is meant to stay that way. A
     lab run opens on level 1 and its clock never reaches level 1's finish
     line, so `G.level>G.lvlMax` is already false on every path today — but the
     thing that makes it false is a difficulty constant, and a later session
     that let the lab pick its level would silently turn this back on. State
     the rule where the rule lives. */
  G.newLevel=!LAB.on&&G.startLevel===1&&G.level>G.lvlMax;
  if(G.newLevel){G.lvlMax=G.level;REC[MODE].lvlMax=G.lvlMax;savePref(recKey('gl'),G.lvlMax);}
  if(!RM)G.shake=5;
  const p=posPlayer();
  burst(p[0],p[1],COL.shard,26,240);
  burst(p[0],p[1],COL.comet,16,170);
  G.rings.push({x:p[0],y:p[1],r:6*u,life:1,col:'#ffffff'});
  G.rings.push({x:p[0],y:p[1],r:16*u,life:0.85,col:COL.shard});
  G.rings.push({x:p[0],y:p[1],r:30*u,life:0.6,col:COL.comet});
  /* one wide, fast, slow-fading front that outruns the rest — the moment
     needs a beat that carries past the edge of the ring system */
  if(!RM)G.rings.push({x:p[0],y:p[1],r:8*u,life:1,col:'#ffffff',sp:560,dec:1.15,fat:1});
  /* landed at 50Hz — inaudible on a phone, so the most important moment in
     the game ended by simply vanishing. Now it lands somewhere you can hear. */
  /* order matters: hand A.hole back first, then let the death duck take the
     bed. The death hit itself is unaffected either way — beep() goes to
     A.world and never touches either node. */
  endSection();
  duckBed(0.05,0.9);
  /* THE ENDING IS A CADENCE. The impact is silent-instant (the flash and
     freeze carry it); the falling figure lands on the next eighth, so even
     dying happens in time with the record. */
  let wd=0;
  if(AC&&MU&&MU.next&&AC.state==='running'){
    const now=AC.currentTime;let tb=MU.next;
    while(tb>now+SPB/2)tb-=SPB/2;
    if(tb<now)tb+=SPB/2;
    wd=Math.max(0,tb-now);
  }
  beep(220,0.5,'sawtooth',0.085,110,wd);
  beep(110,0.55,'triangle',0.06,66,wd);
  beep(1318,0.5,'sine',0.03,196,wd+0.02);
  gameHaptic('death',90);
  const gest=GEST.tap+GEST.swipe+GEST.lateSwipe+GEST.unresolved;
  track('run_ended',{
    score:G.score,best:G.best,new_best:G.newBest,
    run_index:G.runs,                 /* lifetime run count — this is retention */
    seconds:Math.round(G.deadT-G.started),
    orbits:G.orbits,best_streak:G.bestStreak,embers:G.embers,
    scored:G.embers>0,                /* did they ever get going at all */
    /* how they actually PLAYED: drops landed on the countdown and the
       on-beat chain's peak — the timing-skill numbers the balance
       questions keep needing */
    lands:G.lands,best_groove:G.bestGroove,
    /* the chorus: entries and bars held, per level like `seconds` — did the
       run ever lift the song, and could it stay there */
    chorus_entries:G.chorusN,chorus_bars:G.chorusBars,
    /* the conversion and engagement aggregates: earned drops vs landed,
       whether the twin exam arrived by hop or by timeout, peak combo,
       loop captures, deliberate dodges, and musical-orb pickups */
    drops_earned:G.dropsEarned,hold_timeout:G.holdTimeout,
    best_combo:G.bestCombo,loop_caught:G.loopN,near_misses:G.nearN,
    /* WHETHER PAUSE IS BEING USED AS A BREAK OR AS A TELESCOPE. `pauses` is the
       count and `paused_seconds` the real time spent frozen. A level with
       twenty short pauses is a different thing from one with a single
       two-minute break, and only the pair can tell them apart; the hidden board
       and the count-in were balanced on an assumption, and this is what would
       show the assumption wrong.
       PER LEVEL, exactly like `seconds` beside it — which reads
       G.deadT-G.started and so has always been this level's clock, not the
       run's. startGame() re-baselines both at every level boundary. That is why
       `level_cleared` carries the same two properties: a run that cleared three
       levels reports four rows, one per level, and the run total is the sum
       across a run_index. Carrying them into run_ended instead would have put a
       cumulative number next to a per-level `seconds` on the same event — one
       scale for one property and another for the one beside it, which is the
       shape of the retired `level` bug rather than a fix for it.
       Named `paused_seconds` and not `paused`, because a bare `paused` would be
       read as a boolean by the first person to query it. */
    pauses:PAUSE.n,paused_seconds:Math.round(pausedSeconds()),
    got_spot:G.gotSpot,got_blackhole:G.gotBH,blackholes:G.bhN,
    /* two ladders, two names, never the word `level` for the tier one: `tier`
       is the zero-based UNLOCK ladder (what has been introduced), `game_level`
       is the 1-6 structure the player is told about. `level` used to be sent
       here holding tier+1 while `level_cleared` sent it holding 1-3 — one
       property name, two scales, across two events. It is retired rather than
       redefined so no historical row silently changes meaning; `tier` carried
       the same number all along. */
    tier:G.tier,tier_name:tierLabel(),rings:G.nRings,
    game_level:G.level,best_game_level:G.lvlMax,
    /* which level this run OPENED on. Every run used to open on 1, so without
       it a level-4 run picked from the select is indistinguishable from one
       played to — and the completion funnel would count a jump as a climb. */
    start_level:G.startLevel,
    /* did the curriculum land: three placements is the whole intro set */
    pows_placed:G.powN,saw_warp:G.gotWarp,saw_nova:G.gotNova,saw_hyper:G.gotHyper,
    picks:G.picks.join(','),pick_n:G.picks.length,
    /* DID THE TEACHING LAND. The two verbs, per run. did_hop is the one that
       matters: the hop is the unfamiliar gesture, it is now taught at 20s in
       the calm, and a run that ends with did_hop false is a run where the
       player never used half the control scheme — which no amount of level
       naming or content pacing would have fixed. Read it against
       misread_rate: hop false with unresolved swipes means the input was
       misread, hop false with no swipes at all means the lesson was missed. */
    did_hop:G.didHop,did_lap:G.didLap,did_reverse:G.didReverse,
    death_cause:G.lastHit,
    /* did the teaching land, sharpened: was the killer's lesson ever shown,
       had its one re-offer already been spent, and how many lessons this
       run displayed (see lesson_shown for the per-lesson record) */
    killer_lesson_seen:G.killerTaught,killer_relessoned:G.killerRetaught,
    lessons_shown:G.lsnN,
    blocks:G.blocks,                  /* shields that saved a run */
    /* the input question: what fraction of swipes produced nothing */
    gestures:gest,
    gest_tap:GEST.tap,gest_swipe:GEST.swipe,
    gest_late:GEST.lateSwipe,gest_unresolved:GEST.unresolved,
    misread_rate:gest?+(GEST.unresolved/gest).toFixed(4):0
  });
}
function reverseFX(){
  currentWakeTurn();
  introAction('turn');
  const p=posPlayer();
  G.revFlip=G.t+0.09;   /* the comet visibly turns end-for-end — see the draw */
  ripple(p[0],p[1]);
  burst(p[0],p[1],COL.comet,6,90);
  beep(300,0.07,'square',0.045,540);
  /* THE COST, COMMITTED. reverseFX only ever runs for a reverse that stuck
     (a rolled-back swipe restores the lap and clears lapCut), so this is
     the one safe place to teach what the reverse just spent: the discarded
     arc burns off visibly, and the first reversal that discards most of an
     orbit earns the economy's one sentence. */
  if(G.lapCut>0.05&&G.state==='playing'){
    /* anchored where the TURN happened, not where the commit landed — a
       tap held to lift commits seconds later, well past the turn point.
       The playing gate keeps a tap held across levelComplete from firing
       the lesson over the level card. */
    G.lapFx={acc:G.lapCut,dir:G.lapCutDir,a:G.lapCutA,t:0};
    if(G.lapCut>TAU*0.6)firstMeet('lapcost');
  }
  G.lapCut=0;
  performerHit('rev',0,effRing());
}
function reverse(silent){
  G.dir*=-1;G.didReverse=true;
  glRipple();   /* onTap -> a wave off the comet */
  /* You lose the lap and the streak multiplier, but the embers you already
     gathered stay banked — otherwise gates, which exist to force reversals,
     would systematically delete the score you turned around to protect.
     The discarded arc is remembered until the reverse commits or rolls
     back — teaching and the burn-off draw both key off the committed copy. */
  G.lapCut=G.lapAcc;G.lapCutDir=-G.dir; /* dir already flipped: the lap ran the other way */
  G.lapCutA=G.angle;                    /* the turn point — where the cost is drawn from */
  /* ---- THE TRAVEL IS BANKED EVEN THOUGH THE LAP IS NOT ----
     FOUR OF THE SIX WORLDS WERE CONTENT NOBODY EVER SAW, and this line is the
     whole reason. Orbits buy the journey (ORB_PER_WORLD), the lap resets to
     zero here, and reversing is the game's PRIMARY VERB — so a player who taps
     is a player who never completes a lap and therefore never travels at all.
     Measured across seeded runs of the real game: never reversing, which is
     the upper bound, reached world 2 of 6 in 58 seconds; reversing every three
     seconds reached world 1 and stayed there, because a lap needs about 4.5
     seconds at opening speed and the reset beat it every time. The trickle
     under it (150s per world) is a floor, not a route.
     So the SCORING lap still resets — the streak and its multiplier are the
     price of turning around, and gates exist to charge it — while the DISTANCE
     the comet actually covered is banked toward the journey. It is the one
     quantity here that is simply true: the comet went that far, whichever way
     it was pointing when it stopped. Nothing else in the reversal economy
     moves; this is additive. */
  G.skyW+=(G.lapAcc/TAU)/ORB_PER_WORLD;
  G.lapAcc=0;G.lapStreak=0;
  if(silent)G.revPend=G.t+REV_FX;
  else reverseFX();
}
function commitReverseFX(){
  if(G.revPend>0){G.revPend=0;reverseFX();}
}
/* THE RETRY RE-READS THE SYLLABUS. A death on level 2+ used to jump straight
   back into play, so the calm-screen list of exactly the mechanics that just
   killed you showed once per clear of the PREVIOUS level and never again.
   The retry now passes through the level's own card — one extra tap, and the
   0.6s lockout is the only delay a fast retrier pays. Level 1 keeps the
   instant retry: its card belongs to the first run, not to every death. */
function retry(){
  if(G.level>=2){G.state='lvend';G.lvT=G.t;G.lvCard={done:false,next:G.level};}
  else startGame();
}
/* ---------- the front of the game ----------
   TWO decisions before a run, not three. The mode question is retired with
   chill, and what is left is the pair that genuinely cannot be answered for
   the player: which way their hand thinks "out" is (the swipe rule, asked
   once per device) and where they want to start. They stay separate states
   rather than one settings sheet because each is drawn on the live arena and
   answered there.
   The title screen therefore no longer holds a decision at all — it holds
   START and the door to the lab. That is a simpler screen than the one that
   shipped, and the record line goes back under the title where it lived
   before there were two of them to tell apart. */
function enterSwipeSel(from){
  G.selFrom=from||null;
  G.state='swipesel';G.lvT=G.t;G.nRings=3;G.ringI=1;G.hopFromI=1;G.hopP=1;
  G.angle=Math.PI/2;   /* bottom of the loop: the one place the rules disagree */
  G.trail.length=0;    /* or the angle jump draws a chord across the arena */
  G.stars=[];G.spikes=[];G.pows=[];
}
/* THE DEMO NEEDS RINGS TO HOP BETWEEN, so returning to the title screen puts
   them back. menuDemo's hop is gated on G.nRings>1 and the level picker
   deliberately leaves ONE ring behind it — so without this, a player who
   opened the picker and backed out watched the swipe caption appear over a
   comet that never changed ring, which is the single thing that screen exists
   to demonstrate. Every path back to the menu goes through here. */
function enterMenu(){
  G.intro=null;G.introSkipRect=null;
  G.state='menu';G.lvT=G.t;
  /* THE TITLE SCREEN IS WHERE THE LAB ENDS. Every route out of the lab —
     `back` from the picker, `back` from a lab run — arrives here, so clearing
     the flag once at the door means there is no path that leaves it set. It
     matters that this is the ONLY clear: LAB.on gates the record writes, the
     lesson writes and the telemetry, and a flag with two owners is a flag that
     is eventually left on. */
  LAB.on=false;
  G.nRings=3;G.ringI=0;G.hopFromI=0;G.hopP=1;
}
/* THE LAB'S OWN FRONT SCREEN. Same shape as the level picker, for the same
   reason it is a separate state rather than a panel: a picker in this game is
   a list drawn on the live arena, and the arena behind it is one quiet orbit
   with nothing on it. LAB.on is set HERE rather than at the run, so the picker
   itself is already inside the sandbox — which is what makes `back` from a lab
   run land somewhere the flag is still true and the door still drawn. */
function enterPowerSel(){
  LAB.on=true;
  G.state='powersel';G.lvT=G.t;
  G.powSelRects=[];G.powSelFx=0;
  /* THE BLACK HOLE OUTLIVES THE RUN IT WAS IN, and the lab is the first screen
     that can be reached from inside one. bhTick is called on `G.state==='playing'
     OR bhActive()`, precisely so the mode can finish across a death — so
     walking out of a lab run mid-horizon leaves it ticking on the picker,
     rewriting the global RADII every frame from a warp that is unwinding
     against a one-ring arena. die() solves the same problem by skipping to the
     closing warp; the picker is a fresh start rather than an ending, so it
     resets outright, exactly as startGame does. The three timed reward states
     go with it for the same reason: nothing from the abandoned run should
     still be running underneath a menu. */
  BH.phase=0;BH.on=false;BH.warp=0;BH.t=0;BH.rings0=3;
  for(let i=0;i<4;i++)RADII[i]=RAD_OFF[i];
  G.hyper=0;G.spot=0;G.spotD=0;G.spotGlow=0;G.slow=0;G.tsCur=1;
  G.mirror=0;G.scorch=0;G.slip=0;G.slipFx=null;G.burn=null;
  G.nRings=1;G.ringI=0;G.hopFromI=0;G.hopP=1;
  G.trail.length=0;G.stars=[];G.spikes=[];G.pows=[];
}
/* The one event a lab session sends — see the choke point in track(). The orb
   is the whole content: which of the seven anybody actually wants to look at
   is the question the lab was built to answer, and the only one worth asking
   of the analytics. */
function startLab(){
  LAB.sel=Math.min(LAB_ORBS.length-1,Math.max(0,LAB.sel|0));
  LAB.type=LAB_ORBS[LAB.sel].id;
  G.level=1;G.startLevel=1;
  /* a lab run is a fresh run in every sense the carry counters care about, and
     no upgrade is ever offered in it — the clock never reaches a finish line,
     so the draft screen it hangs off cannot happen */
  G.upg={};G.offered={};G.offer=[];G.picks=[];
  G.carryScore=0;G.carryOrbits=0;G.carryStreak=0;G.carryTime=0;
  G.carryLands=0;G.carryGroove=0;
  track('powerup_lab_started',{orb:LAB.type,ghost:LAB.invuln?1:0,run_index:G.runs});
  /* straight in, with no level card: the card names a level and the two things
     it is about, and the lab is neither of those */
  startGame();
}
function enterLevelSel(){
  G.state='levelsel';G.lvT=G.t;
  G.lvSel=Math.min(LEVEL_MAX,Math.max(1,G.lvSel||1));
  G.lvSelRects=[];G.lvSelPt=null;G.lvSelFx=0;
  /* one ring and nothing on it: the picker owns the middle of the screen, so
     the arena behind it is a single quiet orbit rather than a live board */
  G.nRings=1;G.ringI=0;G.hopFromI=0;G.hopP=1;
  G.trail.length=0;G.stars=[];G.spikes=[];G.pows=[];
}
/* THE ARROWS THAT HOP ALSO CHOOSE. Every pre-run screen is a list, and the
   two hop keys are already the game's "previous/next" — so a keyboard reaches
   both pickers with the keys it is already holding, and nothing new has to be
   learned or drawn. Nowhere else changes: on any other state this is a no-op,
   which is what the arrow keys already did outside a run. */
function menuStep(d){
  if(G.state==='levelsel'){
    const n=Math.min(LEVEL_MAX,Math.max(1,(G.lvSel||1)+d));
    if(n!==G.lvSel){
      G.lvSel=n;G.lvSelFx=1;
      beep(PENT[Math.min(13,2+n)],0.10,'triangle',0.05,PENT[Math.min(13,4+n)]);
    }
  }else if(G.state==='powersel'){
    pickOrb(LAB.sel+d);
  }
}
/* One writer for the lab's selection, so the tap path and the arrow keys
   cannot disagree about the bounds or about which sound a change makes. The
   walk up the pentatonic is the level picker's, for the same reason: this is
   the same kind of screen answering the same keys. */
function pickOrb(i){
  const n=Math.min(LAB_ORBS.length-1,Math.max(0,i));
  if(n===LAB.sel)return;
  LAB.sel=n;G.powSelFx=1;
  beep(PENT[Math.min(13,2+n)],0.10,'triangle',0.05,PENT[Math.min(13,4+n)]);
}
/* Answering in the pentatonic like every other control in the game: the fifth
   above for on, the tonic below for off, so the two states are told apart by
   ear as well as by the mark. */
function toggleGhost(){
  LAB.invuln=!LAB.invuln;G.powSelFx=1;
  beep(PENT[LAB.invuln?4:0],0.10,'triangle',0.05,PENT[LAB.invuln?6:2]);
}
/* the title screen's exit: the swipe rule is asked once per device and comes
   first, because it is a question about the controls and the level picker is
   a question about the game */
/* THE FIRST RUN SKIPS THE PICKER. A fresh device used to pass four screens
   and two decisions before its first second of play: title → swipe chooser →
   a six-row picker offering EVENT HORIZON and HEAT DEATH to someone with
   zero runs → the level-1 card. A player with no record has nothing to pick
   with; they get level 1's card directly, and the picker appears from run 2 —
   the same screen, one run later, when "start where?" is a question they can
   answer. The picker's testing job survives: one run (however short) opens
   it. */
/* A first visit starts with four small playable actions. This is a safe
   opening of the actual run: the same comet, hit test, tap and swipe handlers.
   Common clocks/particles keep running; introTick owns movement before the
   ordinary progression, spawning and collision section can execute. */
function beginIntro(){
  LAB.on=false;G.level=1;G.startLevel=1;G.lvSel=1;
  G.upg={};G.offered={};G.offer=[];G.picks=[];
  G.carryScore=0;G.carryOrbits=0;G.carryStreak=0;G.carryTime=0;
  G.carryLands=0;G.carryGroove=0;
  if(!G.swipeAsked){
    SWIPE_MODE='screen';G.swipeAsked=true;savePref('cometloop:swipe',SWIPE_MODE);
  }
  startGame();
  G.introPending=true;savePref('cometloop:intro','active');
  G.intro={stage:0,at:G.t,hold:0,feedback:'',fromRing:0};
  G.sceneEvent=null;G.banner=null;G.teach=0;G.sayFx=null;ANN.length=0;
}
function introPrompt(){
  const I=G.intro;if(!I)return null;
  const titles=['Tap to turn','Collect the star','Complete an orbit','Change rings'];
  const details=['One tap reverses your comet.','Let your comet touch the gold star.',
    'Go all the way around without turning.',SWIPE_MODE==='screen'?
      'Swipe down to move to the inner ring.':'Swipe toward the centre to change ring.'];
  return {stage:I.stage,title:I.hold?I.feedback:titles[I.stage],
    detail:I.hold?'':details[I.stage],glyph:['tap','star','orbit','hop'][I.stage],
    done:!!I.hold,progress:I.hold?1:(I.stage===2?Math.min(1,G.lapAcc/TAU):0)};
}
function introFeedback(message){
  if(!G.intro||G.intro.hold)return;
  G.intro.feedback=message;G.intro.hold=G.t+0.95;
}
function introAction(action){
  if(G.intro&&!G.intro.hold&&G.intro.stage===0&&action==='turn')
    introFeedback('You turned.');
}
function finishIntro(){
  if(!G.intro)return;
  G.intro=null;G.introSkipRect=null;G.introPending=false;
  savePref('cometloop:intro','done');
  /* The taught second ring stays. Start the normal level clock here, without
     restarting the run, deleting earned score or teleporting the comet. */
  G.nRings=Math.max(2,G.nRings);G.tier=Math.max(1,G.tier);
  G.started=G.t;G.diff=0;G.starT=0.6;G.spikeT=1.2;G.powT=4;
  G.stars=[];G.spikes=[];G.pows=[];G.lapAcc=0;G.lapEmbers=0;
  G.banner=null;G.teach=0;G.teachKind=null;G.teachHint=null;G.sayFx=null;ANN.length=0;
  G.invuln=Math.max(G.invuln,G.t+2);
  if(G.didLap){G.seen.orbit=1;savePref('cometloop:seen',Object.keys(G.seen).join(','));}
  beep(CH[0][0]*4,0.18,'sine',0.045,CH[0][0]*6);
}
function introTick(dt){
  const I=G.intro;if(!I)return;
  G.spikes.length=0;G.pows.length=0;G.banner=null;G.teach=0;G.sayFx=null;ANN.length=0;
  G.prevAngle=G.angle;G.speed=1.4;G.sweep=G.speed*dt;
  G.angle=(G.angle+G.dir*G.sweep)%TAU;pushTrail();
  if(I.hold){
    if(G.t<I.hold)return;
    if(I.stage===3){finishIntro();return;}
    I.stage++;I.at=G.t;I.hold=0;I.feedback='';G.lapAcc=0;
    if(I.stage===1)G.stars=[{a:(G.angle+G.dir*1.25+TAU)%TAU,ring:0,t:0,life:1e9}];
    if(I.stage===3){G.nRings=2;I.fromRing=G.ringI;ripple(cx,cy,COL.comet);}
  }
  if(I.stage===1&&G.stars.length){
    const s=G.stars[0];s.t+=dt;
    if(sweptHit(s.a,(22*u)/radiusOf(0))){
      const p=posAt(s.a,radiusOf(0));G.stars=[];G.score++;G.scorePop=1;
      G.embers++;G.lapEmbers=1;G.combo=1;G.comboT=CW;
      ripple(p[0],p[1],COL.ember);burst(p[0],p[1],COL.ember,8,110);
      beep(CH[0][0]*4,0.16,'triangle',0.05,CH[0][0]*6);
      introFeedback('Star collected. +1');
    }
  }else if(I.stage===2){
    G.lapAcc+=G.sweep;
    if(G.lapAcc>=TAU){
      const bonus=6+13*Math.min(G.lapEmbers,LAP_EMB_MAX);
      G.lapAcc=TAU;G.score+=bonus;G.scorePop=1;G.orbits++;G.didLap=true;
      G.lapStreak=1;G.bestStreak=Math.max(G.bestStreak,1);
      G.skyW+=1/ORB_PER_WORLD;skyWake(1);
      const p=posPlayer();ripple(p[0],p[1],COL.ember);burst(p[0],p[1],COL.ember,12,180);
      beep(CH[0][0]*6,0.22,'triangle',0.06,CH[0][0]*8);
      introFeedback('Orbit complete. +'+bonus);
    }
  }else if(I.stage===3&&G.ringI!==I.fromRing&&G.hopP>=1){
    introFeedback('You changed rings.');
  }
}
function enterRunStart(){
  if(!G.runs||G.introPending){beginIntro();return;}
  enterLevelSel();
}
function leaveMenu(){
  if(!G.runs||G.introPending){beginIntro();return;}
  if(!G.swipeAsked){enterSwipeSel('start');return;}
  enterRunStart();
}
/* The lab door obeys the same once-per-device rule the run does: the swipe
   rule is a question about the controls, and the lab is played with them. A
   fresh device that opens the lab first is asked it here and never again. */
function openLab(){
  if(!G.swipeAsked){enterSwipeSel('lab');return;}
  enterPowerSel();
}
function startFromSelect(){
  const n=Math.min(LEVEL_MAX,Math.max(1,G.lvSel||1));
  G.level=n;G.startLevel=n;
  G.upg={};G.offered={};G.offer=[];G.picks=[];
  /* a picked start is a fresh run: nothing carries in from whatever the last
     one banked, or level 3 would open holding level 2's score and counters */
  G.carryScore=0;G.carryOrbits=0;G.carryStreak=0;G.carryTime=0;
  G.carryLands=0;G.carryGroove=0;
  track('start_level_chosen',{game_level:n,run_index:G.runs});
  /* THE CARD IS THE LEVEL'S OWN INTRODUCTION, so a picked level always gets
     one — it names the level and the two things it is about, which is exactly
     what someone who has never been there needs. Level 1 keeps the instant
     start for a player who has run before: the same rule retry() uses, and
     the reason its card belongs to the first run rather than to every start. */
  if(!G.runs||n>=2){G.state='lvend';G.lvT=G.t;G.lvCard={done:false,next:n};}
  else startGame();
}
/* one dismissal path for every card: sets the level and reports the read —
   how long a card was actually on screen is the channel's whole funnel.
   game_level (1-3) is the name every event uses for this ordinal; the tier
   ladder is only ever `tier` — two scales, two names, no overlap. */
function cardDone(){
  const c=G.lvCard||{done:false,next:1};
  G.level=Math.min(LEVEL_MAX,c.next);
  track('card_shown',{game_level:G.level,after_clear:!!c.done,
    seconds:+(G.t-G.lvT).toFixed(1),run_index:G.runs});
}
/* the lesson's record is written when it ENDS — by running its course, or
   cut short by a death or a finish line. Without the cut flush, the exact
   lessons interrupted by the death they should explain vanished from the
   teach-vs-death funnel. */
function flushLesson(cut){
  /* the spotlight dies with the lesson — a later lesson must not inherit a
     previous specimen's gold ring */
  for(const sp of G.spikes)if(sp.spot)sp.spot=0;
  if(!G.teachHint||!G.teachType){G.teachHint=null;G.teachSoft=false;G.teachType=null;return;}
  G.lsnN++;
  track('lesson_shown',{type:G.teachType,soft:G.teachSoft,
    rearmed:!!G.seen2[G.teachType],age:Math.round(age()),
    game_level:G.level,run_index:G.runs,cut:!!cut});
  G.teachHint=null;G.teachSoft=false;G.teachType=null;
}
function bump(){
  const p=posPlayer();
  burst(p[0],p[1],'rgba(170,195,255,0.85)',4,55);
  /* was 150->110Hz: under the phone-speaker rolloff, so the one cue that
     fires when a swipe was misread could not be heard at all */
  beep(560,0.07,'triangle',0.035,430,0,panAt(p[0]),0.3);
}
/* step -1 = outward (toward ring 0), +1 = inward */
function hop(step){
  if(G.hopP<1)return;
  const t=G.ringI+step,p=posPlayer();
  if(t<0||t>=G.nRings){
    bump(); /* nowhere to go — acknowledge the input rather than swallowing it */
    /* THE FREE INSTRUMENT. A flick into a wall is the only input in the game
       with no survival consequence at all: it costs no streak (reverse zeroes
       lapStreak, worth up to 28), no shield, no position. So it is the one
       you can play purely for the music. The one-note-per-sixteenth guard
       caps it, and the angle keeps advancing with shards inbound, so there is
       nothing to farm here — only something to play. */
    performerHit('rev',0,effRing());
    return;
  }
  G.didHop=true;
  glShear(step);   /* onSwipe -> the field shears along the vector */
  /* the rehearsal ends the instant the lesson lands — but ONLY the
     rehearsal: this used to clear every lesson, so hopping away from the
     thing being explained (complying with 'swipe to another ring'!)
     destroyed the once-ever sentence mid-read */
  if(G.teachKind==='hop')G.teach=0;
  /* NOT FROM THE LAB, and this is the one lifetime flag with teeth. everHopped
     gates the FIRST-HOP REHEARSAL — the once-ever dilation, held spawns and
     radial guide that fire when the second ring lands for someone who has
     never hopped. The lab runs on three rings, so a fresh player who opened it
     first and swiped once would have spent that rehearsal on a sandbox and met
     the real second ring with nothing. Same shape as the lesson bug above:
     a gameplay action, not a menu, quietly writing a lifetime record.
     The in-memory flag is inside the guard as well as the write — setting it
     without persisting would suppress the rehearsal for the rest of the visit,
     which is the same bug with a shorter fuse. */
  if(!LAB.on&&!G.everHopped){G.everHopped=true;savePref('cometloop:hopped','1');}
  G.hopFrom=radiusOf(G.ringI);
  G.hopFromI=G.ringI;
  G.ringI=t;
  G.hopP=0;
  currentWakeHop(step);
  if(G.slip>0&&!bhActive()){
    /* The clear belongs to a successful player hop, never to the gravity
       pull or a swipe beyond the available rings. The short grace is metered:
       rapidly chaining hops must not turn twelve seconds into invincibility. */
    G.slipFx={a:G.angle,ring:t,t:0};
    for(let i=G.spikes.length-1;i>=0;i--){
      const sp=G.spikes[i];
      if(sp.ring===t&&!sp.saucer&&angDist(sp.a,G.angle)<=SLIP_ARC)
        novaConvert(G.spikes.splice(i,1)[0],t);
    }
    if(G.t>=G.slipAt){
      G.invuln=Math.max(G.invuln,G.t+SLIP_GRACE);G.slipAt=G.t+SLIP_COOL;
    }
  }
  ripple(p[0],p[1]);
  /* The cue used to contradict the gesture in both directions AND sit under
     the phone rolloff at both endpoints. Outward now falls, inward rises. */
  const out=step<0;
  beep(out?940:620,0.09,'sine',0.05,out?620:940,0,panAt(p[0]),0.35);
  /* THE HOP IS A TRANSITION, cut on the grid like a DJ would: inward sweeps
     bright into the hotter pattern, outward breathes down out of it — the
     ring change is MARKED the moment it happens, not discovered a bar later
     when the kit differs. The arriving track flashes under you too. */
  const hpan=panAt(p[0]);
  cueTone(function(w){
    const tt=AC.currentTime+w;
    hat(tt,0.020,out?2600:3800,0.20,0.3);
    hat(tt+S16,0.016,out?2000:5200,0.14,0.3);
    note(PENT[out?4:8],tt,0.12,'sawtooth',0.018,out?2200:4800,hpan);
  });
  arcFlash(G.angle,t,COL.comet);
  build(0.021,'hop');           /* navigating by ring change is a style, not a fallback */
  /* during a drum break the hop is the KICK — the deep gold ring pairs the
     reverse's white snare flash, so the fill is visible with the sound off */
  if(MU&&MU.brk>0&&!RM){const pk=posPlayer();G.rings.push({x:pk[0],y:pk[1],r:12*u,life:0.5,col:COL.ember});}
  performerHit('hop',step,t);   /* the ring being ARRIVED at, not the one left */
}

/* The phase move is gone. It asked the player to spend a shield PRE-EMPTIVELY,
   which meant reading a threat, deciding it was unsurvivable, and hitting a
   second button — all inside the reaction window they were already using to
   dodge. Shields are now exactly what they look like: one hit each, spent
   automatically, costing nothing else. The bottom bar is a readout, not a
   control, and the whole strip is a normal tap target again. */

/* ---------- run summary / share ----------
   The artifact travels further than the link does, so it is plain text: it
   survives every messaging app, can be quoted, and invites a reply. The
   filled/hollow bar reports how far the run got without spoiling what is in
   the tiers you have not reached. */
function runTime(){
  const s=Math.max(0,Math.round((G.carryTime||0)+G.deadT-G.started));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
function tierLabel(){
  for(let i=G.tier;i>=0;i--)if(TIERS[i].name)return TIERS[i].name;
  return 'FIRST ORBIT';
}
/* ONE NAME FOR WHERE YOU ARE, AND THE LEVEL OWNS IT. This is the fix the
   comment on THE EYE's tier row was reaching for and could not reach by
   renaming things: the header printed LEVEL 4 next to a TIER name, so the
   permanent line in the corner of the screen named a ladder the player has
   never been shown, in the same breath as the one they have. Playtested, the
   screen said LEVEL 4 · FLICKER PAIRS while the card that opened it said
   EVENT HORIZON, the music was in E-flat because of EVENT HORIZON, the sky
   was EVENT HORIZON's — and then the black hole arrived carrying EVENT
   HORIZON as its eyebrow. Four names, one situation, none of them agreeing:
   the single loudest reason the game read as assembled rather than authored.
   The tier ladder is not deleted and is not hidden — it still gets a banner
   the moment a rung lands, which is when it is news. It just stops being
   printed permanently beside a different ladder's number. */
function levelName(){
  const L=LV[Math.min(LV.length-1,Math.max(0,G.level-1))];
  return (L&&L.name)||'';
}
/* THE ORDINAL, AND WHICH ONE. A tester put the case for naming one at all
   better than the design did: "reaching level XYZ seems more memorable and
   rewarding than just a highest score. Levels are more distinct." A score is a
   cardinal you cannot repeat from memory; a level is an ordinal you can say
   out loud, compare, and come back for.
   THERE ARE TWO LADDERS IN HERE AND ONLY ONE OF THEM IS CALLED A LEVEL.
   G.tier is the thirteen-rung UNLOCK ladder — which shapes have been introduced —
   and tierLabel() names its current rung — in telemetry only, since the HUD,
   death screen and share text all print the LEVEL'S own name now. G.level is
   the 1-6 structure the player is actually told about: the intro card, the
   HUD, the share text, the death headline. Both used to surface as "level" in the same places at once:
   the death screen printed LEVEL 2 directly under a ten-pip bar filled to
   eight, and the share text pasted a ten-position bar under "LEVEL 2/3".
   Everything the player reads is G.level now, and the tier ladder keeps its
   own name. The pip bar had stopped saying anything anyway — the curriculum
   pass folded every tier into levels 1-2, so it saturates the moment level 3
   opens and stays full for the rest of an endless level. */
/* seconds between two pips landing on the death screen — read by the reveal,
   by the LEVEL punch-in that waits for the last pip, and by the lockout that
   waits for all three */
const PIPDT=0.16;
function runSummary(){
  let bar='';
  for(let i=0;i<LEVEL_MAX;i++)bar+=(i<G.level?'◆':'◇');
  /* The level leads and the score moves down a line. A shared score is a
     number nobody can place; a shared level is a claim that invites one back
     — "level 2 of 3" is answerable in a way "4300" is not. */
  /* THE SHARED CLAIM HAS TO BE THE CLAIM THAT WAS EARNED. Two things now make
     a score mean something different, and with chill retired there is one
     left: whether the run started at level 1 or was picked into. It is named
     only when it is not the default, so an ordinary run shares exactly the
     text that shipped — which is still what "Cosmo · LEVEL 2/6" has always
     meant. A picked run announcing itself as an unqualified level 6 would be
     the share text lying on the player's behalf. */
  const tag=(G.startLevel>1?' · from L'+G.startLevel:'');
  /* "clean orbits", not "clean laps": the counter idiom is main's (see the
     house style at COL) and the NOUN is the one-voice pass's — this line
     already says "orbits" three words earlier, and one act carries one name
     in every channel. */
  return 'Cosmo · LEVEL '+G.level+'/'+LEVEL_MAX+tag+'\n'+
    bar+' '+levelName()+'\n'+
    G.score+' points · '+G.orbits+' orbits · '+G.bestStreak+' clean orbits · '+runTime()+'\n'+
    (G.bestGroove>=2?'on beat ×'+G.bestGroove+'\n':'')+
    (G.lands>0?G.lands+' drops landed\n':'')+
    /* a deep link to index.html shares worse than the directory it lives in */
    (location.origin+location.pathname).replace(/index\.html$/,'');
}
function doShare(){
  const txt=runSummary();
  beep(660,0.09,'sine',0.05,990);
  track('share_tapped',{score:G.score,tier:G.tier,run_index:G.runs});
  try{
    if(navigator.share){navigator.share({text:txt}).catch(function(){});return;}
  }catch(e){}
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){
        G.shareFx=G.t+1.8;
      }).catch(function(){});
    }
  }catch(e){}
}

/* ---------- input ---------- */
function muteRect(){const s=24*u;return{x:W-s-16*u,y:safeTop+14*u,w:s,h:s};}
/* MIRRORS MUTE, and mirroring it is the whole placement argument. Same size,
   same inset, opposite corner: the top of the screen is not where a one-thumb
   hand rests, and the mute icon has sat there without generating mis-tap
   reports. It matters that this is small and inset rather than a bar — the
   arena answers a tap ANYWHERE, so every pixel given to a pause control is a
   pixel where a reversal silently becomes a pause, and in a reaction game that
   is a death. */
function pauseRect(){const s=24*u;return{x:16*u,y:safeTop+14*u,w:s,h:s};}
function inPause(x,y){
  if(!canPause())return false;
  const r=pauseRect(),pad=10;
  return x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
}
/* Pinned to the bottom of the safe area — it is a one-thumb game, and this is
   the only part of the screen the thumb rests on anyway. */
function shieldRect(){
  const w=116*u,h=46*u;
  return{x:cx-w/2,y:H-safeBot-h-16*u,w:w,h:h};
}
function inMute(x,y){
  const r=muteRect(),pad=14;
  return x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
}
/* The death screen assembles itself over about a second and a half — retry
   and share stay locked until it has finished (or been skipped), so a tap
   can never land on a control that has not appeared yet. */
function deadSeqDone(){
  if(RM||G.deadSkip)return true;
  return (G.t-G.deadT)>0.55+PIPDT*G.level+0.9;
}
/* Sits above TAP TO RETRY, and shares the same 0.6s lockout so a frantic
   retry tap right after dying can never land on it by accident. */
function shareRect(){
  const w=132*u,h=42*u;
  /* POSITIONED AGAINST A LINE THAT KEEPS MOVING. cy+76u collided with the
     best-groove line at cy+78u once that was added; cy+92u then collided with
     the retention line at cy+94u once THAT was added, so the pill was being
     stroked straight through "next sound: twin synths at level 4" for every
     player below tier 9 — which is nearly all of them, on the one screen
     everybody reads. Sits below that line now, and is clamped off TAP TO RETRY
     so a short viewport cannot stack the two instead. */
  const bY=Math.min(H-24*u-safeBot,cy+R+52*u);
  return{x:cx-w/2,y:Math.min(cy+108*u,bY-h-18*u),w:w,h:h};
}
function inShare(x,y){
  /* Nothing to share out of the lab, and the share text is the reason rather
     than the taste: runSummary() writes "Cosmo · LEVEL 1/6" and a score, with
     no room in it for the four things that make a lab number meaningless. A
     boast the game knows to be false should not be one tap away. */
  if(LAB.on)return false;
  if(G.state!=='dead'||G.t-G.deadT<=0.6||!deadSeqDone())return false;
  const r=shareRect(),pad=8*u;
  return x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
}
let pd=null;
function pointerDown(e){
  if(runtimeDestroyed)return;
  e=runtimePointerEvent(e,'pointerdown');
  e.preventDefault();ensureAudio();
  /* PAUSE IS RESOLVED BEFORE ANYTHING ELSE, in both directions.
     Going in: the arena answers a tap anywhere with a reversal, so a control
     drawn during play has to be read first or it can never be pressed — the
     same rule the mute icon and the lab's door already follow.
     Coming out: while the panel is up, RESUME is the only thing on screen that
     answers, and the background answers nothing. A picker is a decision and so
     is this; a stray touch must not start a three-second countdown the player
     did not ask for, and must certainly not fall through to reverse() on a run
     whose world is frozen. The countdown itself takes no input at all. */
  if(frozen()){
    if(PAUSE.on&&G.pauseBtn&&
       e.clientX>=G.pauseBtn.x&&e.clientX<=G.pauseBtn.x+G.pauseBtn.w&&
       e.clientY>=G.pauseBtn.y&&e.clientY<=G.pauseBtn.y+G.pauseBtn.h){
      unpauseGame();beep(523,0.14,'triangle',0.06,784);
    }
    return;
  }
  if(inPause(e.clientX,e.clientY)){pauseGame();beep(392,0.09,'triangle',0.04,294);return;}
  if(inMute(e.clientX,e.clientY)){toggleMute();return;}
  if(inShare(e.clientX,e.clientY)){doShare();return;} /* must precede the retry tap */
  if(G.intro&&G.introSkipRect){
    const r=G.introSkipRect;
    if(e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h){finishIntro();return;}
  }
  if(G.state==='menu'){
    /* WHICH WAY IS OUT, ASKED ONCE. Two rules exist and they disagree only at
       the top and bottom of the loop; which one a person's hand expects is not
       something the game can decide for them. Asked on the first tap of a
       fresh device, before the level-1 card, and never again — the menu keeps
       a control for changing it later. */
    /* the menu's swipe row is a control: a hand can want one rule on day one
       and the other on day three, so a mis-tap only ever costs a look at the
       chooser */
    if(G.swipeRect&&e.clientX>=G.swipeRect.x&&e.clientX<=G.swipeRect.x+G.swipeRect.w&&
       e.clientY>=G.swipeRect.y&&e.clientY<=G.swipeRect.y+G.swipeRect.h){
      G.swipeAsked=false;enterSwipeSel('menu');return;
    }
    /* THE TITLE SCREEN ANSWERS A TAP ANYWHERE AGAIN, which is what it did
       before the mode cards arrived. With the cards gone there is no longer a
       control here whose job is to change a selection, so nothing on this
       screen can be hit by accident in a way that costs a run — the one thing
       the select-don't-start rule existed to prevent.
       THE LAB BAR IS STILL A DOOR, and still handled first. It answers "not a
       game at all, show me the orbs", opening another screen with a way back,
       so reaching it costs a look rather than a run. The menu's `change`
       swipe control has always worked exactly this way. */
    const mh=G.menuRects.find(function(r){
      return e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h;});
    if(mh&&mh.id==='intro'){beginIntro();beep(523,0.12,'triangle',0.05,784);return;}
    if(mh&&mh.id==='lab'){openLab();beep(523,0.12,'triangle',0.05,784);return;}
    /* Another door, handled the same way and for the same reason: it opens a
       screen with a way back, so reaching it costs a look rather than a run. */
    if(mh&&mh.id==='account'){openAccount();beep(587,0.11,'triangle',0.045,880);return;}
    leaveMenu();
    return;
  }
  if(G.state==='powersel'){
    /* resolved at press for the level picker's reason: there is no gesture on
       this screen, so nothing here can turn into a swipe */
    const ph=G.powSelRects.find(function(r){
      return e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h;});
    if(!ph)return;   /* a picker is a decision: the background starts nothing */
    if(ph.id==='start'){startLab();beep(523,0.14,'triangle',0.06,784);return;}
    if(ph.id==='back'){enterMenu();beep(392,0.09,'triangle',0.04,294);return;}
    if(ph.id==='ghost'){toggleGhost();return;}
    if(ph.id==='orb')pickOrb(ph.i);
    return;
  }
  if(G.state==='levelsel'){
    /* Resolved at press, not at lift: there is no gesture on this screen, so
       nothing here can turn into a swipe the way the arena's controls can. */
    const lh=G.lvSelRects.find(function(r){
      return e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h;});
    if(!lh)return;   /* the picker is a decision: the background starts nothing */
    if(lh.id==='start'){startFromSelect();beep(523,0.14,'triangle',0.06,784);return;}
    if(lh.id==='back'){enterMenu();beep(392,0.09,'triangle',0.04,294);return;}
    if(lh.lv&&lh.lv!==G.lvSel){
      G.lvSel=lh.lv;G.lvSelFx=1;
      /* the ladder reveal's interval, walked upward as you pick deeper — the
         same pentatonic the death screen's pips use */
      beep(PENT[Math.min(13,2+lh.lv)],0.10,'triangle',0.05,PENT[Math.min(13,4+lh.lv)]);
    }
    return;
  }
  if(G.state==='lvend'){G.lvPt={x:e.clientX,y:e.clientY};return;}  /* decided at lift */
  if(G.state==='swipesel'){
    /* a press anywhere may become a swipe; whether it was a TAP on a control
       is decided at lift, exactly as the level card does it */
    G.selPt={x:e.clientX,y:e.clientY};
    if(pd)return;
    pd={id:e.pointerId,x:e.clientX,y:e.clientY,saved:null,ang:G.angle,far:0,lean:0,out:false,swiped:false};
    return;
  }
  /* THE LAB NEEDS A DOOR, AND THE GHOST IS WHY IT NEEDS ONE BADLY. Every other
     run in this game ends by itself; a lab run with red switched off cannot,
     so without this the only way out of the sandbox is to reload the page —
     and the way back in is four taps. Checked before the reverse because the
     arena answers a tap ANYWHERE, so a control drawn during play has to be
     read first or it can never be pressed at all. It costs the top-left corner
     of a lab run, which is the part of the screen a one-thumb game does not
     use, and it is drawn only while LAB.on: the real game's tap surface is
     untouched. Live on the death screen too — a lab death should not force a
     retry to get at the picker. */
  if(LAB.on&&G.labRect&&(G.state==='playing'||G.state==='dead')&&
     e.clientX>=G.labRect.x&&e.clientX<=G.labRect.x+G.labRect.w&&
     e.clientY>=G.labRect.y&&e.clientY<=G.labRect.y+G.labRect.h){
    enterPowerSel();beep(392,0.09,'triangle',0.04,294);return;
  }
  if(G.state==='dead'){
    /* the first tap after the lockout fast-forwards the reveal; the next
       one retries — a fast retrier is never made to sit through it */
    if(G.t-G.deadT>0.6){if(!deadSeqDone())G.deadSkip=true;else retry();}
    return;
  }
  if(pd)return; /* one gesture at a time: a second finger can't double-reverse */
  tryLand();     /* any input in the window lands the drop — and still plays */
  const saved={lap:G.lapAcc,streak:G.lapStreak,dr:G.didReverse};
  reverse(true); /* direction flips instantly; sound and sparks wait */
  pd={id:e.pointerId,x:e.clientX,y:e.clientY,saved:saved,ang:G.angle,far:0,lean:0,out:false,swiped:false};
}
/* RADIAL SWIPE. Direction is read against the line from the centre through
   the comet, so "away from the middle" always means out and "toward the
   middle" always means in, wherever the comet happens to be on the circle.
   The reference angle is where the comet was when the gesture started, which
   is what the player was actually looking at when they committed. */
const RADIAL_MIN=0.34; /* ~20 degrees off tangential before we call it */
function pointerMove(e){
  if(runtimeDestroyed)return;
  e=runtimePointerEvent(e,'pointermove');
  if(!pd||pd.id!==e.pointerId||(G.state!=='playing'&&G.state!=='swipesel'))return;
  const dx=e.clientX-pd.x,dy=e.clientY-pd.y;
  const len=Math.sqrt(dx*dx+dy*dy);
  pd.far=len;
  if(len<32)return;
  if(!pd.swiped){
    /* it was a swipe: roll back the speculative reverse, effects never fired.
       didReverse comes back too — a run whose only "reverse" was speculative
       must not report the tap lesson as learned. */
    pd.swiped=true;
    if(pd.saved){
      G.revPend=0;
      G.dir*=-1;
      G.lapAcc=pd.saved.lap;
      G.lapStreak=pd.saved.streak;
      G.didReverse=pd.saved.dr;
      G.lapCut=0;   /* the lap is restored, so there is no cost to teach */
    }
  }
  /* Both the lean and its sign come from the mode (see swipeOut). Under the
     screen rule the reference angle is irrelevant, which is exactly the point
     of that rule. */
  pd.lean=swipeLean(dx,dy,pd.ang);
  pd.out=swipeOut(dx,dy,pd.ang);
  /* A flick almost exactly along the ring is genuinely ambiguous — keep
     watching rather than guessing; it resolves as the finger travels. */
  if(pd.lean>=len*RADIAL_MIN){
    const out=pd.out;
    pd=null;
    GEST.swipe++;          /* resolved mid-drag: the clean case */
    hop(out?-1:1);
  }
}
function pdEnd(e){
  /* the level card between levels: any tap starts the next one */
  if(G.state==='lvend'&&G.lvPt){
    const pt=G.lvPt;G.lvPt=null;
    if(G.t-G.lvT>0.6){
      /* while an offer is on the card, ONLY a tile starts the level: the
         choice is the gate, so nobody skips past a decision by tapping the
         background and then wonders where their upgrade went */
      if(G.offer&&G.offer.length){
        const hit=G.offerRects.find(r=>pt.x>=r.x&&pt.x<=r.x+r.w&&pt.y>=r.y&&pt.y<=r.y+r.h);
        if(!hit)return;
        G.upg[hit.id]=1;G.picks.push(hit.id);
        const u2=UPG.find(x=>x.id===hit.id);
        track('pick_chosen',{upgrade:hit.id,game_level:Math.min(LEVEL_MAX,(G.lvCard&&G.lvCard.next)||1),
          offered:G.offer.map(o=>o.id).join(','),pick_index:G.picks.length,run_index:G.runs});
        G.offer=[];G.offerRects=[];
        popup(cx,cy-40*u,u2?u2.n:'UPGRADED',u2?u2.c:COL.ember,1.4);
        beep(523,0.14,'triangle',0.06,784);
        cueTone(function(w){beep(1046,0.22,'sine',0.05,1568,w);});
      }
      cardDone();
      startGame();braam(0.05);
    }
    return;
  }
  if(G.state==='swipesel'&&G.selPt){
    const pt=G.selPt;G.selPt=null;
    const swiped=pd&&pd.swiped;
    if(!swiped){
      const hit=G.selRects.find(r=>pt.x>=r.x&&pt.x<=r.x+r.w&&pt.y>=r.y&&pt.y<=r.y+r.h);
      if(hit&&hit.id==='play'){
        savePref('cometloop:swipe',SWIPE_MODE);
        G.swipeAsked=true;
        track('swipe_mode_chosen',{mode:SWIPE_MODE,hops:GEST.swipe+GEST.lateSwipe});
        pd=null;
        /* opened from the menu's swipe row, it goes back to the menu; reached
           on the way into a run, it hands off to enterRunStart — the level
           picker for a device with a run behind it, level 1's own card for a
           first-ever run */
        if(G.selFrom==='menu'){G.selFrom=null;enterMenu();}
        else if(G.selFrom==='lab'){G.selFrom=null;enterPowerSel();}
        else{G.selFrom=null;enterRunStart();}
        beep(523,0.14,'triangle',0.06,784);
        return;
      }
      if(hit&&hit.id!==SWIPE_MODE){
        SWIPE_MODE=hit.id;G.selFx=1;
        beep(392,0.10,'triangle',0.05,588);
      }
      pd=null;return;
    }
  }
  if(pd&&e&&pd.id!==e.pointerId)return;
  if(pd){
    if(pd.swiped){
      /* Still ambiguous at lift. Judged from where the finger actually ENDED
         — the stored radial was last written mid-drag, so an outbound leg
         dragged back to its start used to read as a committed hop in the
         abandoned direction. pointercancel keeps the stored values; its
         coordinates are not trustworthy. */
      let lean=pd.lean||0,out=pd.out,far=pd.far;
      if(e&&e.type==='pointerup'){
        const dx=e.clientX-pd.x,dy=e.clientY-pd.y;
        far=Math.sqrt(dx*dx+dy*dy);
        lean=swipeLean(dx,dy,pd.ang);out=swipeOut(dx,dy,pd.ang);
      }
      /* A clear lean commits; a flick essentially along the ring has no
         answer under either rule, so bump rather than coin-flip. */
      if(far>=18&&lean>far*0.12){GEST.lateSwipe++;hop(out?-1:1);}
      /* Swiped and got nothing. This is the misread rate worth watching.
         During the hop rehearsal a failed swipe extends the lesson instead
         of just thudding. */
      else{GEST.unresolved++;bump();
        if(G.teach>0&&G.teachKind==='hop')G.teach=Math.min(8,G.teach+2.5);}
    }else if(G.state==='playing'){
      GEST.tap++;
      commitReverseFX();
    }
  }
  pd=null;
}
function pointerUp(e){if(!runtimeDestroyed)pdEnd(runtimePointerEvent(e,'pointerup'));}
function pointerCancel(e){if(!runtimeDestroyed)pdEnd(runtimePointerEvent(e,'pointercancel'));}
function keyDown(e){
  if(runtimeDestroyed)return;
  e=runtimeKeyEvent(e);
  /* THE ACCOUNT PANEL OWNS THE KEYBOARD WHILE IT IS OPEN. Every listener in
     this game is on the canvas except this one, which is on window — so
     without this line, typing a password reverses the comet on every space
     and mutes the game on every m. The panel is the only screen in the game
     with a text field, and it is the only screen that needs this. */
  if(CLOUD.open){if(e.key==='Escape')closeAccount();return;}
  /* AUTO-REPEAT IS NOT AN INPUT. Hold a key and the OS fires keydown 15-30
     times a second, and every branch below is a discrete action — so a held
     Space called reverse() about twenty times a second, flipping direction
     every frame or two and pinning the comet inside 0.23 rad of the circle
     for an entire run. Measured on the shipped build: three runs, total
     angular territory 0.23 rad each, roughly thirteen degrees.
     The pointer path has always guarded this ("one gesture at a time: a
     second finger can't double-reverse"); the keyboard path never did. The
     file already knew, too — gridNear's comment records that held Space
     auto-repeat was stacking three or four notes into a single sixteenth,
     and that pass fixed the sound the repeats made without asking why the
     repeats were arriving as moves at all.
     Every branch here wants the keypress, not the key being down: a held
     Enter should not skip a level card, a held arrow should not machine-gun
     hops, and a held M should not fight the mute toggle. One guard covers
     all of them. */
  if(e.repeat)return;
  /* A FROZEN WORLD TAKES NO GAMEPLAY INPUT. Without this the keyboard walked
     straight past the panel: Space reaches the final else and calls reverse()
     on a run whose clock is stopped, and the arrow keys hop. Mute is
     deliberately still live — pausing to silence the game is one of the
     reasons to pause — and Space or Enter presses RESUME, which is the panel's
     own button answering a key rather than a second way to START a pause. */
  if(frozen()){
    if(e.code==='KeyM'){toggleMute();return;}
    if(PAUSE.on&&(e.code==='Space'||e.code==='Enter')){
      e.preventDefault();unpauseGame();beep(523,0.14,'triangle',0.06,784);
    }
    return;
  }
  if(e.code==='Space'||e.code==='Enter'){
    e.preventDefault();ensureAudio();
    if(G.state==='menu'){
      leaveMenu();
    }else if(G.state==='swipesel'){
      /* keyboard PLAY — same path as the tap handler's hit.id==='play' */
      savePref('cometloop:swipe',SWIPE_MODE);
      G.swipeAsked=true;
      track('swipe_mode_chosen',{mode:SWIPE_MODE,hops:GEST.swipe+GEST.lateSwipe});
      pd=null;
      if(G.selFrom==='menu'){G.selFrom=null;enterMenu();}
      else if(G.selFrom==='lab'){G.selFrom=null;enterPowerSel();}
      else{G.selFrom=null;enterRunStart();}
      beep(523,0.14,'triangle',0.06,784);
    }else if(G.state==='levelsel'){
      startFromSelect();
    }else if(G.state==='powersel'){
      startLab();
    }else if(G.state==='lvend'){
      if(G.t-G.lvT>0.6){cardDone();startGame();braam(0.05);}
    }else if(G.state==='dead'){
      if(G.t-G.deadT>0.6){if(!deadSeqDone())G.deadSkip=true;else retry();}
    }
    else{tryLand();reverse(false);}   /* the reverse also lands the drop */
  }else if(e.code==='ArrowUp'||e.code==='KeyW'||e.code==='ArrowLeft'||e.code==='KeyA'){
    e.preventDefault();
    if(G.state==='playing'){tryLand();hop(-1);}
    else if(G.state==='swipesel'){SWIPE_MODE=SWIPE_MODE==='radial'?'screen':'radial';G.selFx=1;beep(392,0.10,'triangle',0.05,588);}
    else menuStep(-1);
  }else if(e.code==='ArrowDown'||e.code==='KeyS'||e.code==='ArrowRight'||e.code==='KeyD'){
    e.preventDefault();
    if(G.state==='playing'){tryLand();hop(1);}
    else if(G.state==='swipesel'){SWIPE_MODE=SWIPE_MODE==='radial'?'screen':'radial';G.selFx=1;beep(392,0.10,'triangle',0.05,588);}
    else menuStep(1);
  }else if(e.code==='KeyM'){
    toggleMute();
  }else if(e.code==='Escape'){
    /* the keyboard's copy of the lab door, and of the picker's `back` — the
       one key every desktop hand already reaches for to leave a thing */
    if(LAB.on&&(G.state==='playing'||G.state==='dead')){enterPowerSel();beep(392,0.09,'triangle',0.04,294);}
    else if(G.state==='powersel'){enterMenu();beep(392,0.09,'triangle',0.04,294);}
  }else if(e.code==='KeyG'&&G.state==='powersel'){
    toggleGhost();   /* the picker's one non-list control gets a key too */
  }
}
if(!runtimeHost.externalLoop){
  runtimeListen(cv,'pointerdown',pointerDown);
  runtimeListen(cv,'pointermove',pointerMove);
  runtimeListen(cv,'pointerup',pointerUp);
  runtimeListen(cv,'pointercancel',pointerCancel);
  runtimeListen(cv,'contextmenu',function(e){e.preventDefault();});
  runtimeListen(window,'keydown',keyDown);
}

/* ---------- update ---------- */
/* THE STAR'S TAIL IS LONGER, and the DECAY is why — not this cap. Measured:
   an ordinary run holds 29 samples and a star holds 52, because a sample's
   life is what expires first (1/2.1s ordinarily, 1/1.15s with the star). The
   cap is never the binding constraint in either case and must not become one:
   at 50 it would have clipped the star's ribbon by two samples, which is the
   only reason it moves at all. It is headroom, and calling it the mechanism
   would be a comment claiming credit for a line that does nothing. */
function trailCap(){return RM?34:Math.round(62+48*(bhActive()?0:G.hyperGlow));}
function pushTrail(){
  const p=posPlayer();
  G.trail.push({x:p[0],y:p[1],life:1});
  while(G.trail.length>trailCap())G.trail.shift();
}
/* THE MENU DEMONSTRATES BOTH VERBS. The title comet was already orbiting the
   real simulation behind the key; now it plays a 12-second scripted loop — a
   harmless shard fades in ahead of it, it reverses with its real sparks, then
   it hops a ring and back at a third speed. The player watches the two verbs
   answered by the actual object before ever touching the screen. Ghost
   glyphs are drawn by the menu branch of drawHUD off the same clock.
   startGame resets everything this touches. */
const DEMO={last:99,spawned:false,rev:false,hop1:false,hop2:false};
function menuDemo(dt){
  const c=G.t%12;
  if(c<DEMO.last){DEMO.spawned=false;DEMO.rev=false;DEMO.hop1=false;DEMO.hop2=false;}
  DEMO.last=c;
  if(!DEMO.spawned&&c>=1){DEMO.spawned=true;
    G.spikes.push(mkSpike((G.angle+G.dir*1.9)%TAU,G.ringI,{life:1.6}));}
  if(!DEMO.rev&&c>=2.8){DEMO.rev=true;G.dir*=-1;reverseFX();}
  if(!DEMO.hop1&&c>=6&&G.nRings>1&&G.hopP>=1){DEMO.hop1=true;
    G.hopFrom=radiusOf(G.ringI);G.hopFromI=G.ringI;G.ringI=1;G.hopP=0;}
  if(!DEMO.hop2&&c>=9&&G.hopP>=1){DEMO.hop2=true;
    G.hopFrom=radiusOf(G.ringI);G.hopFromI=G.ringI;G.ringI=0;G.hopP=0;}
  updateSpikes(dt,false);
}
/* Exactly two beats (was an arbitrary 1.15s — within 4ms of the same feel,
   but now a blinker flickers ON THE GRID: armed for a bar-fraction, dormant
   for the rest, and a flicker pair alternates on the beat). */
const BLINK=SPB*2;
/* bt restarts at 0 the moment a shard arms, so a pair cannot be staggered by
   seeding bt — bo shifts where in the cycle it starts instead. */
function blinkPhase(s){return (s.bt+(s.bo||0))%BLINK;}
/* THE PROMISE HAS TO BE TRUE. A flicker pair is offset by exactly half a
   cycle, so a 0.55 duty left BOTH sides armed for 10% of every cycle — and
   the lesson explaining the pair says "only one is solid at a time". A
   player who read the sentence, waited for the gap and died in it was not
   misreading the game; the game was lying. A pair runs at duty 0.5, where
   exactly one side is lethal at every instant and the sentence holds
   literally. A lone blinker keeps 0.55 — it has nothing to contradict. */
const BDUTY=0.55;
function duty(s){return s.duty||BDUTY;}
function armed(s){return s.blink?(blinkPhase(s)<BLINK*duty(s)):true;}
function updateSpikes(sdt,lethal){
  const er=effRing(),pr=radiusOf(er);
  for(let i=G.spikes.length-1;i>=0;i--){
    const s=G.spikes[i];s.t+=sdt;
    if(s.va)s.a=(s.a+s.va*sdt)%TAU;
    if(s.blink)s.bt+=sdt;
    /* THE DIVE, and it happens INSIDE the telegraph on purpose. The shard
       changes orbit 55% of the way through its own warning, so the transfer
       is something the player watches happen with time left to answer it —
       not a shard that arms in one lane and is lethal in another before
       anyone could read either. The remaining 45% of the warn is the whole
       lesson: where it lands is where it kills, and you were shown.
       Announced in the level's own key like every other shard event, and
       arc-flashed on the ARRIVAL ring, because the arrival is the news. */
    if(s.dive===1&&s.phase===0&&s.t>=(s.warn||WARN)*0.55){
      s.dive=2;s.ring=s.diveTo;
      const dp=posAt(s.a,radiusOf(s.ring));
      arcFlash(s.a,s.ring,COL.shard);
      if(!RM)ripple(dp[0],dp[1],COL.shard);
      beep(PENT[4],0.09,'square',0.024,PENT[1],0,panAt(dp[0]),0.25);
    }
    if(s.phase===0&&s.t>=(s.warn||WARN)){s.phase=1;s.t=0;s.bt=0;}
    else if(s.phase===1&&s.t>=s.life){s.phase=2;s.t=0;}
    /* survived one ON YOUR OWN RING: the "red is lethal" prompt has done
       its job. A shard expiring two rings away proves nothing was dodged,
       and it used to clear the prompt for exactly the player who had not
       yet engaged with a threat at all. */
    else if(s.phase===2&&s.t>=FADE){G.spikes.splice(i,1);if(s.ring===er)G.didDodge=true;continue;}
    /* THE SAUCER'S STATE MACHINE. Three states and no easing: it is glued to
       the tail, or it is frozen and charging, or it is firing. Nothing here
       eases toward a moving target — the magnetar died twice proving that a
       first-order chase never arrives (5d752e6: the error settles at omega/k
       instead of reaching zero), so this thing's position is either an exact
       function of the player's or it is not moving at all.
       THE CHARGE CANNOT BE CANCELLED, and that is the point. An earlier shape
       of this let a second reversal flip the saucer back behind the comet and
       call the shot off, which handed the tap-tap-tap player a free cancel on
       the exact input the mechanic exists to answer. Once it is committed it
       fires, and it fires at the ring it is standing on — which is the ring
       you were on when you turned, not necessarily the one you are on now. */
    if(s.saucer){
      const sp=posAt(s.a,radiusOf(s.ring));
      if(s.phase!==1){
        /* still arriving: just take station, so the telegraph reads as a
           thing pulling in behind you rather than a red appearing there */
        s.a=(G.angle-G.dir*SAUCER_LAG+TAU)%TAU;s.side=1;s.sdir=G.dir;s.ring=G.ringI;
      }else if(s.fire>0){
        s.fire-=sdt;
        if(s.fire<=0){s.side=1;s.sdir=G.dir;}   /* shot spent — it slips back behind */
      }else if(s.chg>0){
        s.chg-=sdt;                              /* frozen in the world: s.a untouched */
        if(s.chg<=0){
          s.fire=SAUCER_BEAM;
          if(!RM)G.rings.push({x:cx,y:cy,r:radiusOf(s.ring),life:1,col:COL.shard,sp:120,dec:2.2});
          arcFlash(s.a,s.ring,COL.shard);
          if(!RM)G.shake=Math.max(G.shake,3);
          /* EVERY PITCH HERE IS A DEGREE OF PENT, which applyLevelMusic
             rescales by LV[].key — so the saucer speaks in each level's own
             key like everything else that answers the band. A bare Hz would
             have been an A-minor object sitting a whole tone out under
             EVENT HORIZON, which is the exact fault the beat drop, the snare
             body and the tom fill each shipped with. The shot is the root an
             octave down sliding up into the root: the floor of the song. */
          beep(PENT[0]*0.5,0.20,'sawtooth',0.05,PENT[0],0,panAt(sp[0]),0.35);
        }
      }else if(G.dir!==s.sdir){
        /* you turned into it. It stays exactly where it is — the flip of
           `side` is what keeps its WORLD angle unchanged while the heading
           it is measured against reverses — and starts counting. */
        s.sdir=G.dir;s.side=-s.side;s.chg=SAUCER_CHG;
        ripple(sp[0],sp[1],COL.shard);
        beep(PENT[0],0.10,'square',0.030,PENT[2],0,panAt(sp[0]),0.25);
      }else{
        s.a=(G.angle-G.dir*SAUCER_LAG*s.side+TAU)%TAU;
        /* "even if you switch orbits" — but not instantly, and never while it
           is charging. The hop IS the escape from a shot already committed. */
        if(s.ring!==G.ringI){
          s.hopT+=sdt;
          if(s.hopT>=SAUCER_HOP){
            s.ring=G.ringI;s.hopT=0;
            arcFlash(s.a,s.ring,COL.shard);
            /* the transfer — "it fires in your orbit", the playtester's own
               second sentence, spent on the FOLLOW rather than on a second
               way to die: it re-takes your tail on the ring you fled to */
            beep(PENT[4],0.07,'sine',0.022,PENT[2],0,panAt(sp[0]),0.3);
          }
        }else s.hopT=0;
      }
    }
    /* a moving shard's hitbox is widened by however far it travelled this frame */
    const tol=(18.5*u)/pr+Math.abs(s.va)*sdt;
    /* the saucer's BODY is not a hitbox at all — only its shot is, and the
       shot takes the whole ring, so there is no angle to test */
    const reach=s.saucer?s.fire>0:sweptHit(s.a,tol);
    /* labGhost() sits in the CONTACT test, ahead of the hypernova and shield
       branches, so nothing downstream of it can fire: no shield is spent, no
       pip moves, no popup, no i-frame, no death. The shard stays on the board
       and keeps travelling — it is still a real shard doing everything a shard
       does, and watching one pass through you is how you can tell the ghost is
       on without a HUD line claiming it. */
    if(lethal&&!labGhost()&&s.phase===1&&armed(s)&&s.ring===er&&G.t>=G.invuln&&reach){
      if(G.hyper>0&&!bhActive()){
        /* HYPERNOVA: the shard is a note, not a threat — it converts into a
           paying ember on your lane and the run does not even slow down.
           Fast consecutive contacts play novaConvert's ascending sixteenth
           run: plowing through a lane IS the melody. */
        novaConvert(G.spikes.splice(i,1)[0]);
        if(!RM)G.shake=Math.max(G.shake,4);
        continue;
      }
      if(G.shields>0){
        /* A SHIELD MEANS YOU LIVE. That is the whole of it. It used to also
           zero lapAcc and lapStreak, so being saved still cost you the orbit
           you were most of the way through and broke the run's flow at the
           exact moment the shield was supposed to protect it. The shield
           itself is the price. */
        if(G.shields>=shieldMax())cueState(false); /* overcharge closes with the spent shield */
        G.shields--;G.invuln=G.t+0.9;G.blocks++;
        s.phase=2;s.t=0;
        /* The shield breaks into fragments; a short hit-stop carries contact. */
        if(!RM)G.stop=Math.max(G.stop,0.04);
        const p=posPlayer();
        burst(p[0],p[1],COL.shield,18,180);
        ripple(p[0],p[1],COL.shield);
        /* SAY WHAT IT COST. 'SHIELD USED' alone left the bank a number you
           had to go and read off the pips mid-dodge, so a saved hit felt like
           a free one — and with 0.9s of invulnerability behind it, the next
           red or two pass through harmlessly as well. Naming the remainder,
           and shouting when the bank empties, is what makes the last one
           land as the moment red starts killing again. */
        popup(p[0],p[1]-24*u,
          G.shields>0?'-1 SHIELD \u00b7 '+G.shields+' LEFT'
                     :'NO SHIELDS: AVOID RED',COL.shield);
        G.didShield=true;G.didDodge=true;
        /* a save that sounded like a punishment: square falling to 90Hz sat
           in the death register and below what a phone reproduces */
        /* the rescue is felt NOW; its confirming chime lands in time */
        beep(CH[0][0]*(392/110),0.16,'triangle',0.075,CH[0][0]*(588/110));
        /* the bright confirming chime would be a lie on an empty bank */
        if(G.shields>0)cueTone(function(w){beep(CH[0][0]*(784/110),0.20,'sine',0.055,CH[0][0]*(1046/110),w);});
        else cueTone(function(w){beep(CH[0][0]*(330/110),0.34,'sawtooth',0.055,CH[0][0]*(196/110),w);});
      }else{
        /* the tw stamp carries the pairing a lone shard cannot infer, so a
           twin death coaches the hop instead of reporting 'single' */
        G.lastHit=s.saucer?'saucer':
                  s.gate?(s.funnel?'funnel':(s.va?'driftgate':'gate')):
                  (s.dive?'dive':
                  (s.tw?s.tw:(s.blink?'blink':(s.va?'drift':'single'))));
        die();
      }
    }
    /* THE NEAR MISS. Two honest shapes only: stopping just short of a shard
       on your own ring (the reverse that saved you), and sweeping past a
       shard on the ring you just left mid-hop (the hop that saved you).
       Passing shards on other rings in ordinary travel earns nothing — a
       graze has to be a dodge, or the spark means nothing. Never red. */
    /* the saucer is excluded: a near miss has to be a dodge, and there is
       nothing to graze on a body that was never going to touch you */
    else if(lethal&&s.phase===1&&armed(s)&&!s.grz&&!s.saucer&&G.t>=G.invuln&&(
        (s.ring===er&&sweptHit(s.a,tol+(10*u)/pr))||
        (G.hopP<1&&s.ring===G.hopFromI&&s.ring!==er&&sweptHit(s.a,tol))
      )){
      s.grz=1;
      const gp=posPlayer();
      G.score+=3;
      G.nearN++;
      popup(gp[0],gp[1]-20*u,'DODGED +3','rgba(230,240,255,0.9)',0.85);
      burst(gp[0],gp[1],'#bef4ff',8,220);
      PLAY.heat=Math.min(1,PLAY.heat+0.10);
      build(0.006,'orbit');
      cueTone(function(w){hat(AC.currentTime+w,0.010,6500,0.03,0.3);
        note(PENT[10]*0.5,AC.currentTime+w,0.08,'sine',0.012,3500,panAt(gp[0]));});
      gameHaptic('tap',7);
    }
  }
}
function update(dt){
  /* BEFORE G.t MOVES, and nothing above this line. Every deadline in the file
     is written against G.t, so this one return is the entire freeze — see the
     note above PAUSE. The countdown runs on the REAL frame delta rather than on
     G.t, because G.t is precisely the thing it is holding still. */
  if(frozen()){
    if(PAUSE.on)return;
    PAUSE.resumeT=Math.max(0,PAUSE.resumeT-dt);
    /* the cooldown is armed HERE, at the moment play actually restarts, rather
       than when the panel closed — otherwise the three counted-down seconds
       would pay for most of it. The wall-clock span is banked on the same
       edge, so it covers the count-in too: the world was frozen for all of it,
       and a measurement that stopped at the panel closing would be describing
       a different thing from the one the player experienced. */
    if(PAUSE.resumeT<=0){
      PAUSE.cool=PAUSE_COOL;
      PAUSE.total=pausedSeconds();PAUSE.at=0;
    }
    return;
  }
  if(PAUSE.cool>0)PAUSE.cool=Math.max(0,PAUSE.cool-dt);
  G.t+=dt;
  const rewardDt=bhActive()?0:dt;
  G.shake=Math.max(0,G.shake-dt*45);
  G.scorePop=Math.max(0,G.scorePop-dt*3.5);
  G.beat=Math.max(0,G.beat-dt*4.5);
  G.grooveFx=Math.max(0,G.grooveFx-dt*2.2);
  if(G.missFx){G.missFx.t-=dt*2.4;if(G.missFx.t<=0)G.missFx=null;}
  /* THE POCKET: hold the top of the chain and the sky itself starts playing —
     the flow field accelerates, the dust lanes crystallize, the ripple field
     fires on the landed beat. Attack over one bar so it ARRIVES rather than
     switches; ×7 sustains (one slip of grace, the same one rung a miss
     costs); below that it lets go in about a bar and a half. */
  const pkT=G.groove>=8?1:(G.groove>=7?G.pocket:0);
  if(pkT>G.pocket)G.pocket=Math.min(1,G.pocket+dt/2.31);
  else if(pkT<G.pocket)G.pocket=Math.max(0,G.pocket-dt/1.5);
  G.buildFx=Math.max(0,G.buildFx-dt*2.2);
  G.dropFx=Math.max(0,G.dropFx-dt*1.1);
  G.bandFx=Math.max(0,G.bandFx-dt*1.6);
  G.loopFx=Math.max(0,G.loopFx-dt*3.5);
  G.odGlow+=(((G.od>0)?1:0)-G.odGlow)*Math.min(1,dt*2.5);
  G.brkGlow+=(((MU&&MU.brk>0)?1:0)-G.brkGlow)*Math.min(1,dt*7);
  G.finGlow+=((FIN.on?1:0)-G.finGlow)*Math.min(1,dt*2);
  G.payOpen=Math.max(0,G.payOpen-dt*1.4);
  G.bgFade=Math.max(0,G.bgFade-dt/2.5);
  G.impactT=Math.max(0,G.impactT-dt);
  if(G.armFx){G.armFx.t+=dt;if(G.armFx.t>2.6)G.armFx=null;}
  /* the drop always comes around: a steady trickle guarantees one roughly
     every 50s even for a player earning nothing — good play stacks on top */
  if(G.state==='playing')build(dt/50,'time');
  if(G.sayFx){G.sayFx.t+=dt;if(G.sayFx.t>1.8)G.sayFx=null;}
  annPump();
  if(G.landFx){G.landFx.t+=dt;if(G.landFx.t>1.9)G.landFx=null;}
  if(G.secFx){G.secFx.t+=dt;if(G.secFx.t>2.2)G.secFx=null;}
  /* stop playing and the groove lets go, so it always reflects what you are
     doing now rather than something you did a minute ago */
  if(G.groove>0&&G.t>G.grooveT){G.groove--;G.grooveT=G.t+0.7;}
  if(G.groove>G.bestGroove)G.bestGroove=G.groove;
  G.slow=Math.max(0,G.slow-rewardDt);
  G.stop=Math.max(0,G.stop-dt);
  /* real dt, never sdt: the pitch asked for 15-20 SECONDS, and running the
     mode's own clock through its own slow motion would quietly make it 31 */
  if(G.state==='playing'||bhActive())bhTick(dt);
  bedTick(dt);
  /* "Slow Motion mode. But extended slow motion. The entire time is slow
     motion." The existing easing carries it in and out with the warp. */
  /* THE FALL IN IS THE DEEPEST PART. Phase 1 — the 0.85s where the orbits are
     re-spacing — targets well below the sustained rate and then relaxes, so
     crossing the horizon is a moment the player feels rather than a setting
     that changes. It also gives the re-spacing orbits time to be watched,
     which was previously over before the eye could follow it. */
  const tsT=bhActive()?(BH.phase===1?BH_TS*0.62:BH_TS):(G.slow>0?0.55:1);
  /* the ease is slower going IN than coming out: falling into a gravity well
     is a swoon, leaving it is a release */
  G.tsCur+=(tsT-G.tsCur)*Math.min(1,dt*(tsT<G.tsCur?3.2:8));
  /* the presentation clock — see G.vt. Everything the player LOOKS at advances
     on this; everything the game MEASURES stays on G.t and dt. */
  const pdt=dt*G.tsCur;
  G.vt+=pdt;
  /* the menu demo hops at a third speed, so the gesture reads as a gesture.
     The hop dilates too: it is the one motion the player commands, so leaving
     it at full speed inside slow motion is the loudest possible statement that
     the world is not really slow — and it also handed the mode's only escape
     verb a 2.4x discount against everything it escapes. */
  if(G.hopP<1)G.hopP=Math.min(1,G.hopP+(bhActive()?pdt:dt)/((G.state==='menu'||G.state==='swipesel'||G.state==='levelsel'||G.state==='powersel')?HOP*3.5:HOP));
  /* The grace holds while the finger is still down: a slow deliberate swipe
     used to outlive the 70ms window, fire the reverse beep and sparks, and
     then roll back anyway — sound for a reverse that never happened. A held
     tap now commits its effects at lift instead. */
  if(G.revPend>0&&G.t>=G.revPend&&!pd){G.revPend=0;reverseFX();}
  /* PARTICLES LIVE IN DILATED TIME TOO. They integrated on raw dt, so every
     spark, burst and trail mote kept moving at full speed through slow motion
     — the arena crawled while the debris in front of it did not, and the two
     read against each other as "this does not feel slow". Time dilation has
     to dilate the visible world or it is just a speed setting on the comet.
     Deliberately G.tsCur alone and not sdt: hit-stop and the near-frozen
     teaching veil should not also freeze the particles that are explaining
     the thing being taught. */
  for(let i=G.parts.length-1;i>=0;i--){
    const p=G.parts[i];
    p.x+=p.vx*pdt;p.y+=p.vy*pdt;
    /* nd = no drag. The global damping is exp(-1.897*t), so a particle only
       ever travels v0/1.897 = 0.527*v0 no matter how long it lives — right
       for a burst spark that should punch and stop, fatal for anything meant
       to travel. The black hole's infall had 184px to cover and covered 48
       before stalling in the outer lane: a ten-degree arc, not a vortex. */
    if(!p.nd){p.vx*=Math.pow(0.15,pdt);p.vy*=Math.pow(0.15,pdt);}
    p.life-=p.dec*pdt;
    if(p.life<=0)G.parts.splice(i,1);
  }
  for(let i=G.rings.length-1;i>=0;i--){
    /* per-ripple speed and decay, so a death shockwave can outrun a pickup pop */
    const r=G.rings[i];r.r+=(r.sp||170)*u*pdt;r.life-=(r.dec||2.8)*pdt;
    if(r.life<=0)G.rings.splice(i,1);
  }
  for(let i=G.arcs.length-1;i>=0;i--){
    const a=G.arcs[i];a.life-=2.6*pdt;
    if(a.life<=0)G.arcs.splice(i,1);
  }
  for(let i=G.laps.length-1;i>=0;i--){
    const L=G.laps[i];L.life-=1.35*pdt;
    if(L.life<=0)G.laps.splice(i,1);
  }
  /* dt, not sdt: the blast keeps expanding through the hitstop it caused */
  for(let i=G.novas.length-1;i>=0;i--){
    const n=G.novas[i];
    /* Paced to the RING SYSTEM, not to the screen. The farthest shard is 2R
       from a blast centred on the comet, which the 560 front crosses in about
       0.65s, so 0.8 (1.25s of life) leaves the sweep comfortably inside the
       window with room for a wide screen — and still expires long before it
       could eat shards that spawn well after the blast. */
    n.r+=(n.sp||NOVA_SP*u)*dt; n.life-=0.8*dt;
    for(let j=G.spikes.length-1;j>=0;j--){
      if(n.targets&&!n.targets.includes(G.spikes[j]))continue;
      const q=posAt(G.spikes[j].a,radiusOf(G.spikes[j].ring));
      if(Math.hypot(q[0]-n.x,q[1]-n.y)<=n.r)novaConvert(G.spikes.splice(j,1)[0]);
    }
    if(n.life<=0){
      /* Only contact with the visible front converts a shard. Its speed
         already clears the entire ring system; expiry must not erase new
         threats that arrived after that front passed. */
      G.novas.splice(i,1);
    }
  }
  for(let i=G.pops.length-1;i>=0;i--){
    const p=G.pops[i];p.y-=34*u*pdt;p.life-=1.1*pdt;
    if(p.life<=0)G.pops.splice(i,1);
  }
  for(let i=G.trail.length-1;i>=0;i--){
    /* the star's samples live longer, or the raised cap buys nothing: a
       sample that expires on schedule is gone before the extra length can
       reach it */
    const tr=G.trail[i];tr.life-=pdt*(1.5-(RM?0:0.55*G.hyperGlow));
    if(tr.life<=0)G.trail.splice(i,1);
  }

  /* dir matters on the menu now: the demo reverses the comet for real */
  /* THE TITLE SCREEN RUNS AT THE MODE'S PACE, and keeps doing so with one
     mode. It was written so a pick was legible before the player committed to
     it — choose the calmer game and the screen visibly calms down — and with
     nothing to pick it is now simply the demo running at the game's own
     speed, off the same multiplier the run uses. Kept wired rather than
     inlined to 1: MD().demo is a live knob, check.mjs fails on a knob with no
     call site, and this is its call site. */
  if(G.state==='menu'){
    G.sweep=0;G.angle+=0.8*MD().demo*dt*G.dir;pushTrail();
    menuDemo(dt);return;
  }
  if(G.state==='levelsel'){
    G.sweep=0;G.angle+=0.62*MD().demo*dt*G.dir;pushTrail();
    if(G.lvSelFx>0)G.lvSelFx=Math.max(0,G.lvSelFx-dt*2.4);
    return;
  }
  if(G.state==='powersel'){
    G.sweep=0;G.angle+=0.62*MD().demo*dt*G.dir;pushTrail();
    if(G.powSelFx>0)G.powSelFx=Math.max(0,G.powSelFx-dt*2.4);
    return;
  }
  if(G.state==='lvend'){G.sweep=0;G.angle+=0.8*dt*G.dir;pushTrail();return;}
  /* THE CHOOSER IS A SANDBOX, not a diagram. It runs the real rings, the real
     comet and the real hop() — the only way to know which rule your thumb
     wants is to use it. Slow enough to read, and nothing here can hurt you. */
  if(G.state==='swipesel'){G.sweep=0;G.angle+=0.62*dt*G.dir;pushTrail();return;}
  if(G.state==='dead'){G.sweep=0;updateSpikes(dt,false);return;}

  if(G.intro){introTick(dt);currentWakeUpdate(pdt);return;}
  /* playing */
  G.teach=Math.max(0,G.teach-dt);
  if(G.nRings>=3&&G.ringI===0)G.campT+=dt;else G.campT=0;
  /* the meta-lesson of the whole record: the game answers your inputs in
     music. Named once per device, in level 1's calm opening, after the
     player has made at least one move for the music to have answered. */
  if(!G.seen.music&&G.didReverse&&age()>10&&age()<26)firstMeet('music');
  /* THE FINALE replaces the bare finish line on levels 1-2: it latches at
     the next two-bar line once the run is close, banks any drop, and the
     duet plays out. A generous backstop still completes the level if the
     finale somehow never latches. */
  const lvEnd=LV[G.level-1].end;
  if(lvEnd<1e9&&!bhActive()){
    /* AUDIO IS OPTIONAL. Muted play keeps the full duet — the audio clock
       still runs and the sequencer speaks by eye. But if WebAudio itself
       never came up, there is no grid to duet on: the level simply
       completes at its finish line, the way it always used to. */
    if(!AC||!MU){
      if(dl()>=lvEnd){levelComplete();return;}
    }else if(!FIN.on&&!FIN.done&&!starfallActive()&&dl()>=lvEnd-10&&(MU.pay<=0&&!MU.rise)){
      /* a live hard lesson must not freeze the finale's opening bars under
         the veil — the ceremony owns the screen from here */
      flushLesson(true);G.teach=0;G.teachKind=null;
      FIN.on=true;FIN.pend=true;
      FIN.score=0;FIN.got=0;FIN.voices=0;FIN.t0=G.t;
      FIN.bloomed=false;FIN.lastAt=-9;
      /* THE TRAIL: eleven stars in a tight spiral — four outer, four mid,
         three inner — each the next note of a cadence walking to the root.
         The FINISH is separate and unmistakable: a sun-seed waits on the
         inner ring and only BLOOMS once the melody is nearly gathered, so
         the ending is always the player's own dive, never an accident
         (the owner ended a level 'without even collecting all the orbs'
         when a plain trail star doubled as the exit). */
      FIN.trail.length=0;
      const CAD=[4,3,2,4,3,2,1,3,2,1,0];
      const dir0=G.dir,a0=G.angle+dir0*0.9;
      for(let k2=0;k2<11;k2++){
        const ringT=Math.min(k2<4?0:k2<8?1:2,G.nRings-1);
        FIN.trail.push({a:a0+dir0*k2*0.55,ring:ringT,got:false,ci:CAD[k2]});
      }
      FIN.sun={a:a0+dir0*11*0.55,ring:Math.min(2,G.nRings-1),got:false};
      if(MU&&AC)MU.cool=Math.max(MU.cool,AC.currentTime+40);
      /* THE STAGE CLEARS AND THE CEREMONY IS UNMISSABLE (playtest: "I
         didn't get the level ending mechanic at all"). A full banner with
         reading time — not a 1.8s flash — every live threat fades, the
         pickups leave, and two intro bars pass with the sequencer fading
         in before the first call. The duet then narrates itself with a
         STANDING instruction line for its whole length. */
      /* NOT "UNLOCKED". Nothing is unlocked on this path — G.tier, G.nRings
         and the spawn pool are untouched by the finale latch, and the tier
         block is separately suppressed inside the endgame window — so every
         player clearing a level read UNLOCKED / THE FINALE at the moment the
         level was being taken away. One hardcoded eyebrow served two opposite
         events, which no wording can fix. */
      G.banner={str:'COLLECT THE STARS',eyebrow:'LEVEL END',sub:'Swipe between rings to collect them',t:0};
      /* a hypernova carried into the dive would fight the dive's own
         momentum curve — the star gets a graceful second to wind down */
      G.hyper=Math.min(G.hyper,1.0);
      G.stars.length=0;G.pows.length=0;
      for(const sp2 of G.spikes)if(sp2.phase===1){sp2.phase=2;sp2.t=0;}
      fireLift();
    }

  }
  /* THE DIVE'S COLLECTOR (fun pass — the owner's verdict on the stroll:
     'just not that fun'). Every star now FEEDS MOMENTUM: the comet speeds
     up ~6% per star and the music brightens with it, so gathering the
     melody is an accelerating rush that peaks exactly at the dive's end.
     Quick consecutive pickups CHAIN for double. And the ending is a
     deliberate act: the finish sun only blooms once the melody is nearly
     home, and only diving into IT completes the level. */
  if(FIN.on&&FIN.trail.length){
    const er2=effRing();
    for(const st2 of FIN.trail){
      if(st2.got||st2.ring!==er2)continue;
      if(!sweptHit(st2.a,(24*u)/radiusOf(er2)))continue;
      st2.got=true;FIN.got++;
      const p2=posAt(st2.a,radiusOf(st2.ring));
      burst(p2[0],p2[1],COL.ember,16,200);
      ripple(p2[0],p2[1],COL.ember);
      const chain=G.t-FIN.lastAt<1.3;FIN.lastAt=G.t;
      const pts=chain?60:30;
      G.score+=pts;FIN.score+=pts;G.scorePop=Math.max(G.scorePop,0.6);
      /* "+60 ×2", not "+60 CHAIN". THE WORD "CHAIN" NAMED THREE DIFFERENT
         MECHANICS. The star combo's own lesson called itself "chain stars",
         the on-beat counter's lesson said "the chain climbs", and this — a
         fourth thing, on a 1.3s window, none of them the same rule — printed
         CHAIN in gold over the arena while the header printed COMBO in gold
         two inches above it. A player has no way to learn a word that means
         three things. So the word is gone from everything the player reads:
         one multiplier symbol, used the same way everywhere. */
      popup(p2[0],p2[1]-20*u,chain?'+60':'+30',COL.ember,chain?1.1:0.85);
      /* THE HANDOFF: the moment one star is taken the next visibly
         IGNITES — a ripple and a small ring at its position — so the eye
         is pulled to the new target without reading anything */
      for(const nn of FIN.trail){
        if(nn.got)continue;
        const pn3=posAt(nn.a,radiusOf(nn.ring));
        ripple(pn3[0],pn3[1],COL.ember);
        if(!RM)G.rings.push({x:pn3[0],y:pn3[1],r:5*u,life:0.7,col:COL.ember});
        break;
      }
      if(FIN.got%4===0)FIN.voices=Math.min(2,FIN.voices+1);
      const ci2=st2.ci,cpan2=panAt(p2[0]);
      cueTone(function(w){
        const tt3=AC.currentTime+w;
        note(chTone(ci2),tt3,0.22,'triangle',0.034,1800,cpan2,undefined,0.4);
        note(chTone(ci2+2),tt3,0.20,'sine',0.016,1600,-cpan2);
      });
      gameHaptic('pickup',8);
    }
    /* THE SUN BLOOMS once the melody is nearly gathered (or late enough
       that it must) — a riser and a gold ripple announce the exit */
    if(!FIN.bloomed&&(FIN.got>=8||G.t-FIN.t0>30)){
      FIN.bloomed=true;
      if(AC)riser(AC.currentTime+0.02,1.4,0.020,1200);
      ripple(cx,cy,COL.ember);
    }
    if(FIN.bloomed&&FIN.sun&&!FIN.sun.got&&FIN.sun.ring===er2&&
       sweptHit(FIN.sun.a,(26*u)/radiusOf(er2))){
      FIN.sun.got=true;
      const p2=posAt(FIN.sun.a,radiusOf(FIN.sun.ring));
      const all=FIN.got>=FIN.trail.length;
      cueTone(function(w){
        const tf=AC.currentTime+w;
        kick(tf,0.09);
        note(chTone(0)/2,tf,0.8,'sine',0.060,300);
        note(chTone(2),tf,0.6,'triangle',0.040,1600,-0.15);
        note(chTone(3),tf,0.6,'triangle',0.035,1700,0.15);
        note(chTone(4),tf,0.6,'square',0.022,2200,0);
        hat(tf,0.050,2400,0.5,0.5);
      });
      braam(0.06);
      burst(p2[0],p2[1],'#ffffff',26,320);
      if(all){
        G.score+=200;FIN.score+=200;
        popup(p2[0],p2[1]-32*u,'ALL STARS +200',COL.ember,1.5);
      }else{
        G.score+=100;FIN.score+=100;
        popup(p2[0],p2[1]-32*u,'LEVEL COMPLETE +100',COL.ember,1.3);
      }
      gameHaptic('reward',[40,30,90]);
      FIN.on=false;FIN.done=true;G.finEnd=1;
    }
    /* the dive's own clock is the only clock — 50 unhurried seconds, then
       the level completes with whatever ending was gathered */
    if(G.t-FIN.t0>50){FIN.on=false;FIN.done=true;G.finEnd=1;}
  }
  if(G.finEnd){
    G.finEnd=0;
    /* a RECEIPT, not a payment: every component already popped and paid at
       its own site ('+30', '+60 CHAIN', 'PERFECT ENDING +200'), so a '+N'
       here printed the same money twice in the grammar of new money */
    if(FIN.score>0)popup(cx,cy-40*u,'ENDING POINTS: '+FIN.score,COL.ember,1.5);
    levelComplete();return;
  }
  /* OVERDRIVE — the eleventh notch. Keep the heat pinned for a full bar
     (about 2.3s of continuous playing) and the game tips into eight bars of
     double-time with every layer open, and embers and on-beat taps paying
     double. Never while a drop is in flight; a drop that rises mid-overdrive
     simply absorbs it — the bigger moment wins. */
  if(!bhActive()&&MU&&MU.pay<=0&&!MU.rise&&G.od<=0&&PLAY.heat>0.75)G.odT+=dt;else G.odT=0;
  if(G.odT>SPB*8&&G.t>G.odCool&&G.od<=0&&MU&&!MU.armed&&dl()>18&&!FIN.on){
    G.od=64;G.odT=0;G.odCool=G.t+45;scenePulse('drop',3);
    cueState(true);
    say('Double points for stars and on-beat taps',3,6);
    fireLift();braam(0.045);
    const op=posPlayer();burst(op[0],op[1],COL.warp,20,240);
    if(!RM){
      G.rings.push({x:cx,y:cy,r:radiusOf(G.ringI),life:1,col:COL.warp,sp:260,dec:1.6});}
  }
  /* the spotlight burns down; golden lap is retired — the finale is the
     scheduled special moment now, and it is musical instead of a timer */
  if(G.spot>0&&G.spot-rewardDt<=0)cueState(false);
  G.spot=Math.max(0,G.spot-rewardDt);
  if(G.hyper>0){
    G.hyper=Math.max(0,G.hyper-rewardDt);
    /* the landing is protected: the frame the star fades must not be a
       death sentence at speed — a short grace covers the deceleration */
    if(G.hyper===0)G.invuln=Math.max(G.invuln,G.t+1.2);
  }
  G.hyperGlow+=(((G.hyper>0&&!bhActive())?1:0)-G.hyperGlow)*Math.min(1,dt*3);
  G.spotGlow+=(((G.spot>0&&!bhActive())?1:0)-G.spotGlow)*Math.min(1,dt*3);
  /* THE PROMISE IS WITHDRAWN ON A CLOCK, SO SAY SO. shieldMax() steps 3->4->5
     at dl 160 and 320. A bank sitting full at 3/3 stops being full the instant
     the clock crosses, the ember doubling stops with it, and nothing was ever
     said — the player just watched their score rate drop for no visible
     reason. The shimmer is closed at the same moment so the state and the
     signal agree. */
  const smx=shieldMax();
  if(G.shMax&&smx>G.shMax&&G.shields>=G.shMax){
    say('You can now hold '+smx+' shields',2,6);
    cueState(false);
  }
  G.shMax=smx;
  /* the layer ladder: a score crossing names the layer that just joined */
  let lyn=0;for(let li=0;li<LAYER_AT.length;li++)if(G.score>=LAYER_AT[li])lyn++;
  if(lyn>G.layerN){
    G.layerN=lyn;G.bandFx=1;
    if(!G.bandCap){G.bandCap=true;G.bandCapT=G.t;}  /* the meter's caption moment */
    /* pri 2, not 1: a bought layer is a reward, and at the queue's minimum
       priority it lost the slot to every routine line for the whole 2.8s pump */
    say(LAYER_NAME[lyn-1],2,20);
    braam(0.030);
    cueTone(function(w){
      note(CH[0][0],AC.currentTime+w,0.24,'sawtooth',0.030,1600,-0.2,undefined,0.4);
      note(CH[0][2]*0.5,AC.currentTime+w+S16,0.24,'sawtooth',0.026,1800,0.2,undefined,0.4);
    });
  }
  /* a NEW SOUND is announced once its level banner has had the screen —
     and the announcement is the sound itself, playing a quick lick.
     Never inside a black hole: the band is silenced and the player is not
     an instrument there, so announcing a new band voice mid-mode was a
     sentence about music that was not playing (screenshotted: "NEW SOUND:
     SYNTH LEAD" across the singularity). sndAt simply waits; the mode's
     exit releases it. */
  if(G.sndAt&&G.t>=G.sndAt&&!bhActive()){
    G.sndAt=0;say(G.sndStr,2,20);
    const tr=G.tier;
    cueTone(function(w){
      const tt=AC.currentTime+w;
      if(tr>=9){gtr(PENT[4],tt,0.30,0.05,-0.2);gtr(PENT[6],tt+2*S16,0.34,0.05,0.2);}
      else if(tr>=6){note(PENT[4],tt,0.16,'sawtooth',0.030,3000,-0.2);
        note(PENT[6],tt+S16,0.16,'sawtooth',0.030,3400,0);
        note(PENT[8],tt+2*S16,0.20,'sawtooth',0.030,3800,0.2);}
      else{note(PENT[4],tt,0.18,'square',0.026,2400,-0.2);
        note(PENT[4]*1.007,tt,0.18,'sawtooth',0.018,2200,0.2);
        note(PENT[6],tt+2*S16,0.20,'square',0.026,2600,0.2);
        note(PENT[6]*1.007,tt+2*S16,0.20,'sawtooth',0.018,2400,-0.2);}
    });
  }
  if(G.teach<=0&&G.teachHint)flushLesson(false);
  /* Effects run on dt, gameplay on sdt — so during hitstop the comet holds
     still while the ignition keeps playing. That contrast is the impact.
     The hop rehearsal dilates the same way slow-mo does: the comet at a
     third speed, the music untouched, and spawns held — see the rings
     branch of the tier ratchet. */
  /* A HARD LESSON IS A HELD BREATH NOW, not a mumble. 0.35x meant the new
     threat was explained over a board still visibly in motion — the
     playtest's "poor job of introducing cleanly" in one number. 'see'
     lessons run near-frozen (0.06x) under a dim veil with the specimen
     spotlit; the hop rehearsal keeps 0.35x because it needs a world moving
     enough to practice against. The music never stops either way. */
  const sdt=dt*G.tsCur*(G.stop>0?0.10:1)*
    ((G.teach>0&&!G.teachSoft)?(G.teachKind==='see'?0.06:0.35):1);
  /* a slow floor ramp so the game can never be stalled by refusing to score */
  /* HYPERNOVA speed: +90% at full burn — eased in over a third of a second
     so the lurch reads as ignition, and eased OUT over the last 1.4s so the
     star never dumps you at double speed into an armed lane */
  const hv=G.hyper>0&&!bhActive()?Math.min(1,(G.hyperD-G.hyper)/0.35,G.hyper/1.4):0;
  G.speed=speedAt()*(FIN.on?1+0.06*FIN.got:1)*(1+0.9*hv);   /* the dive is a rush */
  /* Announce each new mechanic so it registers as something to learn. One
     crossing at a time, spaced by the banner: when the verb gate releases,
     the held tiers arrive as a readable sequence instead of a pile-up that
     skips every banner but the last. */
  /* Never during the finale: with STORM sitting exactly on level 3's floor,
     dl crosses it while a level-2 star dive is still playing out — the exam
     must not be announced over the graduation ceremony. startGame's silent
     pre-climb owns the crossing instead, and the level card announces it.
     And a live banner now keeps the screen for its FULL display: replacing
     at 1.2s was below reading speed for the 40-char subs, and the pile-up
     case (the hop-hold releasing TWIN + THIRD RING together) is by
     construction the player reading slowest. */
  const ti=tierIndex();
  /* ...and never inside a black hole, for the same reason it is never during
     the finale: the mode owns the screen, it has its own banner, and a tier
     announcement lands on top of it. Screenshotted — "UNLOCKED / THE SAUCER"
     printed across the singularity, replacing the black hole's own banner and
     introducing a formation the player could not look at. The increment defers
     with the banner, exactly as the finale guard above defers it. */
  /* ...and never over a hard lesson's freeze. firstMeet defers for a fresh
     banner, but the deferral only ran one way: measured, "FLICKER PAIRS /
     UNLOCKED" and its chord fired 1.0s into the black hole lesson's 2.8s
     near-frozen veil. The crossing defers exactly as it does for the banner
     it would have collided with. */
  if(ti>G.tier&&!FIN.on&&!FIN.pend&&!G.banner&&!bhActive()&&
     !(G.teach>0&&!G.teachSoft)&&
     !(lvEnd<1e9&&dl()>=lvEnd-10)){
    /* ...and never in a level's ENDGAME window either: a beat-drop payoff
       defers the finale latch while dl keeps running, so without this a
       long payoff at the end of level 2 crossed dl 190 and announced THE
       STORM over its own graduation. The next level's silent pre-climb
       owns any crossing the window swallows. */
    G.tier++;G.featT=G.t;      /* the featuring grace clock — see pickType */
    skyI=Math.min(3,Math.max(G.level-1,G.tier>=T_SKY[3]?3:G.tier>=T_SKY[2]?2:G.tier>=T_SKY[1]?1:0));  /* the sky deepens; each level floors it, clamped to the four bands */
    const T=TIERS[G.tier];
    if(T.rings&&T.rings>G.nRings){
      G.nRings=T.rings;
      const nr=radiusOf(G.nRings-1);
      G.rings.push({x:cx,y:cy,r:nr*0.3,life:1,col:COL.comet});
      G.rings.push({x:cx,y:cy,r:nr,life:1,col:COL.comet});
      beep(CH[0][0]*(330/110),0.2,'sine',0.05,CH[0][0]*(660/110));
      beep(CH[0][0]*(660/110),0.25,'sine',0.05,CH[0][0]*(990/110),0.16);
      /* THE HARD GESTURE GETS A REHEARSAL. When the second ring lands for
         someone who has never once hopped, time dilates, spawns hold, and
         the radial guide draws at the comet — the one place the rotating
         gesture can actually be shown. First landed hop ends it instantly;
         the cap means it can never stall a run. */
      if(G.nRings===2&&!G.didHop&&!G.everHopped){
        /* a live lesson must not survive into the rehearsal: teach state is
           one slot, and inheriting a soft lesson's flags ran the rehearsal
           at FULL speed under a stale sentence */
        flushLesson(true);
        G.teach=8;G.teachKind='hop';G.teachSoft=false;
      }
    }
    if(T.name){
      G.banner={str:T.name,eyebrow:'UNLOCKED',sub:T.subFn?T.subFn():T.sub,t:0};
      fireLift();      /* ceremony, not a chorus — see fireLift */
      ripple(cx,cy,COL.ember);   /* earned, so gold — see the banner draw */
      /* the unlock call, reserved for banners alone — the generic triangle
         pair it replaces sounded like three other events */
      cueUnlock();
    }
    /* the star voice steps up at levels 4, 7 and 10 — announced after the
       level banner has had the screen (see update), as its own moment.
       SND_SEEN is keyed by VOICE ORDINAL (1/2/3), the same key space the
       level-start path reads — this line used to write the TIER INDEX, and
       when DIVERS and THE NARROWS were inserted THIRD RING's index collided
       with the guitar's ordinal: measured, TWIN SYNTHS and SYNTH LEAD each
       announced twice per climb and ELECTRIC GUITAR never announced at all,
       because every level-1 THIRD RING crossing pre-poisoned its key. */
    if(G.tier===T_VOICE[1]||G.tier===T_VOICE[2]||G.tier===T_VOICE[3]){
      const cvt=G.tier===T_VOICE[3]?3:G.tier===T_VOICE[2]?2:1;
      if(!SND_SEEN[cvt]){
      SND_SEEN[cvt]=1;   /* a later level start must not repeat it */
      G.sndAt=G.t+3.8;
      G.sndStr=G.tier>=T_VOICE[3]?'NEW SOUND: ELECTRIC GUITAR':
               G.tier>=T_VOICE[2]?'NEW SOUND: SYNTH LEAD':'NEW SOUND: TWIN SYNTHS';
      }
    }
  }
  if(G.banner){G.banner.t+=dt;if(G.banner.t>3.2)G.banner=null;}
  if(G.lapFx){G.lapFx.t+=dt;if(G.lapFx.t>0.45)G.lapFx=null;}
  G.prevAngle=G.angle;
  G.sweep=G.speed*sdt;
  G.angle=(G.angle+G.dir*G.speed*sdt)%TAU;
  pushTrail();
  updateOrbMotion(rewardDt,sdt);
  currentWakeUpdate(pdt);
  /* the furnace sheds: a stream of sparks off the comet's tail, denser
     during the payoff, one in four ember-gold */
  if(!RM){
    G.sparkT-=dt;
    if(G.sparkT<=0){
      G.sparkT=rand(0.07,0.14)*(G.pay>0?0.5:1);
      G.sparkN=(G.sparkN||0)+1;
      const hx=Math.cos(G.angle+Math.PI/2*G.dir),hy=Math.sin(G.angle+Math.PI/2*G.dir);
      const sp2=posPlayer();
      G.parts.push({x:sp2[0]-hx*7*u,y:sp2[1]-hy*7*u,
        vx:-hx*rand(40,95)+rand(-30,30),vy:-hy*rand(40,95)+rand(-30,30),
        life:1,dec:rand(2.6,4.0),col:G.sparkN%4===3?COL.ember:'#bef4ff',
        size:rand(1,1.9)*u});
    }
    /* THE WHOLE WAKE BURNS, NOT JUST THE HEAD. The shed above fires from one
       point seven pixels behind the comet, which is right for an idle orbit
       and wrong for a hot one: the trail already reports the groove by
       tinting toward warp-violet, and at x6 it is a bright violet ribbon
       with sparks coming off one end of it. Above the halfway mark the
       ribbon itself starts throwing embers, picked at a random point along
       its length and pushed out along the local normal, so the thing that is
       reporting the streak is visibly the thing that is burning.
       Gated on the groove, capped hard, and dead under reduced motion — and
       it spends the DILATED delta, not the raw one, because a spark thrown
       by a ribbon has to thin out when the ribbon slows down. (The furnace
       above still meters on dt; its rate is tied to the comet's own heat
       rather than to how fast the world is running, and changing that is a
       separate argument from this one.) */
    G.wakeT-=sdt;
    /* THE STAR OPENS THE WAKE UNCONDITIONALLY. Ordinarily this is the groove's
       reward and waits for a chain of four; a hypernova is not a chain and a
       player who takes one from a cold start would otherwise get the biggest
       tail in the game with nothing coming off it. The star also raises the
       particle ceiling, because the ribbon it is shedding from is nearly twice
       as wide and half again as long. */
    const star=G.hyperGlow>0.02;
    if(!bhActive()&&(G.groove>=4||star)&&G.trail.length>6&&G.parts.length<(star?160:80)&&G.wakeT<=0){
      G.wakeT=rand(0.05,0.11)/(1+0.30*Math.max(0,G.groove-4)+(G.pay>0?1.4:0)+2.2*G.hyperGlow);
      const n=G.trail.length;
      /* never the last two samples: that is the head, and the furnace
         already owns it — two emitters on one point reads as one brighter
         emitter, which is not what this is for */
      const i=1+Math.floor(Math.random()*(n-3));
      const a=G.trail[i+1],b=G.trail[i-1];
      let tx=a.x-b.x,ty=a.y-b.y;
      const L=Math.sqrt(tx*tx+ty*ty)||1;
      tx/=L;ty/=L;
      const side=Math.random()<0.5?1:-1;
      const sp3=rand(14,42)*(1+0.12*(G.groove-4));
      G.parts.push({x:G.trail[i].x,y:G.trail[i].y,
        vx:-ty*side*sp3+tx*rand(-16,16),vy:tx*side*sp3+ty*rand(-16,16),
        life:Math.max(0.35,G.trail[i].life),dec:rand(2.2,3.4),
        /* the star's sparks are its own two colours, so the debris matches the
           ribbon it came off rather than reporting a groove nobody is on */
        col:star?(Math.random()<0.45?'#ffffff':(Math.random()<0.5?COL.hyper:COL.ember))
          :((G.pay>0||G.groove>=7)?'#ffffff':(Math.random()<0.35?COL.ember:COL.warp)),
        size:rand(0.8,1.6)*u});
    }
  }

  /* full orbit: 360 degrees of travel without reversing (hops allowed).
     Payout scales with the embers gathered during it, so a bare orbit is
     worth almost nothing and the two scoring systems feed each other. */
  G.lapAcc+=G.speed*sdt;
  /* THE TRICKLE UNDER THE JOURNEY. Orbits are how you travel — see
     ORB_PER_WORLD — but a player who is struggling must not be parked in one
     sky watching nothing change, so any play at all advances it, roughly
     twenty times slower than orbiting does. */
  G.skyW+=sdt/ORB_WORLD_SECS;
  if(G.lapAcc>=TAU){
    G.lapAcc-=TAU;
    const fed=G.lapEmbers>0;
    if(fed)G.lapStreak++;else G.lapStreak=0;
    G.orbits++;G.bestStreak=Math.max(G.bestStreak,G.lapStreak);
    /* THE ORBIT BUYS THE JOURNEY. Every lap counts toward it, fed or not:
       the payout already prices how well the lap was fed, and making the sky
       do it again would mean a player learning the mechanic gets no travel
       out of the laps they are learning it with. */
    G.skyW+=1/ORB_PER_WORLD;
    skyWake(G.lapStreak);
    /* THE ONE SENTENCE THE MECHANIC NEVER HAD. "many people have complained
       they didnt even know they were supposed to do orbits" — and until now
       nothing in the game said the word before the first payout popped, which
       at speed is suppressed. Fired on the first lap of the first run, soft,
       so it reads like a hint rather than stopping the world. It names only
       verbs the game has: going round, and turning back. */
    firstMeet('orbit');
    const base=6+13*Math.min(G.lapEmbers,LAP_EMB_MAX);
    const streakBonus=fed?Math.min(7*(G.lapStreak-1),28):0;
    const bonus=base+streakBonus;
    G.score+=bonus;G.scorePop=1;
    G.diff+=1;
    const lp=posPlayer();
    /* no \u00d7N here: the streak is not a multiplier (base+min(7\u00b7(streak-1),28),
       saturated at five) and the lap-streak HUD chip one slot down already
       documents that rule \u2014 the pips and the sky's winding carry the count */
    const label='ORBIT +'+bonus;
    if(fed){
      const st=G.lapStreak;
      /* everything below scales with the streak, so the payoff grows with
         the difficulty of having earned it */
      const k=Math.min(1,(st-1)/4);
      /* once laps take under ~2.4s the every-lap popup is wallpaper: at
         speed it only prints when it is NEWS (a streak building) */
      const milestone=st===3||st===5||(st>5&&st%5===0);
      if(st<=3||milestone)popup(lp[0],lp[1]-28*u,label,COL.ember,1+0.15*k);
      if(milestone&&!bhActive())ignite(G.ringI,G.angle,G.dir,st);
      if(!RM)burst(lp[0],lp[1],COL.ember,milestone?10:4,milestone?180:90);
      if(milestone)duckBed(0.7,0.20);
      /* the payout arpeggio walks up on sixteenths from the next grid point
         — the game's biggest scoring phrase finally plays in time */
      /* the game's biggest scoring phrase, as intervals over the tonic —
         it was a fixed C-major arpeggio, fully chromatic on levels 4 and 5 */
      if(milestone&&!bhActive())soundImpact('orbit',.8+.2*k);
      else{
        beep(CH[0][0]*(262/110),0.05,'triangle',0.05,CH[0][0]*(330/110));
        cueTone(function(w){
          beep(CH[0][0]*(262/110),0.12,'triangle',0.07,CH[0][0]*(392/110),w);
          beep(CH[0][0]*(392/110),0.12,'triangle',0.07,CH[0][0]*(523/110),w+S16);
          beep(CH[0][0]*(523/110),0.16,'triangle',0.07,CH[0][0]*(784/110),w+2*S16);
          if(st>=3)beep(CH[0][0]*(784/110),0.18,'triangle',0.05,CH[0][0]*(1046/110),w+3*S16);
        });
      }
      /* thresholds, not a floor: `st>=5` fired on every fed orbit past the
         fifth, which at mid-run speed is roughly every three seconds */
      /* was `st===5||st===9||st===14` — exact values, so past 14 it could
         never fire again; a player on a streak of 99 earned nothing from
         orbits after the first minute. The requirement now ESCALATES instead:
         5 laps, then 15, then 25. Laps are the passive route — you get them
         by not dying — so making each one dearer is what keeps the section
         special now that the cooldown no longer throws earnings away. */
      /* The gap GROWS each time. A fed orbit lands about every nine seconds,
         so a flat step meant a drop roughly every fourth orbit for the whole
         run and half the run turned into payoff. Growing the requirement is
         what keeps the section rare without the cooldown throwing earnings
         away: 4 orbits, then 9, then 16, then 25. */
      build(0.043,'orbit');
      if(milestone&&!bhActive()){
        /* Earned tier: the comet stops dead for a beat while the ring burns
           round. Short enough not to break the rhythm of a 2.5s orbit. */
        if(!RM)G.stop=Math.max(G.stop,0.035);
        /* the streak topper rides the same scheduled arpeggio above */
        gameHaptic('reward',18);
      }
    }else if(G.speed<2.6){
      popup(lp[0],lp[1]-26*u,label,'rgba(200,215,255,0.7)');
      cueTone(function(w){beep(CH[0][0]*(392/110),0.1,'triangle',0.04,CH[0][0]*(440/110),w);});
    }
    G.lapEmbers=0;G.didLap=true;
    checkMile();
  }
  G.comboT=Math.max(0,G.comboT-sdt);
  if(G.comboT<=0)G.combo=0;

  /* ARRIVAL RUNS ON REAL TIME INSIDE THE BLACK HOLE, and this is the one
     line that decides whether "double/triple the red obstacles" is true.
     spawnGap() is divided by bhDensity() (1.5->3.5), but the timer draining
     it ticked on sdt — the SLOWED clock — so the divide was spent paying for
     the slow motion instead of reaching the player. Real arrival rate was
     0.55*bhDensity(): 0.825x at entry, i.e. shards arriving LESS often than
     in ordinary play for the first 2.7 seconds of the mode, and never more
     than 1.925x at the very end. Both halves of the pitch were quietly
     cancelling: the mode ran slower AND emptier than the level it
     interrupted. BH.t already runs on real dt (bhTick is called with dt);
     the thing it drives now agrees with it about what a second is. */
  const bdt=BH.phase===2?dt:sdt;
  G.starT-=bdt;
  if(G.starT<=0&&!FIN.on&&!starfallActive()&&G.stars.length<emberCap()){spawnStar();G.starT=emberGap()*rand(0.75,1.4);}
  G.spikeT-=bdt;
  if(G.teach<=0&&!FIN.on&&!starfallActive()&&G.spikeT<=0&&age()>=firstShardAt()&&G.spikes.length<shardCap()){
    spawnSpike();
    G.spikeT=spawnGap()*rand(0.85,1.15);
  }
  G.powT-=sdt;
  /* "There are prob no other items given during black hole." Agreed, and for
     a reason worth stating: an orb in here is either a lifeline that undoes
     the difficulty the mode exists to create, or a musical orb whose whole
     effect is on an arrangement that is halted. Stars stay — they are the
     scoring, and the pitch wants the mode to be worth something. */
  if(G.powT<=0&&!FIN.on&&!starfallActive()&&!bhActive()&&G.pows.length===0&&dl()>=6){
    /* THE LAB REFILLS IN SECONDS, NOT TENS OF THEM. The one-orb-at-a-time gate
       above is kept — two on the board at once is not a thing the real game
       ever does, and a rig that shows you an arrangement the game cannot
       produce is testing the wrong object. So the frequency the lab promises
       is bought entirely on the refill: ~3s after one is taken instead of
       10-15. An orb declined still costs its 7s life first, which is also
       real. The black hole's own !bhActive() gate is the same line and needs
       no lab case: nothing spawns during the mode, and the next one is armed
       about three seconds after the horizon closes. */
    G.powT=spawnPow()?(LAB.on?rand(2.2,3.6):Math.max(6,rand(10,15)-dl()*0.02)):0.5;
  }

  const er=effRing();
  /* embers */
  for(let i=G.stars.length-1;i>=0;i--){
    const s=G.stars[i];
    if((s.trail||s.mag||s.starfall)&&bhActive())continue;
    updateMagnetStar(s,rewardDt);
    s.t+=(s.trail||s.mag||s.starfall)?rewardDt:sdt;
    if(s.t>s.life){G.stars.splice(i,1);continue;}
    if(starTouchesPlayer(s,er)){
      G.stars.splice(i,1);
      G.combo=Math.min(G.combo+1,6);G.comboT=CW;
      if(BH.phase===2)BH.score++;   /* what the escape bonus is scaled by */
      if(G.combo>G.bestCombo)G.bestCombo=G.combo;
      if(G.combo>=3)firstMeet('combo');   /* the multiplier names itself once */
      /* INNER-RING MULTIPLIER: during BH, stars on the orbit nearest the
         singularity are worth 2×. Risk/reward — it is the tightest ring,
         where a shard blocks the most degrees. Same verb (swipe in/out),
         higher stakes. The popup shows the multiplied value.

         THIS PAID ON THE WRONG RING, and it was the same "ring 0" confusion
         as the gravity pull: index 0 is the OUTERMOST orbit (RAD_BH[0] is
         1.0), so the bonus was doubling the safest, widest ring in the mode
         — and the pull was herding the player onto it at the same time. The
         two systems that exist to price risk both paid for avoiding it. */
      const bhInner=BH.phase===2&&s.ring===G.nRings-1;
      let paid=(bhInner?2:1)*G.combo+(s.trail?STAR_ROUTE_BONUS:0);
      G.score+=paid;G.diff+=1;G.scorePop=1;
      /* embers ride the section too: doubled (×2 more on a perfect landing) */
      if(starfallActive()&&!bhActive()){
        const ex=G.combo*(G.secMult||1);
        G.score+=ex;G.secScore+=ex;paid+=ex;
      }else if((!bhActive()&&(G.od>0||G.hyper>0))||G.shields>=shieldMax()){G.score+=G.combo;paid+=G.combo;}
      G.lapEmbers++;G.embers++;
      const p=starVisualPos(s);
      burst(p[0],p[1],COL.ember,14,150);
      ripple(p[0],p[1],COL.ember);
      arcFlash(s.a,s.ring,COL.ember);
      /* the popup pays what the score paid — EVERY branch of it now. The
         inner-ring fix taught the rule, and then the standing states kept
         breaking it: under spotlight/overdrive/hypernova/overcharge the
         score added 2x combo while this line printed the undoubled half,
         so the one number on screen hid exactly the doubling that three
         channels had promised.
         AND ONLY WHEN THE NUMBER IS NEWS. Measured on level 4: 302 popups in
         126 seconds, a '+12' printed 2.4 times a second, something popped on
         91% of frames — number confetti that buried the popups carrying
         information (SHIELD USED, LAST SHIELD, HORIZON). A steady combo at a
         steady state prints once; the value changing (a rung climbed, a
         state opened or closed, the inner-ring double) prints immediately,
         and a quiet 1.6s refresh keeps the channel visibly alive. The burst,
         ripple and arc flash above still mark every single pickup. */
      if(paid!==G.lastPopPaid||G.t-G.lastPopAt>1.6){
        G.lastPopPaid=paid;G.lastPopAt=G.t;
        popup(p[0],p[1]-20*u,'+'+paid,bhInner?COL.bh:COL.ember);
      }
      /* THE EMBER IS THE ARP'S NOTE NOW. It used to be a sine ding over the
         music; it plays the band's own square, chord-aware, through the bed
         bus — so it ducks, pans and mixes as part of the record, and a
         pickup is the arrangement gaining a note rather than a bell hitting
         it. The instant touch is a shaker grain; the tone lands on the
         sixteenth grid, so a chain of embers IS a fill run. */
      hat(AC?AC.currentTime:0,0.005,4800,0.03,0,0,7600);
      if(G.combo>=3)gameHaptic('pickup',6);
      const cb=G.combo,cpan=panAt(p[0]);
      const eco=[0,-1,1,0][MU?((MU.step/8)|0)%4:0];
      cueTone(function(w){
        /* THE PICKUP GIVES NOW (playtest: "way too twinkly"). The old voice
           pitched UP with the combo — thinner the better you played. This
           one stays low and gets HEAVIER: a fat detuned pluck with a sub
           octave underneath and a kick thump from x2, riding the dub delay.
           Weight, not sparkle, is the reward. */
        /* the pickup climbs the CHORD with the combo — root to fifth to the
           octave voicing — so a chain of stars is an arpeggio of the bar */
        const tt=AC.currentTime+w,f=chTone(1+Math.min(4,(cb>>1)+(eco>0?1:0)));
        if(cb>=2)kick(tt,0.020);
        if(MU&&MU.pay>0){
          /* THE PAYOFF MAKES YOU THE SOLOIST. During the section a pickup
             fires a three-note run up the scale on the player's own bus —
             collecting IS soloing, which is the biggest "music is the key"
             payoff in the game for the smallest rule. */
          const d0=Math.max(0,Math.min(7,3+(cb>>1)));
          note(PENT[d0],tt,0.14,'square',0.030,2200,cpan,A.perf);
          note(PENT[Math.min(9,d0+2)],tt+S16,0.13,'square',0.026,2400,cpan*0.5,A.perf);
          note(PENT[Math.min(9,d0+4)],tt+2*S16,0.16,'square',0.030,2600,-cpan,A.perf);
        }else if(G.tier>=T_VOICE[3]){
          /* the top rung: the stars are an electric guitar */
          gtr(f,tt,0.20,0.040+0.004*cb,cpan);
          note(f*0.5,tt,0.18,'sine',0.032+0.004*cb,520,cpan);
          if(cb>=3)gtr(f*2,tt+S16,0.14,0.020,-cpan);
        }else if(G.tier>=T_VOICE[2]){
          /* above BLINKERS: the sawtooth lead, with the sub underneath */
          note(f,tt,0.20,'sawtooth',0.036+0.005*cb,1500+260*cb,cpan,undefined,0.5);
          note(f*0.5,tt,0.18,'sine',0.032+0.004*cb,520,cpan);
          beep(f*0.94,0.05,'sawtooth',0.012,f,w,cpan,0.2);
        }else if(G.tier>=T_VOICE[1]){
          /* above THIRD RING: the detuned pair, grown a floor */
          note(f,tt,0.20,'square',0.038+0.005*cb,1300+240*cb,cpan,undefined,0.5);
          note(f*1.007,tt,0.20,'sawtooth',0.024,1100+240*cb,-cpan*0.5,undefined,0.4);
          note(f*0.5,tt,0.18,'sine',0.032+0.004*cb,520,cpan);
        }else{
          note(f,tt,0.20,'square',0.040+0.005*cb,1200+220*cb,cpan,undefined,0.5);
          note(f*1.005,tt,0.20,'sawtooth',0.017,900,cpan*0.5,undefined,0.4);
          note(f*0.5,tt,0.18,'sine',0.032+0.004*cb,500,cpan);
        }
        /* the chain's crown: a high answer only when the combo is maxing */
        if(cb>=4&&!(MU&&MU.pay>0))
          note(chTone(5),tt+S16,0.12,'square',0.022,1500,cpan);
      });
      build(0.008,'ember');
      checkMile();
    }
  }
  /* power-ups */
  for(let i=G.pows.length-1;i>=0;i--){
    const s=G.pows[i];s.t+=sdt;
    if(s.t>s.life){
      /* an unseen musical orb that expires unlessoned comes back: the
         level-2 guarantee is of the INTRODUCTION, not of one spawn roll —
         a 7s life can fall entirely inside another lesson's spacing */
      if(POW_LESSON[s.type]&&!G.seen[s.type])G[POW_LESSON[s.type]]=false;
      G.pows.splice(i,1);continue;
    }
    /* a musical orb's lesson keeps knocking while the orb exists: the one
       call at placement could hit a busy moment, defer, and the orb —
       guaranteed once per level-2 run — leave unexplained. firstMeet's own
       guards (seen, calm, spacing) make the retry free. */
    if(!G.seen[s.type]&&POW_LESSON[s.type])firstMeet(s.type);
    if(s.ring===er&&sweptHit(s.a,(22*u)/radiusOf(er))){
      const p=posAt(s.a,radiusOf(s.ring));
      G.pows.splice(i,1);
      /* using an orb IS the introduction — better than any sentence about
         it, and it stops a redundant lesson firing after the experience */
      /* AND NOT IN THE LAB — the second and less obvious of the two places a
         lesson gets spent. firstMeet's guard covers the sentence; this covers
         the shortcut beside it, where TAKING an orb counts as having been
         taught it. The lab hands you the same orb every few seconds, so the
         very first pickup of a black hole session would permanently retire the
         black hole's lesson, silently, on a device that has never met one in
         the real game. Found by the harness rather than by reading: one guard
         looked like the whole job and there were two. */
      if(!LAB.on&&POW_LESSON[s.type]&&!G.seen[s.type]){
        G.seen[s.type]=1;savePref('cometloop:seen',Object.keys(G.seen).join(','));
      }
      arcFlash(s.a,s.ring,
        s.type==='shield'?COL.shield:
        s.type==='warp'||s.type==='spot'?COL.warp:
        s.type==='hyper'?COL.hyper:
        s.type==='blackhole'?COL.bh:
        s.type==='mirror'?COL.mirror:s.type==='scorch'?COL.scorch:
        s.type==='slip'?COL.comet:s.type==='trail'?COL.ember:COL.nova);
      if(s.type==='shield'){
        const span=panAt(p[0]);
        G.gotShield=true;   /* the naming hint retires on first pickup */
        /* OVERCHARGE (playtester Buch, near-verbatim: "if you're at full
           shields... every next shield picked up is a big point bonus").
           A full bank means you have been playing CLEAN — that streak now
           pays: an overflow shield is worth +50, and while the bank stays
           full, embers and on-beat taps pay double (see those sites). */
        if(G.shields>=shieldMax()){
          G.score+=50;G.scorePop=Math.max(G.scorePop,0.7);
          popup(p[0],p[1]-20*u,'+50',COL.shield,1.2);
          cueTone(function(w){
            note(chTone(2),AC.currentTime+w,0.22,'triangle',0.030,2000,span);
            note(chTone(4),AC.currentTime+w+S16,0.24,'sine',0.020,2200,-span);
          });
        }else{
          G.shields++;
          /* a COUNT, not a multiplier: this says how many you now hold, and
             the pips under the arena say the same number. See the house
             style at COL — the cross is reserved for things that multiply. */
          popup(p[0],p[1]-20*u,'+1 SHIELD',COL.shield);
          if(G.shields>=shieldMax()){
            /* NOT "everything". Exactly one score source doubles on a full
               bank — the ember at the pickup above. The orbit, which is the
               largest payout in the game at up to 86, is paid with a bare
               G.score+=bonus, so a player who read "everything" watched
               ORBIT +86 print unchanged seconds later. */
            /* the sentence waits until red has been taught \u2014 announcing an
               economy nuance at 14s of a first-ever run, before the player
               knows what a shield is for, was the firehose's loudest line.
               The shimmer still marks the state; the line returns on the
               next fill once the red lesson has landed. */
            if(G.seen.single)say('Shields full: stars now score double',2,3);
            cueState(true);   /* overcharge opens \u2014 the rising shimmer */
          }
        }
        scenePulse('shield',1.5);
        burst(p[0],p[1],COL.shield,14,150);
        ripple(p[0],p[1],COL.shield);
        cueTone(function(w){beep(CH[0][0]*(520/110),0.12,'triangle',0.06,CH[0][0]*(780/110),w);});
      }else if(s.type==='blackhole'){
        G.gotBH=true;
        /* the full rarity clock is armed here, on the event, not back at
           placement — 55s from entry leaves the same ~38s of quiet after a
           17s mode that the original number was chosen for */
        G.bhCool=G.t+55;
        startBlackHole();
        if(!RM)G.stop=Math.max(G.stop,0.07);
        gameHaptic('impact',[18,40,60]);
      }else if(s.type==='warp'){
        G.slow=upgOn('slowworld')?9:6;G.slowD=G.slow;G.gotWarp=true;
        scenePulse('warp',3);
        say('Slow-mo: movement slows for '+Math.round(G.slow)+'s',3,3);
        burst(p[0],p[1],COL.warp,14,150);
        ripple(p[0],p[1],COL.warp);
        beep(400,0.3,'sine',0.07,150);
      }else if(s.type==='spot'){
        /* Keep spot/stagelight keys compatible with existing saves. */
        G.spot=upgOn('stagelight')?16:MAGNET_SECS;G.spotD=G.spot;G.gotSpot=true;
        scenePulse('spot',3);
        cueState(true);
        say('Magnet: nearby stars curve into you',3,3);
        burst(p[0],p[1],'#eaf1ff',20,220);
        ripple(p[0],p[1],COL.warp);
        cueTone(function(w){
          note(PENT[9],AC.currentTime+w,0.22,'sawtooth',0.028,3200,0.2,A.perf);
          note(PENT[11],AC.currentTime+w+S16,0.24,'sawtooth',0.026,3600,-0.2,A.perf);
        });
        gameHaptic('pickup',14);
      }else if(s.type==='mirror'){
        /* Sixteen beats, measured in the same unit as the star and the
           spotlight and lands on the grid rather than on a stopwatch */
        G.mirrorD=SPB*(upgOn('longmirror')?24:MIRROR_BEATS);G.mirror=G.mirrorD;G.gotMirror=true;
        scenePulse('mirror',2.5);
        /* it opens exactly opposite and then holds that relationship — the
           mirror is a reflection, not a chaser, so its angle is derived every
           frame rather than integrated */
        G.mirrorA=G.angle+Math.PI;
        say('Mirror: a second comet collects stars',3,3);
        burst(p[0],p[1],COL.mirror,18,220);
        ripple(p[0],p[1],COL.mirror);
        /* the level's own tonic and its fifth, sounded together and detuned a
           breath apart: one voice heard as two, which is the orb */
        cueTone(function(w){
          note(PENT[4],AC.currentTime+w,0.30,'square',0.026,3000,-0.28,A.perf);
          note(PENT[4]*1.004,AC.currentTime+w,0.30,'square',0.024,3000,0.28,A.perf);
          note(PENT[7],AC.currentTime+w+S16*2,0.26,'square',0.022,3400,0.2,A.perf);
        });
        gameHaptic('pickup',[16,26,16]);
      }else if(s.type==='scorch'){
        G.scorchD=upgOn('deepburn')?13:SCORCH_SECS;G.scorch=G.scorchD;G.gotScorch=true;
        scenePulse('scorch',2.5);
        say('Scorch: red behind you turns into stars',3,3);
        burst(p[0],p[1],COL.scorch,20,240);
        ripple(p[0],p[1],COL.scorch);
        cueTone(function(w){
          note(PENT[2],AC.currentTime+w,0.34,'sawtooth',0.028,1800,0,A.perf);
          note(PENT[0],AC.currentTime+w,0.40,'triangle',0.024,900,0.2,A.perf);
        });
        gameHaptic('pickup',[12,18,34]);
      }else if(s.type==='slip'){
        G.slipD=upgOn('longslip')?18:SLIP_SECS;G.slip=G.slipD;G.slipAt=G.t;G.gotSlip=true;
        scenePulse('slip',2.5);
        say('Slipstream: swipe rings to clear nearby red',3,3);
        burst(p[0],p[1],COL.comet,16,190);
        ripple(p[0],p[1],COL.comet);
        cueTone(function(w){note(PENT[4],AC.currentTime+w,0.18,'sine',0.03,2200,0);});
      }else if(s.type==='trail'){
        G.gotTrail=true;layStarTrail();scenePulse('trail',3);
        say('Star trail: collect the nine bonus stars',3,3);
        ripple(p[0],p[1],COL.ember);
        cueTone(function(w){for(let k=0;k<3;k++)note(PENT[4+k*2],AC.currentTime+w+k*S16,0.14,'triangle',0.026,2000,0);});
      }else if(s.type==='hyper'){
        /* HYPERNOVA (Hunter: "temporary invincibility... speed cranks up
           significantly... making beautiful music in the zone at hyper
           speed — that's the moment you're chasing"). Sixteen beats where
           nothing can touch you, the comet runs at nearly double speed,
           the kit rides sixteenths, and every red you plow through turns
           into a paying ember right on your lane. */
        G.hyperD=SPB*(upgOn('longstar')?24:16);G.hyper=G.hyperD;G.gotHyper=true;
        scenePulse('hyper',3);
        say('Hypernova: move faster, safe from red',3,3);
        burst(p[0],p[1],'#ffffff',22,280);
        burst(p[0],p[1],COL.ember,16,200);
        ripple(p[0],p[1],COL.ember);
        if(!RM){G.stop=Math.max(G.stop,0.06);G.shake=Math.max(G.shake,3);}
        soundImpact('hyper',1);
        gameHaptic('impact',[20,30,20,30,80]);
      }else{
        /* The front does the converting — see novaBlast/novaConvert. */
        G.gotNova=true;
        scenePulse('nova',2.4);
        novaBlast(p[0],p[1]);
        /* You are standing inside your own blast, so nothing may kill you
           while it sweeps. Dying mid-nova was always the wrong ending.
           Sized to the sweep: 0.7 covered the old 0.22s front with room to
           spare, but the front now takes ~0.65s to reach the far side of the
           ring system and the guarantee has to outlast it. */
        G.invuln=Math.max(G.invuln,G.t+0.95);
        say('Nova: red obstacles become stars',3,3);
        ripple(p[0],p[1],COL.nova);
        burst(p[0],p[1],COL.nova,34,320);
        burst(p[0],p[1],'#ffffff',14,190);
        if(!RM){
          /* longer than the orbit's 75ms — this is the rarest thing here and
             should outrank the routine celebration, not sit beneath it */
          G.stop=Math.max(G.stop,0.11);
          G.shake=Math.max(G.shake,3);
        }
        soundImpact('nova',1);
        gameHaptic('impact',[26,40,60]);
      }
    }
  }
  updateSpikes(sdt,true);
}

/* ---------- draw helpers ---------- */
/* Faceted game objects: material, bevel and light are baked at the current
   screen scale. Only transforms and a small specular glint run per object.
   Solid bodies retain the old contact-sized footprints; halos are light. */
const artifactBank={key:'',sprites:Object.create(null)};
const artifactMaterials={
  star:{faces:['#fff2a1','#ffe16c','#efa927','#b85d0c','#f5bd3e'],edge:'#fff6bc',dark:'#66340c',rgb:'255,187,55'},
  shield:{faces:['#b8ffe9','#49e7b3','#19b88b','#095644','#298b75'],edge:'#d8fff3',dark:'#063d33',rgb:'72,255,185'},
  warp:{faces:['#ecdaff','#b184ff','#7431d8','#311459','#7147ad'],edge:'#f1e5ff',dark:'#261045',rgb:'166,105,255'},
  nova:{faces:['#ffffff','#d7f1ff','#74adc6','#33456c','#839bdb'],edge:'#ffffff',dark:'#283751',rgb:'196,230,255'},
  spot:{faces:['#ffffff','#e8e0ff','#b39ae2','#4a356f','#9784c2'],edge:'#ffffff',dark:'#2c244f',rgb:'226,215,255'},
  hyper:{faces:['#fff1fc','#ff8ae2','#e735bb','#68134e','#b53394'],edge:'#ffecfb',dark:'#4c113f',rgb:'255,73,209'},
  mirror:{faces:['#e1f3ff','#71b7ff','#376bd9','#162d73','#426db3'],edge:'#e9f8ff',dark:'#112749',rgb:'87,158,255'},
  scorch:{faces:['#fff1bc','#ffc25d','#ee6822','#8c2710','#d77a29'],edge:'#fff7d5',dark:'#5f240e',rgb:'255,131,38'},
  slip:{faces:['#e4ffff','#78f2ff','#22b7d1','#105063','#218397'],edge:'#efffff',dark:'#0b3946',rgb:'73,226,255'},
  trail:{faces:['#fff9cf','#ffde7d','#e4a22e','#784518','#c68d35'],edge:'#fff8d5',dark:'#4e3519',rgb:'255,207,89'},
  hazard:{faces:['#ffb4c0','#f84162','#b9183c','#490d25','#891732'],edge:'#ffd4df',dark:'#260817',rgb:'255,53,87'}
};
function artifactPoly(g,pts){
  g.beginPath();g.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
  g.closePath();
}
function artifactStarPoints(r,inner,n){
  const pts=[];
  for(let i=0;i<n*2;i++){
    const a=-Math.PI/2+i*Math.PI/n,d=i%2?inner:r;
    pts.push([Math.cos(a)*d,Math.sin(a)*d]);
  }
  return pts;
}
function artifactGlow(g,m,r){
  const glow=g.createRadialGradient(0,0,2,0,0,r);
  glow.addColorStop(0,'rgba('+m.rgb+',0.42)');
  glow.addColorStop(0.36,'rgba('+m.rgb+',0.14)');
  glow.addColorStop(1,'rgba('+m.rgb+',0)');
  g.fillStyle=glow;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
}
function artifactFacet(g,pts,m,depth){
  /* One shaded extrusion and individually lit triangular faces. */
  g.save();g.translate(0,depth);artifactPoly(g,pts);
  g.fillStyle=m.dark;g.fill();g.restore();
  const hub=[-1.6,-2.2];
  for(let i=0;i<pts.length;i++){
    const p=pts[i],q=pts[(i+1)%pts.length];
    artifactPoly(g,[hub,p,q]);
    const a=Math.atan2((p[1]+q[1])/2,(p[0]+q[0])/2);
    const light=(Math.cos(a+2.2)+1)/2;
    g.fillStyle=m.faces[light>0.88?0:light>0.62?1:light>0.4?2:light>0.18?4:3];
    g.fill();
  }
  artifactPoly(g,pts);g.strokeStyle=m.faces[2];g.lineWidth=0.65;g.stroke();
  g.strokeStyle=m.edge;g.lineWidth=0.85;g.lineJoin='round';
  g.beginPath();g.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<Math.min(4,pts.length);i++)g.lineTo(pts[i][0],pts[i][1]);
  g.stroke();
}
function artifactGlyph(g,type,m){
  g.save();g.lineCap='round';g.lineJoin='round';
  g.strokeStyle=m.edge;g.fillStyle=m.edge;g.lineWidth=1.35;
  /* Dark inset keeps the functional glyph readable over its crystal face. */
  if(type!=='hyper'&&type!=='nova'){
    g.fillStyle='rgba(3,9,25,0.57)';
    artifactPoly(g,[[-5.9,-5.8],[5.9,-5.8],[6.4,4.6],[0,7],[-6.4,4.6]]);g.fill();
    g.fillStyle=m.edge;
  }
  if(type==='shield'){
    artifactPoly(g,[[-4.6,-4.8],[4.6,-4.8],[4.1,1.7],[0,5.7],[-4.1,1.7]]);g.stroke();
    g.beginPath();g.moveTo(0,-2.8);g.lineTo(0,2.8);g.moveTo(-2.5,0);g.lineTo(2.5,0);g.stroke();
  }else if(type==='warp'){
    g.beginPath();g.moveTo(-4.3,-4.7);g.lineTo(4.3,-4.7);g.lineTo(-3.5,4.7);
    g.lineTo(3.5,4.7);g.lineTo(-4.3,-4.7);g.stroke();
    artifactPoly(g,[[-2.7,3.3],[2.7,3.3],[0,0.5]]);g.fill();
  }else if(type==='spot'){
    /* Open horseshoe with bright poles: a literal magnet. */
    g.lineWidth=3.1;g.strokeStyle=m.faces[1];
    g.beginPath();g.moveTo(-3.8,-4.4);g.lineTo(-3.8,1);
    g.quadraticCurveTo(-3.8,5.1,0,5.1);g.quadraticCurveTo(3.8,5.1,3.8,1);
    g.lineTo(3.8,-4.4);g.stroke();
    g.strokeStyle='#ffffff';g.lineWidth=3.1;
    for(const d of [-1,1]){g.beginPath();g.moveTo(d*3.8,-4.4);g.lineTo(d*3.8,-1.8);g.stroke();}
    g.fillStyle='#ffe497';artifactPoly(g,artifactStarPoints(1.6,0.65,4));g.fill();
  }else if(type==='mirror'){
    for(const d of [-1,1]){
      artifactPoly(g,[[d*1.8,-4.8],[d*5,-3.5],[d*5,3.5],[d*1.8,4.8]]);g.fill();
    }
    g.globalAlpha=0.6;g.lineWidth=0.7;g.beginPath();g.moveTo(0,-6);g.lineTo(0,6);g.stroke();
  }else if(type==='scorch'){
    for(let i=0;i<3;i++){
      const yy=(i-1)*2.8;g.lineWidth=1.6-i*0.2;
      g.beginPath();g.moveTo(-5.5-i%2,yy);g.lineTo(i===1?1:0,yy);g.stroke();
    }
    artifactPoly(g,[[1,-4.5],[5.5,0],[1,4.5],[2,0]]);g.fill();
  }else if(type==='slip'){
    for(let i=0;i<2;i++){
      const xx=-3.3+i*5;
      g.beginPath();g.moveTo(xx-1.9,-4.1);g.lineTo(xx+1.9,0);g.lineTo(xx-1.9,4.1);g.stroke();
    }
  }else if(type==='trail'){
    const pts=[[-4.2,3.1],[0,-3.3],[4.2,3.1]];
    g.lineWidth=0.75;g.globalAlpha=0.55;artifactPoly(g,pts);g.stroke();g.globalAlpha=1;
    for(const p of pts){g.save();g.translate(p[0],p[1]);artifactPoly(g,artifactStarPoints(2.2,1,4));g.fill();g.restore();}
  }else if(type==='nova'){
    g.fillStyle='#ffffff';artifactPoly(g,artifactStarPoints(6.5,1.3,4));g.fill();
    g.globalAlpha=0.6;g.rotate(Math.PI/4);artifactPoly(g,artifactStarPoints(5,0.8,4));g.fill();
  }else if(type==='hyper'){
    artifactPoly(g,artifactStarPoints(5,2.25,5));g.fillStyle='#fff3fb';g.fill();
    artifactPoly(g,[[0,-2.8],[2,0],[0,2.4],[-2,0]]);g.fillStyle='#ff78d5';g.fill();
  }
  g.restore();
}
function artifactSprite(kind){
  const key=u+':'+DPR;
  if(artifactBank.key!==key){artifactBank.key=key;artifactBank.sprites=Object.create(null);}
  if(artifactBank.sprites[kind])return artifactBank.sprites[kind];
  const artKey={star:'star-gold',shard:'hazard-shard',drifter:'hazard-drifter',blinker:'hazard-blinker',
    shield:'power-shield',warp:'power-slow',nova:'power-nova',hyper:'power-hyper',mirror:'power-mirror',
    scorch:'power-scorch',slip:'power-slip',trail:'power-trail',blackhole:'power-blackhole'}[kind];
  const art=artKey&&host.getTexture?host.getTexture(artKey):null;
  if(art){
    const sp=makeSprite(34*u,function(g){
      const size=(kind==='star'?40:kind==='shard'||kind==='drifter'||kind==='blinker'?46:56)*u;
      g.drawImage(art,-size/2,-size/2,size,size);
    });
    artifactBank.sprites[kind]=sp;return sp;
  }
  const sp=makeSprite(34*u,function(g){
    g.scale(u,u);
    const danger=kind==='shard'||kind==='drifter'||kind==='blinker'||kind==='saucer';
    const m=artifactMaterials[danger?'hazard':kind]||artifactMaterials.nova;
    artifactGlow(g,m,kind==='star'?25:30);
    if(kind==='star'){
      artifactFacet(g,artifactStarPoints(9.1,4.05,5),m,1.05);
      artifactPoly(g,[[-1.6,-2.2],[0,-9.1],[1.2,-1.2],[0,2.3]]);
      g.fillStyle='#fff6b2';g.fill();
      return;
    }
    if(kind==='saucer'){
      artifactFacet(g,[[-10.8,0],[-5,-3.2],[0,-5.4],[5,-3.2],[10.8,0],[5.6,3.2],[-5.6,3.2]],m,1.4);
      artifactFacet(g,[[-4.2,-1],[0,-5.4],[4.2,-1],[0,1.2]],m,0.6);
      g.strokeStyle='#ffe1e7';g.lineWidth=0.8;
      g.beginPath();g.moveTo(-9,0);g.lineTo(-4.2,0.8);g.moveTo(4.2,0.8);g.lineTo(9,0);g.stroke();
      return;
    }
    if(danger){
      const pts=kind==='drifter'?[[10.6,0],[-5,-8.2],[-1.8,0],[-5,8.2]]
        :kind==='blinker'?[[0,-10.4],[7,-4],[10.4,0],[7,4],[0,10.4],[-7,4],[-10.4,0],[-7,-4]]
        :[[0,-10.6],[5.2,-3.2],[10.6,0],[3.7,6],[0,10.6],[-5.2,3.2],[-10.6,0],[-3.7,-6]];
      artifactFacet(g,pts,m,0.75);
      g.strokeStyle='#ffb5c5';g.lineWidth=0.8;
      g.beginPath();g.moveTo(pts[0][0],pts[0][1]);g.lineTo(-1.6,-2.2);g.lineTo(pts[2][0],pts[2][1]);g.stroke();
      if(kind==='blinker'){
        artifactPoly(g,[[0,-4.8],[3.2,0],[0,4.8],[-3.2,0]]);g.fillStyle='#ffe4e9';g.fill();
        g.fillStyle='#e42550';artifactPoly(g,[[0,-2.7],[1.4,0],[0,2.7],[-1.4,0]]);g.fill();
      }
      return;
    }
    let pts=[[-6.2,-9],[6.2,-9],[10.2,-2],[8,6.8],[0,10.5],[-8,6.8],[-10.2,-2]];
    if(kind==='shield')pts=[[-9.3,-8.4],[0,-10.2],[9.3,-8.4],[8.2,2.8],[0,10.5],[-8.2,2.8]];
    else if(kind==='warp')pts=[[-8.5,-10],[8.5,-10],[5.4,-3],[8.5,10],[-8.5,10],[-5.4,3]];
    else if(kind==='hyper')pts=artifactStarPoints(11,5.7,5);
    else if(kind==='nova')pts=artifactStarPoints(10.8,6,8);
    else if(kind==='slip')pts=[[-9,-8],[3.4,-8],[10.6,0],[3.4,8],[-9,8],[-5.6,0]];
    else if(kind==='scorch')pts=[[-9.4,-6.8],[2,-9.8],[10.4,0],[2,9.8],[-9.4,6.8],[-6.2,0]];
    else if(kind==='trail')pts=[[0,-10.8],[10.2,7.6],[0,6.3],[-10.2,7.6]];
    /* Broken energy casing leaves the solid object's edge unmistakable. */
    g.save();g.scale(1.23,1.23);artifactPoly(g,pts);
    g.globalAlpha=0.45;g.strokeStyle=m.faces[1];g.lineWidth=0.65;g.setLineDash([4.5,3.5]);g.stroke();g.restore();
    artifactFacet(g,pts,m,0.9);artifactGlyph(g,kind,m);
  });
  artifactBank.sprites[kind]=sp;return sp;
}
function artifactStar(x,y,s,al){
  const tilt=RM?0:Math.sin(s.t*1.1+s.a)*0.18;
  const pulse=1;
  ctx.save();ctx.globalCompositeOperation='source-over';
  blit(artifactSprite('star'),x,y,pulse,tilt,al);
  if(s.trail){
    ctx.globalAlpha=al*0.8;ctx.strokeStyle='#fff1b5';ctx.lineWidth=0.7*u;
    ctx.beginPath();ctx.moveTo(x-7*u,y+10*u);ctx.lineTo(x,y+12*u);ctx.lineTo(x+7*u,y+10*u);ctx.stroke();
  }
  rimLight(x,y,pulse,al*0.3);ctx.restore();
}
function artifactPower(x,y,s,al){
  const pulse=1;
  const tilt=RM?0:Math.sin(s.t*1.25)*0.075;
  ctx.save();ctx.globalCompositeOperation='source-over';
  blit(artifactSprite(s.type),x,y,pulse,tilt,al);
  rimLight(x,y,pulse*1.05,al*0.3);ctx.restore();
}
function artifactShard(x,y,s){
  const kind=s.blink&&!s.gate?'blinker':s.va&&!s.gate?'drifter':'shard';
  const solid=kind==='blinker'?'shard':kind;
  const rot=s.a+(kind==='drifter'?(s.va>0?Math.PI/2:-Math.PI/2):0);
  if(s.phase===1&&armed(s)){blit(artifactSprite(solid),x,y,1,rot,1);return;}
  if(s.phase===2){
    const k=Math.min(1,s.t/FADE);blit(artifactSprite(solid),x,y,1-k*0.4,rot,1-k);return;
  }
  const waking=s.phase===0;
  const k=Math.max(0,Math.min(1,waking?s.t/(s.warn||WARN)
    :(blinkPhase(s)-BLINK*duty(s))/(BLINK*(1-duty(s)))));
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  ctx.globalCompositeOperation='source-over';
  const r=(waking?8+2.6*k:10.4)*u,inner=r*(0.64-0.18*k);
  /* An open shutter stays visibly hollow until armed() actually closes it.
     Geometry counts down; opacity does not pulse or turn the hazard invisible. */
  ctx.globalAlpha=0.78;ctx.fillStyle='#854252';ctx.strokeStyle='#df8294';ctx.lineWidth=0.9*u;
  for(let q=0;q<4;q++){
    ctx.save();ctx.rotate(q*Math.PI/2);
    ctx.beginPath();ctx.moveTo(-r*0.22,-r);ctx.lineTo(r*0.22,-r);
    ctx.lineTo(r*0.48,-r*0.72);ctx.lineTo(r*0.30,-inner);
    ctx.lineTo(-r*0.30,-inner);ctx.lineTo(-r*0.48,-r*0.72);
    ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
function drawShardOutline(x,y,r,al,dash,core){
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);
  ctx.globalAlpha=al;
  ctx.strokeStyle=COL.shard;ctx.lineWidth=2.5;
  if(dash)ctx.setLineDash([4*u,3.5*u]);
  ctx.strokeRect(-r*0.7,-r*0.7,r*1.4,r*1.4);
  ctx.setLineDash([]);
  /* core grows with `core` (0..1): a dormant blinker is a watchable countdown */
  if(dash){const cs=(1.6+3.6*(core||0))*u;
    ctx.fillStyle=COL.shard;ctx.fillRect(-cs,-cs,cs*2,cs*2);}
  ctx.globalAlpha=1;ctx.restore();
}
/* The orbs blit their baked sprites — the glow was paid for in buildSprites,
   so this is the same layered finish the embers and shards get, at a fraction
   of what the live shadowBlur cost. Pulse and rotation ride blit()'s args;
   the cores are plain fills, kept out of the pulse so the centre holds still. */
/* One lamp, at the hub, and everything on the board takes its highlight from
   it. Falloff is written as a DISTANCE against the outermost radius, never as
   a ring ordinal: index 0 is the OUTERMOST orbit, so `1-ring/nRings` would
   light the board backwards and read as plausible in review. */
function rimLight(x,y,scale,al){
  if(!SPR.rim||!(al>0.004))return;
  const dx=x-cx,dy=y-cy,d=Math.sqrt(dx*dx+dy*dy);
  if(d<1)return;
  const R0=radiusOf(0)||1;
  const k=Math.max(0,Math.min(1,1.18-0.86*(d/R0)));
  if(k<=0.01)return;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  blit(SPR.rim,x,y,scale,Math.atan2(dy,dx),al*k);
  ctx.restore();
}
function drawPow(x,y,s,al){
  if(s.type==='blackhole'&&host.getTexture&&host.getTexture('power-blackhole')){artifactPower(x,y,s,al);return;}
  if(s.type!=='blackhole'){artifactPower(x,y,s,al);return;}
  const pulse=1;
    /* THE ONLY DARK OBJECT IN THE GAME. Everything else on the board emits;
       this one takes. Drawn as a hole rather than a ball: a flat black disc
       with a violet accretion ring leaning around it and a lensing halo that
       bends the wrong way — light going IN instead of out. It is the one orb
       a player should be able to identify before they can name it, because
       taking it is a decision and the pitch says it is optional. */
    ctx.save();
    const wob=RM?0:Math.sin(s.t*1.7)*0.25;
    ctx.globalAlpha=al;
    /* the lensing halo: drawn as a soft violet ring OUTSIDE the disc */
    if(!RM){
      const gl=ctx.createRadialGradient(x,y,2*u,x,y,12*u);
      gl.addColorStop(0,'rgba(143,92,255,0)');
      gl.addColorStop(0.55,'rgba(143,92,255,0.42)');
      gl.addColorStop(1,'rgba(143,92,255,0)');
      ctx.fillStyle=gl;ctx.beginPath();ctx.arc(x,y,12*u,0,TAU);ctx.fill();
    }
    /* the accretion ring, seen almost edge-on so it reads as a disc in space */
    ctx.translate(x,y);ctx.rotate(0.5+wob);
    ctx.strokeStyle=COL.bh;ctx.lineWidth=2.1*u;
    ctx.globalAlpha=al*0.95;
    ctx.beginPath();ctx.ellipse(0,0,8.4*u*pulse,2.9*u*pulse,0,0,TAU);ctx.stroke();
    ctx.globalAlpha=al*0.5;
    ctx.beginPath();ctx.ellipse(0,0,10.6*u*pulse,3.7*u*pulse,0,0,TAU);ctx.stroke();
    ctx.rotate(-(0.5+wob));
    /* the event horizon itself — nothing, and nothing is the point */
    ctx.globalAlpha=al;
    ctx.fillStyle='#05060d';
    ctx.beginPath();ctx.arc(0,0,4.4*u,0,TAU);ctx.fill();
    ctx.restore();
}
/* The old stack led with -apple-system, so on the device this actually ships
   to every word was San Francisco: the system UI face, which reads as a
   settings screen rather than a game. This leads with geometric sans instead —
   Avenir Next on iOS and macOS, Century Gothic or Trebuchet on Windows,
   Roboto on Android. Circular bowls and a high x-height suit a game made
   entirely of circles, and it costs nothing: every one of these ships with the
   OS, so there is still no font to download and no network call. */
const F='"Avenir Next","Avenir",Futura,"Century Gothic","Trebuchet MS",'+
        '"Segoe UI",Roboto,system-ui,sans-serif';
function text(str,x,y,size,weight,col,ls){
  ctx.fillStyle=col;
  ctx.font=weight+' '+Math.round(size)+'px '+F;
  try{ctx.letterSpacing=(ls||0)+'px';}catch(e){}
  ctx.fillText(str,x,y);
  try{ctx.letterSpacing='0px';}catch(e){}
}
/* NO LINE EVER RUNS OFF THE SCREEN (playtest: it did). Measure at the
   intended size and shrink to fit the given width — announcements, banner
   subs and card rows all pass through here, so a long sentence on a narrow
   phone gets smaller instead of getting cut. */
function fitSz(str,size,weight,maxW,ls){
  ctx.font=weight+' '+Math.round(size)+'px '+F;
  /* letterSpacing is a fixed per-character amount the draw adds AFTER this
     measurement (measureText sees none of it) — reserve it, and shrink only
     the glyph width, or a tracked line still overflows exactly as before */
  const sp=(ls||0)*str.length;
  const w=ctx.measureText(str).width+sp;
  if(w<=maxW)return size;
  return Math.max(8*u,size*Math.max(20,maxW-sp)/Math.max(1,w-sp));
}
/* Text has a clean lit face and one quiet shadow for contrast. Avoid several
   offset glow copies: they blurred instructions precisely when attention is scarce. */
function textFx(str,x,y,size,weight,c1,c2,glow,ls){
  ctx.save();
  ctx.font=weight+' '+Math.round(size)+'px '+F;
  try{ctx.letterSpacing=(ls||0)+'px';}catch(e){}
  ctx.fillStyle='rgba(2,5,12,0.72)';ctx.fillText(str,x,y+1.4*u);
  ctx.fillStyle=c1;ctx.fillText(str,x,y);
  ctx.restore();
  try{ctx.letterSpacing='0px';}catch(e){}
}

/* ---------- bloom ----------
   Screen-space bloom without ever reading back the main canvas. The obvious
   route — drawImage(cv) into a small buffer — measures ~16ms a frame, because
   pulling 1.3M pixels back out stalls the pipeline; having budget spare does
   not help when the single operation eats all of it.
   So the bright objects are re-drawn as crude blobs into a quarter-size
   buffer instead. Precision is pointless there: the upscale blurs it past
   recognition, and bilinear filtering on the way back up IS the blur.

   ONE BUFFER CAN ONLY CARRY ONE RADIUS. How far a pass blurs is fixed by how
   far it is upscaled, so the quarter-res buffer put the same tight collar on
   the hub lamp as on a spark: an ember's light was gone 15px out, the comet's
   at 22px, barely past the blob itself. Every other layer of light here is
   several passes at different weights — the trail is three, the gate bar two,
   the nova front three — and the bloom was the one that was a single flat
   blit. Light with no range reads as paint.
   THE HALO IS DRAWN, NOT DOWNSAMPLED, and that is the whole design. The
   obvious cheap route is a mip cascade: downsample the quarter-res buffer
   twice more and blit each level back. It was built that way first and
   measured, and it fails twice over. A box downsample preserves the peak of
   any feature bigger than a buffer pixel, so a solid blob keeps full
   brightness at every level and the passes simply SUM — the core came out 61%
   hotter while the halo barely moved, which is a brightness bug wearing a
   glow's clothes. Worse, a tiny buffer blown up 40x spreads through bilinear,
   and bilinear is a separable tent: the footprint is a cross, not a disc, and
   its shape depends on where the object happens to fall on the coarse grid.
   Sliding one ember across a single coarse pixel swung its halo by 80%. Every
   object in this game is in orbit, permanently crossing that grid, so that is
   a halo that crawls and breathes on nothing musical at all.
   Drawing the halo as REAL CIRCLES into a coarse buffer costs one more pair
   of arc+fills per dot and is round by construction — measured 0.97 to 1.09
   across the halo, and 17% ripple against the cascade's 80%. Two stacked
   discs, at 2x and 4x the dot's radius, give a falloff one flat disc has
   not. */
const BLOOM_DIV=4,BLOOM_ALPHA=0.28;
/* THE DIAL. Every number here was chosen against four measurements at once,
   and they pull against each other: reach, the core (embers must stay GOLD —
   washing them toward white spends the one colour that means "collect me"),
   roundness, and how much the whole thing hazes a dense late-game board,
   which is the contrast the calm pool exists to buy back. As set: ember core
   +4.8%, reach x3.6, median lift across a full board 0.026.
   REACH IS MEASURED TO 1/255 — the outermost radius whose light can still tint
   an 8-bit pixel — as the maximum over a full circle, in sub-pixel steps. The
   threshold has to be quoted or the number is not checkable, and stepping in
   whole pixels off one ray is how the first cut of this comment ended up
   claiming a before-gap of 4px between the ember and the comet when their
   discs differ by 7u: two objects through the same filter chain cannot differ
   in reach by less than their radii do. On a 390x844 phone: ember 15px -> 54px,
   comet 22px -> 78px, and the ratio holds 3.44 to 3.74 across viewports.
   Mutable at runtime, so `HALO_A=0.14` in the console re-weights it on the next
   frame — the last word on how much glow is too much belongs to eyes on a real
   screen, not to this table. */
const HALO_DIV=12,HALO_WDIV=32;      /* the halo buffer, and its wide sibling */
const HALO_K1=2.0,HALO_W1=0.50;      /* inner disc: radius multiple, weight */
const HALO_K2=4.0,HALO_W2=0.20;      /* outer disc */
let HALO_A=0.09,HALO_WA=0.06;        /* composite alphas */
let bloomC=null,bloomG=null,haloC=null,haloG=null,haloWC=null,haloWG=null;
/* One call site, three discs: the tight blob every caller already asked for,
   and the two that build its halo. Guarded on haloG so the tight pass still
   stands alone if the halo buffers never came up. */
/* set once per frame by drawBloom, BEFORE the dot loop: false means the GPU
   is building the halo out of the tight buffer and the two discs per light
   are dead weight. Decided once rather than per dot so a mid-frame GL
   failure can never leave half the lights haloed and half not. */
let bloomHalo=true;
function bloomDot(g,x,y,r,col){
  g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
  if(!haloG||!bloomHalo)return;
  haloG.fillStyle=col;
  haloG.globalAlpha=HALO_W1*g.globalAlpha;
  haloG.beginPath();haloG.arc(x,y,r*HALO_K1,0,TAU);haloG.fill();
  haloG.globalAlpha=HALO_W2*g.globalAlpha;
  haloG.beginPath();haloG.arc(x,y,r*HALO_K2,0,TAU);haloG.fill();
}
function drawBloom(){
  if(!bloomC){bloomC=document.createElement('canvas');bloomG=bloomC.getContext('2d');}
  if(!haloC){
    haloC=document.createElement('canvas');haloG=haloC.getContext('2d');
    haloWC=document.createElement('canvas');haloWG=haloWC.getContext('2d');
  }
  bloomHalo=!FX.on;
  const bw=Math.max(1,Math.ceil(W/BLOOM_DIV)),bh=Math.max(1,Math.ceil(H/BLOOM_DIV));
  if(bloomC.width!==bw||bloomC.height!==bh){bloomC.width=bw;bloomC.height=bh;}
  /* the halo buffer has to be cleared and put in world coordinates BEFORE the
     dot loop below, because bloomDot writes into it as it goes */
  const hw=Math.max(1,Math.ceil(W/HALO_DIV)),hh=Math.max(1,Math.ceil(H/HALO_DIV));
  if(bloomHalo){
    if(haloC.width!==hw||haloC.height!==hh){haloC.width=hw;haloC.height=hh;}
    haloG.setTransform(1,0,0,1,0,0);
    haloG.clearRect(0,0,hw,hh);
    haloG.setTransform(1/HALO_DIV,0,0,1/HALO_DIV,0,0);
    haloG.globalCompositeOperation='lighter';
  }
  const g=bloomG,s=1/BLOOM_DIV;
  g.setTransform(1,0,0,1,0,0);
  g.clearRect(0,0,bw,bh);
  g.setTransform(s,0,0,s,0,0);
  g.globalCompositeOperation='lighter';
  for(const st of G.stars){
    if(st.flight&&st.t<st.flight.delay)continue;
    const p=starVisualPos(st);
    g.globalAlpha=Math.min(1,st.t/0.45,Math.max(0,(st.life-st.t)/0.65));
    bloomDot(g,p[0],p[1],8*u,COL.ember);
  }
  g.globalAlpha=1;
  for(const sp of G.spikes){
    // Shutters communicate danger with their shape, never a toggled halo.
    if(sp.blink||sp.phase!==1||!armed(sp))continue;
    const p=posAt(sp.a,radiusOf(sp.ring));
    g.globalAlpha=Math.min(1,sp.t/0.6);
    bloomDot(g,p[0],p[1],7*u,COL.shard);
  }
  g.globalAlpha=1;
  if(FIN.on)for(const ts of FIN.trail){
    if(ts.got)continue;
    const p=posAt(ts.a,radiusOf(ts.ring));
    bloomDot(g,p[0],p[1],12*u,COL.ember);
  }
  for(const pw of G.pows){
    if(pw.type==='blackhole')continue;
    const p=posAt(pw.a,radiusOf(pw.ring));
    bloomDot(g,p[0],p[1],10*u,
      pw.type==='shield'?COL.shield:
      pw.type==='warp'||pw.type==='spot'?COL.warp:
      pw.type==='hyper'?COL.hyper:
      pw.type==='slip'?COL.comet:
      pw.type==='trail'?COL.ember:
      pw.type==='mirror'?COL.mirror:
      pw.type==='scorch'?COL.scorch:COL.nova);
  }
  // Debris has its own silhouette; adding every fragment to bloom turned
  // one collision into an area-wide light burst.
  if(G.state!=='dead'){
    const p=posPlayer();
    bloomDot(g,p[0],p[1],10*u,'#7ce9ff');
  }
  /* The small steady hub light gradually disappears into the black hole. */
  const hubLamp=1-Math.min(1,BH.warp);
  if(hubLamp>0.004)bloomDot(g,cx,cy,7*u*hubLamp,'#9db9ff');
  g.setTransform(1,0,0,1,0,0);
  /* THE GPU PATH, when it is up: two gaussian levels and the lens, off the
     buffer that was just filled. It can fail on this very frame (a lost
     context, a driver refusing a framebuffer), and then this frame has no
     halo at all — because bloomHalo was decided before the dot loop and the
     discs were never drawn. One frame of a slightly thinner glow on the way
     into a permanent fallback is the right trade for never drawing both. */
  const fxOK=bloomHalo?false:fxRender(bloomC,bw,bh);
  if(bloomHalo){
    /* The widest reach comes free: one downsample of the halo buffer that is
       already drawn. Smoothing has to be asserted every frame, because assigning
       width RESETS the context and a downscale with it off is a point sample
       that discards fifteen pixels in sixteen. */
    haloG.setTransform(1,0,0,1,0,0);
    haloG.globalAlpha=1;
    const ww=Math.max(1,Math.ceil(W/HALO_WDIV)),wh=Math.max(1,Math.ceil(H/HALO_WDIV));
    if(haloWC.width!==ww||haloWC.height!==wh){haloWC.width=ww;haloWC.height=wh;}
    haloWG.imageSmoothingEnabled=true;
    haloWG.clearRect(0,0,ww,wh);
    haloWG.drawImage(haloC,0,0,ww,wh);
  }
  ctx.save();
  /* THE GLOW WAS COMPOSITED IN A DIFFERENT COORDINATE SPACE FROM ITS SOURCE.
     The bright pass above draws every light with `setTransform(s,0,0,s,0,0)`
     — a pure scale, no camera dolly. This composite runs inside the world
     pass, which is wrapped in `ctx.translate(camX,camY)`. So the whole glow
     layer landed offset from the lights it was made of by exactly the dolly,
     every frame, oscillating on a sine (`camX=sin(amb*0.16)*3*u`).
     Two visible defects out of that one mismatch, and both were reported:
       - every halo drifts a few pixels off its own light and back, forever,
         which reads as the scene never quite settling. Field report: "it's
         like you put a layer over the screen ... everything just kind of
         wobbles around."
       - the full-screen layer is shifted past the frame boundary, so the
         drawImage upscale clamps and smears the outermost texel into a
         hairline rim. Measured on the 2D layer alone, left device columns
         0/1/2 against an interior of 3.6: 5.0/4.4/3.5 before.
     This is the detached-glow failure class the invariants already record
     once, in a worse form: there the halo's bound was wrong, here the halo
     is in the wrong space entirely. Resetting to the base transform puts the
     composite exactly where the bright pass put its source. The halo
     fallback below is drawn the same way for the same reason — `haloG` also
     sets a pure scale with no dolly. */
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.globalCompositeOperation='lighter';
  /* Fixed light budget. Music changes motion and orchestration, never the
     gain of every object on screen at once. */
  /* Additive, so the order buys nothing mathematically; widest first because
     that is the order the light is built in and the one a reader expects. */
  if(fxOK){
    ctx.globalAlpha=FX_A;
    ctx.drawImage(FX.cv,0,0,W,H);
  }else if(bloomHalo){
    ctx.globalAlpha=HALO_WA;
    ctx.drawImage(haloWC,0,0,W,H);
    ctx.globalAlpha=HALO_A;
    ctx.drawImage(haloC,0,0,W,H);
  }
  ctx.globalAlpha=BLOOM_ALPHA;
  ctx.drawImage(bloomC,0,0,W,H);
  ctx.restore();
}

/* The comet lights the track it is riding: a short arc centred on it, falling
   off both ways. Decorative, but it also makes "which ring am I on" readable
   at a glance without looking away from the comet. */
const RING_LIT=[[0.62,0.030,7],[0.40,0.048,4.5],[0.22,0.078,2.6],[0.10,0.105,1.6]];
function drawRingGlow(){
  const rr=curR();
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  /* the lit track takes its own colour, so the light under the comet says
     which ring you are on as plainly as the arrangement does */
  ctx.strokeStyle='rgb('+RINGS[Math.min(RINGS.length-1,effRing())].tint+')';
  for(const L of RING_LIT){
    ctx.globalAlpha=L[1];
    ctx.lineWidth=L[2]*u;
    ctx.beginPath();ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,G.angle-L[0],G.angle+L[0]);ctx.stroke();
  }
  ctx.restore();
}
/* THE AFTER-IMAGE. Slow motion reaches the whole visible world now — the
   sky, the dolly, the debris, the ribbon all ride G.vt — and the result is
   correct and strangely undersold, because everything slowing down together
   looks a great deal like nothing happening. What reads as slow motion, in
   every medium that has ever had to sell it, is one thing SMEARING against
   another: a second image of the moving object, lagging where it has been.
   So the ribbon is drawn twice while time is dilated. The ghost is the same
   ribbon minus its most recent samples, so its head sits where the comet was
   a moment ago, wider and dimmer and in warp violet — the mode's own colour,
   the one the slow-mo vignette is already tinted with. It is drawn FIRST, so
   the live cyan ribbon lies on top of its own past.
   Costs nothing when time is running: the whole pass is behind the same
   G.tsCur test the vignette uses, and never runs under reduced motion. */
function tailRibbon(n,am,ghost){
  if(n<4)return;
  const nx=new Array(n),ny=new Array(n),bw=new Array(n);
  for(let i=0;i<n;i++){
    const p=G.trail[i];
    const a=G.trail[i+1<n?i+1:n-1],b=G.trail[i>0?i-1:0];
    let tx=a.x-b.x,ty=a.y-b.y;
    const L=Math.sqrt(tx*tx+ty*ty);
    if(L<1e-4){tx=1;ty=0;}else{tx/=L;ty/=L;}
    nx[i]=-ty;ny[i]=tx;
    /* width tapers by both age and position, so the head stays fat.
       THE STAR WIDENS THE WHOLE RIBBON. G.hyperGlow rather than G.hyper, so
       it arrives and leaves on the same envelope the corona does instead of
       snapping on with the timer. */
    bw[i]=8*u*Math.pow(Math.max(p.life,0),0.7)*(0.16+0.84*i/(n-1))
      *(1+(RM?0:0.85*G.hyperGlow));
  }
  /* Width, alpha, colour. The narrow pass runs near-white so the ribbon goes
     hot at its centre and cools outward, the way anything incandescent does.
     THE TRAIL IS THE GROOVE'S SCOREBOARD: as the chain climbs, the ribbon
     tints from comet-cyan toward warp-violet, and during the payoff it runs
     white-hot — the player's own wake reports how in-time they are. */
  /* the pocket completes it: 0.7 was the chain's ceiling, and the last 0.3
     — payoff-grade — belongs to actually holding the top */
  const gm=G.pay>0?1:Math.min(1,G.groove/8*0.7+0.3*G.pocket);
  const mix=function(a,b){
    return 'rgb('+Math.round(a[0]+(b[0]-a[0])*gm)+','+
      Math.round(a[1]+(b[1]-a[1])*gm)+','+Math.round(a[2]+(b[2]-a[2])*gm)+')';
  };
  /* the ghost is two passes, not three: it is an after-image, and giving it
     the hot white core the live ribbon has would make it read as a second
     comet rather than as the first one's past */
  /* Hypernova widens and recolors the same ribbon gradually. Its three
     passes keep their light budget as the width increases; there is no
     second white core or abrupt switch to a brighter rendering stack. */
  const hg=RM||bhActive()?0:G.hyperGlow;
  const hmix=function(base,star){
    return 'rgb('+Math.round(base[0]+(star[0]-base[0])*hg)+','+
      Math.round(base[1]+(star[1]-base[1])*hg)+','+
      Math.round(base[2]+(star[2]-base[2])*hg)+')';
  };
  const passes=ghost?[
    [3.0,0.055,'rgb(150,110,240)'],
    [1.5,0.10,'rgb(196,166,255)']]:[
    [3.1,0.055,mix([68,202,255],[150,108,255])],
    [1.25,0.20,hmix([93,210,225],[218,137,199])],
    [0.40,0.54,hmix([169,223,226],[224,193,186])]];
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  for(let k=0;k<passes.length;k++){
    const m=passes[k][0];
    ctx.globalAlpha=passes[k][1]*am/(1+0.85*hg);
    ctx.fillStyle=passes[k][2];
    ctx.beginPath();
    for(let i=0;i<n;i++){
      const p=G.trail[i],w=bw[i]*m;
      const X=p.x+nx[i]*w,Y=p.y+ny[i]*w;
      if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);
    }
    for(let i=n-1;i>=0;i--){
      const p=G.trail[i],w=bw[i]*m;
      ctx.lineTo(p.x-nx[i]*w,p.y-ny[i]*w);
    }
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
function drawTail(){
  const n=G.trail.length;
  if(n<4)return;
  if(!RM&&G.tsCur<0.98){
    /* how far behind the ghost sits scales with how deep the dilation is:
       barely at 0.98, about nine samples at the 0.42 floor. Clamped so the
       ghost always keeps enough of the ribbon to still be one. */
    const lag=Math.max(2,Math.min(n-4,Math.round(9*(1-G.tsCur)/0.58)));
    tailRibbon(n-lag,Math.min(1,(1-G.tsCur)/0.30),true);
  }
  tailRibbon(n,1,false);
  if(!RM){
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    const hg=bhActive()?0:Math.min(1,G.hyperGlow||0);
    for(let side=-1;side<=1;side+=2){
      ctx.strokeStyle=hg>0.1?'#ffb4dc':'#6ee7ff';ctx.lineWidth=(0.7+hg*0.5)*u;ctx.globalAlpha=0.30+hg*0.2;
      ctx.beginPath();
      for(let i=1;i<n;i++){
        const p=G.trail[i],a=G.trail[i-1],dx=p.x-a.x,dy=p.y-a.y,len=Math.max(0.1,Math.hypot(dx,dy));
        const k=i/(n-1),wave=Math.sin(k*18-G.vt*9+side)*1.4;
        const off=side*(3.5+wave)*(1-k)*Math.sin(k*Math.PI)*u*(1+hg);
        const x=p.x-dy/len*off,y=p.y+dx/len*off;
        if(i===1)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* A continuous musical phase marker with fixed light and no catch flash. */
function beatPhase(){
  if(!AC||!MU||!MU.next||AC.state!=='running'||G.state!=='playing')return -1;
  /* MU.next is the next UNSCHEDULED eighth and sits ahead of now by the
     lookahead, so the quarter boundary is derived from it, not subtracted. */
  const q=MU.next+((MU.step%2)?SPB/2:0);
  let d=(q-AC.currentTime)%SPB;if(d<0)d+=SPB;
  return 1-d/SPB;
}
function drawBeat(p){
  if(bhActive())return;
  const ph=beatPhase();if(ph<0)return;
  // A continuously orbiting tick gives music a physical clock. Its opacity,
  // width and radius stay fixed, including at the quarter-note wrap.
  ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.strokeStyle='#90aebc';ctx.globalAlpha=0.4;ctx.lineWidth=1.2*u;
  const a=RM?-Math.PI/2:ph*TAU-Math.PI/2;
  ctx.beginPath();ctx.arc(p[0],p[1],17*u,a,a+0.45);ctx.stroke();
  ctx.restore();
}
/* ---------- draw ---------- */
/* WHERE THE MUSIC IS, CONTINUOUSLY. Returns the position inside the four-bar
   phrase in eighths (0..STEPS) as a float that advances smoothly, so the sky
   can be driven by musical PHASE instead of by beat impulses.
   The audio clock schedules ahead of the speaker, so MU.step is the next step
   to be queued and MU.next is when it fires: the sound a player is hearing
   right now is that far behind. Subtracting the lead-in gives the audible
   position, and it stays continuous across a step boundary because MU.step
   gains 1 at the same instant the lead-in does.
   With no audio clock — muted tab, no WebAudio, the menu — it free-runs on
   wall time at the same tempo. That is deliberate and load-bearing: a large
   share of web players play with the sound off, and they should still see a
   world that breathes in time rather than a dead one. */
function musPos(){
  const sd=SPB/2;
  if(A&&AC&&MU&&MU.next&&AC.state==='running'&&G.state==='playing'){
    const lead=(MU.next-AC.currentTime)/sd;
    return ((MU.step-lead)%STEPS+STEPS)%STEPS;
  }
  return (G.t/sd)%STEPS;
}

/* A planetary vista: shaded procedural globe, atmospheric scattering,
   occluded dust rings and a deep cloud field. Events ignite the existing
   materials. The arena owns gameplay objects and the singularity silhouette. */
const GL_SCALE=1.0;                /* fixed quality; no performance downgrade */
const GL_MOTION=1.0;               /* seconds of visible, differential sky flow */
const GL={on:false,g:null,pr:null,u:{},cv:null,vw:0,vh:0,tw:0,flowVt:null,stream:0,currentDir:1,art:[]};
const GL_FS=`precision highp float;
uniform vec2 uRes,uCtr;
uniform float uTime,uCalm,uFlightMode;
uniform vec4 uArc,uShape,uAccent,uPlanet,uSurface;
uniform vec3 uTint,uRim,uDust,uEventTint,uArena,uArt,uLive;
uniform vec4 uCurrent,uPowerFlow;
uniform vec2 uFlight,uRelease;
uniform sampler2D uNebulaMap,uPlanetMap,uRingMap;
/* Planet: centre, radius, ring tilt. Surface: ring inclination, terrain,
   cloud cover, sun angle. The globe, rings and atmosphere share one light. */
float hash21(vec2 p){
  p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);
  return fract(p.x*p.y);
}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);vec2 q=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),q.x),
             mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),q.x),q.y);
}
float cloud(vec2 p){
  float v=0.0,a=0.53;
  for(int i=0;i<5;i++){
    v+=noise2(p)*a;p=mat2(1.64,-1.18,1.18,1.64)*p+vec2(3.7,8.2);a*=0.48;
  }
  return v;
}
vec2 turn(vec2 p,float a){
  float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
}
/* Material changes redistribute the existing light; an event is never a
   multiplier on illumination. A dark part of the cloud remains dark. */
vec3 materialHue(vec3 base,vec3 hue,float amount){
  vec3 weights=vec3(0.299,0.587,0.114);
  vec3 recolored=hue*dot(base,weights)/max(0.001,dot(hue,weights));
  return mix(base,recolored,clamp(amount,0.0,1.0));
}
vec3 belt(vec2 p,vec3 light,float amp,out float opacity,out float front){
  vec2 q=turn(p,-uPlanet.w-sin(uTime*0.16)*0.035-uLive.x*0.024-amp*0.10);
  float r=length(vec2(q.x,q.y/uSurface.x))/(uPlanet.z*(1.0+uLive.z*0.035+amp*0.075));
  float ring=smoothstep(1.16,1.25,r)*(1.0-smoothstep(1.88,2.13,r));
  float angle=atan(q.y/uSurface.x,q.x);
  float lanes=0.50+0.19*sin(r*108.0+sin(angle*3.0-uTime*0.7)*1.8)+0.11*sin(r*249.0-uTime*0.35)+0.10*sin(r*47.0);
  float gap=1.0-0.80*exp(-pow((r-1.62)/0.033,2.0));
  float haze=exp(-pow((r-1.63)/0.38,2.0));
  float lit=0.54+0.46*cos(angle-uSurface.w);
  opacity=ring*(0.38+0.53*lanes)*gap;
  front=step(q.y,0.0);
  vec3 mineral=mix(uDust,uRim,0.58+lanes*0.30);
  if(uArt.z>0.5){
    vec2 atlas=turn(vec2(q.x,q.y/uSurface.x)/(uPlanet.z*4.85),uLive.y*0.075);
    vec4 paint=texture2D(uRingMap,atlas+0.5);
    float lum=dot(paint.rgb,vec3(0.25,0.55,0.20));
    mineral=mix(mineral,mix(uDust,uRim,clamp(lum,0.0,1.0))*1.4,paint.a*0.42);
    lanes*=0.70+lum*0.65;
  }
  return mineral*(ring*(0.34+lanes*0.56)*gap+haze*0.06)*(0.42+lit*0.72);
}
void main(){
  vec2 raw=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  float amp=uAccent.x;
  float blackhole=step(3.5,uAccent.y)*(1.0-step(4.5,uAccent.y));
  float fire=max(amp,uPowerFlow.z*0.65)*(1.0-blackhole);
  float hyper=step(2.5,uAccent.y)*(1.0-step(3.5,uAccent.y))*fire;
  vec2 ar=raw-uCtr;ar.y/=max(0.2,uArena.z);
  float rr=length(ar);
  /* A smooth radial remap bends the existing sky during a singularity.
     There is no angular seam, full-frame rotation or independent glare wedge. */
  float pressure=fire*exp(-rr*2.3)*0.022;
  float releaseRadius=mod(max(0.0,uRelease.x),max(0.1,uRelease.y))*0.38;
  float releasePhase=mod(max(0.0,uRelease.x),max(0.1,uRelease.y))/max(0.1,uRelease.y);
  float fromPlanet=length(raw-uPlanet.xy);
  float releaseWave=exp(-pow((fromPlanet-releaseRadius)/0.048,2.0))*
    exp(-releaseRadius*1.25)*step(0.0,uRelease.x)*(1.0-blackhole)*
    smoothstep(0.0,0.12,releasePhase)*(1.0-smoothstep(0.75,1.0,releasePhase));
  float lens=1.0+blackhole*amp*0.36*exp(-rr*3.0)/(rr+0.17)+pressure;
  vec2 uv=uCtr+turn((raw-uCtr)*lens,blackhole*amp*0.34*exp(-rr*3.0));
  uv+=(raw-uPlanet.xy)/max(fromPlanet,0.05)*releaseWave*0.035;
  /* Real flight pushes the local volume. Reversal steers a curl, a hop
     sends a radial displacement, and Magnet draws matter toward the comet. */
  vec2 fromComet=uv-uFlight;
  float influence=exp(-dot(fromComet,fromComet)*12.0)*(1.0-blackhole);
  uv=uFlight+turn(fromComet,uCurrent.x*uCurrent.w*0.16*influence);
  uv+=fromComet*influence*uPowerFlow.x*0.22;
  uv+=(raw-uCtr)/max(rr,0.05)*uCurrent.y*uCurrent.z*0.038*influence;
  vec2 drift=vec2(sin(uTime*0.14)*0.014,cos(uTime*0.11)*0.009);
  vec2 nq=turn(uv-uArc.xy-drift,uArc.z);
  vec2 flow=vec2(uLive.y*0.043,-uTime*0.028);
  vec2 warp=vec2(cloud(nq*3.1+2.7+flow),cloud(nq*3.1+8.3-flow*0.73));
  float grain=cloud(nq*9.2+warp*3.0+flow*1.6);
  float vein=cloud(nq*22.0+warp*5.0-flow*2.3);
  float across=nq.x-uShape.x*(nq.y*nq.y-0.12)+(warp.x-0.5)*0.25;
  float structure=exp(-pow(across/uArc.w,2.0)*0.62-nq.y*nq.y/(uShape.y*uShape.y));
  float cloudLight=pow(max(0.0,grain-0.24)*1.6,2.0)*structure*uShape.w;
  float crevice=smoothstep(0.30,0.66,vein);
  vec3 mist=mix(uDust,uTint,clamp(grain*1.25,0.0,1.0));
  vec3 col=vec3(0.008,0.012,0.027)+uTint*0.009;
  col+=mist*cloudLight*(0.52+crevice*1.06);
  col+=uRim*pow(max(0.0,grain-0.50)*3.0,2.0)*structure*0.44;
  if(uFlightMode>0.5){
  /* A continuous volume surrounds the flight axis. Reciprocal ray depth
     makes its broad clouds expand toward us instead of sliding over glass.
     Sample the circular direction directly: there is no polar seam, camera
     roll or bright series of hoops. Near dust belongs to the flight mesh. */
  vec2 ray=uv-uCtr;
  ray.y/=max(0.2,uArena.z);
  float rayRadius=length(ray);
  vec2 rayDirection=ray/max(rayRadius,0.025);
  float rayDepth=0.32/max(rayRadius,0.075);
  float passage=uTime*0.085;
  vec2 volumePoint=vec2(rayDirection.x*2.7+rayDirection.y*1.3,
    rayDepth*1.65-passage);
  volumePoint.x+=sin(rayDepth*0.8+uLive.y*0.035)*0.24;
  float volume=noise2(volumePoint)*0.65+
    noise2(volumePoint*2.1+vec2(5.3,1.7))*0.35;
  float shoulder=smoothstep(uArena.x*0.86,uArena.x+0.14,rr);
  float distanceHaze=exp(-rayDepth*0.22);
  float folds=smoothstep(0.34,0.78,volume)*distanceHaze*shoulder;
  vec3 passageTint=mix(uDust,uTint,volume);
  col*=1.0-folds*0.16;
  col+=passageTint*folds*0.15;
  }
  /* An unmarked transparent plasma wisp supplies fine material only.
     The authored procedural cloud volume still owns shape and density. */
  if(uArt.x>0.5){
    vec2 page=vec2(nq.x*0.82,nq.y*0.60)+0.5;
    vec2 eddy=vec2(sin(page.y*7.0+uTime*0.38),cos(page.x*8.0-uTime*0.29));
    eddy+=(warp-0.5)*2.0;
    vec2 path1=(page-0.5)*0.93+0.5+eddy*0.046;
    vec2 path2=(page-0.5)*1.16+0.5-eddy*0.033+vec2(sin(uTime*0.10),cos(uTime*0.12))*0.025;
    vec4 n1=texture2D(uNebulaMap,clamp(path1,0.015,0.985));
    vec4 n2=texture2D(uNebulaMap,clamp(path2,0.015,0.985));
    float light1=max(0.0,dot(n1.rgb,vec3(0.22,0.56,0.22))-0.055)*n1.a;
    float light2=max(0.0,dot(n2.rgb,vec3(0.22,0.56,0.22))-0.070)*n2.a;
    vec3 painted=mix(uDust,uRim,smoothstep(0.03,0.42,light1));
    vec3 farPaint=mix(uTint,uDust,smoothstep(0.04,0.32,light2));
    float edge=0.22+0.78*smoothstep(uArena.x+0.01,uArena.x+0.15,rr);
    col+=(painted*light1*0.30+farPaint*light2*0.16)*edge*structure*0.96;
  }
  float burning=uPowerFlow.y*influence*(0.32+grain*0.68);
  col=materialHue(col,vec3(1.0,0.40,0.12),burning*0.35);
  /* A second light source illuminates the far side of this same cloud volume. */
  col+=uDust*exp(-length(uv-vec2(-uPlanet.x,-0.35))*3.8)*0.095;
  col=materialHue(col,vec3(1.0,0.76,0.32),releaseWave*0.18);

  vec2 planetP=uv-uPlanet.xy-drift*0.35;
  float pr=length(planetP),radius=uPlanet.z;
  float planetMask=1.0-smoothstep(radius-1.2/uRes.y,radius+1.2/uRes.y,pr);
  vec3 sun=normalize(vec3(cos(uSurface.w),sin(uSurface.w),0.34));
  float ringOpacity,front;
  vec3 ringLight=belt(planetP,sun,fire,ringOpacity,front);
  col=mix(col,col*(1.0-ringOpacity*0.45)+ringLight,1.0-front);
  /* The atmosphere exists before the surface: its luminous height is visible
     against space, while the opaque globe correctly hides stars and far rings. */
  vec2 edgeN=planetP/max(pr,0.0001);
  float day=pow(max(0.0,dot(edgeN,sun.xy)*0.5+0.5),2.6);
  float atmo=exp(-abs(pr-radius)/(radius*0.038))*day;
  float corona=exp(-abs(pr-radius)/(radius*0.13))*day;
  vec3 air=materialHue(uRim,uEventTint,fire*0.25);
  col+=air*(atmo*0.72+corona*0.16);

  if(pr<radius+1.5/uRes.y){
    vec2 xy=planetP/radius;
    float z=sqrt(max(0.0,1.0-dot(xy,xy)));
    vec3 normal=vec3(xy,z);
    vec2 map=vec2(atan(normal.x,max(0.0001,normal.z)),asin(clamp(normal.y,-1.0,1.0)));
    map.x*=cos(map.y);
    map.x+=uTime*0.034+uLive.z*0.18+uLive.x*0.024;
    vec2 surfWarp=vec2(cloud(map*3.0+1.7+flow*0.22),cloud(map*3.0+9.1-flow*0.31));
    float terrain=cloud(map*9.0+surfWarp*2.4);
    float detail=cloud(map*31.0+surfWarp*4.0);
    float latitude=map.y*20.0+surfWarp.x*5.5;
    float bands=0.5+0.5*sin(latitude+terrain*4.0);
    float storm=cloud(vec2(map.x*5.0,map.y*16.0)+surfWarp*2.0);
    float material=mix(bands*0.55+storm*0.45,terrain,uSurface.y);
    vec3 surface=mix(uTint*0.18,uTint*0.92+uRim*0.16,smoothstep(0.18,0.84,material));
    surface=mix(surface,uRim*0.78,smoothstep(0.55,0.76,detail)*uSurface.z*0.62);
    float lambert=dot(normal,sun);
    float daylight=smoothstep(-0.11,0.56,lambert);
    float relief=0.77+detail*0.42;
    vec3 globe=surface*(0.035+daylight*1.25)*relief;
    /* Blue reflected light gives the night hemisphere volume instead of a
       flat black circle. Surface detail remains quiet on the unlit face. */
    globe+=uTint*(0.017+0.052*pow(1.0-z,2.0))*(0.65+terrain*0.35);
    if(uArt.y>0.5){
      vec2 paintP=turn(xy,-uLive.y*0.018);
      paintP.x+=sin(paintP.y*6.0+uTime*0.23)*0.015*z;
      vec4 paint=texture2D(uPlanetMap,paintP*0.435+0.5);
      float luminosity=dot(paint.rgb,vec3(0.22,0.56,0.22));
      vec3 mineral=mix(uTint*0.19,uRim,smoothstep(0.02,0.86,luminosity));
      vec3 textureBody=mineral*(0.26+daylight*0.90)*(0.82+detail*0.34);
      globe=mix(globe,textureBody,paint.a*(0.30+0.12*(1.0-uSurface.y)));
    }
    float limb=pow(1.0-z,3.5)*pow(max(0.0,lambert+0.28),1.4);
    globe+=air*limb*1.36;
    float aurora=pow(1.0-z,2.4)*smoothstep(0.18,0.8,normal.y*normal.y)*
      (0.45+0.55*sin(map.x*18.0+surfWarp.y*6.0+uTime*0.65));
    globe=materialHue(globe,air,aurora*0.10);
    col=mix(col,globe,planetMask);
  }
  /* The near half of the dust ring crosses the globe. A fine dark shadow
     beneath it and its illuminated strands make the scale unmistakable. */
  col=mix(col,col*(1.0-ringOpacity*0.70)+ringLight,front);

  /* Three distant star planes approach the same flight axis. Their staggered
     far/near fades hide depth recycling; native-pixel cores stay quiet behind
     the foreground particles. The opaque world still occludes every plane. */
  for(int layer=0;layer<3;layer++){
    float l=float(layer),scale=19.0+l*17.0;
    float starDepth=1.0,starFade=1.0;
    vec2 starTravel=vec2(uTime*0.0018*(l+1.0),uTime*0.00075*(l+1.0));
    vec2 su=(uv+drift*(l+1.0)*0.7+starTravel+vec2(0.73+l*2.1,0.47))*scale;
    if(uFlightMode>0.5){
    float starCycle=uTime*0.025+l/3.0;
    float starPhase=fract(starCycle);
    starDepth=mix(1.9,0.8,starPhase);
    starFade=smoothstep(0.0,0.13,starPhase)*
      (1.0-smoothstep(0.82,1.0,starPhase));
    starTravel=vec2(uLive.y*0.0007*(l+1.0),0.0);
    su=((uv-uCtr)*starDepth+uCtr+drift*(l+1.0)*0.7+
      starTravel+vec2(0.73+l*2.1,0.47+floor(starCycle)*1.7))*scale;
    }
    vec2 cell=floor(su),sf=fract(su)-0.5;
    float h=hash21(cell+19.7+l*5.0);
    float starThreshold=uFlightMode>0.5?0.955:0.91;
    if(h>starThreshold){
      vec2 off=vec2(hash21(cell+1.3),hash21(cell+8.7))-0.5;
      vec2 sd=(sf-off*0.70)/(scale*starDepth);
      vec2 radial=normalize(raw-uCtr+vec2(0.0001));
      float stretch=1.0+hyper*2.0;
      sd-=radial*dot(sd,radial)*(1.0-1.0/stretch);
      float size=(0.48+(h-0.91)*8.0)/(uRes.y*0.5);
      if(uFlightMode>0.5)size=(0.48+(h-0.955)*16.0)/(uRes.y*0.5);
      float core=exp(-dot(sd,sd)/(size*size));
      float rays=exp(-abs(sd.x)/(size*0.22)-abs(sd.y)/(size*5.0))+
                 exp(-abs(sd.y)/(size*0.22)-abs(sd.x)/(size*5.0));
      vec3 starColor=mix(vec3(0.58,0.76,1.0),vec3(1.0,0.81,0.61),hash21(cell+4.6));
      col+=starColor*(core*(0.30+l*0.12)+rays*0.10*step(0.985,h))*
        uAccent.z*(1.0-planetMask)*0.88*starFade/stretch;
    }
  }
  float inside=1.0-smoothstep(uArena.x+0.008,uArena.x+0.065,rr);
  float outside=smoothstep(max(0.0,uArena.y-0.055),uArena.y,rr);
  col*=1.0-uCalm*inside*outside*0.38;
  float eclipse=amp*amp*(3.0-2.0*amp);
  col*=1.0-blackhole*eclipse*0.62*exp(-rr*rr/0.20);
  if(uFlightMode>0.5){
  /* A shaded throat makes the singularity a destination in this same
     volume. It stays inside the inner route, preserving the wager's lanes
     and charge/escape display rather than putting a disc over gameplay. */
  float throat=max(0.015,uArena.y*0.68);
  float throatR=length(raw-uCtr);
  float throatShade=1.0-smoothstep(throat*0.46,throat,throatR);
  float throatLimb=exp(-pow((throatR-throat)/(throat*0.18),2.0));
  float throatSide=0.35+0.65*max(0.0,dot(normalize(raw-uCtr+vec2(0.0001)),sun.xy));
  col*=1.0-blackhole*eclipse*throatShade*0.90;
  col+=mix(uDust,uRim,0.35)*throatLimb*throatSide*blackhole*eclipse*0.07;
  }
  /* Soft photographic shoulder protects highlights without clipping a sun
     into a white patch. Positive space colour survives every morph. */
  col=vec3(1.0)-exp(-max(col,0.0)*1.35);
  col+=(hash21(gl_FragCoord.xy)-0.5)*0.002;
  gl_FragColor=vec4(max(col,vec3(0.004,0.006,0.012)),1.0);
}
`;
function glInit(){
  try{
    const cv=runtimeHost.background||document.getElementById('bg');
    if(!cv||typeof cv.getContext!=='function')return false;
    const g=cv.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false})
          ||cv.getContext('experimental-webgl');
    if(!g||typeof g.createShader!=='function')return false;
    const mk=function(ty,src){
      const o=g.createShader(ty);if(!o)return null;
      g.shaderSource(o,src);g.compileShader(o);
      return g.getShaderParameter(o,g.COMPILE_STATUS)?o:null;
    };
    const vs=mk(g.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
    const fs=mk(g.FRAGMENT_SHADER,GL_FS);if(!vs||!fs)return false;
    const pr=g.createProgram();if(!pr)return false;
    g.attachShader(pr,vs);g.attachShader(pr,fs);g.linkProgram(pr);
    if(!g.getProgramParameter(pr,g.LINK_STATUS))return false;
    g.useProgram(pr);
    const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);
    g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
    const loc=g.getAttribLocation(pr,'p');
    g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,2,g.FLOAT,false,0,0);
    GL.u={};
    for(const n of ['uRes','uCtr','uTime','uCalm','uFlightMode','uArc','uShape','uAccent','uPlanet','uSurface','uTint','uRim','uDust','uEventTint','uArena','uArt','uLive','uCurrent','uPowerFlow','uFlight','uRelease','uNebulaMap','uPlanetMap','uRingMap'])
      GL.u[n]=g.getUniformLocation(pr,n);
    const blank=g.createTexture(),pixel=document.createElement('canvas');pixel.width=pixel.height=1;
    g.bindTexture(g.TEXTURE_2D,blank);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);
    g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,pixel);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
    GL.g=g;GL.cv=cv;GL.pr=pr;GL.buffer=b;GL.blank=blank;GL.art=[];GL.on=true;
    return true;
  }catch(e){return false;}
}
function glResize(){
  if(!GL.on)return;
  try{
    const s=Math.min(DPR,2)*GL_SCALE;
    const w=Math.max(1,Math.round(W*s)),h=Math.max(1,Math.round(H*s));
    if(w===GL.vw&&h===GL.vh)return;
    GL.vw=w;GL.vh=h;GL.cv.width=w;GL.cv.height=h;GL.g.viewport(0,0,w,h);
  }catch(e){GL.on=false;}
}
/* Compatibility hooks for input/audio. A tap or an ordinary beat no longer
   distorts the whole sky. The comet's own ring still teaches their timing. */
function glRipple(){}
function glShear(dir){}
const SKY={w:0,wake:-1,wakeAt:-1,wakeAmt:0,vt:null,motion:1,mix:null};
function lerp3(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function skyMaterialHue(base,hue,amount){
  const lum=a=>a[0]*0.299+a[1]*0.587+a[2]*0.114;
  const ratio=lum(base)/Math.max(0.001,lum(hue));
  return lerp3(base,hue.map(v=>v*ratio),Math.max(0,Math.min(1,amount)));
}
function skyMix(){
  const n=WORLDS.length,wf=Math.max(0,SKY.w),i=Math.floor(wf),fr=wf-i;
  const A=WORLDS[i%n],B=WORLDS[(i+1)%n];
  const x=Math.max(0,Math.min(1,(fr-0.80)/0.20)),t=x*x*(3-2*x);
  const L=k=>A[k]+(B[k]-A[k])*t;
  return {arc:[L('x'),L('y'),L('lean'),L('width')],
          shape:[L('bend'),L('reach'),L('grain'),L('gain')],
          planet:[L('px'),L('py'),L('size'),L('tilt')],
          surface:[L('flatten'),L('rock'),L('clouds'),L('sun')],
          tint:lerp3(A.tint,B.tint,t),rim:lerp3(A.rim,B.rim,t),
          dust:lerp3(A.dust,B.dust,t),
          star:L('star'),motion:L('motion')};
}
/* One material transition at a time. This envelope directs geometry and hue,
   not light gain. Slow edges and duplicate suppression avoid repeated onset
   pulses when audio and gameplay report the same earned event. */
const SCENE_RANK={orbit:1,shield:2,spot:2,warp:2,mirror:2,scorch:2,slip:2,trail:2,nova:3,hyper:3,hypernova:3,drop:3};
const SCENE_TINT={
  shield:[0.35,1.00,0.70],orbit:[1.00,0.76,0.35],drop:[0.74,0.67,1.00],nova:[0.70,0.90,1.00],
  hyper:[1.00,0.42,0.75],hypernova:[1.00,0.42,0.75],spot:[0.76,0.76,1.00],
  warp:[0.57,0.46,0.94],mirror:[0.30,0.66,1.00],scorch:[1.00,0.56,0.21],
  slip:[0.38,0.88,0.86],trail:[1.00,0.80,0.42]};
function scenePulse(kind,duration){
  if(G.state!=='playing'||!SCENE_RANK[kind])return;
  const prev=G.sceneEvent;
  if(prev&&prev.at>=G.started&&G.t-prev.at<prev.span&&
     (prev.kind===kind||(SCENE_RANK[prev.kind]||0)>SCENE_RANK[kind]))return;
  impactRecord(kind);
  G.sceneEvent={kind:kind,at:G.t,span:Math.max(2.4,duration||2.4)};
}
function sceneAccent(){
  if(BH.phase>0)return {kind:'blackhole',id:4,strength:Math.max(0,Math.min(1,BH.warp)),tint:[0.38,0.30,0.60]};
  const e=G.sceneEvent;
  const quiet={kind:'quiet',id:0,strength:0,tint:null};
  if(RM||G.state!=='playing'||!e||e.at<G.started)return quiet;
  const age=G.t-e.at;
  if(age<0||age>=e.span)return quiet;
  const attack=Math.min(1,age/0.9),release=Math.min(1,(e.span-age)/1.2);
  const env=Math.min(attack*attack*(3-2*attack),release*release*(3-2*release));
  const strength=env*(e.kind==='orbit'?Math.min(0.60,0.28+0.065*(G.lapStreak||0)):1);
  const id=e.kind==='orbit'?1:e.kind==='drop'?2:
    (e.kind==='hyper'||e.kind==='hypernova')?3:5;
  return {kind:e.kind,id:id,strength:strength,tint:SCENE_TINT[e.kind]||null};
}
function skyWake(streak){
  SKY.wakeAt=G.vt;SKY.wake=0;SKY.wakeAmt=0.12;
  scenePulse('orbit',1.8);
}
function skyStep(dt){
  const vt=RM?0:G.vt;
  SKY.vt=vt;SKY.w=G.skyW||0;
  const M=skyMix();SKY.motion=M.motion;SKY.mix=M;
  const age=G.vt-SKY.wakeAt;
  SKY.wake=SKY.wakeAt>=0&&age<1.4?age/1.4:-1;
}
/* The no-WebGL path shares globe, surface, ring and cloud parameters with GL.
   Materials use a small cached image; depth stars stay at native resolution.
   Both paths remain self-contained when no external artwork is available. */
const SKY_2D={cv:null,g:null,key:''};
function skyHash(x,y){
  x=x*123.34-Math.floor(x*123.34);y=y*345.45-Math.floor(y*345.45);
  const d=x*(x+34.345)+y*(y+34.345);x+=d;y+=d;
  return x*y-Math.floor(x*y);
}
function skyNoise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;
  fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  return (skyHash(ix,iy)*(1-fx)+skyHash(ix+1,iy)*fx)*(1-fy)+
    (skyHash(ix,iy+1)*(1-fx)+skyHash(ix+1,iy+1)*fx)*fy;
}
function skyCloud(x,y){
  let value=0,amp=0.53;
  for(let i=0;i<5;i++){
    value+=skyNoise(x,y)*amp;
    const nx=1.64*x+1.18*y+3.7;y=-1.18*x+1.64*y+8.2;x=nx;amp*=0.48;
  }
  return value;
}
function skyCalm(x,y){
  const rr=Math.hypot(x-(cx-W*0.5)/H,(y-((H-cy)-H*0.5)/H)/Math.max(0.2,AY));
  const sm=(a,b,v)=>{const f=Math.max(0,Math.min(1,(v-a)/(b-a)));return f*f*(3-2*f);};
  const outer=radiusOf(0)/H,inner=radiusOf(G.nRings-1)/H;
  return 1-SKY_ARENA_CALM*0.38*(1-sm(outer+0.008,outer+0.065,rr))*sm(Math.max(0,inner-0.055),inner,rr);
}
function drawCalmSky(){
  skyStep(0);
  const M=SKY.mix,A=sceneAccent();skyAdvanceClock(M);
  const fire=A.id===4?0:A.strength,hole=A.id===4?A.strength:0;
  const charge=skyCharge(),phrase=RM?0:Math.sin(musPos()/STEPS*TAU);
  const key=[W,H,G.nRings,Math.round((G.skyW||0)*80),Math.floor(GL.tw),
    Math.round(A.strength*10),Math.round(charge*10),A.id,Math.round(radiusOf(0)),Math.round(radiusOf(G.nRings-1))].join('/');
  if(!SKY_2D.cv){
    SKY_2D.cv=document.createElement('canvas');SKY_2D.g=SKY_2D.cv.getContext('2d');
  }
  const cv=SKY_2D.cv,g=SKY_2D.g;
  const dx=Math.sin(GL.tw*0.14)*0.014,dy=Math.cos(GL.tw*0.11)*0.009;
  const pcx=M.planet[0]+dx*0.55,pcy=M.planet[1]+dy*0.55,rad=M.planet[2];
  if(SKY_2D.key!==key&&g){
    /* Low resolution material cache, native resolution stars. Rebuilding
       follows the scenic clock and event envelope, never ordinary beats. */
    cv.width=Math.max(1,Math.round(W*0.50));cv.height=Math.max(1,Math.round(H*0.50));
    const im=g.createImageData(cv.width,cv.height);
    if(im&&im.data){
      const data=im.data,cs=Math.cos(M.arc[2]),sn=Math.sin(M.arc[2]);
      const ringTilt=-M.planet[3]-phrase*0.024-fire*0.10;
      const rc=Math.cos(ringTilt),rs=Math.sin(ringTilt);
      const sl=Math.sqrt(1+0.34*0.34),sx=Math.cos(M.surface[3])/sl,sy=Math.sin(M.surface[3])/sl,sz=0.34/sl;
      const air=skyMaterialHue(M.rim,A.tint||M.rim,fire*0.25);
      const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
      const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
      const ax=(cx-W*0.5)/H,ay=((H-cy)-H*0.5)/H;
      for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
        const rawx=((x+0.5)/cv.width-0.5)*W/H,rawy=0.5-(y+0.5)/cv.height;
        const rr=Math.hypot(rawx-ax,(rawy-ay)/Math.max(0.2,AY));
        const lens=1+hole*0.13*Math.exp(-rr*3)/(rr+0.17)+fire*Math.exp(-rr*2.3)*0.022;
        const ux=ax+(rawx-ax)*lens,uy=ay+(rawy-ay)*lens;
        const nx=ux-M.arc[0]-dx,ny=uy-M.arc[1]-dy,qx=nx*cs-ny*sn,qy=nx*sn+ny*cs;
        const flowX=GL.stream*0.043,flowY=-GL.tw*0.028;
        const wx=skyCloud(qx*3.1+2.7+flowX,qy*3.1+2.7+flowY),wy=skyCloud(qx*3.1+8.3-flowX*0.73,qy*3.1+8.3-flowY*0.73);
        const grain=skyCloud(qx*9.2+wx*3+flowX*1.6,qy*9.2+wy*3+flowY*1.6),vein=skyCloud(qx*22+wx*5-flowX*2.3,qy*22+wy*5-flowY*2.3);
        const across=qx-M.shape[0]*(qy*qy-0.12)+(wx-0.5)*0.25;
        const structure=Math.exp(-Math.pow(across/M.arc[3],2)*0.62-qy*qy/(M.shape[1]*M.shape[1]));
        const cloudLight=Math.pow(Math.max(0,grain-0.24)*1.6,2)*structure*M.shape[3];
        const crevice=smooth(0.30,0.66,vein),color=clamp(grain*1.25);
        const bright=Math.pow(Math.max(0,grain-0.54)*3,2)*structure*0.32;
        const farGlow=Math.exp(-Math.hypot(ux+M.planet[0],uy+0.35)*3.8)*0.095;
        const px=ux-pcx,py=uy-pcy,pr=Math.hypot(px,py),ex=px/Math.max(pr,0.0001),ey=py/Math.max(pr,0.0001);
        const day=Math.pow(Math.max(0,(ex*sx+ey*sy)*0.5+0.5),2.6);
        const atmo=Math.exp(-Math.abs(pr-rad)/(rad*0.038))*day;
        const corona=Math.exp(-Math.abs(pr-rad)/(rad*0.13))*day;
        const rx=px*rc-py*rs,ry=px*rs+py*rc,r=Math.hypot(rx,ry/M.surface[0])/(rad*(1+charge*0.035+fire*0.075));
        const ring=smooth(1.16,1.25,r)*(1-smooth(1.88,2.13,r));
        const lanes=0.50+0.19*Math.sin(r*108)+0.11*Math.sin(r*249)+0.10*Math.sin(r*47);
        const gap=1-0.80*Math.exp(-Math.pow((r-1.62)/0.033,2));
        const haze=Math.exp(-Math.pow((r-1.63)/0.38,2));
        const lit=0.54+0.46*Math.cos(Math.atan2(ry/M.surface[0],rx)-M.surface[3]);
        const ro=ring*(0.38+0.53*lanes)*gap,front=ry<=0;
        const ringGain=(ring*(0.34+lanes*0.56)*gap+haze*0.06)*(0.42+lit*0.72);
        let terrain=0,detail=0,material=0,z=0,daylight=0,limb=0;
        if(pr<rad){
          const zx=px/rad,zy=py/rad;z=Math.sqrt(Math.max(0,1-zx*zx-zy*zy));
          const my=Math.asin(clamp(zy,-1,1)),mx=Math.atan2(zx,Math.max(0.0001,z))*Math.cos(my)+GL.tw*0.034+charge*0.18+phrase*0.024;
          const swx=skyCloud(mx*3+1.7,my*3+1.7),swy=skyCloud(mx*3+9.1,my*3+9.1);
          terrain=skyCloud(mx*9+swx*2.4,my*9+swy*2.4);
          detail=skyCloud(mx*31+swx*4,my*31+swy*4);
          const bands=0.5+0.5*Math.sin(my*20+swx*5.5+terrain*4);
          const storm=skyCloud(mx*5+swx*2,my*16+swy*2);
          material=(bands*0.55+storm*0.45)*(1-M.surface[1])+terrain*M.surface[1];
          const lambert=zx*sx+zy*sy+z*sz;
          daylight=smooth(-0.11,0.56,lambert);
          limb=Math.pow(1-z,3.5)*Math.pow(Math.max(0,lambert+0.28),1.4);
        }
        const eclipse=hole*hole*(3-2*hole);
        const moderation=skyCalm(rawx,rawy)*(1-eclipse*0.62*Math.exp(-rr*rr/0.20));
        for(let k=0;k<3;k++){
          const mist=M.dust[k]*(1-color)+M.tint[k]*color;
          let col=[0.008,0.012,0.027][k]+M.tint[k]*0.009+
            mist*cloudLight*(0.36+crevice*0.83)+M.rim[k]*bright+M.dust[k]*farGlow;
          const mineral=M.dust[k]*(1-(0.58+lanes*0.30))+M.rim[k]*(0.58+lanes*0.30);
          if(!front)col=col*(1-ro*0.45)+mineral*ringGain;
          col+=air[k]*(atmo*0.72+corona*0.16);
          if(pr<rad){
            const m=smooth(0.18,0.84,material),cover=smooth(0.55,0.76,detail)*M.surface[2]*0.62;
            let surface=M.tint[k]*0.18*(1-m)+(M.tint[k]*0.92+M.rim[k]*0.16)*m;
            surface=surface*(1-cover)+M.rim[k]*0.78*cover;
            col=surface*(0.035+daylight*1.25)*(0.77+detail*0.42)+
              M.tint[k]*(0.017+0.052*Math.pow(1-z,2))*(0.65+terrain*0.35)+
              air[k]*limb*1.20;
          }
          if(front)col=col*(1-ro*0.70)+mineral*ringGain;
          data[(y*cv.width+x)*4+k]=Math.round(255*Math.max([0.004,0.006,0.012][k],1-Math.exp(-Math.max(0,col*moderation)*1.35)));
        }
        data[(y*cv.width+x)*4+3]=255;
      }
      g.putImageData(im,0,0);SKY_2D.key=key;
    }
  }
  ctx.fillStyle='#020306';ctx.fillRect(0,0,W,H);
  if(SKY_2D.key){
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(cv,0,0,W,H);ctx.restore();
  }
  for(let layer=0;layer<3;layer++){
    const scale=19+layer*17,xMin=Math.floor((-W/H*0.5+0.73+layer*2.1)*scale);
    const xMax=Math.ceil((W/H*0.5+0.73+layer*2.1)*scale);
    for(let iy=-2;iy<scale;iy++)for(let ix=xMin;ix<=xMax;ix++){
      const h=skyHash(ix+19.7+layer*5,iy+19.7+layer*5);if(h<0.91)continue;
      const ux=(ix+0.5+(skyHash(ix+1.3,iy+1.3)-0.5)*0.70)/scale-0.73-layer*2.1-dx*(layer+1)*0.7-GL.tw*0.0018*(layer+1);
      const uy=(iy+0.5+(skyHash(ix+8.7,iy+8.7)-0.5)*0.70)/scale-0.47-dy*(layer+1)*0.7-GL.tw*0.00075*(layer+1);
      if(Math.hypot(ux-pcx,uy-pcy)<rad)continue;
      const x=W*0.5+ux*H,y=H*0.5-uy*H;if(x<0||x>W||y<0||y>H)continue;
      ctx.globalAlpha=(0.30+layer*0.12)*M.star*skyCalm(ux,uy)*0.88;
      ctx.fillStyle=skyHash(ix+4.6,iy+4.6)>.5?'#ffcf9c':'#94c2ff';
      const sz=0.48+(h-0.91)*8;
      ctx.beginPath();ctx.arc(x,y,sz*0.65,0,TAU);ctx.fill();
      if(h>.985){ctx.globalAlpha*=0.20;ctx.fillRect(x-sz*3,y-.3,sz*6,.6);ctx.fillRect(x-.3,y-sz*3,.6,sz*6);}
    }
  }
  ctx.globalAlpha=1;
}
function skyAdvanceClock(M){
  const now=RM?0:G.vt,d=Math.max(0,now-(GL.flowVt===null?now:GL.flowVt));
  GL.flowVt=now;GL.tw+=d*GL_MOTION*M.motion;
  const target=G.state==='playing'?(G.dir||1):1;
  GL.currentDir+=(target-GL.currentDir)*(1-Math.exp(-d*4.5));
  GL.stream+=d*GL_MOTION*M.motion*GL.currentDir;
}
function skyCharge(){
  if(RM||G.state!=='playing'||bhActive()||starfallActive())return 0;
  const partial=G.lapEmbers>0?Math.max(0,Math.min(1,G.lapAcc/TAU)):0;
  return Math.min(1,MU&&MU.armed?1:((G.build||0)+partial*0.85)/dropNeed());
}
const SKY_MATERIALS=[['fx-plasma-wisp','uNebulaMap'],['drift-planet','uPlanetMap'],['drift-ring','uRingMap']];
function skyTexture(key){
  if(typeof runtimeHost.getTexture!=='function')return null;
  const im=runtimeHost.getTexture(key);
  return im&&(im.naturalWidth||im.width)>0&&(im.naturalHeight||im.height)>0?im:null;
}
function glBindSkyMaterials(g){
  const ready=[0,0,0];
  for(let i=0;i<SKY_MATERIALS.length;i++){
    const pair=SKY_MATERIALS[i],im=skyTexture(pair[0]);
    let entry=GL.art[i];
    g.activeTexture(g.TEXTURE0+i);
    if(im&&(!entry||entry.image!==im)){
      if(entry)g.deleteTexture(entry.texture);
      const texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,texture);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);
      g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,im);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
      entry=GL.art[i]={image:im,texture:texture};
    }
    g.bindTexture(g.TEXTURE_2D,entry?entry.texture:GL.blank);
    g.uniform1i(GL.u[pair[1]],i);ready[i]=entry?1:0;
  }
  g.uniform3f(GL.u.uArt,ready[0],ready[1],ready[2]);
}
function glRender(dt){
  if(!GL.on)return;
  try{
    const g=GL.g;glResize();skyStep(dt);
    const SM=SKY.mix,accent=sceneAccent();
    skyAdvanceClock(SM);
    const tint=accent.tint||SM.rim;
    g.useProgram(GL.pr);
    glBindSkyMaterials(g);
    const current=G.currentFlow||{},live=G.state==='playing'&&!RM;
    const phrase=RM?0:Math.sin(musPos()/STEPS*TAU);
    const point=posPlayer(),pressure=skyCharge();
    const travel=live&&Number.isFinite(current.travel)?current.travel:GL.stream;
    g.uniform3f(GL.u.uLive,phrase,travel,pressure);
    g.uniform4f(GL.u.uCurrent,live?(current.turn||0):0,live?(current.hop||0):0,
      current.radial||0,current.dir||G.dir||1);
    g.uniform4f(GL.u.uPowerFlow,live?(current.magnet||0):0,live?(current.scorch||0):0,
      live?(current.release||0):0,current.bh||0);
    g.uniform2f(GL.u.uFlight,(point[0]-W*0.5)/H,((H-point[1])-H*0.5)/H);
    const reward=live&&starfallActive()?G.starfall:null;
    g.uniform2f(GL.u.uRelease,reward?reward.total-reward.left:-1,reward?reward.total/3:1);
    g.uniform2f(GL.u.uRes,GL.vw,GL.vh);
    g.uniform2f(GL.u.uCtr,(cx-W*0.5)/H,((H-cy)-H*0.5)/H);
    g.uniform1f(GL.u.uTime,GL.tw);
    g.uniform1f(GL.u.uCalm,SKY_ARENA_CALM);
    g.uniform1f(GL.u.uFlightMode,runtimeHost.flightEnabled?1:0);
    g.uniform4f(GL.u.uArc,SM.arc[0],SM.arc[1],SM.arc[2],SM.arc[3]);
    g.uniform4f(GL.u.uShape,SM.shape[0],SM.shape[1],SM.shape[2],SM.shape[3]);
    g.uniform4f(GL.u.uPlanet,SM.planet[0],SM.planet[1],SM.planet[2],SM.planet[3]);
    g.uniform4f(GL.u.uSurface,SM.surface[0],SM.surface[1],SM.surface[2],SM.surface[3]);
    g.uniform4f(GL.u.uAccent,accent.strength,accent.id,SM.star,0);
    g.uniform3f(GL.u.uTint,SM.tint[0],SM.tint[1],SM.tint[2]);
    g.uniform3f(GL.u.uRim,SM.rim[0],SM.rim[1],SM.rim[2]);
    g.uniform3f(GL.u.uDust,SM.dust[0],SM.dust[1],SM.dust[2]);
    g.uniform3f(GL.u.uEventTint,tint[0],tint[1],tint[2]);
    g.uniform3f(GL.u.uArena,radiusOf(0)/H,radiusOf(G.nRings-1)/H,AY);
    g.drawArrays(g.TRIANGLES,0,3);
  }catch(e){GL.on=false;}
}
/* Boot the GPU path here, not at the first resize(): GL is a const declared
   just above, so anything earlier in the file would hit its temporal dead
   zone. resize() deliberately does NOT call glResize — glRender does it every
   frame and early-returns when the dimensions have not moved, which covers
   orientation changes for free. */
glInit();glResize();
/* A LOST CONTEXT WAS UNRECOVERABLE AND SILENT. There was no listener of either
   kind: iOS drops a WebGL context under memory pressure or on a backgrounded
   tab, and the default action of the lost event is to make restoration
   impossible. The backdrop would simply stop, with GL.on still true, so
   glRender kept issuing calls into a dead context every frame and the 2D
   fallback — which exists precisely for this — never took over. Prevent the
   default so a restore can happen, hand the backdrop to the 2D path meanwhile,
   and rebuild on restore. */
try{
  if(GL.cv){
    runtimeListen(GL.cv,'webglcontextlost',function(ev){
      ev.preventDefault();GL.on=false;
    },false);
    runtimeListen(GL.cv,'webglcontextrestored',function(){
      GL.vw=GL.vh=0;glInit();glResize();
    },false);
  }
}catch(e){}
/* ================= THE HALO RUNS ON THE GPU =================
   What moves here is ONLY the blur. drawBloom's bright pass stays exactly
   where it is, because it is SEMANTIC: it knows which objects are lights, so
   it never has to threshold a composited frame and can never pick up the
   rings, the pool or the HUD. Thresholding luminance would be the textbook
   route and it would be worse — this game draws a lot of bright things that
   are not light sources.
   The blur is the part that was wrong, and drawBloom's own comment is the
   bill of particulars: one buffer carries one radius, a mip cascade sums
   peaks instead of spreading them, and bilinear upscaling is a separable
   TENT whose footprint is a cross that changes shape depending on where an
   object falls on the coarse grid — 80% halo swing as an ember slides across
   one coarse pixel, on a board where every object is permanently in orbit.
   Drawing real discs at 2x and 4x the dot radius was the right answer
   available to a 2D canvas, and it bought roundness at the cost of three
   arc+fills per light and a falloff made of two stacked steps.
   A separable gaussian is the answer that was not available. It is a true
   convolution, so it is round by construction and shift-invariant to within
   its own grid — and its grid is the /4 bright buffer, four times finer than
   the /12 the mid halo used to be drawn into and eight times finer than the
   /32 wide one. The ripple therefore goes DOWN by moving the halo up to the
   GPU, which is the opposite of what "blur it on a smaller buffer" sounds
   like it should do.
   Two levels, because two radii is what the old stack had and what the scene
   needs: a mid halo blurred at /4 and a wide one blurred at /16. The tight
   core pass is untouched and still composites straight off bloomC.
   AND THE GLOW CAN NOW BE BENT. It is a field in a texture rather than a
   pile of discs, so the composite pass can lens it: radial chromatic
   aberration that grows with the energy already driving the sky, and — the
   one that matters — the black hole's pull applied to the arena's own light.
   The shader has always bent the sky while the arena sat flat on top of it,
   which is the exact tell this file already documents for the star layer
   ("the nebula bent and the stars sat still on top of it"). Same bug, one
   layer up. The sharp arena still does not bend; its light does, and that is
   the half a screen-space pass can honestly buy.
   FALLBACK IS THE WHOLE POINT: if any of this fails, FX.on goes false and
   drawBloom draws the two halo discs per light exactly as it always has. */
/* THE DIAL, SET AGAINST THE OLD STACK RATHER THAN BY EYE. Every number here
   was chosen so the halo carries the SAME AMOUNT OF LIGHT it did before —
   this is a change of filter, not a brightness change, and a glow that
   arrived 40% hotter would flatter the diff while wrecking the contrast the
   calm pool exists to buy back. Measured per light on a 390x844 phone, halo
   term only, reach to 1/255 as the maximum over a full circle:
     ember  energy 1.04x  reach 54 -> 64px  roundness 0.750 -> 0.867
     shard  energy 1.07x  reach 56 -> 69px  roundness 0.821 -> 0.883
     comet  energy 1.06x  reach 79 -> 84px  roundness 0.828 -> 0.935
     hub    energy 1.02x  reach 51 -> 59px  roundness 0.733 -> 0.881
   And the crawl, which is the defect the discs were chosen to avoid and the
   one a finer grid was always going to win: sliding a light across one whole
   coarse buffer pixel swung the old halo's reach by 8.8% and its peak by
   5.7%; the gaussian swings 3.5% and 3.2%.
   FX_A is mutable at runtime for the same reason HALO_A is — the last word
   on how much glow is too much belongs to eyes on a real screen. */
let FX_A=0.55;                   /* composite alpha — the runtime dial, as HALO_A is */
const FX_MIDW=0.62,FX_WIDEW=0.85; /* level weights inside the shader */
const FX_SPREAD=1.15;            /* blur step, in texels of each level. 1.6 reaches
                                    further and starts showing the five taps:
                                    the hub's roundness falls 0.881 -> 0.821 */
/* RADIAL ABERRATION, quoted as the R-to-B sample separation it actually
   produces on an 844px-tall screen — a coefficient on its own says nothing:
     idle        0.00px at the arena centre, 0.57 at 0.25H out, 1.14 at 0.5H
     running hot 0.00                        1.90                3.80
     black hole  0.00                        3.80                7.60
   Zero at the centre by construction, because ab scales with r: the fringe
   grows out toward the corners and never touches the orbits the player is
   reading. */
const FX_AB=0.0045;
const FX={on:false,g:null,cv:null,prB:null,prC:null,uB:{},uC:{},
  src:null,rt:[],bw:0,bh:0,cw:0,ch:0};
const FX_VS='attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
/* the five-tap linear-sampled gaussian: nine taps' worth of weight for five
   fetches, because a bilinear fetch between two texels IS two weighted taps */
/* OUT-OF-BOUNDS TAPS CONTRIBUTE NOTHING, and the border is why. WebGL1 has
   no CLAMP_TO_BORDER, so a tap past the texture edge reads the edge texel
   back — light that should have slid off the screen is REFLECTED into the
   outermost band instead, and every pass of the chain compounds it. Modelled
   with this exact kernel: a light one texel from the border glowed 1.82x
   brighter at the screen edge than the same light does mid-screen — a thin
   bright frame hugging the border whenever the comet or its sparks pass
   near it, which a playtester photographed. Zero-weighting the out-of-bounds
   taps loses that energy off-screen, which is what physically happens to a
   glow at a window's edge: measured border level drops to 0.55x. Interior
   fragments have every tap in bounds and are bit-identical either way. */
const FX_BLUR=`
precision mediump float;
uniform sampler2D uTex; uniform vec2 uStep;
varying vec2 vUv;
float inb(vec2 p){return step(0.0,p.x)*step(p.x,1.0)*step(0.0,p.y)*step(p.y,1.0);}
void main(){
  vec4 s=texture2D(uTex,vUv)*0.2270270270;
  vec2 o1=uStep*1.3846153846, o2=uStep*3.2307692308;
  s+=(texture2D(uTex,vUv+o1)*inb(vUv+o1)+texture2D(uTex,vUv-o1)*inb(vUv-o1))*0.3162162162;
  s+=(texture2D(uTex,vUv+o2)*inb(vUv+o2)+texture2D(uTex,vUv-o2)*inb(vUv-o2))*0.0702702703;
  gl_FragColor=s;
}`;
const FX_COMP=`
precision mediump float;
uniform sampler2D uMid,uWide;
uniform vec2 uCtr; uniform float uAsp,uAb,uBH,uMidW,uWideW;
varying vec2 vUv;
void main(){
  vec2 uv=vUv;
  /* d is measured in units of screen HEIGHT on both axes, the same
     convention the backdrop shader uses, so a circle here is a circle */
  vec2 d=vec2((uv.x-uCtr.x)*uAsp,uv.y-uCtr.y);
  float r=length(d)+1e-5;
  if(uBH>0.0){
    /* THIS IS NOT THE BACKDROP'S LENS, AND COPYING IT HERE WAS WRONG.
       The sky's pull is min(r*0.72, k/(r+c)) — a displacement bounded as a
       FRACTION of the radius, which is right for a nebula: the whole smooth
       field compresses toward the hole and there is nothing in it that has
       to stay anywhere in particular. Measured against the arena's radii it
       is a catastrophe. The orbits live between r=0.09 and r=0.20 of screen
       height, and across that band the clamp is the binding term, so the
       glow is compressed by the full 72% — 120 to 170 pixels of displacement
       on an 844px screen. Every halo would be dragged clean off the light it
       belongs to, which is the detached-glow failure this file already
       records once, when an ember's bloom stayed parked on the ring it
       started from while the ember flew inward.
       A halo is not a backdrop. It is attached to an object, and the pull is
       therefore bounded in ABSOLUTE terms instead: r*exp(-4r) peaks around a
       hundredth of the screen height, so the light leans and winds toward
       the hole by seven to nine pixels across the whole play annulus and
       stays on its source. Monotonic for the same reason as before but more
       cheaply — the derivative of the pull never approaches 1, so r' cannot
       fold no matter what uBH does. Measured at full envelope by asking
       where a light at a given source radius actually lands: 6.2px inward
       at 0.10 of screen height, 7.8px at 0.15, 8.6px at 0.20, 8.8px at
       0.30, winding 2.8 degrees at its strongest; smallest step in the
       sampled radius over a sweep of the whole screen is 9.8e-5, so it
       never folds. */
    float fall=exp(-r*4.0);
    float pull=uBH*0.115*r*fall;
    float sw=uBH*0.55*r*fall;
    float cs=cos(sw),sn=sin(sw);
    /* PLUS, NOT MINUS, AND THE SIGN IS THE WHOLE EFFECT. This is INVERSE
       sampling: the shader is handed a destination fragment and asked which
       part of the source to read. Reading from a SMALLER radius magnifies —
       a light living at source radius s then surfaces at a destination
       radius LARGER than s, so subtracting the pull shoves every halo away
       from the singularity while the comment above it says it drags them in.
       Measured on the first cut: +6.8px at 0.10 of screen height, +8.8px at
       0.20 — the right magnitude, pointing the wrong way. Reading from a
       larger radius contracts, which is what a hole does: -6.2px and -8.6px
       at the same two radii.
       THIS IS THE THIRD TIME THIS EXACT INVERSION HAS HIT THE BLACK HOLE.
       The gravity pull that "dragged the comet inward" pushed it outward,
       the "inner ring 2x" bonus paid on the outer ring, and now this. Every
       one of them read as correct, because in each case the code and the
       comment are both true under some reading of which way the number
       counts. There is no way to catch it by reading; the only thing that
       works is asking where a specific light ENDS UP, in pixels, and
       fxcheck.mjs now does exactly that. */
    d=vec2(d.x*cs-d.y*sn,d.x*sn+d.y*cs)*(1.0+pull/r);
    r=length(d)+1e-5;
    uv=vec2(uCtr.x+d.x/uAsp,uCtr.y+d.y);
  }
  /* aberration is RADIAL and grows outward: zero at the arena centre, so the
     thing the player is reading never fringes, widest at the corners */
  vec2 ab=(d/r)*uAb*r;
  ab=vec2(ab.x/uAsp,ab.y);
  vec3 c=vec3(texture2D(uMid,uv+ab).r,texture2D(uMid,uv).g,texture2D(uMid,uv-ab).b)*uMidW;
  c+=vec3(texture2D(uWide,uv+ab*1.7).r,texture2D(uWide,uv).g,texture2D(uWide,uv-ab*1.7).b)*uWideW;
  gl_FragColor=vec4(max(c,0.0),1.0);
}`;
function fxInit(){
  try{
    if(!document||typeof document.createElement!=='function')return false;
    const cv=document.createElement('canvas');
    if(!cv||typeof cv.getContext!=='function')return false;
    /* preserveDrawingBuffer, because this canvas is READ with drawImage
       rather than composited by the browser: without it the drawing buffer
       is allowed to be empty by the time anything asks for it */
    const o={antialias:false,alpha:false,depth:false,stencil:false,preserveDrawingBuffer:true};
    const g=cv.getContext('webgl',o)||cv.getContext('experimental-webgl',o);
    /* the stubbed canvas in the harness answers every property with a
       function, so feature-detection has to check RESULTS, not existence */
    if(!g||typeof g.createShader!=='function'||typeof g.createFramebuffer!=='function')return false;
    const mk=function(ty,src){
      const o2=g.createShader(ty); if(!o2)return null;
      g.shaderSource(o2,src); g.compileShader(o2);
      return g.getShaderParameter(o2,g.COMPILE_STATUS)?o2:null;
    };
    const link=function(fsrc,names,out){
      const vs=mk(g.VERTEX_SHADER,FX_VS),fs=mk(g.FRAGMENT_SHADER,fsrc);
      if(!vs||!fs)return null;
      const pr=g.createProgram(); if(!pr)return null;
      g.attachShader(pr,vs);g.attachShader(pr,fs);
      g.bindAttribLocation(pr,0,'p');   /* pinned, so one enabled array serves both */
      g.linkProgram(pr);
      if(!g.getProgramParameter(pr,g.LINK_STATUS))return null;
      for(const n of names)out[n]=g.getUniformLocation(pr,n);
      return pr;
    };
    const prB=link(FX_BLUR,['uTex','uStep'],FX.uB);
    const prC=link(FX_COMP,['uMid','uWide','uCtr','uAsp','uAb','uBH','uMidW','uWideW'],FX.uC);
    if(!prB||!prC)return false;
    const b=g.createBuffer(); if(!b)return false;
    g.bindBuffer(g.ARRAY_BUFFER,b);
    g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
    g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);
    const t=g.createTexture(); if(!t)return false;
    g.bindTexture(g.TEXTURE_2D,t);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
    g.disable(g.DEPTH_TEST);g.disable(g.BLEND);
    FX.g=g;FX.cv=cv;FX.prB=prB;FX.prC=prC;FX.src=t;FX.buffer=b;FX.on=true;
    return true;
  }catch(e){return false;}
}
/* a render target is a texture with a framebuffer bound to it; CLAMP_TO_EDGE
   on both axes so the blur cannot wrap a bright corner around the screen */
function fxTarget(w,h){
  const g=FX.g;
  const t=g.createTexture(); if(!t)return null;
  g.bindTexture(g.TEXTURE_2D,t);
  g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
  const f=g.createFramebuffer(); if(!f)return null;
  g.bindFramebuffer(g.FRAMEBUFFER,f);
  g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);
  const ok=g.checkFramebufferStatus(g.FRAMEBUFFER)===g.FRAMEBUFFER_COMPLETE;
  g.bindFramebuffer(g.FRAMEBUFFER,null);
  return ok?{t:t,f:f,w:w,h:h}:null;
}
/* SIX TARGETS, THREE SCALES, AND THE MIDDLE ONE IS NOT DECORATION. The wide
   level wants to live at /16 — four times coarser than the bright buffer —
   and the obvious way there is one pass that reads /4 and writes /16. It
   aliases. A five-tap kernel written in DESTINATION texels reads its
   neighbours 4.6 source texels apart, and the source is only smooth to about
   sigma 2, so the kernel steps straight over content it never samples. On a
   still frame that is a slightly wrong halo; on this board, where every light
   is permanently in orbit across the sampling grid, it is a halo that
   shimmers — the same class of defect as the bilinear cross this whole path
   exists to be rid of.
   Going /4 -> /8 -> /16 halves every tap spacing to 2.3 source texels, which
   is inside what a sigma-2 source supports, and each intermediate is itself
   blurred before it is read down. The two extra passes cost an eighth of the
   fragments the first pair does. */
function fxResize(bw,bh){
  if(FX.bw===bw&&FX.bh===bh&&FX.rt.length===6)return true;
  const g=FX.g;
  for(const rt of FX.rt){try{g.deleteTexture(rt.t);g.deleteFramebuffer(rt.f);}catch(e){}}
  FX.rt=[];
  const mw=Math.max(1,bw>>1),mh=Math.max(1,bh>>1);
  const ww=Math.max(1,bw>>2),wh=Math.max(1,bh>>2);
  const rt=[fxTarget(bw,bh),fxTarget(bw,bh),fxTarget(mw,mh),
            fxTarget(mw,mh),fxTarget(ww,wh),fxTarget(ww,wh)];
  for(const t of rt)if(!t)return false;
  FX.rt=rt;FX.bw=bw;FX.bh=bh;
  return true;
}
/* one separable pass: src texture -> dst target, along uStep */
function fxBlur(srcTex,dst,dx,dy){
  const g=FX.g;
  g.bindFramebuffer(g.FRAMEBUFFER,dst.f);
  g.viewport(0,0,dst.w,dst.h);
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D,srcTex);
  g.uniform1i(FX.uB.uTex,0);
  g.uniform2f(FX.uB.uStep,dx,dy);
  g.drawArrays(g.TRIANGLES,0,3);
}
/* Builds the halo from the bright buffer drawBloom has just filled and
   leaves it in FX.cv, ready to composite. Returns false on any failure, and
   a failure is permanent: the disc path is not worse, it is just older. */
function fxRender(srcCanvas,bw,bh){
  if(!FX.on)return false;
  try{
    const g=FX.g;
    /* A LOST CONTEXT DOES NOT THROW, IT GOES QUIET, and quiet is the one
       failure this pass cannot survive. Every call on a lost context is a
       silent no-op: fxResize sees its sizes unchanged and returns true,
       drawArrays does nothing, nothing raises, and fxRender returns TRUE —
       so drawBloom composites an empty canvas and the halo simply vanishes.
       And it vanishes with no way back, because bloomHalo was set false
       before the dot loop, so the discs that exist for exactly this were
       never drawn either. That is worse than the backdrop's version of this
       bug, which at least left a baked sky behind; here the glow just stops.
       checkFramebufferStatus would catch it, but only on a resize.
       isContextLost is the question actually being asked, so ask it, every
       frame, before anything else. */
    if(typeof g.isContextLost==='function'&&g.isContextLost()){FX.on=false;return false;}
    if(!fxResize(bw,bh)){FX.on=false;return false;}
    const cw=Math.max(1,Math.ceil(W/2)),ch=Math.max(1,Math.ceil(H/2));
    if(FX.cw!==cw||FX.ch!==ch){FX.cv.width=cw;FX.cv.height=ch;FX.cw=cw;FX.ch=ch;}
    /* FLIP ON UPLOAD, and exactly once. A 2D canvas counts rows downward and
       a GL framebuffer counts them upward; flipping here means the composite
       lands in FX.cv the same way up as the canvas it came from, so
       drawImage needs no transform. Flip in neither place and the glow is
       upside down; flip in both and it is upside down again. */
    g.bindTexture(g.TEXTURE_2D,FX.src);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);
    g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,srcCanvas);
    const A=FX.rt[0],B=FX.rt[1],C=FX.rt[2],D=FX.rt[3],E=FX.rt[4],F=FX.rt[5];
    g.useProgram(FX.prB);
    /* mid: blur the bright buffer in place, at /4 */
    fxBlur(FX.src,A,FX_SPREAD/bw,0);
    fxBlur(A.t,B,0,FX_SPREAD/bh);
    /* down to /8, then to /16 — each step reads a source already blurred */
    fxBlur(B.t,C,FX_SPREAD/C.w,0);
    fxBlur(C.t,D,0,FX_SPREAD/D.h);
    fxBlur(D.t,E,FX_SPREAD/E.w,0);
    fxBlur(E.t,F,0,FX_SPREAD/F.h);
    /* composite to the FX canvas itself */
    g.bindFramebuffer(g.FRAMEBUFFER,null);
    g.viewport(0,0,cw,ch);
    g.useProgram(FX.prC);
    g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,B.t);g.uniform1i(FX.uC.uMid,0);
    g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,F.t);g.uniform1i(FX.uC.uWide,1);
    /* uv counts UP from the bottom after the flip, so the arena centre does too */
    g.uniform2f(FX.uC.uCtr,W>0?cx/W:0.5,H>0?1-cy/H:0.5);
    g.uniform1f(FX.uC.uAsp,H>0?W/H:1);
    const energy=Math.min(1,PLAY.heat+0.6*G.pay+G.odGlow);
    g.uniform1f(FX.uC.uAb,RM?0:FX_AB*(0.30+0.70*energy)*(1+BH.warp));
    g.uniform1f(FX.uC.uBH,RM?0:BH.warp);
    g.uniform1f(FX.uC.uMidW,FX_MIDW);
    g.uniform1f(FX.uC.uWideW,FX_WIDEW);
    g.drawArrays(g.TRIANGLES,0,3);
    return true;
  }catch(e){FX.on=false;return false;}
}
fxInit();
/* The same pair of listeners the backdrop carries, for the same reason and
   with one addition: the render targets have to be dropped as well as the
   flag cleared. A restored context hands back a NEW context object, and
   every texture, framebuffer and program made against the old one is dead —
   so FX.rt is emptied and its cached size zeroed, or fxResize would see its
   dimensions unchanged and happily reuse six destroyed framebuffers.
   preventDefault is what makes restoration possible at all; without it the
   default action is to make the context permanently unrecoverable. */
try{
  if(FX.cv&&typeof FX.cv.addEventListener==='function'){
    runtimeListen(FX.cv,'webglcontextlost',function(ev){
      try{ev.preventDefault();}catch(e){}
      FX.on=false;FX.rt=[];FX.bw=FX.bh=0;FX.cw=FX.ch=0;
    },false);
    runtimeListen(FX.cv,'webglcontextrestored',function(){
      FX.on=false;FX.rt=[];FX.bw=FX.bh=0;FX.cw=FX.ch=0;
      fxInit();
    },false);
  }
}catch(e){}
/* Light is attached to a place and an action. Event geometry is visual only. */
function impactColor(kind){
  const c={orbit:'#ffcf75',shield:'#7dffcf',nova:'#b6ecff',hyper:'#ff85d5',
    hypernova:'#ff85d5',drop:'#ba9aff',warp:'#ad9cff',spot:'#e9e0ff',
    scorch:'#ff995a',mirror:'#8bcfff',slip:'#84fff4',trail:'#ffe2a2'};
  return c[kind]||COL.comet;
}
function impactHalo(x,y,r,col,alpha){
  if(!(r>0)||!(alpha>0))return;
  /* A spatial field boundary with an open center, never a center-filled disk. */
  ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=Math.min(0.38,alpha);ctx.strokeStyle=col;ctx.lineWidth=1.1*u;
  for(let j=0;j<2;j++){
    const a=-0.35+j*Math.PI;
    ctx.beginPath();ctx.arc(x,y,r*0.62,a,a+1.7);ctx.stroke();
  }
  ctx.restore();
}
function impactRecord(kind){
  if(G.state!=='playing')return;
  const p=posPlayer(),span=kind==='orbit'?1.25:kind==='drop'?2.5:1.65;
  if(!G.impacts)G.impacts=[];
  G.impacts=G.impacts.filter(e=>e.at>=G.started&&G.t-e.at<e.span);
  if(G.impacts.length>=7)G.impacts.shift();
  G.impacts.push({kind,x:p[0],y:p[1],angle:G.angle,ring:effRing(),at:G.t,span});
}
function drawOrbitalRails(){
  const playing=G.state==='playing',menu=G.state==='menu';
  for(let i=0;i<G.nRings;i++){
    const r=radiusOf(i),x=ecx(r),y=ecy(r),on=effRing()===i;
    const escape=BH.phase===2&&BH.escape&&i===0;
    const al=menu?0.26:playing?1:0.58;
    ctx.save();ctx.globalAlpha=al;ctx.lineCap='round';
    ctx.strokeStyle='rgba(1,5,15,0.54)';ctx.lineWidth=(on?6:4)*u;
    ctx.beginPath();ctx.ellipse(x,y,r,r*AY,0,0,TAU);ctx.stroke();
    const metal=ctx.createLinearGradient(x-r,y-r*AY,x+r,y+r*AY);
    metal.addColorStop(0,escape?'#a5ffcd':on?'#aadbe9':'#526679');
    metal.addColorStop(0.28,on?'#578294':'#314052');
    metal.addColorStop(0.56,on?'#28516a':'#28384f');
    metal.addColorStop(0.80,on?'#8db3c7':'#687e95');
    metal.addColorStop(1,on?'#44667d':'#374e66');
    ctx.strokeStyle=metal;ctx.lineWidth=(on?1.65:1.05)*u;
    ctx.beginPath();ctx.ellipse(x,y,r,r*AY,0,0,TAU);ctx.stroke();
    if(on&&G.state!=='dead'){
      const a=G.angle-G.dir*0.68,b=G.angle+G.dir*0.24;
      ctx.globalCompositeOperation='lighter';ctx.strokeStyle=escape?COL.shield:COL.comet;
      for(const [w,alpha] of [[10,0.07],[3.5,0.28],[1.2,0.9]]){
        ctx.globalAlpha=al*alpha;ctx.lineWidth=w*u;
        ctx.beginPath();ctx.ellipse(x,y,r,r*AY,0,Math.min(a,b),Math.max(a,b));ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function drawPowerAtmosphere(){
  if(G.state!=='playing'||bhActive())return;
  const hg=Math.min(1,G.hyperGlow||0),slow=G.slow>0?Math.min(1,G.slow/0.6):0;
  if(hg>0.02&&!RM){
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    /* Perspective velocity belongs to hypernova; ordinary play has no rain. */
    for(let i=0;i<38;i++){
      const a=i*2.399963+0.2,phase=(G.vt*(0.32+(i%5)*0.055)+i*0.618)%1;
      const d=R*(0.87+phase*1.8),len=(8+phase*phase*90)*u;
      const x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d*AY;
      ctx.globalAlpha=hg*Math.sin(Math.PI*phase)*(0.13+(i%3)*0.06);
      ctx.strokeStyle=i%4===0?'#fff0d6':i%2?'#8bdfff':'#ff8dde';ctx.lineWidth=(i%3===0?1.6:0.75)*u;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len*AY);ctx.stroke();
    }
    ctx.restore();
  }
  if(slow>0&&!RM){
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=COL.warp;
    const r=curR();
    for(let j=0;j<3;j++){
      const rr=r+(j+1)*5*u;
      ctx.globalAlpha=slow*(0.13-j*0.027);ctx.lineWidth=(2.2-j*0.5)*u;
      const a=G.angle-G.dir*(0.35+j*0.16),b=a-G.dir*0.6;
      ctx.beginPath();ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,Math.min(a,b),Math.max(a,b));ctx.stroke();
    }
    ctx.restore();
  }
}
/* Dust keeps the direction of committed gestures. These 36 persistent strands
   are a world-space wake, not random particles or a second animation clock. */
function currentWakeReset(){
  if(!G.currentFlow)G.currentFlow={turn:0,hop:0,radial:0,dir:1,
    magnet:0,scorch:0,release:0,bh:0,travel:0};
  const f=G.currentFlow;
  f.turn=0;f.hop=0;f.radial=0;f.dir=G.dir;f.magnet=0;f.scorch=0;
  f.release=0;f.bh=0;f.travel=0;
  if(!G.currentWake){
    G.currentWake={pool:[],next:0,x:0,y:0,ready:false,distance:0,serial:0};
    for(let i=0;i<36;i++)G.currentWake.pool.push({life:0});
  }
  const w=G.currentWake;w.next=0;w.ready=false;w.distance=0;w.serial=0;
  for(const p of w.pool)p.life=0;
}
function currentWakeTurn(){
  if(G.state!=='playing'||frozen())return;
  if(!G.currentFlow)currentWakeReset();
  const f=G.currentFlow;f.dir=G.dir;f.turn=1;
  const cp=posPlayer(),x=(cp[0]-cx)/u,y=(cp[1]-cy)/u;
  for(const p of G.currentWake.pool){
    if(p.life<=0||Math.hypot(p.x-x,p.y-y)>180)continue;
    const r=Math.max(1,Math.hypot(p.x,p.y/AY));
    p.vx=-p.y/AY/r*f.dir*48+p.x/r*12;
    p.vy=p.x/r*f.dir*48*AY+p.y/r*12;
    p.bend=f.dir*(24+p.layer*9);p.kick=1;
  }
}
function currentWakeHop(step){
  if(G.state!=='playing'||frozen())return;
  if(!G.currentFlow)currentWakeReset();
  G.currentFlow.hop=1;G.currentFlow.radial=-step;
}
function currentWakeUpdate(dt){
  if(G.state!=='playing'||frozen()||!(dt>0))return;
  if(!G.currentFlow)currentWakeReset();
  const f=G.currentFlow,w=G.currentWake,cp=posPlayer();
  const x=(cp[0]-cx)/u,y=(cp[1]-cy)/u;
  const bh=Math.min(1,Math.max(0,BH.warp||0)),ordinary=!bhActive();
  f.turn=Math.max(0,f.turn-dt/0.8);f.hop=Math.max(0,f.hop-dt/0.6);
  const ease=Math.min(1,dt*5);
  f.magnet+=((ordinary&&G.spot>0?1:0)-f.magnet)*ease;
  f.scorch+=((ordinary&&G.scorch>0?1:0)-f.scorch)*ease;
  f.release+=((ordinary&&starfallActive()?1:0)-f.release)*ease;
  f.bh=bh;
  if(!w.ready){w.x=x;w.y=y;w.ready=true;}
  const dx=x-w.x,dy=y-w.y,dist=Math.hypot(dx,dy);
  /* A held pointer may still roll a speculative turn back into a swipe. */
  const committed=G.revPend<=0;
  if(committed)f.travel+=dist*f.dir/Math.max(1,R/u);
  if(!RM){
    for(const p of w.pool){
      if(p.life<=0)continue;
      p.life=Math.max(0,p.life-dt);p.kick=Math.max(0,p.kick-dt*1.7);
      const r=Math.max(1,Math.hypot(p.x,p.y/AY));
      const nx=p.x/r,ny=p.y/r,tx=-p.y/AY/r,ty=p.x/r*AY;
      let vx=tx*f.dir*(14+f.turn*24)+nx*(7+f.release*92);
      let vy=ty*f.dir*(14+f.turn*24)+ny*(7+f.release*92);
      const mx=x-p.x,my=y-p.y,md=Math.max(1,Math.hypot(mx,my));
      const pull=f.magnet*Math.max(0,1-md/230)*220;
      vx+=mx/md*pull;vy+=my/md*pull;
      if(bh>0){vx=vx*(1-bh)-nx*bh*190+tx*bh*45;
        vy=vy*(1-bh)-ny*bh*190+ty*bh*45;}
      const drag=Math.min(1,dt*(bh>0?5:2.6));
      p.vx+=(vx-p.vx)*drag;p.vy+=(vy-p.vy)*drag;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      /* The far dust follows later, so force changes bend a long filament. */
      p.tx+=p.vx*dt*0.30;p.ty+=p.vy*dt*0.30;
      p.heat+=(f.scorch-p.heat)*Math.min(1,dt*(f.scorch>p.heat?4:0.45));
      if(bh>0&&r<18)p.life=0;
    }
    if(committed&&dist>0.01&&dist<100){
      const spacing=f.hop>0?13:22;
      w.distance+=dist;
      const n=Math.min(4,Math.floor(w.distance/spacing));
      if(n)w.distance%=spacing;
      const tx=dx/dist,ty=dy/dist;
      for(let i=0;i<n;i++){
        const q=(i+1)/(n+1),px=w.x+dx*q,py=w.y+dy*q;
        const r=Math.max(1,Math.hypot(px,py/AY)),nx=px/r,ny=py/r;
        const layer=w.serial++%3,offset=9+layer*14;
        const reach=62+layer*34+f.hop*34;
        const p=w.pool[w.next];w.next=(w.next+1)%w.pool.length;
        p.x=px+nx*offset;p.y=py+ny*offset;
        p.tx=p.x-tx*reach+nx*(18+layer*18);
        p.ty=p.y-ty*reach+ny*(18+layer*18);
        p.vx=tx*26+nx*8;p.vy=ty*26+ny*8;
        p.span=2.3+layer*0.3;p.life=p.span;p.layer=layer;
        p.bend=f.dir*(12+layer*8)+f.radial*f.hop*35;
        p.kick=Math.max(f.turn,f.hop);p.heat=f.scorch;
      }
    }else if(!committed||dist>=100)w.distance=0;
  }
  w.x=x;w.y=y;
}
function drawCurrentWake(){
  if(RM||G.state!=='playing'||!G.currentWake)return;
  const f=G.currentFlow,outer=Math.max(1,R/u);
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  /* Keep long curves outside the quiet core and the singularity's shadow. */
  ctx.beginPath();ctx.rect(-W,-H,W*3,H*3);
  const quiet=(f.bh>0?0.34:0.24)*R;
  ctx.ellipse(cx,cy,quiet,quiet*AY,0,0,TAU);ctx.clip('evenodd');
  for(const p of G.currentWake.pool){
    if(p.life<=0)continue;
    const age=p.span-p.life,fade=Math.min(1,age/0.16)*Math.pow(p.life/p.span,1.3);
    const r=Math.hypot(p.x,p.y/AY)/outer;
    const edge=Math.max(0,Math.min(1,(r-0.46)/0.68));
    const alpha=fade*(0.065+edge*0.16+p.kick*0.13+f.release*0.13+f.bh*0.14);
    const dx=p.x-p.tx,dy=p.y-p.ty,len=Math.max(1,Math.hypot(dx,dy));
    const bend=p.bend*(0.6+p.life/p.span*0.4);
    const qx=(p.x+p.tx)/2-dy/len*bend,qy=(p.y+p.ty)/2+dx/len*bend;
    ctx.strokeStyle=p.heat>0.45?'#ffb571':f.release>0.3?'#ebd2ff':
      f.magnet>0.25?'#91e8ed':p.layer===1?'#82a8e8':'#91cfde';
    ctx.beginPath();ctx.moveTo(cx+p.tx*u,cy+p.ty*u);
    ctx.quadraticCurveTo(cx+qx*u,cy+qy*u,cx+p.x*u,cy+p.y*u);
    ctx.globalAlpha=alpha*0.22;ctx.lineWidth=(7+p.layer*2)*u;ctx.stroke();
    ctx.globalAlpha=alpha;ctx.lineWidth=(1.1+p.layer*0.4)*u;ctx.stroke();
  }
  ctx.restore();
}
function drawImpactEvents(){
  if(!G.impacts||G.state!=='playing'||bhActive())return;
  for(const e of G.impacts){
    const age=G.t-e.at;if(age<0||age>e.span||e.at<G.started)continue;
    /* Orbit has its travelling gold marker; Nova has its real conversion
       front; Starfall comes from the planet. Do not stamp a second explosion. */
    if(e.kind==='orbit'||e.kind==='nova'||e.kind==='drop')continue;
    const t=age/e.span,fade=Math.min(1,age/0.16)*Math.pow(1-t,1.3);
    const col=impactColor(e.kind),major=e.kind==='hyper'||e.kind==='hypernova';
    if(RM){impactHalo(e.x,e.y,26*u,col,0.28*fade);continue;}
    const reach=(18+t*(major?92:44))*u;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
    ctx.strokeStyle=col;ctx.globalAlpha=0.58*fade;ctx.lineWidth=1.35*u;
    /* The casing separates into directed curved fragments. Its center stays
       clear, so the acquired power and the comet remain the things to read. */
    const count=major?7:4;
    for(let i=0;i<count;i++){
      const a=e.angle+i*TAU/count,b=a+0.12;
      const start=reach*(0.38+(i%3)*0.08),end=reach*(0.72+(i%2)*0.16);
      ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*start,e.y+Math.sin(a)*start);
      ctx.quadraticCurveTo(e.x+Math.cos(a+0.24)*reach*0.62,e.y+Math.sin(a+0.24)*reach*0.62,
        e.x+Math.cos(b)*end,e.y+Math.sin(b)*end);ctx.stroke();
    }
    ctx.restore();
  }
}
function drawSingularity(){
  if(BH.warp<=0)return;
  const charge=Math.max(0,Math.min(1,BH.charge||0)),warp=Math.min(1,BH.warp);
  const inner=radiusOf(G.nRings-1),r=Math.max(15*u,Math.min(radiusOf(0)*0.28,inner*0.75));
  const rotation=RM?-0.20:-0.20+Math.sin(G.vt*0.08)*0.05;
  const col=BH.escape?'#9cffd9':'#ffba85';
  ctx.save();ctx.globalAlpha=warp;ctx.translate(cx,cy);ctx.rotate(rotation);
  impactHalo(0,0,r*2.5,BH.escape?'#68cdbc':'#8865da',0.28*warp);
  /* The far side bends up around the silhouette, like a lensed accretion disc. */
  ctx.globalCompositeOperation='lighter';
  for(let k=0;k<18;k++){
    const f=k/17,rr=r*(1.07+f*1.35);
    ctx.strokeStyle=k<5?'#ffe9c4':col;ctx.globalAlpha=warp*(0.08+0.22*(1-f))*(0.7+0.3*charge);
    ctx.lineWidth=(k<5?1.8:1)*u;
    ctx.beginPath();ctx.ellipse(0,-r*0.04,rr,rr*(0.33+0.03*f),0,Math.PI,TAU);ctx.stroke();
    if(k<8){ctx.globalAlpha=warp*0.14;ctx.beginPath();ctx.ellipse(0,0,r*(1.04+f*0.5),r*(1.04+f*0.5),0,Math.PI,TAU);ctx.stroke();}
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=warp;ctx.fillStyle='#010208';
  ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
  ctx.globalCompositeOperation='lighter';
  for(const [mul,w,a] of [[1.025,1.5,0.85],[1.065,2.7,0.25],[1.15,5,0.08]]){
    ctx.strokeStyle=col;ctx.lineWidth=w*u;ctx.globalAlpha=a*warp;
    ctx.beginPath();ctx.arc(0,0,r*mul,0,TAU);ctx.stroke();
  }
  for(let k=0;k<20;k++){
    const f=k/19,rr=r*(1.06+f*1.35),phase=RM?0:G.vt*(0.25+0.2*(1-f));
    ctx.globalAlpha=warp*(0.26-0.18*f)*(0.65+0.35*charge);
    ctx.strokeStyle=k<5?'#fff1d1':k%3?'#ffb978':'#c19bff';ctx.lineWidth=(1.2+0.7*(1-f))*u;
    ctx.beginPath();ctx.ellipse(0,0,rr,rr*0.33,0,0,Math.PI);ctx.stroke();
    ctx.globalAlpha=warp*0.72*(1-f);ctx.lineWidth=1.2*u;
    const a=(phase+k*1.41)%Math.PI;
    ctx.beginPath();ctx.ellipse(0,0,rr,rr*0.33,0,a,Math.min(Math.PI,a+0.18));ctx.stroke();
  }
  ctx.restore();
  if(BH.phase===2&&!BH.escape&&BH.pullT>BH_PULL-1){
    const q=BH.pullT-(BH_PULL-1),r2=radiusOf(G.nRings-1);
    // The impending pull moves two small inward chevrons beside the comet;
    // it never brightens the circumference on every gravity cycle.
    ctx.save();ctx.strokeStyle='#c5a58e';ctx.globalAlpha=0.5;ctx.lineWidth=1.4*u;
    const rr=r2+(1-q)*18*u;
    for(const side of [-1,1]){
      const a=G.angle+side*.17,l=posAt(a-.028,rr+5*u),tip=posAt(a,rr-2*u),r=posAt(a+.028,rr+5*u);
      ctx.beginPath();ctx.moveTo(l[0],l[1]);ctx.lineTo(tip[0],tip[1]);ctx.lineTo(r[0],r[1]);ctx.stroke();
    }
    ctx.restore();
  }
}
function drawCometFins(p,pal){
  if(G.state==='dead')return;
  const hyper=!bhActive()?Math.min(1,G.hyperGlow||0):0,scorch=!bhActive()&&G.scorch>0;
  const col=scorch?'#ffc16f':hyper?'#ff9ce4':'#b4faff';
  const heading=G.angle+Math.PI/2*G.dir;
  ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(heading);ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=Math.min(1,pal)*(0.55+0.3*hyper);ctx.fillStyle=col;
  for(const sign of [-1,1]){
    ctx.beginPath();ctx.moveTo(4*u,0);ctx.quadraticCurveTo(-4*u,sign*8*u,-(19+hyper*12)*u,sign*(4+hyper*5)*u);
    ctx.quadraticCurveTo(-7*u,sign*2*u,4*u,0);ctx.fill();
  }
  ctx.fillStyle='#fffef4';ctx.globalAlpha=Math.min(1,pal);ctx.beginPath();ctx.ellipse(1*u,0,5.8*u,2.7*u,0,0,TAU);ctx.fill();
  ctx.restore();
  if(G.shields>0){
    ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(heading);ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=COL.shield;ctx.globalAlpha=0.62*pal;ctx.lineWidth=1.2*u;
    ctx.beginPath();ctx.moveTo(-3*u,-10*u);ctx.lineTo(7*u,-7*u);ctx.lineTo(12*u,0);ctx.lineTo(7*u,7*u);ctx.lineTo(-3*u,10*u);ctx.stroke();
    ctx.globalAlpha=0.12*pal;ctx.lineTo(0,0);ctx.closePath();ctx.fillStyle=COL.shield;ctx.fill();ctx.restore();
  }
}

function draw(){
  /* ALWAYS start from a known-good canvas state. A thrown frame leaves the
     transform stack dirty (save without restore, translate still applied)
     and can leak globalAlpha, compositing mode, or line dashes into every
     subsequent frame. setTransform resets the matrix; the two attribute
     resets below cover the rendering state that draw() changes most often.
     The save stack still grows by one per thrown frame, but since we never
     read from it without our own matching save, the orphaned entries are
     inert — they cost a few bytes of browser memory and nothing else. */
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  /* the ambient clock: the camera dolly, the sky's own drift and every
     background LFO ride this, so they slow with the world — see G.vt */
  const amb=RM?0:G.vt;
  /* One scenic field on either rendering path. A failed GL draw hands this
     same frame to the fallback, so a context loss cannot leave an empty sky. */
  if(GL.on){glRender(0);ctx.clearRect(0,0,W,H);}
  if(!GL.on)drawCalmSky();
  const camX=RM?0:Math.sin(amb*0.065)*1.4*u,camY=RM?0:Math.cos(amb*0.051)*1.4*u;
  paX=camX*PARA_K*ARENA_PARALLAX;paY=camY*PARA_K*ARENA_PARALLAX;
  ctx.globalCompositeOperation='source-over';
  drawSingularity();
  /* The sky director already owns scene colour. No stacked fullscreen washes
     or second dark pool are applied over its composition. */
  ctx.globalAlpha=1;

  ctx.save();
  ctx.translate(camX,camY);   /* the world rides the dolly; HUD stays pinned */
  drawCurrentWake();
  flightShakeX=0;flightShakeY=0;
  if(G.shake>0){
    flightShakeX=rand(-G.shake,G.shake)*0.5;flightShakeY=rand(-G.shake,G.shake)*0.5;
    ctx.translate(flightShakeX,flightShakeY);
  }

  /* Magnet connections follow the stars actually captured by its field. */
  if(G.spot>0&&!bhActive()){
    const pp=posPlayer();ctx.save();ctx.globalCompositeOperation='lighter';
    impactHalo(pp[0],pp[1],42*u,COL.comet,0.13);
    for(const st of G.stars){
      if(!st.mag)continue;const p2=starVisualPos(st);
      ctx.strokeStyle='#ffdf9c';ctx.globalAlpha=0.32;ctx.lineWidth=1.1*u;
      ctx.beginPath();ctx.moveTo(p2[0],p2[1]);
      ctx.quadraticCurveTo((p2[0]+pp[0])/2+12*u,(p2[1]+pp[1])/2-16*u,pp[0],pp[1]);ctx.stroke();
    }
    ctx.restore();
  }
  drawPowerAtmosphere();
  drawOrbitalRails();
  /* THE METER IS INVISIBLE NOW (owner: "get rid of the purple build-up
     timer — just have the beat drop incorporated into ideal moments for
     musical impact"). The build economy still runs underneath — playing
     well still brings the drop sooner, and it still latches on a bar
     line — but the fuel-gauge presentation (the violet arc, its white
     armed state, and the payoff drain sweep at the same radius) is gone.
     The drop announces itself the musical way: the shaker leaning in,
     BEAT DROP COMING…, the rise, and the countdown. */
  /* A steady reference point for the orbital geometry. */
  ctx.globalCompositeOperation='lighter';
  if(SPR.core){
    const S=Math.min(1,radiusOf(G.nRings-1)/(50*u));
    /* AND IT GOES OUT INSIDE A BLACK HOLE. This lamp is the light source the
       whole scene answers to and it sits at dead centre — which is precisely
       where the singularity's shadow is. Screenshotted at full mode, the hole
       had a bright white star burning in the middle of it: the one object in
       the game whose entire read is that light goes IN and does not come out,
       lit from inside. It fades with BH.warp, so it leaves and returns with
       the orbits. */
    const lamp=1-Math.min(1,BH.warp);
    if(lamp>0.004)blit(SPR.core,cx,cy,S*0.75,0,lamp*0.18);
  }
  ctx.globalCompositeOperation='source-over';
  /* Ring light is supplied by the single path pass above. */

  /* ---- SCORCH: the ground that is still burning ----
     Drawn on the ring itself and UNDER the shards, so a red standing in the
     fire is still read as a red first — the burn is information about the
     lane, not a thing competing with the hazard for attention. Each sector
     fades on its own clock, which is what makes a wake look like a wake:
     the far end of it is always going out while the near end is being laid. */
  if(G.burn&&G.state==='playing'&&!bhActive()){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='butt';
    const step=TAU/BURN_SECT;
    for(let r2=0;r2<G.burn.length&&r2<G.nRings;r2++){
      const arc=G.burn[r2],rr2=radiusOf(r2);
      if(rr2<=0)continue;
      for(let q=0;q<BURN_SECT;q++){
        const v=arc[q];
        if(v<=0.01)continue;
        const f=Math.min(1,v/BURN_LIFE);
        ctx.globalAlpha=0.16+0.52*f*f;
        ctx.strokeStyle=COL.scorch;
        ctx.lineWidth=(1.6+3.4*f)*u;
        const a0=q*step;
        ctx.beginPath();
        ctx.ellipse(ecx(rr2),ecy(rr2),rr2,rr2*AY,0,a0,a0+step*1.04);
        ctx.stroke();
      }
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  /* lap progress arc — colour reports how well fed this orbit is */
  if(G.state==='playing'&&G.lapAcc>0.05){
    const lr=curR()+6*u;
    let a0,a1;
    if(G.dir===1){a0=G.angle-G.lapAcc;a1=G.angle;}
    else{a0=G.angle;a1=G.angle+G.lapAcc;}
    /* THE ARC CLOSES VISIBLY NOW. It was one flat stroke at 0.55 alpha and 3px
       for the whole lap, which reports "something is being counted" and never
       "this is nearly done" — and a progress reading that does not tighten
       toward its end is not read as progress at all. That is part of why the
       mechanic went unnoticed: the one channel that showed a lap in flight
       looked identical at 5% and at 95%. Both alpha and width now climb with
       the lap, so closing one has a visible approach as well as a payout. */
    const lk=G.lapAcc/TAU;
    ctx.globalAlpha=0.24+0.25*lk;
    ctx.strokeStyle=G.lapEmbers>=3?COL.ember:(G.lapEmbers>=1?COL.comet:'rgba(170,195,255,0.55)');
    ctx.lineWidth=(1.0+0.7*lk)*u;
    ctx.beginPath();ctx.ellipse(ecx(lr),ecy(lr),lr,lr*AY,0,a0,a1);ctx.stroke();
    ctx.globalAlpha=1;
  }
  /* THE COST OF TURNING BACK, DRAWN. On a committed reverse the discarded
     lap arc burns off — retracting toward where the comet turned, fading as
     it goes — so the economy's one hidden rule is WATCHED, every time, with
     no words and no sound requirement. Reduced motion gets a plain fade. */
  if(G.state==='playing'&&G.lapFx){
    const f=G.lapFx,k=Math.min(1,f.t/0.45);
    const rr=curR()+6*u,keep=f.acc*(RM?1:1-k);
    let b0,b1;
    if(f.dir===1){b0=f.a-keep;b1=f.a;}
    else{b0=f.a;b1=f.a+keep;}
    ctx.globalAlpha=0.5*(1-k);
    ctx.strokeStyle='rgba(255,205,120,0.9)';
    ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,b0,b1);ctx.stroke();
    ctx.globalAlpha=1;
  }
  /* embers banked this orbit are drawn in the HUD — see drawHUD */
  /* Gesture guide: start dragging and the radial axis appears, so which way
     is "out" is never something you have to work out in your head. During
     the hop rehearsal it appears PROACTIVELY at the comet's live position,
     rotating with it — the one place the rotating gesture can be shown —
     and brightens on a pulse while the lesson is live. */
  const teachGuide=G.teach>0&&G.teachKind==='hop'&&!(pd&&pd.far>12);
  if(((pd&&pd.far>12)||teachGuide)&&G.state==='playing'&&G.nRings>1){
    const ga=teachGuide?G.angle:pd.ang;
    const ca=Math.cos(ga),sa=Math.sin(ga);
    const rIn=Math.max(9*u,radiusOf(G.nRings-1)-17*u),rOut=radiusOf(0)+21*u;
    /* the guide spans the whole stack, so each END takes its own orbit's
       depth — one offset for the pair would lean it against the rings it is
       drawn to line up with */
    const gIn=[ecx(rIn),ecy(rIn)],gOut=[ecx(rOut),ecy(rOut)];
    ctx.save();
    ctx.globalAlpha=teachGuide?0.4:0.3;
    ctx.strokeStyle=COL.comet;ctx.lineWidth=1.5;
    ctx.setLineDash([5*u,5*u]);
    ctx.beginPath();
    ctx.moveTo(gIn[0]+ca*rIn,gIn[1]+sa*rIn);
    ctx.lineTo(gOut[0]+ca*rOut,gOut[1]+sa*rOut);
    ctx.stroke();
    ctx.setLineDash([]);
    const head=function(rr,facing,al){
      ctx.globalAlpha=al;
      ctx.save();
      ctx.translate(ecx(rr)+ca*rr,ecy(rr)+sa*rr);
      ctx.rotate(ga+(facing>0?0:Math.PI));
      ctx.beginPath();
      ctx.moveTo(8*u,0);ctx.lineTo(-4*u,5*u);ctx.lineTo(-4*u,-5*u);ctx.closePath();
      ctx.fillStyle=COL.comet;ctx.fill();
      ctx.restore();
    };
    head(rOut,1,G.ringI>0?0.8:0.18);              /* outward */
    head(rIn,-1,G.ringI<G.nRings-1?0.8:0.18);     /* inward */
    ctx.globalAlpha=1;ctx.restore();
  }
  /* slow-mo timer arc */
  if(G.slow>0&&!bhActive()){
    ctx.strokeStyle=COL.warp;ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(cx,cy,14*u,-Math.PI/2,-Math.PI/2+TAU*(G.slow/(G.slowD||4)));ctx.stroke();
  }

  if(G.slipFx&&!bhActive()){
    const f=G.slipFx,rr=radiusOf(f.ring);
    const progress=Math.min(1,f.t/0.45);
    ctx.save();ctx.globalAlpha=(1-progress)*0.35;
    ctx.strokeStyle=COL.comet;ctx.lineWidth=1.5*u;
    ctx.beginPath();ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,f.a-0.48*progress,f.a+0.48*progress);ctx.stroke();ctx.restore();
  }
  if(!bhActive()){
    const route=G.stars.filter(st=>st.trail).sort((a,b)=>a.trailI-b.trailI);
    if(route.length){
      ctx.save();ctx.strokeStyle=COL.ember;ctx.lineWidth=1*u;ctx.globalAlpha=0.20;
      ctx.setLineDash([2*u,7*u]);ctx.beginPath();
      for(let i=0;i<route.length;i++){
        const p=starVisualPos(route[i]);
        if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
      }
      ctx.stroke();ctx.restore();
    }
  }
  /* All stars materialize gradually, including those converted by Nova. */
  ctx.globalCompositeOperation='source-over';
  for(const s of G.stars){
    if(s.flight&&s.t<s.flight.delay)continue;
    const p=starVisualPos(s);
    let al=1;
    if(s.t<0.45)al=s.t/0.45;
    else if(s.life-s.t<0.8)al=Math.max(0,(s.life-s.t)/0.8);
    if(s.flight&&!s.mag&&s.t<s.flight.delay+s.flight.duration&&!RM){
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      for(const [width,alpha] of [[6,.12],[2,.58]]){
        ctx.strokeStyle=width>2?COL.ember:'#fff0b5';ctx.lineWidth=width*u;ctx.globalAlpha=alpha*al;
        ctx.beginPath();
        for(let j=0;j<=8;j++){
          const q=starfallFlightPos(s,Math.max(s.flight.delay,s.t-.16*(1-j/8)));
          if(j===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    artifactStar(p[0],p[1],s,al);
  }
  /* power-ups */
  for(const s of G.pows){
    const p=posAt(s.a,radiusOf(s.ring));
    let al=1;
    if(s.t<0.3)al=s.t/0.3;
    else if(s.life-s.t<0.8)al=(s.life-s.t)/0.8;
    drawPow(p[0],p[1],s,al);
  }
  /* Gate bars: a rung across every ring reads instantly as "you cannot hop
     past". Built as a wide soft pass under a tight core so it registers as
     energy rather than a drawn line, and overhangs both ends of the ring
     stack so it reads as a barrier across the field, not a chord within it. */
  /* THE ANCHOR IS NOT ALWAYS RING 0. This loop drew one rung across the whole
     stack from the segment sitting on ring 0, which is correct for a gate —
     a gate always has one — and wrong for THE NARROWS, whose open lane may BE
     ring 0. There the bar would simply never have drawn: a wall with no
     picture, on the formation whose entire read is which lane is missing.
     So the anchor is tagged at spawn (`bar`) and the span is computed from
     the gap: contiguous runs of blocked rings, one rung each, with the open
     lane left as a visible hole. A gate is the degenerate case — one run
     covering every ring — and draws exactly as it always did. */
  for(const s of G.spikes){
    if(!s.gate||s.phase===2)continue;
    if(s.funnel?!s.bar:s.ring!==0)continue;
    const runs=[];
    let run=[];
    for(let k=0;k<G.nRings;k++){
      if(s.funnel&&k===s.gap){if(run.length)runs.push(run);run=[];}
      else run.push(k);
    }
    if(run.length)runs.push(run);
    const live=s.phase===1&&armed(s);
    const base=live?0.44:0.26;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=COL.shard;ctx.lineCap='round';
    for(const rn of runs){
      /* index 0 is the OUTERMOST orbit, so rn[0] is the widest radius of the
         run and rn[last] the tightest — the overhang goes outward at the top
         and inward at the bottom, which is what it has always done.
         WHERE A RUN STOPS IS THE WHOLE PICTURE. The first cut ended every run
         11u either side of its own rings, which for a funnel meant two 22u
         stubs sitting around two diamonds — measured on a 390px phone, a
         formation whose entire read is "one lane is open" drew as two
         ordinary shards that happened to line up, and the gap it is named for
         was not a gap in anything. A run that ends at the OPEN LANE instead
         stops halfway between the last blocked orbit and the free one, so the
         wall visibly runs up to the hole and stops. Only the outermost and
         innermost ends keep the overhang; every other end is a cut edge. */
      const o0=rn[0],o1=rn[rn.length-1];
      const rOut=o0===0?radiusOf(0)+11*u:(radiusOf(o0)+radiusOf(o0-1))/2;
      const rIn=o1===G.nRings-1?Math.max(5*u,radiusOf(o1)-11*u)
                               :(radiusOf(o1)+radiusOf(o1+1))/2;
      const i0=posAt(s.a,rOut);
      const i1=posAt(s.a,rIn);
      ctx.globalAlpha=base*0.30;ctx.lineWidth=10*u;
      ctx.beginPath();ctx.moveTo(i0[0],i0[1]);ctx.lineTo(i1[0],i1[1]);ctx.stroke();
      ctx.globalAlpha=base*0.9;ctx.lineWidth=2.2*u;
      ctx.beginPath();ctx.moveTo(i0[0],i0[1]);ctx.lineTo(i1[0],i1[1]);ctx.stroke();
      if(live&&!RM){
        /* rungs crawling along the span sell it as powered rather than painted
           — STEPPING once per eighth, so even the wall marches in time */
        ctx.globalAlpha=0.45;ctx.lineWidth=2.6*u;
        ctx.setLineDash([5*u,9*u]);
        ctx.lineDashOffset=-(G.vt*9*u)%(14*u);
        ctx.beginPath();ctx.moveTo(i0[0],i0[1]);ctx.lineTo(i1[0],i1[1]);ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    /* THE OPEN LANE IS DRAWN AS AN INVITATION, not merely as an absence. A
       hole in a red wall is only readable if the eye is told it is a hole —
       two short safe-coloured brackets facing into the gap, on the beat, in
       the comet's own colour so it reads as "go here" rather than "danger". */
    if(s.funnel&&live&&!RM){
      const gr=radiusOf(s.gap);
      ctx.strokeStyle=COL.comet;ctx.lineWidth=2.4*u;
      ctx.globalAlpha=0.45;
      for(const d of [-1,1]){
        const e0=posAt(s.a,gr+d*9*u),e1=posAt(s.a,gr+d*3.5*u);
        ctx.beginPath();ctx.moveTo(e0[0],e0[1]);ctx.lineTo(e1[0],e1[1]);ctx.stroke();
      }
    }
    ctx.restore();
  }
  /* shards */
  for(const s of G.spikes){
    const p=posAt(s.a,radiusOf(s.ring));
    /* The hull is a faceted red craft; its ring-wide shot remains literal. */
    if(s.saucer){
      const rr=radiusOf(s.ring),chg=s.chg>0?1-s.chg/SAUCER_CHG:0;
      if(s.fire>0){
        ctx.save();
        ctx.globalAlpha=0.62;
        ctx.strokeStyle=COL.shard;ctx.lineWidth=2.4*u;
        ctx.beginPath();ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,0,TAU);ctx.stroke();
        ctx.restore();
      }
      const arr=s.phase===0?Math.min(1,s.t/(s.warn||WARN)):(s.phase===2?Math.max(0,1-s.t/FADE):1);
      const rot=Math.atan2(p[1]-cy,p[0]-cx)+Math.PI/2;
      const scale=1+0.22*chg;
      blit(artifactSprite('saucer'),p[0],p[1],scale,rot,0.35+0.65*arr);
      ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(rot);
      /* Three lamps fill in order as the ring shot charges. */
      for(let q=-1;q<=1;q++){
        const lit=chg>(q+2)/4;
        ctx.globalAlpha=arr*(lit?0.95:0.25);
        ctx.fillStyle=lit?'#ffe6ec':COL.shard;
        const xx=q*4.5*u*scale,yy=3.4*u*scale,r=(lit?1.55:1)*u;
        artifactPoly(ctx,[[xx,yy-r],[xx+r,yy],[xx,yy+r],[xx-r,yy]]);ctx.fill();
      }
      ctx.restore();
      rimLight(p[0],p[1],0.95*scale,(0.35+0.65*arr)*0.35);
      ctx.globalAlpha=1;
      continue;
    }
    /* drifters trail a short arc showing which way they are sliding */
    if(s.va&&s.phase===1){
      const rr=radiusOf(s.ring),back=-Math.sign(s.va)*0.30;
      ctx.globalAlpha=0.3;ctx.strokeStyle=COL.shard;ctx.lineWidth=2.5;
      ctx.beginPath();
      ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,Math.min(s.a,s.a+back),Math.max(s.a,s.a+back));
      ctx.stroke();ctx.globalAlpha=1;
    }
    /* A DIVER TELEGRAPHS ITS DESTINATION, NOT JUST ITS ARRIVAL. The whole
       formation is only fair because the lane it lands in is readable before
       it lands, so the pending transfer is drawn as a radial run from the
       shard to the orbit it is heading for, with a chevron sitting ON that
       orbit. Before the transfer it points where the shard is going; after
       it, the trace fades from where the shard came from — so a player who
       looked away for the moment itself can still reconstruct it. */
    if(s.dive&&s.phase===0){
      const from=radiusOf(s.dive===1?s.ring:s.diveTo),to=radiusOf(s.dive===1?s.diveTo:s.ring);
      const going=s.dive===1;
      const q=going?Math.min(1,s.t/Math.max(0.001,(s.warn||WARN)*0.55))
                   :Math.max(0,1-(s.t-(s.warn||WARN)*0.55)/Math.max(0.001,(s.warn||WARN)*0.45));
      ctx.save();
      ctx.strokeStyle=COL.shard;ctx.lineCap='round';
      ctx.globalAlpha=0.42;
      ctx.lineWidth=2.2*u;
      const r0=posAt(s.a,from),r1=posAt(s.a,to);
      ctx.beginPath();ctx.moveTo(r0[0],r0[1]);ctx.lineTo(r1[0],r1[1]);ctx.stroke();
      /* the chevron sits on the destination orbit and opens along the travel
         direction — outward-bound points out, inward-bound points in */
      const dir=to<from?-1:1;
      const w0=posAt(s.a-0.055,to-dir*5.5*u),w1=posAt(s.a+0.055,to-dir*5.5*u);
      const tip=posAt(s.a,to+dir*1.5*u);
      ctx.globalAlpha=0.30+0.45*q;ctx.lineWidth=2.6*u;
      ctx.beginPath();ctx.moveTo(w0[0],w0[1]);ctx.lineTo(tip[0],tip[1]);ctx.lineTo(w1[0],w1[1]);ctx.stroke();
      ctx.restore();
    }
    artifactShard(p[0],p[1],s);
  }
  /* Nova's open contour follows the exact conversion radius. Moving broken
     edges explain which threats it has reached without a white blast sheet. */
  ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
  for(const n of G.novas){
    const lf=Math.max(n.life,0),rr=Math.max(0.1,n.r);
    ctx.globalAlpha=Math.min(0.6,lf*0.6);ctx.strokeStyle='#91cdda';ctx.lineWidth=1.7*u;
    for(let j=0;j<10;j++){
      const a=j*TAU/10;
      ctx.beginPath();ctx.arc(n.x,n.y,rr,a,a+TAU/10*0.64);ctx.stroke();
      const b=a+TAU/10*0.64,tail=Math.max(0,rr-18*u);
      ctx.beginPath();ctx.moveTo(n.x+Math.cos(b)*tail,n.y+Math.sin(b)*tail);
      ctx.lineTo(n.x+Math.cos(b+0.035)*rr,n.y+Math.sin(b+0.035)*rr);ctx.stroke();
    }
  }
  /* A short gold marker travels the completed orbit and leaves the rest of
     the ring clear. The score payout, rather than a bright ring, banks value. */
  for(const L of G.laps){
    const lf=Math.max(L.life,0),age=(1-lf)/1.35;
    const sweep=RM?0:Math.min(1,age/0.65)*TAU;
    const rr=radiusOf(L.ring)+8*u,head=L.a+L.dir*sweep;
    const tail=head-L.dir*(RM?0.28:Math.min(0.46,sweep+0.04));
    ctx.strokeStyle='#d5aa69';ctx.globalAlpha=Math.min(0.62,lf*0.62*(L.mag||1));
    ctx.lineWidth=1.8*u;
    ctx.beginPath();ctx.ellipse(ecx(rr),ecy(rr),rr,rr*AY,0,Math.min(tail,head),Math.max(tail,head));ctx.stroke();
  }
  /* Contact marks move apart along the affected lane, then dissolve. */
  for(const a of G.arcs){
    const lf=Math.max(a.life,0),offset=0.06+0.32*(1-lf),ar=radiusOf(a.ring);
    ctx.globalAlpha=lf*0.44;ctx.strokeStyle=a.col;ctx.lineWidth=1.35*u;
    for(const side of [-1,1]){
      const at=a.a+side*offset;
      ctx.beginPath();ctx.ellipse(ecx(ar),ecy(ar),ar,ar*AY,0,at-0.055,at+0.055);ctx.stroke();
    }
  }
  /* Impact contours retain position and travel; no full-ring or baked flash. */
  for(const r of G.rings){
    const lf=Math.max(r.life,0),base=Math.atan2(r.y-cy,r.x-cx);
    ctx.globalAlpha=lf*(r.fat?0.28:0.22);ctx.strokeStyle=r.col;ctx.lineWidth=(r.fat?1.6:1.0)*u;
    for(let j=0;j<3;j++){
      const a=base+j*TAU/3;
      ctx.beginPath();ctx.arc(r.x,r.y,Math.max(0.1,r.r),a,a+0.5);ctx.stroke();
    }
  }
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  drawImpactEvents();
  /* Comet tail: a single tapered ribbon rather than a chain of dots, drawn
     in three additive passes so it falls off like light instead of paint. */
  drawTail();
  if(G.state!=='dead'){
    const p=posPlayer();
    const pal=1; // Protection uses an outline; the player never flickers.
    ctx.globalCompositeOperation='lighter';
    blit(SPR.cometGlow,p[0],p[1],1,0,pal);
    ctx.globalCompositeOperation='source-over';
    /* THE COMET READS AS TRAVELLING. The teardrop is rotated to its heading;
       a committed reverse sweeps the nose end-for-end through the radial
       over 90ms (never on the speculative flip — only reverseFX starts it,
       so a rollback can never show a turn that did not happen); a hop
       stretches it along the radial and thins it, settling on arrival. RM
       keeps the static orientation and skips the animation. */
    let dv=G.dir;
    if(!RM&&G.revFlip>G.t)dv=G.dir*(1-2*(G.revFlip-G.t)/0.09);
    const hopping=G.hopP<1,hs=(!RM&&hopping)?Math.sin(Math.PI*G.hopP):0;
    ctx.save();
    ctx.translate(p[0],p[1]);
    ctx.rotate(G.angle+Math.PI/2*dv);
    if(hs>0)ctx.scale(1-0.12*hs,1+0.26*hs);  /* local y is the radial */
    /* SPAGHETTIFICATION: tidal stretching toward the singularity during BH.
       Local y is the radial, so scaling y stretches toward/away from centre.
       The factor grows with BH.warp so it arrives and leaves with the orbits,
       and the thinning on x preserves apparent area so the comet looks pulled
       rather than inflated. */
    if(!RM&&BH.warp>0){
      const sph=0.22*BH.warp;
      ctx.scale(1-sph*0.4,1+sph);
    }
    ctx.globalAlpha=pal;
    const cometArt=host.getTexture?host.getTexture('comet-core'):null;
    const cd=cometArt?72*u:SPR.comet.s;
    if(cometArt)ctx.drawImage(cometArt,-cd*.624,-cd*.482,cd,cd);
    else ctx.drawImage(SPR.comet.c,-cd/2,-cd/2,cd,cd);
    /* A steady hot core. Heat is expressed by the moving wake, never flicker. */
    if(SPR.cometHot&&!cometArt){
      ctx.globalCompositeOperation='lighter';
      const hs=SPR.cometHot.s;
      ctx.globalAlpha=pal*0.5;
      ctx.drawImage(SPR.cometHot.c,-hs/2,-hs/2,hs,hs);
      ctx.globalCompositeOperation='source-over';
    }
    ctx.globalAlpha=1;
    ctx.restore();
    /* ---- THE MIRROR, DRAWN AS THE OTHER HALF OF YOU ----
       Same silhouette, same size, in the orb's blue, at G.angle + pi on the
       same ring — and drawn BEFORE the comet's own furnace pass below, so if
       the two ever overlap on screen the real one is the one on top. It gets
       a countdown ring like the star and the spotlight, because a timed state
       whose end is invisible is the exact complaint two playtesters raised
       about the hypernova and the spotlight in turn; there is no reason to
       ship a third one and wait to be told a third time. */
    if(G.mirror>0&&!bhActive()){
      const mp=posAt(G.mirrorA,curR());
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      for(const [w,al] of [[8,0.08],[3,0.4],[0.8,0.9]]){
        ctx.strokeStyle=w<2?'#e8f5ff':COL.mirror;ctx.lineWidth=w*u;ctx.globalAlpha=al*Math.min(1,G.mirror/0.45);
        ctx.beginPath();
        for(let j=0;j<24;j++){
          const a=G.mirrorA-G.dir*0.66*(1-j/23),p2=posAt(a,curR());
          if(j===0)ctx.moveTo(p2[0],p2[1]);else ctx.lineTo(p2[0],p2[1]);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      const mf=Math.min(1,G.mirror/0.45);       /* it fades out, never cuts */
      ctx.globalAlpha=0.85*mf;
      ctx.translate(mp[0],mp[1]);
      ctx.rotate(G.mirrorA+Math.PI/2*(G.dir>0?1:-1));
      const md=cometArt?72*u:SPR.comet.s;
      if(cometArt)ctx.drawImage(cometArt,-md*.624,-md*.482,md,md);
      else ctx.drawImage(SPR.comet.c,-md/2,-md/2,md,md);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha=0.55*mf;
      ctx.fillStyle=COL.mirror;
      ctx.beginPath();ctx.arc(mp[0],mp[1],4.4*u,0,TAU);ctx.fill();
      ctx.globalAlpha=0.9*mf;
      ctx.strokeStyle=COL.mirror;ctx.lineWidth=2.0*u;ctx.lineCap='round';
      const mfr=Math.max(0,Math.min(1,G.mirror/Math.max(0.001,G.mirrorD)));
      ctx.beginPath();
      ctx.arc(mp[0],mp[1],13*u,-Math.PI/2,-Math.PI/2+TAU*mfr);
      ctx.stroke();
      ctx.restore();ctx.globalAlpha=1;
    }
    drawBeat(p);
    if(!cometArt)drawCometFins(p,pal);
    if(G.hyperGlow>0.01&&!bhActive()){
      /* Two stable fins identify Hypernova while the wake carries its speed. */
      ctx.save();ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=0.6*G.hyperGlow;
      ctx.strokeStyle=COL.hyper;ctx.lineWidth=1.8*u;
      const a=G.angle+G.dir*Math.PI/2;
      for(const side of [-1,1]){
        ctx.beginPath();ctx.arc(p[0],p[1],16*u,a+side*1.1-0.38,a+side*1.1+0.38);ctx.stroke();
      }
      ctx.restore();ctx.globalAlpha=1;
    }
    /* Remaining orb time lives together in the HUD; the comet stays legible. */
    if(G.t<G.invuln){
      ctx.globalAlpha=Math.min(1,(G.invuln-G.t)*1.6)*0.55;
      ctx.strokeStyle=COL.shield;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(p[0],p[1],19*u,0,TAU);ctx.stroke();
      ctx.globalAlpha=1;
    }
  }
  /* Debris has a stable faceted body aligned to velocity. Overlapping pieces
     use normal compositing, so a collision cannot sum into a white disk. */
  ctx.globalCompositeOperation='source-over';
  for(const p of G.parts){
    const lf=Math.max(p.life,0),r=p.size*lf+0.5;
    const speed=Math.hypot(p.vx,p.vy),reach=r+Math.min(12*u,speed*0.045);
    ctx.globalAlpha=Math.min(0.62,lf*0.62);ctx.fillStyle=p.col;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.beginPath();ctx.moveTo(reach,0);ctx.lineTo(-r,r*0.55);
    ctx.lineTo(-reach*0.55,0);ctx.lineTo(-r,-r*0.55);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  /* Bloom sits inside the shaken transform so it stays registered with the
     world it is blooming, and under the popups so text stays crisp. */
  drawBloom();
  /* score popups: punch in over the first ~110ms, hold readable, snap out —
     a linear fade is the least alive curve there is. Big lines get the same
     one-pixel dark offset the hint text uses, so they stay crisp over bloom. */
  ctx.textAlign='center';
  /* POPUPS ARE CLAMPED TO THE SCREEN NOW. They spawn at the object that
     caused them — the comet, a shard, an orb — which is in orbit, so a good
     fraction of them are born within half a string's width of an edge. They
     draw centred and were clamped by nothing at all: measured by wrapping
     text() and reading ctx.measureText across four viewports, "SHIELD USED ·
     1 LEFT" rendered from x=-99 to x=135 on a 390px phone. A quarter of the
     sentence was off the glass, on the one popup that fires at the moment a
     player most needs to read it, and the same on every viewport tested.
     Shrink first so a long line stays as large as it can, then slide the box
     inside the margins — sliding alone cannot save a string wider than the
     screen, and shrinking alone leaves it hanging off the edge. */
  for(let pi=0;pi<G.pops.length;pi++){
    const p=G.pops[pi];
    const lf=Math.max(p.life,0);
    /* newest at full weight, each older one a step back — the column reads
       as one statement with its history behind it rather than four claims */
    const rank=G.pops.length-1-pi;
    ctx.globalAlpha=Math.min(1,lf*3)*(rank?Math.max(0.34,1-0.26*rank):1);
    let fs=14*u*(p.sz||1)*(RM?1:1+0.4*Math.max(0,lf-0.88)/0.12);
    const mg=8*u;
    fs=fitSz(p.str,fs,'800',W-mg*2,1);
    ctx.font='800 '+Math.round(fs)+'px '+F;
    const hw=ctx.measureText(p.str).width/2+1*p.str.length/2;
    const px=Math.max(mg+hw,Math.min(W-mg-hw,p.x));
    if((p.sz||1)>1.2)text(p.str,px+1.5,p.y+1.5,fs,'800','rgba(4,8,20,0.85)',1);
    text(p.str,px,p.y,fs,'800',p.col,1);
  }
  ctx.globalAlpha=1;
  ctx.restore();

  /* The world keeps rendering behind the game-over text — rings, embers and
     fading shards all competing with the score. Drop it back before the HUD
     goes on so the numbers you actually came for are legible. */
  if(G.state==='dead'){
    /* Held back 0.45s so the explosion and shockwave play in the open — the
       scrim used to reach 80% black while the death was still happening. */
    ctx.fillStyle='rgba(6,9,19,'+(Math.min(1,Math.max(0,G.t-G.deadT-0.45)/0.35)*0.80).toFixed(3)+')';
    ctx.fillRect(0,0,W,H);
  }
  drawHUD();
  drawMute();
  drawPauseBtn();
  drawShieldBtn();
  drawShareBtn();
  /* over the HUD, not under it: the score and the shard count are worth
     studying too, so the blackout has to cover them as well as the arena */
  drawPausePanel();
  // Death is the comet breaking apart and the result arriving. No inverted
  // white impact frame is drawn above the world or its controls.
}

function drawShieldBtn(){
  if(G.state!=='playing'||G.intro)return;
  const r=shieldRect(),midY=r.y+r.h/2,has=G.shields>0;
  const pulse=has?0.6:0.22;
  ctx.save();
  /* No frame any more. It read as a button because it WAS one, and it is now
     a readout — a pill outline invites a press it no longer answers. */
  ctx.globalAlpha=1;
  /* one glyph per shield slot, matching the pickup icon */
  /* slots have to fit the widened bank, so the pitch closes up rather than
     the pips spilling out of the button */
  const mx=shieldMax(),gap=Math.min(30*u,(r.w-30*u)/Math.max(1,mx-1));
  const x0=r.x+r.w/2-(mx-1)*gap/2;
  const full=G.shields>=mx;
  for(let i=0;i<mx;i++){
    const on=i<G.shields,x=x0+i*gap;
    /* CLAMPED, because pulse peaks at 0.75 and +0.35 puts it at 1.10 — and a
       canvas IGNORES an out-of-range globalAlpha rather than clamping it, so
       the pip kept whatever alpha the previous draw had left behind. The
       breathing shield bank stuttered at the top of every breath. */
    ctx.globalAlpha=on?Math.min(1,pulse+0.35):0.16;
    /* a FULL bank runs gold: the overcharge multiplier, visible at a glance */
    ctx.strokeStyle=full?COL.ember:COL.shield;ctx.lineWidth=on?2.2:1.4;
    ctx.beginPath();ctx.arc(x,midY,9*u,0,TAU);ctx.stroke();
    if(on){
      ctx.fillStyle=full?COL.ember:COL.shield;
      ctx.beginPath();ctx.arc(x,midY,3.4*u,0,TAU);ctx.fill();
    }
  }
  ctx.globalAlpha=1;ctx.textAlign='center';
  text('SHIELDS  '+G.shields+' / '+mx,cx,midY-20*u,9*u,'500','#97acc4',1*u);
  ctx.restore();
}
function drawShareBtn(){
  if(LAB.on)return;   /* same rule as inShare: the button goes with the tap */
  if(G.state!=='dead'||G.t-G.deadT<=0.6||!deadSeqDone())return;
  const r=shareRect(),midY=r.y+r.h/2,rad=r.h/2;
  const copied=G.shareFx>G.t;
  ctx.save();
  ctx.globalAlpha=copied?0.85:0.5;
  ctx.strokeStyle=COL.comet;ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.moveTo(r.x+rad,r.y);ctx.lineTo(r.x+r.w-rad,r.y);
  ctx.arc(r.x+r.w-rad,midY,rad,-Math.PI/2,Math.PI/2);
  ctx.lineTo(r.x+rad,r.y+r.h);
  ctx.arc(r.x+rad,midY,rad,Math.PI/2,-Math.PI/2);
  ctx.closePath();ctx.stroke();
  ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.textBaseline='middle';
  text(copied?'COPIED':'SHARE',cx,midY,14*u,'800',COL.comet,3);
  ctx.restore();
}
/* The icon is drawn only when the button will actually answer — while the
   cooldown is running there is nothing to press, and an icon that ignores a
   tap is worse than no icon. */
function drawPauseBtn(){
  if(!canPause())return;
  const r=pauseRect(),x=r.x+r.w/2,y=r.y+r.h/2,s=r.w/2;
  ctx.save();
  ctx.globalAlpha=0.5;
  ctx.fillStyle='#cfe4ff';
  ctx.fillRect(x-s*0.46,y-s*0.62,s*0.32,s*1.24);
  ctx.fillRect(x+s*0.14,y-s*0.62,s*0.32,s*1.24);
  ctx.restore();
}
/* THE PANEL, AND THE BLACKOUT UNDER IT. The scrim is the balance decision made
   visible: at full opacity there is no board to read, so the button cannot buy
   a free look at a shard that is mid-telegraph. It is drawn over everything
   including the HUD, because the score and the shard count are worth studying
   too. During the countdown it lifts entirely — three frozen seconds to find
   the comet again is the point of counting down at all. */
function drawPausePanel(){
  if(!frozen())return;
  if(PAUSE.on){
    ctx.save();
    ctx.fillStyle='rgba(4,6,14,0.97)';
    ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    textFx('PAUSED',cx,cy-14*u,fitSz('PAUSED',30*u,'800',W-40*u,3),'800',
      '#ffffff','#7de4ff','rgba(93,240,255,0.45)',3);
    const sub='the board is hidden — it comes back on the count';
    text(sub,cx,cy+10*u,fitSz(sub,11*u,'600',W-30*u),'600','rgba(200,215,255,0.55)',0);
    const pw=Math.min(170*u,W-60*u),ph=44*u,px=cx-pw/2,py=cy+34*u;
    G.pauseBtn={x:px,y:py,w:pw,h:ph};
    ctx.strokeStyle=COL.comet;ctx.lineWidth=1.8;
    ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.roundRect(px,py,pw,ph,ph/2);ctx.stroke();
    ctx.globalAlpha=1;
    ctx.textBaseline='middle';
    textFx('RESUME',cx,py+ph/2,17*u,'800','#eaffff',COL.comet,'rgba(93,240,255,0.5)',4);
    ctx.textBaseline='alphabetic';
    ctx.restore();
    return;
  }
  /* counting back in: the world is visible and still, and nothing answers */
  G.pauseBtn=null;
  ctx.save();
  ctx.fillStyle='rgba(4,6,14,0.34)';
  ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  const n=Math.ceil(PAUSE.resumeT);
  /* the digit swells as each second lands — its phase comes from resumeT, not
     from G.t, which is the thing being held still */
  const fr=1-(PAUSE.resumeT-Math.floor(PAUSE.resumeT));
  const sc=RM?1:1+0.35*(1-Math.min(1,fr*3));
  ctx.textBaseline='middle';
  textFx(String(n),cx,cy,64*u*sc,'800','#ffffff','#7de4ff','rgba(93,240,255,0.5)',0);
  ctx.textBaseline='alphabetic';
  ctx.restore();
}
function drawMute(){
  const r=muteRect(),x=r.x+r.w/2,y=r.y+r.h/2,s=r.w/2;
  ctx.save();
  ctx.globalAlpha=muted?0.72:0.5;
  ctx.fillStyle='#cfe4ff';ctx.strokeStyle='#cfe4ff';
  ctx.lineWidth=1.8;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(x-s*0.8,y-s*0.28);ctx.lineTo(x-s*0.42,y-s*0.28);
  ctx.lineTo(x-s*0.02,y-s*0.72);ctx.lineTo(x-s*0.02,y+s*0.72);
  ctx.lineTo(x-s*0.42,y+s*0.28);ctx.lineTo(x-s*0.8,y+s*0.28);
  ctx.closePath();ctx.fill();
  ctx.beginPath();
  if(muted){
    ctx.moveTo(x+s*0.28,y-s*0.36);ctx.lineTo(x+s*0.8,y+s*0.36);
    ctx.moveTo(x+s*0.8,y-s*0.36);ctx.lineTo(x+s*0.28,y+s*0.36);
  }else{
    ctx.arc(x+s*0.14,y,s*0.36,-0.85,0.85);
    ctx.moveTo(x+s*0.14+s*0.68*Math.cos(-0.85),s*0.68*Math.sin(-0.85)+y);
    ctx.arc(x+s*0.14,y,s*0.68,-0.85,0.85);
  }
  ctx.stroke();
  ctx.restore();
}

/* EVERY RUN TEACHES. These used to stop after run six, on the theory that a
   veteran should never see them — but each one clears the instant the player
   does the thing, so a veteran sees each for well under a second and a new
   player gets the whole ladder no matter when they pick the game up. The flags
   they key off are all per-run now, so the sequence replays from the top every
   time without ever standing between anyone and the next input. */
/* SHOW THE GESTURE, DO NOT DESCRIBE IT. Every rung of this ladder used to be
   a sentence, read while dodging, in vocabulary the game had invented —
   "sparks", "track", "the bar". A sentence is the slowest possible way to
   teach a thumb movement. Each rung now carries a small animated diagram of
   the thing itself, drawn beside the words, and the words use only nouns that
   are visible on screen: rings, stars, shields. */
function hintGlyph(kind,x,y,s){
  const ph=RM?0.45:(G.t*0.85)%1;
  /* THE GLYPH FADES WITH ITS SENTENCE. Every alpha below used to be an
     absolute assignment, so a diagram ignored the globalAlpha its caller had
     just set and punched in at full brightness while the words beside it were
     still at zero. On the death screen that meant ~2.5 seconds of a lone red
     diamond floating over the ladder explaining nothing, and on every level
     card the row icons arrived before their own text. `ga` folds the caller's
     alpha into all of them; nothing draws brighter than the line it labels. */
  const ga=ctx.globalAlpha;
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#eaf3ff';ctx.fillStyle='#eaf3ff';ctx.lineWidth=1.9*u;
  if(kind==='tap'){
    /* a thumb press, and the reversal it causes */
    ctx.globalAlpha=ga*(0.45*(1-ph)+0.15);ctx.lineWidth=2.4*u;
    ctx.beginPath();ctx.arc(x,y,s*(0.26+0.5*ph),0,TAU);ctx.stroke();
    ctx.globalAlpha=ga*(0.95);
    ctx.beginPath();ctx.arc(x,y,s*0.23,0,TAU);ctx.fill();
    ctx.globalAlpha=ga*(0.85);ctx.lineWidth=2.2*u;
    for(const d of [-1,1]){
      ctx.beginPath();ctx.arc(x,y,s*0.62,d>0?-0.5:Math.PI-0.5,d>0?0.5:Math.PI+0.5);ctx.stroke();
      const a2=d>0?0.5:Math.PI+0.5, ax=x+Math.cos(a2)*s*0.62, ay=y+Math.sin(a2)*s*0.62;
      ctx.beginPath();ctx.moveTo(ax,ay);
      ctx.lineTo(ax-d*s*0.13,ay-s*0.13);ctx.moveTo(ax,ay);
      ctx.lineTo(ax+d*s*0.05,ay-s*0.18);ctx.stroke();
    }
  }else if(kind==='swipe'){
    /* two rings seen edge on, and a thumb crossing from one to the other */
    ctx.globalAlpha=ga*(0.6);ctx.lineWidth=2.6*u;
    ctx.strokeStyle='rgba(150,190,255,1)';
    ctx.beginPath();ctx.moveTo(x-s*0.52,y-s*0.46);ctx.lineTo(x+s*0.52,y-s*0.46);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-s*0.52,y+s*0.46);ctx.lineTo(x+s*0.52,y+s*0.46);ctx.stroke();
    const ty=y-s*0.46+s*0.92*ph;
    ctx.strokeStyle='#eaf3ff';ctx.fillStyle='#eaf3ff';
    ctx.globalAlpha=ga*(0.25);ctx.lineWidth=2.4*u;      /* the path already travelled */
    ctx.beginPath();ctx.moveTo(x,y-s*0.46);ctx.lineTo(x,ty);ctx.stroke();
    ctx.globalAlpha=ga*(1);
    ctx.beginPath();ctx.arc(x,ty,s*0.2,0,TAU);ctx.fill();
    ctx.lineWidth=2.4*u;
    ctx.beginPath();ctx.moveTo(x-s*0.19,ty+s*0.16);ctx.lineTo(x,ty+s*0.36);
    ctx.lineTo(x+s*0.19,ty+s*0.16);ctx.stroke();
  }else if(kind==='magnet'){
    blit(artifactSprite('spot'),x,y,s/(22*u),0,ga*0.95);
  }else if(kind==='star'){
    blit(SPR.ember,x,y,s/26,0,ga*0.95);   /* blit sets alpha absolutely too */
  }else if(kind==='shard'){
    ctx.globalAlpha=ga*(0.95);ctx.fillStyle=COL.shard;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);
    ctx.fillRect(-s*0.27,-s*0.27,s*0.54,s*0.54);ctx.restore();
  }else if(kind==='shield'){
    ctx.globalAlpha=ga*(0.95);ctx.strokeStyle=COL.shield;ctx.fillStyle=COL.shield;
    ctx.lineWidth=2.2*u;
    ctx.beginPath();ctx.arc(x,y,s*0.34,0,TAU);ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,s*0.13,0,TAU);ctx.fill();
  }else if(kind==='beat'){
    /* the same contracting ring the comet wears, so the prompt names it */
    ctx.globalAlpha=ga*(0.95);ctx.beginPath();ctx.arc(x,y,s*0.18,0,TAU);ctx.fill();
    ctx.globalAlpha=ga*(0.25+0.55*ph);ctx.lineWidth=(1.3+1.6*ph)*u;
    ctx.beginPath();ctx.arc(x,y,s*(0.62-0.34*ph),0,TAU);ctx.stroke();
  }else if(kind==='build'){
    ctx.globalAlpha=ga*(0.28);ctx.fillStyle=COL.warp;
    ctx.fillRect(x-s*0.5,y-s*0.1,s,s*0.2);
    ctx.globalAlpha=ga*(0.95);
    ctx.fillRect(x-s*0.5,y-s*0.1,s*(0.25+0.7*ph),s*0.2);
  }else if(kind==='warp'){
    /* the counter-rotating squares of the slow-mo orb, at the pace it gives
       you rather than the pace it spins at — the diagram should feel slow */
    ctx.globalAlpha=ga*(0.95);ctx.strokeStyle=COL.warp;ctx.lineWidth=2.2*u;
    ctx.save();ctx.translate(x,y);ctx.rotate(ph*Math.PI/2);
    ctx.strokeRect(-s*0.31,-s*0.31,s*0.62,s*0.62);ctx.restore();
    ctx.save();ctx.translate(x,y);ctx.rotate(-ph*Math.PI/2+Math.PI/4);
    ctx.strokeRect(-s*0.18,-s*0.18,s*0.36,s*0.36);ctx.restore();
  }else if(kind==='nova'){
    /* the eight-point star of the nova orb, with one red square already
       turning: the sentence says what happens, this says it faster */
    ctx.globalAlpha=ga*(0.95);ctx.strokeStyle=COL.nova;ctx.lineWidth=1.9*u;
    ctx.save();ctx.translate(x,y);ctx.rotate(ph*Math.PI/4);
    ctx.beginPath();
    for(let i=0;i<16;i++){
      const sr=(i%2===0)?s*0.46:s*0.17, aa=i*Math.PI/8;
      if(i===0)ctx.moveTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
      else ctx.lineTo(Math.cos(aa)*sr,Math.sin(aa)*sr);
    }
    ctx.closePath();ctx.stroke();ctx.restore();
    ctx.globalAlpha=ga*(0.95);ctx.fillStyle=COL.nova;
    ctx.beginPath();ctx.arc(x,y,s*0.1,0,TAU);ctx.fill();
  }
  ctx.restore();
}
function hintText(){
  if(G.state!=='playing'||G.intro||LAB.on||bhActive()||FIN.on)return null;
  /* First encounters keep their own explanation. Basic reminders are brief
     and retire on learned actions, rather than restarting throughout every run. */
  if(G.teachHint&&G.teach>0)return G.teachHint;
  const a=age(),learning=G.runs<=2;
  if(learning&&!G.didReverse&&a<12)return {t:'Tap to turn around',g:'tap'};
  if(learning)for(const pw of G.pows){
    if(pw.type==='shield'&&!G.gotShield&&!G.didShield)
      return {t:'Shield: blocks one red hit',g:'shield'};
    if(pw.type==='warp'&&!G.gotWarp)
      return {t:'Slow-mo: movement slows for 6 seconds',g:'warp'};
    if(pw.type==='nova'&&!G.gotNova)
      return {t:'Nova: red obstacles become stars',g:'nova'};
  }
  if(!G.didHop&&!G.everHopped&&G.nRings>1&&a<35)
    return {t:swipeWords(),g:'swipe'};
  if(!G.didLap&&!G.seen.orbit&&a<30)
    return {t:G.lapEmbers>0?'Keep going without turning to earn orbit points':
      'Collect a star, then complete a circle without turning',g:'star'};
  if(!G.didDodge&&!G.seen.single&&G.spikes.length&&a<40)return MEET.single;
  if(learning&&!G.didGroove&&!G.seen.beat&&a>28&&a<36)
    return {t:'Tap with the beat to earn bonus points',g:'beat'};
  if(learning&&!G.sawDrop&&G.build>0.15&&a>=38&&a<46)
    return {t:'Three orbits with a collected star earn Starfall',g:'star'};
  return null;
}

/* THE LADDER, DRAWN. One pip per LEVEL, filled up to the one this run reached
   — the same rotated-square idiom as the lap-ember pips, so the game says
   "progress" one way rather than two. It counts the same ladder as the LEVEL
   printed under it; it used to count the ten tiers instead, which put two
   different ordinals in the same eyeline. The empty pips are the point as much
   as the filled ones: a player who dies on level 1 can see that two more
   exist, which is the thing a bare score can never tell them.
   `shown` caps how many filled pips have appeared yet — the death screen
   fills them one at a time. Callers that want them all pass G.level. */
function drawLadder(x,y,level,shown){
  const pipW=20*u,x0=x-(LEVEL_MAX-1)*pipW/2;
  for(let i=0;i<LEVEL_MAX;i++){
    ctx.save();ctx.translate(x0+i*pipW,y);ctx.rotate(Math.PI/4);
    const on=i<level&&i<(shown===undefined?level:shown);
    ctx.globalAlpha=on?0.95:0.25;
    if(on){ctx.fillStyle=COL.ember;ctx.fillRect(-3.4*u,-3.4*u,6.8*u,6.8*u);}
    else{ctx.strokeStyle='rgba(200,215,255,0.9)';ctx.lineWidth=1.2;
      ctx.strokeRect(-3.4*u,-3.4*u,6.8*u,6.8*u);}
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
/* The two mode cards and their moving art were deleted with CHILL. They were
   a good idea for the problem they had — each card animated the mode's own
   knobs, so it could not flatter a difficulty the game did not deliver — and
   if a second mode returns, that idea should return with it rather than a
   static tag line. The reasoning is in the git history at this line; nothing
   here should be reconstructed from memory. */
/* One message owns the quiet centre. State chooses meaning; layout never
   invents a second announcement just because another system fired. */
function runMessage(){
  const intro=typeof introPrompt==='function'?introPrompt():null;
  if(intro)return {tag:'FIRST FLIGHT · '+(intro.stage+1)+' / 4',title:intro.title,
    detail:intro.detail,glyph:intro.glyph==='hop'?'swipe':intro.glyph,
    color:intro.done?COL.shield:COL.comet,progress:intro.progress};
  if(bhActive()){
    if(BH.phase===1)return {tag:'BLACK HOLE',title:'The pull begins',detail:'A risky detour. Survive, then escape.',color:COL.warp};
    if(BH.phase===3)return {tag:'BLACK HOLE',title:BH.escape?'Back to the stars':'Gravity releases',color:COL.warp};
    return BH.escape?{tag:'ESCAPE · '+Math.max(0,Math.ceil(BH_DUR-BH.t))+'s',title:'Reach the outer ring',detail:SWIPE_MODE==='screen'?'Swipe up':'Swipe away from the centre',color:COL.shield}:
      {tag:'BLACK HOLE',title:'Ride the inner ring',detail:'Escape signal in '+Math.max(0,Math.ceil(BH_ESCAPE-BH.t))+'s',color:COL.warp};
  }
  if(FIN.on)return {tag:'FINISH THE LEVEL',title:FIN.bloomed?'Collect the sun':'Follow the bright star',detail:FIN.bloomed?'Collect it to finish this level':'Swipe between rings to collect stars',color:COL.ember};
  if(starfallActive())return G.starfall.total-G.starfall.left<1.6?
    {tag:'STARFALL',title:'Catch the stars',detail:"You're safe. Stars score double.",color:COL.ember}:null;
  if(G.starfallResult&&G.t-G.starfallResult.at<2)return {tag:'STARFALL COMPLETE',title:'+'+G.starfallResult.score,
    detail:G.starfallResult.got+' stars collected',color:COL.ember};
  if(G.teachHint&&G.teach>0)return {tag:'TRY THIS',title:G.teachHint.t,glyph:G.teachHint.g,color:COL.comet};

  if(G.banner)return {tag:G.banner.eyebrow==='UNLOCKED'?'NEW IN THIS WORLD':G.banner.eyebrow||'DISCOVERED',title:G.banner.str,detail:G.banner.sub,color:COL.ember};
  if(G.armFx)return {tag:'STARFALL EARNED',title:'The stars are coming',detail:'Keep flying',color:COL.ember};
  if(G.sayFx){
    const split=G.sayFx.str.indexOf(':');
    if(G.sayFx.str.indexOf('NEW MUSIC:')===0)return {tag:'NEW MUSIC',title:G.sayFx.str.slice(split+1).trim(),color:COL.warp};
    return split>0?{tag:'POWER ACTIVE',title:G.sayFx.str.slice(0,split),detail:G.sayFx.str.slice(split+1).trim(),color:COL.comet}:
      {tag:'IN THE MUSIC',title:G.sayFx.str,color:COL.warp};
  }
  const hint=hintText();
  return hint?{tag:'FLIGHT TIP',title:hint.t,glyph:hint.g,color:COL.comet}:null;
}
function hudLines(str,size,weight,width){
  ctx.font=weight+' '+Math.round(size)+'px '+F;
  try{ctx.letterSpacing='0px';}catch(e){}
  const lines=[];let line='';
  for(const word of String(str||'').split(/\s+/)){
    const next=line?line+' '+word:word;
    if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;
  }
  if(line)lines.push(line);
  return lines;
}
function drawMessageCard(m){
  if(!m)return;
  const side=W/H>1.25&&cx-R>170*u;
  const overhead=bhActive()&&!side;
  const width=side?Math.min(230*u,cx-R-42*u):overhead?Math.min(254*u,W-80*u):Math.min(254*u,radiusOf(G.nRings-1)*1.72);
  const x=side?(cx-R)/2:cx, y=overhead?(safeTop+82*u+cy-R*AY)/2:cy;
  const pad=13*u,content=width-pad*2;
  let size=(m.count?44:width<150*u?17:20)*u;
  const label=String(m.title),heading=label===label.toUpperCase()?label.charAt(0)+label.slice(1).toLowerCase():label;
  let title=hudLines(heading,size,'800',content);
  if(title.length>3){size=15*u;title=hudLines(heading,size,'800',content);}
  const detail=hudLines(m.detail,11.5*u,'400',content);
  const glyph=m.glyph&&width>150*u?25*u:0;
  const tagSize=Math.min(9*u,fitSz(m.tag,9*u,'600',content,1.1*u));
  const height=26*u+glyph+title.length*size*1.17+(detail.length?9*u+detail.length*14*u:0)+(m.foot?20*u:0)+(m.progress!==undefined?13*u:0)+15*u;
  const top=y-height/2;
  ctx.save();ctx.textAlign='center';ctx.textBaseline='alphabetic';
  frontPanel(x-width/2,top,width,height,m.color,true);
  let yy=top+21*u;
  text(m.tag,x,yy,tagSize,'600',m.color,1.1*u);
  if(glyph){yy+=23*u;hintGlyph(m.glyph,x,yy-2*u,21*u);yy+=9*u;}
  yy+=size+5*u;
  for(const line of title){text(line,x,yy,size,'800','#f1f4f8',0);yy+=size*1.17;}
  if(detail.length){yy+=4*u;for(const line of detail){text(line,x,yy,11.5*u,'400','#b2c3d5',0);yy+=14*u;}}
  if(m.foot){yy+=5*u;text(m.foot,x,yy,10.5*u,'500',m.color,0);yy+=15*u;}
  if(m.progress!==undefined){
    const w=Math.min(content,110*u),p=Math.max(0,Math.min(1,m.progress||0));
    ctx.fillStyle='rgba(165,186,209,0.18)';ctx.fillRect(x-w/2,top+height-13*u,w,2*u);
    ctx.fillStyle=m.color;ctx.fillRect(x-w/2,top+height-13*u,w*p,2*u);
  }
  ctx.restore();
}
function drawPowerStatus(y){
  if(bhActive()||G.intro)return;
  const items=[];
  if(G.hyper>0)items.push(['Hypernova',G.hyper,G.hyperD,COL.hyper]);
  if(G.spot>0)items.push(['Magnet',G.spot,G.spotD,COL.comet]);
  if(G.mirror>0)items.push(['Mirror',G.mirror,G.mirrorD,COL.mirror]);
  if(G.scorch>0)items.push(['Scorch',G.scorch,G.scorchD,COL.scorch]);
  if(G.slip>0)items.push(['Slipstream',G.slip,G.slipD,COL.comet]);
  if(G.slow>0)items.push(['Slow-mo',G.slow,G.slowD,COL.warp]);
  const route=G.stars.find(s=>s.trail);
  if(route)items.push(['Star trail',Math.max(0,route.life-route.t),route.life,COL.ember]);
  if(!items.length)return;
  const side=W/H>1.25&&W-cx-R>150*u;
  const width=side?Math.min(195*u,W-cx-R-36*u):Math.min(W-48*u,330*u);
  const cols=side?1:Math.min(2,items.length),cw=width/cols;
  const centre=side?cx+R+(W-cx-R)/2:cx;
  const startY=side?cy-items.length*16*u:y;
  ctx.save();ctx.textAlign='left';
  items.forEach(function(it,i){
    const x=centre-width/2+(i%cols)*cw,yy=startY+Math.floor(i/cols)*30*u;
    const frac=Math.max(0,Math.min(1,it[1]/Math.max(0.001,it[2])));
    text(it[0],x+5*u,yy,fitSz(it[0],10*u,'500',cw-35*u),'500',it[3],0);
    ctx.textAlign='right';text(Math.ceil(it[1])+'s',x+cw-6*u,yy,10*u,'600','#d7e4f1',0);ctx.textAlign='left';
    ctx.fillStyle='rgba(165,186,209,0.15)';ctx.fillRect(x+5*u,yy+7*u,cw-11*u,2*u);
    ctx.fillStyle=it[3];ctx.fillRect(x+5*u,yy+7*u,(cw-11*u)*frac,2*u);
  });
  ctx.restore();
}
function drawRunHUD(top){
  ctx.save();ctx.textAlign='center';
  const intro=!!G.intro;
  const shade=ctx.createLinearGradient(0,top,0,top+115*u);
  shade.addColorStop(0,'rgba(2,6,17,0.72)');shade.addColorStop(1,'rgba(2,6,17,0)');
  ctx.fillStyle=shade;ctx.fillRect(0,top,W,115*u);
  const pop=RM?1:1+Math.min(0.09,(G.scorePop||0)*0.09);
  if(!intro)text('SCORE',cx,top+14*u,7.5*u,'700','#8eafc9',2.5*u);
  text(intro?'COSMO':G.score,cx,top+51*u,(intro?29:42)*u*pop,'800','#effbff',intro?6*u:0);
  const label=intro?'YOUR FIRST FLIGHT':'LEVEL '+G.level+'  /  '+levelName();
  text(label,cx,top+73*u,fitSz(label,9.5*u,'700',W-115*u,1.2*u),'700','#b1c9dc',1.2*u);
  if(!intro){
    const level=LV[G.level-1],journey=level.end<1e9?Math.max(0,Math.min(1,(dl()-level.dl0)/(level.end-level.dl0))):null;
    if(journey!==null){
      ctx.fillStyle='rgba(160,185,210,0.16)';ctx.fillRect(cx-48*u,top+79*u,96*u,1.5*u);
      ctx.fillStyle='#91bfd7';ctx.fillRect(cx-48*u,top+79*u,96*u*journey,1.5*u);
    }
    const stats=[];
    if(G.combo>=2&&G.comboT>0)stats.push('Stars ×'+G.combo);
    if(G.lapStreak>=2)stats.push(G.lapStreak+' clean orbits');
    if(stats.length)text(stats.join('  ·  '),cx,top+92*u,10.5*u,'500',COL.ember,0);
    if(!bhActive()&&starfallActive()){
      text('STARFALL  ·  STARS ×2  ·  '+Math.ceil(G.starfall.left)+'s',cx,top+108*u,8.5*u,'700',COL.ember,0.8*u);
      const span=130*u,remaining=G.starfall.left/G.starfall.total;
      ctx.fillStyle='rgba(255,208,103,0.18)';ctx.fillRect(cx-span/2,top+115*u,span,2*u);
      ctx.fillStyle=COL.ember;ctx.fillRect(cx-span/2,top+115*u,span*remaining,2*u);
    }else if(!LAB.on&&!bhActive()&&(G.didLap||G.seen.orbit)){
      const n=dropNeed(),earned=Math.min(n,Math.round(G.build||0));
      text('STARFALL  '+earned+' / '+n+' ORBITS',cx,top+108*u,8*u,'700','#b8b6da',1*u);
    }
    drawPowerStatus(top+129*u);
  }
  drawFinalePath();
  drawMessageCard(runMessage());
  if(BH.phase===2){
    text(BH.escape?Math.max(0,Math.ceil(BH_DUR-BH.t))+'s':Math.round(BH.charge*100)+'%',cx,cy+3*u,23*u,'500','#f1edff',0);
    text(BH.escape?'TO ESCAPE':'CHARGED',cx,cy+21*u,8*u,'500',BH.escape?COL.shield:'#a9a0bd',1*u);
  }
  G.introSkipRect=null;
  if(intro){
    const w=96*u,h=30*u,x=W-w-16*u,y=H-safeBot-h-20*u;
    G.introSkipRect={x,y,w,h};
    ctx.fillStyle='rgba(6,13,26,0.7)';ctx.beginPath();ctx.roundRect(x,y,w,h,15*u);ctx.fill();
    text('Skip intro',x+w/2,y+20*u,11*u,'500','#9fb5cd',0);
  }
  ctx.restore();
}

function drawFinalePath(){
    if(FIN.on&&FIN.trail.length){
      let nxt=null;
      for(const st3 of FIN.trail)if(!st3.got){nxt=st3;break;}
      /* ONE STAR BURNS AT A TIME (playtester Buch: "are you supposed to
         be getting the stars in a certain order at that part?" — he could
         not tell, because eleven equally-bright stars answer nothing).
         The full constellation waits as dim seeds; only the NEXT star
         burns full-size inside its ring, the guide line runs to it, and a
         second fainter segment shows the one after, so the eye reads
         chase-this-then-that with no caption. Any star still collects —
         the order is the melody's, never a rule that punishes. */
      ctx.save();ctx.strokeStyle=COL.ember;ctx.lineWidth=1.2*u;
      ctx.globalAlpha=0.09;
      ctx.beginPath();
      let started=false,nxt2=null;
      for(const st3 of FIN.trail){
        if(st3.got)continue;
        if(st3!==nxt&&!nxt2)nxt2=st3;
        const p3=posAt(st3.a,radiusOf(st3.ring));
        if(!started){ctx.moveTo(p3[0],p3[1]);started=true;}
        else ctx.lineTo(p3[0],p3[1]);
      }
      ctx.stroke();
      if(nxt){
        const pp=posPlayer(),pn=posAt(nxt.a,radiusOf(nxt.ring));
        ctx.globalAlpha=0.35;
        ctx.beginPath();ctx.moveTo(pp[0],pp[1]);ctx.lineTo(pn[0],pn[1]);ctx.stroke();
        if(nxt2){
          const p4=posAt(nxt2.a,radiusOf(nxt2.ring));
          ctx.globalAlpha=0.16;
          ctx.beginPath();ctx.moveTo(pn[0],pn[1]);ctx.lineTo(p4[0],p4[1]);ctx.stroke();
        }
      }
      ctx.restore();ctx.globalAlpha=1;
      for(const st3 of FIN.trail){
        if(st3.got)continue;
        const p3=posAt(st3.a,radiusOf(st3.ring));
        const big=st3===nxt?1.6:0.85;
        blit(SPR.ember,p3[0],p3[1],big,st3===nxt?G.t*1.2:0,st3===nxt?1:0.30);
        if(st3===nxt){
          ctx.save();ctx.strokeStyle=COL.ember;
          ctx.globalAlpha=0.55;
          ctx.lineWidth=1.6*u;
          ctx.beginPath();ctx.arc(p3[0],p3[1],10*u,0,TAU);ctx.stroke();
          ctx.restore();ctx.globalAlpha=1;
        }
      }
      /* the core answers */
      ctx.save();ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.10+0.20*(FIN.got/11);
      ctx.fillStyle=COL.ember;
      ctx.beginPath();ctx.arc(cx,cy,(6+9*(FIN.got/11))*u,0,TAU);ctx.fill();
      ctx.restore();ctx.globalAlpha=1;
      /* THE FINISH SUN: a dim seed until the melody is nearly home, then a
         blooming white-gold sun you cannot mistake for a trail star — the
         level ends only when you choose to dive into it */
      if(FIN.sun&&!FIN.sun.got){
        const ps=posAt(FIN.sun.a,radiusOf(FIN.sun.ring));
        if(!FIN.bloomed){
          ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle='#cfe0ff';
          ctx.beginPath();ctx.arc(ps[0],ps[1],2.6*u,0,TAU);ctx.fill();
          ctx.restore();ctx.globalAlpha=1;
        }else{
          const sp3=1.9;
          blit(SPR.ember,ps[0],ps[1],sp3,G.t*0.8,1);
          ctx.save();ctx.globalCompositeOperation='lighter';
          ctx.globalAlpha=0.75;ctx.fillStyle='#ffffff';
          ctx.beginPath();ctx.arc(ps[0],ps[1],4.2*u,0,TAU);ctx.fill();
          ctx.strokeStyle=COL.ember;ctx.lineWidth=2*u;
          ctx.globalAlpha=0.5;
          ctx.beginPath();ctx.arc(ps[0],ps[1],13*u,0,TAU);ctx.stroke();
          ctx.restore();ctx.globalAlpha=1;
        }
      }
    }
}
/* The front-end has its own drawn identity: cut metal, lit edges and a
   custom orbital wordmark. These paths never enter the playing HUD. */
function frontPath(x,y,w,h,cut){
  const c=Math.min(cut||12*u,w*.12,h*.3);
  ctx.beginPath();ctx.moveTo(x+c,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h-c);
  ctx.lineTo(x+w-c,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+c);ctx.closePath();
}
function frontPanel(x,y,w,h,color,selected){
  const art=host.getTexture?host.getTexture('ui-panel-frame'):null;
  if(art){
    ctx.save();ctx.globalAlpha=selected?1:.88;
    ctx.drawImage(art,art.width*23/1024,art.height*23/512,art.width*978/1024,art.height*466/512,x,y,w,h);
    if(selected){ctx.strokeStyle=color;ctx.lineWidth=2*u;ctx.beginPath();ctx.moveTo(x+14*u,y);ctx.lineTo(x+Math.min(w*.35,72*u),y);ctx.stroke();}
    ctx.restore();return;
  }
  ctx.save();
  const bg=ctx.createLinearGradient(x,y,x+w,y+h);
  bg.addColorStop(0,selected?'rgba(29,58,79,.95)':'rgba(10,24,42,.91)');
  bg.addColorStop(1,'rgba(3,10,24,.94)');
  ctx.fillStyle=bg;frontPath(x,y,w,h);ctx.fill();
  ctx.strokeStyle=selected?color:'rgba(129,176,211,.36)';ctx.lineWidth=selected?1.6*u:1;
  frontPath(x+.5,y+.5,w-1,h-1);ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=3*u;
  ctx.beginPath();ctx.moveTo(x+13*u,y);ctx.lineTo(x+Math.min(w*.28,62*u),y);ctx.stroke();
  ctx.globalAlpha*=selected?.65:.25;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x+w-38*u,y+h);ctx.lineTo(x+w-12*u,y+h);ctx.stroke();
  ctx.restore();
}
function frontLaunch(x,y,w,h,label,color){
  const art=host.getTexture?host.getTexture('ui-primary-frame'):null;
  if(art){
    ctx.save();
    ctx.drawImage(art,art.width*19/1024,art.height*19/256,art.width*986/1024,art.height*218/256,x,y,w,h);
    ctx.textAlign='center';ctx.textBaseline='middle';
    text(label,x+w/2,y+h/2,fitSz(label,22*u,'800',w-62*u,2*u),'800','#e1faff',2*u);
    ctx.restore();return;
  }
  ctx.save();
  const c=color||'#7ff4ff',glow=ctx.createLinearGradient(x,y,x+w,y+h);
  glow.addColorStop(0,'#f0ffff');glow.addColorStop(.48,c);glow.addColorStop(1,'#318ab7');
  ctx.fillStyle='rgba(58,198,245,.12)';frontPath(x-5*u,y-5*u,w+10*u,h+10*u,16*u);ctx.fill();
  ctx.fillStyle='rgba(0,5,16,.8)';frontPath(x,y+5*u,w,h,15*u);ctx.fill();
  ctx.fillStyle=glow;frontPath(x,y,w,h,15*u);ctx.fill();
  ctx.strokeStyle='rgba(239,255,255,.8)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x+16*u,y+2*u);ctx.lineTo(x+w-2*u,y+2*u);ctx.stroke();
  ctx.fillStyle='rgba(4,30,54,.18)';
  ctx.beginPath();ctx.moveTo(x+w-68*u,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h-15*u);
  ctx.lineTo(x+w-15*u,y+h);ctx.lineTo(x+w-87*u,y+h);ctx.closePath();ctx.fill();
  ctx.textAlign='left';ctx.textBaseline='middle';
  text(label,x+23*u,y+h/2,fitSz(label,22*u,'800',w-108*u,1*u),'800','#06253c',1*u);
  ctx.strokeStyle='#08344d';ctx.lineWidth=3*u;ctx.lineCap='square';
  for(let i=0;i<2;i++){
    const xx=x+w-(40-i*13)*u;
    ctx.beginPath();ctx.moveTo(xx-6*u,y+h/2-8*u);ctx.lineTo(xx+2*u,y+h/2);ctx.lineTo(xx-6*u,y+h/2+8*u);ctx.stroke();
  }
  ctx.restore();
}
function frontLogo(x,y,w){
  const art=host.getTexture?host.getTexture('cosmo-wordmark'):null;
  if(art){
    ctx.drawImage(art,art.width*179/1536,art.height*87/512,art.width*1224/1536,art.height*292/512,x-w/2,y,w,w*292/1224);
    return;
  }
  ctx.save();ctx.translate(x-w/2,y);ctx.scale(w/360,w/360);
  const letters=()=>{
    ctx.beginPath();
    ctx.moveTo(50,10);ctx.bezierCurveTo(3,-11,-7,72,48,63);
    ctx.moveTo(111,35);ctx.ellipse(87,35,24,30,0,0,TAU);
    ctx.moveTo(176,9);ctx.bezierCurveTo(130,-6,123,33,153,35);ctx.bezierCurveTo(189,38,182,78,137,62);
    ctx.moveTo(203,65);ctx.lineTo(203,5);ctx.lineTo(230,37);ctx.lineTo(257,5);ctx.lineTo(257,65);
    ctx.moveTo(341,35);ctx.ellipse(313,35,28,30,0,0,TAU);
  };
  ctx.lineJoin='bevel';ctx.lineCap='square';
  ctx.save();ctx.translate(0,6);ctx.strokeStyle='#123958';ctx.lineWidth=15;letters();ctx.stroke();ctx.restore();
  const metal=ctx.createLinearGradient(0,0,0,75);
  metal.addColorStop(0,'#ffffff');metal.addColorStop(.4,'#d4f8ff');metal.addColorStop(.55,'#79cde7');metal.addColorStop(1,'#e1fcff');
  ctx.strokeStyle=metal;ctx.lineWidth=11;letters();ctx.stroke();
  ctx.strokeStyle='rgba(219,253,255,.7)';ctx.lineWidth=1.3;
  ctx.beginPath();ctx.ellipse(311,34,45,13,-.46,0.07,Math.PI*1.05);ctx.stroke();
  ctx.strokeStyle='#a7f4ff';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(311,34,45,13,-.46,Math.PI*1.05,TAU+.07);ctx.stroke();
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(349,14,2.6,0,TAU);ctx.fill();
  ctx.restore();
}
function frontHeading(label,title,x,y,w){
  ctx.save();ctx.textAlign='left';
  text(label,x,y,11*u,'700','#83d6e8',2*u);
  text(title,x,y+36*u,fitSz(title,32*u,'800',w),'800','#edfaff',0);
  ctx.strokeStyle='rgba(135,201,231,.4)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x,y+53*u);ctx.lineTo(x+w,y+53*u);ctx.stroke();
  ctx.fillStyle='#8fecff';ctx.fillRect(x,y+51*u,45*u,3*u);ctx.restore();
}
function drawHUD(){
  /* First encounters identify the object with a steady local bracket.
     Teaching never dims and relights the whole playfield. */
  if(G.state==='playing'&&G.teach>0&&!G.teachSoft&&G.teachKind==='see'){
    const ease=Math.min(1,(2.8-G.teach)*4,G.teach*1.6);
    for(const sp of G.spikes){
      if(!sp.spot||sp.phase>=2)continue;   /* never ring a fading corpse */
      const pp=posAt(sp.a,radiusOf(sp.ring));
      const pr2=17*u;
      ctx.globalAlpha=0.6*ease;
      /* NOT GOLD. Gold is the collectible's colour — "what the game already
         uses for everything earned" — and this ring circles a LETHAL specimen
         for a player who is mid-lesson on what kills them. A cool white ring
         points without promising payment; the veil already isolates it. */
      ctx.strokeStyle='#dfe9ff';ctx.lineWidth=2.2*u;
      ctx.beginPath();ctx.arc(pp[0],pp[1],pr2,0,TAU);ctx.stroke();
      ctx.globalAlpha=1;
    }
  }
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  const top=safeTop;
  const bottomY=Math.min(H-24*u-safeBot,cy+R+52*u);
  /* THE LAB'S DOOR AND ITS LABEL, one control doing both jobs. It says which
     orb is loaded — a run that hands you the same object every twenty seconds
     should never leave you wondering which one you asked for — and pressing it
     goes back to the picker. Cleared to null on every other path so a stale
     rect from a finished lab run cannot swallow a tap in the real game; the
     handler tests LAB.on as well, which is the belt to this brace.
     Top-left, because the arena answers a tap anywhere and the bottom of the
     screen is where the thumb lives. */
  if(LAB.on&&(G.state==='playing'||G.state==='dead')){
    /* SHIFTED RIGHT OF THE PAUSE ICON, which took this corner. Both controls
       live in the same band and neither moves the other's position, so the door
       is offset by exactly the icon's footprint rather than by a guess — and
       its width takes the offset out of itself, so the pair cannot run off the
       right edge of a narrow phone. */
    const px2=pauseRect(),off=px2.x+px2.w+10*u;
    const dw=Math.min(150*u,W*0.52-off+14*u),dh=26*u,dx2=off,dy2=top+12*u;
    G.labRect={x:dx2,y:dy2,w:dw,h:dh};
    ctx.save();
    ctx.globalAlpha=0.9;
    ctx.fillStyle='rgba(12,10,26,0.72)';
    ctx.beginPath();ctx.roundRect(dx2,dy2,dw,dh,dh*0.34);ctx.fill();
    ctx.strokeStyle='rgba(160,135,255,0.45)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.roundRect(dx2+1,dy2+1,dw-2,dh-2,dh*0.34);ctx.stroke();
    ctx.textAlign='left';
    const dlab='‹ '+LAB_ORBS[LAB.sel].n;
    text(dlab,dx2+10*u,dy2+dh*0.67,fitSz(dlab,10.5*u,'800',dw-20*u),'800',
      'rgba(226,214,255,0.92)',1);
    ctx.textAlign='center';
    ctx.restore();
  }else G.labRect=null;
  if(G.state==='playing'){
    drawRunHUD(top);
  }else if(G.state==='lvend'){
    const card=G.lvCard||{done:false,next:1},n=Math.min(LEVEL_MAX,card.next);
    const L=LV[n-1],short=H-safeTop-safeBot<560*u;
    const a=Math.min(1,(G.t-G.lvT)/0.35),w=Math.min(W-40*u,short?660*u:390*u);
    const x=cx-w/2,offered=G.offer&&G.offer.length;
    const name=L.name.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
    ctx.save();ctx.globalAlpha=a;
    ctx.fillStyle='rgba(3,8,20,0.34)';ctx.fillRect(0,0,W,H);
    let y=top+(short?44:72)*u;
    if(card.done){
      const complete='Level '+(card.next-1)+' complete';
      text(complete.toUpperCase(),cx,y,20*u,'800','#ffdb8b',1*u);
      if(!short){text('Score so far  '+G.carryScore,cx,y+25*u,14*u,'400','#aab8c5',0);y+=58*u;}
      else y+=34*u;
    }
    ctx.save();ctx.globalAlpha*=.13;
    text(String(n).padStart(2,'0'),cx+w*.33,y+49*u,108*u,'900','#80d8f3',-5*u);ctx.restore();
    text('LEVEL '+n,cx,y,12*u,'800','#8beaff',2*u);
    text(name,cx,y+37*u,fitSz(name,35*u,'800',w,0),'800','#edfaff',0);
    G.offerRects=[];
    if(offered){
      text('CHOOSE YOUR UPGRADE',cx,y+70*u,15*u,'800','#c6e9f5',1*u);
      const start=y+91*u,gap=10*u;
      const wrap=(str,width,size)=>{
        ctx.font='400 '+Math.round(size)+'px '+F;
        const rows=[];let line='';
        for(const word of str.split(' ')){
          const candidate=line?line+' '+word:word;
          if(line&&ctx.measureText(candidate).width>width){rows.push(line);line=word;}else line=candidate;
        }
        if(line)rows.push(line);
        return rows;
      };
      let rowY=start;
      for(let i=0;i<G.offer.length;i++){
        const o=G.offer[i],cw=short?(w-gap*(G.offer.length-1))/G.offer.length:w;
        const bx=short?x+i*(cw+gap):x,by=short?start:rowY;
        const label=o.n.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
        const ds=13*u,desc=wrap(o.d,cw-(short?26:86)*u,ds);
        const ch=short?Math.max(134*u,89*u+desc.length*16*u):Math.max(76*u,37*u+desc.length*16*u);
        G.offerRects.push({x:bx,y:by,w:cw,h:ch,id:o.id});
        frontPanel(bx,by,cw,ch,o.c,true);
        ctx.save();ctx.globalAlpha*=.15;ctx.fillStyle=o.c;
        const ix=short?bx+cw/2:bx+42*u,iy=by+(short?30:35)*u;
        ctx.beginPath();ctx.arc(ix,iy,25*u,0,TAU);ctx.fill();ctx.restore();
        ctx.save();ctx.translate(short?bx+cw/2:bx+45*u,by+(short?30:35)*u);
        ctx.scale(0.65*u,0.65*u);o.ic(ctx,o.c);ctx.restore();
        const tx=short?bx+cw/2:bx+75*u,ty=by+(short?62:27)*u;
        ctx.textAlign=short?'center':'left';
        text(label,tx,ty,fitSz(label,17*u,'800',cw-(short?24:94)*u),'800','#edfaff',0);
        desc.forEach((line,j)=>text(line,tx,ty+(23+j*16)*u,ds,'400','#b3c2cf',0));
        ctx.textAlign='center';
        rowY+=ch+gap;
      }
    }else{
      const tip=n===1?'Learn the controls as you play.':(L.mech[0]&&L.mech[0][1])||'Collect stars and avoid red obstacles.';
      text(tip,cx,y+72*u,fitSz(tip,14*u,'400',w),'400','#b1c0cc',0);
      const bh=58*u,bw=Math.min(310*u,w);
      const by=Math.min(H-safeBot-82*u,Math.max(y+110*u,cy+(short?44:76)*u));
      frontLaunch(cx-bw/2,by,bw,bh,'LEVEL '+n);
      text('Tap anywhere to continue',cx,by+bh+25*u,12*u,'400','#a0b2c0',0);
    }
    ctx.restore();
  }else if(G.state==='swipesel'){
    const a=Math.min(1,(G.t-G.lvT)/0.35),w=Math.min(W-44*u,320*u);
    const titleY=top+70*u;
    ctx.save();ctx.globalAlpha=a;
    text('SWIPE CONTROLS',cx,titleY,fitSz('SWIPE CONTROLS',29*u,'800',W-72*u),'800','#edfaff',1*u);
    text('Swipe to try them. Both work.',cx,titleY+27*u,14*u,'400','#aabac8',0);
    const pp=posPlayer();
    let ax=0,ay=-1;
    if(SWIPE_MODE!=='screen'){const nx=Math.cos(G.angle),ny=Math.sin(G.angle)*AY,l=Math.hypot(nx,ny)||1;ax=nx/l;ay=ny/l;}
    ctx.strokeStyle='#a3d8e5';ctx.fillStyle='#a3d8e5';ctx.lineWidth=2*u;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(pp[0]+ax*24*u,pp[1]+ay*24*u);ctx.lineTo(pp[0]+ax*46*u,pp[1]+ay*46*u);ctx.stroke();
    const px=-ay,py=ax;
    ctx.beginPath();ctx.moveTo(pp[0]+ax*46*u,pp[1]+ay*46*u);
    ctx.lineTo(pp[0]+ax*36*u+px*5*u,pp[1]+ay*36*u+py*5*u);
    ctx.lineTo(pp[0]+ax*36*u-px*5*u,pp[1]+ay*36*u-py*5*u);ctx.closePath();ctx.fill();
    G.selRects=[];
    const rows=[['screen','Up / down','Outward is always up'],['radial','Toward / away','Outward is away from the center']];
    const rh=61*u,gap=10*u;
    let ry=Math.max(titleY+48*u,cy-91*u);
    for(const row of rows){
      const on=SWIPE_MODE===row[0],rx=cx-w/2;
      G.selRects.push({x:rx,y:ry,w:w,h:rh,id:row[0]});
      frontPanel(rx,ry,w,rh,'#8deaff',on);
      ctx.strokeStyle=on?'#a5f2ff':'#7cacc7';ctx.lineWidth=1.5*u;
      ctx.beginPath();ctx.arc(rx+24*u,ry+rh/2,6*u,0,TAU);ctx.stroke();
      if(on){ctx.fillStyle='#c6e6ed';ctx.beginPath();ctx.arc(rx+24*u,ry+rh/2,3*u,0,TAU);ctx.fill();}
      ctx.textAlign='left';
      text(row[1],rx+44*u,ry+26*u,17*u,'500',on?'#edf2f4':'#becbd6',0);
      text(row[2],rx+44*u,ry+46*u,fitSz(row[2],12.5*u,'400',w-60*u),'400','#9fb3c3',0);
      ctx.textAlign='center';ry+=rh+gap;
    }
    const bh=44*u,bw=Math.min(w,252*u),by=ry+5*u;
    G.selRects.push({x:cx-bw/2,y:by,w:bw,h:bh,id:'play'});
    frontLaunch(cx-bw/2,by,bw,bh,'CONFIRM');
    ctx.restore();
  }else if(G.state==='menu'){
    const wide=W>H*1.25,usable=H-safeTop-safeBot;
    const heroX=wide?W*.28:cx,actionX=wide?W*.73:cx;
    const aw=Math.min(wide?W*.40:W-48*u,344*u),ax=actionX-aw/2;
    const lw=Math.min(wide?W*.45:W-38*u,390*u);
    const ly=top+(wide?Math.max(66*u,usable*.24):Math.max(77*u,usable*.115));
    const ay=wide?top+Math.max(76*u,usable*.26):H-safeBot-245*u,bh=65*u;
    ctx.save();
    const veil=ctx.createLinearGradient(0,0,0,H);
    veil.addColorStop(0,'rgba(1,6,21,.55)');veil.addColorStop(.30,'rgba(1,6,21,0)');
    veil.addColorStop(.57,'rgba(1,6,21,0)');veil.addColorStop(1,'rgba(1,6,21,.88)');
    ctx.fillStyle=veil;ctx.fillRect(0,0,W,H);
    const ex=heroX-lw/2;
    ctx.textAlign='left';text('SOUND. SPACE. INSTINCT.',ex,ly-22*u,10*u,'700','#a2daeb',2*u);
    frontLogo(heroX,ly,lw);
    ctx.textAlign='center';
    text('Move with the music.',heroX,ly+lw*.24+24*u,16*u,'500','#d3e6f1',0);
    if(G.best>0){
      const ry=wide?ly+lw*.24+62*u:ay-32*u;
      ctx.textAlign='left';text('BEST',ax,ry,10*u,'700','#86a9bf',1.4*u);
      text(String(G.best),ax+44*u,ry+1*u,18*u,'800','#e2f4ff',0);
      ctx.textAlign='right';text('LEVEL '+G.lvlMax,ax+aw,ry,12*u,'700','#a6cddd',1*u);
      ctx.textAlign='center';
    }
    G.menuRects=[];G.swipeRect=null;
    G.menuRects.push({x:ax,y:ay,w:aw,h:bh,id:'start'});
    frontLaunch(ax,ay,aw,bh,'LAUNCH');
    const sy=ay+bh+14*u,sh=45*u,gap=12*u,cw=(aw-gap)/2;
    [{id:'lab',label:'POWER-UP LAB'},{id:'account',label:cloudTok?'LEADERBOARD':'SIGN IN'}].forEach((s,i)=>{
      const xx=ax+i*(cw+gap);
      G.menuRects.push({x:xx,y:sy,w:cw,h:sh,id:s.id});
      frontPanel(xx,sy,cw,sh,'#8ac9ed',false);
      ctx.textBaseline='middle';text(s.label,xx+cw/2,sy+sh/2,fitSz(s.label,13*u,'700',cw-20*u,.3*u),'700','#d4e9f4',.3*u);
      ctx.textBaseline='alphabetic';
    });
    const uy=sy+sh+8*u,uh=42*u;
    G.swipeRect={x:ax,y:uy,w:aw*.59,h:uh};
    G.menuRects.push({x:ax+aw*.60,y:uy,w:aw*.40,h:uh,id:'intro'});
    ctx.textBaseline='middle';ctx.textAlign='left';
    text('Swipe controls',ax+3*u,uy+uh/2,14*u,'500','#b7d0e1',0);
    ctx.textAlign='right';text('Learn to play',ax+aw-3*u,uy+uh/2,14*u,'600','#d1eff7',0);
    ctx.textAlign='center';ctx.textBaseline='alphabetic';
    if(IN_APP_BROWSER)text('Open in your browser for reliable swipes.',cx,H-safeBot-42*u,
      fitSz('Open in your browser for reliable swipes.',11*u,'400',W-36*u),'400','#e4c796',0);
    if(POSTHOG_KEY)text('Anonymous play stats collected',cx,H-safeBot-21*u,10*u,'400','#849db0',0);
    ctx.textAlign='right';text('build '+BUILD,W-12*u,H-safeBot-7*u,8*u,'400','#59778e',0);
    ctx.restore();
  }else if(G.state==='levelsel'){
    const a=Math.min(1,(G.t-G.lvT)/0.35),short=H-safeTop-safeBot<570*u&&W>H;
    const w=Math.min(W-40*u,short?660*u:360*u),x=cx-w/2,cols=short?2:1,rows=Math.ceil(LEVEL_MAX/cols);
    const titleY=top+66*u,buttonY=H-safeBot-104*u,listTop=titleY+56*u,listBot=buttonY-18*u;
    const gap=8*u,cw=(w-(cols-1)*gap)/cols,rh=Math.min(58*u,(listBot-listTop-(rows-1)*gap)/rows);
    const listH=rows*rh+(rows-1)*gap,y0=(listTop+listBot-listH)/2;
    ctx.save();ctx.globalAlpha=a;
    frontHeading('CHOOSE YOUR WORLD','Select a level',x,titleY-32*u,w);
    G.lvSelRects=[];
    for(let i=0;i<LEVEL_MAX;i++){
      const n=i+1,on=G.lvSel===n,reached=n<=G.lvlMax,xx=x+(i%cols)*(cw+gap),yy=y0+Math.floor(i/cols)*(rh+gap);
      const name=LV[i].name.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
      G.lvSelRects.push({x:xx,y:yy,w:cw,h:rh,id:'lv',lv:n});
      frontPanel(xx,yy,cw,rh,'#8deaff',on);
      ctx.textBaseline='middle';
      text(String(n).padStart(2,'0'),xx+27*u,yy+rh/2,25*u,'900',on?'#a2efff':'#507e9f',-1*u);
      ctx.textAlign='left';
      text(name,xx+51*u,yy+rh/2,fitSz(name,18*u,'700',cw-104*u),'700',on?'#edfaff':'#afcddd',0);
      ctx.textAlign='right';
      if(on)text('Selected',xx+cw-14*u,yy+rh/2,10*u,'500','#9ecece',0);
      else if(reached&&n>1)text('Reached',xx+cw-14*u,yy+rh/2,10*u,'400','#7a9d94',0);
      ctx.textAlign='center';ctx.textBaseline='alphabetic';
    }
    const bw=Math.min(280*u,w),bh=47*u;
    G.lvSelRects.push({x:cx-bw/2,y:buttonY,w:bw,h:bh,id:'start'});
    frontLaunch(cx-bw/2,buttonY,bw,bh,'LAUNCH');
    const by=buttonY+bh+12*u;
    G.lvSelRects.push({x:cx-90*u,y:by,w:180*u,h:29*u,id:'back'});
    text('Back to title',cx,by+20*u,14*u,'400','#b4c5d1',0);
    ctx.restore();
  }else if(G.state==='powersel'){
    const a=Math.min(1,(G.t-G.lvT)/0.35),wide=W>H*1.25;
    const gridCx=wide?W*.31:cx,detailCx=wide?W*.79:cx;
    const w=Math.min(wide?W*.54:W-36*u,wide?460*u:390*u),x=gridCx-w/2;
    const dw=wide?Math.min(W*.34,300*u):w,dx=detailCx-dw/2,cols=2,N=LAB_ORBS.length,rows=Math.ceil(N/cols);
    const titleY=top+62*u,buttonY=H-safeBot-90*u,ghostY=buttonY-46*u,descY=wide?top+94*u:ghostY-62*u;
    const listTop=titleY+51*u,listBot=wide?H-safeBot-24*u:descY-15*u,gap=8*u,cw=(w-(cols-1)*gap)/cols;
    const rh=Math.min(62*u,(listBot-listTop-(rows-1)*gap)/rows),listH=rows*rh+(rows-1)*gap;
    const y0=(listTop+listBot-listH)/2;
    ctx.save();ctx.globalAlpha=a;
    frontHeading('EXPLORE YOUR ABILITIES','Power-up lab',x,titleY-28*u,w);
    G.powSelRects=[];
    for(let i=0;i<N;i++){
      const o=LAB_ORBS[i],on=LAB.sel===i,xx=x+(i%cols)*(cw+gap),yy=y0+Math.floor(i/cols)*(rh+gap);
      const label=o.n.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
      G.powSelRects.push({x:xx,y:yy,w:cw,h:rh,id:'orb',i:i,orb:o.id});
      frontPanel(xx,yy,cw,rh,'#b5a2ff',on);
      ctx.save();ctx.translate(xx+26*u,yy+rh/2);ctx.scale(.7,.7);
      drawPow(0,0,{type:o.id,t:G.t},on?1:.65);ctx.restore();
      ctx.textAlign='left';ctx.textBaseline='middle';
      text(label,xx+46*u,yy+rh/2,fitSz(label,14*u,'700',cw-56*u),'700',on?'#f1edff':'#b9cddd',0);
      ctx.textAlign='center';ctx.textBaseline='alphabetic';
    }
    const chosen=LAB_ORBS[LAB.sel];
    ctx.font='400 '+Math.round(14*u)+'px '+F;
    const lines=[];let line='';
    for(const word of chosen.d.split(' ')){
      const candidate=line?line+' '+word:word;
      if(line&&ctx.measureText(candidate).width>dw-30*u){lines.push(line);line=word;}else line=candidate;
    }
    if(line)lines.push(line);
    lines.forEach((s,i)=>text(s,detailCx,descY+(i*18+10)*u,14*u,'400','#b8c8d6',0));
    G.powSelRects.push({x:dx,y:ghostY,w:dw,h:34*u,id:'ghost'});
    ctx.strokeStyle='rgba(152,185,202,0.25)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(dx,ghostY);ctx.lineTo(dx+dw,ghostY);ctx.stroke();
    ctx.textAlign='left';text('Invincible while testing',dx+8*u,ghostY+23*u,fitSz('Invincible while testing',14*u,'400',dw-66*u),'400','#b9cbd6',0);
    ctx.textAlign='right';text(LAB.invuln?'ON':'OFF',dx+dw-8*u,ghostY+23*u,14*u,'500',LAB.invuln?'#9ed0b5':'#8198a9',0);
    ctx.textAlign='center';
    const bw=Math.min(270*u,dw),bh=44*u;
    G.powSelRects.push({x:detailCx-bw/2,y:buttonY,w:bw,h:bh,id:'start'});
    frontLaunch(detailCx-bw/2,buttonY,bw,bh,'TRY IT','#bfa6ff');
    const by=buttonY+bh+9*u;
    G.powSelRects.push({x:detailCx-90*u,y:by,w:180*u,h:28*u,id:'back'});
    text('Back to title',detailCx,by+19*u,14*u,'400','#b4c5d1',0);
    ctx.restore();
  }else{
    const td=G.t-G.deadT,skip=RM||G.deadSkip,wide=W>H*1.25;
    const el=(at,dur)=>skip?1:Math.max(0,Math.min(1,(td-at)/(dur||0.18)));
    const pipsShown=skip?G.level:Math.max(0,Math.floor((td-.55)/PIPDT));
    if(pipsShown>G.deadPips&&pipsShown<=G.level){G.deadPips=pipsShown;beep(PENT[Math.min(13,3+pipsShown)],.06,'sine',.03,undefined,0,0,.2);}
    const lvAt=.55+PIPDT*G.level,w=Math.min(W-40*u,wide?650*u:380*u),x=cx-w/2;
    const foot=LAB.on?bottomY-51*u:shareRect().y-14*u;
    const y=wide?top+52*u:Math.max(top+58*u,Math.min(cy-202*u,foot-272*u));
    const h=wide?Math.min(219*u,H-safeBot-y-112*u):Math.max(260*u,foot-y);
    const scoreX=wide?x+w*.26:cx,infoX=wide?x+w*.74:cx,infoW=wide?w*.45:w-36*u;
    const name=levelName().toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
    ctx.save();ctx.globalAlpha=el(.15);
    frontPanel(x,y,w,h,G.newBest||G.newLevel?'#ffdc8d':'#80d9ed',true);
    ctx.textAlign='left';
    text(LAB.on?'PRACTICE COMPLETE':'FLIGHT COMPLETE',x+22*u,y+28*u,11*u,'800','#8ed9ec',1.8*u);
    ctx.textAlign='right';
    text('LEVEL '+G.level,x+w-22*u,y+28*u,12*u,'800','#bddce9',1*u);
    ctx.textAlign='center';
    text(name,scoreX,y+62*u,fitSz(name,22*u,'700',wide?w*.44:w-32*u),'700','#dcedf5',0);
    const sq=skip?1:Math.max(0,Math.min(1,(td-.2)/.5));
    const score=String(Math.round(G.score*(1-(1-sq)*(1-sq))));
    const metal=ctx.createLinearGradient(0,y+77*u,0,y+147*u);
    metal.addColorStop(0,'#fff8dc');metal.addColorStop(.55,'#ffdc85');metal.addColorStop(1,'#cc8b40');
    text(score,scoreX,y+139*u,fitSz(score,78*u,'900',wide?w*.43:w-40*u,-2*u),'900',metal,-2*u);
    text('POINTS',scoreX,y+161*u,11*u,'800','#93b5c9',2*u);
    ctx.globalAlpha=el(lvAt+.35);
    const record=LAB.on?'Practice scores are not saved':G.newLevel?'NEW FURTHEST LEVEL':G.newBest?'NEW BEST SCORE':'Best score  '+G.best;
    const ry=y+(wide?72:193)*u;
    text(record,infoX,ry,fitSz(record,14*u,'800',infoW),'800',G.newLevel||G.newBest?'#ffe0a0':'#b2cedc',0);
    text(runTime()+' played  \u00b7  '+G.orbits+' orbits',infoX,ry+25*u,14*u,'500','#b0c9da',0);
    if(G.coach){
      ctx.globalAlpha=el(lvAt+.5);ctx.font='500 '+Math.round(14*u)+'px '+F;
      const lines=[];let line='';
      for(const word of G.coach.t.split(' ')){
        const s=line?line+' '+word:word;
        if(line&&ctx.measureText(s).width>infoW){lines.push(line);line=word;}else line=s;
      }
      if(line)lines.push(line);
      lines.forEach((s,i)=>text(s,infoX,ry+(53+i*18)*u,14*u,'500','#c6dfeb',0));
    }
    ctx.globalAlpha=1;
    if(td>.6&&deadSeqDone()){
      const bw=Math.min(280*u,W-58*u),by=bottomY-16*u,bh=40*u;
      frontLaunch(cx-bw/2,by,bw,bh,'FLY AGAIN');
    }
    ctx.restore();
  }
}

/* ---------- host-controlled lifecycle ---------- */
let last=performance.now();
function runtimeStep(deltaMs){
  if(runtimeDestroyed)return;
  const dt=Math.max(0,Math.min(Number.isFinite(deltaMs)?deltaMs/1000:0,0.05));
  if(sprBand!==skyI)resize(W,H,DPR);
  update(dt);runtimeSteps++;
}
function runtimeRender(){
  if(runtimeDestroyed)return;
  runtimeFrames++;
  /* Phaser owns the canvas. Restore its incoming transform and common state
     even if a frame fails, while keeping the first error inspectable. */
  const transform=typeof ctx.getTransform==='function'?ctx.getTransform():null;
  const alpha=ctx.globalAlpha,blend=ctx.globalCompositeOperation;
  ctx.save();
  try{draw();}catch(e){
    if(!window.__drawErr)window.__drawErr=e;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }finally{
    ctx.restore();
    if(transform&&Number.isFinite(transform.a))
      ctx.setTransform(transform.a,transform.b,transform.c,transform.d,transform.e,transform.f);
    if(Number.isFinite(alpha))ctx.globalAlpha=alpha;
    if(typeof blend==='string')ctx.globalCompositeOperation=blend;
  }
  /* The host reads a copied view after the original game has drawn. Its
     renderer has no access to game objects, input, audio or the random stream. */
  if(runtimeHost.renderFlight)runtimeHost.renderFlight(runtimeFlightFrame());
}
function frame(now){
  if(runtimeDestroyed)return;
  if(window.innerWidth!==W||window.innerHeight!==H||sprBand!==skyI)resize();
  runtimeStep(now-last);last=now;runtimeRender();
  runtimeFrameId=requestAnimationFrame(frame);
}
function runtimePause(){
  if(runtimeDestroyed)return;
  /* Native background/back must freeze even during the in-game button's
     cooldown. Its anti-farming guard still applies to ordinary UI input. */
  if(G.state==='playing'&&!PAUSE.on){
    const at=PAUSE.at;PAUSE.resumeT=0;PAUSE.cool=0;pauseGame();
    if(at)PAUSE.at=at;
  }else pauseAudio();
  pd=null;
}
function runtimeResume(){
  if(runtimeDestroyed)return;
  if(PAUSE.on)unpauseGame();
  else{ensureAudio();endSection();}
  last=performance.now();
}
function runtimeBack(){
  if(runtimeDestroyed)return false;
  if(CLOUD.open){closeAccount();return true;}
  if(PAUSE.on){unpauseGame();return true;}
  if(LAB.on&&(G.state==='playing'||G.state==='dead')){enterPowerSel();return true;}
  if(G.state==='playing'){runtimePause();return true;}
  if(G.state!=='menu'){enterMenu();return true;}
  return false;
}
function runtimeSnapshot(){
  return {
    state:G.state,introStage:G.intro?G.intro.stage:null,ringIndex:effRing(),direction:G.dir,
    viewport:{width:W,height:H,dpr:DPR},paused:frozen(),frames:runtimeFrames,steps:runtimeSteps,
    menuRects:(G.menuRects||[]).map(function(r){return Object.assign({},r);}),
    introSkipRect:G.introSkipRect?Object.assign({},G.introSkipRect):null,
    score:G.score,level:G.level,build:BUILD,destroyed:runtimeDestroyed,
    background:{gpu:GL.on,materialCount:GL.art.filter(Boolean).length},
    reward:{orbits:G.build||0,starfall:starfallActive(),wave:G.starfall?G.starfall.wave:0}
  };
}
function runtimeFlightFrame(){
  const amb=RM?0:G.vt,point=posPlayer(),outer=radiusOf(0);
  const camX=(RM?0:Math.sin(amb*0.065)*1.4*u)+flightShakeX;
  const camY=(RM?0:Math.cos(amb*0.051)*1.4*u)+flightShakeY;
  const sm=SKY.mix||{tint:[0.1,0.3,0.5],rim:[0.3,0.7,0.9],dust:[0.3,0.5,0.6]},f=G.currentFlow||{};
  const planet=sm.planet;
  return {
    enabled:!!runtimeHost.flightEnabled&&GL.on&&!runtimeDestroyed,
    width:W,height:H,dpr:DPR,center:[cx,cy],
    outerCenter:[ecx(outer)+camX,ecy(outer)+camY],radii:[outer,outer*AY],
    comet:[point[0]+camX,point[1]+camY],angle:G.angle,direction:G.dir,
    visualTime:amb,travel:amb*100,active:G.state==='playing',reducedMotion:RM,
    palette:{tint:sm.tint.slice(),rim:sm.rim.slice(),dust:sm.dust.slice()},
    planet:planet?{center:[W*0.5+(planet[0]+Math.sin(GL.tw*0.14)*0.014*0.35)*H,
      H*0.5-(planet[1]+Math.cos(GL.tw*0.11)*0.009*0.35)*H],radius:planet[2]*H}:undefined,
    effects:{turn:f.turn||0,hop:f.hop||0,radial:f.radial||0,magnet:f.magnet||0,
      scorch:f.scorch||0,release:f.release||0,blackHole:f.bh||0}
  };
}
function runtimeDisposeGpu(target){
  const g=target.g;if(!g)return;
  try{
    for(const item of target.art||[])if(item)g.deleteTexture(item.texture);
    if(target.blank)g.deleteTexture(target.blank);
    for(const rt of target.rt||[]){g.deleteTexture(rt.t);g.deleteFramebuffer(rt.f);}
    if(target.src)g.deleteTexture(target.src);
    if(target.buffer)g.deleteBuffer(target.buffer);
    for(const pr of [target.pr,target.prB,target.prC]){
      if(!pr)continue;
      for(const shader of (g.getAttachedShaders(pr)||[]))g.deleteShader(shader);
      g.deleteProgram(pr);
    }
    /* Phaser may reuse its supplied background surface after Scene restart. */
    if(target!==GL||!runtimeHost.background){
      const ext=g.getExtension&&g.getExtension('WEBGL_lose_context');
      if(ext&&typeof ext.loseContext==='function')ext.loseContext();
    }
  }catch(e){}
  target.on=false;target.g=null;target.cv=null;target.pr=null;
  if(target.art)target.art=[];
  if(target.rt)target.rt=[];
}
function runtimeDestroy(){
  if(runtimeDestroyed)return;
  runtimeDestroyed=true;
  if(runtimeFrameId&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(runtimeFrameId);
  runtimeFrameId=0;
  for(const unsubscribe of runtimeUnsubscribers.splice(0)){try{unsubscribe();}catch(e){}}
  if(cloudTimer){clearTimeout(cloudTimer);cloudTimer=0;cloudPushNow();}
  if(runtimeCloudStorage&&window.storage===runtimeCloudStorage)cloudRemoveStorage();
  runtimeCloudStorage=null;
  pd=null;G.revPend=0;BEATQ.length=0;DROPQ.length=0;
  try{closeAccount();}catch(e){}
  try{if(AC&&typeof AC.close==='function')AC.close().catch(function(){});}catch(e){}
  AC=null;A=null;BED=null;
  runtimeDisposeGpu(GL);runtimeDisposeGpu(FX);
  for(const key of Object.keys(SPR))delete SPR[key];
  artifactBank.sprites=Object.create(null);
  bloomC=bloomG=haloC=haloG=haloWC=haloWG=null;
}
/* Importing the module never schedules a frame. The no-host path exists only
   for the legacy VM harnesses; production creates an external-loop runtime. */
if(!runtimeHost.externalLoop){
  runtimeFrameId=requestAnimationFrame(frame);
  freshCheck();
}
// @runtime-body:end
  return {
    step:runtimeStep,render:runtimeRender,resize,
    pointerDown,pointerMove,pointerUp,pointerCancel,keyDown,
    pause:runtimePause,resume:runtimeResume,back:runtimeBack,
    snapshot:runtimeSnapshot,flightFrame:runtimeFlightFrame,destroy:runtimeDestroy
  };
}
