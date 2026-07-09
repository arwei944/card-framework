const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '..', 'src', 'card-framework.js');
const CSS_SRC_PATH = path.join(__dirname, '..', 'src', 'card-framework.css');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readSource() {
  return fs.readFileSync(SRC_PATH, 'utf-8');
}

function extractClass(source, className) {
  const pattern = new RegExp(`  class ${className} \\{[\\s\\S]*?\\n  \\}`, 'm');
  const match = source.match(pattern);
  return match ? match[0] : null;
}

function extractConst(source, constName) {
  const pattern = new RegExp(`  const ${constName} = (?:\\{|\\[)[\\s\\S]*?\\n  \\};?`, 'm');
  const match = source.match(pattern);
  return match ? match[0] : null;
}

function buildCoreModule(source) {
  const lines = [];
  
  lines.push('(function(window) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const eventTypes = extractConst(source, 'EVENT_TYPES');
  if (eventTypes) lines.push(eventTypes, '');
  
  const utilsMatch = source.match(/  const Utils = \{[\s\S]*?\n  \};/);
  if (utilsMatch) {
    let utilsCode = utilsMatch[0];
    const methodsToRemove = ['sanitizeHtml', 'sanitizeUrl', 'sanitizeStyle', 'isSafeUrl'];
    methodsToRemove.forEach(method => {
      const regex = new RegExp(`    ${method}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\},?\\n`, 'g');
      utilsCode = utilsCode.replace(regex, '');
    });
    lines.push(utilsCode, '');
  }
  
  const feedbackMatch = source.match(/  const FeedbackSystem = \{[\s\S]*?\n  \};/);
  if (feedbackMatch) lines.push(feedbackMatch[0], '');
  
  const eventBusClass = extractClass(source, 'EventBus');
  if (eventBusClass) {
    lines.push(eventBusClass, '');
    lines.push('  const eventBus = new EventBus();', '');
  }
  
  const storeClass = extractClass(source, 'Store');
  if (storeClass) lines.push(storeClass, '');
  
  const typeRegistryClass = extractClass(source, 'TypeRegistry');
  if (typeRegistryClass) lines.push(typeRegistryClass, '');
  
  const defaultTypesMatch = source.match(/  const defaultCardTypes = \[[\s\S]*?\n  \];/);
  if (defaultTypesMatch) lines.push(defaultTypesMatch[0], '');
  
  lines.push(`
  class CardFrame {
    constructor(container, options = {}) {
      if (typeof container === 'string') {
        const el = document.querySelector(container);
        if (!el) throw new Error('找不到容器元素: ' + container);
        container = el;
      }
      if (container.__cardFrame) return container.__cardFrame;
      
      this.container = container;
      this.container.classList.add('card-frame');
      this.container.__cardFrame = this;
      this._options = options;
      
      this.store = new Store();
      this.typeRegistry = new TypeRegistry();
      this.eventBus = eventBus;
      
      defaultCardTypes.forEach(type => this.typeRegistry.register(type));
      
      this._initModules(options);
      
      CardFrame._globalStore = this.store;
    }
    
    _initModules(options) {
      const modules = CardFrame._moduleInits || [];
      modules.forEach(init => {
        try { init.call(this, options); } catch (e) {
          console.error('[CardFrame] 模块初始化失败:', e);
        }
      });
    }
    
    createCard(type, props) {
      const cardType = this.typeRegistry.get(type);
      if (cardType && cardType.abstract) {
        throw new Error('不能创建抽象类型 "' + type + '" 的卡片');
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
        validation.errors.forEach(err => FeedbackSystem.warn(err.message));
      }
      this.store.addCard(card);
      return card;
    }
    
    updateCard(card) { return this.store.updateCard(card); }
    removeCard(id) { return this.store.removeCard(id); }
    getCard(id) { return this.store.getCard(id); }
    getAllCards() { return this.store.getAllCards(); }
    getCardsByType(type) { return this.store.getCardsByType(type); }
    
    createRelationship(sourceId, targetId, type = 'reference', data = {}) {
      return this.store.addRelationship({ sourceId, targetId, type, data });
    }
    removeRelationship(id) { return this.store.removeRelationship(id); }
    getRelationship(id) { return this.store.getRelationship(id); }
    getAllRelationships() { return this.store.getAllRelationships(); }
    getRelationshipsByCard(cardId) { return this.store.getRelationshipsByCard(cardId); }
    getRelationshipsByType(type) { return this.store.getRelationshipsByType(type); }
    
    on(eventName, listener) { eventBus.on(eventName, listener); }
    off(eventName, listener) { eventBus.off(eventName, listener); }
    once(eventName, listener) { eventBus.once(eventName, listener); }
    emit(eventName, detail) { eventBus.emit(eventName, detail); }
    
    exportData() {
      return {
        version: '1.0',
        exportedAt: Date.now(),
        cards: this.store.getAllCards(),
        relationships: this.store.getAllRelationships(),
        metadata: {
          cardCount: this.store.getAllCards().length,
          relationshipCount: this.store.getAllRelationships().length
        }
      };
    }
    
    exportJSON() { return JSON.stringify(this.exportData(), null, 2); }
    
    importData(data, options = {}) {
      if (typeof data === 'string') data = JSON.parse(data);
      const { mode = 'merge', clearBeforeImport = false } = options;
      if (clearBeforeImport) {
        this.store.cards.clear();
        this.store.relationships.clear();
      }
      if (mode === 'replace') {
        this.store.cards.clear();
        this.store.relationships.clear();
      }
      let importedCards = 0, importedRelationships = 0;
      if (data.cards) {
        data.cards.forEach(cardData => {
          if (mode === 'merge' && this.store.getCard(cardData.id)) {
            this.store.updateCard(cardData);
          } else {
            this.store.cards.set(cardData.id, cardData);
          }
          importedCards++;
        });
      }
      if (data.relationships) {
        data.relationships.forEach(relData => {
          if (mode === 'merge' && this.store.getRelationship(relData.id)) {
            this.store.updateRelationship(relData);
          } else {
            this.store.relationships.set(relData.id, relData);
          }
          importedRelationships++;
        });
      }
      this.store.notify();
      return {
        importedCards, importedRelationships, mode,
        totalCards: this.store.getAllCards().length,
        totalRelationships: this.store.getAllRelationships().length
      };
    }
    
    getStats() {
      return {
        cards: { total: this.store.getAllCards().length, byType: this._getCardTypeStats() },
        relationships: { total: this.store.getAllRelationships().length }
      };
    }
    
    _getCardTypeStats() {
      const stats = {};
      this.store.getAllCards().forEach(card => {
        stats[card.type] = (stats[card.type] || 0) + 1;
      });
      return stats;
    }
    
    toJSON() { return this.store.toJSON(); }
    
    static fromJSON(data) {
      const container = document.createElement('div');
      const frame = new CardFrame(container);
      const store = Store.fromJSON(data);
      frame.store = store;
      return frame;
    }
    
    static from(selector) {
      const container = document.querySelector(selector);
      if (!container) throw new Error('找不到容器元素: ' + selector);
      return new CardFrame(container);
    }
  }
  
  CardFrame._moduleInits = [];
  CardFrame._modules = {};
  
  CardFrame.registerModule = function(name, initFn, deps = []) {
    if (CardFrame._modules[name]) return;
    CardFrame._modules[name] = { deps, loaded: true };
    if (typeof initFn === 'function') {
      CardFrame._moduleInits.push(initFn);
    }
  };
  
  CardFrame.Utils = Utils;
  CardFrame.Store = Store;
  CardFrame.TypeRegistry = TypeRegistry;
  CardFrame.EventBus = eventBus;
  CardFrame.FeedbackSystem = FeedbackSystem;
  CardFrame.EVENT_TYPES = EVENT_TYPES;
  CardFrame._globalStore = null;
  
  const globalStore = new Store();
  const globalTypeRegistry = new TypeRegistry();
  defaultCardTypes.forEach(type => globalTypeRegistry.register(type));
  
  CardFrame.store = globalStore;
  CardFrame.typeRegistry = globalTypeRegistry;
  
  const _loadedModules = new Set(['core']);
  const _loadingModules = new Map();
  
  CardFrame._modules.core = { deps: [], loaded: true };
  
  CardFrame.load = function(moduleName) {
    if (_loadedModules.has(moduleName)) return Promise.resolve();
    if (_loadingModules.has(moduleName)) return _loadingModules.get(moduleName);
    
    const modConfig = CardFrame._modules[moduleName];
    if (!modConfig) return Promise.reject(new Error('未知模块: ' + moduleName));
    
    const deps = modConfig.deps || [];
    const promise = Promise.all(deps.map(d => CardFrame.load(d))).then(() => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = moduleName + '.js';
        script.onload = () => {
          _loadedModules.add(moduleName);
          _loadingModules.delete(moduleName);
          resolve();
        };
        script.onerror = () => {
          _loadingModules.delete(moduleName);
          reject(new Error('加载模块失败: ' + moduleName));
        };
        document.head.appendChild(script);
      });
    });
    
    _loadingModules.set(moduleName, promise);
    return promise;
  };
  
  CardFrame.preload = function(moduleName) { return CardFrame.load(moduleName); };
  CardFrame.isModuleLoaded = function(moduleName) { return _loadedModules.has(moduleName); };
  
  window.CardFrameCore = {
    Utils, Store, TypeRegistry, EventBus: eventBus,
    FeedbackSystem, EVENT_TYPES, defaultCardTypes
  };
  
  window.CardFrame = CardFrame;
  
  if (typeof customElements !== 'undefined') {
    class CardElement extends HTMLElement {
      constructor() { super(); this._isUpdating = false; }
      
      _getFrame() {
        const frameEl = this.closest('.card-frame, card-frame');
        return frameEl ? (frameEl.__cardFrame || null) : null;
      }
      
      connectedCallback() {
        const frame = this._getFrame();
        if (!frame) { this._waitingForFrame = true; return; }
        this._initCard();
      }
      
      _initCard() {
        const frame = this._getFrame();
        if (!frame || this.dataset.cardId) return;
        const card = this._extractCard();
        frame.store.addCard(card);
        this.dataset.cardId = card.id;
      }
      
      _extractCard() {
        const props = {};
        for (const attr of this.attributes) {
          if (attr.name.startsWith('data-')) props[attr.name.slice(5)] = attr.value;
          else if (!['type', 'id', 'class'].includes(attr.name)) props[attr.name] = attr.value;
        }
        if (this.innerHTML.trim()) props.content = this.innerHTML.trim();
        return {
          id: this.id || Utils.generateId('card'),
          type: this.getAttribute('type') || 'text',
          props,
          position: { x: 0, y: 0 },
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
    }
    
    class CardFrameElement extends HTMLElement {
      connectedCallback() {
        if (!this._initialized) {
          this._initialized = true;
          this.classList.add('card-frame');
          const frame = new CardFrame(this);
          this.__cardFrame = frame;
        }
      }
    }
    
    customElements.define('card-frame', CardFrameElement);
    customElements.define('cf-card', CardElement);
  }
  
  window.CardFrameCore._loadedModules = _loadedModules;
  window.CardFrameCore._loadingModules = _loadingModules;
  
})(window);
`);
  
  return lines.join('\n');
}

function buildSecurityModule(source) {
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, FeedbackSystem, EVENT_TYPES, eventBus) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const securityMatch = source.match(/  const Security = \{[\s\S]*?\n  \};/);
  if (securityMatch) lines.push(securityMatch[0], '');
  
  const circuitBreakerClass = extractClass(source, 'CircuitBreaker');
  if (circuitBreakerClass) lines.push(circuitBreakerClass, '');
  
  lines.push(`
  Utils.sanitizeHtml = function(html, options) { return Security.sanitizeHtml(html, options); };
  Utils.sanitizeUrl = function(url) { return Security.sanitizeUrl(url); };
  Utils.sanitizeStyle = function(styleStr) { return Security.sanitizeStyle(styleStr); };
  Utils.isSafeUrl = function(url) { return Security.isSafeUrl(url); };
  
  CardFrame.Security = Security;
  CardFrame.CircuitBreaker = CircuitBreaker;
  CardFrameCore.Security = Security;
  CardFrameCore.CircuitBreaker = CircuitBreaker;
  
  CardFrame.registerModule('security', function(options) {
    this.circuitBreaker = new CircuitBreaker((options && options.circuitBreaker) || {});
    
    const origCreate = this.createCard;
    const origUpdate = this.updateCard;
    const origRemove = this.removeCard;
    const self = this;
    
    this.createCard = function(type, props) {
      return self.circuitBreaker.execute(function() { return origCreate.call(self, type, props); }, null);
    };
    this.updateCard = function(card) {
      return self.circuitBreaker.execute(function() { return origUpdate.call(self, card); }, card.id);
    };
    this.removeCard = function(id) {
      return self.circuitBreaker.execute(function() { return origRemove.call(self, id); }, id);
    };
  }, ['core']);
  
})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.FeedbackSystem, window.CardFrameCore.EVENT_TYPES, window.CardFrameCore.EventBus);
`);
  
  return lines.join('\n');
}

