/**
 * PluginManager integration tests — install / uninstall / enable / disable.
 */

const { assert, createFrame, cleanupFrame } = require('../helpers');

describe('PluginManager', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  function installed(name) {
    return frame.pluginManager.getAll().some(p => p.name === name);
  }

  it('should install a plugin and register it', function() {
    ({ frame, container } = createFrame());
    frame.pluginManager.install({ name: 'test-plugin', version: '1.0.0', onInstall: function() {} });
    assert.strictEqual(installed('test-plugin'), true);
    assert.strictEqual(typeof frame.pluginManager.get('test-plugin'), 'object');
  });

  it('should throw when installing a plugin without a name', function() {
    ({ frame, container } = createFrame());
    assert.throws(function() {
      frame.pluginManager.install({});
    });
  });

  it('should uninstall a plugin', function() {
    ({ frame, container } = createFrame());
    const pm = frame.pluginManager;
    pm.install({ name: 'temp-plugin', version: '1.0.0', onInstall: function() {} });
    pm.uninstall('temp-plugin');
    assert.strictEqual(pm.get('temp-plugin'), null);
    assert.strictEqual(installed('temp-plugin'), false);
  });

  it('should enable and disable a plugin', function() {
    ({ frame, container } = createFrame());
    const pm = frame.pluginManager;
    pm.install({ name: 'toggle-plugin', version: '1.0.0', onInstall: function() {} });
    pm.enable('toggle-plugin');
    assert.strictEqual(pm.getAll().find(p => p.name === 'toggle-plugin').enabled, true);
    pm.disable('toggle-plugin');
    assert.strictEqual(pm.getAll().find(p => p.name === 'toggle-plugin').enabled, false);
  });
});
