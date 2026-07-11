/**
 * BackendSync integration tests — transports CardFrame import/export to a
 * stubbed HTTP backend. Uses an injectable fetch so it runs with zero deps.
 */

const { assert, createFrame, cleanupFrame, createMockType } = require('../helpers');

describe('BackendSync', function() {
  let frame, container, calls, fetchImpl;

  beforeEach(function() {
    ({ frame, container } = createFrame());
    frame.typeRegistry.register(createMockType('note'));
    calls = [];
    fetchImpl = function (url, init) {
      calls.push({ url, init });
      const body = init && init.body ? JSON.parse(init.body) : undefined;
      let json = {};
      if (init && init.method === 'GET') json = { version: '1.0.0', cards: [], relationships: [], layoutMode: 'free', metadata: {} };
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(json),
        text: () => Promise.resolve('')
      });
    };
  });

  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should throw without a valid CardFrame', function() {
    const mod = require('../../dist/card-framework.cjs.js');
    assert.throws(() => new mod.BackendSync({}));
  });

  it('should push full snapshot on change (full mode)', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const sync = new mod.BackendSync(frame, { fetchImpl, mode: 'full', pullOnStart: false, autoPush: false });
    sync.start();
    frame.createCard('note', { title: 'hello' });
    await sync.pushNow();
    const post = calls.find((c) => c.init && c.init.method === 'POST');
    assert.ok(post, 'expected a POST');
    assert.ok(post.url.endsWith('/sync'));
    const payload = JSON.parse(post.init.body);
    assert.strictEqual(Array.isArray(payload.cards), true);
    assert.strictEqual(payload.cards.length, 1);
    assert.strictEqual(payload.cards[0].props.title, 'hello');
    sync.destroy();
  });

  it('should push only deltas (incremental mode)', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const sync = new mod.BackendSync(frame, { fetchImpl, mode: 'incremental', pullOnStart: false, autoPush: false });
    sync.start();
    const card = frame.createCard('note', { title: 'a' });
    const id = card.id;
    await sync.pushNow();
    let p = JSON.parse(calls.filter((c) => c.init && c.init.method === 'POST').pop().init.body);
    assert.strictEqual(p.cards.added.length, 1);
    assert.strictEqual(p.cards.updated.length, 0);

    const updated = Object.assign({}, frame.getCard(id), { props: { title: 'b' } });
    frame.updateCard(updated);
    await sync.pushNow();
    p = JSON.parse(calls.filter((c) => c.init && c.init.method === 'POST').pop().init.body);
    assert.strictEqual(p.cards.added.length, 0);
    assert.strictEqual(p.cards.updated.length, 1);

    frame.removeCard(id);
    await sync.pushNow();
    p = JSON.parse(calls.filter((c) => c.init && c.init.method === 'POST').pop().init.body);
    assert.deepStrictEqual(p.cards.removed, [id]);
    sync.destroy();
  });

  it('should attach Bearer auth header', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const sync = new mod.BackendSync(frame, { fetchImpl, authToken: 'secret', pullOnStart: false, autoPush: false });
    sync.start();
    frame.createCard('note', { title: 'x' });
    await sync.pushNow();
    const post = calls.find((c) => c.init && c.init.method === 'POST');
    assert.strictEqual(post.init.headers['Authorization'], 'Bearer secret');
    sync.destroy();
  });

  it('should pull and import snapshot from backend', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const remote = {
      version: '1.0.0',
      cards: [{ id: 'r1', type: 'note', props: { title: 'from-server' }, status: 'active', position: { x: 0, y: 0 }, style: {}, createdAt: 1, updatedAt: 1 }],
      relationships: [], layoutMode: 'free', metadata: {}
    };
    const f2 = function (url, init) {
      if (init && init.method === 'GET') return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve(remote), text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    };
    const sync = new mod.BackendSync(frame, { fetchImpl: f2, pullOnStart: true, autoPush: false });
    await sync.pull();
    assert.strictEqual(frame.getCard('r1').props.title, 'from-server');
    sync.destroy();
  });

  it('should invoke onError when request fails', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const failing = function () { return Promise.reject(new Error('network down')); };
    let errored = null;
    const sync = new mod.BackendSync(frame, { fetchImpl: failing, pullOnStart: false, autoPush: false, onError: (e) => { errored = e; } });
    sync.start();
    frame.createCard('note', { title: 'x' });
    await sync.pushNow();
    assert.ok(errored, 'expected onError to fire');
    sync.destroy();
  });

  it('should trigger onConflict on ETag 409 (optimistic concurrency)', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const conflict = {
      ok: false, status: 409, headers: { get: () => 'v1' },
      text: () => Promise.resolve(JSON.stringify({ conflict: true, snapshot: { version: '1.0.0', cards: [{ id: 'srv', type: 'note', props: { title: 'server' }, status: 'active', position: { x: 0, y: 0 }, style: {} }], relationships: [], layoutMode: 'free', metadata: {} } }))
    };
    const rejecting = function () { return Promise.resolve(conflict); };
    let conflicted = null;
    const sync = new mod.BackendSync(frame, { fetchImpl: rejecting, pullOnStart: false, autoPush: false, concurrency: 'etag', onConflict: (s) => { conflicted = s; } });
    sync.start();
    frame.createCard('note', { title: 'local' });
    await sync.pushNow();
    assert.ok(conflicted, 'expected onConflict to fire on 409');
    assert.strictEqual(conflicted.cards[0].props.title, 'server');
    sync.destroy();
  });

  it('should buffer failed pushes into an offline queue and replay', async function() {
    const mod = require('../../dist/card-framework.cjs.js');
    const failing = function () { return Promise.reject(new Error('offline')); };
    const sync = new mod.BackendSync(frame, { fetchImpl: failing, pullOnStart: false, autoPush: false, concurrency: 'etag' });
    sync.start();
    frame.createCard('note', { title: 'a' });
    await sync.pushNow();
    assert.strictEqual(sync._queueIsEmpty(), false, 'change should be queued while offline');

    let sent = null;
    const ok = function (url, init) {
      if (init && init.method === 'POST') { sent = JSON.parse(init.body); return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'v2' }, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve('') }); }
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'v2' }, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    };
    sync._fetchImpl = ok;
    await sync._replay();
    assert.ok(sent, 'queued payload should be replayed');
    assert.strictEqual(sync._queueIsEmpty(), true, 'queue should be cleared after successful replay');
    assert.strictEqual(sent.cards.length, 1, 'replayed full snapshot should contain the card');
    sync.destroy();
  });
});