function buildRenderModule(source) {
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, Store, TypeRegistry, eventBus) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const rendererClass = extractClass(source, 'Renderer');
  if (rendererClass) lines.push(rendererClass, '');
  
  const layoutEngineClass = extractClass(source, 'LayoutEngine');
  if (layoutEngineClass) lines.push(layoutEngineClass, '');
  
  lines.push(`
  CardFrame.Renderer = Renderer;
  CardFrame.LayoutEngine = LayoutEngine;
  CardFrameCore.Renderer = Renderer;
  CardFrameCore.LayoutEngine = LayoutEngine;
  
  CardFrame.registerModule('render', function(options) {
    this.renderer = new Renderer(this.container, this.typeRegistry, this.store);
    this.layoutEngine = new LayoutEngine(this.container, this.store, this.renderer);
    
    this.store.subscribe(Utils.debounce(() => {
      if (this.virtualScroller && this.virtualScroller.isEnabled()) {
        this.virtualScroller.refresh();
      } else if (this.renderer) {
        this.renderer.renderCards(this.store.getAllCards());
      }
      if (this.layoutEngine && this.layoutEngine.mode === 'canvas') {
        this.layoutEngine.syncPositions();
      }
      if (this.realTimeValidator) {
        this.realTimeValidator.resume();
      }
    }, 16));
    
    this.setLayoutMode = function(mode) {
      this.layoutEngine.setMode(mode);
    };
    this.getLayoutMode = function() {
      return this.layoutEngine.getMode();
    };
    
    this.layoutEngine.applyLayout();
  }, ['core']);
  
  const origFromJSON = CardFrame.fromJSON;
  CardFrame.fromJSON = function(data) {
    const frame = origFromJSON(data);
    if (frame._initModules && CardFrame.isModuleLoaded('render')) {
      const renderInit = CardFrame._moduleInits.find(m => m.name === '' || true);
    }
    return frame;
  };
  
})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.Store, window.CardFrameCore.TypeRegistry, window.CardFrameCore.EventBus);
`);
  
  return lines.join('\n');
}

