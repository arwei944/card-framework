/**
 * CardFrame - Main orchestrator class
 *
 * Wires together all subsystems: Store, TypeRegistry, Renderer, LayoutEngine,
 * AutoFixer, RealTimeValidator, PluginManager, EventBus, and more.
 *
 * Extracted from original IIFE L6088-7063.
 * Key changes:
 * - Creates its own EventBus instance (was module-level singleton)
 * - Injects EventBus into all sub-modules via constructor params
 * - All eventBus.on/off/once/emit replaced with this.eventBus.*
 * - evolveNow() converted from ES5 var/for-i to ES6 const/for-of
 * - destroy() uses this.eventBus.clear() instead of this.eventBus.events.clear()
 * - importData() P0 Bug #2 (bypassing Store API) marked with TODO for Phase 4
 */

import { EventBus } from './EventBus.js';
import { Store } from './Store.js';
import { TypeRegistry } from './TypeRegistry.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutEngine } from '../render/LayoutEngine.js';
import { AutoFixer } from '../validation/AutoFixer.js';
import { RealTimeValidator } from '../validation/RealTimeValidator.js';
import { PluginManager } from '../plugins/PluginManager.js';
import { CircuitBreaker } from '../security/CircuitBreaker.js';
import { ActionLogger } from '../evolution/ActionLogger.js';
import { GlobalErrorHandler } from '../evolution/GlobalErrorHandler.js';
import { PerfPanel } from '../evolution/PerfPanel.js';
import { CardObjectPool } from '../perf/CardObjectPool.js';
import { ThemeManager } from '../extras/ThemeManager.js';
import { I18nManager } from '../extras/I18nManager.js';
import { RelationshipEngine } from '../extras/RelationshipEngine.js';
import { VirtualScroller } from '../render/VirtualScroller.js';
import { EvolutionEngine } from '../evolution/EvolutionEngine.js';
import { defaultCardTypes } from './defaultCardTypes.js';
import { checkDataVersion, exportData, importData } from './DataIO.js';
import { getStats } from './StatsService.js';
import { Utils } from '../utils/Utils.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';
import { Perf } from '../perf/Perf.js';
import { DEFAULT_CONFIG, VERSION } from '../utils/constants.js';
import { Guardrail } from '../guardrail/Guardrail.js';
import { batchMethods } from './cardframe/batchMethods.js';
import { relationshipMethods } from './cardframe/relationshipMethods.js';
import { lifecycleMethods } from './cardframe/lifecycleMethods.js';

class CardFrame {
  constructor(container, options = {}) {
    container = CardFrame._resolveContainer(container);
    if (container.__cardFrame) {
      return container.__cardFrame;
    }

    this.container = container;
    this.container.classList.add('card-frame');
    this.container.__cardFrame = this;
    this._options = options;

    if (options.csp) {
      CardFrame.applyCSP(options.csp);
    }

    this._initModules(options);
    this._initDefaultTypes();
    this._initRenderSubscription();
    this._initPlugins(options);
    this._initFromDOMWhenReady();
    this._initValidator(options);
    this._initGuardrail(options);
  }

  _initGuardrail(options) {
    if (options.guardrail === false) return;
    this.guardrail = new Guardrail(this, options.guardrail === true ? {} : options.guardrail);
    this.guardrail.scan();
    this.guardrail.observe();
  }

