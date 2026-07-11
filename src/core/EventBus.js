/**
 * EventBus — pub/sub event system with context-based cleanup.
 * @module core/EventBus
 */

import { EVENT_TYPES } from '../utils/constants.js';

export class EventBus {
  constructor() {
    this.events = new Map();
    this._onceHandlers = new Map();
  }

  on(eventName, listener, context) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }
    if (context) {
      listener._context = context;
    }
    this.events.get(eventName).add(listener);
  }

  off(eventName, listener) {
    const listeners = this.events.get(eventName);
    if (listeners) {
      listeners.delete(listener);
    }
    // Check if this is a once() listener — if so, also remove the wrapper
    const onceHandlers = this._onceHandlers.get(eventName);
    if (onceHandlers) {
      const wrapper = onceHandlers.get(listener);
      if (wrapper) {
        if (listeners) {
          listeners.delete(wrapper);
        }
        onceHandlers.delete(listener);
      }
    }
  }

  once(eventName, listener) {
    const onceListener = (event) => {
      this.off(eventName, onceListener);
      listener(event);
    };
    // Track the mapping so off() can find the wrapper
    if (!this._onceHandlers.has(eventName)) {
      this._onceHandlers.set(eventName, new Map());
    }
    this._onceHandlers.get(eventName).set(listener, onceListener);
    this.on(eventName, onceListener);
  }

  removeAllByContext(context) {
    if (!context) return;
    for (const [eventName, listeners] of this.events) {
      const toRemove = [];
      listeners.forEach(listener => {
        if (listener._context === context) {
          toRemove.push(listener);
        }
      });
      toRemove.forEach(listener => {
        listeners.delete(listener);
      });
      if (listeners.size === 0) {
        this.events.delete(eventName);
      }
    }
    // Also clean up once handler tracking
    for (const [eventName, handlerMap] of this._onceHandlers) {
      const toRemoveOnce = [];
      handlerMap.forEach((wrapper, original) => {
        if (wrapper._context === context) {
          toRemoveOnce.push(original);
        }
      });
      toRemoveOnce.forEach(original => handlerMap.delete(original));
      if (handlerMap.size === 0) {
        this._onceHandlers.delete(eventName);
      }
    }
  }

  emit(eventName, detail) {
    const listeners = this.events.get(eventName);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener({ type: eventName, detail });
        } catch (e) {
          console.error('[CardFrame] 事件监听器错误:', e);
          if (eventName !== EVENT_TYPES.FRAMEWORK_ERROR) {
            this.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
              type: 'listener_error',
              message: e.message,
              error: e,
              context: { eventName, detail },
              timestamp: Date.now()
            });
          }
        }
      });
    }
  }

  listenerCount(eventName) {
    const listeners = this.events.get(eventName);
    return listeners ? listeners.size : 0;
  }

  clear() {
    this.events.clear();
    this._onceHandlers.clear();
  }
}
