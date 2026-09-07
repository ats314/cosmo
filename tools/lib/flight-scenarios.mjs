/* Bounded genuine-runtime trajectories, shared by capture and comparison. */
export function flightScenarios(rig, checkpoint, inspectFrame = () => {}) {
  const run = rig.run;
  let frames = 0;
  const step = (count, label) => {
    for (let i = 0; i < count; i++) {
      rig.step(); frames++;
      if (i % 12 === 0) rig.render();
      inspectFrame();
    }
    checkpoint(label, rig.fingerprint());
  };
  const pointer = (kind, x, y, id = 1) => run(`${kind}({pointerId:${id},clientX:${x},clientY:${y},preventDefault(){}})`);
  const start = level => run(`ensureAudio(); G.level=${level}; G.startLevel=${level}; startGame(); G.invuln=1e12; SWIPE_MODE='screen'; G.swipeAsked=true;`);
  rig.render();
  checkpoint('menu', rig.fingerprint());
  for (let level = 1; level <= 6; level++) {
    start(level);
    step(30, `level-${level}:moving`);
    pointer('pointerDown', 200, 400);
    step(9, `level-${level}:held-tap`);
    pointer('pointerUp', 200, 400);
    step(15, `level-${level}:committed-tap`);
    pointer('pointerDown', 200, 400);
    pointer('pointerMove', 200, 452);
    pointer('pointerUp', 200, 452);
    step(15, `level-${level}:screen-swipe`);
    run("SWIPE_MODE='radial'");
    pointer('pointerDown', 100, 300);
    run('pointerMove({pointerId:1,clientX:100-Math.cos(pd.ang)*70,clientY:300-Math.sin(pd.ang)*AY*70,preventDefault(){}})');
    pointer('pointerUp', 100, 300);
    step(15, `level-${level}:radial-swipe`);
    run("keyDown({code:'Space',key:' ',repeat:false,preventDefault(){}}); keyDown({code:'Space',key:' ',repeat:true,preventDefault(){}})");
    step(15, `level-${level}:keyboard-repeat`);
  }
  run('runtimePause()');
  step(90, 'pause-frozen');
  run('runtimeResume()');
  step(179, 'resume-count-in');
  step(5, 'resume-live');
  start(5);
  run('G.spikes=[];G.stars=[];G.pows=[]');
  for (const type of ['shield', 'warp', 'nova', 'spot', 'hyper', 'mirror', 'scorch', 'slip', 'trail']) {
    run(`G.pows.push({a:G.angle,ring:effRing(),t:0,life:7,type:${JSON.stringify(type)}})`);
    step(12, `power-${type}`);
  }
  run('G.pows=[];G.spikes=[];G.build=dropNeed();armDrop("ORBIT","orbit")');
  step(90, 'starfall-active');
  run('startBlackHole()');
  step(90, 'black-hole-opening');
  run('G.ringI=3;G.hopP=1;G.hopFromI=3;G.hopFrom=radiusOf(3)');
  step(420, 'black-hole-inner-charge');
  run('BH.t=12.1;G.ringI=0;G.hopP=1;G.hopFromI=0;G.hopFrom=radiusOf(0)');
  step(90, 'black-hole-escape-and-reward-resume');
  start(6);
  run('G.invuln=0;G.shields=0;die()');
  step(45, 'death');
  run('retry()');
  step(30, 'retry');
  return frames;
}
