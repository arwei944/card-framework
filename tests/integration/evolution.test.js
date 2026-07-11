/**
 * EvolutionEngine integration tests — module wiring and metrics API.
 * Note: we do NOT call start() to avoid timer/network side effects;
 * we verify the engine is wired and exposes a stable metrics/history API.
 */

const { assert, createFrame, cleanupFrame } = require('../helpers');

describe('EvolutionEngine', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should be created when evolution is enabled', function() {
    ({ frame, container } = createFrame({ evolution: true }));
    assert.ok(frame.evolutionEngine);
    assert.strictEqual(typeof frame.evolutionEngine.stop, 'function');
  });

  it('should return a metrics snapshot object', function() {
    ({ frame, container } = createFrame({ evolution: true }));
    const metrics = frame.evolutionEngine.getMetrics();
    assert.strictEqual(typeof metrics, 'object');
  });

  it('should return an evolution history array', function() {
    ({ frame, container } = createFrame({ evolution: true }));
    const history = frame.evolutionEngine.getEvolutionHistory();
    assert.strictEqual(Array.isArray(history), true);
  });

  it('should stop cleanly', function() {
    ({ frame, container } = createFrame({ evolution: true }));
    assert.doesNotThrow(function() { frame.evolutionEngine.stop(); });
  });
});
