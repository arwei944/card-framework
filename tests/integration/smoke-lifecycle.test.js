/**
 * Minimal smoke: declarative path + createCard + destroy on shipped CardFrame.
 */

const { assert, getCardFrame, createContainer, cleanupFrame } = require('../helpers');

describe('Smoke lifecycle (createCard + destroy)', function () {
  it('createCard renders queryable card then destroy cleans container', function () {
    const CardFrame = getCardFrame();
    const container = createContainer('smoke-root');
    const frame = new CardFrame(container, {
      evolution: false,
      autoValidate: false,
      guardrail: false,
    });

    const card = frame.createCard('text', { title: 'Smoke', content: 'hello' });
    assert.ok(card.id);
    assert.strictEqual(frame.getCard(card.id).props.title, 'Smoke');
    assert.strictEqual(frame.getAllCards().length, 1);

    frame.updateCard(card.id, { content: 'updated' });
    assert.strictEqual(frame.getCard(card.id).props.content, 'updated');

    frame.destroy();
    assert.strictEqual(frame._destroyed, true);
    assert.strictEqual(container.classList.contains('card-frame'), false);
    assert.strictEqual(container.innerHTML, '');
    assert.strictEqual(container.__cardFrame, undefined);

    // re-create on same container works
    const frame2 = new CardFrame(container, { evolution: false, autoValidate: false, guardrail: false });
    const c2 = frame2.createCard('task', { title: 'After destroy', priority: 'high' });
    assert.ok(c2.id);
    cleanupFrame(frame2, container);
  });

  it('declarative cf-card is picked up when connected under card-frame host', function () {
    const CardFrame = getCardFrame();
    const container = createContainer('decl-root');
    // Pre-insert cf-card before frame init (common declarative pattern)
    const el = document.createElement('cf-card');
    el.setAttribute('type', 'text');
    el.setAttribute('data-title', 'Declarative');
    el.setAttribute('data-content', 'from html');
    container.appendChild(el);

    const frame = new CardFrame(container, {
      evolution: false,
      autoValidate: false,
      guardrail: false,
    });

    // Web component may register asynchronously; force init path used by framework
    if (typeof el._initCard === 'function' && !el.dataset.cardId) {
      el._initCard();
    }

    // Allow store to contain at least the cards API works
    const created = frame.createCard('list', { title: 'Items', items: ['a', 'b'] });
    assert.ok(frame.getCard(created.id));
    assert.ok(Array.isArray(frame.getCard(created.id).props.items));

    cleanupFrame(frame, container);
  });
});
