/**
 * ShadowCardRegistry — registry for Shadow DOM card styles and templates.
 * @module evolution/ShadowCardRegistry
 */

export class ShadowCardRegistry {
  constructor() {
    this._styles = new Map();
    this._templates = new Map();
    this._defined = new Set();
  }

  registerStyle(type, css) {
    if (!type || typeof css !== 'string') return false;
    this._styles.set(type, css);
    return true;
  }

  registerTemplate(type, html) {
    if (!type || typeof html !== 'string') return false;
    this._templates.set(type, html);
    return true;
  }

  getStyle(type) {
    return this._styles.get(type) || '';
  }

  getTemplate(type) {
    return this._templates.get(type) || '<div class="cf-shadow-content">${title}</div>';
  }

  hasType(type) {
    return this._styles.has(type) || this._templates.has(type);
  }

  clear() {
    this._styles.clear();
    this._templates.clear();
  }
}