  static _resolveContainer(container) {
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (!el) {
        throw new Error(`找不到容器元素: ${container}`);
      }
      return el;
    }
    return container;
  }

  _initModules(options) {
    const container = this.container;
    // Create EventBus first — all sub-modules depend on it
    this.eventBus = new EventBus();

    this.store = new Store(this.eventBus);
    this.typeRegistry = new TypeRegistry();
    this.renderer = new Renderer(container, this.typeRegistry, this.store, this.eventBus);
    this.layoutEngine = new LayoutEngine(container, this.store, this.renderer, this.eventBus);
    this.autoFixer = new AutoFixer(this.typeRegistry, this.store, container, this.eventBus);
    this.realTimeValidator = new RealTimeValidator(container, this.typeRegistry, this.store, this.autoFixer, this.eventBus);
    this.pluginManager = new PluginManager(this);
    this.circuitBreaker = new CircuitBreaker({ ...options.circuitBreaker, eventBus: this.eventBus });
    this.actionLogger = new ActionLogger({ ...options.actionLogger, eventBus: this.eventBus });
    this.globalErrorHandler = new GlobalErrorHandler(this.eventBus);
    this.perfPanel = new PerfPanel();
    this.cardObjectPool = new CardObjectPool(options.cardPool || {});
    this.themeManager = new ThemeManager(container, this.eventBus);
    this.i18n = new I18nManager(null, this.eventBus);
    this.relationshipEngine = new RelationshipEngine(container, this.store, this.eventBus);
    this.virtualScroller = new VirtualScroller(container, this.store, this.renderer, {
      overscan: options.overscan || DEFAULT_CONFIG.VIRTUAL_SCROLL_OVERSCAN
    });

    // Inject object pool into Store for card pooling (public API)
    this.store.setPool(this.cardObjectPool);

    // Evolution engine (disabled by default — experimental, opt-in via options.evolution)
    this.evolutionEngine = options.evolution
      ? new EvolutionEngine(this, options.evolution === true ? {} : options.evolution, this.eventBus)
      : null;
    if (this.evolutionEngine) {
      this.evolutionEngine.start();
    }

    // Wire AutoFixer → RealTimeValidator reference
    this.autoFixer._getValidator = () => this.realTimeValidator;
  }

  _initDefaultTypes() {
    defaultCardTypes.forEach(type => this.typeRegistry.register(type));
  }

  _initRenderSubscription() {
    // Single-layer scheduling: subscribe directly (no debounce). The Renderer's
    // requestAnimationFrame batching is now the ONLY render scheduler, coalescing
    // bursts of synchronous store mutations into one DOM pass per frame.
    // (Previously this debounced AND the Renderer re-scheduled with rAF — two
    // batching layers with unpredictable combined latency.)
    this.store.subscribe(() => {
      if (this._destroyed) return;
      this._renderFromStore();
    });
  }

  _renderFromStore() {
    if (this.realTimeValidator) this.realTimeValidator.pause();
    try {
      if (this.virtualScroller && this.virtualScroller.isEnabled()) {
        this.virtualScroller.refresh();
      } else if (this.renderer) {
        this.renderer.renderCards(this.store.getAllCards());
      }
      if (this.layoutEngine && this.layoutEngine.mode === 'canvas') {
        this.layoutEngine.syncPositions();
      }
    } finally {
      if (this.realTimeValidator) this.realTimeValidator.resume();
    }
  }

  _initPlugins(options) {
    if (options.virtualScroll) {
      this.virtualScroller.enable();
    }
    if (options.plugins) {
      options.plugins.forEach(plugin => this.installPlugin(plugin));
    }
  }

  _initFromDOMWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._initFromDOM());
    } else {
      this._initFromDOM();
    }
  }

  _initValidator(options) {
    if (options.autoValidate !== false) {
      this.realTimeValidator.start();
    }
  }

  _initFromDOM() {
    const cardEls = this.container.querySelectorAll('cf-card');
    cardEls.forEach(el => {
      if (!el.dataset.cardId && el._waitingForFrame) {
        el._waitingForFrame = false;
        el._initCard();
      }
    });
  }

  // ─── Card CRUD ────────────────────────────────────────────

  /**
   * 创建一张新卡片
   * @param {string} type - 卡片类型，必须是已注册的非抽象类型
   * @param {Object} props - 卡片属性对象
   * @returns {Object} 创建的卡片对象
   * @fires cardAdded
   * @fires cardAutoFixed - 如果验证失败且自动修复成功
   */
  createCard(type, props) {
    const execFn = (cb) => this.circuitBreaker ? this.circuitBreaker.execute(cb) : cb();
    return execFn(() => {
      const cardType = this.typeRegistry.get(type);
      if (cardType && cardType.abstract) {
        throw new Error(`不能创建抽象类型 "${type}" 的卡片`);
      }

      const card = {
        id: Utils.generateId('card'),
        type,
        props: { ...props },
        position: { x: 0, y: 0 },
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const validation = this.typeRegistry.validate(card);
      if (!validation.valid) {
        validation.errors.forEach(err => {
          FeedbackSystem.warn(err.message);
        });
        this.autoFixer.fixCard(card, validation);
      }

      this.store.addCard(card);
      this.actionLogger.record('addCard', { card: { ...card } });
      return card;
    }, null);
  }

  /**
   * 更新卡片信息
   * @param {Object|string} cardOrId - 完整卡片对象，或卡片 id（配合 partial）
   * @param {Object} [partial] - 增量字段：props 映射，或 { props, status, position, style }
   * @returns {Object|null} 更新后的卡片对象，卡片不存在则返回 null
   * @fires cardUpdated
   */
  updateCard(cardOrId, partial) {
    const id = typeof cardOrId === 'string' ? cardOrId : (cardOrId && cardOrId.id);
    return this.circuitBreaker.execute(() => {
      const previousState = this.store.getCard(id);
      if (!previousState) return null;

      let result;
      if (typeof cardOrId === 'string') {
        result = this.store.updateCardProps(cardOrId, partial || {});
      } else if (partial && typeof partial === 'object') {
        // id-bearing card + partial merge
        result = this.store.updateCardProps(cardOrId.id, partial);
      } else {
        result = this.store.updateCard(cardOrId);
      }

      if (result) {
        const nextProps = result.props || {};
        this.actionLogger.record('updateCard', {
          cardId: id,
          previousState: { ...previousState.props },
          newState: { ...nextProps }
        });
      }
      return result;
    }, id);
  }

  /**
   * 删除指定卡片
   * @param {string} id - 卡片 ID
   * @returns {boolean} 删除成功返回 true，卡片不存在返回 false
   * @fires cardRemoved
   */
  removeCard(id) {
    return this.circuitBreaker.execute(() => {
      const card = this.store.getCard(id);
      const result = this.store.removeCard(id);
      if (card && result) {
        this.actionLogger.record('removeCard', { card: { ...card } });
      }
      return result;
    }, id);
  }

  /**
   * 获取指定 ID 的卡片
   * @param {string} id - 卡片 ID
   * @returns {Object|undefined} 卡片对象，不存在则返回 undefined
   */
  getCard(id) {
    return this.store.getCard(id);
  }

  /**
   * 获取所有卡片
   * @returns {Array<Object>} 卡片对象数组
   */
  getAllCards() {
    return this.store.getAllCards();
  }

  /**
   * 根据类型获取卡片
   * @param {string} type - 卡片类型
   * @returns {Array<Object>} 指定类型的卡片对象数组
   */
  getCardsByType(type) {
    return this.store.getCardsByType(type);
  }

  // ─── Layout ───────────────────────────────────────────────

  /**
   * 设置布局模式
   * @param {string} mode - 布局模式：'stream' 或 'canvas'
   * @fires layoutChanged
   */
  setLayoutMode(mode) {
    this.layoutEngine.setMode(mode);
  }

  /**
   * 获取当前布局模式
   * @returns {string} 当前布局模式
   */
  getLayoutMode() {
    return this.layoutEngine.getMode();
  }

  // ─── Plugin Management ────────────────────────────────────

  /**
   * 安装插件
   * @param {Object} pluginDef - 插件定义对象
   * @returns {boolean} 安装成功返回 true
   * @fires pluginInstalled
   * @fires frameworkError - 插件安装失败时触发
   */
  installPlugin(pluginDef) {
    return this.pluginManager.install(pluginDef);
  }

  /**
   * 卸载插件
   * @param {string} pluginName - 插件名称
   * @returns {boolean} 卸载成功返回 true
   * @fires pluginUninstalled
   */
  uninstallPlugin(pluginName) {
    return this.pluginManager.uninstall(pluginName);
  }

  /**
   * 启用插件
   * @param {string} pluginName - 插件名称
   * @returns {boolean} 启用成功返回 true
   * @fires pluginEnabled
   */
  enablePlugin(pluginName) {
    return this.pluginManager.enable(pluginName);
  }

  /**
   * 禁用插件
   * @param {string} pluginName - 插件名称
   * @returns {boolean} 禁用成功返回 true
   * @fires pluginDisabled
   */
  disablePlugin(pluginName) {
    return this.pluginManager.disable(pluginName);
  }

  /**
   * 执行插件注册的 action
   * @param {string} name - action 名称
   * @param {...*} args - 传递给 action 处理器的参数
   * @returns {*} action 处理器的返回值
   */
  executeAction(name, ...args) {
    return this.pluginManager.executeAction(name, ...args);
  }

  // ─── Event Bus Proxy ──────────────────────────────────────

  on(eventName, listener) {
    this.eventBus.on(eventName, listener);
  }

  off(eventName, listener) {
    this.eventBus.off(eventName, listener);
  }

  once(eventName, listener) {
    this.eventBus.once(eventName, listener);
  }

  // ─── Data Import/Export ───────────────────────────────────

  /**
   * 校验导入数据的版本，必要时迁移。
   * @private
   * @param {Object} data - 导入数据
   * @param {Object} options - 导入选项，可包含 migrate(data, fromMajor, toMajor)
   * @returns {Object} 校验/迁移后的数据
   */
  _checkDataVersion(data, options = {}) {
    return checkDataVersion(data, CardFrame.VERSION, options, CardFrame._migrations);
  }

  /**
   * 导出数据（返回对象格式）
   * @returns {Object} 导出的数据对象
   */
  exportData() {
    return exportData({
      store: this.store,
      layoutEngine: this.layoutEngine,
      version: CardFrame.VERSION
    });
  }

  /**
   * 导出数据（返回 JSON 字符串）
   * @returns {string} JSON 格式的字符串
   */
  exportJSON() {
    return JSON.stringify(this.exportData(), null, 2);
  }

  /**
   * 导入数据
   * @param {Object|string} data - 要导入的数据（对象或 JSON 字符串）
   * @param {Object} [options] - 导入选项
   * @param {string} [options.mode='merge'] - 导入模式：'merge' 或 'replace'
   * @param {boolean} [options.clearBeforeImport=false] - 导入前是否清空现有数据
   * @param {boolean} [options.preserveLayout=false] - 是否保留当前布局模式
   * @returns {Object} 导入结果统计
   * @fires cardAdded - 新增卡片时触发
   * @fires cardUpdated - 更新卡片时触发
   * @fires relationshipAdded - 新增关系时触发
   * @fires relationshipRemoved - 删除关系时触发
   * @fires layoutChanged - 布局模式改变时触发
   */
  importData(data, options = {}) {
    return importData({
      store: this.store,
      layoutEngine: this.layoutEngine,
      version: CardFrame.VERSION,
      defaultMigrate: CardFrame._migrations
    }, data, options);
  }

  // ─── Stats & Performance ──────────────────────────────────

  /**
   * 获取框架统计信息
   * @returns {Object} 统计对象
   */
  getStats() {
    return getStats({
      store: this.store,
      pluginManager: this.pluginManager,
      layoutEngine: this.layoutEngine,
      circuitBreaker: this.circuitBreaker,
      autoFixer: this.autoFixer
    });
  }

  getPerfStats() {
    return Perf.getStats();
  }

  enablePerfPanel() {
    this.perfPanel.enable(this.container);
  }

  disablePerfPanel() {
    this.perfPanel.disable();
  }

  enableGlobalErrorHandler() {
    this.globalErrorHandler.enable();
  }

  disableGlobalErrorHandler() {
    this.globalErrorHandler.disable();
  }

  getGlobalErrorStats() {
    return this.globalErrorHandler.getErrorStats();
  }

  enableVirtualScroll(options = {}) {
    if (this.virtualScroller) {
      this.virtualScroller.enable(options);
    }
  }

  disableVirtualScroll() {
    if (this.virtualScroller) {
      this.virtualScroller.disable();
      this.renderer.forceFullRender(this.store.getAllCards());
    }
  }

  isVirtualScrollEnabled() {
    return this.virtualScroller ? this.virtualScroller.isEnabled() : false;
  }

  // ─── Internal Helpers ─────────────────────────────────────

  toJSON() {
    return this.store.toJSON();
  }

  // ─── Static Factory Methods ───────────────────────────────

  static fromJSON(data) {
    const container = document.createElement('div');
    const frame = new CardFrame(container);
    const store = Store.fromJSON(data, frame.eventBus);
    frame.store = store;
    store.subscribe(Utils.debounce(() => {
      frame.renderer.renderCards(store.getAllCards());
    }, 16));
    return frame;
  }

  static getPerfStats() {
    return Perf.getStats();
  }

  static from(selector) {
    const container = document.querySelector(selector);
    if (!container) {
      throw new Error(`找不到容器元素: ${selector}`);
    }
    return new CardFrame(container);
  }

  // ─── Evolution ────────────────────────────────────────────

  getEvolutionHistory() {
    return this.evolutionEngine ? this.evolutionEngine.getEvolutionHistory() : [];
  }

  getMetricsSnapshot() {
    return this.evolutionEngine ? this.evolutionEngine.getMetrics() : null;
  }

  evolveNow() {
    if (this.evolutionEngine) {
      const metrics = this.evolutionEngine.metricsCollector.getSnapshot();
      const actions = this.evolutionEngine.ruleEngine.evaluate(metrics);
      for (const action of actions) {
        this.evolutionEngine._executeAction(action);
      }
    }
  }

  /**
   * 框架版本号
   * @type {string}
   */
  static get VERSION() {
    return VERSION;
  }

  /**
   * 注册卡片类型（委托 TypeRegistry；默认拒绝不安全模板）
   * @param {Object} typeDef
   * @param {Object} [options]
   * @returns {boolean}
   */
  registerType(typeDef, options) {
    return this.typeRegistry.register(typeDef, options);
  }

  /**
   * 添加 Content-Security-Policy meta 标签。若页面已存在 CSP meta 则不覆盖。
   * @param {string} policy - CSP 策略字符串，例如 "default-src 'self'"
   * @returns {boolean} 添加成功返回 true；已存在或无 document 返回 false
   */
  static applyCSP(policy) {
    if (typeof document === 'undefined' || !policy) return false;
    const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existing) return false;
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', String(policy));
    (document.head || document.documentElement).appendChild(meta);
    return true;
  }
}

Object.assign(CardFrame.prototype, batchMethods, relationshipMethods, lifecycleMethods);

export { CardFrame };
