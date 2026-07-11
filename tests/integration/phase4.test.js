/**
 * Phase 4 (P0 bug) regression tests — lock in the critical fixes:
 *   T4.01  RealTimeValidator.handleMutations debounce
 *   T4.02  importData routes through the Store API
 *   T4.03  Store returns deep-cloned cards (no reference sharing)
 *   T4.04  ShadowCardElement._cleanup arg order (verified in web-component tests)
 */

const { assert, createFrame, cleanupFrame, waitFor } = require('../helpers');

describe('Phase 4 — P0 regression', function() {
  describe('T4.03 Store deep-clone isolation', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('mutating a getCard() result must not affect the store', function() {
      ({ frame, container } = createFrame());
      const card = frame.createCard('text', { title: 'orig' });
      const fetched = frame.getCard(card.id);
      fetched.props.title = 'mutated';
      const again = frame.getCard(card.id);
      assert.strictEqual(again.props.title, 'orig');
    });

    it('mutating input props before createCard must not leak into the store', function() {
      ({ frame, container } = createFrame());
      const input = { title: 'input' };
      frame.createCard('text', input);
      input.title = 'changed';
      const all = frame.getAllCards();
      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].props.title, 'input');
    });
  });

  describe('T4.02 importData via Store API', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('imported cards are queryable through the Store', function() {
      ({ frame, container } = createFrame());
      const result = frame.importData({
        cards: [{ id: 'imp1', type: 'text', props: { title: 'Imported' }, position: { x: 0, y: 0 }, status: 'active' }]
      }, { mode: 'merge' });
      assert.strictEqual(result.importedCards, 1);
      const imported = frame.getCard('imp1');
      assert.ok(imported);
      assert.strictEqual(imported.props.title, 'Imported');
    });

    it('importData fires CARD_ADDED events', function() {
      ({ frame, container } = createFrame());
      let fired = 0;
      frame.eventBus.on('cardAdded', () => { fired++; });
      frame.importData({
        cards: [{ id: 'imp2', type: 'text', props: { title: 'X' }, position: { x: 0, y: 0 }, status: 'active' }]
      }, { mode: 'merge' });
      assert.strictEqual(fired, 1);
    });

    it('importData does not share the input object with the store', function() {
      ({ frame, container } = createFrame());
      const input = { id: 'imp3', type: 'text', props: { title: 'A' }, position: { x: 0, y: 0 }, status: 'active' };
      frame.importData({ cards: [input] }, { mode: 'merge' });
      input.props.title = 'B';
      assert.strictEqual(frame.getCard('imp3').props.title, 'A');
    });
  });

  describe('T4.01 handleMutations debounce', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('multiple rapid mutations trigger validateAll only once', async function() {
      ({ frame, container } = createFrame());
      const v = frame.realTimeValidator;
      let calls = 0;
      const orig = v.validateAll.bind(v);
      v.validateAll = function() { calls++; return orig(); };
      v.handleMutations([]);
      v.handleMutations([]);
      v.handleMutations([]);
      await waitFor(() => calls >= 1, 600);
      assert.strictEqual(calls, 1);
    });
  });
});
