/**
 * CardObjectPool — object pool for card reuse to reduce GC pressure.
 * @module perf/CardObjectPool
 */

export class CardObjectPool {
  constructor(options = {}) {
    this._pool = new Map();
    this._maxPerType = options.maxPerType || 100;
    this._hits = 0;
    this._misses = 0;
    this._releases = 0;
    this._acquires = 0;
  }

  acquire(type) {
    this._acquires++;
    const list = this._pool.get(type);
    if (list && list.length > 0) {
      const card = list.pop();
      this._hits++;
      card._inPool = false;
      return card;
    }
    this._misses++;
    return null;
  }

  release(card) {
    if (!card || !card.type) return;
    if (card._inPool) return;
    card._inPool = true;

    let list = this._pool.get(card.type);
    if (!list) {
      list = [];
      this._pool.set(card.type, list);
    }
    if (list.length >= this._maxPerType) {
      return;
    }
    card.id = null;
    card.props = {};
    card._relations = [];
    list.push(card);
    this._releases++;
  }

  clear() {
    this._pool.clear();
  }

  getStats() {
    const byType = {};
    let total = 0;
    this._pool.forEach((list, type) => {
      byType[type] = list.length;
      total += list.length;
    });
    return {
      total,
      byType,
      hits: this._hits,
      misses: this._misses,
      acquires: this._acquires,
      releases: this._releases,
      hitRate: this._hits + this._misses > 0
        ? this._hits / (this._hits + this._misses)
        : 0
    };
  }

  setMaxPerType(max) {
    this._maxPerType = max;
  }
}