function buildValidationModule(source) {
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, FeedbackSystem, Security) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const autoFixerClass = extractClass(source, 'AutoFixer');
  if (autoFixerClass) lines.push(autoFixerClass, '');
  
  const realTimeValidatorClass = extractClass(source, 'RealTimeValidator');
  if (realTimeValidatorClass) lines.push(realTimeValidatorClass, '');
  
  lines.push(`
  CardFrame.AutoFixer = AutoFixer;
  CardFrame.RealTimeValidator = RealTimeValidator;
  CardFrameCore.AutoFixer = AutoFixer;
  CardFrameCore.RealTimeValidator = RealTimeValidator;
  
  CardFrame.registerModule('validation', function(options) {
    this.autoFixer = new AutoFixer(this.typeRegistry, this.store, this.container);
    this.realTimeValidator = new RealTimeValidator(this.container, this.typeRegistry, this.store, this.autoFixer);
    this.autoFixer._getValidator = () => this.realTimeValidator;
    
    if (!options || options.autoValidate !== false) {
      this.realTimeValidator.start();
    }
    
    this.validateAll = function() { this.realTimeValidator.validateAll(); };
    this.fullCheck = function() { return this.realTimeValidator.fullCheck(); };
    this.fixAll = function() { return this.autoFixer.fixAll(); };
  }, ['core']);
  
})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem, window.CardFrameCore.Security || {});
`);
  
  return lines.join('\n');
}

