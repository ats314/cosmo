/* Completion-card motion is outside the original 3,482-frame trajectory set.
   Exercise it separately without replacing any original gameplay fixture. */
import assert from 'node:assert/strict';
import { flightSandbox } from './flight-sandbox.mjs';

export function verifyFlightTransitions(source) {
  let scenarios = 0, frames = 0;
  const close = (actual, expected, label) =>
    assert(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
  for (const reducedMotion of [false, true]) for (const direction of [-1, 1]) {
    for (let level = 1; level <= 5; level++) for (const hopping of [false, true]) {
      const label = `L${level}/${direction}/${reducedMotion ? 'reduced' : 'normal'}/${hopping ? 'hop' : 'settled'}`;
      const rig = flightSandbox(source, 1200 + level, { reducedMotion });
      rig.run(`G.level=${level}; startGame(); G.score=1250; G.nRings=Math.max(2,G.nRings);
        G.angle=2.63; G.prevAngle=G.angle; G.dir=${direction}; G.ringI=1;
        G.hopFromI=0; G.hopFrom=radiusOf(0); G.hopP=${hopping ? 0.25 : 1};
        G.slow=0.8; G.tsCur=0.55; G.stop=0.12; G.shake=0;`);
      const sample = () => JSON.parse(rig.run(`JSON.stringify({
        state:G.state, angle:G.angle, direction:G.dir, point:posPlayer(),
        radius:curR(), hop:G.hopP, t:G.t, vt:G.vt, score:G.score,
        outer:radiusOf(0), center:[ecx(curR()),ecy(curR())], ay:AY,
        trail:G.trail.length ? G.trail[G.trail.length-1] : null
      })`));
      const before = sample();
      rig.run('levelComplete()');
      let previous = sample();
      assert.equal(previous.state, 'lvend', `${label}: completion card not entered`);
      assert.deepEqual(previous.point, before.point, `${label}: completion snapped position`);
      assert.equal(previous.angle, before.angle, `${label}: completion snapped angle`);
      assert.equal(previous.hop, before.hop, `${label}: completion snapped an unfinished hop`);
      assert.equal(previous.direction, direction, `${label}: completion reversed direction`);

      // Mixed frame rates, a stalled frame (the host clamps to 50 ms), and
      // zero-delta steps must all preserve elapsed-time angular motion.
      const deltas = [1000 / 120, 1000 / 60, 40, 0, 500];
      for (let i = 0; i < 150; i++) {
        const ms = deltas[i % deltas.length], dt = Math.min(ms / 1000, 0.05);
        rig.step(ms); frames++;
        const current = sample(), frame = rig.flightFrame();
        assert.equal(current.state, 'lvend', `${label}: card expired before a choice`);
        close(current.angle, previous.angle + 0.8 * dt * direction, `${label}: angular glide`);
        close(current.t - previous.t, dt, `${label}: run clock`);
        close(current.hop, Math.min(1, previous.hop + dt / 0.14), `${label}: hop completion`);
        assert(current.vt >= previous.vt, `${label}: presentation clock went backwards`);
        if (dt > 0) assert(current.vt > previous.vt, `${label}: flight clock froze on the card`);
        close(frame.visualTime, reducedMotion ? 0 : current.vt, `${label}: flight visual clock`);
        close(frame.travel, reducedMotion ? 0 : current.vt * 100, `${label}: forward distance`);
        assert.equal(current.score, before.score, `${label}: decorative glide earned score`);
        close(current.point[0], current.center[0] + Math.cos(current.angle) * current.radius, `${label}: projected x`);
        close(current.point[1], current.center[1] + Math.sin(current.angle) * current.radius * current.ay, `${label}: projected y`);
        close(current.trail.x, current.point[0], `${label}: stale trail x`);
        close(current.trail.y, current.point[1], `${label}: stale trail y`);
        if (previous.hop === 1) {
          // Bound the chord displacement independently of posAt(). A hidden
          // coordinate reset would be far larger than this angular step.
          const maxStep = current.outer * 0.8 * dt * Math.max(1, current.ay);
          assert(Math.hypot(current.point[0] - previous.point[0], current.point[1] - previous.point[1]) <= maxStep + 1e-8,
            `${label}: settled orbit snapped between frames`);
        }
        previous = current;
      }
      assert.equal(previous.hop, 1, `${label}: hop did not settle during card`);
      scenarios++;
    }
  }
  return { scenarios, frames };
}
