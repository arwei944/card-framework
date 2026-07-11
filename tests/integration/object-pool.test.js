/**
 * CardObjectPool integration tests — acquire / release / recycling.
 */

const { assert, getModule } = require('../helpers');

describe('CardObjectPool', function() {
  let CardObjectPool;
  before(function() { CardObjectPool = getModule().CardObjectPool; });

  it('should return null when pool is empty', function() {
    const pool = new CardObjectPool();
    assert.strictEqual(pool.acquire('text'), null);
  });

  it('should recycle a released card on acquire', function() {
    const pool = new CardObjectPool();
    const card = { type: 'text', id: 'x', props: {}, _relations: [] };
    pool.release(card);
    const acquired = pool.acquire('text');
    assert.notStrictEqual(acquired, null);
    assert.strictEqual(acquired.type, 'text');
    assert.strictEqual(acquired._inPool, false);
  });

  it('should not double-release the same card', function() {
    const pool = new CardObjectPool();
    const card = { type: 'text', id: 'x', props: {}, _relations: [] };
    pool.release(card);
    pool.release(card);
    const a1 = pool.acquire('text');
    const a2 = pool.acquire('text');
    assert.notStrictEqual(a1, null);
    assert.strictEqual(a2, null);
  });

  it('should clear the pool', function() {
    const pool = new CardObjectPool();
    pool.release({ type: 'text', id: 'x', props: {}, _relations: [] });
    pool.clear();
    assert.strictEqual(pool.acquire('text'), null);
  });
});