function buildExtrasModule(source) {
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, FeedbackSystem) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const themeManagerClass = extractClass(source, 'ThemeManager');
  if (themeManagerClass) lines.push(themeManagerClass, '');
  
  const i18nManagerClass = extractClass(source, 'I18nManager');
  if (i18nManagerClass) lines.push(i18nManagerClass, '');
  
  const relationshipEngineClass = extractClass(source, 'RelationshipEngine');
  if (relationshipEngineClass) lines.push(relationshipEngineClass, '');
  
  lines.push(`
  CardFrame.ThemeManager = ThemeManager;
  CardFrame.I18nManager = I18nManager;
  CardFrame.RelationshipEngine = RelationshipEngine;
  CardFrameCore.ThemeManager = ThemeManager;
  CardFrameCore.I18nManager = I18nManager;
  CardFrameCore.RelationshipEngine = RelationshipEngine;
  
  CardFrame.registerModule('extras', function(options) {
    this.themeManager = new ThemeManager(this.container);
    this.i18n = new I18nManager();
    this.relationshipEngine = new RelationshipEngine(this.container, this.store);
  }, ['core', 'render']);
  
})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem);
`);
  
  return lines.join('\n');
}

function buildPluginsModule(source) {
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, FeedbackSystem) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const pluginManagerClass = extractClass(source, 'PluginManager');
  if (pluginManagerClass) lines.push(pluginManagerClass, '');
  
  lines.push(`
  CardFrame.PluginManager = PluginManager;
  CardFrameCore.PluginManager = PluginManager;
  
  CardFrame.registerModule('plugins', function(options) {
    this.pluginManager = new PluginManager(this);
    
    this.installPlugin = function(pluginDef) { return this.pluginManager.install(pluginDef); };
    this.uninstallPlugin = function(pluginName) { return this.pluginManager.uninstall(pluginName); };
    this.enablePlugin = function(pluginName) { return this.pluginManager.enable(pluginName); };
    this.disablePlugin = function(pluginName) { return this.pluginManager.disable(pluginName); };
    this.getPlugin = function(pluginName) { return this.pluginManager.get(pluginName); };
    this.getAllPlugins = function() { return this.pluginManager.getAll(); };
    
    if (options && options.plugins) {
      options.plugins.forEach(plugin => this.installPlugin(plugin));
    }
  }, ['core']);
  
})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem);
`);
  
  return lines.join('\n');
}

