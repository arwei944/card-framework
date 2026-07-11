/**
 * ShadowCardElement — Shadow DOM isolated card custom element.
 * @module web-components/ShadowCardElement
 */

import { Utils } from '../utils/Utils.js';

/**
 * Defines the cf-shadow-card custom element.
 * @param {object} registry - ShadowCardRegistry instance
 * @returns {class|null} The ShadowCardElement class, or null if customElements unavailable
 */
export function defineShadowCardElement(registry) {
  if (typeof customElements === 'undefined') return null;
  if (customElements.get('cf-shadow-card')) return customElements.get('cf-shadow-card');

  const _HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

  class ShadowCardElement extends _HTMLElement {
    static get observedAttributes() {
      return ['type', 'data-card-id', 'data-props'];
    }

    constructor() {
      super();
      this._props = {};
      this._initialized = false;
      this._listeners = new Map();
      this._attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this._initialize();
    }

    disconnectedCallback() {
      this._cleanup();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'data-props' && newValue) {
        try {
          this._props = JSON.parse(newValue);
        } catch (e) {
          this._props = {};
        }
      }
      if (this._initialized) {
        this._render();
      }
    }

    _initialize() {
      if (this._initialized) return;
      this._initialized = true;
      this._render();
    }

    _render() {
      const type = this.getAttribute('type') || 'text';
      const style = registry.getStyle(type);
      const template = registry.getTemplate(type);

      let html = template;
      Object.keys(this._props).forEach(key => {
        const re = new RegExp('\\$\\{' + key + '\\}', 'g');
        const value = String(this._props[key] ?? '');
        html = html.replace(re, Utils.escapeHtml(value));
      });
      html = html.replace(/\$\{[^}]+\}/g, '');

      this.shadowRoot.innerHTML = `
        <style>${style}</style>
        <div class="cf-shadow-wrapper" data-type="${Utils.escapeAttr(type)}">
          ${html}
          <slot name="footer"></slot>
          <slot></slot>
        </div>
      `;
    }

    setProps(props) {
      this._props = Object.assign({}, this._props, props || {});
      this.setAttribute('data-props', JSON.stringify(this._props));
    }

    getProps() {
      return Object.assign({}, this._props);
    }

    emit(name, detail) {
      const event = new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }

    on(name, handler) {
      const wrapped = (e) => handler(e.detail, e);
      this.addEventListener(name, wrapped);
      this._listeners.set(handler, { name, wrapped });
      return () => this.off(name, handler);
    }

    off(name, handler) {
      const entry = this._listeners.get(handler);
      if (entry) {
        this.removeEventListener(entry.name, entry.wrapped);
        this._listeners.delete(handler);
      }
    }

    _cleanup() {
      this._listeners.forEach((entry, handler) => {
        this.removeEventListener(entry.name, entry.wrapped);
      });
      this._listeners.clear();
    }
  }

  customElements.define('cf-shadow-card', ShadowCardElement);
  return ShadowCardElement;
}
