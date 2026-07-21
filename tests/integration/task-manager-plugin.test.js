/**
 * Official task-manager plugin — ESM + declared permissions on shipped path.
 */

const path = require('path');
const { assert, createFrame, cleanupFrame, getModule } = require('../helpers');

describe('Official task-manager plugin (ESM)', function () {
  let frame;
  let container;
  let taskManagerPlugin;

  before(function () {
    // Load ESM plugin via dynamic import (Node)
    return import(
      pathToFileURL(path.join(__dirname, '..', '..', 'plugins', 'task-manager', 'index.js')).href
    ).then(mod => {
      taskManagerPlugin = mod.taskManagerPlugin || mod.default;
    });
  });

  beforeEach(function () {
    ({ frame, container } = createFrame({
      allowedPluginPermissions: ['store:read', 'store:write', 'types:register', 'events:on']
    }));
  });

  afterEach(function () {
    cleanupFrame(frame, container);
  });

  it('installs with declared permissions and registers task-item type', function () {
    assert.ok(taskManagerPlugin);
    assert.ok(Array.isArray(taskManagerPlugin.permissions));
    assert.ok(taskManagerPlugin.permissions.includes('store:read'));

    const ok = frame.installPlugin(taskManagerPlugin);
    assert.notStrictEqual(ok, false);

    const type = frame.typeRegistry.get('task-item');
    assert.ok(type, 'task-item type registered');

    const card = frame.createCard('task-item', {
      title: 'Ship plugin',
      priority: 'high'
    });
    assert.ok(card.id);
    assert.strictEqual(frame.getCard(card.id).props.priority, 'high');

    const plugin = frame.pluginManager.get('task-manager');
    assert.ok(plugin);
    const stats = plugin.getTaskStats();
    assert.strictEqual(stats.total, 1);
    assert.strictEqual(stats.highPriority, 1);
  });

  it('rejects install when permissions are not whitelisted', function () {
    cleanupFrame(frame, container);
    ({ frame, container } = createFrame({
      allowedPluginPermissions: ['store:read'] // missing store:write / types:register
    }));
    assert.throws(() => frame.installPlugin(taskManagerPlugin), /permission|权限|unauthorized|拒绝/i);
  });
});

function pathToFileURL(p) {
  const { pathToFileURL: toURL } = require('url');
  return toURL(p);
}
