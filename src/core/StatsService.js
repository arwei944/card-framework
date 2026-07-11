/**
 * Statistics aggregation concern, extracted from CardFrame to shrink its
 * surface area. Functions take collaborators explicitly rather than reaching
 * into a CardFrame instance.
 * @module core/StatsService
 */

import { Perf } from '../perf/Perf.js';

/**
 * Count cards grouped by type.
 * @param {Object} store - store with getAllCards()
 * @returns {Object} type -> count
 */
export function getCardTypeStats(store) {
  const stats = {};
  store.getAllCards().forEach(card => {
    stats[card.type] = (stats[card.type] || 0) + 1;
  });
  return stats;
}

/**
 * Build the aggregate framework stats object.
 * @param {Object} deps - { store, pluginManager, layoutEngine, circuitBreaker, autoFixer }
 * @returns {Object}
 */
export function getStats({ store, pluginManager, layoutEngine, circuitBreaker, autoFixer }) {
  return {
    cards: {
      total: store.getAllCards().length,
      byType: getCardTypeStats(store)
    },
    relationships: {
      total: store.getAllRelationships().length
    },
    plugins: {
      total: pluginManager.getAll().length,
      enabled: pluginManager.getAll().filter(p => p.enabled).length
    },
    layout: {
      mode: layoutEngine.mode,
      zoom: layoutEngine.zoom
    },
    circuitBreaker: circuitBreaker.getStats(),
    autoFixer: autoFixer.getStats(),
    performance: Perf.getStats()
  };
}
