/**
 * ActionLogger undo/redo for updateCard — must restore props via Store.updateCardProps.
 */

const { assert, getModule, createFrame, cleanupFrame } = require('../helpers');

describe('ActionLogger updateCard undo/redo (shipped path)', function () {
  let frame;
  let container;

  beforeEach(function () {
    ({ frame, container } = createFrame({ actionLogger: { enabled: true } }));
  });

  afterEach(function () {
    cleanupFrame(frame, container);
  });

  it('update → undo restores prior props → redo reapplies new props', function () {
    const card = frame.createCard('text', { title: 'Original', content: 'A' });
    assert.ok(card && card.id, 'createCard returns card with id');

    const updated = frame.updateCard(card.id, { title: 'Changed', content: 'B' });
    assert.ok(updated, 'incremental updateCard returns card');
    assert.strictEqual(frame.getCard(card.id).props.title, 'Changed');
    assert.strictEqual(frame.getCard(card.id).props.content, 'B');

    const undid = frame.undo();
    assert.strictEqual(undid, true, 'undo returns true');
    const afterUndo = frame.getCard(card.id);
    assert.ok(afterUndo, 'card still exists after undo of update');
    assert.strictEqual(afterUndo.props.title, 'Original');
    assert.strictEqual(afterUndo.props.content, 'A');

    const redid = frame.redo();
    assert.strictEqual(redid, true, 'redo returns true');
    const afterRedo = frame.getCard(card.id);
    assert.strictEqual(afterRedo.props.title, 'Changed');
    assert.strictEqual(afterRedo.props.content, 'B');
  });

  it('updateCard(fullCard) still records history and undoes props', function () {
    const card = frame.createCard('text', { title: 'T1', content: 'C1' });
    const full = frame.getCard(card.id);
    full.props = { ...full.props, title: 'T2', content: 'C2' };
    frame.updateCard(full);
    assert.strictEqual(frame.getCard(card.id).props.title, 'T2');
    frame.undo();
    assert.strictEqual(frame.getCard(card.id).props.title, 'T1');
  });
});
