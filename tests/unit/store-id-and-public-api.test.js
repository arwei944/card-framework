/**
 * Store: missing id generation, public rekey/destroy, updateCardProps.
 */

const { assert, getModule } = require('../helpers');

describe('Store public APIs & id generation', function () {
  let Store;
  let store;

  before(function () {
    Store = getModule().Store;
  });

  beforeEach(function () {
    store = new Store();
  });

  afterEach(function () {
    if (store && typeof store.destroy === 'function') store.destroy();
  });

  it('addCard without id assigns a unique id', function () {
    const a = store.addCard({ type: 'text', props: { title: 'A' } });
    const b = store.addCard({ type: 'text', props: { title: 'B' } });
    assert.ok(a.id && typeof a.id === 'string');
    assert.ok(b.id && typeof b.id === 'string');
    assert.notStrictEqual(a.id, b.id);
    assert.ok(store.getCard(a.id));
    assert.ok(store.getCard(b.id));
    assert.strictEqual(store.getAllCards().length, 2);
    // no undefined key pollution
    assert.strictEqual(store.cards.has(undefined), false);
  });

  it('updateCardProps merges props by id', function () {
    const card = store.addCard({ type: 'text', props: { title: 'X', content: '1' } });
    const next = store.updateCardProps(card.id, { title: 'Y' });
    assert.strictEqual(next.props.title, 'Y');
    assert.strictEqual(next.props.content, '1');
  });

  it('rekeyCard moves card to new id via public API', function () {
    const card = store.addCard({ type: 'text', props: { title: 'R' } });
    const oldId = card.id;
    const rekeyed = store.rekeyCard(oldId, { ...card, id: 'custom_id_1' });
    assert.ok(rekeyed);
    assert.strictEqual(rekeyed.id, 'custom_id_1');
    assert.strictEqual(store.getCard(oldId), undefined);
    assert.ok(store.getCard('custom_id_1'));
  });

  it('destroy clears cards and cancels notify timer', function () {
    store.addCard({ type: 'text', props: { title: 'Z' } });
    store.notifyDebounced();
    store.destroy();
    assert.strictEqual(store.cards.size, 0);
    assert.strictEqual(store.listeners.size, 0);
    assert.strictEqual(store._notifyTimer, null);
  });
});
