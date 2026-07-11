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

  describe('T4.14 list addItem action', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('addItem appends to props.items via the store', function() {
      ({ frame, container } = createFrame());
      const card = frame.createCard('list', { title: 'L', items: ['a'] });
      const listType = frame.typeRegistry.get('list');
      const addItem = listType.actions.find(a => a.name === 'addItem');
      const origPrompt = global.prompt;
      global.prompt = () => 'b';
      try {
        addItem.handler(frame.getCard(card.id), frame.store);
      } finally {
        global.prompt = origPrompt;
      }
      assert.deepStrictEqual(frame.getCard(card.id).props.items, ['a', 'b']);
    });
  });

  describe('T4.15 batchCreateCards custom id', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('persists custom ids so getCard(customId) works', function() {
      ({ frame, container } = createFrame());
      const { success, errors } = frame.batchCreateCards([
        { id: 'custom-1', type: 'text', props: { title: 'One' } },
        { id: 'custom-2', type: 'text', props: { title: 'Two' }, position: { x: 5, y: 6 } }
      ]);
      assert.strictEqual(errors.length, 0);
      assert.strictEqual(success.length, 2);
      assert.ok(frame.getCard('custom-1'));
      assert.strictEqual(frame.getCard('custom-1').props.title, 'One');
      const two = frame.getCard('custom-2');
      assert.ok(two);
      assert.deepStrictEqual(two.position, { x: 5, y: 6 });
    });
  });

  describe('T4.16 pause/resume exception safety', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('validator resumes even if a render throws', function() {
      ({ frame, container } = createFrame());
      const v = frame.realTimeValidator;
      let resumed = false;
      v.pause = function() {};
      v.resume = function() { resumed = true; };
      frame.renderer.renderCards = function() { throw new Error('render boom'); };
      assert.throws(() => frame._renderFromStore());
      assert.strictEqual(resumed, true);
    });
  });

  describe('T4.12 import/export version compatibility', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('exportData includes the current VERSION', function() {
      ({ frame, container } = createFrame());
      const CardFrame = frame.constructor;
      assert.strictEqual(frame.exportData().version, CardFrame.VERSION);
    });

    it('export -> import round-trips cards at the same version', function() {
      ({ frame, container } = createFrame());
      frame.createCard('text', { title: 'RT' });
      const data = frame.exportData();
      const { frame: frame2, container: container2 } = createFrame();
      try {
        frame2.importData(data, { mode: 'replace' });
        assert.strictEqual(frame2.getAllCards().length, 1);
        assert.strictEqual(frame2.getAllCards()[0].props.title, 'RT');
      } finally {
        cleanupFrame(frame2, container2);
      }
    });

    it('throws on incompatible major version without a migrate fn', function() {
      ({ frame, container } = createFrame());
      assert.throws(() => {
        frame.importData({ version: '99.0', cards: [] });
      }, /不兼容/);
    });

    it('uses options.migrate for incompatible major version', function() {
      ({ frame, container } = createFrame());
      const result = frame.importData(
        { version: '99.0', cards: [{ legacyId: 'x' }] },
        {
          migrate: (data) => ({
            version: '1.0',
            cards: [{ id: 'migrated', type: 'text', props: { title: 'M' }, position: { x: 0, y: 0 }, status: 'active' }]
          })
        }
      );
      assert.strictEqual(result.importedCards, 1);
      assert.ok(frame.getCard('migrated'));
    });
  });

  describe('T4.11 destroy() cleanup', function() {
    it('clears container DOM, listeners and global store reference', function() {
      const { frame, container } = createFrame();
      const CardFrame = frame.constructor;
      const store = frame.store;
      frame.createCard('text', { title: 'x' });
      const bus = frame.eventBus;
      frame.destroy();
      assert.strictEqual(bus.listenerCount('cardAdded'), 0);
      assert.strictEqual(container.innerHTML, '');
      assert.notStrictEqual(CardFrame._globalStore, store);
      assert.strictEqual(store.cards.size, 0);
      if (container.parentNode) container.parentNode.removeChild(container);
    });

    it('constructor body stays small (delegates to _init* helpers)', function() {
      const { frame, container } = createFrame();
      assert.strictEqual(typeof frame._initModules, 'function');
      assert.strictEqual(typeof frame._initDefaultTypes, 'function');
      assert.strictEqual(typeof frame._initRenderSubscription, 'function');
      assert.strictEqual(typeof frame._initPlugins, 'function');
      assert.strictEqual(typeof frame._initValidator, 'function');
      cleanupFrame(frame, container);
    });
  });
});
