/**
 * CardFrame - ES Module Entry Point
 *
 * Replaces the original IIFE's window.CardFrame assignment and
 * customElements.define calls (L7032-7092 of original source).
 *
 * Usage (ES Module):
 *   import { CardFrame } from './src/index.js';
 *   const frame = new CardFrame('#container');
 *
 * Usage (传统 <script> 标签，需配合打包工具):
 *   <script type="module" src="./dist/card-framework.esm.js"></script>
 */

// ─── Core ──────────────────────────────────────────────────
import { CardFrame } from './core/CardFrame.js';
import { EventBus } from './core/EventBus.js';
import { Store } from './core/Store.js';
import { TypeRegistry } from './core/TypeRegistry.js';
import { defaultCardTypes } from './core/defaultCardTypes.js';

// ─── Utils & Constants ────────────────────────────────────
import { Utils } from './utils/Utils.js';
import { FeedbackSystem } from './utils/FeedbackSystem.js';
import { EVENT_TYPES, DEFAULT_CONFIG, CARD_STATUS, RELATIONSHIP_TYPES } from './utils/constants.js';

// ─── Security ─────────────────────────────────────────────
import { Security } from './security/Security.js';
import { CircuitBreaker } from './security/CircuitBreaker.js';

// ─── Render ───────────────────────────────────────────────
import { Renderer } from './render/Renderer.js';
import { LayoutEngine } from './render/LayoutEngine.js';
import { VirtualScroller } from './render/VirtualScroller.js';

// ─── Validation ───────────────────────────────────────────
import { AutoFixer } from './validation/AutoFixer.js';
import { RealTimeValidator } from './validation/RealTimeValidator.js';

// ─── Extras ───────────────────────────────────────────────
import { ThemeManager } from './extras/ThemeManager.js';
import { I18nManager } from './extras/I18nManager.js';
import { RelationshipEngine } from './extras/RelationshipEngine.js';

// ─── Plugins ──────────────────────────────────────────────
import { PluginManager } from './plugins/PluginManager.js';
import { PluginSandbox } from './plugins/PluginSandbox.js';

// ─── Performance ──────────────────────────────────────────
import { Perf } from './perf/Perf.js';
import { CardObjectPool } from './perf/CardObjectPool.js';
import { LayoutCache } from './perf/LayoutCache.js';
import { QueryIndex } from './perf/QueryIndex.js';

// ─── Evolution ────────────────────────────────────────────
import { ActionLogger } from './evolution/ActionLogger.js';
import { PerfPanel } from './evolution/PerfPanel.js';
import { GlobalErrorHandler } from './evolution/GlobalErrorHandler.js';
import { ShadowCardRegistry } from './evolution/ShadowCardRegistry.js';
import { MetricsCollector } from './evolution/MetricsCollector.js';
import { RuleEngine } from './evolution/RuleEngine.js';
import { EvolutionEngine } from './evolution/EvolutionEngine.js';

// ─── Web Components ───────────────────────────────────────
import { CardElement } from './web-components/CardElement.js';
import { CardFrameElement } from './web-components/CardFrameElement.js';
import { defineShadowCardElement } from './web-components/ShadowCardElement.js';

// ─── Static Class References ──────────────────────────────
// Original L7032-7062: CardFrame.Utils = Utils, etc.
// These provide access to internal classes for advanced use cases.

