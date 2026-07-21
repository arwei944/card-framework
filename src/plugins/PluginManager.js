/**
 * PluginManager — plugin lifecycle, hooks, permissions, and sandboxing.
 * @module plugins/PluginManager
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { Security } from '../security/Security.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';
import { PluginSandbox } from './PluginSandbox.js';

export class PluginManager {
  constructor(frame) {
    this.frame = frame;
    this.plugins = new Map();
    this._hooks = new Map();
    this._permissions = new Map();
    this._callCounts = new Map();
    this._maxCallsPerMinute = 1000;
    this._actions = new Map();
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

  createSandbox(pluginName, permissions) {
    return new PluginSandbox(
      pluginName,
      this.frame,
      permissions,
      (name) => this.checkRateLimit(name)
    );
  }

  getSandboxContext(pluginName) {
    const plugin = this.plugins.get(pluginName);
    const sandbox = plugin && plugin.sandbox
      ? plugin.sandbox
      : this.createSandbox(pluginName, Array.from(this._permissions.get(pluginName) || []));
    return sandbox.createContext();
  }

  registerHook(hookName, handler, options = {}) {
    if (!this._hooks.has(hookName)) {
      this._hooks.set(hookName, []);
    }
    const entry = {
      handler,
      priority: typeof options.priority === 'number' ? options.priority : 0,
      pluginName: options.pluginName || null,
      seq: this._hookSeq = (this._hookSeq || 0) + 1
    };
    this._hooks.get(hookName).push(entry);
    return () => {
      const list = this._hooks.get(hookName);
      if (!list) return;
      const idx = list.indexOf(entry);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  _sortedHooks(hookName) {
    const list = this._hooks.get(hookName);
    if (!list || list.length === 0) return [];
    return list.slice().sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.seq - b.seq;
    });
  }

  triggerHook(hookName, data) {
    const entries = this._sortedHooks(hookName);
    if (entries.length === 0) return data;

    let result = data;
    entries.forEach(entry => {
      try {
        result = entry.handler(result, this.frame) || result;
      } catch (e) {
        const who = entry.pluginName ? `插件 "${entry.pluginName}" 的` : '';
        console.error(`[CardFrame] ${who}钩子 "${hookName}" 执行错误:`, e);
        this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'plugin_error',
          message: `${who}钩子 "${hookName}" 执行错误: ${e.message}`,
          error: e,
          context: { hookName, pluginName: entry.pluginName, phase: 'triggerHook' },
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

    const declaredPermissions = pluginDef.permissions || [];
    const allowed = this.frame._options && this.frame._options.allowedPluginPermissions;
    if (allowed) {
      const allowedSet = new Set(allowed);
      const denied = allowedSet.has('*')
        ? []
        : declaredPermissions.filter(p => !allowedSet.has(p));
      if (denied.length > 0) {
        throw new Error(`插件 "${pluginDef.name}" 请求未授权的权限: ${denied.join(', ')}`);
      }
    }
    this.registerPermissions(pluginDef.name, declaredPermissions);

    const sandbox = this.createSandbox(pluginDef.name, declaredPermissions);

    const plugin = {
      name: pluginDef.name,
      version: pluginDef.version || '1.0.0',
      description: pluginDef.description || '',
      author: pluginDef.author || '',
      dependencies: pluginDef.dependencies || [],
      permissions: declaredPermissions,
      enabled: false,
      instance: null,
      sandbox,
      _def: pluginDef,
      _actionNames: [],
      _hookUnregisters: []
    };

    if (typeof pluginDef.install === 'function') {
      try {
        plugin.instance = pluginDef.install(this.frame, sandbox.createContext()) || {};
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
        if (this.frame.typeRegistry.register(typeDef)) {
          sandbox.trackType(typeDef.type);
        }
      });
    }

    if (pluginDef.themes) {
      pluginDef.themes.forEach(themeDef => {
        this.frame.themeManager.registerTheme(themeDef);
        if (themeDef && themeDef.name) sandbox.trackTheme(themeDef.name);
      });
    }

    if (pluginDef.actions) {
      this._registerPluginActions(pluginDef.name, pluginDef.actions);
    }

    if (pluginDef.hooks) {
      for (const [hookName, hookDef] of Object.entries(pluginDef.hooks)) {
        const handler = typeof hookDef === 'function' ? hookDef : hookDef.handler;
        const priority = typeof hookDef === 'object' && hookDef ? hookDef.priority : 0;
        if (typeof handler === 'function') {
          const unregister = this.registerHook(hookName, handler, {
            priority,
            pluginName: pluginDef.name
          });
          plugin._hookUnregisters.push(unregister);
        }
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

    (plugin._hookUnregisters || []).forEach(unregister => {
      try { unregister(); } catch { /* noop */ }
    });
    plugin._hookUnregisters = [];

    (plugin._actionNames || []).forEach(name => {
      const entry = this._actions.get(name);
      if (entry && entry.pluginName === pluginName) {
        this._actions.delete(name);
      }
    });
    plugin._actionNames = [];

    if (plugin.sandbox) {
      plugin.sandbox.destroy();
    }

    this._permissions.delete(pluginName);
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

  _registerPluginActions(pluginName, actions) {
    if (!Array.isArray(actions)) return;
    const plugin = this.plugins.get(pluginName);
    actions.forEach(action => {
      if (!action || !action.name || typeof action.handler !== 'function') {
        FeedbackSystem.warn(`插件 "${pluginName}" 的 action 定义无效，需包含 name 与 handler`);
        return;
      }
      if (this._actions.has(action.name)) {
        FeedbackSystem.warn(`action "${action.name}" 已注册，插件 "${pluginName}" 的同名 action 被忽略`);
        return;
      }
      this._actions.set(action.name, { pluginName, handler: action.handler });
      if (plugin) plugin._actionNames.push(action.name);
    });
  }

  hasAction(name) {
    return this._actions.has(name);
  }

  executeAction(name, ...args) {
    const entry = this._actions.get(name);
    if (!entry) {
      FeedbackSystem.warn(`action "${name}" 未注册`);
      return undefined;
    }
    if (!this.checkRateLimit(entry.pluginName)) {
      FeedbackSystem.warn('plugin_rate_limit', `插件 "${entry.pluginName}" 操作频率超限`);
      return undefined;
    }
    try {
      return entry.handler(this.frame, ...args);
    } catch (e) {
      console.error(`[CardFrame] action "${name}" 执行错误:`, e);
      this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
        type: 'plugin_error',
        message: `action "${name}" 执行错误: ${e.message}`,
        error: e,
        context: { actionName: name, pluginName: entry.pluginName, phase: 'executeAction' },
        timestamp: Date.now()
      });
      return undefined;
    }
  }
}
