/**
 * Utility functions used across the CardFrame framework.
 * Stateless — safe to import anywhere without instantiation.
 * @module utils/Utils
 */

export const Utils = {
  generateId(prefix = 'card') {
    const timestamp = Date.now().toString(36);
    const hash = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${hash}`;
  },

  escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    let result = div.innerHTML;
    result = result.replace(/\//g, '&#x2F;');
    result = result.replace(/`/g, '&#x60;');
    result = result.replace(/=/g, '&#x3D;');
    return result;
  },

  escapeAttr(str) {
    if (str == null) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\//g, '&#x2F;')
            .replace(/`/g, '&#x60;')
            .replace(/=/g, '&#x3D;')
            .replace(/\n/g, '&#10;')
            .replace(/\r/g, '&#13;')
            .replace(/\t/g, '&#9;');
  },

  // Security proxies — delegate to Security module (imported lazily to avoid circular deps)
  sanitizeHtml(html, options) {
    // Lazy import via global to avoid circular dependency at module load time
    // The Security module imports Utils, so we can't import Security at top level here.
    // This will be resolved in Phase 4 when we refactor the dependency chain.
    if (typeof globalThis.__CardFrameSecurity !== 'undefined') {
      return globalThis.__CardFrameSecurity.sanitizeHtml(html, options);
    }
    return String(html);
  },

  sanitizeUrl(url) {
    if (typeof globalThis.__CardFrameSecurity !== 'undefined') {
      return globalThis.__CardFrameSecurity.sanitizeUrl(url);
    }
    return String(url);
  },

  sanitizeStyle(styleStr) {
    if (typeof globalThis.__CardFrameSecurity !== 'undefined') {
      return globalThis.__CardFrameSecurity.sanitizeStyle(styleStr);
    }
    return String(styleStr);
  },

  isSafeUrl(url) {
    if (typeof globalThis.__CardFrameSecurity !== 'undefined') {
      return globalThis.__CardFrameSecurity.isSafeUrl(url);
    }
    return true;
  },

  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  },

  deepClone(obj, _seen) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
    if (obj instanceof Map) {
      const m = new Map();
      obj.forEach((v, k) => m.set(this.deepClone(k, _seen), this.deepClone(v, _seen)));
      return m;
    }
    if (obj instanceof Set) {
      const s = new Set();
      obj.forEach(v => s.add(this.deepClone(v, _seen)));
      return s;
    }
    if (typeof WeakSet !== 'undefined') {
      if (!_seen) _seen = new WeakSet();
      if (_seen.has(obj)) return undefined;
      _seen.add(obj);
    }
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item, _seen));
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key], _seen);
      }
    }
    return cloned;
  },

  validateType(value, type) {
    if (value === undefined || value === null || value === '') return true;
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return !isNaN(Number(value));
      case 'boolean': return ['true', 'false', true, false].includes(value);
      case 'array': return Array.isArray(value) || typeof value === 'string';
      case 'object': return typeof value === 'object';
      case 'date': return !isNaN(new Date(value).getTime());
      default: return true;
    }
  },

  parseValue(value, type) {
    if (value === undefined || value === null) return value;
    switch (type) {
      case 'number': return Number(value);
      case 'boolean': return value === 'true' || value === true;
      case 'array':
        if (Array.isArray(value)) return value;
        try { return JSON.parse(value); } catch { return String(value).split(',').map(s => s.trim()); }
      case 'object':
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch { return {}; }
      default: return String(value);
    }
  }
};
