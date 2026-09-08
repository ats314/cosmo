/* Solar encounter cadence is a presentation contract, independent of the
   difficulty clock. Probe the real render sampler and copied frame together. */
import assert from 'node:assert/strict';
import { flightSandbox } from './flight-sandbox.mjs';

const order = [6, 7, 2, 8, 9, 0, 10, 3];
export function verifySolarVoyage(source) {
  let handoffs = 0;
  for (const reducedMotion of [false, true]) {
    const rig = flightSandbox(source, 1041, { reducedMotion });
    rig.run('ensureAudio();beginIntro()');
    if (reducedMotion) rig.run('toggleMute()');
    rig.render();
    let origin = rig.run('G.vt');
    const read = () => {
      const before = rig.fingerprint(), memo = rig.run('JSON.stringify(SOLAR_FLIGHT)');
      const frame = rig.flightFrame();
      const copy = { voyage: { ...frame.voyage }, nextVoyage: frame.nextVoyage && { ...frame.nextVoyage },
        voyageBlend: frame.voyageBlend };
      assert.deepEqual(rig.fingerprint(), before, 'solar frame read changes gameplay, RNG, audio or storage');
      assert.equal(rig.run('JSON.stringify(SOLAR_FLIGHT)'), memo, 'solar frame getter advances its presentation memo');
      frame.voyage.progress = 99;
      if (frame.nextVoyage) frame.nextVoyage.progress = 99;
      const fresh = rig.flightFrame();
      assert.deepEqual({ ...fresh.voyage }, copy.voyage, 'solar frame exposes mutable current scenery');
      assert.deepEqual(fresh.nextVoyage && { ...fresh.nextVoyage }, copy.nextVoyage, 'solar frame exposes mutable incoming scenery');
      return copy;
    };
    const at = elapsed => { rig.run(`G.vt=${origin + elapsed}`); rig.render(); return read(); };
    const opening = read();
    assert.equal(opening.voyage.chapter, 6, 'first launch does not start at Mercury');
    assert(opening.voyage.progress > 0.3, 'first launch waits at a distant empty approach');
    const intro = at(60);
    assert.deepEqual(intro, opening, 'learning the controls skips the solar encounters');
    rig.run('finishIntro()'); rig.render();
    assert.deepEqual(read(), intro, 'skipping the introduction restarts or jumps the flyby');
    origin = rig.run('G.vt');
    for (let i = 0; i < order.length; i++) {
      assert.equal(at(i * 9.5 + 4).voyage.chapter, order[i], 'level 1 does not visit all eight planets in order');
      if (i === order.length - 1) break;
      const left = at((i + 1) * 9.5 - 0.00001), right = at((i + 1) * 9.5 + 0.00001);
      assert.equal(left.nextVoyage?.chapter, right.voyage.chapter, 'solar handoff changes the incoming world');
      assert(left.voyageBlend > 0.999, 'solar handoff changes worlds before the overlap completes');
      assert(Math.abs(left.nextVoyage.progress - right.voyage.progress) < 0.0001,
        'solar handoff jumps the incoming camera pose');
      handoffs++;
    }
    const outer = at(200);
    assert.equal(outer.voyage.chapter, 3, 'the solar itinerary loops back after Neptune');
    assert(outer.voyage.progress < 1, 'Neptune leaves an empty scene before the real level ends');
    assert.equal(outer.nextVoyage, undefined, 'Neptune invents another solar stop');
    // A fresh run resets the presentation identity without editing gameplay.
    rig.run('startGame()'); rig.render();
    assert.deepEqual(read().voyage, opening.voyage, 'a fresh run inherits the previous solar destination');
    rig.run('G.vt+=6'); rig.render(); const held = read();
    rig.run('runtimePause()');
    for (let i = 0; i < 12; i++) { rig.step(100); rig.render(); }
    assert.deepEqual(read(), held, 'paused solar travel keeps moving');
    rig.run('startGame()'); rig.render();
    rig.run('G.vt+=6'); rig.render(); const alive = read();
    rig.run('G.invuln=0;G.shields=0;die();G.vt+=900;G.t+=900'); rig.render();
    assert.deepEqual(read(), alive, 'the retry screen advances the solar itinerary');
  }
  return { planets: order.length, handoffs };
}
