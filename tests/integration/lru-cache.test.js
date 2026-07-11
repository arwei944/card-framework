/**
 * LayoutCache (LRU) integration tests — set / get / markDirty / clear.
 */

const { assert, getModule } = require('../helpers');

describe('LayoutCache', function() {
  let LayoutCache;
  before(function() { LayoutCache = getModule().LayoutCache; });

  it('should store and retrieve a layout result', function() {
    const cache = new LayoutCache();
    cache.set('a', { x: 1, y: 2 });
    assert.deepStrictEqual(cache.get('a'), { x: 1, y: 2 });
  });

  it('should return null for a missing key', function() {
    const cache = new LayoutCache();
    assert.strictEqual(cache.get('missing'), null);
  });

  it('should track dirty state via markDirty / isDirty', function() {
    const cache = new LayoutCache();
    cache.set('a', { x: 1 });
    cache.markDirty('a');
    assert.strictEqual(cache.isDirty('a'), true);
  });

  it('should update access order (LRU) on get', function() {
    const cache = new LayoutCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // a becomes most-recently-used
    cache.set('c', 3); // should evict 'b', not 'a'
    assert.strictEqual(cache.get('a'), 1);
    assert.strictEqual(cache.get('b'), null);
  });

  it('should clear all entries', function() {
    const cache = new LayoutCache();
    cache.set('a', 1);
    cache.clear();
    assert.strictEqual(cache.get('a'), null);
  });
});
