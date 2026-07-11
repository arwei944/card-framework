/**
 * PluginSandbox — per-plugin isolation: resource tracking, restricted API context.
 * @module plugins/PluginSandbox
 */

import { Utils } from '../utils/Utils.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';

export class PluginSandbox {
  constructor(pluginName, frame, permissions = [], rateLimiter = null) {
    this.pluginName = pluginName;
    this.frame = frame;
    this.permissions = new Set(permissions || []);
    this._rateLimiter = rateLimiter;
    this._timers = new Set();
    this._intervals = new Set();
    this._domListeners = [];
    this._busListeners = [];
    this._registeredTypes = new Set();
    this._registeredThemes = new Set();
    this._destroyed = false;
  }

  can(permission) {
    return this.permissions.has(permission) || this.permissions.has('*');
  }

  _checkRate() {
    if (!this._rateLimiter) return true;
    return this._rateLimiter(this.pluginName);
  }

  trackType(typeName) {
    this._registeredTypes.add(typeName);
  }

  trackTheme(themeName) {
    this._registeredThemes.add(themeName);
  }

  createContext() {
    const self = this;
    const frame = this.frame;

    return {
      pluginName: this.pluginName,

      setTimeout: (fn, delay, ...args) => {
        const id = setTimeout(() => {
          self._timers.delete(id);
          fn(...args);
        }, delay);
        self._timers.add(id);
        return id;
      },
      clearTimeout: (id) => {
        clearTimeout(id);
        self._timers.delete(id);
      },
      setInterval: (fn, delay, ...args) => {
        const id = setInterval(fn, delay, ...args);
        self._intervals.add(id);
        return id;
      },
      clearInterval: (id) => {
        clearInterval(id);
        self._intervals.delete(id);
      },

      addEventListener: (target, event, handler, options) => {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(event, handler, options);
        self._domListeners.push({ target, event, handler, options });
      },

      store: this.can('store:read') ? {
        getCard: (id) => frame.store.getCard(id),
        getAllCards: () => frame.store.getAllCards(),
        getCardsByType: (type) => frame.store.getCardsByType(type),
        getRelationship: (id) => frame.store.getRelationship(id),
        getAllRelationships: () => frame.store.getAllRelationships()
      } : null,

      storeWrite: this.can('store:write') ? {
        addCard: (card) => {
          if (!self._checkRate()) {
            FeedbackSystem.warn('plugin_rate_limit', `插件 "${self.pluginName}" 操作频率超限`);
            return null;
          }
          return frame.store.addCard(card);
        },
        updateCard: (card) => {
          if (!self._checkRate()) return null;
          return frame.store.updateCard(card);
        },
        removeCard: (id) => {
          if (!self._checkRate()) return null;
          return frame.store.removeCard(id);
        }
      } : null,

      eventBus: this.can('events:subscribe') ? {
        on: (event, handler) => {
          frame.eventBus.on(event, handler);
          self._busListeners.push({ event, handler });
        },
        off: (event, handler) => {
          frame.eventBus.off(event, handler);
        },
        emit: this.can('events:emit')
          ? (event, detail) => frame.eventBus.emit(event, detail)
          : undefined
      } : null,

      typeRegistry: this.can('types:register') ? {
        register: (def) => {
          const ok = frame.typeRegistry.register(def);
          if (ok && def && def.type) self.trackType(def.type);
          return ok;
        },
        get: (name) => frame.typeRegistry.get(name)
      } : null,

      theme: this.can('theme:read') ? {
        getCurrentTheme: () => frame.themeManager.getCurrentTheme(),
        registerTheme: this.can('theme:write')
          ? (def) => {
              const ok = frame.themeManager.registerTheme(def);
              if (def && def.name) self.trackTheme(def.name);
              return ok;
            }
          : undefined
      } : null,

      i18n: this.can('i18n:read') ? {
        t: (key, params) => frame.i18n.t(key, params),
        getLocale: () => frame.i18n.getLocale()
      } : null,

      feedback: {
        info: (type, msg, opts) => FeedbackSystem.info(type, msg, opts),
        warn: (type, msg, opts) => FeedbackSystem.warn(type, msg, opts),
        error: (type, msg, opts) => FeedbackSystem.error(type, msg, opts)
      },

      utils: this.can('utils:read') ? {
        generateId: (p) => Utils.generateId(p),
        escapeHtml: (s) => Utils.escapeHtml(s),
        deepClone: (o) => Utils.deepClone(o)
      } : null
    };
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this._timers.forEach(id => clearTimeout(id));
    this._timers.clear();

    this._intervals.forEach(id => clearInterval(id));
    this._intervals.clear();

    this._domListeners.forEach(({ target, event, handler, options }) => {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(event, handler, options);
      }
    });
    this._domListeners = [];

    this._busListeners.forEach(({ event, handler }) => {
      this.frame.eventBus.off(event, handler);
    });
    this._busListeners = [];

    this._registeredTypes.forEach(typeName => {
      this.frame.typeRegistry.unregister(typeName);
    });
    this._registeredTypes.clear();

    this._registeredThemes.forEach(themeName => {
      if (this.frame.themeManager && typeof this.frame.themeManager.removeTheme === 'function') {
        this.frame.themeManager.removeTheme(themeName);
      }
    });
    this._registeredThemes.clear();
  }
}
