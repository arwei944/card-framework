/**
 * CardFrame Integration Tests
 *
 * Tests the full framework end-to-end with jsdom real DOM.
 * Verifies module wiring, card CRUD, relationships, import/export, destroy.
 */

const { assert, getCardFrame, createContainer, createFrame, cleanupFrame } = require('../helpers');

describe('CardFrame Integration', function() {
  let CardFrame;

  before(function() {
    CardFrame = getCardFrame();
  });

  describe('Constructor', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('should create a CardFrame instance with a container element', function() {
      container = createContainer();
      frame = new CardFrame(container, { evolution: false, autoValidate: false });
      assert.ok(frame);
      assert.strictEqual(frame.container, container);
      assert.ok(frame.eventBus);
      assert.ok(frame.store);
      assert.ok(frame.typeRegistry);
      assert.ok(frame.renderer);
    });

    it('should accept a string selector as container', function() {
      container = createContainer('my-container');
      frame = new CardFrame('#my-container', { evolution: false, autoValidate: false });
      assert.strictEqual(frame.container, container);
    });

    it('should throw for non-existent container selector', function() {
      assert.throws(() => {
        new CardFrame('#non-existent', { evolution: false });
      }, /找不到容器元素/);
    });

    it('should return existing instance for same container', function() {
      container = createContainer();
      frame = new CardFrame(container, { evolution: false, autoValidate: false });
      const frame2 = new CardFrame(container, { evolution: false });
      assert.strictEqual(frame, frame2);
    });

    it('should register default card types', function() {
      container = createContainer();
      frame = new CardFrame(container, { evolution: false, autoValidate: false });
      const types = frame.typeRegistry.getAll();
      assert.ok(types.length >= 6);
      const typeNames = types.map(t => t.type);
      assert.ok(typeNames.includes('base'));
      assert.ok(typeNames.includes('text'));
      assert.ok(typeNames.includes('task'));
    });
  });

  describe('Card CRUD', function() {
    let frame, container;
    beforeEach(function() {
      ({ frame, container } = createFrame());
    });
    afterEach(function() { cleanupFrame(frame, container); });

    it('should create a card', function() {
      const card = frame.createCard('text', { title: 'Hello', content: 'World' });
      assert.ok(card);
      assert.strictEqual(card.type, 'text');
      assert.strictEqual(card.props.title, 'Hello');
      assert.ok(card.id);
    });

    it('should not create abstract type cards', function() {
      assert.throws(() => {
        frame.createCard('base', { title: 'test' });
      }, /抽象类型/);
    });

    it('should get a card by ID', function() {
      const card = frame.createCard('text', { title: 'Test' });
      const retrieved = frame.getCard(card.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.id, card.id);
    });

    it('should get all cards', function() {
      frame.createCard('text', { title: 'A' });
      frame.createCard('text', { title: 'B' });
      frame.createCard('task', { title: 'C' });
      assert.strictEqual(frame.getAllCards().length, 3);
    });

    it('should get cards by type', function() {
      frame.createCard('text', { title: 'A' });
      frame.createCard('text', { title: 'B' });
      frame.createCard('task', { title: 'C' });
      assert.strictEqual(frame.getCardsByType('text').length, 2);
      assert.strictEqual(frame.getCardsByType('task').length, 1);
    });

    it('should update a card', function() {
      const card = frame.createCard('text', { title: 'Old' });
      card.props.title = 'New';
      frame.updateCard(card);
      const updated = frame.getCard(card.id);
      assert.strictEqual(updated.props.title, 'New');
    });

    it('should remove a card', function() {
      const card = frame.createCard('text', { title: 'Test' });
      const result = frame.removeCard(card.id);
      assert.strictEqual(result, true);
      assert.strictEqual(frame.getCard(card.id), undefined);
    });
  });

  describe('Relationships', function() {
    let frame, container;
    beforeEach(function() {
      ({ frame, container } = createFrame());
    });
    afterEach(function() { cleanupFrame(frame, container); });

    it('should create a relationship between cards', function() {
      const c1 = frame.createCard('text', { title: 'A' });
      const c2 = frame.createCard('text', { title: 'B' });
      const rel = frame.createRelationship(c1.id, c2.id, 'reference');
      assert.ok(rel);
      assert.ok(rel.id);
      assert.strictEqual(rel.sourceId, c1.id);
      assert.strictEqual(rel.targetId, c2.id);
    });

    it('should get all relationships', function() {
      const c1 = frame.createCard('text', { title: 'A' });
      const c2 = frame.createCard('text', { title: 'B' });
      frame.createRelationship(c1.id, c2.id, 'reference');
      assert.strictEqual(frame.getAllRelationships().length, 1);
    });

    it('should remove a relationship', function() {
      const c1 = frame.createCard('text', { title: 'A' });
      const c2 = frame.createCard('text', { title: 'B' });
      const rel = frame.createRelationship(c1.id, c2.id, 'reference');
      assert.strictEqual(frame.removeRelationship(rel.id), true);
      assert.strictEqual(frame.getRelationship(rel.id), undefined);
    });
  });

  describe('Import/Export', function() {
    let frame, container;
    beforeEach(function() {
      ({ frame, container } = createFrame());
    });
    afterEach(function() { cleanupFrame(frame, container); });

    it('should export data as object', function() {
      frame.createCard('text', { title: 'A' });
      frame.createCard('task', { title: 'B' });
      const data = frame.exportData();
      assert.ok(data.cards);
      assert.strictEqual(data.cards.length, 2);
      assert.ok(data.metadata);
      assert.strictEqual(data.metadata.cardCount, 2);
    });

    it('should export data as JSON string', function() {
      frame.createCard('text', { title: 'A' });
      const json = frame.exportJSON();
      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.cards.length, 1);
    });

    it('should import data in merge mode', function() {
      frame.createCard('text', { title: 'Existing' });
      const importData = {
        version: '1.0',
        cards: [
          { id: 'imported_1', type: 'text', props: { title: 'Imported' }, position: { x: 0, y: 0 }, status: 'active' }
        ],
        relationships: []
      };
      const result = frame.importData(importData, { mode: 'merge' });
      assert.strictEqual(result.importedCards, 1);
      assert.strictEqual(frame.getAllCards().length, 2);
    });
  });

  describe('Events', function() {
    let frame, container;
    beforeEach(function() {
      ({ frame, container } = createFrame());
    });
    afterEach(function() { cleanupFrame(frame, container); });

    it('should fire cardAdded event on createCard', function(done) {
      frame.on('cardAdded', (e) => {
        assert.ok(e.detail.card);
        done();
      });
      frame.createCard('text', { title: 'Test' });
    });

    it('should fire cardRemoved event on removeCard', function(done) {
      const card = frame.createCard('text', { title: 'Test' });
      frame.on('cardRemoved', (e) => {
        assert.strictEqual(e.detail.cardId, card.id);
        done();
      });
      frame.removeCard(card.id);
    });

    it('should support once() listeners', function() {
      let count = 0;
      frame.once('cardAdded', () => count++);
      frame.createCard('text', { title: 'A' });
      frame.createCard('text', { title: 'B' });
      assert.strictEqual(count, 1);
    });

    it('should support off() to remove listeners', function() {
      let called = false;
      const handler = () => { called = true; };
      frame.on('cardAdded', handler);
      frame.off('cardAdded', handler);
      frame.createCard('text', { title: 'A' });
      assert.strictEqual(called, false);
    });
  });

  describe('destroy()', function() {
    it('should clean up all resources', function() {
      const { frame, container } = createFrame();
      frame.createCard('text', { title: 'A' });
      frame.destroy();
      assert.strictEqual(frame._destroyed, true);
      assert.strictEqual(frame.eventBus, null);
      assert.strictEqual(frame.renderer, null);
      assert.strictEqual(frame.pluginManager, null);
      cleanupFrame(frame, container);
    });

    it('should be safe to call destroy() twice', function() {
      const { frame, container } = createFrame();
      frame.destroy();
      assert.doesNotThrow(() => frame.destroy());
      cleanupFrame(frame, container);
    });
  });

  describe('Stats', function() {
    let frame, container;
    beforeEach(function() {
      ({ frame, container } = createFrame());
    });
    afterEach(function() { cleanupFrame(frame, container); });

    it('should return stats object', function() {
      frame.createCard('text', { title: 'A' });
      frame.createCard('task', { title: 'B' });
      const stats = frame.getStats();
      assert.ok(stats.cards);
      assert.strictEqual(stats.cards.total, 2);
      assert.ok(stats.cards.byType);
      assert.ok(stats.relationships);
      assert.ok(stats.layout);
    });
  });
});
