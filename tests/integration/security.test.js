/**
 * Security module tests — verify XSS/URL sanitization behavior.
 * Uses the built CJS bundle via helpers (real Security class, jsdom DOM).
 */

const { assert, getModule } = require('../helpers');

describe('Security', function() {
  let Security;
  before(function() {
    Security = getModule().Security;
  });

  describe('sanitizeHtml', function() {
    it('should strip <script> tags', function() {
      const out = Security.sanitizeHtml('<script>alert(1)</script>');
      assert.strictEqual(out.indexOf('<script'), -1);
    });

    it('should remove inline event handlers (onerror)', function() {
      const out = Security.sanitizeHtml('<img src="x" onerror="alert(1)">');
      assert.strictEqual(out.toLowerCase().indexOf('onerror'), -1);
    });

    it('should keep safe tags', function() {
      const out = Security.sanitizeHtml('<div>hello</div>');
      assert.strictEqual(out.indexOf('<div>hello</div>'), 0);
    });
  });

  describe('sanitizeUrl / isSafeUrl', function() {
    it('should return empty string for null', function() {
      assert.strictEqual(Security.sanitizeUrl(null), '');
    });

    it('should return empty string for empty string', function() {
      assert.strictEqual(Security.sanitizeUrl(''), '');
    });

    it('should reject javascript: protocol', function() {
      assert.strictEqual(Security.sanitizeUrl('javascript:alert(1)'), '');
      assert.strictEqual(Security.isSafeUrl('javascript:alert(1)'), false);
    });

    it('should accept https URLs', function() {
      assert.strictEqual(Security.sanitizeUrl('https://example.com'), 'https://example.com');
      assert.strictEqual(Security.isSafeUrl('https://example.com'), true);
    });

    it('should accept relative paths', function() {
      assert.strictEqual(Security.isSafeUrl('/path'), true);
      assert.strictEqual(Security.isSafeUrl('./rel'), true);
    });
  });

  describe('sanitizeStyle', function() {
    it('should remove expression()', function() {
      const out = Security.sanitizeStyle('color: red; expression(alert(1))');
      assert.strictEqual(out.toLowerCase().indexOf('expression'), -1);
    });

    it('should remove javascript: in url()', function() {
      const out = Security.sanitizeStyle('background: url(javascript:alert(1))');
      assert.strictEqual(out.toLowerCase().indexOf('javascript:'), -1);
    });
  });

  describe('escapeAttr', function() {
    it('should escape special characters', function() {
      const out = Security.escapeAttr('<b>"x"&\'');
      assert.strictEqual(out.indexOf('<'), -1);
    });
  });
});
