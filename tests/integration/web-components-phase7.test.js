/**
 * Phase 7 regression tests — Web Components hardening + CircuitBreaker.
 *   T7.01  <cf-card> race: initialized once the parent <card-frame> connects
 *   T7.02  _getFrame pierces Shadow DOM boundaries
 *   T7.03  cf-card built with the browser's zero-arg constructor works
 *   T7.04  attributeChangedCallback never wedges / never throws out
 *   T7.05  attribute updates route through the Store API (no direct mutation)
 *   T7.06  forceFullRender detaches tracked listeners before clearing
 *   T7.07  CircuitBreaker allows only a single half-open probe
 */

const { assert, getModule, createFrame, cleanupFrame, waitFor } = require('../helpers');

function testRoot() {
  return document.getElementById('test-root');
}

describe('Phase 7 — Web Components & CircuitBreaker', function() {
  describe('T7.01 cf-card / card-frame connection race', function() {
    let host;
    afterEach(function() { if (host && host.parentNode) host.parentNode.removeChild(host); host = null; });

    it('a declared cf-card is added to the store when the frame connects', function() {
      host = document.createElement('div');
      host.innerHTML = '<card-frame><cf-card type="text" title="Hello"></cf-card></card-frame>';
      testRoot().appendChild(host);

      const frameEl = host.querySelector('card-frame');
      assert.ok(frameEl.__cardFrame, 'frame context should be attached');
      const cards = frameEl.__cardFrame.store.getAllCards();
      assert.strictEqual(cards.length, 1);
      assert.strictEqual(cards[0].props.title, 'Hello');

      const cardEl = host.querySelector('cf-card');
      assert.ok(cardEl.dataset.cardId, 'card element should be tagged with an id');
    });

    it('does not double-add when both parent and child init paths run', function() {
      host = document.createElement('div');
      host.innerHTML = '<card-frame><cf-card type="text" title="A"></cf-card></card-frame>';
      testRoot().appendChild(host);
      const frameEl = host.querySelector('card-frame');
      assert.strictEqual(frameEl.__cardFrame.store.getAllCards().length, 1);
    });
  });

  describe('T7.02 Shadow DOM piercing', function() {
    let frameEl;
    afterEach(function() { if (frameEl && frameEl.parentNode) frameEl.parentNode.removeChild(frameEl); frameEl = null; });

    it('cf-card inside a shadow root still finds the enclosing frame', function() {
      frameEl = document.createElement('card-frame');
      testRoot().appendChild(frameEl);
      assert.ok(frameEl.__cardFrame);

      const hostDiv = document.createElement('div');
      frameEl.appendChild(hostDiv);
      const shadow = hostDiv.attachShadow({ mode: 'open' });

      const cardEl = document.createElement('cf-card');
      cardEl.setAttribute('type', 'text');
      cardEl.setAttribute('title', 'Shadowed');
      shadow.appendChild(cardEl);

      assert.ok(cardEl.dataset.cardId, 'card in shadow root should initialize');
      const card = frameEl.__cardFrame.store.getCard(cardEl.dataset.cardId);
      assert.ok(card);
      assert.strictEqual(card.props.title, 'Shadowed');
    });
  });

  describe('T7.03 zero-arg constructor', function() {
    it('new (customElements.get("cf-card"))() does not throw', function() {
      const Ctor = customElements.get('cf-card');
      assert.ok(Ctor);
      let el;
      assert.doesNotThrow(() => { el = new Ctor(); });
      assert.strictEqual(el._eventBus, null);
    });
  });

  describe('T7.04 / T7.05 attribute updates', function() {
    let frameEl;
    afterEach(function() { if (frameEl && frameEl.parentNode) frameEl.parentNode.removeChild(frameEl); frameEl = null; });

    function setup() {
      frameEl = document.createElement('card-frame');
      testRoot().appendChild(frameEl);
      const cardEl = document.createElement('cf-card');
      cardEl.setAttribute('type', 'text');
      cardEl.setAttribute('title', 'Original');
      frameEl.appendChild(cardEl);
      return cardEl;
    }

    it('T7.05 changing an attribute updates the store via the API', function() {
      const cardEl = setup();
      const id = cardEl.dataset.cardId;
      cardEl.setAttribute('title', 'Updated');
      assert.strictEqual(frameEl.__cardFrame.store.getCard(id).props.title, 'Updated');
    });

    it('T7.05 store card is not mutated by reference across reads', function() {
      const cardEl = setup();
      const id = cardEl.dataset.cardId;
      const first = frameEl.__cardFrame.store.getCard(id);
      first.props.title = 'LeakAttempt';
      assert.strictEqual(frameEl.__cardFrame.store.getCard(id).props.title, 'Original');
    });

    it('T7.04 a throwing render does not wedge _isUpdating or bubble out', function() {
      const cardEl = setup();
      cardEl.render = function() { throw new Error('render boom'); };
      assert.doesNotThrow(() => { cardEl.setAttribute('title', 'X'); });
      assert.strictEqual(cardEl._isUpdating, false);
    });
  });

  describe('T7.06 forceFullRender listener cleanup', function() {
    let frame, container;
    afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

    it('detaches tracked listeners before clearing the container', async function() {
      ({ frame, container } = createFrame());
      frame.createCard('text', { title: 'a' });
      frame.createCard('text', { title: 'b' });
      const r = frame.renderer;
      r.renderCards(frame.store.getAllCards());
      await waitFor(() => r._eventListeners.size > 0, 1000);
      let cleaned = 0;
      const orig = r.cleanupCardElement.bind(r);
      r.cleanupCardElement = function(id) { cleaned++; return orig(id); };
      r.forceFullRender(frame.store.getAllCards());
      assert.ok(cleaned >= 1, 'cleanupCardElement should run for existing cards');
    });
  });

  describe('T7.07 CircuitBreaker half-open single probe', function() {
    let CircuitBreaker;
    before(function() { CircuitBreaker = getModule().CircuitBreaker; });

    it('global: only the first caller probes while half-open', function() {
      const cb = new CircuitBreaker({ globalFailureThreshold: 2, resetTimeoutMs: -1 });
      cb.recordFailure();
      cb.recordFailure();
      assert.strictEqual(cb.isSafeMode(), true);
      assert.strictEqual(cb.canExecute(), true, 'first probe allowed');
      assert.strictEqual(cb.canExecute(), false, 'concurrent probe blocked');
    });

    it('global: a failed probe re-opens the breaker', function() {
      const cb = new CircuitBreaker({ globalFailureThreshold: 2, resetTimeoutMs: -1 });
      cb.recordFailure();
      cb.recordFailure();
      assert.strictEqual(cb.canExecute(), true);
      cb.recordFailure();
      assert.strictEqual(cb.getGlobalState(), 'open');
      assert.strictEqual(cb.isSafeMode(), true);
    });

    it('global: a successful probe fully closes the breaker', function() {
      const cb = new CircuitBreaker({ globalFailureThreshold: 2, resetTimeoutMs: -1 });
      cb.recordFailure();
      cb.recordFailure();
      assert.strictEqual(cb.canExecute(), true);
      cb.recordSuccess();
      assert.strictEqual(cb.getGlobalState(), 'closed');
      assert.strictEqual(cb.canExecute(), true);
    });

    it('card: only one half-open probe per card', function() {
      const cb = new CircuitBreaker({ cardFailureThreshold: 2, globalFailureThreshold: 999, resetTimeoutMs: -1 });
      cb.recordFailure('c1');
      cb.recordFailure('c1');
      assert.strictEqual(cb.getCardState('c1'), 'open');
      assert.strictEqual(cb.canExecute('c1'), true, 'first card probe allowed');
      assert.strictEqual(cb.canExecute('c1'), false, 'concurrent card probe blocked');
      cb.recordSuccess('c1');
      assert.strictEqual(cb.getCardState('c1'), 'closed');
      assert.strictEqual(cb.canExecute('c1'), true);
    });
  });
});
