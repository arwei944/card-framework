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
import { EVENT_TYPES, DEFAULT_CONFIG, VERSION } from '../utils/constants.js';
import { Guardrail } from '../guardrail/Guardrail.js';

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

    // Inject object pool into Store for card pooling
    this.store._pool = this.cardObjectPool;

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
   * @param {Object} card - 完整的卡片对象（必须包含 id）
   * @returns {Object|null} 更新后的卡片对象，卡片不存在则返回 null
   * @fires cardUpdated
   */
  updateCard(card) {
    return this.circuitBreaker.execute(() => {
      const previousState = this.store.getCard(card.id);
      const result = this.store.updateCard(card);
      if (previousState) {
        this.actionLogger.record('updateCard', {
          cardId: card.id,
          previousState: { ...previousState.props },
          newState: { ...card.props }
        });
      }
      return result;
    }, card.id);
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

  // ─── Batch Operations ─────────────────────────────────────

  /**
   * 批量创建卡片
   * @param {Array<Object>} cards - 卡片数据数组，每项包含 type 和 props
   * @returns {Object} 结果对象，包含 success 和 errors
   * @fires cardAdded - 每张成功创建的卡片都会触发
   * @fires frameworkError - 每张创建失败的卡片都会触发
   */
  batchCreateCards(cards) {
    const results = [];
    const errors = [];

    cards.forEach((cardData, index) => {
      try {
        const card = this.createCard(cardData.type, cardData.props || {});
        let changed = false;
        if (cardData.position) { card.position = cardData.position; changed = true; }
        if (cardData.status) { card.status = cardData.status; changed = true; }
        if (cardData.style) { card.style = cardData.style; changed = true; }

        if (cardData.id && cardData.id !== card.id) {
          // Re-key the card in the Store so getCard(customId) works
          this.store.removeCard(card.id);
          card.id = cardData.id;
          this.store.addCard(card);
        } else if (changed) {
          this.store.updateCard(card);
        }
        results.push(card);
      } catch (e) {
        errors.push({ index, error: e.message, cardData });
        this.eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'batch_error',
          message: `批量创建卡片失败 (索引 ${index}): ${e.message}`,
          error: e,
          context: { operation: 'batchCreateCards', index, cardData },
          timestamp: Date.now()
        });
      }
    });

    return { success: results, errors };
  }

  /**
   * 批量更新卡片
   * @param {Array<Object>} updates - 更新数据数组，每项包含 id 及要更新的字段
   * @returns {Object} 结果对象，包含 success 和 errors
   * @fires cardUpdated - 每张成功更新的卡片都会触发
   * @fires frameworkError - 每张更新失败的卡片都会触发
   */
  batchUpdateCards(updates) {
    const results = [];
    const errors = [];

    updates.forEach((update, index) => {
      try {
        const card = this.getCard(update.id);
        if (!card) {
          errors.push({ index, error: `卡片 ${update.id} 不存在`, update });
          return;
        }
        const updated = { ...card, ...update, id: update.id };
        const result = this.updateCard(updated);
        results.push(result);
      } catch (e) {
        errors.push({ index, error: e.message, update });
        this.eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'batch_error',
          message: `批量更新卡片失败 (索引 ${index}): ${e.message}`,
          error: e,
          context: { operation: 'batchUpdateCards', index, update },
          timestamp: Date.now()
        });
      }
    });

    return { success: results, errors };
  }

  /**
   * 批量删除卡片
   * @param {Array<string>} ids - 要删除的卡片 ID 数组
   * @returns {Object} 结果对象，包含 success 和 errors
   * @fires cardRemoved - 每张成功删除的卡片都会触发
   * @fires frameworkError - 每张删除失败的卡片都会触发
   */
  batchRemoveCards(ids) {
    const results = [];
    const errors = [];

    ids.forEach((id, index) => {
      try {
        const success = this.removeCard(id);
        if (success) {
          results.push(id);
        } else {
          errors.push({ index, error: `卡片 ${id} 删除失败`, id });
        }
      } catch (e) {
        errors.push({ index, error: e.message, id });
        this.eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'batch_error',
          message: `批量删除卡片失败 (索引 ${index}): ${e.message}`,
          error: e,
          context: { operation: 'batchRemoveCards', index, id },
          timestamp: Date.now()
        });
      }
    });

    return { success: results, errors };
  }

  // ─── Action History (Undo/Redo) ───────────────────────────

  undo() {
    return this.actionLogger.undo(this.store);
  }

  redo() {
    return this.actionLogger.redo(this.store);
  }

  rollback(timestamp) {
    return this.actionLogger.rollback(timestamp, this.store);
  }

  getActionHistory() {
    return this.actionLogger.getHistory();
  }

  clearActionHistory() {
    this.actionLogger.clear();
  }

  // ─── Relationships ────────────────────────────────────────

  /**
   * 创建卡片之间的关系
   * @param {string} sourceId - 源卡片 ID
   * @param {string} targetId - 目标卡片 ID
   * @param {string} [type='reference'] - 关系类型
   * @param {Object} [data={}] - 附加的关系数据
   * @returns {Object} 创建的关系对象
   * @fires relationshipAdded
   */
  createRelationship(sourceId, targetId, type = 'reference', data = {}) {
    const rel = this.store.addRelationship({
      sourceId,
      targetId,
      type,
      data
    });
    if (rel) {
      this.actionLogger.record('addRelationship', { relationship: { ...rel } });
    }
    return rel;
  }

  /**
   * 删除指定关系
   * @param {string} id - 关系 ID
   * @returns {boolean} 删除成功返回 true
   * @fires relationshipRemoved
   */
  removeRelationship(id) {
    const rel = this.store.getRelationship(id);
    const result = this.store.removeRelationship(id);
    if (rel && result) {
      this.actionLogger.record('removeRelationship', { relationship: { ...rel } });
    }
    return result;
  }

  getRelationship(id) {
    return this.store.getRelationship(id);
  }

  getAllRelationships() {
    return this.store.getAllRelationships();
  }

  getRelationshipsByCard(cardId) {
    return this.store.getRelationshipsByCard(cardId);
  }

  getRelationshipsByType(type) {
    return this.store.getRelationshipsByType(type);
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

  // ─── Cleanup ──────────────────────────────────────────────

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // 0. Cancel any pending render frame the Renderer may have scheduled
    if (this.renderer && this.renderer._rafId != null) {
      cancelAnimationFrame(this.renderer._rafId);
      this.renderer._rafId = null;
    }

    // 1. Stop evolution engine (includes MetricsCollector timer)
    if (this.evolutionEngine) {
      this.evolutionEngine.stop();
      this.evolutionEngine = null;
    }

    // 2. Stop real-time validator (MutationObserver)
    if (this.realTimeValidator) {
      this.realTimeValidator.stop();
    }

    // 2b. Stop guardrail (MutationObserver + DOM API hijack)
    if (this.guardrail) {
      this.guardrail.destroy();
      this.guardrail = null;
    }

    // 3. Disable perf panel (RAF)
    if (this.perfPanel) {
      this.perfPanel.disable();
    }

    // 4. Disable global error handler (window events)
    if (this.globalErrorHandler) {
      this.globalErrorHandler.disable();
    }

    // 5. Disable virtual scroller (window resize/scroll events)
    if (this.virtualScroller) {
      this.virtualScroller.destroy();
    }

    // 6. Clean up relationship engine (SVG layer, drag events)
    if (this.relationshipEngine) {
      this.relationshipEngine.disable();
    }

    // 7. Clear all EventBus listeners
    this.eventBus.clear();

    // 8. Clear object pool
    if (this.cardObjectPool && typeof this.cardObjectPool.clear === 'function') {
      this.cardObjectPool.clear();
    }

    // 9. Clear store data/index (drop references so it can be GC'd)
    if (this.store) {
      if (this.store._notifyTimer) {
        clearTimeout(this.store._notifyTimer);
        this.store._notifyTimer = null;
      }
      this.store.listeners.clear();
      this.store.cards.clear();
      this.store.relationships.clear();
      if (this.store._relIndex) this.store._relIndex.clear();
      if (this.store._index && typeof this.store._index.clear === 'function') {
        this.store._index.clear();
      }
      this.store._pool = null;
    }

    // 10. Clean up container: remove rendered DOM + framework marker
    this.container.classList.remove('card-frame');
    this.container.innerHTML = '';
    if (this.container.__cardFrame === this) {
      delete this.container.__cardFrame;
    }

    // 11. Null out sub-module references
    // (store/typeRegistry/autoFixer/circuitBreaker/actionLogger kept for degraded access)
    this.renderer = null;
    this.layoutEngine = null;
    this.realTimeValidator = null;
    this.pluginManager = null;
    this.globalErrorHandler = null;
    this.perfPanel = null;
    this.cardObjectPool = null;
    this.themeManager = null;
    this.i18n = null;
    this.relationshipEngine = null;
    this.virtualScroller = null;
    this.eventBus = null;
  }

  /**
   * 框架版本号
   * @type {string}
   */
  static get VERSION() {
    return VERSION;
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

export { CardFrame };