CardFrame.EventBus = EventBus;
CardFrame.Utils = Utils;
CardFrame.Store = Store;
CardFrame.TypeRegistry = TypeRegistry;
CardFrame.Renderer = Renderer;
CardFrame.LayoutEngine = LayoutEngine;
CardFrame.AutoFixer = AutoFixer;
CardFrame.RealTimeValidator = RealTimeValidator;
CardFrame.FeedbackSystem = FeedbackSystem;
CardFrame.PluginManager = PluginManager;
CardFrame.PluginSandbox = PluginSandbox;
CardFrame.ActionLogger = ActionLogger;
CardFrame.CircuitBreaker = CircuitBreaker;
CardFrame.ThemeManager = ThemeManager;
CardFrame.I18nManager = I18nManager;
CardFrame.RelationshipEngine = RelationshipEngine;
CardFrame.VirtualScroller = VirtualScroller;
CardFrame.MetricsCollector = MetricsCollector;
CardFrame.RuleEngine = RuleEngine;
CardFrame.Security = Security;
CardFrame.Perf = Perf;
CardFrame.PerfPanel = PerfPanel;
CardFrame.GlobalErrorHandler = GlobalErrorHandler;
CardFrame.CardObjectPool = CardObjectPool;
CardFrame.LayoutCache = LayoutCache;
CardFrame.QueryIndex = QueryIndex;
CardFrame.ShadowCardRegistry = ShadowCardRegistry;
CardFrame.EvolutionEngine = EvolutionEngine;
CardFrame.EVENT_TYPES = EVENT_TYPES;
CardFrame.DEFAULT_CONFIG = DEFAULT_CONFIG;
CardFrame.CARD_STATUS = CARD_STATUS;
CardFrame.RELATIONSHIP_TYPES = RELATIONSHIP_TYPES;
CardFrame._globalStore = null;

// ─── Global Singleton Instances ───────────────────────────
// Original L7064-7077: Pre-created instances for static access.
// These provide a default store/typeRegistry/renderer for use
// without creating a full CardFrame instance.
// NOTE: These will be eliminated in Phase 4 (T4.06) — each CardFrame
// instance should own its own subsystems with no shared global state.

const _globalEventBus = new EventBus();
const globalStore = new Store(_globalEventBus);
const globalTypeRegistry = new TypeRegistry();
const _container = typeof document !== 'undefined' ? document.body : null;
const globalRenderer = new Renderer(_container, globalTypeRegistry, globalStore, _globalEventBus);
const globalAutoFixer = new AutoFixer(globalTypeRegistry, globalStore, _container, _globalEventBus);
const globalValidator = new RealTimeValidator(_container, globalTypeRegistry, globalStore, globalAutoFixer, _globalEventBus);

defaultCardTypes.forEach(type => globalTypeRegistry.register(type));

CardFrame.store = globalStore;
CardFrame.typeRegistry = globalTypeRegistry;
CardFrame.renderer = globalRenderer;
CardFrame.autoFixer = globalAutoFixer;
CardFrame.realTimeValidator = globalValidator;

// ─── Shadow Card Registry ─────────────────────────────────
// Original L7082-7084
const _globalShadowCardRegistry = new ShadowCardRegistry();
CardFrame.shadowCardRegistry = _globalShadowCardRegistry;
CardFrame.defineShadowCard = () => defineShadowCardElement(_globalShadowCardRegistry);

// ─── Custom Element Registration ──────────────────────────
// Original L7087-7090
if (typeof customElements !== 'undefined') {
  if (!customElements.get('card-frame')) {
    customElements.define('card-frame', CardFrameElement);
  }
  if (!customElements.get('cf-card')) {
    customElements.define('cf-card', CardElement);
  }
}

// ─── Backward Compatibility ───────────────────────────────
// Original L7079: window.CardFrame = CardFrame
if (typeof window !== 'undefined') {
  window.CardFrame = CardFrame;
}

// ─── Public API Exports ───────────────────────────────────
export {
  CardFrame,
  EventBus,
  Store,
  TypeRegistry,
  Renderer,
  LayoutEngine,
  AutoFixer,
  RealTimeValidator,
  PluginManager,
  PluginSandbox,
  CircuitBreaker,
  ActionLogger,
  GlobalErrorHandler,
  PerfPanel,
  CardObjectPool,
  ThemeManager,
  I18nManager,
  RelationshipEngine,
  VirtualScroller,
  EvolutionEngine,
  MetricsCollector,
  RuleEngine,
  ShadowCardRegistry,
  Security,
  Perf,
  Utils,
  FeedbackSystem,
  LayoutCache,
  QueryIndex,
  CardElement,
  CardFrameElement,
  defineShadowCardElement,
  defaultCardTypes,
  EVENT_TYPES,
  DEFAULT_CONFIG,
  CARD_STATUS,
  RELATIONSHIP_TYPES
};

export default CardFrame;
