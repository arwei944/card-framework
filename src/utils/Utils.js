/**
 * Utility functions used across the CardFrame framework.
 * Stateless — safe to import anywhere without instantiation.
 * @module utils/Utils
 */

import * as escape from './escape.js';
import { Security } from '../security/Security.js';

export const Utils = {
  generateId(prefix = 'card') {
    const timestamp = Date.now().toString(36);
    const hash = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${hash}`;
  },

  escapeHtml: escape.escapeHtml,

  escapeAttr: escape.escapeAttr,

  // Security proxies — delegate to the canonical Security implementation.
  // No circular dependency: Security depends only on escape primitives, not Utils.
  sanitizeHtml(html, options) {
    return Security.sanitizeHtml(html, options);
  },

  sanitizeUrl(url) {
    return Security.sanitizeUrl(url);
  },

  sanitizeStyle(styleStr) {
    return Security.sanitizeStyle(styleStr);
  },

  isSafeUrl(url) {
    return Security.isSafeUrl(url);
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
