/**
 * TypeRegistry.register rejects unsafe templates by default.
 */

const { assert, getModule, createMockType } = require('../helpers');

describe('TypeRegistry template security', function () {
  let TypeRegistry;
  let registry;

  before(function () {
    TypeRegistry = getModule().TypeRegistry || getModule().CardFrame.TypeRegistry;
  });

  beforeEach(function () {
    registry = new TypeRegistry();
  });

  it('rejects a template with script/onerror by default', function () {
    const bad = createMockType('evil', {
      renderTemplate: '<div class="card" onerror="alert(1)"><script>evil()</script>{{title}}</div>',
    });
    const ok = registry.register(bad);
    assert.strictEqual(ok, false);
    assert.strictEqual(registry.get('evil'), undefined);
  });

  it('allows safe templates', function () {
    const good = createMockType('safe-type');
    assert.strictEqual(registry.register(good), true);
    assert.ok(registry.get('safe-type'));
  });

  it('allows unsafe templates only with explicit opt-in', function () {
    const bad = createMockType('unsafe-ok', {
      renderTemplate: '<div onclick="x()"><script>1</script>{{title}}</div>',
    });
    assert.strictEqual(registry.register(bad), false);
    assert.strictEqual(
      registry.register(bad, { allowUnsafeTemplates: true }),
      true
    );
    assert.ok(registry.get('unsafe-ok'));
  });
});