function buildPerfModule(source) {
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, Store, Renderer) {');
  lines.push("  'use strict';");
  lines.push('');
  
  const perfMatch = source.match(/  const Perf = \{[\s\S]*?\n  \};/);
  if (perfMatch) lines.push(perfMatch[0], '');
  
  const virtualScrollerClass = extractClass(source, 'VirtualScroller');
  if (virtualScrollerClass) lines.push(virtualScrollerClass, '');
  
  lines.push(`
  CardFrame.Perf = Perf;
  CardFrame.VirtualScroller = VirtualScroller;
  CardFrameCore.Perf = Perf;
  CardFrameCore.VirtualScroller = VirtualScroller;
  
  CardFrame.registerModule('perf', function(options) {
    this.virtualScroller = new VirtualScroller(this.container, this.store, this.renderer, {
      overscan: (options && options.overscan) || 5
    });
    
    this.enableVirtualScroll = function(opts) { this.virtualScroller.enable(opts); };
    this.disableVirtualScroll = function() {
      this.virtualScroller.disable();
      if (this.renderer) this.renderer.forceFullRender(this.store.getAllCards());
    };
    this.isVirtualScrollEnabled = function() { return this.virtualScroller.isEnabled(); };
    this.getPerfStats = function() { return Perf.getStats(); };
    
    if (options && options.virtualScroll) {
      this.virtualScroller.enable();
    }
  }, ['core', 'render']);
  
  CardFrame.getPerfStats = function() { return Perf.getStats(); };
  
})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.Store, window.CardFrameCore.Renderer || {});
`);
  
  return lines.join('\n');
}

