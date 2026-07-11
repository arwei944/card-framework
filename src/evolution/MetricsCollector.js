/**
 * Collects performance, interaction, and architecture metrics for the card framework.
 * @module evolution/MetricsCollector
 */
import { EVENT_TYPES } from '../utils/constants.js';

export class MetricsCollector {
  constructor(frame, eventBus) {
    this.frame = frame;
    this._eventBus = eventBus;
    this.samples = {
      performance: [],
      interaction: [],
      architecture: []
    };
    this._timers = {};
    this._eventHandlers = {};
    this._maxSamples = 288;
  }

  start() {
    this._timers.perf = setInterval(() => this._collectPerformance(), 5000);
    this._timers.arch = setInterval(() => this._collectArchitecture(), 3600000);
    this._attachInteractionListeners();
  }

  stop() {
    Object.keys(this._timers).forEach((key) => { clearInterval(this._timers[key]); this._timers[key] = undefined; });
    this._detachInteractionListeners();
  }

  _collectPerformance() {
    const sample = {
      timestamp: Date.now(),
      renderTime: this.frame.renderer._lastRenderTime || 0,
      cardCount: this.frame.store.cards.size,
      poolStats: this.frame.cardObjectPool ? this.frame.cardObjectPool.getStats() : {},
      cacheStats: this.frame.layoutEngine && this.frame.layoutEngine.layoutCache ? this.frame.layoutEngine.layoutCache.getStats() : {},
      memoryMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0
    };
    this._pushSample('performance', sample);
  }

  _attachInteractionListeners() {
    this._eventHandlers.cardAdded = (card) => { this._recordInteraction('card-add', card.type); };
    this._eventHandlers.cardUpdated = (card) => { this._recordInteraction('card-update', card.type); };
    this._eventBus.on(EVENT_TYPES.CARD_ADDED, this._eventHandlers.cardAdded);
    this._eventBus.on(EVENT_TYPES.CARD_UPDATED, this._eventHandlers.cardUpdated);
  }

  _collectArchitecture() {
    const types = this.frame.typeRegistry.types;
    let maxDepth = 0;
    types.forEach((t) => {
      if (t.extends) {
        let depth = 0;
        let current = t;
        while (current.extends) {
          depth++;
          current = types.get(current.extends);
          if (!current) break;
        }
        maxDepth = Math.max(maxDepth, depth);
      }
    });
    const sample = {
      timestamp: Date.now(),
      typeCount: types.size,
      maxInheritanceDepth: maxDepth,
      pluginCount: this.frame.pluginManager._plugins ? this.frame.pluginManager._plugins.size : 0,
      listenerCount: this.frame.renderer._trackedListeners ? this.frame.renderer._trackedListeners.size : 0
    };
    this._pushSample('architecture', sample);
  }

  getSnapshot() {
    const perf = this.samples.performance;
    const last5 = perf.slice(-12);
    return {
      performance: {
        avgRenderTime: this._avg(last5, 'renderTime'),
        currentCardCount: perf.length ? perf[perf.length - 1].cardCount : 0,
        poolHitRate: this._last(last5, 'poolStats') ? (this._last(last5, 'poolStats').hitRate || 0) : 0,
        cacheHitRate: this._last(last5, 'cacheStats') ? (this._last(last5, 'cacheStats').hitRate || 0) : 0,
        memoryMB: this._last(last5, 'memoryMB') || 0
      },
      interaction: this._aggregateInteractions(),
      architecture: this.samples.architecture.slice(-1)[0] || {}
    };
  }

  _pushSample(category, sample) {
    this.samples[category].push(sample);
    if (this.samples[category].length > this._maxSamples) {
      this.samples[category].shift();
    }
  }

  _avg(arr, key) {
    if (!arr.length) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) { sum += (arr[i][key] || 0); }
    return sum / arr.length;
  }

  _last(arr, key) {
    if (!arr.length) return null;
    return arr[arr.length - 1][key];
  }

  _recordInteraction(action, type) {
    const sample = { timestamp: Date.now(), action: action, type: type };
    this._pushSample('interaction', sample);
  }

  _aggregateInteractions() {
    const now = Date.now();
    const recent = [];
    for (let i = 0; i < this.samples.interaction.length; i++) {
      if (now - this.samples.interaction[i].timestamp < 300000) {
        recent.push(this.samples.interaction[i]);
      }
    }
    const byType = {};
    for (let j = 0; j < recent.length; j++) {
      const t = recent[j].type;
      byType[t] = (byType[t] || 0) + 1;
    }
    const topTypes = Object.keys(byType).map((type) => {
      return { type: type, count: byType[type] };
    }).sort((a, b) => { return b.count - a.count; }).slice(0, 5);
    return {
      totalActions: recent.length,
      topTypes: topTypes
    };
  }

  _detachInteractionListeners() {
    this._eventBus.off(EVENT_TYPES.CARD_ADDED, this._eventHandlers.cardAdded);
    this._eventBus.off(EVENT_TYPES.CARD_UPDATED, this._eventHandlers.cardUpdated);
  }
}
