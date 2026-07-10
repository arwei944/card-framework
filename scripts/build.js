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

function autoScanClasses(source) {
  const classes = {};
  const pattern = /  class (\w+) \{/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const className = match[1];
    const classCode = extractClass(source, className);
    if (classCode) {
      classes[className] = classCode;
    }
  }
  return classes;
}

function buildModule(moduleName, source, classNames, iifeParams, iifeArgs, registerBlock, extraCode) {
  const classes = autoScanClasses(source);
  const lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore' + (iifeParams ? ', ' + iifeParams : '') + ') {');
  lines.push("  'use strict';");
  lines.push('');
  classNames.forEach(function(className) {
    if (classes[className]) {
      lines.push(classes[className], '');
    }
  });
  if (extraCode) {
    lines.push(extraCode, '');
  }
  classNames.forEach(function(className) {
    lines.push('  CardFrame.' + className + ' = ' + className + ';');
    lines.push('  CardFrameCore.' + className + ' = ' + className + ';');
  });
  if (registerBlock) {
    lines.push(registerBlock, '');
  }
  lines.push('})(window, window.CardFrame, window.CardFrameCore' + (iifeArgs ? ', ' + iifeArgs : '') + ');');
  return lines.join('\n');
}

function buildCoreModule(source) {
  const classes = autoScanClasses(source);
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
    methodsToRemove.forEach(function(method) {
      const regex = new RegExp('    ' + method + '\\([^)]*\\) \\{[\\s\\S]*?\\n    \\},?\\n', 'g');
      utilsCode = utilsCode.replace(regex, '');
    });
    lines.push(utilsCode, '');
  }
  
  const feedbackMatch = source.match(/  const FeedbackSystem = \{[\s\S]*?\n  \};/);
  if (feedbackMatch) lines.push(feedbackMatch[0], '');
  
  var eventBusClass = classes['EventBus'];
  if (eventBusClass) {
    lines.push(eventBusClass, '');
    lines.push('  const eventBus = new EventBus();', '');
  }
  
  var storeClass = classes['Store'];
  if (storeClass) lines.push(storeClass, '');
  
  var typeRegistryClass = classes['TypeRegistry'];
  if (typeRegistryClass) lines.push(typeRegistryClass, '');
  
  const defaultTypesMatch = source.match(/  const defaultCardTypes = \[[\s\S]*?\n  \];/);
  if (defaultTypesMatch) lines.push(defaultTypesMatch[0], '');
  
  lines.push('');
  lines.push('  class CardFrame {');
  lines.push('    constructor(container, options) {');
  lines.push('      if (options === void 0) options = {};');
  lines.push('      if (typeof container === "string") {');
  lines.push('        var el = document.querySelector(container);');
  lines.push('        if (!el) throw new Error("找不到容器元素: " + container);');
  lines.push('        container = el;');
  lines.push('      }');
  lines.push('      if (container.__cardFrame) return container.__cardFrame;');
  lines.push('');
  lines.push('      this.container = container;');
  lines.push('      this.container.classList.add("card-frame");');
  lines.push('      this.container.__cardFrame = this;');
  lines.push('      this._options = options;');
  lines.push('');
  lines.push('      this.store = new Store();');
  lines.push('      this.typeRegistry = new TypeRegistry();');
  lines.push('      this.eventBus = eventBus;');
  lines.push('');
  lines.push('      defaultCardTypes.forEach(function(type) { return this.typeRegistry.register(type); }.bind(this));');
  lines.push('');
  lines.push('      this._initModules(options);');
  lines.push('');
  lines.push('      CardFrame._globalStore = this.store;');
  lines.push('    }');
  lines.push('');
  lines.push('    _initModules(options) {');
  lines.push('      var modules = CardFrame._moduleInits || [];');
  lines.push('      modules.forEach(function(init) {');
  lines.push('        try { init.call(this, options); } catch (e) {');
  lines.push('          console.error("[CardFrame] 模块初始化失败:", e);');
  lines.push('        }');
  lines.push('      }.bind(this));');
  lines.push('    }');
  lines.push('');
  lines.push('    createCard(type, props) {');
  lines.push('      var cardType = this.typeRegistry.get(type);');
  lines.push('      if (cardType && cardType.abstract) {');
  lines.push('        throw new Error("不能创建抽象类型 " + type + " 的卡片");');
  lines.push('      }');
  lines.push('      var card = {');
  lines.push('        id: Utils.generateId("card"),');
  lines.push('        type: type,');
  lines.push('        props: Object.assign({}, props),');
  lines.push('        position: { x: 0, y: 0 },');
  lines.push('        status: "active",');
  lines.push('        createdAt: Date.now(),');
  lines.push('        updatedAt: Date.now()');
  lines.push('      };');
  lines.push('      var validation = this.typeRegistry.validate(card);');
  lines.push('      if (!validation.valid) {');
  lines.push('        validation.errors.forEach(function(err) { return FeedbackSystem.warn(err.message); });');
  lines.push('      }');
  lines.push('      this.store.addCard(card);');
  lines.push('      return card;');
  lines.push('    }');
  lines.push('');
  lines.push('    updateCard(card) { return this.store.updateCard(card); }');
  lines.push('    removeCard(id) { return this.store.removeCard(id); }');
  lines.push('    getCard(id) { return this.store.getCard(id); }');
  lines.push('    getAllCards() { return this.store.getAllCards(); }');
  lines.push('    getCardsByType(type) { return this.store.getCardsByType(type); }');
  lines.push('');
  lines.push('    createRelationship(sourceId, targetId, type, data) {');
  lines.push('      if (type === void 0) type = "reference";');
  lines.push('      if (data === void 0) data = {};');
  lines.push('      return this.store.addRelationship({ sourceId: sourceId, targetId: targetId, type: type, data: data });');
  lines.push('    }');
  lines.push('    removeRelationship(id) { return this.store.removeRelationship(id); }');
  lines.push('    getRelationship(id) { return this.store.getRelationship(id); }');
  lines.push('    getAllRelationships() { return this.store.getAllRelationships(); }');
  lines.push('    getRelationshipsByCard(cardId) { return this.store.getRelationshipsByCard(cardId); }');
  lines.push('    getRelationshipsByType(type) { return this.store.getRelationshipsByType(type); }');
  lines.push('');
  lines.push('    on(eventName, listener) { eventBus.on(eventName, listener); }');
  lines.push('    off(eventName, listener) { eventBus.off(eventName, listener); }');
  lines.push('    once(eventName, listener) { eventBus.once(eventName, listener); }');
  lines.push('    emit(eventName, detail) { eventBus.emit(eventName, detail); }');
  lines.push('');
  lines.push('    exportData() {');
  lines.push('      return {');
  lines.push('        version: "1.0",');
  lines.push('        exportedAt: Date.now(),');
  lines.push('        cards: this.store.getAllCards(),');
  lines.push('        relationships: this.store.getAllRelationships(),');
  lines.push('        metadata: {');
  lines.push('          cardCount: this.store.getAllCards().length,');
  lines.push('          relationshipCount: this.store.getAllRelationships().length');
  lines.push('        }');
  lines.push('      };');
  lines.push('    }');
  lines.push('');
  lines.push('    exportJSON() { return JSON.stringify(this.exportData(), null, 2); }');
  lines.push('');
  lines.push('    importData(data, options) {');
  lines.push('      if (options === void 0) options = {};');
  lines.push('      if (typeof data === "string") data = JSON.parse(data);');
  lines.push('      var mode = options.mode || "merge";');
  lines.push('      var clearBeforeImport = options.clearBeforeImport || false;');
  lines.push('      if (clearBeforeImport) {');
  lines.push('        this.store.cards.clear();');
  lines.push('        this.store.relationships.clear();');
  lines.push('      }');
  lines.push('      if (mode === "replace") {');
  lines.push('        this.store.cards.clear();');
  lines.push('        this.store.relationships.clear();');
  lines.push('      }');
  lines.push('      var importedCards = 0, importedRelationships = 0;');
  lines.push('      if (data.cards) {');
  lines.push('        data.cards.forEach(function(cardData) {');
  lines.push('          if (mode === "merge" && this.store.getCard(cardData.id)) {');
  lines.push('            this.store.updateCard(cardData);');
  lines.push('          } else {');
  lines.push('            this.store.cards.set(cardData.id, cardData);');
  lines.push('          }');
  lines.push('          importedCards++;');
  lines.push('        }.bind(this));');
  lines.push('      }');
  lines.push('      if (data.relationships) {');
  lines.push('        data.relationships.forEach(function(relData) {');
  lines.push('          if (mode === "merge" && this.store.getRelationship(relData.id)) {');
  lines.push('            this.store.updateRelationship(relData);');
  lines.push('          } else {');
  lines.push('            this.store.relationships.set(relData.id, relData);');
  lines.push('          }');
  lines.push('          importedRelationships++;');
  lines.push('        }.bind(this));');
  lines.push('      }');
  lines.push('      this.store.notify();');
  lines.push('      return {');
  lines.push('        importedCards: importedCards, importedRelationships: importedRelationships, mode: mode,');
  lines.push('        totalCards: this.store.getAllCards().length,');
  lines.push('        totalRelationships: this.store.getAllRelationships().length');
  lines.push('      };');
  lines.push('    }');
  lines.push('');
  lines.push('    getStats() {');
  lines.push('      return {');
  lines.push('        cards: { total: this.store.getAllCards().length, byType: this._getCardTypeStats() },');
  lines.push('        relationships: { total: this.store.getAllRelationships().length }');
  lines.push('      };');
  lines.push('    }');
  lines.push('');
  lines.push('    _getCardTypeStats() {');
  lines.push('      var stats = {};');
  lines.push('      this.store.getAllCards().forEach(function(card) {');
  lines.push('        stats[card.type] = (stats[card.type] || 0) + 1;');
  lines.push('      });');
  lines.push('      return stats;');
  lines.push('    }');
  lines.push('');
  lines.push('    toJSON() { return this.store.toJSON(); }');
  lines.push('');
  lines.push('    static fromJSON(data) {');
  lines.push('      var container = document.createElement("div");');
  lines.push('      var frame = new CardFrame(container);');
  lines.push('      var store = Store.fromJSON(data);');
  lines.push('      frame.store = store;');
  lines.push('      return frame;');
  lines.push('    }');
  lines.push('');
  lines.push('    static from(selector) {');
  lines.push('      var container = document.querySelector(selector);');
  lines.push('      if (!container) throw new Error("找不到容器元素: " + selector);');
  lines.push('      return new CardFrame(container);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  CardFrame._moduleInits = [];');
  lines.push('  CardFrame._modules = {};');
  lines.push('');
  lines.push('  CardFrame.registerModule = function(name, initFn, deps) {');
  lines.push('    if (deps === void 0) deps = [];');
  lines.push('    if (CardFrame._modules[name]) return;');
  lines.push('    CardFrame._modules[name] = { deps: deps, loaded: true };');
  lines.push('    if (typeof initFn === "function") {');
  lines.push('      CardFrame._moduleInits.push(initFn);');
  lines.push('    }');
  lines.push('  };');
  lines.push('');
  lines.push('  CardFrame.Utils = Utils;');
  lines.push('  CardFrame.Store = Store;');
  lines.push('  CardFrame.TypeRegistry = TypeRegistry;');
  lines.push('  CardFrame.EventBus = eventBus;');
  lines.push('  CardFrame.FeedbackSystem = FeedbackSystem;');
  lines.push('  CardFrame.EVENT_TYPES = EVENT_TYPES;');
  lines.push('  CardFrame._globalStore = null;');
  lines.push('');
  lines.push('  var globalStore = new Store();');
  lines.push('  var globalTypeRegistry = new TypeRegistry();');
  lines.push('  defaultCardTypes.forEach(function(type) { return globalTypeRegistry.register(type); });');
  lines.push('');
  lines.push('  CardFrame.store = globalStore;');
  lines.push('  CardFrame.typeRegistry = globalTypeRegistry;');
  lines.push('');
  lines.push('  var _loadedModules = new Set(["core"]);');
  lines.push('  var _loadingModules = new Map();');
  lines.push('');
  lines.push('  CardFrame._modules.core = { deps: [], loaded: true };');
  lines.push('');
  lines.push('  CardFrame.load = function(moduleName) {');
  lines.push('    if (_loadedModules.has(moduleName)) return Promise.resolve();');
  lines.push('    if (_loadingModules.has(moduleName)) return _loadingModules.get(moduleName);');
  lines.push('');
  lines.push('    var modConfig = CardFrame._modules[moduleName];');
  lines.push('    if (!modConfig) return Promise.reject(new Error("未知模块: " + moduleName));');
  lines.push('');
  lines.push('    var deps = modConfig.deps || [];');
  lines.push('    var promise = Promise.all(deps.map(function(d) { return CardFrame.load(d); })).then(function() {');
  lines.push('      return new Promise(function(resolve, reject) {');
  lines.push('        var script = document.createElement("script");');
  lines.push('        script.src = moduleName + ".js";');
  lines.push('        script.onload = function() {');
  lines.push('          _loadedModules.add(moduleName);');
  lines.push('          _loadingModules.delete(moduleName);');
  lines.push('          resolve();');
  lines.push('        };');
  lines.push('        script.onerror = function() {');
  lines.push('          _loadingModules.delete(moduleName);');
  lines.push('          reject(new Error("加载模块失败: " + moduleName));');
  lines.push('        };');
  lines.push('        document.head.appendChild(script);');
  lines.push('      });');
  lines.push('    });');
  lines.push('');
  lines.push('    _loadingModules.set(moduleName, promise);');
  lines.push('    return promise;');
  lines.push('  };');
  lines.push('');
  lines.push('  CardFrame.preload = function(moduleName) { return CardFrame.load(moduleName); };');
  lines.push('  CardFrame.isModuleLoaded = function(moduleName) { return _loadedModules.has(moduleName); };');
  lines.push('');
  lines.push('  window.CardFrameCore = {');
  lines.push('    Utils: Utils, Store: Store, TypeRegistry: TypeRegistry, EventBus: eventBus,');
  lines.push('    FeedbackSystem: FeedbackSystem, EVENT_TYPES: EVENT_TYPES, defaultCardTypes: defaultCardTypes');
  lines.push('  };');
  lines.push('');
  lines.push('  window.CardFrame = CardFrame;');
  lines.push('');
  lines.push('  if (typeof customElements !== "undefined") {');
  lines.push('    class CardElement extends HTMLElement {');
  lines.push('      constructor() { super(); this._isUpdating = false; }');
  lines.push('');
  lines.push('      _getFrame() {');
  lines.push('        var frameEl = this.closest(".card-frame, card-frame");');
  lines.push('        return frameEl ? (frameEl.__cardFrame || null) : null;');
  lines.push('      }');
  lines.push('');
  lines.push('      connectedCallback() {');
  lines.push('        var frame = this._getFrame();');
  lines.push('        if (!frame) { this._waitingForFrame = true; return; }');
  lines.push('        this._initCard();');
  lines.push('      }');
  lines.push('');
  lines.push('      _initCard() {');
  lines.push('        var frame = this._getFrame();');
  lines.push('        if (!frame || this.dataset.cardId) return;');
  lines.push('        var card = this._extractCard();');
  lines.push('        frame.store.addCard(card);');
  lines.push('        this.dataset.cardId = card.id;');
  lines.push('      }');
  lines.push('');
  lines.push('      _extractCard() {');
  lines.push('        var props = {};');
  lines.push('        for (var i = 0; i < this.attributes.length; i++) {');
  lines.push('          var attr = this.attributes[i];');
  lines.push('          if (attr.name.startsWith("data-")) props[attr.name.slice(5)] = attr.value;');
  lines.push('          else if (!["type", "id", "class"].includes(attr.name)) props[attr.name] = attr.value;');
  lines.push('        }');
  lines.push('        if (this.innerHTML.trim()) props.content = this.innerHTML.trim();');
  lines.push('        return {');
  lines.push('          id: this.id || Utils.generateId("card"),');
  lines.push('          type: this.getAttribute("type") || "text",');
  lines.push('          props: props,');
  lines.push('          position: { x: 0, y: 0 },');
  lines.push('          status: "active",');
  lines.push('          createdAt: Date.now(),');
  lines.push('          updatedAt: Date.now()');
  lines.push('        };');
  lines.push('      }');
  lines.push('    }');
  lines.push('');
  lines.push('    class CardFrameElement extends HTMLElement {');
  lines.push('      connectedCallback() {');
  lines.push('        if (!this._initialized) {');
  lines.push('          this._initialized = true;');
  lines.push('          this.classList.add("card-frame");');
  lines.push('          var frame = new CardFrame(this);');
  lines.push('          this.__cardFrame = frame;');
  lines.push('        }');
  lines.push('      }');
  lines.push('    }');
  lines.push('');
  lines.push('    customElements.define("card-frame", CardFrameElement);');
  lines.push('    customElements.define("cf-card", CardElement);');
  lines.push('  }');
  lines.push('');
  lines.push('  window.CardFrameCore._loadedModules = _loadedModules;');
  lines.push('  window.CardFrameCore._loadingModules = _loadingModules;');
  lines.push('');
  lines.push('})(window);');
  
  return lines.join('\n');
}

