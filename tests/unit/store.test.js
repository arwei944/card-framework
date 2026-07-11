/**
 * Store Unit Tests
 *
 * Tests: addCard, getCard, getAllCards, updateCard, removeCard, getCardsByType,
 * addRelationship, removeRelationship, getRelationship, subscribe/notify,
 * toJSON/fromJSON, EventBus emission
 */

const { assert, getModule } = require('../helpers');

describe('Store', function() {
  let Store;
  let EventBus;
  let bus;
  let store;

  before(function() {
    const CF = getModule();
    Store = CF.Store;
    EventBus = CF.EventBus;
  });

  beforeEach(function() {
    bus = new EventBus();
    store = new Store(bus);
  });

  afterEach(function() {
    store = null;
    bus.clear();
  });

  function makeCard(id, type = 'text', props = {}) {
    return {
      id: id || `card_${Math.random().toString(36).slice(2)}`,
      type,
      props: { title: 'Test', ...props },
      position: { x: 0, y: 0 },
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  describe('addCard()', function() {
    it('should add a card to the store', function() {
      const card = makeCard('card_1');
      store.addCard(card);
      const stored = store.getCard('card_1');
      assert.ok(stored);
      assert.strictEqual(stored.id, 'card_1');
      assert.strictEqual(stored.type, 'text');
      assert.strictEqual(stored.props.title, 'Test');
    });

    it('should emit cardAdded event', function(done) {
      bus.on('cardAdded', (e) => {
        assert.strictEqual(e.detail.card.id, 'card_1');
        done();
      });
      store.addCard(makeCard('card_1'));
    });

    it('should handle multiple cards', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      store.addCard(makeCard('card_3'));
      assert.strictEqual(store.getAllCards().length, 3);
    });
  });

  describe('getCard()', function() {
    it('should return the card for a valid ID', function() {
      const card = makeCard('card_1');
      store.addCard(card);
      const stored = store.getCard('card_1');
      assert.ok(stored);
      assert.strictEqual(stored.id, 'card_1');
      assert.strictEqual(stored.props.title, 'Test');
    });

    it('should return undefined for a non-existent ID', function() {
      assert.strictEqual(store.getCard('nonexistent'), undefined);
    });
  });

  describe('getAllCards()', function() {
    it('should return an array of all cards', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      const cards = store.getAllCards();
      assert.ok(Array.isArray(cards));
      assert.strictEqual(cards.length, 2);
    });

    it('should return an empty array when store is empty', function() {
      assert.deepStrictEqual(store.getAllCards(), []);
    });
  });

  describe('getCardsByType()', function() {
    it('should filter cards by type', function() {
      store.addCard(makeCard('card_1', 'text'));
      store.addCard(makeCard('card_2', 'task'));
      store.addCard(makeCard('card_3', 'text'));
      assert.strictEqual(store.getCardsByType('text').length, 2);
      assert.strictEqual(store.getCardsByType('task').length, 1);
    });
  });

  describe('updateCard()', function() {
    it('should update an existing card', function() {
      const card = makeCard('card_1', 'text', { title: 'Old' });
      store.addCard(card);
      const updated = { ...card, props: { title: 'New' } };
      store.updateCard(updated);
      assert.strictEqual(store.getCard('card_1').props.title, 'New');
    });

    it('should emit cardUpdated event', function(done) {
      const card = makeCard('card_1');
      store.addCard(card);
      bus.on('cardUpdated', (e) => {
        assert.strictEqual(e.detail.card.id, 'card_1');
        done();
      });
      store.updateCard({ ...card, props: { title: 'Updated' } });
    });

    it('should return null for non-existent card', function() {
      const result = store.updateCard(makeCard('nonexistent'));
      assert.strictEqual(result, null);
    });
  });

  describe('removeCard()', function() {
    it('should remove a card from the store', function() {
      store.addCard(makeCard('card_1'));
      const result = store.removeCard('card_1');
      assert.strictEqual(result, true);
      assert.strictEqual(store.getCard('card_1'), undefined);
    });

    it('should emit cardRemoved event', function(done) {
      store.addCard(makeCard('card_1'));
      bus.on('cardRemoved', (e) => {
        assert.strictEqual(e.detail.cardId, 'card_1');
        done();
      });
      store.removeCard('card_1');
    });

    it('should return false for non-existent card', function() {
      assert.strictEqual(store.removeCard('nonexistent'), false);
    });
  });

  describe('Relationships', function() {
    it('should add a relationship', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      const rel = store.addRelationship({
        sourceId: 'card_1',
        targetId: 'card_2',
        type: 'reference',
        data: {},
      });
      assert.ok(rel);
      assert.ok(rel.id);
    });

    it('should get a relationship by ID', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      const rel = store.addRelationship({
        sourceId: 'card_1', targetId: 'card_2', type: 'reference', data: {},
      });
      assert.strictEqual(store.getRelationship(rel.id), rel);
    });

    it('should remove a relationship', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      const rel = store.addRelationship({
        sourceId: 'card_1', targetId: 'card_2', type: 'reference', data: {},
      });
      assert.strictEqual(store.removeRelationship(rel.id), true);
      assert.strictEqual(store.getRelationship(rel.id), undefined);
    });

    it('should get relationships by card', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      store.addCard(makeCard('card_3'));
      store.addRelationship({ sourceId: 'card_1', targetId: 'card_2', type: 'reference', data: {} });
      store.addRelationship({ sourceId: 'card_1', targetId: 'card_3', type: 'parent', data: {} });
      store.addRelationship({ sourceId: 'card_2', targetId: 'card_3', type: 'dependency', data: {} });
      const rels = store.getRelationshipsByCard('card_1');
      assert.strictEqual(rels.length, 2);
    });

    it('should keep relationship index consistent after removeRelationship', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      const rel = store.addRelationship({ sourceId: 'card_1', targetId: 'card_2', type: 'reference', data: {} });
      store.removeRelationship(rel.id);
      assert.deepStrictEqual(store.getRelationshipsByCard('card_1'), []);
      assert.deepStrictEqual(store.getRelationshipsByCard('card_2'), []);
    });

    it('should clean up relationships from index when a card is removed', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      store.addRelationship({ sourceId: 'card_1', targetId: 'card_2', type: 'reference', data: {} });
      store.removeCard('card_1');
      assert.deepStrictEqual(store.getRelationshipsByCard('card_2'), []);
      assert.strictEqual(store.getAllRelationships().length, 0);
    });

    it('should rebuild relationship index in fromJSON', function() {
      store.addCard(makeCard('card_1'));
      store.addCard(makeCard('card_2'));
      store.addRelationship({ sourceId: 'card_1', targetId: 'card_2', type: 'reference', data: {} });
      const restored = Store.fromJSON(store.toJSON(), bus);
      assert.strictEqual(restored.getRelationshipsByCard('card_1').length, 1);
    });
  });

  describe('notifyDebounced()', function() {
    it('should coalesce multiple calls into a single notify', function(done) {
      let called = 0;
      store.subscribe(() => called++);
      store.notifyDebounced();
      store.notifyDebounced();
      store.notifyDebounced();
      assert.strictEqual(called, 0);
      setTimeout(() => {
        assert.strictEqual(called, 1);
        done();
      }, 40);
    });
  });

  describe('subscribe() / notify()', function() {
    it('should call subscriber on notify', function() {
      let called = 0;
      store.subscribe(() => called++);
      store.notify();
      assert.strictEqual(called, 1);
    });

    it('should support multiple subscribers', function() {
      let count = 0;
      store.subscribe(() => count++);
      store.subscribe(() => count++);
      store.notify();
      assert.strictEqual(count, 2);
    });
  });

  describe('toJSON() / fromJSON()', function() {
    it('should serialize to JSON and back', function() {
      store.addCard(makeCard('card_1', 'text', { title: 'Hello' }));
      store.addCard(makeCard('card_2', 'task', { title: 'Task' }));
      const json = store.toJSON();
      const restored = Store.fromJSON(json, bus);
      assert.strictEqual(restored.getAllCards().length, 2);
      assert.strictEqual(restored.getCard('card_1').props.title, 'Hello');
      assert.strictEqual(restored.getCard('card_2').type, 'task');
    });
  });
});
