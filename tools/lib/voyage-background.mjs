/* Command-level integration for the sky ownership guard. Chromium owns the
   real shader-failure and context-loss checks in enginecheck. */
import assert from 'node:assert/strict';
import { flightSandbox } from './flight-sandbox.mjs';

export function verifyVoyageBackground(source) {
  const makeRig = ready => {
    const rig = flightSandbox(source, 934);
    rig.run(`startGame();G.invuln=1e12;
      const skyLog={draws:0,uploads:0,binds:0,layer:0};
      const skyArt=Object.fromEntries(SKY_MATERIALS.map(([key])=>[key,{width:4,height:4}]));
      runtimeHost.getTexture=key=>skyArt[key];
      runtimeHost.hasVoyageScene=()=>${ready};
      GL.cv={};GL.vw=GL.vh=0;GL.on=true;
      GL.u=new Proxy({},{get:(_target,key)=>key});
      GL.g={viewport(){},useProgram(){},activeTexture(){},pixelStorei(){},texParameteri(){},
        createTexture(){return {};},deleteTexture(){},bindTexture(){skyLog.binds++;},
        texImage2D(){skyLog.uploads++;},uniform1i(){},uniform1f(key,value){if(key==='uVoyageLayer')skyLog.layer=value;},uniform2f(){},uniform3f(){},uniform4f(){},
        drawArrays(){skyLog.draws++;}}`);
    return rig;
  };
  const classic = makeRig(false), voyage = makeRig(true);
  for (let i = 0; i < 12; i++) {
    for (const rig of [classic, voyage]) { rig.step(); rig.run('glRender(1/60)'); }
    assert.deepEqual(voyage.fingerprint(), classic.fingerprint(),
      'composing flyby bodies changes game state, sky evolution, audio, RNG or storage');
  }
  const read = (rig, expression) => JSON.parse(rig.run(`JSON.stringify(${expression})`));
  assert.equal(classic.run('skyLog.draws'), 12);
  assert.equal(voyage.run('skyLog.draws'), 12, 'flyby hides the original living cloud field');
  assert.equal(voyage.run('skyLog.layer'), 1, 'ready flyby does not replace the fixed planet');
  assert.equal(classic.run('skyLog.layer'), 0, 'classic view loses its planet');
  assert.equal(voyage.run('skyLog.uploads'), 3, 'living sky no longer initializes its fallback materials');
  assert(voyage.run('skyLog.binds') >= 36, 'living sky stops binding its cached materials');
  assert(voyage.run('GL.on && GL.tw>0'), 'living sky loses readiness or its presentation clock');
  assert.deepEqual(read(voyage, '[GL.tw,GL.stream]'), read(classic, '[GL.tw,GL.stream]'), 'living sky freezes its presentation clocks');

  const rig = voyage;
  const check = (setup, layer, label) => {
    rig.run(setup);
    const before = rig.run('skyLog.draws');
    rig.run('glRender(1/60)');
    assert.equal(rig.run('skyLog.draws') - before, 1, label);
    assert.equal(rig.run('skyLog.layer'), layer, label);
    assert.equal(rig.run('GL.on'), true, `${label}: guard disabled the fallback GPU`);
  };
  check('delete runtimeHost.hasVoyageScene', 0, 'missing readiness callback must draw classic');
  check('runtimeHost.hasVoyageScene=()=>false', 0, 'failed readiness must draw classic');
  check('runtimeHost.hasVoyageScene=()=>1', 0, 'truthy non-boolean readiness must draw classic');
  check('runtimeHost.hasVoyageScene=()=>{throw new Error("unavailable")}', 0, 'throwing readiness must draw classic');
  check('runtimeHost.hasVoyageScene=()=>true', 1, 'recovered readiness must restore the flyby composition');
  check("G.state='lvend';G.lvCard={done:true,next:2}", 0, 'completed passage must retain its classic underlay');
  check('G.lvCard.done=false', 1, 'selected start must show its destination over the living sky');
  check("G.state='playing';LAB.on=true", 0, 'lab must retain its original sky');
  check("LAB.on=false;G.state='powersel'", 0, 'power picker must retain its original sky');
  check("G.state='swipesel'", 0, 'control picker must retain its original sky');
  check("G.state='menu';runtimeHost.flightEnabled=false", 0, 'classic comparison must retain its original sky');
  return { fallbackCases: 11, pairedFrames: 12 };
}
