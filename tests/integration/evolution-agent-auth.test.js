/**
 * Evolution Agent auth — write routes require configured token.
 * Tests the shipped auth helper used by evolution-agent/src/index.js.
 */

const path = require('path');
const assert = require('assert');

const authPath = path.join(__dirname, '..', '..', 'evolution-agent', 'src', 'auth.js');
const { isAuthorized } = require(authPath);

describe('Evolution Agent isAuthorized (shipped)', function () {
  it('rejects when token is not configured', function () {
    assert.strictEqual(isAuthorized({ headers: {} }, ''), false);
    assert.strictEqual(isAuthorized({ headers: {} }, null), false);
    assert.strictEqual(isAuthorized({ headers: { authorization: 'Bearer x' } }, ''), false);
  });

  it('rejects wrong Bearer token', function () {
    assert.strictEqual(
      isAuthorized({ headers: { authorization: 'Bearer wrong' } }, 'secret'),
      false
    );
  });

  it('accepts matching Bearer token', function () {
    assert.strictEqual(
      isAuthorized({ headers: { authorization: 'Bearer secret' } }, 'secret'),
      true
    );
  });

  it('allowInsecure only when explicitly enabled and token empty', function () {
    assert.strictEqual(isAuthorized({ headers: {} }, '', { allowInsecure: true }), true);
    assert.strictEqual(isAuthorized({ headers: {} }, 'secret', { allowInsecure: true }), false);
  });
});
