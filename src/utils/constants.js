/**
 * CardFrame framework constants
 * @module utils/constants
 */

/** Framework version — single source of truth, shared by CardFrame.VERSION. */
export const VERSION = '1.0.0';

/** Framework event type names */
export const EVENT_TYPES = {
  CARD_ADDED: 'cardAdded',
  CARD_UPDATED: 'cardUpdated',
  CARD_REMOVED: 'cardRemoved',
  RELATIONSHIP_ADDED: 'relationshipAdded',
  RELATIONSHIP_REMOVED: 'relationshipRemoved',
  CARD_VALIDATION_ERROR: 'cardValidationError',
  CARD_AUTO_FIXED: 'cardAutoFixed',
  LAYOUT_CHANGED: 'layoutChanged',
  FRAMEWORK_ERROR: 'frameworkError',
  DOM_SYNCHRONIZED: 'domSynchronized',
  PLUGIN_INSTALLED: 'pluginInstalled',
  PLUGIN_UNINSTALLED: 'pluginUninstalled',
  PLUGIN_ENABLED: 'pluginEnabled',
  PLUGIN_DISABLED: 'pluginDisabled',
  THEME_CHANGED: 'themeChanged',
  LANGUAGE_CHANGED: 'languageChanged',
  CIRCUIT_BREAKER_OPENED: 'circuitBreakerOpened',
  CIRCUIT_BREAKER_CLOSED: 'circuitBreakerClosed'
};

/** Default configuration values */
export const DEFAULT_CONFIG = {
  DEBOUNCE_RENDER_MS: 16,
  RENDER_RAF_MS: 16,
  VALIDATION_DEBOUNCE_MS: 150,
  FULL_CHECK_INTERVAL_MS: 30000,
  VIRTUAL_SCROLL_OVERSCAN: 5,
  DEFAULT_CARD_WIDTH: 280,
  DEFAULT_CARD_HEIGHT: 200,
  CIRCUIT_BREAKER: {
    CARD_FAILURE_THRESHOLD: 5,
    GLOBAL_FAILURE_THRESHOLD: 20,
    WINDOW_MS: 60000,
    RESET_TIMEOUT_MS: 30000
  },
  ZOOM: {
    MIN: 0.25,
    MAX: 4,
    STEP: 0.1
  },
  FEEDBACK_LEVEL: 'warn',
  LAYOUT_CACHE_MAX_SIZE: 5000,
  CARD_POOL_MAX_PER_TYPE: 100
};

/** Card lifecycle status values */
export const CARD_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

/** Relationship type values */
export const RELATIONSHIP_TYPES = {
  REFERENCE: 'reference',
  PARENT: 'parent',
  CHILD: 'child',
  DEPENDENCY: 'dependency',
  RELATED: 'related'
};
