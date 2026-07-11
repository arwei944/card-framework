/**
 * VirtualScroller integration tests — enable / disable / refresh / destroy.
 */

const { assert, createFrame, cleanupFrame } = require('../helpers');

describe('VirtualScroller', function() {
  let frame, container, vs;
  beforeEach(function() {
    ({ frame, container } = createFrame());
    vs = frame.virtualScroller;
  });
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; vs = null; });

  it('should be disabled initially', function() {
    assert.strictEqual(vs.enabled, false);
  });

  it('should enable and expose enabled state', function() {
    vs.enable();
    assert.strictEqual(vs.enabled, true);
  });

  it('should disable cleanly', function() {
    vs.enable();
    vs.disable();
    assert.strictEqual(vs.enabled, false);
  });

  it('should refresh without throwing when enabled', function() {
    vs.enable();
    assert.doesNotThrow(function() { vs.refresh(); });
  });

  it('should destroy without throwing', function() {
    vs.enable();
    assert.doesNotThrow(function() { vs.destroy(); });
  });
});
