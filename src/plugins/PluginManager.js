/**
 * PluginManager — plugin lifecycle, hooks, permissions, and sandboxing.
 * @module plugins/PluginManager
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { Utils } from '../utils/Utils.js';
import { Security } from '../security/Security.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';

export class PluginManager {
  constructor(frame) {
    this.frame = frame;
    this.plugins = new Map();
    this._hooks = new Map();
    this._permissions = new Map();
    this._callCounts = new Map();
    this._maxCallsPerMinute = 1000;
  }

  get _eventBus() {
    return this.frame.eventBus;
  }

  registerPermissions(pluginName, permissions) {
    this._permissions.set(pluginName, new Set(permissions || []));
  }

  hasPermission(pluginName, permission) {
    const perms = this._permissions.get(pluginName);
    if (!perms) return false;
    return perms.has(permission) || perms.has('*');
  }

  checkRateLimit(pluginName) {
    const now = Date.now();
    const key = `${pluginName}:${Math.floor(now / 60000)}`;
    const count = (this._callCounts.get(key) || 0) + 1;
    this._callCounts.set(key, count);
    this._callCounts.forEach((_, k) => {
      if (parseInt(k.split(':')[1]) < Math.floor(now / 60000) - 1) {
        this._callCounts.delete(k);
      }
    });
    return count <= this._maxCallsPerMinute;
  }

  getSandboxContext(pluginName) {
    const frame = this.frame;
    const can = (perm) => this.hasPermission(pluginName, perm);

    return {
      store: can('store:read') ? {
        getCard: (id) => frame.store.getCard(id),
        getAllCards: () => frame.store.getAllCards(),
        getCardsByType: (type) => frame.store.getCardsByType(type),
        getRelationship: (id) => frame.store.getRelationship(id),
        getAllRelationships: () => frame.store.getAllRelationships()
      } : null,

      storeWrite: can('store:write') ? {
        addCard: (card) => {
          if (!this.checkRateLimit(pluginName)) {
            FeedbackSystem.warn('plugin_rate_limit', `插件 "${pluginName}" 操作频率超限`);
            return null;
          }
          return frame.store.addCard(card);
        },
        updateCard: (card) => {
          if (!this.checkRateLimit(pluginName)) return null;
          return frame.store.updateCard(card);
        }
      } : null,

      eventBus: can('events:subscribe') ? {
        on: (event, handler) => frame.eventBus.on(event, handler),
        off: (event, handler) => frame.eventBus.off(event, handler)
      } : null,

      typeRegistry: can('types:register') ? {
        register: (def) => frame.typeRegistry.register(def),
        get: (name) => frame.typeRegistry.get(name)
      } : null,

      i18n: can('i18n:read') ? {
        t: (key, params) => frame.i18n.t(key, params),
        getLocale: () => frame.i18n.getLocale()
      } : null,

      theme: can('theme:read') ? {
        getCurrentTheme: () => frame.themeManager.getCurrentTheme()
      } : null,

      feedback: {
        info: (type, msg, opts) => FeedbackSystem.info(type, msg, opts),
        warn: (type, msg, opts) => FeedbackSystem.warn(type, msg, opts),
        error: (type, msg, opts) => FeedbackSystem.error(type, msg, opts)
      },

      utils: can('utils:read') ? {
        generateId: (p) => Utils.generateId(p),
        escapeHtml: (s) => Utils.escapeHtml(s),
        deepClone: (o) => Utils.deepClone(o)
      } : null
    };
  }

  registerHook(hookName, handler) {
    if (!this._hooks.has(hookName)) {
      this._hooks.set(hookName, new Set());
    }
    this._hooks.get(hookName).add(handler);
    return () => this._hooks.get(hookName).delete(handler);
  }

  triggerHook(hookName, data) {
    const hooks = this._hooks.get(hookName);
    if (!hooks) return data;

    let result = data;
    hooks.forEach(handler => {
      try {
        result = handler(result, this.frame) || result;
      } catch (e) {
        console.error(`[CardFrame] 插件钩子 "${hookName}" 执行错误:`, e);
        this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'plugin_error',
          message: `插件钩子 "${hookName}" 执行错误: ${e.message}`,
          error: e,
          context: { hookName, phase: 'triggerHook' },
          timestamp: Date.now()
        });
      }
    });
    return result;
  }

  install(pluginDef) {
    if (!pluginDef || !pluginDef.name) {
      throw new Error('插件必须定义 name 属性');
    }

    if (this.plugins.has(pluginDef.name)) {
      FeedbackSystem.warn(`插件 "${pluginDef.name}" 已安装`);
      return false;
    }

    if (pluginDef.dependencies) {
      for (const dep of pluginDef.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`插件 "${pluginDef.name}" 依赖 "${dep}"，请先安装该插件`);
        }
      }
    }

    const plugin = {
      name: pluginDef.name,
      version: pluginDef.version || '1.0.0',
      description: pluginDef.description || '',
      author: pluginDef.author || '',
      dependencies: pluginDef.dependencies || [],
      enabled: false,
      instance: null,
      _def: pluginDef
    };

    if (typeof pluginDef.install === 'function') {
      try {
        plugin.instance = pluginDef.install(this.frame) || {};
      } catch (e) {
        console.error(`[CardFrame] 插件 "${pluginDef.name}" 安装失败:`, e);
        this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'plugin_error',
          message: `插件 "${pluginDef.name}" 安装失败: ${e.message}`,
          error: e,
          context: { pluginName: pluginDef.name, phase: 'install' },
          timestamp: Date.now()
        });
        throw e;
      }
    }

    this.plugins.set(plugin.name, plugin);

    if (pluginDef.cardTypes) {
      const skipCheck = pluginDef.unsafeSkipTemplateCheck === true;
      pluginDef.cardTypes.forEach(typeDef => {
        if (!skipCheck && typeDef.renderTemplate) {
          const securityResult = Security.checkTemplateSecurity(typeDef.renderTemplate);
          if (!securityResult.safe) {
            securityResult.issues.forEach(issue => {
              FeedbackSystem.warn(
                `插件 "${pluginDef.name}" 的卡片类型 "${typeDef.type}" 模板存在安全问题`,
                issue.message,
                '如确认安全可设置 unsafeSkipTemplateCheck: true 跳过检查'
              );
            });
          }
        }
        this.frame.typeRegistry.register(typeDef);
      });
    }

    if (pluginDef.actions) {
      this._registerPluginActions(pluginDef.name, pluginDef.actions);
    }

    if (pluginDef.hooks) {
      for (const [hookName, handler] of Object.entries(pluginDef.hooks)) {
        this.registerHook(hookName, handler);
      }
    }

    if (pluginDef.autoEnable !== false) {
      this.enable(plugin.name);
    }

    this._eventBus.emit(EVENT_TYPES.PLUGIN_INSTALLED, { pluginName: plugin.name, version: plugin.version });
    FeedbackSystem.info(`插件 "${plugin.name}" 安装成功`, `版本: ${plugin.version}`);

    return true;
  }

  uninstall(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      FeedbackSystem.warn(`插件 "${pluginName}" 未安装`);
      return false;
    }

    const dependents = [];
    this.plugins.forEach((p, name) => {
      if (p.dependencies.includes(pluginName)) {
        dependents.push(name);
      }
    });
    if (dependents.length > 0) {
      throw new Error(`无法卸载插件 "${pluginName}"，以下插件依赖它: ${dependents.join(', ')}`);
    }

    if (plugin.enabled) {
      this.disable(pluginName);
    }

    if (plugin._def.uninstall && typeof plugin._def.uninstall === 'function') {
      try {
        plugin._def.uninstall(this.frame, plugin.instance);
      } catch (e) {
        console.error(`[CardFrame] 插件 "${pluginName}" 卸载钩子执行错误:`, e);
        this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'plugin_error',
          message: `插件 "${pluginName}" 卸载钩子执行错误: ${e.message}`,
          error: e,
          context: { pluginName, phase: 'uninstall' },
          timestamp: Date.now()
        });
      }
    }

    this.plugins.delete(pluginName);
    this._eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, { pluginName });
    FeedbackSystem.info(`插件 "${pluginName}" 已卸载`);

    return true;
  }

  enable(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      FeedbackSystem.warn(`插件 "${pluginName}" 未安装`);
      return false;
    }

    if (plugin.enabled) {
      return true;
    }

    if (plugin._def.enable && typeof plugin._def.enable === 'function') {
      try {
        plugin._def.enable(this.frame, plugin.instance);
      } catch (e) {
        console.error(`[CardFrame] 插件 "${pluginName}" 启用失败:`, e);
        this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'plugin_error',
          message: `插件 "${pluginName}" 启用失败: ${e.message}`,
          error: e,
          context: { pluginName, phase: 'enable' },
          timestamp: Date.now()
        });
        return false;
      }
    }

    plugin.enabled = true;
    this._eventBus.emit(EVENT_TYPES.PLUGIN_ENABLED, { pluginName });
    FeedbackSystem.info(`插件 "${pluginName}" 已启用`);

    return true;
  }

  disable(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      FeedbackSystem.warn(`插件 "${pluginName}" 未安装`);
      return false;
    }

    if (!plugin.enabled) {
      return true;
    }

    if (plugin._def.disable && typeof plugin._def.disable === 'function') {
      try {
        plugin._def.disable(this.frame, plugin.instance);
      } catch (e) {
        console.error(`[CardFrame] 插件 "${pluginName}" 禁用失败:`, e);
        this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'plugin_error',
          message: `插件 "${pluginName}" 禁用失败: ${e.message}`,
          error: e,
          context: { pluginName, phase: 'disable' },
          timestamp: Date.now()
        });
        return false;
      }
    }

    plugin.enabled = false;
    this._eventBus.emit(EVENT_TYPES.PLUGIN_DISABLED, { pluginName });
    FeedbackSystem.info(`插件 "${pluginName}" 已禁用`);

    return true;
  }

  get(pluginName) {
    const plugin = this.plugins.get(pluginName);
    return plugin ? plugin.instance : null;
  }

  getAll() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      enabled: p.enabled,
      dependencies: p.dependencies
    }));
  }

  isInstalled(pluginName) {
    return this.plugins.has(pluginName);
  }

  isEnabled(pluginName) {
    const plugin = this.plugins.get(pluginName);
    return plugin ? plugin.enabled : false;
  }

  // TODO: Phase 5 will implement this
  _registerPluginActions(pluginName, actions) {
    // Placeholder — Phase 5 will implement action registration
  }
}
