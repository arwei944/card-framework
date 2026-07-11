/**
 * Test Setup — jsdom environment for Mocha tests
 *
 * Provides real DOM APIs (document, window, HTMLElement, customElements,
 * MutationObserver, requestAnimationFrame) for testing CardFrame.
 *
 * Constraint 7.1: Tests must use jsdom real DOM, not mock DOM.
 */

const { JSDOM } = require('jsdom');

// Create a jsdom instance with a reasonable HTML document
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="test-root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

// Expose DOM globals
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.customElements = dom.window.customElements;
global.MutationObserver = dom.window.MutationObserver;
global.getComputedStyle = dom.window.getComputedStyle;
global.DOMParser = dom.window.DOMParser;
global.ShadowRoot = dom.window.ShadowRoot;

// requestAnimationFrame / cancelAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
dom.window.requestAnimationFrame = global.requestAnimationFrame;
dom.window.cancelAnimationFrame = global.cancelAnimationFrame;

// Ensure window has addEventListener/removeEventListener
if (!dom.window.addEventListener) {
  dom.window.addEventListener = () => {};
  dom.window.removeEventListener = () => {};
}
