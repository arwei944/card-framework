/**
 * Monitor integration tests — batching + injectable transport.
 */

const { assert } = require('../helpers');

describe('Monitor', function() {
  let calls;
  const fetchImpl = function (url, init) {
    calls.push({ url, init });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };

  beforeEach(function() { calls = []; });
  afterEach(function() { try { require('../../dist/card-framework.cjs.js').Monitor.destroy(); } catch (e) {} });

  it('should POST a batched report to the endpoint on flush', function() {
    const mod = require('../../dist/card-framework.cjs.js');
    mod.Monitor.init({ endpoint: '/api/errors', fetchImpl, flushMs: 100000 });
    mod.Monitor.report(new Error('boom'));
    mod.Monitor.flush();
    const post = calls.find((c) => c.init && c.init.method === 'POST');
    assert.ok(post, 'expected a POST');
    assert.strictEqual(post.url, '/api/errors');
    const body = JSON.parse(post.init.body);
    assert.strictEqual(body.events.length, 1);
    assert.strictEqual(body.events[0].message, 'boom');
    assert.strictEqual(body.events[0].type, 'report');
  });

  it('should flush automatically when batch size reached', function() {
    const mod = require('../../dist/card-framework.cjs.js');
    mod.Monitor.init({ endpoint: '/api/errors', fetchImpl, batchSize: 2, flushMs: 100000 });
    mod.Monitor.report(new Error('a'));
    mod.Monitor.report(new Error('b'));
    const post = calls.find((c) => c.init && c.init.method === 'POST');
    assert.ok(post, 'expected auto-flush at batchSize');
    assert.strictEqual(JSON.parse(post.init.body).events.length, 2);
  });

  it('should attach Bearer token when configured', function() {
    const mod = require('../../dist/card-framework.cjs.js');
    mod.Monitor.init({ endpoint: '/api/errors', fetchImpl, token: 'sec', flushMs: 100000 });
    mod.Monitor.report(new Error('x'));
    mod.Monitor.flush();
    const post = calls.find((c) => c.init && c.init.method === 'POST');
    assert.strictEqual(post.init.headers['Authorization'], 'Bearer sec');
  });
});