function buildLoader() {
  return `(function(window) {
  'use strict';

  const MODULE_CONFIG = {
    core: { deps: [], file: 'core.js' },
    security: { deps: ['core'], file: 'security.js' },
    render: { deps: ['core'], file: 'render.js' },
    validation: { deps: ['core'], file: 'validation.js' },
    extras: { deps: ['core', 'render'], file: 'extras.js' },
    plugins: { deps: ['core'], file: 'plugins.js' },
    perf: { deps: ['core', 'render'], file: 'perf.js' }
  };

  const _loaded = new Set();
  const _loading = new Map();
  let _baseUrl = '';

  function getScriptBase() {
    if (_baseUrl) return _baseUrl;
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      const src = script.src;
      if (src.includes('loader.js') || src.includes('core.js') || src.includes('card-framework')) {
        _baseUrl = src.substring(0, src.lastIndexOf('/') + 1);
        return _baseUrl;
      }
    }
    return '';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = getScriptBase() + src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('加载脚本失败: ' + src));
      document.head.appendChild(script);
    });
  }

  async function loadModule(moduleName) {
    if (_loaded.has(moduleName)) return;
    if (_loading.has(moduleName)) return _loading.get(moduleName);

    const config = MODULE_CONFIG[moduleName];
    if (!config) throw new Error('未知模块: ' + moduleName);

    const promise = (async () => {
      for (const dep of config.deps) {
        await loadModule(dep);
      }
      await loadScript(config.file);
      _loaded.add(moduleName);
      _loading.delete(moduleName);
    })();

    _loading.set(moduleName, promise);
    return promise;
  }

  function preload(moduleName) { return loadModule(moduleName); }
  function isLoaded(moduleName) { return _loaded.has(moduleName); }
  function setBaseUrl(url) { _baseUrl = url.endsWith('/') ? url : url + '/'; }

  const ModuleLoader = {
    load: loadModule,
    preload,
    isLoaded,
    setBaseUrl,
    modules: MODULE_CONFIG
  };

  if (window.CardFrame) {
    window.CardFrame.load = loadModule;
    window.CardFrame.preload = preload;
    window.CardFrame.isModuleLoaded = isLoaded;
    window.CardFrame.ModuleLoader = ModuleLoader;
  }

  window.CardFrameModuleLoader = ModuleLoader;

})(window);`;
}

function build() {
  console.log('开始构建...');
  
  ensureDir(DIST_DIR);
  
  const source = readSource();
  
  console.log('生成 core.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'core.js'), buildCoreModule(source), 'utf-8');
  
  console.log('生成 security.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'security.js'), buildSecurityModule(source), 'utf-8');
  
  console.log('生成 render.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'render.js'), buildRenderModule(source), 'utf-8');
  
  console.log('生成 validation.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'validation.js'), buildValidationModule(source), 'utf-8');
  
  console.log('生成 extras.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'extras.js'), buildExtrasModule(source), 'utf-8');
  
  console.log('生成 plugins.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'plugins.js'), buildPluginsModule(source), 'utf-8');
  
  console.log('生成 perf.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'perf.js'), buildPerfModule(source), 'utf-8');
  
  console.log('生成 card-framework.js (完整打包版)...');
  fs.writeFileSync(path.join(DIST_DIR, 'card-framework.js'), source, 'utf-8');
  
  console.log('生成 loader.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'loader.js'), buildLoader(), 'utf-8');
  
  console.log('复制 CSS 文件...');
  if (fs.existsSync(CSS_SRC_PATH)) {
    const cssContent = fs.readFileSync(CSS_SRC_PATH, 'utf-8');
    fs.writeFileSync(path.join(DIST_DIR, 'card-framework.css'), cssContent, 'utf-8');
  }
  
  console.log('构建完成！');
  console.log('输出目录:', DIST_DIR);
  console.log('生成的文件:');
  console.log('  - core.js (核心模块)');
  console.log('  - security.js (安全模块)');
  console.log('  - render.js (渲染模块)');
  console.log('  - validation.js (验证模块)');
  console.log('  - extras.js (扩展模块)');
  console.log('  - plugins.js (插件模块)');
  console.log('  - perf.js (性能模块)');
  console.log('  - loader.js (模块加载器)');
  console.log('  - card-framework.js (完整打包版)');
  console.log('  - card-framework.css (样式文件)');
}

build();