function buildSecurityModule(source) {
  var securityCode = source.match(/  const Security = \{[\s\S]*?\n  \};/);
  var extraCode = '';
  if (securityCode) {
    extraCode = securityCode[0] + '\n';
  }
  extraCode += '';
  extraCode += '  Utils.sanitizeHtml = function(html, options) { return Security.sanitizeHtml(html, options); };';
  extraCode += '\n  Utils.sanitizeUrl = function(url) { return Security.sanitizeUrl(url); };';
  extraCode += '\n  Utils.sanitizeStyle = function(styleStr) { return Security.sanitizeStyle(styleStr); };';
  extraCode += '\n  Utils.isSafeUrl = function(url) { return Security.isSafeUrl(url); };';

  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("security", function(options) {';
  registerBlock += '\n    this.circuitBreaker = new CircuitBreaker((options && options.circuitBreaker) || {});';
  registerBlock += '\n';
  registerBlock += '\n    var origCreate = this.createCard;';
  registerBlock += '\n    var origUpdate = this.updateCard;';
  registerBlock += '\n    var origRemove = this.removeCard;';
  registerBlock += '\n    var self = this;';
  registerBlock += '\n';
  registerBlock += '\n    this.createCard = function(type, props) {';
  registerBlock += '\n      return self.circuitBreaker.execute(function() { return origCreate.call(self, type, props); }, null);';
  registerBlock += '\n    };';
  registerBlock += '\n    this.updateCard = function(card) {';
  registerBlock += '\n      return self.circuitBreaker.execute(function() { return origUpdate.call(self, card); }, card.id);';
  registerBlock += '\n    };';
  registerBlock += '\n    this.removeCard = function(id) {';
  registerBlock += '\n      return self.circuitBreaker.execute(function() { return origRemove.call(self, id); }, id);';
  registerBlock += '\n    };';
  registerBlock += '\n  }, ["core"]);';

  return buildModule('security', source, ['CircuitBreaker'], 'Utils, FeedbackSystem, EVENT_TYPES, eventBus', 'window.CardFrameCore.Utils, window.CardFrameCore.FeedbackSystem, window.CardFrameCore.EVENT_TYPES, window.CardFrameCore.EventBus', registerBlock, extraCode);
}

function buildRenderModule(source) {
  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("render", function(options) {';
  registerBlock += '\n    this.renderer = new Renderer(this.container, this.typeRegistry, this.store);';
  registerBlock += '\n    this.layoutEngine = new LayoutEngine(this.container, this.store, this.renderer);';
  registerBlock += '\n';
  registerBlock += '\n    this.store.subscribe(Utils.debounce(function() {';
  registerBlock += '\n      if (this.virtualScroller && this.virtualScroller.isEnabled()) {';
  registerBlock += '\n        this.virtualScroller.refresh();';
  registerBlock += '\n      } else if (this.renderer) {';
  registerBlock += '\n        this.renderer.renderCards(this.store.getAllCards());';
  registerBlock += '\n      }';
  registerBlock += '\n      if (this.layoutEngine && this.layoutEngine.mode === "canvas") {';
  registerBlock += '\n        this.layoutEngine.syncPositions();';
  registerBlock += '\n      }';
  registerBlock += '\n      if (this.realTimeValidator) {';
  registerBlock += '\n        this.realTimeValidator.resume();';
  registerBlock += '\n      }';
  registerBlock += '\n    }.bind(this), 16));';
  registerBlock += '\n';
  registerBlock += '\n    this.setLayoutMode = function(mode) {';
  registerBlock += '\n      this.layoutEngine.setMode(mode);';
  registerBlock += '\n    };';
  registerBlock += '\n    this.getLayoutMode = function() {';
  registerBlock += '\n      return this.layoutEngine.getMode();';
  registerBlock += '\n    };';
  registerBlock += '\n';
  registerBlock += '\n    this.layoutEngine.applyLayout();';
  registerBlock += '\n  }, ["core"]);';
  registerBlock += '\n';
  registerBlock += '\n  var origFromJSON = CardFrame.fromJSON;';
  registerBlock += '\n  CardFrame.fromJSON = function(data) {';
  registerBlock += '\n    var frame = origFromJSON(data);';
  registerBlock += '\n    return frame;';
  registerBlock += '\n  };';

  return buildModule('render', source, ['Renderer', 'LayoutEngine'], 'Utils, Store, TypeRegistry, eventBus', 'window.CardFrameCore.Utils, window.CardFrameCore.Store, window.CardFrameCore.TypeRegistry, window.CardFrameCore.EventBus', registerBlock);
}

function buildValidationModule(source) {
  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("validation", function(options) {';
  registerBlock += '\n    this.autoFixer = new AutoFixer(this.typeRegistry, this.store, this.container);';
  registerBlock += '\n    this.realTimeValidator = new RealTimeValidator(this.container, this.typeRegistry, this.store, this.autoFixer);';
  registerBlock += '\n    this.autoFixer._getValidator = function() { return this.realTimeValidator; };';
  registerBlock += '\n';
  registerBlock += '\n    if (!options || options.autoValidate !== false) {';
  registerBlock += '\n      this.realTimeValidator.start();';
  registerBlock += '\n    }';
  registerBlock += '\n';
  registerBlock += '\n    this.validateAll = function() { this.realTimeValidator.validateAll(); };';
  registerBlock += '\n    this.fullCheck = function() { return this.realTimeValidator.fullCheck(); };';
  registerBlock += '\n    this.fixAll = function() { return this.autoFixer.fixAll(); };';
  registerBlock += '\n  }, ["core"]);';

  return buildModule('validation', source, ['AutoFixer', 'RealTimeValidator'], 'Utils, eventBus, FeedbackSystem, Security', 'window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem, window.CardFrameCore.Security || {}', registerBlock);
}

function buildExtrasModule(source) {
  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("extras", function(options) {';
  registerBlock += '\n    this.themeManager = new ThemeManager(this.container);';
  registerBlock += '\n    this.i18n = new I18nManager();';
  registerBlock += '\n    this.relationshipEngine = new RelationshipEngine(this.container, this.store);';
  registerBlock += '\n  }, ["core", "render"]);';

  return buildModule('extras', source, ['ThemeManager', 'I18nManager', 'RelationshipEngine'], 'Utils, eventBus, FeedbackSystem', 'window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem', registerBlock);
}

function buildPluginsModule(source) {
  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("plugins", function(options) {';
  registerBlock += '\n    this.pluginManager = new PluginManager(this);';
  registerBlock += '\n';
  registerBlock += '\n    this.installPlugin = function(pluginDef) { return this.pluginManager.install(pluginDef); };';
  registerBlock += '\n    this.uninstallPlugin = function(pluginName) { return this.pluginManager.uninstall(pluginName); };';
  registerBlock += '\n    this.enablePlugin = function(pluginName) { return this.pluginManager.enable(pluginName); };';
  registerBlock += '\n    this.disablePlugin = function(pluginName) { return this.pluginManager.disable(pluginName); };';
  registerBlock += '\n    this.getPlugin = function(pluginName) { return this.pluginManager.get(pluginName); };';
  registerBlock += '\n    this.getAllPlugins = function() { return this.pluginManager.getAll(); };';
  registerBlock += '\n';
  registerBlock += '\n    if (options && options.plugins) {';
  registerBlock += '\n      options.plugins.forEach(function(plugin) { return this.installPlugin(plugin); }.bind(this));';
  registerBlock += '\n    }';
  registerBlock += '\n  }, ["core"]);';

  return buildModule('plugins', source, ['PluginManager'], 'Utils, eventBus, FeedbackSystem', 'window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem', registerBlock);
}

function buildPerfModule(source) {
  var perfCode = source.match(/  const Perf = \{[\s\S]*?\n  \};/);
  var extraCode = '';
  if (perfCode) {
    extraCode = perfCode[0] + '\n';
  }

  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("perf", function(options) {';
  registerBlock += '\n    this.virtualScroller = new VirtualScroller(this.container, this.store, this.renderer, {';
  registerBlock += '\n      overscan: (options && options.overscan) || 5';
  registerBlock += '\n    });';
  registerBlock += '\n';
  registerBlock += '\n    this.enableVirtualScroll = function(opts) { this.virtualScroller.enable(opts); };';
  registerBlock += '\n    this.disableVirtualScroll = function() {';
  registerBlock += '\n      this.virtualScroller.disable();';
  registerBlock += '\n      if (this.renderer) this.renderer.forceFullRender(this.store.getAllCards());';
  registerBlock += '\n    };';
  registerBlock += '\n    this.isVirtualScrollEnabled = function() { return this.virtualScroller.isEnabled(); };';
  registerBlock += '\n    this.getPerfStats = function() { return Perf.getStats(); };';
  registerBlock += '\n';
  registerBlock += '\n    if (options && options.virtualScroll) {';
  registerBlock += '\n      this.virtualScroller.enable();';
  registerBlock += '\n    }';
  registerBlock += '\n  }, ["core", "render"]);';
  registerBlock += '\n';
  registerBlock += '\n  CardFrame.getPerfStats = function() { return Perf.getStats(); };';

  return buildModule('perf', source, ['VirtualScroller'], 'Utils, Store, Renderer', 'window.CardFrameCore.Utils, window.CardFrameCore.Store, window.CardFrameCore.Renderer || {}', registerBlock, extraCode);
}

function buildEvolutionModule(source) {
  var registerBlock = '';
  registerBlock += '  CardFrame.registerModule("evolution", function(options) {';
  registerBlock += '\n    this.cardObjectPool = new CardObjectPool((options && options.cardPool) || {});';
  registerBlock += '\n    this.actionLogger = new ActionLogger((options && options.actionLogger) || {});';
  registerBlock += '\n    this.globalErrorHandler = new GlobalErrorHandler(this.eventBus || EventBus);';
  registerBlock += '\n    this.perfPanel = new PerfPanel();';
  registerBlock += '\n';
  registerBlock += '\n    this.evolutionEngine = options.evolution !== false';
  registerBlock += '\n      ? new EvolutionEngine(this, (options && options.evolution) || {})';
  registerBlock += '\n      : null;';
  registerBlock += '\n    if (this.evolutionEngine) {';
  registerBlock += '\n      this.evolutionEngine.start();';
  registerBlock += '\n    }';
  registerBlock += '\n  }, ["core"]);';
  registerBlock += '\n';
  registerBlock += '\n  CardFrame.getEvolutionHistory = function() {';
  registerBlock += '\n    return CardFrame._globalStore ? [] : [];';
  registerBlock += '\n  };';

  return buildModule('evolution', source, ['EvolutionEngine', 'MetricsCollector', 'RuleEngine', 'ActionLogger', 'CardObjectPool', 'LayoutCache', 'QueryIndex', 'PerfPanel', 'GlobalErrorHandler', 'ShadowCardRegistry'], 'Utils, EventBus, Store, TypeRegistry, FeedbackSystem', 'window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.Store, window.CardFrameCore.TypeRegistry, window.CardFrameCore.FeedbackSystem', registerBlock);
}

function buildLoader() {
  return '(function(window) {\n' +
'  \'use strict\';\n' +
'\n' +
'  var MODULE_CONFIG = {\n' +
'    core: { deps: [], file: \'core.js\' },\n' +
'    security: { deps: [\'core\'], file: \'security.js\' },\n' +
'    render: { deps: [\'core\'], file: \'render.js\' },\n' +
'    validation: { deps: [\'core\'], file: \'validation.js\' },\n' +
'    extras: { deps: [\'core\', \'render\'], file: \'extras.js\' },\n' +
'    plugins: { deps: [\'core\'], file: \'plugins.js\' },\n' +
'    perf: { deps: [\'core\', \'render\'], file: \'perf.js\' },\n' +
'    evolution: { deps: [\'core\'], file: \'evolution.js\' }\n' +
'  };\n' +
'\n' +
'  var _loaded = new Set();\n' +
'  var _loading = new Map();\n' +
'  var _baseUrl = \'\';\n' +
'\n' +
'  function getScriptBase() {\n' +
'    if (_baseUrl) return _baseUrl;\n' +
'    var scripts = document.querySelectorAll(\'script[src]\');\n' +
'    for (var i = 0; i < scripts.length; i++) {\n' +
'      var src = scripts[i].src;\n' +
'      if (src.indexOf(\'loader.js\') !== -1 || src.indexOf(\'core.js\') !== -1 || src.indexOf(\'card-framework\') !== -1) {\n' +
'        _baseUrl = src.substring(0, src.lastIndexOf(\'/\') + 1);\n' +
'        return _baseUrl;\n' +
'      }\n' +
'    }\n' +
'    return \'\';\n' +
'  }\n' +
'\n' +
'  function loadScript(src) {\n' +
'    return new Promise(function(resolve, reject) {\n' +
'      var script = document.createElement(\'script\');\n' +
'      script.src = getScriptBase() + src;\n' +
'      script.onload = resolve;\n' +
'      script.onerror = function() { reject(new Error(\'加载脚本失败: \' + src)); };\n' +
'      document.head.appendChild(script);\n' +
'    });\n' +
'  }\n' +
'\n' +
'  async function loadModule(moduleName) {\n' +
'    if (_loaded.has(moduleName)) return;\n' +
'    if (_loading.has(moduleName)) return _loading.get(moduleName);\n' +
'\n' +
'    var config = MODULE_CONFIG[moduleName];\n' +
'    if (!config) throw new Error(\'未知模块: \' + moduleName);\n' +
'\n' +
'    var promise = (async function() {\n' +
'      for (var i = 0; i < config.deps.length; i++) {\n' +
'        await loadModule(config.deps[i]);\n' +
'      }\n' +
'      await loadScript(config.file);\n' +
'      _loaded.add(moduleName);\n' +
'      _loading.delete(moduleName);\n' +
'    })();\n' +
'\n' +
'    _loading.set(moduleName, promise);\n' +
'    return promise;\n' +
'  }\n' +
'\n' +
'  function preload(moduleName) { return loadModule(moduleName); }\n' +
'  function isLoaded(moduleName) { return _loaded.has(moduleName); }\n' +
'  function setBaseUrl(url) { _baseUrl = url.endsWith(\'/\') ? url : url + \'/\'; }\n' +
'\n' +
'  var ModuleLoader = {\n' +
'    load: loadModule,\n' +
'    preload: preload,\n' +
'    isLoaded: isLoaded,\n' +
'    setBaseUrl: setBaseUrl,\n' +
'    modules: MODULE_CONFIG\n' +
'  };\n' +
'\n' +
'  if (window.CardFrame) {\n' +
'    window.CardFrame.load = loadModule;\n' +
'    window.CardFrame.preload = preload;\n' +
'    window.CardFrame.isModuleLoaded = isLoaded;\n' +
'    window.CardFrame.ModuleLoader = ModuleLoader;\n' +
'  }\n' +
'\n' +
'  window.CardFrameModuleLoader = ModuleLoader;\n' +
'\n' +
'})(window);';
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
  
  console.log('生成 evolution.js...');
  fs.writeFileSync(path.join(DIST_DIR, 'evolution.js'), buildEvolutionModule(source), 'utf-8');
  
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
  console.log('  - evolution.js (自进化模块)');
  console.log('  - loader.js (模块加载器)');
  console.log('  - card-framework.js (完整打包版)');
  console.log('  - card-framework.css (样式文件)');
}

build();