/**
 * LayoutCache — LRU cache for layout computation results.
 * @module perf/LayoutCache
 */

export class LayoutCache {
  constructor(options = {}) {
    this._cache = new Map();
    this._dirty = new Set();
    this._maxSize = options.maxSize || 5000;
    this._hits = 0;
    this._misses = 0;
  }

  markDirty(cardId) {
    if (cardId) this._dirty.add(cardId);
  }

  markDirtyBatch(cardIds) {
    if (Array.isArray(cardIds)) {
      cardIds.forEach(id => this._dirty.add(id));
    }
  }

  markAllDirty() {
    const ids = Array.from(this._cache.keys());
    ids.forEach(id => this._dirty.add(id));
  }

  get(cardId) {
    const value = this._cache.get(cardId);
    if (value !== undefined) {
      this._hits++;
      this._cache.delete(cardId);
      this._cache.set(cardId, value);
      return value;
    }
    this._misses++;
    return null;
  }

  set(cardId, layoutResult) {
    if (this._cache.size >= this._maxSize && !this._cache.has(cardId)) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(cardId, layoutResult);
    this._dirty.delete(cardId);
  }

  remove(cardId) {
    this._cache.delete(cardId);
    this._dirty.delete(cardId);
  }

  removeBatch(cardIds) {
    if (Array.isArray(cardIds)) {
      cardIds.forEach(id => {
        this._cache.delete(id);
        this._dirty.delete(id);
      });
    }
  }

  clear() {
    this._cache.clear();
    this._dirty.clear();
  }

  getDirtyCards() {
    return Array.from(this._dirty);
  }

  isDirty(cardId) {
    return this._dirty.has(cardId);
  }

  getStats() {
    return {
      size: this._cache.size,
      dirty: this._dirty.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? this._hits / (this._hits + this._misses)
        : 0
    };
  }
}
