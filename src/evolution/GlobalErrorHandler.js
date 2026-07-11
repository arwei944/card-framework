/**
 * GlobalErrorHandler — captures window errors and unhandled rejections.
 * @module evolution/GlobalErrorHandler
 */

import { EVENT_TYPES } from '../utils/constants.js';

export class GlobalErrorHandler {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._errorCounts = new Map();
    this._handlers = [];
    this._enabled = false;
  }

  enable() {
    if (this._enabled) return;
    this._enabled = true;

    this._onError = (message, source, lineno, colno, error) => {
      this._handleError('window_error', { message, source, lineno, colno, error });
      return false;
    };
    window.addEventListener('error', this._onError);

    this._onRejection = (event) => {
      this._handleError('unhandledrejection', {
        message: event.reason?.message || String(event.reason),
        reason: event.reason
      });
    };
    window.addEventListener('unhandledrejection', this._onRejection);
  }

  disable() {
    if (!this._enabled) return;
    this._enabled = false;
    if (this._onError) window.removeEventListener('error', this._onError);
    if (this._onRejection) window.removeEventListener('unhandledrejection', this._onRejection);
  }

  _handleError(type, data) {
    const key = `${type}:${data.message}`;
    const count = (this._errorCounts.get(key) || 0) + 1;
    this._errorCounts.set(key, count);

    if (this._eventBus) {
      this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
        type: `global_${type}`,
        message: data.message,
        error: data.error || data.reason,
        context: { source: data.source, lineno: data.lineno, colno: data.colno, count },
        timestamp: Date.now()
      });
    }
  }

  getErrorStats() {
    return Array.from(this._errorCounts.entries()).map(([key, count]) => ({
      key,
      count,
      type: key.split(':')[0]
    })).sort((a, b) => b.count - a.count);
  }

  clear() {
    this._errorCounts.clear();
  }

  isEnabled() {
    return this._enabled;
  }
}
