/**
 * Test Helper — utilities for CardFrame tests
 *
 * Provides helpers for creating containers, loading the framework,
 * and cleaning up between tests.
 */

const assert = require('assert');

// Cache the loaded module
let _module = null;

/**
 * Load the CardFrame module from the CJS build (cached after first load).
 * @returns {Object} Module exports with CardFrame, Store, EventBus, etc.
 */
function getModule() {
  if (!_module) {
    _module = require('../dist/card-framework.cjs.js');
  }
  return _module;
}

/**
 * Get the CardFrame class.
 * @returns {typeof import('../src/core/CardFrame.js').CardFrame}
 */
function getCardFrame() {
  const mod = getModule();
  return mod.CardFrame || mod.default || mod;
}

/**
 * Create a fresh container div for testing.
 * @param {string} [id] - Optional element ID
 * @returns {HTMLDivElement}
 */
function createContainer(id) {
  const container = document.createElement('div');
  if (id) container.id = id;
  document.getElementById('test-root').appendChild(container);
  return container;
}

/**
 * Create a CardFrame instance with common test options.
 * @param {Object} [extraOptions] - Additional options to merge
 * @returns {Object} { frame, container }
 */
function createFrame(extraOptions = {}) {
  const CardFrame = getCardFrame();
  const container = createContainer();
  const options = {
    evolution: false,
    autoValidate: false,
    ...extraOptions,
  };
  const frame = new CardFrame(container, options);
  return { frame, container };
}

/**
 * Clean up a CardFrame instance and its container.
 * @param {Object} frame - The CardFrame instance
 * @param {HTMLElement} container - The container element
 */
function cleanupFrame(frame, container) {
  if (frame && !frame._destroyed) {
    frame.destroy();
  }
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

/**
 * Wait for a condition to be true (with timeout).
 * @param {Function} fn - Condition function, returns truthy when satisfied
 * @param {number} [timeout=1000] - Timeout in ms
 * @returns {Promise<void>}
 */
function waitFor(fn, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      try {
        if (fn()) return resolve();
      } catch (e) {
        return reject(e);
      }
      if (Date.now() - start > timeout) {
        return reject(new Error(`waitFor timed out after ${timeout}ms`));
      }
      setTimeout(check, 10);
    }
    check();
  });
}

/**
 * Create a mock card type definition for testing.
 * @param {string} name - Type name
 * @param {Object} [extra] - Extra properties
 * @returns {Object} Card type definition
 */
function createMockType(name, extra = {}) {
  return {
    type: name,
    label: name,
    icon: '📋',
    description: `Test ${name} type`,
    abstract: false,
    propsSchema: [
      { name: 'title', type: 'string', required: true, label: '标题', defaultValue: '未命名' },
    ],
    renderTemplate: '<div class="card"><h3>{{title}}</h3></div>',
    defaultStyle: {},
    ...extra,
  };
}

module.exports = {
  assert,
  getModule,
  getCardFrame,
  createContainer,
  createFrame,
  cleanupFrame,
  waitFor,
  createMockType,
};
