/**
 * EventBus Unit Tests
 *
 * Tests: on/emit, off, once, removeAllByContext, error handling,
 * listenerCount, clear
 */

const { assert, getModule } = require('../helpers');

describe('EventBus', function() {
  let EventBus;
  let bus;

  before(function() {
    EventBus = getModule().EventBus;
  });

  beforeEach(function() {
    bus = new EventBus();
  });

  afterEach(function() {
    bus.clear();
  });

  describe('on() / emit()', function() {
    it('should call listener when event is emitted', function() {
      let received = null;
      bus.on('test', (event) => { received = event; });
      bus.emit('test', { value: 42 });
      assert.strictEqual(received.detail.value, 42);
    });

    it('should call multiple listeners in order', function() {
      const order = [];
      bus.on('test', () => order.push(1));
      bus.on('test', () => order.push(2));
      bus.on('test', () => order.push(3));
      bus.emit('test', {});
      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('should handle events with no listeners gracefully', function() {
      assert.doesNotThrow(() => bus.emit('nonexistent', {}));
    });

    it('should pass event object with type and detail', function() {
      let received = null;
      bus.on('myEvent', (e) => { received = e; });
      bus.emit('myEvent', { foo: 'bar' });
      assert.strictEqual(received.type, 'myEvent');
      assert.strictEqual(received.detail.foo, 'bar');
    });
  });

  describe('off()', function() {
    it('should remove a specific listener', function() {
      let called = false;
      const listener = () => { called = true; };
      bus.on('test', listener);
      bus.off('test', listener);
      bus.emit('test', {});
      assert.strictEqual(called, false);
    });

    it('should not affect other listeners', function() {
      let count = 0;
      const l1 = () => count++;
      const l2 = () => count++;
      bus.on('test', l1);
      bus.on('test', l2);
      bus.off('test', l1);
      bus.emit('test', {});
      assert.strictEqual(count, 1);
    });

    it('should handle removing non-existent listener gracefully', function() {
      assert.doesNotThrow(() => bus.off('nonexistent', () => {}));
    });
  });

  describe('once()', function() {
    it('should call listener only once', function() {
      let count = 0;
      bus.once('test', () => count++);
      bus.emit('test', {});
      bus.emit('test', {});
      bus.emit('test', {});
      assert.strictEqual(count, 1);
    });

    it('should allow off() to cancel a once listener before it fires', function() {
      let called = false;
      const listener = () => { called = true; };
      bus.once('test', listener);
      bus.off('test', listener);
      bus.emit('test', {});
      assert.strictEqual(called, false);
    });
  });

  describe('removeAllByContext()', function() {
    it('should remove all listeners with a given context', function() {
      const ctx = { id: 'myContext' };
      let called = 0;
      bus.on('event1', () => called++, ctx);
      bus.on('event2', () => called++, ctx);
      bus.on('event3', () => called++, {}); // different context
      bus.removeAllByContext(ctx);
      bus.emit('event1', {});
      bus.emit('event2', {});
      bus.emit('event3', {});
      assert.strictEqual(called, 1); // only the non-ctx listener
    });
  });

  describe('listenerCount()', function() {
    it('should return the number of listeners for an event', function() {
      bus.on('test', () => {});
      bus.on('test', () => {});
      bus.once('test', () => {});
      assert.strictEqual(bus.listenerCount('test'), 3);
    });

    it('should return 0 for events with no listeners', function() {
      assert.strictEqual(bus.listenerCount('nonexistent'), 0);
    });
  });

  describe('clear()', function() {
    it('should remove all listeners for all events', function() {
      let called = 0;
      bus.on('event1', () => called++);
      bus.on('event2', () => called++);
      bus.clear();
      bus.emit('event1', {});
      bus.emit('event2', {});
      assert.strictEqual(called, 0);
    });
  });

  describe('error handling', function() {
    it('should catch listener errors and emit frameworkError', function() {
      let errorCaught = null;
      bus.on('frameworkError', (e) => { errorCaught = e; });
      bus.on('test', () => { throw new Error('listener error'); });
      bus.emit('test', {});
      assert.ok(errorCaught);
      assert.ok(errorCaught.detail.error);
    });

    it('should continue calling other listeners after one throws', function() {
      let called = false;
      bus.on('test', () => { throw new Error('fail'); });
      bus.on('test', () => { called = true; });
      bus.emit('test', {});
      assert.strictEqual(called, true);
    });
  });
});
